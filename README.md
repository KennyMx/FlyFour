# Fly Four

A polished Connect Four game where you play against a simulated fruit-fly brain. The game is fully playable offline with a reliable minimax opponent and a procedural, GPU-rendered neural visualization. An adapter can optionally connect it to a service built around [`fly-api`](https://github.com/dtch1997/fly-api) or [`FlyBrain`](https://github.com/Jhongdlp/FlyBrain).

## Features

- Complete 7 × 6 Connect Four rules, win detection, draws, and input locking
- Three minimax difficulty levels with alpha-beta pruning and controlled randomness
- Mouse, touch, and keyboard controls (arrow keys plus Enter/Space)
- Animated falling pieces, winning-cell pulses, and responsive column selection
- Friendly fly mascot with idle, thinking, selecting, winning, losing, and draw states
- Three.js point-cloud renderer with thousands of visible procedural neurons
- Cyan sensory waves, amber evaluation activity, white selection pathways, and seven outputs
- Optional real-neuron coordinate loading with one GPU point per coordinate
- Responsive 60/40 desktop layout and stacked mobile layout
- Reduced-motion setting plus automatic operating-system preference detection
- Structured decision logs and downloadable replay JSON
- 12 automated tests covering game rules and AI decisions

## Quick start

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. The app needs no backend in its default configuration.

Other commands:

```bash
npm test          # run all Vitest tests
npm run test:watch
npm run lint      # run oxlint
npm run build     # type-check and create a production build
npm run preview   # serve the production build locally
```

## Architecture

```text
src/
├── components/
│   ├── BrainVisualization.tsx  Three.js point cloud and sampled pathways
│   ├── FlyMascot.tsx           Stateful SVG mascot
│   ├── GameBoard.tsx           Accessible board input and rendering
│   └── GameControls.tsx        Opponent, difficulty, motion, replay controls
├── game/
│   ├── engine.ts               Pure board rules and board encoding
│   ├── ai.ts                   Minimax Classic AI adapter
│   ├── connectome.ts           Optional HTTP connectome adapter
│   └── types.ts                Shared contracts and replay schema
├── hooks/useFlyFour.ts         Turn timing, state machine, logs, and results
├── visualization/neuronData.ts Coordinate loading and procedural fallback
└── styles/                     Modular responsive visual system
```

All opponent implementations sit behind `FlyBrainAdapter`:

```ts
interface FlyBrainAdapter {
  readonly name: string
  decide(context: DecisionContext): Promise<BrainDecision>
}
```

This keeps rules and UI independent of whether a move comes from minimax or a connectome-backed service.

## Optional connectome backend

Copy the example environment file and point it to a bridge service:

```bash
cp .env.example .env.local
```

```env
VITE_FLY_BRAIN_URL=http://localhost:8000
```

The bridge has two small HTTP contracts.

### `POST /decide`

Request:

```json
{
  "board": [0, 0, 0, 1, -1],
  "shape": [6, 7],
  "legalColumns": [0, 1, 2, 4, 5, 6],
  "difficulty": "medium"
}
```

The complete `board` array always contains 42 row-major values: `1` for the human, `-1` for the fly, and `0` for empty.

Response:

```json
{
  "selectedColumn": 4,
  "candidateScores": [0.1, 0.2, -0.4, 0, 0.8, 0.3, 0.1],
  "neuralResponse": [0.02, 0.61, 0.14]
}
```

The selected column must be legal. Network errors, malformed responses, and illegal moves fall back safely to Classic AI and are labeled `connectome-fallback` in logs.

### `GET /neurons`

Return either an array or `{ "neurons": [...] }`:

```json
[
  { "x": 12.4, "y": -8.1, "z": 2.3 },
  { "x": 12.8, "y": -7.7, "z": 2.1 }
]
```

Every valid coordinate is placed in a single GPU point-cloud draw call. This supports large datasets such as MaleCNS (roughly 165,000 neurons). Fly Four deliberately renders only sampled activity pathways rather than every synapse, because rendering all connections would overwhelm both the display and typical client hardware.

Backend-specific dataset loading and neural simulation belong in the bridge service. This repository does not vendor biological datasets.

## Decision logs and replays

Each fly turn logs:

- 42-value board encoding
- adapter source
- neural response
- score for every legal candidate column
- selected column
- terminal reward (`1`, `-1`, or `0`) when applicable

“Export replay” downloads a versioned JSON document containing settings, moves, decisions, final result, and the scientific disclosure. Moves are replayable in timestamp order.

## Scientific limitations

**A biological fruit fly does not naturally understand or play Connect Four.**

When a backend and real data are configured, the neuron coordinates and wiring can come from an actual connectome. The following parts are still engineered:

- conversion of a 6 × 7 board into neural input
- neuron activation and timing dynamics
- evaluation and reward signals
- mapping activity to seven output columns
- training or calibration that makes those outputs useful for this game

The UI labels real coordinate data as **REAL CONNECTOME COORDINATES**. Without a coordinate backend, it labels the display **PROCEDURAL NEURON MAP**. The procedural visualization is inspired by bilateral fly-brain anatomy, but it is not experimental biological data. “Fly Brain” describes the optional adapter mode, not evidence that a fly connectome inherently performs symbolic game reasoning.

## Accessibility and performance

- The board remains visible while the fly thinks.
- Player input is disabled during fly turns and after a result.
- Each column is a keyboard-focusable control with grid semantics and useful labels.
- Reduced motion disables nonessential transitions and honors `prefers-reduced-motion`.
- Three.js loads as a separate lazy chunk.
- Neurons use a `BufferGeometry` point cloud; connections are a bounded changing sample.
- Device pixel ratio is capped to avoid excessive fill cost on high-density displays.

## License

No license has been selected yet. Add one before redistributing the project.
# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
