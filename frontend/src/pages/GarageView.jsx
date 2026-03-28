import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2, RefreshCw, Car } from 'lucide-react'
import axios from 'axios'
import CarViewer3D from '../components/CarViewer3D.jsx'

function CarCard({ car, index, onDelete, onSelect, selected }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25 }}
      onClick={() => onSelect(index)}
      style={{
        background: selected ? 'var(--surface2)' : 'var(--surface)',
        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 14, padding: '16px 18px',
        cursor: 'pointer', transition: 'border-color 0.15s',
        boxShadow: selected ? '0 0 0 1px var(--accent), 0 0 20px var(--accent-glow)' : 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
            {car.year} {car.manufacturer} {car.model}
          </div>
          {car.sub_model && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>{car.sub_model}</div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {car.km != null && (
              <span className="badge badge-blue">{car.km.toLocaleString()} km</span>
            )}
            {car.hand && (
              <span className="badge badge-yellow">Hand {car.hand}</span>
            )}
            {car.engine_type && (
              <span className="badge badge-green">{car.engine_type}</span>
            )}
            {car.body_type && (
              <span className="badge badge-blue">{car.body_type}</span>
            )}
          </div>
        </div>
        <button
          className="btn-danger"
          onClick={(e) => { e.stopPropagation(); onDelete(index) }}
          style={{ padding: '6px 10px', fontSize: 12 }}
          title="Remove car"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {car.asking_price && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>Asking price: </span>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--green)' }}>₪{car.asking_price.toLocaleString()}</span>
        </div>
      )}
      {car.city && (
        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted2)' }}>📍 {car.city}</div>
      )}
    </motion.div>
  )
}

export default function GarageView() {
  const [cars, setCars] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(0)

  const fetchCars = async () => {
    setLoading(true)
    try {
      const { data } = await axios.get('/api/cars')
      setCars(data.cars || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchCars() }, [])

  const handleDelete = async (index) => {
    try {
      await axios.delete(`/api/cars/${index}`)
      await fetchCars()
      setSelected(0)
    } catch {}
  }

  const activeCar = cars[selected]

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, gap: 12 }}>
        <div className="spinner" />
        <span style={{ color: 'var(--muted)' }}>Loading garage…</span>
      </div>
    )
  }

  if (!cars.length) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 72, marginBottom: 20 }}>🏎️</div>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Your garage is empty</div>
        <div style={{ color: 'var(--muted)', fontSize: 15, marginBottom: 24 }}>
          Scan a license plate or run a market analysis to save cars here.
        </div>
        <button className="btn-ghost" onClick={fetchCars} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--accent2)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>My Garage</div>
          <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.8 }}>
            {cars.length} saved car{cars.length !== 1 ? 's' : ''}
          </h1>
        </div>
        <button className="btn-ghost" onClick={fetchCars} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24, alignItems: 'start' }}>
        {/* Car list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <AnimatePresence>
            {cars.map((car, i) => (
              <CarCard
                key={i}
                car={car}
                index={i}
                selected={selected === i}
                onSelect={setSelected}
                onDelete={handleDelete}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* 3D viewer for selected car */}
        {activeCar && (
          <motion.div
            key={selected}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            style={{
              background: 'linear-gradient(135deg, #0d1117 0%, #0f172a 100%)',
              borderRadius: 20, border: '1px solid var(--border)',
              height: 480, position: 'relative', overflow: 'hidden',
            }}
          >
            <CarViewer3D
              carInfo={{
                color_en: activeCar.color,
                body_type_en: activeCar.body_type,
              }}
            />
            {/* Overlay info */}
            <div style={{
              position: 'absolute', top: 16, left: 16,
              background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)',
              borderRadius: 12, padding: '10px 16px', border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Selected</div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>
                {activeCar.year} {activeCar.manufacturer} {activeCar.model}
              </div>
              {activeCar.km != null && (
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                  {activeCar.km.toLocaleString()} km
                </div>
              )}
            </div>

            {activeCar.asking_price && (
              <div style={{
                position: 'absolute', top: 16, right: 16,
                background: 'rgba(34,197,94,0.15)', backdropFilter: 'blur(10px)',
                borderRadius: 12, padding: '10px 16px', border: '1px solid rgba(34,197,94,0.3)',
              }}>
                <div style={{ fontSize: 11, color: 'var(--green)', marginBottom: 2 }}>Asking</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--green)' }}>
                  ₪{activeCar.asking_price.toLocaleString()}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}
