import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Upload, X, ChevronRight, Car, Fuel, Palette, Calendar, Gauge, MapPin } from 'lucide-react'
import axios from 'axios'
import CarViewer3D from '../components/CarViewer3D.jsx'

function PlateInput({ value, onChange, onSubmit, loading }) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit() }}
      style={{ display: 'flex', gap: 10, maxWidth: 400 }}
    >
      <div style={{ position: 'relative', flex: 1 }}>
        {/* Israeli plate style */}
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: 36, background: '#003DA5',
          borderRadius: '8px 0 0 8px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', zIndex: 2,
        }}>
          <span style={{ color: '#f4c430', fontSize: 12, fontWeight: 800, letterSpacing: 0.5 }}>🇮🇱</span>
        </div>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="12-345-67"
          maxLength={10}
          disabled={loading}
          style={{
            paddingLeft: 46, letterSpacing: 3, fontWeight: 700, fontSize: 18,
            textTransform: 'uppercase', borderRadius: 8,
            background: 'var(--surface2)', border: '1px solid var(--border)',
            height: 52,
          }}
        />
      </div>
      <button
        type="submit"
        className="btn-primary"
        disabled={loading || !value.trim()}
        style={{ height: 52, paddingInline: 24, fontSize: 15 }}
      >
        {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : <Search size={18} />}
      </button>
    </form>
  )
}

function CarInfoCard({ info, onAnalyze }) {
  const fields = [
    { icon: Car, label: 'Make / Model', value: `${info.manufacturer_en} · ${info.commercial_name || info.model_en}` },
    { icon: Calendar, label: 'Year', value: info.year },
    { icon: Palette, label: 'Color', value: info.color_heb ? `${info.color_en || ''} (${info.color_heb})` : info.color_en },
    { icon: Fuel, label: 'Fuel', value: info.fuel_type_heb ? `${info.fuel_type_en || ''} (${info.fuel_type_heb})` : info.fuel_type_en },
    { icon: Gauge, label: 'Engine', value: info.engine_volume ? `${info.engine_volume} cc` : null },
    { icon: Car, label: 'Body', value: info.body_type_heb ? `${info.body_type_en || ''} (${info.body_type_heb})` : info.body_type_en },
    { icon: MapPin, label: 'Registered', value: info.city },
    { icon: Car, label: 'Hand', value: info.hand ? `${info.hand}st owner` : null },
  ].filter(f => f.value)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}
    >
      {/* 3D viewer */}
      <div style={{
        background: 'linear-gradient(135deg, #0d1117 0%, #0f172a 100%)',
        borderRadius: 20, border: '1px solid var(--border)',
        height: 380, overflow: 'hidden', position: 'relative',
      }}>
        <CarViewer3D carInfo={info} />
        <div style={{
          position: 'absolute', top: 14, left: 16,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          borderRadius: 8, padding: '6px 12px',
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>License Plate</div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 3, color: '#fff' }}>{info.plate}</div>
        </div>
      </div>

      {/* Info panel */}
      <div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, marginBottom: 4 }}>
            {info.manufacturer_en} {info.year}
          </div>
          <div style={{ fontSize: 16, color: 'var(--muted)' }}>
            {info.commercial_name || info.model_en}
            {info.model_heb && <span style={{ marginLeft: 8, direction: 'rtl', unicodeBidi: 'embed' }}>{info.model_heb}</span>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {fields.map(({ icon: Icon, label, value }) => (
            <div key={label} style={{
              background: 'var(--surface2)', borderRadius: 10,
              padding: '10px 14px', border: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Icon size={12} color="var(--muted)" />
                <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-primary" onClick={onAnalyze} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            Analyze Market
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

export default function PlateScan({ onCarFound }) {
  const [plate, setPlate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [carInfo, setCarInfo] = useState(null)

  const handleSearch = async () => {
    if (!plate.trim()) return
    setLoading(true)
    setError(null)
    setCarInfo(null)
    try {
      const { data } = await axios.get(`/api/plate/${plate.replace(/[-\s]/g, '')}`)
      setCarInfo(data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to look up plate. Check the number and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 32px' }}>
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 40 }}
      >
        <div style={{ fontSize: 13, color: 'var(--accent2)', fontWeight: 600, marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Israeli License Plate Lookup
        </div>
        <h1 style={{ fontSize: 42, fontWeight: 800, letterSpacing: -1.5, marginBottom: 12, lineHeight: 1.1 }}>
          Enter your plate,<br />
          <span style={{ color: 'var(--accent)' }}>know your car.</span>
        </h1>
        <p style={{ fontSize: 16, color: 'var(--muted)', maxWidth: 520 }}>
          Type any Israeli license plate number. We'll instantly pull official vehicle data from the Ministry of Transport and show you a live 3D preview.
        </p>
      </motion.div>

      {/* Search */}
      <div style={{ marginBottom: 40 }}>
        <PlateInput
          value={plate}
          onChange={setPlate}
          onSubmit={handleSearch}
          loading={loading}
        />
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              marginTop: 12, color: 'var(--red)', fontSize: 14,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8, padding: '10px 14px', maxWidth: 400,
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <X size={14} /> {error}
          </motion.div>
        )}
      </div>

      {/* Result */}
      <AnimatePresence>
        {carInfo && (
          <CarInfoCard
            info={carInfo}
            onAnalyze={() => onCarFound(carInfo)}
          />
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!carInfo && !loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{
            marginTop: 60, textAlign: 'center', color: 'var(--muted2)',
            border: '1px dashed var(--border)', borderRadius: 20, padding: '60px 40px',
          }}
        >
          <div style={{ fontSize: 64, marginBottom: 16 }}>🚗</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--muted)', marginBottom: 8 }}>
            Enter any Israeli plate number above
          </div>
          <div style={{ fontSize: 14 }}>
            Example: <span style={{ fontFamily: 'monospace', letterSpacing: 2 }}>12-345-67</span> or <span style={{ fontFamily: 'monospace', letterSpacing: 2 }}>123-45-678</span>
          </div>
        </motion.div>
      )}
    </div>
  )
}
