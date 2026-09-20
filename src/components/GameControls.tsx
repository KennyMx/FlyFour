import type { Difficulty, OpponentMode } from '../game/types'

interface GameControlsProps {
  difficulty: Difficulty
  opponent: OpponentMode
  reducedMotion: boolean
  brainReady: boolean
  hasReplay: boolean
  onDifficulty: (difficulty: Difficulty) => void
  onOpponent: (opponent: OpponentMode) => void
  onReducedMotion: (enabled: boolean) => void
  onNewGame: () => void
  onExport: () => void
}

export function GameControls({
  difficulty,
  opponent,
  reducedMotion,
  brainReady,
  hasReplay,
  onDifficulty,
  onOpponent,
  onReducedMotion,
  onNewGame,
  onExport,
}: GameControlsProps) {
  return (
    <div className="game-controls" aria-label="Game settings">
      <div className="segmented" role="group" aria-label="Opponent">
        <button
          className={opponent === 'classic' ? 'active' : ''}
          onClick={() => onOpponent('classic')}
          type="button"
        >
          Classic AI
        </button>
        <button
          className={opponent === 'connectome' ? 'active' : ''}
          onClick={() => onOpponent('connectome')}
          type="button"
        >
          Fly Brain <small>{brainReady ? 'REAL' : 'OFFLINE'}</small>
        </button>
      </div>
      <label className="select-control">
        <span>{opponent === 'connectome' ? 'Difficulty (Classic only)' : 'Difficulty'}</span>
        <select
          value={difficulty}
          disabled={opponent === 'connectome'}
          onChange={(event) => onDifficulty(event.target.value as Difficulty)}
        >
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </label>
      <label className="motion-toggle">
        <input
          type="checkbox"
          checked={reducedMotion}
          onChange={(event) => onReducedMotion(event.target.checked)}
        />
        <span aria-hidden="true" />
        Reduced motion
      </label>
      <div className="control-actions">
        <button className="secondary-button" type="button" onClick={onExport} disabled={!hasReplay}>
          Export replay
        </button>
        <button className="new-game-button" type="button" onClick={onNewGame}>
          New game
        </button>
      </div>
    </div>
  )
}
