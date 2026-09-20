"""MaleCNS reservoir and trained Connect Four readout."""

from __future__ import annotations

import json
import os
from pathlib import Path
import threading
import zlib

import joblib
import numpy as np
from flybrain import FlyBrain, Trace

ROOT = Path(__file__).resolve().parent
DEFAULT_MODEL = ROOT / "models" / "connect_four_policy.joblib"
DEFAULT_METADATA = ROOT / "models" / "connect_four_readout.json"


class BrainNotTrainedError(RuntimeError):
    pass


class MaleCNSConnectFour:
    """Fixed biological connectome used as a reservoir with a trained readout.

    MaleCNS synaptic weights are never replaced by minimax. Minimax supplies
    labels during offline training only; runtime moves are decoded from spikes.
    """

    simulation_steps = 8
    input_amount = 0.82

    def __init__(
        self,
        model_path: Path = DEFAULT_MODEL,
        metadata_path: Path = DEFAULT_METADATA,
        require_model: bool = True,
    ) -> None:
        device = os.environ.get("FLY_DEVICE", "auto")
        self.brain = FlyBrain(device=device, sensory_input=False, refractory=0.04)
        self.lock = threading.Lock()
        self.input_groups = self._build_input_groups()
        self.projection_neurons = self.brain.cells(["visual_projection"])
        self.descending_neurons = self.brain.cells(["descending_neuron"])
        self.input_neurons = np.unique(np.concatenate(self.input_groups))
        self.output_neurons = np.unique(
            np.concatenate((self.projection_neurons, self.descending_neurons))
        )
        if not len(self.output_neurons):
            raise RuntimeError("MaleCNS data contains no readout population")
        self.trace_neurons = np.unique(
            np.concatenate((self.input_neurons, self.output_neurons))
        )
        self.feature_pools = self._build_feature_pools()

        self.model_path = Path(model_path)
        self.metadata_path = Path(metadata_path)
        self.readout = joblib.load(self.model_path) if self.model_path.exists() else None
        self.metadata = (
            json.loads(self.metadata_path.read_text())
            if self.metadata_path.exists()
            else {}
        )
        if require_model and self.readout is None:
            raise BrainNotTrainedError(
                f"no trained readout at {self.model_path}; run `python -m backend.train`"
            )

    def _build_input_groups(self) -> list[np.ndarray]:
        visual = np.asarray(self.brain.visual, dtype=np.int64)
        if len(visual) < 84:
            raise RuntimeError(f"MaleCNS visual population is too small ({len(visual)})")
        azimuth = np.asarray(self.brain.azimuth)
        order = np.argsort(azimuth, kind="stable")
        ordered = visual[order]
        # Separate interleaved banks encode the two piece identities without
        # inventing negative firing rates.
        bank_a = ordered[::2]
        bank_b = ordered[1::2]
        return [
            np.asarray(group, dtype=np.int64)
            for bank in (bank_a, bank_b)
            for group in np.array_split(bank, 42)
        ]

    def _build_feature_pools(self) -> list[np.ndarray]:
        """Pool real spike traces into stable sensory and connectome features."""
        slot = np.full(self.brain.n, -1, dtype=np.int64)
        slot[self.trace_neurons] = np.arange(len(self.trace_neurons))
        pools = [slot[group] for group in self.input_groups]
        rng = np.random.default_rng(166_700)
        for neurons, count in (
            (self.projection_neurons, 192),
            (self.descending_neurons, 64),
        ):
            shuffled = rng.permutation(neurons)
            pools.extend(slot[group] for group in np.array_split(shuffled, count))
        return [pool[pool >= 0] for pool in pools]

    def _injections(self, board: np.ndarray):
        injections = []
        for cell, value in enumerate(board.flat):
            if value == 1:
                injections.append((self.input_groups[cell], self.input_amount))
            elif value == -1:
                injections.append((self.input_groups[42 + cell], self.input_amount))
        return injections

    @staticmethod
    def _seed_for(board: np.ndarray) -> int:
        return zlib.crc32(board.tobytes())

    def activity(self, board: np.ndarray) -> tuple[np.ndarray, list[int]]:
        trace = Trace(self.brain, idx=self.trace_neurons, tau=0.16)
        active: set[int] = set()
        self.brain.reset(self._seed_for(board))
        injections = self._injections(board)
        for _ in range(self.simulation_steps):
            fired = self.brain.step(inject=injections)
            trace.observe(fired)
            if len(active) < 8_000:
                active.update(int(index) for index in fired[: 8_000 - len(active)])
        raw = trace.features()
        features = np.asarray(
            [float(raw[pool].mean()) if len(pool) else 0.0 for pool in self.feature_pools],
            dtype=np.float32,
        )
        return features, sorted(active)

    def decide(self, board_values: list[int]) -> dict:
        if self.readout is None:
            raise BrainNotTrainedError("the MaleCNS readout has not been trained")
        board = np.asarray(board_values, dtype=np.int8).reshape(6, 7)
        legal = np.flatnonzero(board[0] == 0)
        if not len(legal):
            raise ValueError("the board has no legal columns")
        with self.lock:
            features, active = self.activity(board)
            probabilities = self._policy_probabilities(features)
            scores = np.zeros(7, dtype=np.float64)
            scores[:] = probabilities
        masked = np.full(7, -np.inf)
        masked[legal] = scores[legal]
        selected = int(np.argmax(masked))
        return {
            "selectedColumn": selected,
            "candidateScores": [
                float(scores[column]) if column in legal else None
                for column in range(7)
            ],
            "neuralResponse": [float(value) for value in scores],
            "activeNeurons": active,
            "source": "malecns-v1.0-trained-readout",
            "simulationSteps": self.simulation_steps,
        }

    def _policy_probabilities(self, features: np.ndarray) -> np.ndarray:
        if not isinstance(self.readout, dict):
            raw = self.readout.predict_proba(features[None])[0]
            scores = np.zeros(7, dtype=np.float64)
            scores[np.asarray(self.readout.classes_, dtype=np.int64)] = raw
            return scores

        sensory = self.readout["policy"].predict_proba(features[None, :84])[0]
        connectome = self.readout["connectome_policy"].predict_proba(features[None])[0]
        sensory_weight = float(self.readout.get("sensory_weight", 0.7))
        scores = sensory_weight * sensory + (1 - sensory_weight) * connectome

        detector = self.readout["tactical_detector"].predict_proba(
            features[None, :84]
        )[0]
        detector_classes = self.readout["tactical_detector"].classes_
        tactical_confidence = max(
            (
                probability
                for label, probability in zip(
                    detector_classes, detector, strict=True
                )
                if label != 0
            ),
            default=0.0,
        )
        if tactical_confidence >= float(
            self.readout.get("tactical_threshold", 0.15)
        ):
            tactical = self.readout["tactical_policy"]
            raw = tactical.predict_proba(features[None, :84])[0]
            scores = np.zeros(7, dtype=np.float64)
            scores[np.asarray(tactical.classes_, dtype=np.int64)] = raw
        return scores

    def coordinates(self) -> tuple[np.ndarray, int]:
        if self.brain.positions is None:
            raise RuntimeError("MaleCNS brain data contains no neuron positions")
        positions = np.asarray(self.brain.positions, dtype=np.float32).copy()
        localized = np.isfinite(positions).all(axis=1)
        real = positions[localized]
        missing = np.flatnonzero(~localized)
        if len(missing):
            # MaleCNS metadata lacks a centroid for some genuine neurons. Keep
            # every neuron visible in a clearly reported peripheral ring rather
            # than pretending those generated locations are measured.
            center = (real.min(axis=0) + real.max(axis=0)) / 2
            span = np.maximum(real.max(axis=0) - real.min(axis=0), 1)
            order = np.arange(len(missing), dtype=np.float32)
            angle = order * np.float32(2.3999632)
            layer = (order % 31) / 31 - 0.5
            positions[missing, 0] = center[0] + np.cos(angle) * span[0] * 0.54
            positions[missing, 1] = center[1] + np.sin(angle) * span[1] * 0.54
            positions[missing, 2] = center[2] + layer * span[2] * 0.8
        return positions, int(localized.sum())

    def status(self) -> dict:
        return {
            "ready": self.readout is not None,
            "dataset": "MaleCNS v1.0",
            "neurons": int(self.brain.n),
            "connections": int(len(self.brain.weights)),
            "inputNeurons": int(sum(map(len, self.input_groups))),
            "readoutNeurons": int(len(self.output_neurons)),
            "policyFeatures": int(len(self.feature_pools)),
            "device": self.brain.device,
            "model": self.metadata,
        }
