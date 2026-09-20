import unittest

import numpy as np

from backend.connect_four import (
    drop,
    expert_target,
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

    def test_training_positions_are_unique_and_legal(self):
        positions = training_positions(24)
        self.assertEqual(len(positions), 24)
        self.assertEqual(len({position.tobytes() for position in positions}), 24)
        self.assertTrue(all(legal_columns(position) for position in positions))


if __name__ == "__main__":
    unittest.main()
