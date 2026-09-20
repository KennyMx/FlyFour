# Fly Four

Connect Four against a trained readout of the real **MaleCNS v1.0 fruit-fly connectome**.

Fly Brain runs a leaky integrate-and-fire simulation containing 166,700 neurons and approximately 25 million measured connections. Board positions stimulate real visual neurons and activity propagates through the fixed connectome. A trained ensemble reads pooled sensory, visual-projection, and descending-neuron spikes to score the seven columns.

There is no minimax fallback in Fly Brain. If the connectome, trained readout, or Python service is unavailable, the game reports that the brain is offline and does not substitute a conventional AI move.

## Run the complete game

Requires Node.js 20+ and Python 3.11+.

```bash
npm install
npm run brain:setup
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
5. Exponentially decaying sensory, visual-projection, and descending activity becomes 340 pooled spike features.
6. Depth-three and depth-four teachers supply supervised move labels during offline training.
7. Gradient-boosted policies learn general play plus immediate-win and immediate-block recognition.
8. Runtime scores combine the sensory policy (70%) and whole-connectome policy (30%); a learned tactical specialist handles high-confidence threats.

At runtime, only the board encoder, fixed MaleCNS simulation, and learned decoder run. The expert/minimax code is not called.

Training is reproducible:

```bash
npm run brain:train
```

Model metadata records the training size, validation agreement, population, simulation steps, package version, and timestamp.

The included model was evaluated on 384 depth-four positions generated with a different seed. These are historical metrics from the original training pipeline, which did not enforce disjoint training and validation boards:

- 61.2% exact move agreement
- 86.7% immediate-win accuracy
- 88.6% immediate-block accuracy

New training runs use a deterministic board-based split across the connectome,
sensory, and tactical curricula. A board and its horizontal reflection always
belong to the same partition, preventing validation examples from leaking into
training through another seed or mirror augmentation. Version-three caches are
separate from the original caches and are rebuilt on the first run.

The whole-connectome policy now trains only on measured activity: reversing the
sensory slots while retaining the original downstream activity is not a valid
brain simulation. Mirror augmentation remains in the engineered sensory policy.
Training evaluation and runtime share the same decoder, including explicit
mapping of classifier labels to board columns.

The offline teacher batches all 69 winning windows with NumPy. On a local
16-position depth-three benchmark, labels were unchanged and generation fell
from 0.898 seconds to 0.065 seconds (about 14× faster); this is a teacher benchmark,
not a measurement of full training time or gameplay strength. The bundled model
has not been retrained with these changes. Run `npm run brain:train` to produce
new model weights and validation metrics.

## Architecture

```text
backend/
├── app.py                 FastAPI service: health, coordinates, decisions, rewards
├── brain.py               MaleCNS encoder, simulation, spike trace, trained readout
├── connect_four.py        Position generator and offline expert labels
├── train.py               Reproducible reservoir-readout training
├── policy.py              Shared training/runtime learned decoder
└── models/                Trained readout and provenance metadata

src/
├── components/
│   ├── BrainVisualization.tsx  GPU point cloud for every real neuron
│   ├── FlyMascot.tsx
│   ├── GameBoard.tsx
│   └── GameControls.tsx
├── game/
│   ├── connectome.ts      Strict MaleCNS HTTP adapter; no fallback
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
- pooled spike features, gradient policies, ensemble weights, and tactical threshold
- reward logging and the game interface

This is reservoir computing over genuine connectome wiring—not evidence that an unmodified biological fly understands symbolic games. The app clearly separates biological data from engineered game behavior.

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
