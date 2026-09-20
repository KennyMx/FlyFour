import { describe, expect, it } from 'vitest'
import { getResult, legalMoves } from './engine'
import type { Board, Cell } from './types'

const DRAW_ROWS = [
  'FFHHFFF',
  'HFHFFFH',
  'FHFFHHF',
  'FHHHFHH',
  'HHFFHHH',
  'HFFFHFH',
]

function drawBoard(): Board {
  return DRAW_ROWS.map((row) =>
    [...row].map<Cell>((cell) => (cell === 'H' ? 'human' : 'fly')),
  )
}

describe('draw detection', () => {
  it('reports a draw when a full board has no four-in-a-row', () => {
    const board = drawBoard()
    expect(legalMoves(board)).toEqual([])
    expect(getResult(board)).toBe('draw')
  })
})
