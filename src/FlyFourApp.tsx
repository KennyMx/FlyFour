import { lazy, Suspense, useState } from 'react'
import './styles/base.css'
import './styles/layout.css'
import './styles/board.css'
import './styles/brain.css'
import './styles/controls.css'
import './styles/responsive.css'
import { FlyMascot } from './components/FlyMascot'
import { GameBoard } from './components/GameBoard'
import { GameControls } from './components/GameControls'
import { BRAIN_ENDPOINT, useBrainStatus } from './hooks/useBrainStatus'
import { useFlyFour } from './hooks/useFlyFour'

const BrainVisualization = lazy(() =>
  import('./components/BrainVisualization').then((module) => ({
    default: module.BrainVisualization,
  })),
)

export default function FlyFourApp() {
  const [reducedMotion, setReducedMotion] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const game = useFlyFour(reducedMotion)
  const { status: brainStatus, refresh: refreshBrain } = useBrainStatus()
  const status =
    game.brainError
      ? 'BRAIN OFFLINE'
      : !brainStatus.ready
        ? 'CONNECTING TO BRAIN…'
        : game.result === 'human'
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
        <a href={import.meta.env.BASE_URL} className="brand" aria-label="Fly Four home">
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
            disabled={
              game.phase !== 'player' ||
              game.result !== null ||
              (!brainStatus.ready)
            }
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
              {brainStatus.ready
                ? `${brainStatus.neurons?.toLocaleString() ?? '166,700'} REAL NEURONS`
                : 'BRAIN NOT READY'}
            </span>
          </div>
          <Suspense fallback={<div className="brain-loading">WAKING NEURONS…</div>}>
            <BrainVisualization
              phase={game.phase}
              candidates={game.candidates}
              selectedColumn={game.selectedColumn}
              activeNeurons={game.activeNeurons}
              reducedMotion={reducedMotion}
              connectomeEndpoint={BRAIN_ENDPOINT}
            />
          </Suspense>
          <FlyMascot
            phase={game.phase}
            result={game.result}
            selectedColumn={game.selectedColumn}
          />
          <p className="science-caption">
            {brainStatus.ready
              ? `${brainStatus.connections?.toLocaleString()} biological synapses · trained readout`
              : game.brainError ?? brainStatus.error ?? 'Loading MaleCNS…'}
          </p>
          {!brainStatus.ready && (
            <button className="brain-retry" type="button" onClick={() => void refreshBrain()}>
              Retry connection
            </button>
          )}
        </aside>
      </section>

      <section className="control-panel">
        <GameControls
          reducedMotion={reducedMotion}
          brainReady={brainStatus.ready}
          hasReplay={game.moves.length > 0}
          onReducedMotion={setReducedMotion}
          onNewGame={game.newGame}
          onExport={exportReplay}
        />
        <a
          className="project-link"
          href="https://github.com/KennyMx/FlyFour#readme"
          target="_blank"
          rel="noreferrer"
        >
          Architecture, training notes, and setup guide ↗
        </a>
        <details className="science-note">
          <summary>How biological is this?</summary>
          <p>
            Fly Brain runs all 166,700 MaleCNS v1.0 neurons with 25 million measured
            connections. A supervised readout was trained on the resulting spikes to imitate
            expert Connect Four labels. The biological wiring is real; board encoding, simulated
            dynamics, training labels, and the seven-column decoder are engineered.
          </p>
        </details>
      </section>
    </main>
  )
}
