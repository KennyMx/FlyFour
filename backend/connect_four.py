"""Connect Four position generation and expert targets for readout training.

The expert is used only to create supervised training labels. Runtime decisions
come exclusively from MaleCNS activity passed through the trained readout.
"""

from __future__ import annotations

from functools import lru_cache
import random
import zlib
from typing import Literal

import numpy as np

ROWS = 6
COLUMNS = 7
CENTER_ORDER = (3, 2, 4, 1, 5, 0, 6)


def legal_columns(board: np.ndarray) -> list[int]:
    return [column for column in range(COLUMNS) if board[0, column] == 0]


def drop(board: np.ndarray, column: int, player: int) -> np.ndarray | None:
    for row in range(ROWS - 1, -1, -1):
        if board[row, column] == 0:
            result = board.copy()
            result[row, column] = player
            return result
    return None


# All 69 four-cell windows, computed once rather than rebuilt at every node.
WINDOW_INDICES = np.asarray([
    [(row + dr * offset) * COLUMNS + column + dc * offset for offset in range(4)]
    for row in range(ROWS)
    for column in range(COLUMNS)
    for dr, dc in ((0, 1), (1, 0), (1, 1), (1, -1))
    if 0 <= row + 3 * dr < ROWS and 0 <= column + 3 * dc < COLUMNS
])


def winner(board: np.ndarray, player: int) -> bool:
    return bool(np.any(np.all(board.reshape(-1)[WINDOW_INDICES] == player, axis=1)))


def evaluate(board: np.ndarray) -> float:
    groups = board.reshape(-1)[WINDOW_INDICES]
    fly = np.count_nonzero(groups == -1, axis=1)
    human = np.count_nonzero(groups == 1, axis=1)
    score = 5 * (np.count_nonzero(board[:, 3] == -1) - np.count_nonzero(board[:, 3] == 1))
    score += 120 * np.count_nonzero((fly == 3) & (human == 0))
    score -= 145 * np.count_nonzero((human == 3) & (fly == 0))
    score += 14 * np.count_nonzero((fly == 2) & (human == 0))
    score -= 18 * np.count_nonzero((human == 2) & (fly == 0))
    return float(score)


@lru_cache(maxsize=250_000)
def _search(position: tuple[int, ...], depth: int, maximizing: bool, alpha: float, beta: float) -> float:
    board = np.asarray(position, dtype=np.int8).reshape(ROWS, COLUMNS)
    if winner(board, -1):
        return 1_000_000 + depth
    if winner(board, 1):
        return -1_000_000 - depth
    legal = legal_columns(board)
    if not legal:
        return 0
    if depth == 0:
        return evaluate(board)

    ordered = [column for column in CENTER_ORDER if column in legal]
    if maximizing:
        value = -np.inf
        for column in ordered:
            child = drop(board, column, -1)
            value = max(value, _search(tuple(child.flat), depth - 1, False, alpha, beta))
            alpha = max(alpha, value)
            if beta <= alpha:
                break
        return float(value)

    value = np.inf
    for column in ordered:
        child = drop(board, column, 1)
        value = min(value, _search(tuple(child.flat), depth - 1, True, alpha, beta))
        beta = min(beta, value)
        if beta <= alpha:
            break
    return float(value)


def expert_target(board: np.ndarray, depth: int = 4) -> np.ndarray:
    scores = np.full(COLUMNS, -1.0, dtype=np.float32)
    raw: list[tuple[int, float]] = []
    for column in legal_columns(board):
        child = drop(board, column, -1)
        value = _search(tuple(child.flat), depth - 1, False, -np.inf, np.inf)
        raw.append((column, value))
    values = np.asarray([value for _, value in raw], dtype=np.float64)
    if np.ptp(values) < 1e-6:
        normalized = np.zeros_like(values)
    else:
        normalized = 2 * (values - values.min()) / np.ptp(values) - 1
    for (column, _), value in zip(raw, normalized, strict=True):
        scores[column] = value
    best = max(raw, key=lambda item: (item[1], -abs(item[0] - 3)))[0]
    scores[best] = 1.25
    return scores


def position_split(board: np.ndarray) -> Literal["train", "validation"]:
    """Keep a board and its reflection in the same seed-independent partition."""
    canonical = min(
        np.asarray(board, dtype=np.int8).tobytes(),
        np.asarray(board[:, ::-1], dtype=np.int8).tobytes(),
    )
    return "validation" if zlib.crc32(canonical) % 5 == 0 else "train"


def training_positions(
    count: int, seed: int = 404, *, split: Literal["train", "validation"] | None = None
) -> list[np.ndarray]:
    """Generate varied, legal positions where it is the fly's turn."""
    if split not in (None, "train", "validation"):
        raise ValueError("split must be train or validation")
    rng = random.Random(seed)
    positions: list[np.ndarray] = []
    seen: set[bytes] = set()
    while len(positions) < count:
        board = np.zeros((ROWS, COLUMNS), dtype=np.int8)
        plies = rng.randrange(1, 28, 2)
        valid = True
        for ply in range(plies):
            legal = legal_columns(board)
            if not legal:
                valid = False
                break
            column = rng.choice(legal)
            player = 1 if ply % 2 == 0 else -1
            next_board = drop(board, column, player)
            if next_board is None or winner(next_board, player):
                valid = False
                break
            board = next_board
        key = board.tobytes()
        if (
            valid
            and key not in seen
            and legal_columns(board)
            and (split is None or position_split(board) == split)
        ):
            seen.add(key)
            positions.append(board)
    return positions
