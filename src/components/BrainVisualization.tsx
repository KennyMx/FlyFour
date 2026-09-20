import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { CandidateScore, GamePhase } from '../game/types'
import {
  createProceduralFlyBrain,
  loadConnectomeCoordinates,
  type NeuronCloud,
} from '../visualization/neuronData'

interface BrainVisualizationProps {
  phase: GamePhase
  candidates: CandidateScore[]
  selectedColumn: number | null
  reducedMotion: boolean
  connectomeEndpoint?: string
}

const INACTIVE = new THREE.Color('#52687d')
const CYAN = new THREE.Color('#36ddea')
const AMBER = new THREE.Color('#ffb238')
const WHITE = new THREE.Color('#ffffff')

function normalizeCoordinates(cloud: NeuronCloud): Float32Array {
  const box = new THREE.Box3()
  cloud.coordinates.forEach(({ x, y, z }) => box.expandByPoint(new THREE.Vector3(x, y, z)))
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const scale = 3.5 / Math.max(size.x, size.y, size.z, 1)
  const positions = new Float32Array(cloud.coordinates.length * 3)
  cloud.coordinates.forEach(({ x, y, z }, index) => {
    positions[index * 3] = (x - center.x) * scale
    positions[index * 3 + 1] = (y - center.y) * scale + 0.25
    positions[index * 3 + 2] = (z - center.z) * scale
  })
  return positions
}

export function BrainVisualization({
  phase,
  candidates,
  selectedColumn,
  reducedMotion,
  connectomeEndpoint,
}: BrainVisualizationProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const live = useRef({ phase, candidates, selectedColumn, reducedMotion })
  const procedural = useMemo(() => createProceduralFlyBrain(), [])
  const [cloud, setCloud] = useState<NeuronCloud>(procedural)

  live.current = { phase, candidates, selectedColumn, reducedMotion }

  useEffect(() => {
    if (!connectomeEndpoint) {
      setCloud(procedural)
      return
    }
    const controller = new AbortController()
    loadConnectomeCoordinates(connectomeEndpoint, controller.signal)
      .then(setCloud)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.warn('Using procedural neurons because connectome coordinates are unavailable.', error)
          setCloud(procedural)
        }
      })
    return () => controller.abort()
  }, [connectomeEndpoint, procedural])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
    camera.position.set(0, 0, 5.8)
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7))
    mount.appendChild(renderer.domElement)

    const positions = normalizeCoordinates(cloud)
    const colors = new Float32Array(positions.length)
    for (let index = 0; index < colors.length; index += 3) {
      INACTIVE.toArray(colors, index)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    const pointMaterial = new THREE.PointsMaterial({
      size: cloud.source === 'real-connectome' ? 0.025 : 0.035,
      vertexColors: true,
      transparent: true,
      opacity: 0.74,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const points = new THREE.Points(geometry, pointMaterial)
    scene.add(points)

    const linkCount = Math.min(460, Math.floor(cloud.coordinates.length / 8))
    const linkPositions = new Float32Array(linkCount * 6)
    for (let link = 0; link < linkCount; link += 1) {
      const first = Math.floor(Math.random() * cloud.coordinates.length)
      const second = Math.min(
        cloud.coordinates.length - 1,
        Math.max(0, first + Math.floor((Math.random() - 0.5) * 90)),
      )
      for (let axis = 0; axis < 3; axis += 1) {
        linkPositions[link * 6 + axis] = positions[first * 3 + axis]
        linkPositions[link * 6 + 3 + axis] = positions[second * 3 + axis]
      }
    }
    const lineGeometry = new THREE.BufferGeometry()
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linkPositions, 3))
    const lineMaterial = new THREE.LineBasicMaterial({
      color: CYAN,
      transparent: true,
      opacity: 0.13,
      blending: THREE.AdditiveBlending,
    })
    const lines = new THREE.LineSegments(lineGeometry, lineMaterial)
    scene.add(lines)

    const resize = () => {
      const width = Math.max(1, mount.clientWidth)
      const height = Math.max(1, mount.clientHeight)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(mount)
    resize()

    let animationFrame = 0
    const start = performance.now()
    const colorAttribute = geometry.getAttribute('color') as THREE.BufferAttribute
    const render = (now: number) => {
      const state = live.current
      const active = state.phase === 'thinking' || state.phase === 'selecting'
      const elapsed = (now - start) / 1000
      if (!state.reducedMotion) points.rotation.y = Math.sin(elapsed * 0.22) * 0.13
      points.scale.setScalar(active ? 1 : 0.76)
      lines.scale.copy(points.scale)
      pointMaterial.opacity = active ? 0.9 : 0.48
      lineMaterial.opacity = active ? (state.phase === 'selecting' ? 0.5 : 0.2) : 0.04
      lineMaterial.color.copy(state.phase === 'selecting' ? WHITE : CYAN)

      if (active && (!state.reducedMotion || state.phase === 'selecting')) {
        const count = colorAttribute.count
        const wave = Math.floor(elapsed * 900) % count
        const stride = Math.max(1, Math.floor(count / 520))
        for (let index = 0; index < count; index += stride) {
          const distance = (index - wave + count) % count
          const flash = distance < count * 0.035
          const reward = (index + Math.floor(elapsed * 8)) % 17 === 0
          const color = flash ? CYAN : reward ? AMBER : INACTIVE
          colorAttribute.setXYZ(index, color.r, color.g, color.b)
        }
        colorAttribute.needsUpdate = true
      }
      renderer.render(scene, camera)
      animationFrame = requestAnimationFrame(render)
    }
    animationFrame = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animationFrame)
      observer.disconnect()
      geometry.dispose()
      lineGeometry.dispose()
      pointMaterial.dispose()
      lineMaterial.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [cloud])

  const scoreMap = new Map(candidates.map(({ column, score }) => [column, score]))
  const maximum = Math.max(1, ...candidates.map(({ score }) => Math.abs(score)))

  return (
    <div className={`brain-visualization ${phase}`} aria-label="Fly neural activity visualization">
      <div ref={mountRef} className="brain-canvas" aria-hidden="true" />
      <div className="brain-label">
        <span className="live-dot" />
        {cloud.source === 'real-connectome' ? 'REAL CONNECTOME COORDINATES' : 'PROCEDURAL NEURON MAP'}
      </div>
      <div className="output-regions" aria-label="Seven column output regions">
        {Array.from({ length: 7 }, (_, column) => {
          const score = scoreMap.get(column)
          const strength = score === undefined ? 0.06 : 0.18 + (Math.abs(score) / maximum) * 0.72
          return (
            <span
              key={column}
              className={selectedColumn === column ? 'output selected' : 'output'}
              style={{ '--strength': strength } as React.CSSProperties}
              title={`Column ${column + 1}${score === undefined ? '' : `: ${score.toFixed(1)}`}`}
            >
              {column + 1}
            </span>
          )
        })}
      </div>
    </div>
  )
}
