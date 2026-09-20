export type Player = 'human' | 'fly'
export type Cell = Player | null
export type Board = Cell[][]
export type Difficulty = 'easy' | 'medium' | 'hard'
export type OpponentMode = 'classic' | 'connectome'
export type GamePhase = 'player' | 'thinking' | 'selecting' | 'ended' | 'error'
export type GameResult = Player | 'draw' | null

export interface Move {
  player: Player
  column: number
  row: number
  at: number
}

export interface CandidateScore {
  column: number
  score: number
}

export interface BrainDecision {
  column: number
  candidates: CandidateScore[]
  neuralResponse?: number[]
  activeNeurons?: number[]
  simulationSteps?: number
  source: 'classic-ai' | 'malecns-v1.0-trained-readout'
}

export interface DecisionContext {
  board: Board
  difficulty: Difficulty
  signal?: AbortSignal
}

export interface FlyBrainAdapter {
  readonly name: string
  decide(context: DecisionContext): Promise<BrainDecision>
}

export interface DecisionLog {
  turn: number
  timestamp: string
  adapter: string
  boardEncoding: number[]
  neuralResponse: number[]
  candidateScores: CandidateScore[]
  selectedColumn: number
  reward: number | null
}

export interface Replay {
  format: 'fly-four-replay'
  version: 1
  createdAt: string
  difficulty: Difficulty
  opponent: OpponentMode
  moves: Move[]
  decisions: DecisionLog[]
  result: GameResult
  scientificNote: string
}
