import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ClassicAIAdapter } from '../game/ai'
import { ConnectomeAdapter } from '../game/connectome'
import {
  createBoard,
  dropPiece,
  encodeBoard,
  getResult,
  winningCells,
} from '../game/engine'
import type {
  Board,
  CandidateScore,
  DecisionLog,
  Difficulty,
  GamePhase,
  GameResult,
  Move,
  OpponentMode,
  Replay,
} from '../game/types'
import { BRAIN_ENDPOINT } from './useBrainStatus'

const SCIENTIFIC_NOTE =
  'A fly connectome contributes biological wiring only. Board encoding, neural dynamics, column decoding, and reward are engineered for this game.'

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds))

export function useFlyFour(reducedMotion: boolean) {
  const [board, setBoard] = useState<Board>(createBoard)
  const [moves, setMoves] = useState<Move[]>([])
  const [decisions, setDecisions] = useState<DecisionLog[]>([])
  const [phase, setPhase] = useState<GamePhase>('player')
  const [result, setResult] = useState<GameResult>(null)
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [opponent, setOpponent] = useState<OpponentMode>('connectome')
  const [candidates, setCandidates] = useState<CandidateScore[]>([])
  const [selectedColumn, setSelectedColumn] = useState<number | null>(null)
  const [activeNeurons, setActiveNeurons] = useState<number[]>([])
  const [brainError, setBrainError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const gameRef = useRef(0)
  const rewardSentRef = useRef(false)

  const classicAdapter = useMemo(() => new ClassicAIAdapter(), [])
  const connectomeAdapter = useMemo(
    () =>
      new ConnectomeAdapter(
        import.meta.env.VITE_FLY_BRAIN_URL ?? 'http://127.0.0.1:8000',
      ),
    [],
  )

  const finishGame = useCallback((nextResult: Exclude<GameResult, null>) => {
    setResult(nextResult)
    setPhase('ended')
    const reward = nextResult === 'fly' ? 1 : nextResult === 'human' ? -1 : 0
    setDecisions((current) =>
      current.map((decision, index) =>
        index === current.length - 1 ? { ...decision, reward } : decision,
      ),
    )
    console.info('[Fly Four] final result', { result: nextResult, reward })
  }, [])

  const runFlyTurn = useCallback(
    async (inputBoard: Board, gameId: number) => {
      const controller = new AbortController()
      controllerRef.current = controller
      const adapter = opponent === 'connectome' ? connectomeAdapter : classicAdapter
      try {
        const thinkingStart = performance.now()
        const decision = await adapter.decide({
          board: inputBoard,
          difficulty,
          signal: controller.signal,
        })
        const minimumThinkingTime = reducedMotion ? 100 : 900
        await wait(Math.max(0, minimumThinkingTime - (performance.now() - thinkingStart)))
        if (controller.signal.aborted || gameId !== gameRef.current) return

        setCandidates(decision.candidates)
        setActiveNeurons(decision.activeNeurons ?? [])
        setSelectedColumn(decision.column)
        setPhase('selecting')
        const log: DecisionLog = {
          turn: Math.floor(moves.length / 2) + 1,
          timestamp: new Date().toISOString(),
          adapter: decision.source,
          boardEncoding: encodeBoard(inputBoard),
          neuralResponse: decision.neuralResponse ?? [],
          candidateScores: decision.candidates,
          selectedColumn: decision.column,
          reward: null,
        }
        setDecisions((current) => [...current, log])
        console.info('[Fly Four] neural decision', log)
        await wait(reducedMotion ? 80 : 620)
        if (controller.signal.aborted || gameId !== gameRef.current) return

        const dropped = dropPiece(inputBoard, decision.column, 'fly')
        if (!dropped) return
        const move: Move = {
          player: 'fly',
          column: decision.column,
          row: dropped.row,
          at: Date.now(),
        }
        setBoard(dropped.board)
        setMoves((current) => [...current, move])
        setSelectedColumn(null)
        setCandidates([])
        setActiveNeurons([])
        const nextResult = getResult(dropped.board)
        if (nextResult) finishGame(nextResult)
        else setPhase('player')
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error('[Fly Four] opponent failed', error)
          setBrainError(error instanceof Error ? error.message : 'MaleCNS backend failed')
          setPhase('error')
        }
      }
    },
    [
      classicAdapter,
      connectomeAdapter,
      difficulty,
      finishGame,
      moves.length,
      opponent,
      reducedMotion,
    ],
  )

  const playColumn = useCallback(
    (column: number) => {
      if (phase !== 'player' || result) return
      const dropped = dropPiece(board, column, 'human')
      if (!dropped) return
      const move: Move = { player: 'human', column, row: dropped.row, at: Date.now() }
      setBoard(dropped.board)
      setMoves((current) => [...current, move])
      const nextResult = getResult(dropped.board)
      if (nextResult) {
        finishGame(nextResult)
      } else {
        setPhase('thinking')
        void runFlyTurn(dropped.board, gameRef.current)
      }
    },
    [board, finishGame, phase, result, runFlyTurn],
  )

  const newGame = useCallback(() => {
    controllerRef.current?.abort()
    gameRef.current += 1
    rewardSentRef.current = false
    setBoard(createBoard())
    setMoves([])
    setDecisions([])
    setPhase('player')
    setResult(null)
    setCandidates([])
    setSelectedColumn(null)
    setActiveNeurons([])
    setBrainError(null)
  }, [])

  useEffect(() => () => controllerRef.current?.abort(), [])

  useEffect(() => {
    if (
      !result ||
      opponent !== 'connectome' ||
      !decisions.length ||
      rewardSentRef.current
    ) {
      return
    }
    rewardSentRef.current = true
    const reward = result === 'fly' ? 1 : result === 'human' ? -1 : 0
    const lastDecision = decisions.at(-1)
    void fetch(`${BRAIN_ENDPOINT}/reward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        board: encodeBoard(board),
        selectedColumn: lastDecision?.selectedColumn ?? 0,
        reward,
        result,
      }),
    }).catch((error: unknown) => {
      console.warn('[Fly Four] reward log failed', error)
    })
  }, [board, decisions, opponent, result])

  const winnerCells = result === 'human' || result === 'fly' ? winningCells(board, result) : []
  const replay: Replay = {
    format: 'fly-four-replay',
    version: 1,
    createdAt: new Date().toISOString(),
    difficulty,
    opponent,
    moves,
    decisions,
    result,
    scientificNote: SCIENTIFIC_NOTE,
  }

  return {
    board,
    moves,
    phase,
    result,
    difficulty,
    opponent,
    candidates,
    selectedColumn,
    activeNeurons,
    brainError,
    winnerCells,
    replay,
    playColumn,
    newGame,
    setDifficulty,
    setOpponent,
  }
}
