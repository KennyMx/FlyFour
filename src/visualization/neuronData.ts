export interface NeuronCoordinate {
  x: number
  y: number
  z: number
}

export interface NeuronCloud {
  coordinates: NeuronCoordinate[]
  source: 'real-connectome' | 'procedural'
  localizedCount?: number
}

function randomGaussian(): number {
  const u = Math.max(Number.EPSILON, Math.random())
  const v = Math.max(Number.EPSILON, Math.random())
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export function createProceduralFlyBrain(count = 8_000): NeuronCloud {
  const coordinates: NeuronCoordinate[] = []
  for (let index = 0; index < count; index += 1) {
    const side = index % 2 === 0 ? -1 : 1
    const lobe = Math.random()
    const spread = lobe > 0.78 ? 0.52 : 0.82
    const x = side * (0.25 + Math.random() * 0.86) + randomGaussian() * 0.18
    const y = randomGaussian() * spread * (1 - Math.min(0.6, Math.abs(x) * 0.16))
    const z = randomGaussian() * 0.32
    coordinates.push({ x, y, z })
  }

  // Add a narrow ventral nerve cord extending below the paired brain lobes.
  const cordCount = Math.floor(count * 0.16)
  for (let index = 0; index < cordCount; index += 1) {
    const progress = index / cordCount
    coordinates.push({
      x: randomGaussian() * (0.14 - progress * 0.05),
      y: -0.65 - progress * 1.35,
      z: randomGaussian() * 0.1,
    })
  }
  return { coordinates, source: 'procedural' }
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
