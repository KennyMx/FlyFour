import unittest

import numpy as np

from backend.connect_four import (
    drop,
    expert_target,
    evaluate,
    position_split,
    WINDOW_INDICES,
    legal_columns,
    training_positions,
    winner,
)


class ConnectFourTeacherTests(unittest.TestCase):
    def test_drop_and_legal_columns(self):
        board = np.zeros((6, 7), dtype=np.int8)
        for index in range(6):
            board = drop(board, 2, 1 if index % 2 == 0 else -1)
        self.assertNotIn(2, legal_columns(board))

    def test_winner(self):
        board = np.zeros((6, 7), dtype=np.int8)
        board[5, :4] = -1
        self.assertTrue(winner(board, -1))
        self.assertFalse(winner(board, 1))

    def test_teacher_labels_immediate_win(self):
        board = np.zeros((6, 7), dtype=np.int8)
        board[5, :3] = -1
        self.assertEqual(int(np.argmax(expert_target(board))), 3)

    def test_winner_matches_independent_direction_scan(self):
        rng = np.random.default_rng(123)
        for _ in range(100):
            board = rng.integers(-1, 2, size=(6, 7), dtype=np.int8)
            for player in (-1, 1):
                expected = any(
                    all(board[r + dr * k, c + dc * k] == player for k in range(4))
                    for r in range(6) for c in range(7)
                    for dr, dc in ((0, 1), (1, 0), (1, 1), (1, -1))
                    if 0 <= r + dr * 3 < 6 and 0 <= c + dc * 3 < 7
                )
                self.assertEqual(winner(board, player), expected)

    def test_evaluation_preserves_window_weights(self):
        self.assertEqual(WINDOW_INDICES.shape, (69, 4))
        board = np.zeros((6, 7), dtype=np.int8)
        board[5, :3] = -1
        self.assertEqual(evaluate(board), 134)
        self.assertEqual(evaluate(-board), -163)
        self.assertEqual(evaluate(board), evaluate(board[:, ::-1]))

    def test_validation_excludes_training_boards_and_reflections(self):
        train = training_positions(40, seed=11, split="train")
        validation = training_positions(40, seed=22, split="validation")
        for boards, split in ((train, "train"), (validation, "validation")):
            for board in boards:
                self.assertEqual(position_split(board), split)
                self.assertEqual(position_split(board[:, ::-1]), split)
                self.assertEqual(position_split(board.astype(np.int64)), split)
        train_keys = {b.tobytes() for b in train} | {b[:, ::-1].tobytes() for b in train}
        self.assertTrue(train_keys.isdisjoint(b.tobytes() for b in validation))
        np.testing.assert_array_equal(train, training_positions(40, seed=11, split="train"))

    def test_training_positions_are_unique_and_legal(self):
        positions = training_positions(24)
        self.assertEqual(len(positions), 24)
        self.assertEqual(len({position.tobytes() for position in positions}), 24)
        self.assertTrue(all(legal_columns(position) for position in positions))


if __name__ == "__main__":
    unittest.main()
