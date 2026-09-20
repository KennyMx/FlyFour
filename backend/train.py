"""Teach a linear readout to decode Connect Four moves from MaleCNS spikes."""

from __future__ import annotations

from datetime import datetime, timezone
import json
import os
from pathlib import Path
import time

import numpy as np
from flybrain import Readout

from .brain import DEFAULT_METADATA, DEFAULT_MODEL, MaleCNSConnectFour
from .connect_four import expert_target, legal_columns, training_positions


def main() -> None:
    sample_count = int(os.environ.get("FLY_TRAIN_SAMPLES", "96"))
    if sample_count < 24:
        raise ValueError("FLY_TRAIN_SAMPLES must be at least 24")
    print("Loading the 166,700-neuron MaleCNS v1.0 network…", flush=True)
    reservoir = MaleCNSConnectFour(require_model=False)
    positions = training_positions(sample_count)
    features: list[np.ndarray] = []
    targets: list[np.ndarray] = []
    started = time.perf_counter()

    for index, board in enumerate(positions, start=1):
        feature, active = reservoir.activity(board)
        features.append(feature)
        targets.append(expert_target(board))
        elapsed = time.perf_counter() - started
        remaining = elapsed / index * (sample_count - index)
        print(
            f"\rConnectome traces {index:3d}/{sample_count} · "
            f"{len(active):,} active · ETA {remaining / 60:.1f} min",
            end="",
            flush=True,
        )
    print()

    X = np.stack(features)
    y = np.stack(targets)
    rng = np.random.default_rng(4404)
    order = rng.permutation(sample_count)
    split = max(16, int(sample_count * 0.8))
    train_index, validation_index = order[:split], order[split:]
    components = tuple(
        value for value in (12, 32, 64, 128) if value < len(train_index)
    )
    print(
        f"Fitting seven-column readout from {X.shape[1]:,} "
        "visual-projection and descending neurons…",
        flush=True,
    )
    readout = Readout.fit(
        X[train_index],
        y[train_index],
        kind="ridge",
        components=components,
        lambdas=(0.01, 0.1, 1.0, 10.0),
        verbose=True,
    )

    predictions = np.asarray(readout.predict(X[validation_index]))
    correct = 0
    for row, sample_index in enumerate(validation_index):
        legal = legal_columns(positions[sample_index])
        predicted = max(legal, key=lambda column: predictions[row, column])
        expected = max(legal, key=lambda column: y[sample_index, column])
        correct += predicted == expected
    accuracy = correct / len(validation_index) if len(validation_index) else 1.0

    model_path = Path(os.environ.get("FLY_MODEL", DEFAULT_MODEL))
    metadata_path = Path(os.environ.get("FLY_MODEL_METADATA", DEFAULT_METADATA))
    model_path.parent.mkdir(parents=True, exist_ok=True)
    readout.save(model_path)
    metadata = {
        "method": "fixed MaleCNS spiking reservoir + PCA ridge readout",
        "dataset": "MaleCNS v1.0",
        "neurons": int(reservoir.brain.n),
        "connections": int(len(reservoir.brain.weights)),
        "readoutPopulation": "visual_projection + descending_neuron",
        "readoutNeurons": int(len(reservoir.output_neurons)),
        "trainingSamples": int(len(train_index)),
        "validationSamples": int(len(validation_index)),
        "validationTop1Accuracy": accuracy,
        "expertDepth": 4,
        "simulationSteps": reservoir.simulation_steps,
        "trainedAt": datetime.now(timezone.utc).isoformat(),
        "flybrainVersion": "0.1.0",
    }
    metadata_path.write_text(json.dumps(metadata, indent=2) + "\n")
    print(f"Saved {model_path}")
    print(f"Validation top-1 agreement with depth-4 teacher: {accuracy:.1%}")


if __name__ == "__main__":
    main()
