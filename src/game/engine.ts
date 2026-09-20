import type { Board, Cell, GameResult, Player } from './types'

export const ROWS = 6
export const COLUMNS = 7

export function createBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<Cell>(COLUMNS).fill(null))
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => [...row])
}

export function legalMoves(board: Board): number[] {
  return board[0]
    .map((cell, column) => (cell === null ? column : -1))
    .filter((column) => column >= 0)
}

export function dropPiece(
  board: Board,
  column: number,
  player: Player,
): { board: Board; row: number } | null {
  if (!Number.isInteger(column) || column < 0 || column >= COLUMNS) return null

  for (let row = ROWS - 1; row >= 0; row -= 1) {
    if (board[row][column] === null) {
      const next = cloneBoard(board)
      next[row][column] = player
      return { board: next, row }
    }
  }

  return null
}

const DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
] as const

export function winningCells(board: Board, player: Player): [number, number][] {
  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      if (board[row][column] !== player) continue
      for (const [rowStep, columnStep] of DIRECTIONS) {
        const cells: [number, number][] = []
        for (let offset = 0; offset < 4; offset += 1) {
          const nextRow = row + rowStep * offset
          const nextColumn = column + columnStep * offset
          if (
            nextRow < 0 ||
            nextRow >= ROWS ||
            nextColumn < 0 ||
            nextColumn >= COLUMNS ||
            board[nextRow][nextColumn] !== player
          ) {
            break
          }
          cells.push([nextRow, nextColumn])
        }
        if (cells.length === 4) return cells
      }
    }
  }
  return []
}

export function getResult(board: Board): GameResult {
  if (winningCells(board, 'human').length) return 'human'
  if (winningCells(board, 'fly').length) return 'fly'
  return legalMoves(board).length === 0 ? 'draw' : null
}

export function encodeBoard(board: Board): number[] {
  return board.flatMap((row) =>
    row.map((cell) => (cell === 'human' ? 1 : cell === 'fly' ? -1 : 0)),
  )
}
