import { useState } from 'react'
import './styles/base.css'
import './styles/layout.css'
import './styles/board.css'
import './styles/brain.css'
import './styles/controls.css'
import './styles/responsive.css'
import { BrainVisualization } from './components/BrainVisualization'
import { FlyMascot } from './components/FlyMascot'
import { GameBoard } from './components/GameBoard'
import { GameControls } from './components/GameControls'
import { useFlyFour } from './hooks/useFlyFour'

export default function FlyFourApp() {
  const [reducedMotion, setReducedMotion] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const game = useFlyFour(reducedMotion)
  const status =
    game.result === 'human'
      ? 'YOU WIN!'
      : game.result === 'fly'
        ? 'FLY WINS!'
        : game.result === 'draw'
          ? 'DRAW GAME'
          : game.phase === 'thinking' || game.phase === 'selecting'
            ? 'FLY IS THINKING…'
            : 'YOUR TURN'

  function exportReplay() {
    const blob = new Blob([JSON.stringify(game.replay, null, 2)], {
      type: 'application/json',
    })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `fly-four-${new Date().toISOString().replaceAll(':', '-')}.json`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <main className={reducedMotion ? 'app reduce-motion' : 'app'}>
      <header className="topbar">
        <a href="/" className="brand" aria-label="Fly Four home">
          <span className="brand-wing" aria-hidden="true">◒</span>
          <span>FLY FOUR</span>
        </a>
        <div className={`turn-status ${game.phase}`} aria-live="polite">
          <span />
          {status}
        </div>
        <div className="score-key" aria-label="Piece colors">
          <span><i className="yellow-dot" />YOU</span>
          <span><i className="coral-dot" />FLY</span>
        </div>
      </header>

      <section className="game-layout">
        <div className="board-panel">
          <div className="board-heading">
            <div>
              <p className="eyebrow">A VERY SMALL OPPONENT</p>
              <h1>Outthink the fly.</h1>
            </div>
            <p className="move-count">{game.moves.length} moves</p>
          </div>
          <GameBoard
            board={game.board}
            disabled={game.phase !== 'player' || game.result !== null}
            lastMove={game.moves.at(-1) ?? null}
            winningCells={game.winnerCells}
            selectedColumn={game.selectedColumn}
            onMove={game.playColumn}
          />
        </div>

        <aside className={`brain-panel ${game.phase}`}>
          <div className="brain-panel-copy">
            <div>
              <p className="eyebrow">NEURAL ACTIVITY</p>
              <h2>{game.phase === 'player' ? 'Waiting for input' : status}</h2>
            </div>
            <span className="neuron-count">
              {game.opponent === 'connectome' && import.meta.env.VITE_FLY_BRAIN_URL
                ? 'CONNECTOME'
                : '8K+ NEURONS'}
            </span>
          </div>
          <BrainVisualization
            phase={game.phase}
            candidates={game.candidates}
            selectedColumn={game.selectedColumn}
            reducedMotion={reducedMotion}
            connectomeEndpoint={
              game.opponent === 'connectome' ? import.meta.env.VITE_FLY_BRAIN_URL : undefined
            }
          />
          <FlyMascot
            phase={game.phase}
            result={game.result}
            selectedColumn={game.selectedColumn}
          />
          <p className="science-caption">
            {game.opponent === 'connectome'
              ? 'Biological wiring; engineered game inputs and readout.'
              : 'Procedural neural map driven by Classic AI.'}
          </p>
        </aside>
      </section>

      <section className="control-panel">
        <GameControls
          difficulty={game.difficulty}
          opponent={game.opponent}
          reducedMotion={reducedMotion}
          hasReplay={game.moves.length > 0}
          onDifficulty={game.setDifficulty}
          onOpponent={game.setOpponent}
          onReducedMotion={setReducedMotion}
          onNewGame={game.newGame}
          onExport={exportReplay}
        />
        <details className="science-note">
          <summary>How biological is this?</summary>
          <p>
            A fruit fly does not naturally understand Connect Four. With a configured backend,
            real connectome coordinates and wiring can be used, while board encoding, simulated
            neuron dynamics, column decoding, and rewards remain engineered. The default display
            is clearly labeled procedural data.
          </p>
        </details>
      </section>
    </main>
  )
}
