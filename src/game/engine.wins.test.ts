import { describe, expect, it } from 'vitest'
import { createBoard, getResult, winningCells } from './engine'
import type { Board } from './types'

function boardWith(cells: [number, number][]): Board {
  const board = createBoard()
  cells.forEach(([row, column]) => {
    board[row][column] = 'human'
  })
  return board
}

describe('Connect Four win detection', () => {
  it('finds a horizontal win', () => {
    const board = boardWith([[5, 1], [5, 2], [5, 3], [5, 4]])
    expect(getResult(board)).toBe('human')
    expect(winningCells(board, 'human')).toHaveLength(4)
  })

  it('finds a vertical win', () => {
    const board = boardWith([[2, 4], [3, 4], [4, 4], [5, 4]])
    expect(getResult(board)).toBe('human')
  })

  it('finds a down-right diagonal win', () => {
    const board = boardWith([[1, 1], [2, 2], [3, 3], [4, 4]])
    expect(getResult(board)).toBe('human')
  })

  it('finds a down-left diagonal win', () => {
    const board = boardWith([[1, 5], [2, 4], [3, 3], [4, 2]])
    expect(getResult(board)).toBe('human')
  })

  it('does not report only three connected pieces', () => {
    const board = boardWith([[5, 2], [5, 3], [5, 4]])
    expect(getResult(board)).toBeNull()
  })
})
