# Fly Four

Connect Four against a trained readout of the real **MaleCNS v1.0 fruit-fly connectome**.

Fly Brain mode runs a leaky integrate-and-fire simulation containing 166,700 neurons and approximately 25 million measured connections. Board positions stimulate real visual neurons, activity propagates through the fixed connectome, and a trained readout converts activity from visual-projection and descending neurons into scores for the seven columns.

There is no minimax fallback in Fly Brain mode. If the connectome, trained readout, or Python service is unavailable, the game reports that the brain is offline and does not substitute a conventional AI move.

## Run the complete game

Requires Node.js 20+ and Python 3.11+.

```bash
npm install
npm run brain:setup
npm run brain:train
npm run dev:full
```

`brain:setup` installs [`flybrain`](https://pypi.org/project/flybrain/) and downloads its checksum-verified MaleCNS files (about 260 MB) into `.fly-data/`. The source dataset is the official [MaleCNS v1.0 release](https://male-cns.janelia.org/download/). These large files are intentionally not committed.

The trained model is already included in `backend/models/`, so retraining is optional after cloning. Run `brain:train` when you want to reproduce or replace it.

The web app runs at `http://localhost:5173`; the brain API runs at `http://127.0.0.1:8000`.

## What “trained” means

The biological connection matrix stays frozen.

1. Legal Connect Four positions are generated.
2. Each of the 42 board cells is assigned to visual-neuron populations. Separate visual channels represent human and fly pieces.
3. The board repeatedly stimulates those 6,006 input neurons.
4. Spikes propagate through all 166,700 neurons using the MaleCNS synaptic graph.
5. Exponentially decaying activity from visual-projection and descending neurons becomes the reservoir feature vector.
6. A depth-four Connect Four expert supplies supervised score labels during offline training.
7. PCA plus ridge regression learns the only trainable component: a seven-output decoder.

At runtime, only the board encoder, fixed MaleCNS simulation, and learned decoder run. The expert/minimax code is not called.

Training is reproducible:

```bash
FLY_TRAIN_SAMPLES=512 npm run brain:train
```

Model metadata records the training size, validation agreement, population, simulation steps, package version, and timestamp.

## Architecture

```text
backend/
├── app.py                 FastAPI service: health, coordinates, decisions, rewards
├── brain.py               MaleCNS encoder, simulation, spike trace, trained readout
├── connect_four.py        Position generator and offline expert labels
├── train.py               Reproducible reservoir-readout training
└── models/                Trained readout and provenance metadata

src/
├── components/
│   ├── BrainVisualization.tsx  GPU point cloud for every real neuron
│   ├── FlyMascot.tsx
│   ├── GameBoard.tsx
│   └── GameControls.tsx
├── game/
│   ├── connectome.ts      Strict MaleCNS HTTP adapter; no fallback
│   ├── ai.ts              Optional, explicitly selected Classic AI
│   └── engine.ts
└── hooks/
    ├── useBrainStatus.ts
    └── useFlyFour.ts
```

### Brain API

- `GET /health` reports whether real data and a trained model are loaded, plus neuron/connection counts and training provenance.
- `GET /neurons` returns all 166,700 MaleCNS neurons. The release metadata provides
  140,638 finite centroid coordinates; the API reports that count and places the
  remaining 26,062 unlocalized real neurons in a visibly peripheral layout.
- `POST /decide` runs the actual spiking simulation and returns seven learned scores, a selected legal column, and the indices of neurons that fired.
- `POST /reward` records completed-game outcomes in a local JSONL log.

The frontend illuminates returned firing indices in the real coordinate cloud. It renders all neurons as a single GPU point cloud, while showing only a bounded set of pathways.

## Classic AI

Classic AI remains as a separately labeled comparison mode because the original project specification requested a reliable minimax opponent. It is never invoked by Fly Brain mode. Select it explicitly if you want conventional difficulty levels and controlled randomness.

## Scientific limitations

A fruit fly does not naturally understand Connect Four.

Real biological components:

- MaleCNS v1.0 neuron identities and positions
- approximately 25 million measured neuron-to-neuron connections
- neurotransmitter-signed, normalized connectivity supplied by `flybrain`
- spikes propagated through the complete fixed network

Engineered components:

- mapping 42 board cells and two piece identities onto visual neurons
- leaky integrate-and-fire parameters and simulation duration
- expert-generated Connect Four training labels
- PCA/ridge seven-column decoder
- reward logging and the game interface

This is reservoir computing over genuine connectome wiring—not evidence that an unmodified biological fly understands symbolic games. The app exposes model provenance and labels real versus procedural visualization data.

## Other commands

```bash
npm test
npm run brain:test
npm run lint
npm run build
```

To use another backend URL:

```env
VITE_FLY_BRAIN_URL=http://127.0.0.1:8000
```

## Data attribution

MaleCNS v1.0 is produced by FlyEM at HHMI Janelia and collaborators. See the [official project page](https://male-cns.janelia.org/) and [download documentation](https://male-cns.janelia.org/download/) for dataset details, releases, and attribution requirements.
