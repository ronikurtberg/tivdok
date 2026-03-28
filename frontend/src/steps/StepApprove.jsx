import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react'

/* ── Main component ─────────────────────────────────────────────────────── */
export default function StepApprove({ car, onConfirm, onBack }) {
  const [showAdvanced, setShowAdvanced] = useState(false)
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
    gear_box: car?.gear_box || 'Automatic',
    horse_power: car?.horse_power ? String(car.horse_power) : '',
    asking_price: '',
    description: '',
  })

  const set = (k) => (v) => setFields(f => ({ ...f, [k]: v }))
  const handleConfirm = () => onConfirm({ ...car, ...fields, plate: car?.plate })

  const make = fields.manufacturer_en
  const model = fields.model_en

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
          cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center',
        }}>
          <ArrowLeft size={20} />
        </button>
        <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--text)' }}>
          {make} {model} · {fields.year}
        </div>
      </div>

      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── KM — most important field ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <div style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 600, marginBottom: 8 }}>
            🛣️ כמה קילומטרים על הרכב? <span style={{ color: 'var(--red)', fontWeight: 700 }}>*</span>
          </div>
          <input
            type="number"
            inputMode="numeric"
            value={fields.km}
            onChange={e => set('km')(e.target.value)}
            placeholder="לדוגמה: 85000"
            style={{
              fontSize: 32, fontWeight: 800, letterSpacing: 1,
              textAlign: 'center', padding: '16px', borderRadius: 14,
              border: `2px solid ${fields.km ? '#1d6ef5' : '#fca5a5'}`,
              color: '#111827', background: '#f7f9ff', width: '100%',
            }}
          />
          {!fields.km && (
            <div style={{ marginTop: 8, fontSize: 14, color: 'var(--red)', fontWeight: 600, textAlign: 'center' }}>
              חובה — הכניסו את ה-ק"מ שמופיע על לוח המחוונים
            </div>
          )}
          {car?.mileage_at_last_test && (
            <div style={{ marginTop: 8, fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
              בטסט האחרון: {Number(car.mileage_at_last_test).toLocaleString()} ק"מ
            </div>
          )}
        </motion.div>

        {/* ── Owner count ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="card"
        >
          <div style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 600, marginBottom: 12 }}>
            👤 מספר בעלים (יד)
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[1, 2, 3, 4, 5].map(n => {
              const active = String(fields.hand) === String(n)
              return (
                <button
                  key={n}
                  onClick={() => set('hand')(String(n))}
                  style={{
                    flex: 1, borderRadius: 12, padding: '14px 4px',
                    fontSize: 20, fontWeight: 900, cursor: 'pointer',
                    border: active ? 'none' : '1.5px solid var(--border)',
                    background: active ? '#1d6ef5' : '#fff',
                    color: active ? '#fff' : '#111827',
                    boxShadow: active ? '0 4px 14px rgba(29,110,245,0.3)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  {n === 5 ? '5+' : n}
                </button>
              )
            })}
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--muted)' }}>
            {fields.hand === '1' ? 'קניתם אותו חדש — הבעלים הראשון' :
             fields.hand === '2' ? 'בעלים שני — בעלים קודם אחד' :
             `יד ${fields.hand} — ${Number(fields.hand) - 1} בעלים קודמים`}
          </div>
        </motion.div>

        {/* ── Transmission ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="card"
        >
          <div style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 600, marginBottom: 12 }}>
            ⚙️ תיבת הילוכים
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { id: 'Automatic', label: 'אוטומט', emoji: '🤖' },
              { id: 'Manual',    label: 'ידני',   emoji: '🕹️' },
              { id: 'CVT',       label: 'CVT',    emoji: '〰️' },
            ].map(o => {
              const active = fields.gear_box === o.id
              return (
                <button
                  key={o.id}
                  onClick={() => set('gear_box')(o.id)}
                  style={{
                    flex: 1, borderRadius: 12, padding: '14px 8px',
                    cursor: 'pointer', textAlign: 'center',
                    border: active ? 'none' : '1.5px solid var(--border)',
                    background: active ? '#1d6ef5' : '#fff',
                    color: active ? '#fff' : '#111827',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{o.emoji}</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{o.label}</div>
                </button>
              )
            })}
          </div>
        </motion.div>

        {/* ── Advanced details (collapsible) ── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12 }}>
          <button
            className="collapse-header"
            onClick={() => setShowAdvanced(v => !v)}
          >
            <span>🔧 פרטים נוספים (אופציונלי)</span>
            {showAdvanced ? <ChevronUp size={20} color="var(--muted)" /> : <ChevronDown size={20} color="var(--muted)" />}
          </button>

          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ overflow: 'hidden' }}
              >
                <div className="card" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, marginTop: 2, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {[
                    { label: 'יצרן', key: 'manufacturer_en', type: 'text' },
                    { label: 'דגם', key: 'model_en', type: 'text' },
                    { label: 'שנה', key: 'year', type: 'number' },
                    { label: 'מנוע (cc)', key: 'engine_volume', type: 'number' },
                    { label: 'כוח סוס (hp)', key: 'horse_power', type: 'number' },
                    { label: 'מחיר מבוקש (₪)', key: 'asking_price', type: 'number' },
                  ].map(({ label, key, type }) => (
                    <div key={key}>
                      <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600, marginBottom: 6 }}>{label}</div>
                      <input
                        type={type}
                        inputMode={type === 'number' ? 'numeric' : 'text'}
                        value={fields[key]}
                        onChange={e => set(key)(e.target.value)}
                        style={{ fontSize: 18, padding: '12px 14px', borderRadius: 12 }}
                      />
                    </div>
                  ))}
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600, marginBottom: 6 }}>הערות מצב / היסטוריה</div>
                    <textarea
                      value={fields.description}
                      onChange={e => set('description')(e.target.value)}
                      placeholder="תאונות, שירות, אביזרים..."
                      rows={3}
                      style={{ fontSize: 16, padding: '12px 14px', borderRadius: 12, resize: 'vertical' }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── CTA ── */}
        <motion.button
          onClick={handleConfirm}
          disabled={!fields.km}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          whileTap={{ scale: 0.97 }}
          style={{
            width: '100%',
            background: fields.km ? '#1d6ef5' : '#c7d8ff',
            border: 'none', borderRadius: 16, padding: '18px',
            fontSize: 19, fontWeight: 800, color: '#fff',
            cursor: fields.km ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            boxShadow: fields.km ? '0 6px 24px rgba(29,110,245,0.35)' : 'none',
            transition: 'all 0.2s',
          }}
        >
          {fields.km
            ? <>המשך לניתוח שוק <ArrowRight size={18} /></>
            : <>הכניסו קילומטרים כדי להמשיך</>
          }
        </motion.button>

      </div>
    </div>
  )
}
