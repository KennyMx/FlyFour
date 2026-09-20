import { describe, expect, it } from 'vitest'
import { ClassicAIAdapter, scoreMoves } from './ai'
import { createBoard } from './engine'

describe('Classic AI decisions', () => {
  it('takes an immediate winning move', async () => {
    const board = createBoard()
    board[5][0] = 'fly'
    board[5][1] = 'fly'
    board[5][2] = 'fly'

    const decision = await new ClassicAIAdapter().decide({
      board,
      difficulty: 'hard',
    })

    expect(decision.column).toBe(3)
  })

  it('blocks an immediate human win', async () => {
    const board = createBoard()
    board[5][1] = 'human'
    board[5][2] = 'human'
    board[5][3] = 'human'

    const decision = await new ClassicAIAdapter().decide({
      board,
      difficulty: 'hard',
    })

    expect([0, 4]).toContain(decision.column)
  })

  it('only scores legal columns', () => {
    const board = createBoard()
    for (let row = 0; row < 6; row += 1) board[row][3] = row % 2 ? 'human' : 'fly'

    expect(scoreMoves(board, 2).map(({ column }) => column)).not.toContain(3)
    expect(scoreMoves(board, 2)).toHaveLength(6)
  })
})
