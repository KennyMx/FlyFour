export interface NeuronCoordinate {
  x: number
  y: number
  z: number
}

export interface NeuronCloud {
  coordinates: NeuronCoordinate[]
  source: 'real-connectome'
  localizedCount?: number
}

function toCoordinate(value: unknown): NeuronCoordinate | null {
  if (Array.isArray(value) && value.length >= 3 && value.slice(0, 3).every(Number.isFinite)) {
    return { x: Number(value[0]), y: Number(value[1]), z: Number(value[2]) }
  }
  if (!value || typeof value !== 'object') return null
  const coordinate = value as Record<string, unknown>
  return ['x', 'y', 'z'].every((key) => Number.isFinite(coordinate[key]))
    ? {
        x: Number(coordinate.x),
        y: Number(coordinate.y),
        z: Number(coordinate.z),
      }
    : null
}

export async function loadConnectomeCoordinates(
  endpoint: string,
  signal?: AbortSignal,
): Promise<NeuronCloud> {
  const response = await fetch(`${endpoint.replace(/\/$/, '')}/neurons`, { signal })
  if (!response.ok) throw new Error(`Neuron endpoint returned ${response.status}`)
  const payload = (await response.json()) as unknown
  const values = Array.isArray(payload)
    ? payload
    : (payload as { neurons?: unknown })?.neurons
  if (!Array.isArray(values)) throw new Error('Neuron response must contain an array')

  const coordinates = values
    .map(toCoordinate)
    .filter((coordinate): coordinate is NeuronCoordinate => coordinate !== null)
  if (!coordinates.length) throw new Error('Neuron response contained no valid coordinates')
  const localizedCount =
    !Array.isArray(payload) && Number.isFinite((payload as { localizedCount?: number }).localizedCount)
      ? Number((payload as { localizedCount: number }).localizedCount)
      : coordinates.length
  return { coordinates, source: 'real-connectome', localizedCount }
}
