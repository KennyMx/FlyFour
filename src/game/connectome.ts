import { ClassicAIAdapter } from './ai'
import { encodeBoard, legalMoves } from './engine'
import type {
  BrainDecision,
  DecisionContext,
  FlyBrainAdapter,
} from './types'

interface ConnectomeResponse {
  selectedColumn?: number
  candidateScores?: number[]
  neuralResponse?: number[]
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
  private readonly fallback = new ClassicAIAdapter()
  private readonly endpoint?: string

  constructor(endpoint?: string) {
    this.endpoint = endpoint
  }

  async decide(context: DecisionContext): Promise<BrainDecision> {
    if (!this.endpoint) {
      const decision = await this.fallback.decide(context)
      return { ...decision, source: 'connectome-fallback' }
    }

    try {
      const response = await fetch(`${this.endpoint.replace(/\/$/, '')}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          board: encodeBoard(context.board),
          shape: [6, 7],
          legalColumns: legalMoves(context.board),
          difficulty: context.difficulty,
        }),
        signal: context.signal,
      })
      if (!response.ok) throw new Error(`Connectome backend returned ${response.status}`)
      const data = (await response.json()) as ConnectomeResponse
      const legal = legalMoves(context.board)
      if (data.selectedColumn === undefined || !legal.includes(data.selectedColumn)) {
        throw new Error('Connectome backend selected an illegal column')
      }
      const rawScores = data.candidateScores ?? []
      return {
        column: data.selectedColumn,
        candidates: legal.map((column) => ({
          column,
          score: Number(rawScores[column] ?? 0),
        })),
        neuralResponse: data.neuralResponse ?? rawScores,
        source: 'connectome',
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      console.warn('Fly Brain backend unavailable; using Classic AI fallback.', error)
      const decision = await this.fallback.decide(context)
      return { ...decision, source: 'connectome-fallback' }
    }
  }
}
