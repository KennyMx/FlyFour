import { useCallback, useEffect, useState } from 'react'

export interface BrainStatus {
  ready: boolean
  dataset?: string
  neurons?: number
  connections?: number
  inputNeurons?: number
  readoutNeurons?: number
  device?: string
  error?: string | null
  model?: {
    validationTop1Accuracy?: number
    trainingSamples?: number
    method?: string
  }
}

export const BRAIN_ENDPOINT =
  import.meta.env.VITE_FLY_BRAIN_URL ?? 'http://127.0.0.1:8000'

export function useBrainStatus() {
  const [status, setStatus] = useState<BrainStatus>({
    ready: false,
    error: 'Connecting to MaleCNS…',
  })

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`${BRAIN_ENDPOINT}/health`)
      if (!response.ok) throw new Error(`MaleCNS backend returned ${response.status}`)
      setStatus((await response.json()) as BrainStatus)
    } catch (error) {
      setStatus({
        ready: false,
        error: error instanceof Error ? error.message : 'MaleCNS backend unavailable',
      })
    }
  }, [])

  useEffect(() => {
    // Fetching backend state is the external synchronization this effect owns.
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh()
    const interval = window.setInterval(() => void refresh(), status.ready ? 30_000 : 3_000)
    return () => window.clearInterval(interval)
  }, [refresh, status.ready])

  return { status, refresh }
}
