import { useRef, useState, Suspense, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Environment, ContactShadows, PerspectiveCamera, useGLTF } from '@react-three/drei'
import { motion } from 'framer-motion'
import * as THREE from 'three'

/* ── Real GLB car model ─────────────────────────────────────────────────── */
function CarModel({ color = '#1a56db' }) {
  const { scene } = useGLTF('/car-sedan.glb')
  const groupRef = useRef()

  useEffect(() => {
    scene.traverse((obj) => {
      if (!obj.isMesh) return
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      mats.forEach((mat, idx) => {
        if (!mat) return
        const matName = (mat.name || '').toLowerCase()
        // Only recolor the main body paint material
        if (!matName.includes('body_color') && !matName.includes('body color') && !matName.includes('paint')) return
        // Clone to avoid mutating the shared cache
        const cloned = mat.clone()
        cloned.color.set(color)
        cloned.metalness = 0.85
        cloned.roughness = 0.12
        if (cloned.clearcoat !== undefined) {
          cloned.clearcoat = 1.0
          cloned.clearcoatRoughness = 0.04
        }
        cloned.needsUpdate = true
        if (Array.isArray(obj.material)) {
          obj.material = [...obj.material]
          obj.material[idx] = cloned
        } else {
          obj.material = cloned
        }
      })
    })
  }, [color, scene])

  // Gentle auto-rotate
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.004
    }
  })

  // Centre + scale the model to fit nicely
  useEffect(() => {
    const box = new THREE.Box3().setFromObject(scene)
    const centre = new THREE.Vector3()
    box.getCenter(centre)
    const size = new THREE.Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)
    const scale = 2.8 / maxDim
    scene.position.set(-centre.x * scale, -centre.y * scale, -centre.z * scale)
    if (groupRef.current) groupRef.current.scale.setScalar(scale)
  }, [scene])

  return <group ref={groupRef}><primitive object={scene} /></group>
}

useGLTF.preload('/car-sedan.glb')

/* ── Color picker ────────────────────────────────────────────────────────── */
const COLORS = [
  { label: 'Blue', hex: '#1a56db' },
  { label: 'Silver', hex: '#9ca3af' },
  { label: 'Black', hex: '#1a1a1a' },
  { label: 'White', hex: '#f0f0f0' },
  { label: 'Red', hex: '#dc2626' },
  { label: 'Green', hex: '#16a34a' },
  { label: 'Gold', hex: '#d97706' },
  { label: 'Purple', hex: '#7c3aed' },
]

const COLOR_NAME_MAP = {
  white: '#f0f0f0', black: '#1a1a1a', silver: '#9ca3af', gray: '#6b7280',
  blue: '#1a56db', red: '#dc2626', green: '#16a34a', yellow: '#fbbf24',
  orange: '#f97316', brown: '#92400e', gold: '#d97706', purple: '#7c3aed',
  beige: '#d6c5a8', burgundy: '#7f1d1d', turquoise: '#0891b2',
}

function guessColor(colorStr) {
  if (!colorStr) return '#1a56db'
  const lower = colorStr.toLowerCase()
  for (const [k, v] of Object.entries(COLOR_NAME_MAP)) {
    if (lower.includes(k)) return v
  }
  return '#1a56db'
}

/* ── Main component ──────────────────────────────────────────────────────── */
export default function CarViewer3D({ carInfo }) {
  const [activeColor, setActiveColor] = useState(guessColor(carInfo?.color_en))

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* 3D Canvas */}
      <Canvas shadows style={{ background: 'transparent', width: '100%', height: '100%' }}>
        <PerspectiveCamera makeDefault position={[3, 1.6, 4.5]} fov={42} />

        <ambientLight intensity={0.6} />
        <directionalLight
          position={[5, 8, 5]}
          intensity={2.0}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        <directionalLight position={[-4, 3, -4]} intensity={0.8} color="#c0d8ff" />
        <pointLight position={[0, 5, 0]} intensity={0.5} color="#ffffff" />

        <Suspense fallback={null}>
          <CarModel color={activeColor} />
          <ContactShadows
            position={[0, -1.42, 0]}
            opacity={0.55}
            scale={12}
            blur={3}
            far={6}
            color="#000022"
          />
          <Environment preset="sunset" />
        </Suspense>

        <OrbitControls
          enablePan={false}
          minPolarAngle={0.2}
          maxPolarAngle={Math.PI / 2 - 0.05}
          minDistance={2.5}
          maxDistance={10}
        />
      </Canvas>

      {/* Color picker overlay */}
      <div style={{
        position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 8, background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(10px)', borderRadius: 40,
        padding: '8px 14px', border: '1px solid var(--border)',
      }}>
        {COLORS.map(({ label, hex }) => (
          <motion.button
            key={hex}
            title={label}
            onClick={() => setActiveColor(hex)}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            style={{
              width: 22, height: 22, borderRadius: '50%',
              background: hex, border: activeColor === hex ? '2px solid #fff' : '2px solid transparent',
              cursor: 'pointer', outline: 'none', padding: 0,
              boxShadow: activeColor === hex ? '0 0 8px rgba(255,255,255,0.4)' : 'none',
              transition: 'border 0.15s',
            }}
          />
        ))}
      </div>

      {/* Drag hint */}
      <div style={{
        position: 'absolute', top: 14, right: 16,
        fontSize: 11, color: 'rgba(255,255,255,0.35)',
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        🖱 Drag to rotate · Scroll to zoom
      </div>
    </div>
  )
}
