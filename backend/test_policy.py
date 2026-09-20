import unittest

import numpy as np

from backend.policy import bundle_probabilities


class FixedClassifier:
    def __init__(self, classes, probabilities):
        self.classes_ = np.asarray(classes)
        self.probabilities = probabilities

    def predict_proba(self, features):
        return np.tile(self.probabilities, (len(features), 1))


class PolicyTests(unittest.TestCase):
    def bundle(self, detector):
        return {
            "policy": FixedClassifier([1, 5], [0.2, 0.8]),
            "connectome_policy": FixedClassifier([5, 1], [0.4, 0.6]),
            "sensory_weight": 0.7,
            "tactical_detector": detector,
            "tactical_policy": FixedClassifier([6, 0], [0.9, 0.1]),
            "tactical_threshold": 0.5,
        }

    def test_missing_and_reordered_column_classes(self):
        bundle = self.bundle(FixedClassifier([0], [1.0]))
        scores = bundle_probabilities(bundle, np.zeros((2, 340)))
        np.testing.assert_allclose(scores, [[0, 0.32, 0, 0, 0, 0.68, 0]] * 2)

    def test_detector_uses_class_labels_not_probability_offsets(self):
        bundle = self.bundle(FixedClassifier([2, 0], [0.8, 0.2]))
        batch = bundle_probabilities(bundle, np.zeros((3, 340)))
        np.testing.assert_allclose(batch, [[0.1, 0, 0, 0, 0, 0, 0.9]] * 3)
        for row in batch:
            np.testing.assert_allclose(row, bundle_probabilities(bundle, np.zeros((1, 340)))[0])

    def test_legacy_classifier(self):
        scores = bundle_probabilities(FixedClassifier([4], [1.0]), np.zeros((1, 340)))
        np.testing.assert_array_equal(scores, [[0, 0, 0, 0, 1, 0, 0]])


if __name__ == "__main__":
    unittest.main()
