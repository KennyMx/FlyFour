import { encodeBoard, legalMoves } from './engine'
import type {
  BrainDecision,
  DecisionContext,
  FlyBrainAdapter,
} from './types'

interface ConnectomeResponse {
  selectedColumn?: number
  candidateScores?: (number | null)[]
  neuralResponse?: number[]
  activeNeurons?: number[]
  simulationSteps?: number
}

/**
 * Adapter contract for a fly-api / FlyBrain bridge.
 *
 * The remote service receives engineered Connect Four inputs. A connectome can
 * supply biological wiring, but input encoding, dynamics, readout and reward
 * are intentionally application-defined.
 */
export class ConnectomeAdapter implements FlyBrainAdapter {
  readonly name = 'Fly Brain'
  private readonly endpoint: string

  constructor(endpoint: string) {
    this.endpoint = endpoint
  }

  async decide(context: DecisionContext): Promise<BrainDecision> {
    const response = await fetch(`${this.endpoint.replace(/\/$/, '')}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        board: encodeBoard(context.board),
        shape: [6, 7],
        legalColumns: legalMoves(context.board),
      }),
      signal: context.signal,
    })
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { detail?: string } | null
      throw new Error(payload?.detail ?? `MaleCNS backend returned ${response.status}`)
    }
    const data = (await response.json()) as ConnectomeResponse
    const legal = legalMoves(context.board)
    if (data.selectedColumn === undefined || !legal.includes(data.selectedColumn)) {
      throw new Error('MaleCNS readout selected an illegal column')
    }
    const rawScores = data.candidateScores ?? []
    return {
      column: data.selectedColumn,
      candidates: legal.map((column) => ({
        column,
        score: Number(rawScores[column] ?? 0),
      })),
      neuralResponse: data.neuralResponse ?? rawScores.map((score) => score ?? -1),
      activeNeurons: data.activeNeurons,
      simulationSteps: data.simulationSteps,
      source: 'malecns-v1.0-trained-readout',
    }
  }
}
