interface GameControlsProps {
  reducedMotion: boolean
  brainReady: boolean
  hasReplay: boolean
  onReducedMotion: (enabled: boolean) => void
  onNewGame: () => void
  onExport: () => void
}

export function GameControls({
  reducedMotion,
  brainReady,
  hasReplay,
  onReducedMotion,
  onNewGame,
  onExport,
}: GameControlsProps) {
  return (
    <div className="game-controls" aria-label="Game settings">
      <div className="brain-status" role="status">
        Fly Brain <small>{brainReady ? 'CONNECTED' : 'OFFLINE'}</small>
      </div>
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
