import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, ArrowLeft, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react'

function FieldRow({ label, value }) {
  if (!value) return null
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '13px 0', borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', textAlign: 'right', maxWidth: '55%' }}>{value}</div>
    </div>
  )
}

export default function StepIdentify({ carData, onApprove, onBack }) {
  const [showDetails, setShowDetails] = useState(false)
  if (!carData) return null

  const make = carData.manufacturer_en || carData.manufacturer_heb || ''
  const model = carData.commercial_name || carData.model_en || ''
  const year = carData.year || ''
  const color = carData.color_heb || carData.color_en || ''
  const fuel = carData.fuel_type_heb || carData.fuel_type_en || ''

  const extraFields = [
    { label: 'גרסה (Trim)', value: carData.trim || null },
    { label: 'סוג בעלות', value: carData.ownership_type || null },
    { label: 'עלייה לכביש', value: carData.first_registration || null },
    { label: 'טסט אחרון', value: carData.last_test_date || null },
    { label: 'תוקף רישיון', value: carData.license_expiry || null },
    { label: 'צמיגים קדמיים', value: carData.tire_front || null },
    { label: 'צמיגים אחוריים', value: carData.tire_rear || null },
    { label: 'VIN / שלדה', value: carData.vin || null },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#f0f5ff', padding: '0 0 100px' }}>

      {/* Top bar */}
      <div style={{
        background: '#fff', padding: '14px 20px',
        display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', padding: '6px 10px', borderRadius: 10,
          fontSize: 22, cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center',
        }}>
          <ArrowLeft size={20} />
        </button>
        <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--text)' }}>הרכב שלך</div>
        <div style={{
          marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 13, color: 'var(--green)', fontWeight: 700,
        }}>
          <CheckCircle2 size={14} /> נתונים רשמיים
        </div>
      </div>

      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Hero card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
          style={{ textAlign: 'center', padding: '32px 24px' }}
        >
          <div style={{ fontSize: 56, marginBottom: 8 }}>🚗</div>
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: -0.8, color: 'var(--text)', marginBottom: 4 }}>
            {make} {model}
          </div>
          <div style={{ fontSize: 20, color: 'var(--accent)', fontWeight: 700, marginBottom: 16 }}>{year}</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
            {color && (
              <span style={{ background: 'var(--surface)', borderRadius: 20, padding: '6px 14px', fontSize: 15, fontWeight: 600 }}>
                🎨 {color}
              </span>
            )}
            {fuel && (
              <span style={{ background: 'var(--surface)', borderRadius: 20, padding: '6px 14px', fontSize: 15, fontWeight: 600 }}>
                ⛽ {fuel}
              </span>
            )}
            {carData.plate && (
              <span style={{ background: '#003DA5', color: '#fff', borderRadius: 20, padding: '6px 14px', fontSize: 15, fontWeight: 800, letterSpacing: 2 }}>
                {carData.plate}
              </span>
            )}
          </div>
        </motion.div>

        {/* Collapsible details */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
          <button
            className="collapse-header"
            onClick={() => setShowDetails(v => !v)}
          >
            <span>📋 פרטים נוספים</span>
            {showDetails ? <ChevronUp size={20} color="var(--muted)" /> : <ChevronDown size={20} color="var(--muted)" />}
          </button>

          <AnimatePresence>
            {showDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ overflow: 'hidden' }}
              >
                <div className="card" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, marginTop: 2 }}>
                  {extraFields.map(({ label, value }) =>
                    <FieldRow key={label} label={label} value={value} />
                  )}
                  <div style={{ marginTop: 14, fontSize: 13, color: 'var(--muted2)', lineHeight: 1.6 }}>
                    🏛️ כל הנתונים מגיעים ממשרד התחבורה הישראלי. פרטי הבעלים מוגנים על פי חוק.
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* CTA */}
        <motion.button
          className="btn-primary"
          onClick={() => onApprove(carData)}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          whileTap={{ scale: 0.97 }}
          style={{ width: '100%', padding: '18px', fontSize: 19, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
        >
          נכון — בואו נמשיך <ArrowRight size={18} />
        </motion.button>

      </div>
    </div>
  )
}
