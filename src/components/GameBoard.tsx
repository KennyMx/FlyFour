import { useEffect, useRef, useState } from 'react'
import { COLUMNS, ROWS } from '../game/engine'
import type { Board, Move } from '../game/types'

interface GameBoardProps {
  board: Board
  disabled: boolean
  lastMove: Move | null
  winningCells: [number, number][]
  selectedColumn: number | null
  onMove: (column: number) => void
}

export function GameBoard({
  board,
  disabled,
  lastMove,
  winningCells,
  selectedColumn,
  onMove,
}: GameBoardProps) {
  const [focusedColumn, setFocusedColumn] = useState(3)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    if (selectedColumn === null) return
    setFocusedColumn(selectedColumn)
  }, [selectedColumn])

  function handleKeyDown(event: React.KeyboardEvent, column: number) {
    let next = column
    if (event.key === 'ArrowLeft') next = Math.max(0, column - 1)
    else if (event.key === 'ArrowRight') next = Math.min(COLUMNS - 1, column + 1)
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = COLUMNS - 1
    else return

    event.preventDefault()
    setFocusedColumn(next)
    buttons.current[next]?.focus()
  }

  const isWinning = (row: number, column: number) =>
    winningCells.some(([winnerRow, winnerColumn]) => winnerRow === row && winnerColumn === column)

  return (
    <div className="board-wrap">
      <div className="column-markers" aria-hidden="true">
        {Array.from({ length: COLUMNS }, (_, column) => (
          <span
            key={column}
            className={selectedColumn === column ? 'column-marker selected' : 'column-marker'}
          >
            {column + 1}
          </span>
        ))}
      </div>
      <div
        className="game-board"
        role="grid"
        aria-label="Connect Four board, 7 columns by 6 rows"
        style={{ '--rows': ROWS, '--columns': COLUMNS } as React.CSSProperties}
      >
        {Array.from({ length: COLUMNS }, (_, column) => (
          <button
            key={column}
            ref={(node) => {
              buttons.current[column] = node
            }}
            className={[
              'board-column',
              selectedColumn === column ? 'ai-selected' : '',
            ].join(' ')}
            disabled={disabled}
            onClick={() => onMove(column)}
            onFocus={() => setFocusedColumn(column)}
            onKeyDown={(event) => handleKeyDown(event, column)}
            tabIndex={focusedColumn === column ? 0 : -1}
            aria-label={`Drop a piece in column ${column + 1}`}
          >
            {Array.from({ length: ROWS }, (_, row) => {
              const cell = board[row][column]
              const isNewest = lastMove?.row === row && lastMove.column === column
              return (
                <span className="cell" role="gridcell" key={`${row}-${column}`}>
                  <span
                    className={[
                      'piece',
                      cell ?? 'empty',
                      isNewest ? 'just-dropped' : '',
                      isWinning(row, column) ? 'winner' : '',
                    ].join(' ')}
                    aria-label={
                      cell === 'human'
                        ? 'Your yellow piece'
                        : cell === 'fly'
                          ? 'Fly coral piece'
                          : 'Empty'
                    }
                  />
                </span>
              )
            })}
          </button>
        ))}
      </div>
      <p className="keyboard-hint">Use ← → and Enter to drop</p>
    </div>
  )
}
