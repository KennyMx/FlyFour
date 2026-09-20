"""Shared learned decoder for training evaluation and live inference.

This module consumes spike features only; it never searches the game tree.
"""

from __future__ import annotations

import numpy as np


def column_probabilities(model, features: np.ndarray) -> np.ndarray:
    """Map classifier classes to columns, including curricula missing a class."""
    scores = np.zeros((len(features), 7), dtype=np.float64)
    scores[:, np.asarray(model.classes_, dtype=np.int64)] = model.predict_proba(features)
    return scores


def bundle_probabilities(bundle, features: np.ndarray) -> np.ndarray:
    if not isinstance(bundle, dict):
        return column_probabilities(bundle, features)
    sensory_features = features[:, :84]
    sensory = column_probabilities(bundle["policy"], sensory_features)
    connectome = column_probabilities(bundle["connectome_policy"], features)
    weight = float(bundle.get("sensory_weight", 0.7))
    scores = weight * sensory + (1 - weight) * connectome

    detector = bundle["tactical_detector"]
    detected = detector.predict_proba(sensory_features)
    threat_classes = np.asarray(detector.classes_) != 0
    confidence = (
        detected[:, threat_classes].max(axis=1)
        if threat_classes.any()
        else np.zeros(len(features))
    )
    use_tactical = confidence >= float(bundle.get("tactical_threshold", 0.15))
    if use_tactical.any():
        scores[use_tactical] = column_probabilities(
            bundle["tactical_policy"], sensory_features[use_tactical]
        )
    return scores
