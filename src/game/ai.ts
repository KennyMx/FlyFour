import { COLUMNS, ROWS, dropPiece, getResult, legalMoves } from './engine'
import type {
  Board,
  BrainDecision,
  CandidateScore,
  DecisionContext,
  Difficulty,
  FlyBrainAdapter,
  Player,
} from './types'

const DEPTH: Record<Difficulty, number> = { easy: 2, medium: 4, hard: 5 }
const RANDOMNESS: Record<Difficulty, number> = { easy: 0.42, medium: 0.12, hard: 0 }
const COLUMN_ORDER = [3, 2, 4, 1, 5, 0, 6]

function windows(board: Board): (Player | null)[][] {
  const groups: (Player | null)[][] = []
  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column <= COLUMNS - 4; column += 1) {
      groups.push(board[row].slice(column, column + 4))
    }
  }
  for (let row = 0; row <= ROWS - 4; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      groups.push(Array.from({ length: 4 }, (_, index) => board[row + index][column]))
    }
  }
  for (let row = 0; row <= ROWS - 4; row += 1) {
    for (let column = 0; column <= COLUMNS - 4; column += 1) {
      groups.push(Array.from({ length: 4 }, (_, index) => board[row + index][column + index]))
      groups.push(
        Array.from({ length: 4 }, (_, index) => board[row + 3 - index][column + index]),
      )
    }
  }
  return groups
}

function evaluateWindow(group: (Player | null)[]): number {
  const fly = group.filter((cell) => cell === 'fly').length
  const human = group.filter((cell) => cell === 'human').length
  const empty = 4 - fly - human
  if (fly && human) return 0
  if (fly === 4) return 100_000
  if (human === 4) return -100_000
  if (fly === 3 && empty === 1) return 120
  if (human === 3 && empty === 1) return -145
  if (fly === 2 && empty === 2) return 14
  if (human === 2 && empty === 2) return -18
  return 0
}

export function evaluateBoard(board: Board): number {
  const center = board.reduce(
    (score, row) => score + (row[3] === 'fly' ? 5 : row[3] === 'human' ? -5 : 0),
    0,
  )
  return center + windows(board).reduce((score, group) => score + evaluateWindow(group), 0)
}

function minimax(
  board: Board,
  depth: number,
  maximizing: boolean,
  alpha: number,
  beta: number,
): number {
  const result = getResult(board)
  if (result === 'fly') return 1_000_000 + depth
  if (result === 'human') return -1_000_000 - depth
  if (result === 'draw') return 0
  if (depth === 0) return evaluateBoard(board)

  const moves = COLUMN_ORDER.filter((column) => legalMoves(board).includes(column))
  if (maximizing) {
    let best = -Infinity
    for (const column of moves) {
      const dropped = dropPiece(board, column, 'fly')
      if (!dropped) continue
      best = Math.max(best, minimax(dropped.board, depth - 1, false, alpha, beta))
      alpha = Math.max(alpha, best)
      if (beta <= alpha) break
    }
    return best
  }

  let best = Infinity
  for (const column of moves) {
    const dropped = dropPiece(board, column, 'human')
    if (!dropped) continue
    best = Math.min(best, minimax(dropped.board, depth - 1, true, alpha, beta))
    beta = Math.min(beta, best)
    if (beta <= alpha) break
  }
  return best
}

export function scoreMoves(board: Board, depth: number): CandidateScore[] {
  return legalMoves(board).map((column) => {
    const dropped = dropPiece(board, column, 'fly')
    return {
      column,
      score: dropped
        ? minimax(dropped.board, Math.max(0, depth - 1), false, -Infinity, Infinity)
        : -Infinity,
    }
  })
}

export class ClassicAIAdapter implements FlyBrainAdapter {
  readonly name = 'Classic AI'

  async decide({ board, difficulty, signal }: DecisionContext): Promise<BrainDecision> {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const candidates = scoreMoves(board, DEPTH[difficulty])
    const sorted = [...candidates].sort((a, b) => b.score - a.score)
    let selected = sorted[0]
    if (sorted.length > 1 && Math.random() < RANDOMNESS[difficulty]) {
      const pool = sorted.slice(0, Math.min(difficulty === 'easy' ? 4 : 2, sorted.length))
      selected = pool[Math.floor(Math.random() * pool.length)]
    }
    return {
      column: selected.column,
      candidates,
      neuralResponse: candidates.map(({ score }) => Math.tanh(score / 180)),
      source: 'classic-ai',
    }
  }
}
