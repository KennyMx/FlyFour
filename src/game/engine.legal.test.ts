import { describe, expect, it } from 'vitest'
import { COLUMNS, createBoard, dropPiece, legalMoves } from './engine'

describe('legal Connect Four moves', () => {
  it('starts with all seven columns available', () => {
    expect(legalMoves(createBoard())).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('stacks pieces from the bottom and does not mutate the input board', () => {
    const original = createBoard()
    const first = dropPiece(original, 2, 'human')
    const second = first && dropPiece(first.board, 2, 'fly')

    expect(original[5][2]).toBeNull()
    expect(first?.row).toBe(5)
    expect(second?.row).toBe(4)
    expect(second?.board[5][2]).toBe('human')
    expect(second?.board[4][2]).toBe('fly')
  })

  it('rejects out-of-range and full columns', () => {
    let board = createBoard()
    for (let index = 0; index < 6; index += 1) {
      const dropped = dropPiece(board, 0, index % 2 ? 'fly' : 'human')
      expect(dropped).not.toBeNull()
      board = dropped!.board
    }

    expect(dropPiece(board, -1, 'human')).toBeNull()
    expect(dropPiece(board, COLUMNS, 'human')).toBeNull()
    expect(dropPiece(board, 0, 'human')).toBeNull()
    expect(legalMoves(board)).not.toContain(0)
  })
})
