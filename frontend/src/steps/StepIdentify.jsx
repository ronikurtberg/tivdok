import { Suspense } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, AlertCircle, ArrowLeft, ArrowRight } from 'lucide-react'
import CarViewer3D from '../components/CarViewer3D.jsx'

const CONFIDENCE_COLOR = {
  high: 'var(--green)',
  medium: 'var(--yellow)',
  low: 'var(--red)',
  not_found: 'var(--muted2)',
}

const CONFIDENCE_LABEL = {
  high: 'Official data',
  medium: 'Inferred',
  low: 'Uncertain',
  not_found: 'Not found',
}

function ConfidenceDot({ level = 'high' }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 600,
      color: CONFIDENCE_COLOR[level],
      background: `${CONFIDENCE_COLOR[level]}18`,
      border: `1px solid ${CONFIDENCE_COLOR[level]}44`,
      borderRadius: 20, padding: '2px 8px',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: CONFIDENCE_COLOR[level], display: 'inline-block' }} />
      {CONFIDENCE_LABEL[level]}
    </span>
  )
}

function FieldRow({ label, value, confidence = 'high' }) {
  if (!value) return null
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '11px 0', borderBottom: '1px solid var(--border)',
    }}>
      <div>
        <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>
          {label}
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{value}</div>
      </div>
      <ConfidenceDot level={confidence} />
    </div>
  )
}

export default function StepIdentify({ carData, onApprove, onBack }) {
  if (!carData) return null

  const fields = [
    { label: 'Make', value: `${carData.manufacturer_heb} (${carData.manufacturer_en})` },
    { label: 'Model', value: carData.commercial_name || carData.model_en, extra: carData.model_heb ? ` · ${carData.model_heb}` : '' },
    { label: 'Trim level', value: carData.trim || null },
    { label: 'Year', value: carData.year },
    { label: 'Color', value: carData.color_heb ? `${carData.color_heb} (${carData.color_en || ''})` : carData.color_en },
    { label: 'Fuel type', value: carData.fuel_type_heb ? `${carData.fuel_type_heb} (${carData.fuel_type_en || ''})` : carData.fuel_type_en },
    { label: 'Ownership type', value: carData.ownership_type || null },
    { label: 'First on road', value: carData.first_registration || null },
    { label: 'Last annual test', value: carData.last_test_date || null },
    { label: 'License valid until', value: carData.license_expiry || null },
    { label: 'Front tires', value: carData.tire_front || null },
    { label: 'Rear tires', value: carData.tire_rear || null },
    { label: 'VIN / Chassis', value: carData.vin || null },
  ]

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(59,130,246,0.06) 0%, transparent 60%), var(--bg)',
      padding: '20px 24px 80px',
    }}>
      <div style={{ maxWidth: 1060, margin: '0 auto' }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
            <button onClick={onBack} className="btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '6px 12px' }}>
              <ArrowLeft size={14} /> Back
            </button>
            <div style={{ fontSize: 11, color: 'var(--accent2)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Step 2 — Car Identified</div>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.8, marginBottom: 4 }}>
            We found your car.
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>
            Data from the Israeli Ministry of Transport — review and confirm.
          </p>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, alignItems: 'start' }}>

          {/* 3D viewer */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            style={{
              background: 'linear-gradient(160deg, #0d1117 0%, #0a0f1e 100%)',
              borderRadius: 24,
              border: '1px solid var(--border)',
              height: 280,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <CarViewer3D carInfo={carData} />

            {/* Plate badge */}
            <div style={{
              position: 'absolute', top: 16, left: 16,
              background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)',
              borderRadius: 10, padding: '8px 14px', border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2, letterSpacing: '0.06em' }}>LICENSE PLATE</div>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 5, color: '#fff', fontFamily: 'monospace' }}>
                {carData.plate}
              </div>
            </div>

            {/* Confidence indicator */}
            <div style={{
              position: 'absolute', bottom: 16, right: 16,
              background: 'rgba(34,197,94,0.15)', backdropFilter: 'blur(10px)',
              borderRadius: 10, padding: '8px 14px', border: '1px solid rgba(34,197,94,0.3)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <CheckCircle2 size={16} color="var(--green)" />
              <div>
                <div style={{ fontSize: 10, color: 'var(--green)', letterSpacing: '0.06em' }}>CONFIDENCE</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>High — Official Registry</div>
              </div>
            </div>
          </motion.div>

          {/* Fields panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="card"
            style={{ padding: '18px 22px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>
                  {carData.manufacturer_en} {carData.year}
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 14 }}>
                  {carData.commercial_name || carData.model_en}
                  {carData.body_type_en ? ` · ${carData.body_type_en}` : ''}
                </div>
              </div>
              <div style={{
                background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)',
                borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 700, color: 'var(--accent2)',
              }}>
                Ministry of Transport
              </div>
            </div>

            {fields.map(({ label, value, extra }) =>
              value ? <FieldRow key={label} label={label} value={`${value}${extra || ''}`} confidence="high" /> : null
            )}

            <div style={{ marginTop: 20, padding: '12px 14px', background: 'rgba(59,130,246,0.07)', borderRadius: 10, border: '1px solid rgba(59,130,246,0.2)', fontSize: 13, color: 'var(--muted)' }}>
              <AlertCircle size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
              All data sourced directly from Israel's open government registry.
              Private owner information is protected by law.
            </div>

            <motion.button
              className="btn-primary"
              onClick={() => onApprove(carData)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{ width: '100%', marginTop: 20, padding: 14, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 12 }}
            >
              Looks right — Continue <ArrowRight size={16} />
            </motion.button>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
