import type { GamePhase, GameResult } from '../game/types'

interface FlyMascotProps {
  phase: GamePhase
  result: GameResult
  selectedColumn: number | null
}

export function FlyMascot({ phase, result, selectedColumn }: FlyMascotProps) {
  const mood =
    result === 'fly'
      ? 'winning'
      : result === 'human'
        ? 'losing'
        : result === 'draw'
          ? 'draw'
          : phase
  const look = selectedColumn === null ? 0 : (selectedColumn - 3) * 1.25

  return (
    <div className={`fly-mascot ${mood}`} aria-label={`Fly mascot is ${mood}`}>
      <span className="fly-shadow" />
      <svg viewBox="0 0 260 220" role="img" aria-hidden="true">
        <g className="fly-body">
          <ellipse className="wing wing-left" cx="76" cy="111" rx="58" ry="34" />
          <ellipse className="wing wing-right" cx="184" cy="111" rx="58" ry="34" />
          <path className="leg" d="M102 150 Q66 174 58 202" />
          <path className="leg" d="M114 154 Q91 189 96 211" />
          <path className="leg" d="M158 150 Q194 174 202 202" />
          <path className="leg" d="M146 154 Q169 189 164 211" />
          <ellipse className="abdomen" cx="130" cy="143" rx="42" ry="54" />
          <path className="stripe" d="M96 129 Q130 142 164 129" />
          <path className="stripe" d="M91 148 Q130 163 169 148" />
          <circle className="head" cx="130" cy="81" r="47" />
          <path className="antenna antenna-left" d="M112 47 Q91 18 73 24" />
          <path className="antenna antenna-right" d="M148 47 Q169 18 187 24" />
          <circle className="antenna-tip" cx="72" cy="24" r="6" />
          <circle className="antenna-tip" cx="188" cy="24" r="6" />
          <ellipse className="eye" cx="108" cy="77" rx="18" ry="22" />
          <ellipse className="eye" cx="152" cy="77" rx="18" ry="22" />
          <g style={{ transform: `translateX(${look}px)` }}>
            <circle className="pupil" cx="110" cy="80" r="7" />
            <circle className="pupil" cx="154" cy="80" r="7" />
          </g>
          <path className="mouth smile" d="M115 103 Q130 116 145 103" />
          <path className="mouth frown" d="M115 111 Q130 98 145 111" />
          <path className="mouth confused-mouth" d="M115 106 Q122 98 130 106 T145 106" />
          <g className="dizzy-eyes">
            <path d="M98 69 L118 88 M118 69 L98 88" />
            <path d="M142 69 L162 88 M162 69 L142 88" />
          </g>
        </g>
      </svg>
      <span className="mascot-speech" aria-hidden="true">
        {result === 'fly'
          ? 'Bzzilliant!'
          : result === 'human'
            ? 'Good game!'
            : result === 'draw'
              ? 'A tie?'
              : phase === 'thinking'
                ? 'Hmm…'
                : phase === 'selecting'
                  ? 'Got it!'
                  : phase === 'error'
                    ? 'Brain link lost!'
                  : 'Your move!'}
      </span>
    </div>
  )
}
