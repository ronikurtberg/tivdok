import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, FileText, Zap, Gauge, Car, Fuel, Settings2, DoorOpen, Palette, Building2, HelpCircle, User, MapPin, Calendar, Shield, Hash } from 'lucide-react'

const FUEL_OPTS = ['Petrol', 'Diesel', 'Hybrid', 'Electric', 'Plug-in Hybrid', 'Gas']
const GEAR_OPTS = ['Automatic', 'Manual', 'CVT']
const BODY_OPTS = ['Sedan', 'Hatchback', 'Crossover', 'SUV', 'Station Wagon', 'Coupe', 'Convertible', 'Van', 'Minivan', 'Pickup']
const COLOR_OPTS = ['White', 'Black', 'Silver', 'Gray', 'Blue', 'Red', 'Green', 'Yellow', 'Orange', 'Brown', 'Gold', 'Burgundy', 'Beige', 'Purple', 'Turquoise']

const COLOR_HEX = {
  White: '#f0f0f0', Black: '#1a1a1a', Silver: '#9ca3af', Gray: '#6b7280',
  Blue: '#3b82f6', Red: '#ef4444', Green: '#22c55e', Yellow: '#eab308',
  Orange: '#f97316', Brown: '#92400e', Gold: '#d97706', Burgundy: '#881337',
  Beige: '#d4b896', Purple: '#a855f7', Turquoise: '#14b8a6',
}

/* ── Source badge themes ────────────────────────────────────────────────── */
const SOURCE = {
  gov:  { label: 'Gov API',   color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', icon: <Building2 size={9} /> },
  pdf:  { label: 'License',   color: '#818cf8', bg: 'rgba(129,140,248,0.12)', border: 'rgba(129,140,248,0.3)', icon: <FileText size={9} /> },
  user: { label: 'You',       color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', icon: <User size={9} /> },
}

/* ── Odometer digit roller ──────────────────────────────────────────────── */
function OdometerDisplay({ value }) {
  const [displayed, setDisplayed] = useState(0)
  const target = parseInt(value) || 0

  // Count-up animation on mount / value change
  useEffect(() => {
    if (target === 0) { setDisplayed(0); return }
    const steps = 28
    const stepVal = target / steps
    let cur = 0
    const timer = setInterval(() => {
      cur += stepVal
      if (cur >= target) { setDisplayed(target); clearInterval(timer) }
      else setDisplayed(Math.round(cur))
    }, 32)
    return () => clearInterval(timer)
  }, [target])

  const digits = String(displayed || 0).padStart(7, '0').split('')
  const leadingZeros = digits.findIndex(d => d !== '0')
  const firstSig = leadingZeros === -1 ? digits.length - 1 : leadingZeros

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {/* Outer bezel */}
      <div style={{
        background: 'linear-gradient(180deg, #18181f 0%, #0c0c14 100%)',
        border: '2px solid rgba(99,102,241,0.25)',
        borderRadius: 16,
        padding: '18px 22px 14px',
        boxShadow: '0 0 60px rgba(99,102,241,0.15), inset 0 2px 12px rgba(0,0,0,0.8)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Scanline overlay */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.12) 0px, rgba(0,0,0,0.12) 1px, transparent 1px, transparent 3px)',
          borderRadius: 14,
        }} />
        {/* Top reflection */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 40,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%)',
          borderRadius: '14px 14px 0 0',
        }} />

        <div style={{ display: 'flex', gap: 5, alignItems: 'center', position: 'relative' }}>
          {digits.map((d, i) => {
            const isDim = i < firstSig
            return (
              <motion.div
                key={`${i}-${d}`}
                initial={{ y: -30, opacity: 0, scale: 0.8 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05, type: 'spring', stiffness: 260, damping: 18 }}
                style={{
                  width: 52, height: 76,
                  background: isDim
                    ? 'linear-gradient(180deg, #0e0e16 0%, #0a0a12 100%)'
                    : 'linear-gradient(180deg, #14141f 0%, #0e0e1a 50%, #0a0a15 100%)',
                  border: isDim
                    ? '1px solid rgba(255,255,255,0.06)'
                    : '1px solid rgba(99,102,241,0.5)',
                  borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 52, fontWeight: 900, fontFamily: '"Courier New", monospace',
                  color: isDim ? 'rgba(255,255,255,0.1)' : '#fff',
                  boxShadow: isDim
                    ? 'inset 0 2px 8px rgba(0,0,0,0.6)'
                    : 'inset 0 2px 8px rgba(0,0,0,0.6), 0 0 18px rgba(99,102,241,0.3)',
                  letterSpacing: 0,
                  position: 'relative', overflow: 'hidden',
                  textShadow: isDim ? 'none' : '0 0 20px rgba(99,102,241,0.8)',
                }}
              >
                {/* Digit split line */}
                <div style={{
                  position: 'absolute', top: '50%', left: 3, right: 3,
                  height: 1,
                  background: isDim ? 'rgba(255,255,255,0.04)' : 'rgba(99,102,241,0.4)',
                  boxShadow: isDim ? 'none' : '0 0 4px rgba(99,102,241,0.6)',
                }} />
                {/* Top half fade */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '48%',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%)',
                }} />
                {d}
              </motion.div>
            )
          })}
          <div style={{
            fontSize: 22, fontWeight: 800, color: 'rgba(255,255,255,0.35)',
            marginLeft: 8, fontFamily: 'monospace',
            textShadow: '0 0 12px rgba(99,102,241,0.4)',
          }}>KM</div>
        </div>
      </div>

      {/* Label below */}
      <div style={{
        fontSize: 10, color: 'rgba(255,255,255,0.2)',
        textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 700,
      }}>
        ODOMETER · TOTAL DISTANCE
      </div>
    </div>
  )
}

/* ── Source badge ───────────────────────────────────────────────────────── */
function SourceBadge({ type, tooltip }) {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const ref = useState(null)
  const s = SOURCE[type]
  if (!s) return null

  const handleEnter = (e) => {
    if (!tooltip) return
    const rect = e.currentTarget.getBoundingClientRect()
    setPos({ top: rect.top + window.scrollY - 8, left: rect.left + rect.width / 2 })
    setShow(true)
  }
  const handleLeave = () => setShow(false)
  const handleClick = (e) => {
    if (!tooltip) return
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setPos({ top: rect.top + window.scrollY - 8, left: rect.left + rect.width / 2 })
    setShow(v => !v)
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <div
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onClick={handleClick}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          background: s.bg, border: `1px solid ${s.border}`,
          borderRadius: 6, padding: '2px 6px', cursor: tooltip ? 'help' : 'default',
          userSelect: 'none',
        }}
      >
        <span style={{ color: s.color }}>{s.icon}</span>
        <span style={{ fontSize: 9, color: s.color, fontWeight: 700 }}>{s.label}</span>
      </div>
      <AnimatePresence>
        {show && tooltip && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.13 }}
            style={{
              position: 'fixed',
              top: pos.top,
              left: Math.min(pos.left, window.innerWidth - 300),
              transform: 'translate(-50%, -100%)',
              background: '#0f1117', border: `1px solid ${s.border}`,
              borderRadius: 10, padding: '8px 12px',
              minWidth: 220, maxWidth: 300, zIndex: 9999,
              boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
              pointerEvents: 'none',
            }}
          >
            <div style={{ fontSize: 9, color: s.color, fontWeight: 700, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {type === 'gov' ? '🏛 Israeli Gov Vehicle Registry' : type === 'pdf' ? '📄 Your רישיון רכב (License)' : '✏️ Entered by you'}
            </div>
            <div style={{
              fontFamily: 'monospace', fontSize: 11, color: '#e2e8f0',
              background: `${s.bg}`, borderRadius: 6,
              padding: '5px 7px', lineHeight: 1.6,
              direction: typeof tooltip === 'string' && /[\u0590-\u05FF]/.test(tooltip) ? 'rtl' : 'ltr',
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
              {tooltip}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Inline editable field ───────────────────────────────────────────────── */
function Field({ label, value, onChange, options, type = 'text', hint, sourceType, sourceProof, accentColor = '#6366f1' }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')

  const commit = () => { onChange(draft); setEditing(false) }

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      padding: '13px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
      gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
          {hint && (
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>· {hint}</span>
          )}
        </div>
        {editing ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {options ? (
              <select value={draft} onChange={e => setDraft(e.target.value)} autoFocus style={{ flex: 1, background: '#1a1a2e', border: `1px solid ${accentColor}`, borderRadius: 8, padding: '7px 10px', fontSize: 15, color: '#fff', fontWeight: 700, outline: 'none' }}>
                <option value="">— choose —</option>
                {options.map(o => <option key={o}>{o}</option>)}
              </select>
            ) : (
              <input type={type} value={draft} autoFocus onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && commit()} style={{ flex: 1, background: '#1a1a2e', border: `1px solid ${accentColor}`, borderRadius: 8, padding: '7px 10px', fontSize: 15, color: '#fff', fontWeight: 700, outline: 'none' }} />
            )}
            <motion.button whileTap={{ scale: 0.9 }} onClick={commit} style={{ background: accentColor, border: 'none', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center' }}>
              <Check size={13} />
            </motion.button>
          </div>
        ) : (
          <div style={{ fontSize: 16, fontWeight: 700, color: value ? '#fff' : 'rgba(255,255,255,0.2)' }}>
            {value || '—'}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 2, flexShrink: 0 }}>
        {sourceType && <SourceBadge type={sourceType} tooltip={sourceProof} />}
        {!editing && (
          <motion.button whileHover={{ scale: 1.05 }} onClick={() => { setDraft(value ?? ''); setEditing(true) }} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '3px 8px', fontSize: 11, color: 'rgba(255,255,255,0.35)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            edit
          </motion.button>
        )}
      </div>
    </div>
  )
}

/* ── Section card ────────────────────────────────────────────────────────── */
function Section({ title, subtitle, color, icon, children, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      style={{
        background: '#0d0d18',
        border: `1px solid ${color}22`,
        borderRadius: 20, overflow: 'hidden',
        boxShadow: `0 0 40px ${color}10`,
      }}
    >
      <div style={{
        padding: '16px 20px 14px',
        borderBottom: `1px solid ${color}18`,
        display: 'flex', alignItems: 'center', gap: 10,
        background: `linear-gradient(90deg, ${color}0c, transparent)`,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: `${color}20`, border: `1px solid ${color}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0,
        }}>{icon}</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{title}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{subtitle}</div>
        </div>
      </div>
      <div style={{ padding: '0 20px 6px' }}>{children}</div>
    </motion.div>
  )
}

/* ── Color ring picker ───────────────────────────────────────────────────── */
function ColorPicker({ value, onChange, sourceType, sourceProof }) {
  return (
    <div style={{ padding: '13px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Color</span>
          {value && <span style={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>— {value}</span>}
        </div>
        {sourceType && <SourceBadge type={sourceType} tooltip={sourceProof} />}
      </div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        {COLOR_OPTS.map(c => (
          <motion.button key={c} title={c} onClick={() => onChange(c)} whileHover={{ scale: 1.18 }} whileTap={{ scale: 0.88 }} style={{ width: 26, height: 26, borderRadius: '50%', background: COLOR_HEX[c] || '#666', border: value === c ? '3px solid #fff' : '2px solid transparent', cursor: 'pointer', padding: 0, outline: 'none', boxShadow: value === c ? `0 0 12px ${COLOR_HEX[c]}99` : 'none', transition: 'all 0.14s' }} />
        ))}
      </div>
    </div>
  )
}

/* ── Transmission picker ─────────────────────────────────────────────────── */
function TransmissionPicker({ value, onChange }) {
  const opts = [
    { id: 'Automatic', emoji: '⚙️', label: 'Automatic', sub: 'Gear shifts by itself' },
    { id: 'Manual',    emoji: '🕹️', label: 'Manual',    sub: 'Clutch + gear stick' },
    { id: 'CVT',       emoji: '〰️', label: 'CVT',       sub: 'Smooth continuous' },
  ]
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
      {opts.map(o => (
        <motion.button key={o.id} onClick={() => onChange(o.id)} whileTap={{ scale: 0.94 }} style={{
          flex: 1, border: 'none', borderRadius: 12,
          background: value === o.id ? 'linear-gradient(135deg, #6366f1, #3b82f6)' : 'rgba(255,255,255,0.04)',
          border: value === o.id ? 'none' : '1px solid rgba(255,255,255,0.08)',
          color: value === o.id ? '#fff' : 'rgba(255,255,255,0.45)',
          padding: '10px 8px', cursor: 'pointer', textAlign: 'center',
          boxShadow: value === o.id ? '0 4px 18px rgba(99,102,241,0.4)' : 'none',
          transition: 'all 0.18s',
        }}>
          <div style={{ fontSize: 20 }}>{o.emoji}</div>
          <div style={{ fontSize: 12, fontWeight: 800, marginTop: 3 }}>{o.label}</div>
          <div style={{ fontSize: 10, opacity: 0.6, marginTop: 1 }}>{o.sub}</div>
        </motion.button>
      ))}
    </div>
  )
}

/* ── Owner count (hand) picker ───────────────────────────────────────────── */
function OwnerPicker({ value, onChange, fromLicense }) {
  const owners = [
    { n: 1, label: '1st owner', sub: 'Bought new' },
    { n: 2, label: '2nd owner', sub: 'One prev. owner' },
    { n: 3, label: '3rd owner', sub: 'Two prev. owners' },
    { n: 4, label: '4th owner', sub: 'Three prev. owners' },
    { n: 5, label: '5+', sub: 'Many owners' },
  ]
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          How many owners has this car had?
        </span>
        {fromLicense && <SourceBadge type="pdf" tooltip={`Extracted from your license: ${value}${parseInt(value) === 1 ? 'st' : parseInt(value) === 2 ? 'nd' : 'rd'} owner`} />}
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginBottom: 10 }}>
        Count from the very first owner. If you bought it new, you're the 1st. Each resale adds one.
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {owners.map(o => {
          const active = String(value) === String(o.n)
          return (
            <motion.button key={o.n} onClick={() => onChange(String(o.n))} whileTap={{ scale: 0.92 }} style={{
              flex: 1, border: 'none', borderRadius: 12,
              background: active ? 'linear-gradient(135deg, #ec4899, #8b5cf6)' : 'rgba(255,255,255,0.04)',
              border: active ? 'none' : '1px solid rgba(255,255,255,0.08)',
              color: active ? '#fff' : 'rgba(255,255,255,0.35)',
              padding: '9px 4px', cursor: 'pointer', textAlign: 'center',
              boxShadow: active ? '0 4px 16px rgba(139,92,246,0.4)' : 'none',
              transition: 'all 0.18s',
            }}>
              <div style={{ fontSize: 20, fontWeight: 900 }}>{o.n === 5 ? '5+' : o.n}</div>
              <div style={{ fontSize: 9, fontWeight: 700, marginTop: 2, lineHeight: 1.2 }}>{o.label}</div>
              <div style={{ fontSize: 9, opacity: 0.55, marginTop: 1 }}>{o.sub}</div>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

/* ── Main component ─────────────────────────────────────────────────────── */
export default function StepApprove({ car, onConfirm, onBack }) {
  const fromPdf = car?.source === 'license_pdf'

  const [fields, setFields] = useState({
    manufacturer_en: car?.manufacturer_en || '',
    model_en: car?.commercial_name || car?.model_en || '',
    year: String(car?.year || ''),
    color_en: car?.color_en || '',
    fuel_type_en: car?.fuel_type_en || '',
    engine_volume: car?.engine_volume ? String(car.engine_volume) : '',
    body_type_en: car?.body_type_en || '',
    doors: car?.doors ? String(car.doors) : '',
    hand: car?.hand ? String(car.hand) : '1',
    km: car?.mileage_at_last_test ? String(car.mileage_at_last_test) : '',
    gear_box: car?.gear_box || '',
    horse_power: car?.horse_power ? String(car.horse_power) : '',
    asking_price: '',
    description: '',
  })

  const set = (k) => (v) => setFields(f => ({ ...f, [k]: v }))
  const handleConfirm = () => onConfirm({ ...car, ...fields, plate: car?.plate })

  const accentColor = COLOR_HEX[fields.color_en] || '#6366f1'
  const kmNum = parseInt(fields.km) || 0

  return (
    <div style={{
      minHeight: '100vh',
      background: `
        radial-gradient(ellipse 80% 50% at 50% -10%, ${accentColor}14 0%, transparent 55%),
        #080810
      `,
      padding: '28px 20px 100px',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <button onClick={onBack} className="btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14, fontSize: 13 }}>
            <ArrowLeft size={14} /> Back
          </button>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 36, fontWeight: 900, letterSpacing: -1.5, margin: 0 }}>
              {fields.manufacturer_en} <span style={{ color: accentColor }}>{fields.model_en}</span>
            </h1>
            <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.3)', fontWeight: 300 }}>{fields.year}</span>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 5, marginBottom: 0 }}>
            Everything here is editable. Click <span style={{ color: '#fff' }}>edit</span> on any field to correct it.
            Colored badges show <span style={{ color: SOURCE.gov.color }}>gov</span> · <span style={{ color: SOURCE.pdf.color }}>license PDF</span> · <span style={{ color: SOURCE.user.color }}>you</span> as the data source.
          </p>
        </motion.div>

        {/* ── ZONE 1: ODOMETER (Your Info — most important) ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          style={{
            background: 'linear-gradient(180deg, #0d0d1a 0%, #090912 100%)',
            border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: 20, overflow: 'hidden',
            boxShadow: '0 0 50px rgba(245,158,11,0.07)',
          }}
        >
          <div style={{ height: 3, background: 'linear-gradient(90deg, transparent, #f59e0b, transparent)' }} />
          <div style={{ padding: '24px 24px 20px', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
              <Gauge size={14} color="#f59e0b" />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700 }}>Current Mileage</span>
              {fromPdf && car?.mileage_at_last_test && (
                <SourceBadge type="pdf" tooltip={`Mileage at last MOT test: ${car.mileage_at_last_test.toLocaleString()} km\nNote: This was the reading at last test — update if you've driven more.`} />
              )}
            </div>

            <OdometerDisplay value={kmNum} />

            <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 14, overflow: 'hidden' }}>
                <span style={{ padding: '0 14px', fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: 700, borderRight: '1px solid rgba(245,158,11,0.2)' }}>KM</span>
                <input
                  type="number" value={fields.km}
                  onChange={e => set('km')(e.target.value)}
                  placeholder="Enter today's km"
                  style={{ background: 'transparent', border: 'none', outline: 'none', padding: '13px 16px', fontSize: 22, fontWeight: 800, color: fields.km ? '#fff' : 'rgba(255,255,255,0.18)', width: 190, fontFamily: 'monospace', letterSpacing: 2, textAlign: 'center' }}
                />
              </div>
            </div>
            {fromPdf && car?.mileage_at_last_test && (
              <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                Last test was at {car.mileage_at_last_test.toLocaleString()} km — update if you've driven more since
              </div>
            )}
            {!fields.km && (
              <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }} style={{ marginTop: 8, fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>
                ↑ Required — enter the km showing on your dashboard
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* ── ZONE 2: GOV REGISTRY DATA ── */}
        <Section
          title="Government Registry"
          subtitle="Official vehicle record · data.gov.il · verified"
          color={SOURCE.gov.color}
          icon={<Building2 size={15} />}
          delay={0.1}
        >
          <Field label="Make" value={fields.manufacturer_en} onChange={set('manufacturer_en')} sourceType="gov" sourceProof={`tozeret_nm: "${car?.manufacturer_heb || car?.manufacturer_en}"\nkinuy_mishari: "${car?.commercial_name}"`} accentColor={SOURCE.gov.color} />
          <Field label="Model" value={fields.model_en} onChange={set('model_en')} sourceType="gov" sourceProof={`kinuy_mishari: "${car?.commercial_name}"\nramat_gimur (trim): "${car?.trim}"`} accentColor={SOURCE.gov.color} />
          <Field label="Year" value={fields.year} onChange={set('year')} type="number" sourceType="gov" sourceProof={`shnat_yitzur: ${car?.year}`} accentColor={SOURCE.gov.color} />
          <Field label="Fuel" value={fields.fuel_type_en} onChange={set('fuel_type_en')} options={FUEL_OPTS} sourceType={fromPdf ? 'pdf' : 'gov'} sourceProof={fromPdf ? `${car?.fuel_type_heb} (from license)` : `sug_delek_nm: "${car?.fuel_type_heb}"`} accentColor={SOURCE.gov.color} />
          <ColorPicker value={fields.color_en} onChange={set('color_en')} sourceType="gov" sourceProof={`tzeva_rechev: "${car?.color_heb}"\n→ ${car?.color_en}`} />
          <Field label="VIN / Chassis" value={car?.vin || '—'} onChange={() => {}} sourceType="gov" sourceProof={`misgeret: "${car?.vin}"`} accentColor={SOURCE.gov.color} hint="not editable" />
          <Field label="First registered" value={car?.first_registration || '—'} onChange={() => {}} sourceType="gov" sourceProof={`moed_aliya_lakvish: ${car?.first_registration}`} accentColor={SOURCE.gov.color} hint="not editable" />
          <Field label="Ownership type" value={car?.ownership_type === 'פרטי' ? 'Private' : car?.ownership_type || '—'} onChange={() => {}} sourceType="gov" sourceProof={`baalut: "${car?.ownership_type}"\nפרטי = private person · מסחרי = company`} accentColor={SOURCE.gov.color} hint="not editable" />
          <Field label="Last MOT test" value={car?.last_test_date || '—'} onChange={() => {}} sourceType="gov" sourceProof={`mivchan_acharon_dt: ${car?.last_test_date}`} accentColor={SOURCE.gov.color} hint="not editable" />
          <Field label="License expires" value={car?.license_expiry || fields.license_expiry || '—'} onChange={() => {}} sourceType="gov" sourceProof={`tokef_dt: ${car?.license_expiry}`} accentColor={SOURCE.gov.color} hint="not editable" />
          <Field label="Tires" value={car?.tire_front || '—'} onChange={() => {}} sourceType="gov" sourceProof={`zmig_kidmi: ${car?.tire_front}\nzmig_ahori: ${car?.tire_rear}`} accentColor={SOURCE.gov.color} hint="front / rear" />
        </Section>

        {/* ── ZONE 3: LICENSE PDF DATA ── */}
        {fromPdf && (
          <Section
            title="Your License Document"
            subtitle="Scanned from your רישיון רכב PDF · more detail than registry"
            color={SOURCE.pdf.color}
            icon={<FileText size={15} />}
            delay={0.14}
          >
            <Field label="Body style" value={fields.body_type_en} onChange={set('body_type_en')} options={BODY_OPTS} sourceType="pdf" sourceProof={`${car?.body_type_heb} → ${car?.body_type_en}`} accentColor={SOURCE.pdf.color} />
            <Field label="Engine size" value={fields.engine_volume ? `${fields.engine_volume} cc` : ''} onChange={v => set('engine_volume')(v.replace(/\D/g, ''))} sourceType="pdf" sourceProof={`Engine displacement from license:\n${car?.engine_volume} cc`} accentColor={SOURCE.pdf.color} hint="cylinder displacement" />
            <Field label="Horse power" value={fields.horse_power ? `${fields.horse_power} hp` : ''} onChange={v => set('horse_power')(v.replace(/\D/g, ''))} sourceType="pdf" sourceProof={`כנ"ש ${car?.horse_power}\n(kilowatt-horsepower from license)`} accentColor={SOURCE.pdf.color} />
            <Field label="Doors" value={fields.doors} onChange={set('doors')} type="number" sourceType="pdf" sourceProof={`Door count from model line:\n"${car?.doors} ${car?.trim} ${car?.model_en}"`} accentColor={SOURCE.pdf.color} />
            <Field label="City / Address" value={car?.city || '—'} onChange={() => {}} sourceType="pdf" sourceProof={`Registered address city:\n${car?.city}`} accentColor={SOURCE.pdf.color} hint="not editable" />
          </Section>
        )}

        {/* ── ZONE 4: YOUR INFO (not in any system) ── */}
        <Section
          title="Your Info"
          subtitle="Only you know this — not in any database"
          color={SOURCE.user.color}
          icon={<User size={15} />}
          delay={0.18}
        >
          {/* Owner count with plain-language explainer */}
          <div style={{ padding: '13px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <OwnerPicker value={fields.hand} onChange={set('hand')} fromLicense={fromPdf && !!car?.hand} />
          </div>

          {/* Transmission */}
          <div style={{ padding: '13px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Transmission</div>
            <TransmissionPicker value={fields.gear_box} onChange={set('gear_box')} />
          </div>

          <Field label="Your asking price (₪)" value={fields.asking_price} onChange={set('asking_price')} type="number" sourceType="user" hint="optional — we'll suggest one" accentColor={SOURCE.user.color} />
          <Field label="Condition notes" value={fields.description} onChange={set('description')} hint="accidents, service history, extras…" sourceType="user" accentColor={SOURCE.user.color} />
        </Section>

        {/* ── CTA ── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
          <motion.button
            onClick={handleConfirm}
            disabled={!fields.km}
            whileHover={fields.km ? { scale: 1.02 } : {}}
            whileTap={fields.km ? { scale: 0.98 } : {}}
            style={{
              width: '100%',
              background: fields.km ? `linear-gradient(135deg, ${accentColor}, #6366f1)` : 'rgba(255,255,255,0.06)',
              border: 'none', borderRadius: 16, padding: '18px 32px',
              fontSize: 17, fontWeight: 800, color: '#fff',
              cursor: fields.km ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
              boxShadow: fields.km ? `0 8px 40px ${accentColor}55` : 'none',
              transition: 'all 0.25s', letterSpacing: -0.3,
            }}
          >
            {fields.km
              ? <><Check size={18} /> All confirmed — analyse my car <ArrowRight size={16} /></>
              : <>↑ Enter your current mileage to continue</>
            }
          </motion.button>
        </motion.div>

      </div>
    </div>
  )
}
