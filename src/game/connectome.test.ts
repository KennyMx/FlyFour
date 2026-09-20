import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConnectomeAdapter } from './connectome'
import { createBoard } from './engine'

describe('MaleCNS adapter', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns the trained neural decision and firing indices', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          selectedColumn: 3,
          candidateScores: [0.1, 0.2, 0.3, 0.9, 0.2, 0.1, 0],
          neuralResponse: [0.1, 0.2, 0.3, 0.9, 0.2, 0.1, 0],
          activeNeurons: [12, 440, 166_699],
          simulationSteps: 8,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const decision = await new ConnectomeAdapter('http://brain').decide({
      board: createBoard(),
      difficulty: 'hard',
    })

    expect(decision.column).toBe(3)
    expect(decision.source).toBe('malecns-v1.0-trained-readout')
    expect(decision.activeNeurons).toEqual([12, 440, 166_699])
  })

  it('does not silently fall back when the brain is unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: 'readout is not trained' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(
      new ConnectomeAdapter('http://brain').decide({
        board: createBoard(),
        difficulty: 'hard',
      }),
    ).rejects.toThrow('readout is not trained')
  })
})
