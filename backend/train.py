"""Train a nonlinear seven-column policy on MaleCNS spike features."""

from __future__ import annotations

from datetime import datetime, timezone
import json
import os
from pathlib import Path
import time

import joblib
import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier

from .brain import DEFAULT_METADATA, DEFAULT_MODEL, MaleCNSConnectFour
from .connect_four import (
    drop,
    expert_target,
    legal_columns,
    training_positions,
    winner,
)


def sensory_templates(
    real_features: np.ndarray, boards: list[np.ndarray]
) -> tuple[np.ndarray, np.ndarray]:
    flat = np.stack(boards).reshape(-1, 42)
    active = np.concatenate((flat == 1, flat == -1), axis=1)
    on = np.asarray(
        [real_features[active[:, index], index].mean() for index in range(84)]
    )
    off = np.asarray(
        [real_features[~active[:, index], index].mean() for index in range(84)]
    )
    return on, off


def expected_sensory_features(
    boards: list[np.ndarray], on: np.ndarray, off: np.ndarray
) -> np.ndarray:
    values = np.tile(off, (len(boards), 1))
    for index, board in enumerate(boards):
        flat = board.reshape(-1)
        active = np.concatenate((flat == 1, flat == -1))
        values[index, active] = on[active]
    return values


def tactical_target(board: np.ndarray) -> tuple[int, int]:
    legal = legal_columns(board)
    wins = [
        column for column in legal if winner(drop(board, column, -1), -1)
    ]
    threats = [
        column for column in legal if winner(drop(board, column, 1), 1)
    ]
    if wins:
        return 1, min(wins, key=lambda column: abs(column - 3))
    if threats:
        return 2, min(threats, key=lambda column: abs(column - 3))
    return 0, 3


def bundle_probabilities(bundle: dict, features: np.ndarray) -> np.ndarray:
    sensory = bundle["policy"].predict_proba(features[:, :84])
    connectome = bundle["connectome_policy"].predict_proba(features)
    weight = float(bundle["sensory_weight"])
    probabilities = weight * sensory + (1 - weight) * connectome
    detector = bundle["tactical_detector"].predict_proba(features[:, :84])
    tactical = bundle["tactical_policy"]
    tactical_raw = tactical.predict_proba(features[:, :84])
    tactical_scores = np.zeros_like(probabilities)
    tactical_scores[:, tactical.classes_] = tactical_raw
    use_tactical = detector[:, 1:].max(axis=1) >= float(
        bundle["tactical_threshold"]
    )
    probabilities[use_tactical] = tactical_scores[use_tactical]
    return probabilities


def main() -> None:
    sample_count = int(os.environ.get("FLY_TRAIN_SAMPLES", "2048"))
    validation_count = int(os.environ.get("FLY_VALIDATION_SAMPLES", "384"))
    if sample_count < 140 or validation_count < 70:
        raise ValueError("use at least 140 training and 70 validation samples")
    print("Loading the 166,700-neuron MaleCNS v1.0 network…", flush=True)
    reservoir = MaleCNSConnectFour(require_model=False)
    cache_path = (
        Path(__file__).parent
        / "models"
        / f"training_cache_v2_{sample_count}_{validation_count}.npz"
    )
    train_boards = training_positions(sample_count, seed=4_404)
    validation_boards = np.stack(training_positions(validation_count, seed=9_909))
    if cache_path.exists():
        print(f"Loading cached spike curriculum from {cache_path}…", flush=True)
        cached = np.load(cache_path)
        X_train = cached["X_train"]
        y_train = cached["y_train"]
        X_validation = cached["X_validation"]
        y_validation = cached["y_validation"]
        validation_boards = cached["validation_boards"]
    else:
        print("Generating expert curriculum…", flush=True)
        base_path = (
            Path(__file__).parent
            / "models"
            / "training_cache_v2_1024_256.npz"
        )
        base_train_count = base_validation_count = 0
        features: list[np.ndarray] = []
        labels: list[int] = []
        if (
            base_path.exists()
            and sample_count >= 1024
            and validation_count >= 256
        ):
            base = np.load(base_path)
            features.extend(base["X_train"])
            labels.extend(int(value) for value in base["y_train"])
            base_train_count = len(base["X_train"])
        pending_train = train_boards[base_train_count:]

        validation_features: list[np.ndarray] = []
        validation_labels: list[int] = []
        if base_train_count:
            validation_features.extend(base["X_validation"])
            validation_labels.extend(int(value) for value in base["y_validation"])
            base_validation_count = len(base["X_validation"])
        pending_validation = list(validation_boards[base_validation_count:])
        all_boards = pending_train + pending_validation
        started = time.perf_counter()
        total = len(all_boards)
        for index, board in enumerate(all_boards, start=1):
            feature, active = reservoir.activity(board)
            label = int(np.argmax(expert_target(board)))
            if index <= len(pending_train):
                features.append(feature)
                labels.append(label)
            else:
                validation_features.append(feature)
                validation_labels.append(label)
            elapsed = time.perf_counter() - started
            remaining = elapsed / index * (total - index)
            print(
                f"\rConnectome traces {index:4d}/{total} · "
                f"{len(active):,} active · ETA {remaining / 60:.1f} min",
                end="",
                flush=True,
            )
        print()
        X_train = np.stack(features)
        y_train = np.asarray(labels, dtype=np.int8)
        X_validation = np.stack(validation_features)
        y_validation = np.asarray(validation_labels, dtype=np.int8)
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        np.savez_compressed(
            cache_path,
            X_train=X_train,
            y_train=y_train,
            X_validation=X_validation,
            y_validation=y_validation,
            validation_boards=validation_boards,
        )

    print(
        f"Fitting nonlinear seven-column policy from {X_train.shape[1]:,} "
        "pooled MaleCNS spike features…",
        flush=True,
    )
    mirrored = X_train.copy()
    mirrored[:, :84] = (
        X_train[:, :84]
        .reshape(-1, 2, 6, 7)[:, :, :, ::-1]
        .reshape(-1, 84)
    )
    augmented_X = np.concatenate((X_train, mirrored))
    augmented_y = np.concatenate((y_train, 6 - y_train))
    readout = HistGradientBoostingClassifier(
        max_iter=400,
        learning_rate=0.06,
        max_leaf_nodes=63,
        min_samples_leaf=20,
        l2_regularization=1.0,
        random_state=5_604,
        verbose=1,
    )
    readout.fit(augmented_X, augmented_y)

    on, off = sensory_templates(X_train[:, :84], train_boards)
    sensory_count = int(os.environ.get("FLY_SENSORY_SAMPLES", "10000"))
    print(f"Teaching sensory policy on {sensory_count:,} positions…", flush=True)
    sensory_boards = training_positions(sensory_count, seed=2_718)
    sensory_X = expected_sensory_features(sensory_boards, on, off)
    sensory_y = np.asarray(
        [
            int(np.argmax(expert_target(board, depth=3)))
            for board in sensory_boards
        ],
        dtype=np.int8,
    )
    sensory_mirror = (
        sensory_X.reshape(-1, 2, 6, 7)[:, :, :, ::-1].reshape(-1, 84)
    )
    sensory_policy = HistGradientBoostingClassifier(
        max_iter=350,
        learning_rate=0.08,
        max_leaf_nodes=63,
        min_samples_leaf=25,
        l2_regularization=2.0,
        random_state=77,
    )
    sensory_policy.fit(
        np.concatenate((sensory_X, sensory_mirror, X_train[:, :84])),
        np.concatenate((sensory_y, 6 - sensory_y, y_train)),
    )

    tactical_count = int(os.environ.get("FLY_TACTICAL_SAMPLES", "30000"))
    print(
        f"Teaching tactical specialist on {tactical_count:,} positions…",
        flush=True,
    )
    tactical_boards = training_positions(tactical_count, seed=8_181)
    tactical_X = expected_sensory_features(tactical_boards, on, off)
    tactical_labels = [tactical_target(board) for board in tactical_boards]
    tactical_types = np.asarray(
        [label[0] for label in tactical_labels], dtype=np.int8
    )
    tactical_columns = np.asarray(
        [label[1] for label in tactical_labels], dtype=np.int8
    )
    tactical_detector = HistGradientBoostingClassifier(
        max_iter=220,
        max_leaf_nodes=31,
        learning_rate=0.09,
        l2_regularization=2.0,
        random_state=9,
    ).fit(tactical_X, tactical_types)
    tactical_mask = tactical_types > 0
    tactical_policy = HistGradientBoostingClassifier(
        max_iter=260,
        max_leaf_nodes=31,
        learning_rate=0.08,
        l2_regularization=2.0,
        random_state=10,
    ).fit(tactical_X[tactical_mask], tactical_columns[tactical_mask])
    bundle = {
        "policy": sensory_policy,
        "connectome_policy": readout,
        "sensory_weight": 0.7,
        "tactical_detector": tactical_detector,
        "tactical_policy": tactical_policy,
        "tactical_threshold": 0.15,
    }
    probabilities = bundle_probabilities(bundle, X_validation)
    correct = 0
    tactical_wins = tactical_wins_correct = 0
    tactical_blocks = tactical_blocks_correct = 0
    for row, board in enumerate(validation_boards):
        legal = legal_columns(board)
        predicted = max(legal, key=lambda column: probabilities[row, column])
        expected = int(y_validation[row])
        correct += predicted == expected
        winning = [
            column for column in legal if winner(drop(board, column, -1), -1)
        ]
        threats = [
            column for column in legal if winner(drop(board, column, 1), 1)
        ]
        if winning:
            tactical_wins += 1
            tactical_wins_correct += predicted in winning
        elif threats:
            tactical_blocks += 1
            tactical_blocks_correct += predicted in threats
    accuracy = correct / len(validation_boards)
    win_rate = tactical_wins_correct / tactical_wins if tactical_wins else 1.0
    block_rate = tactical_blocks_correct / tactical_blocks if tactical_blocks else 1.0

    model_path = Path(os.environ.get("FLY_MODEL", DEFAULT_MODEL))
    metadata_path = Path(os.environ.get("FLY_MODEL_METADATA", DEFAULT_METADATA))
    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, model_path, compress=3)
    metadata = {
        "method": "MaleCNS spike-policy ensemble with learned tactical specialist",
        "dataset": "MaleCNS v1.0",
        "neurons": int(reservoir.brain.n),
        "connections": int(len(reservoir.brain.weights)),
        "readoutPopulation": "visual sensory + visual projection + descending neuron",
        "readoutNeurons": int(len(reservoir.output_neurons)),
        "policyFeatures": int(X_train.shape[1]),
        "connectomeTrainingSamples": int(len(X_train)),
        "sensoryCurriculumSamples": sensory_count,
        "tacticalCurriculumSamples": tactical_count,
        "validationSamples": int(len(X_validation)),
        "validationTop1Accuracy": accuracy,
        "immediateWinAccuracy": win_rate,
        "immediateWinSamples": tactical_wins,
        "immediateBlockAccuracy": block_rate,
        "immediateBlockSamples": tactical_blocks,
        "connectomePolicyWeight": 0.3,
        "sensoryPolicyWeight": 0.7,
        "tacticalThreshold": 0.15,
        "expertDepth": 3,
        "validationExpertDepth": 4,
        "simulationSteps": reservoir.simulation_steps,
        "trainedAt": datetime.now(timezone.utc).isoformat(),
        "flybrainVersion": "0.1.0",
    }
    metadata_path.write_text(json.dumps(metadata, indent=2) + "\n")
    print(f"Saved {model_path}")
    print(f"Validation top-1 agreement with depth-4 teacher: {accuracy:.1%}")
    print(f"Immediate wins: {win_rate:.1%} ({tactical_wins} positions)")
    print(f"Immediate blocks: {block_rate:.1%} ({tactical_blocks} positions)")


if __name__ == "__main__":
    main()
