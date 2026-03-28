import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, ChevronDown, ChevronUp, Save, RotateCcw } from 'lucide-react'
import axios from 'axios'

function PriceOption({ tier, price, label, reason, tag, tagColor, recommended }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: recommended ? 'rgba(59,130,246,0.08)' : 'var(--surface)',
        border: `1px solid ${recommended ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 16,
        padding: '20px 24px',
        position: 'relative',
        boxShadow: recommended ? '0 0 24px rgba(59,130,246,0.15)' : 'none',
      }}
    >
      {recommended && (
        <div style={{
          position: 'absolute', top: -12, left: 20,
          background: 'var(--accent)', color: '#fff',
          fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
          padding: '3px 12px', borderRadius: 20,
        }}>
          ⭐ RECOMMENDED
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{tier}</div>
          <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: -1, color: recommended ? 'var(--accent2)' : '#fff' }}>
            ₪{price.toLocaleString()}
          </div>
        </div>
        <span style={{
          fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
          background: `${tagColor}22`, color: tagColor, border: `1px solid ${tagColor}44`,
        }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>{reason}</div>
      {tag && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted2)', fontStyle: 'italic' }}>{tag}</div>
      )}
    </motion.div>
  )
}

// Yad2-style depreciation model
function buildPriceOptions(car, market, history, adjustments = {}) {
  const m = market?.market
  const median = m?.median_price
  const avg = m?.avg_price
  const officialPrice = market?.official_price

  const km = Number(car?.km) || 0
  const year = Number(car?.year) || new Date().getFullYear()
  const age = new Date().getFullYear() - year
  const hand = Number(car?.hand) || 1
  const avgKm = m?.avg_km || (age * 15000) // 15k/yr expected

  // Base: weighted market median > avg > official
  let base = median || avg || officialPrice || null
  if (!base) return null

  const factors = []

  // ── 1. Mileage adjustment (Yad2 uses ~₪0.15–0.20 per km delta) ──
  const kmDelta = km - avgKm
  const kmAdjust = -Math.round(kmDelta * 0.18 / 500) * 500  // ₪0.18/km
  if (Math.abs(kmDelta) > 5000) {
    factors.push({
      label: 'Mileage vs market avg',
      value: kmAdjust,
      detail: `${km.toLocaleString()} km vs ${Math.round(avgKm).toLocaleString()} km avg (Δ${kmDelta > 0 ? '+' : ''}${Math.round(kmDelta / 1000)}k km)`,
      sign: kmAdjust >= 0 ? 1 : -1,
    })
  }

  // ── 2. Hand / owner count ──
  let handAdjust = 0
  if (hand === 1) { handAdjust = Math.round(base * 0.04 / 500) * 500; factors.push({ label: '1st owner', value: handAdjust, detail: 'First owner premium +4%', sign: 1 }) }
  else if (hand === 2) { handAdjust = Math.round(base * 0.01 / 500) * 500; factors.push({ label: '2nd owner', value: handAdjust, detail: 'Second owner +1%', sign: 1 }) }
  else if (hand === 3) { handAdjust = -Math.round(base * 0.02 / 500) * 500; factors.push({ label: '3rd owner', value: handAdjust, detail: 'Third owner −2%', sign: -1 }) }
  else if (hand >= 4) { handAdjust = -Math.round(base * 0.05 / 500) * 500; factors.push({ label: `${hand}th+ owner`, value: handAdjust, detail: '4th+ owner −5%', sign: -1 }) }

  // ── 3. Original ownership (rental/leasing history) ──
  let originalOwnershipAdjust = 0
  if (adjustments.originalOwnership === 'rental') {
    originalOwnershipAdjust = -Math.round(base * 0.07 / 500) * 500
    factors.push({ label: 'Original: rental', value: originalOwnershipAdjust, detail: 'Was a rental car −7%', sign: -1 })
  } else if (adjustments.originalOwnership === 'leasing') {
    originalOwnershipAdjust = -Math.round(base * 0.04 / 500) * 500
    factors.push({ label: 'Original: leasing', value: originalOwnershipAdjust, detail: 'Was a lease car −4%', sign: -1 })
  }

  // ── 4. Accident history ──
  let accidentAdjust = 0
  if (adjustments.hasAccident) {
    accidentAdjust = -Math.round(base * 0.12 / 500) * 500
    factors.push({ label: 'Accident history', value: accidentAdjust, detail: 'Known accident −12%', sign: -1 })
  }

  // ── 5. History quality (from gov tests) ──
  let historyAdjust = 0
  if (history?.issues?.length > 0) {
    historyAdjust = -Math.round(base * 0.03 / 500) * 500
    factors.push({ label: 'History issues', value: historyAdjust, detail: `${history.issues.length} flag(s) detected −3%`, sign: -1 })
  } else if (history && history.issues?.length === 0) {
    historyAdjust = Math.round(base * 0.02 / 500) * 500
    factors.push({ label: 'Clean history', value: historyAdjust, detail: 'No issues found +2%', sign: 1 })
  }

  // ── 6. GPS system ──
  let gpsAdjust = 0
  if (adjustments.hasGps) {
    gpsAdjust = Math.round(base * 0.01 / 500) * 500
    factors.push({ label: 'GPS system', value: gpsAdjust, detail: 'Has GPS +1%', sign: 1 })
  }

  const totalAdjust = kmAdjust + handAdjust + originalOwnershipAdjust + accidentAdjust + historyAdjust + gpsAdjust
  const fair = Math.round((base + totalAdjust) / 500) * 500
  const fast = Math.round((fair * 0.91) / 500) * 500
  const premium = Math.round((fair * 1.08) / 500) * 500

  return { fast, fair, premium, base, factors, totalAdjust, m }
}

export default function StepPrice({ car, market, history, onNext, onRestart }) {
  const [planOpen, setPlanOpen] = useState(false)
  const [adjOpen, setAdjOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [adjustments, setAdjustments] = useState({
    originalOwnership: 'private', // 'private' | 'rental' | 'leasing'
    hasAccident: false,
    hasGps: false,
  })
  const setAdj = (k, v) => setAdjustments(a => ({ ...a, [k]: v }))
  const options = buildPriceOptions(car, market, history, adjustments)
  const plan = market?.selling_plan

  const handleSave = async () => {
    try {
      const payload = {
        manufacturer: car?.manufacturer_en || '',
        model: car?.commercial_name || car?.model_en || '',
        year: Number(car?.year) || 0,
        km: Number(car?.km) || 0,
        hand: Number(car?.hand) || 1,
        color: car?.color_en || null,
        gear_box: car?.gear_box || null,
        engine_type: car?.fuel_type_en || null,
        engine_volume: car?.engine_volume ? Number(car.engine_volume) : null,
        body_type: car?.body_type_en || null,
        asking_price: options?.fair?.price || null,
        description: car?.description || null,
      }
      await axios.post('/api/cars', { car: payload })
      setSaved(true)
    } catch {}
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f5ff', padding: '0 0 100px' }}>

      {/* Top bar */}
      <div style={{
        background: '#fff', padding: '14px 20px',
        borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ fontWeight: 800, fontSize: 20, color: '#111827' }}>💰 המחיר שלך</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
          מבוסס על {market?.market?.count ?? 0} מודעות יד2
          {market?.official_price ? ` · קטלוג ₪${market.official_price.toLocaleString()}` : ''}
        </div>
      </div>

      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {options ? (
          <>
            {/* ── 3 price options ── */}
            {[
              {
                emoji: '⚡', label: 'מכירה מהירה', sublabel: '2–3 שבועות',
                price: options.fast, color: '#16a34a',
                reason: 'מחיר נמוך ב-9% מהשוק — קונים יגיעו מהר.',
              },
              {
                emoji: '✅', label: 'מחיר שוק הוגן', sublabel: '4–8 שבועות',
                price: options.fair, color: '#1d6ef5', recommended: true,
                reason: `מחושב על בסיס ${options.m?.count || 0} מודעות עם ${options.factors.length} התאמות. המחיר המיטבי לרכב שלכם.`,
              },
              {
                emoji: '💎', label: 'מחיר פרמיום', sublabel: '2–4 חודשים',
                price: options.premium, color: '#d97706',
                reason: 'גבוה ב-8% מהשוק — מתאים לרכב במצב מעולה עם היסטוריה נקייה.',
              },
            ].map(({ emoji, label, sublabel, price, color, reason, recommended }) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                className="card"
                style={{
                  border: recommended ? `2px solid ${color}` : '1.5px solid var(--border)',
                  position: 'relative',
                  boxShadow: recommended ? '0 4px 24px rgba(29,110,245,0.12)' : 'none',
                }}
              >
                {recommended && (
                  <div style={{
                    position: 'absolute', top: -13, left: 16,
                    background: color, color: '#fff',
                    fontSize: 12, fontWeight: 800, padding: '3px 14px', borderRadius: 20,
                  }}>⭐ מומלץ</div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--muted)', marginBottom: 2 }}>
                      {emoji} {label}
                    </div>
                    <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: -1, color }}>
                      ₪{price.toLocaleString()}
                    </div>
                  </div>
                  <span style={{
                    background: `${color}18`, color, border: `1px solid ${color}44`,
                    borderRadius: 20, padding: '4px 12px', fontSize: 13, fontWeight: 700, flexShrink: 0,
                  }}>{sublabel}</span>
                </div>
                <div style={{ fontSize: 15, color: 'var(--muted)', lineHeight: 1.5 }}>{reason}</div>
              </motion.div>
            ))}

            {/* ── Collapsible adjustments ── */}
            <button
              className="collapse-header"
              onClick={() => setAdjOpen(v => !v)}
            >
              <span>🔧 כוונון מחיר (תאונות, GPS, ליסינג...)</span>
              {adjOpen ? <ChevronUp size={20} color="var(--muted)" /> : <ChevronDown size={20} color="var(--muted)" />}
            </button>
            <AnimatePresence>
              {adjOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div className="card" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, marginTop: 2, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Ownership history */}
                    <div>
                      <div style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 600, marginBottom: 8 }}>היסטוריית בעלות מקורית</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {[['private', 'פרטי 👤'], ['leasing', 'ליסינג 🏢'], ['rental', 'השכרה 🚗']].map(([val, lbl]) => (
                          <button key={val} onClick={() => setAdj('originalOwnership', val)} style={{
                            flex: 1, borderRadius: 10, padding: '10px 6px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                            border: adjustments.originalOwnership === val ? 'none' : '1.5px solid var(--border)',
                            background: adjustments.originalOwnership === val ? '#1d6ef5' : '#fff',
                            color: adjustments.originalOwnership === val ? '#fff' : '#111827',
                          }}>{lbl}</button>
                        ))}
                      </div>
                    </div>
                    {/* Accident + GPS */}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={() => setAdj('hasAccident', !adjustments.hasAccident)} style={{
                        flex: 1, borderRadius: 12, padding: '14px 10px', cursor: 'pointer', textAlign: 'center',
                        border: adjustments.hasAccident ? '2px solid var(--red)' : '1.5px solid var(--border)',
                        background: adjustments.hasAccident ? 'rgba(220,38,38,0.06)' : '#fff',
                      }}>
                        <div style={{ fontSize: 24, marginBottom: 4 }}>⚠️</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: adjustments.hasAccident ? 'var(--red)' : '#111827' }}>
                          {adjustments.hasAccident ? 'יש תאונה −12%' : 'ללא תאונות'}
                        </div>
                      </button>
                      <button onClick={() => setAdj('hasGps', !adjustments.hasGps)} style={{
                        flex: 1, borderRadius: 12, padding: '14px 10px', cursor: 'pointer', textAlign: 'center',
                        border: adjustments.hasGps ? '2px solid var(--green)' : '1.5px solid var(--border)',
                        background: adjustments.hasGps ? 'rgba(22,163,74,0.06)' : '#fff',
                      }}>
                        <div style={{ fontSize: 24, marginBottom: 4 }}>📍</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: adjustments.hasGps ? 'var(--green)' : '#111827' }}>
                          {adjustments.hasGps ? 'יש GPS +1%' : 'ללא GPS'}
                        </div>
                      </button>
                    </div>
                    {/* Factors breakdown */}
                    {options.factors.length > 0 && (
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600, marginBottom: 4 }}>
                          בסיס: ₪{options.base.toLocaleString()}
                        </div>
                        {options.factors.map((f, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                            <span style={{ color: 'var(--muted)' }}>{f.detail}</span>
                            <span style={{ fontWeight: 700, color: f.sign >= 0 ? 'var(--green)' : 'var(--red)' }}>
                              {f.sign >= 0 ? '+' : ''}₪{f.value.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>אין מספיק נתוני שוק</div>
            <div style={{ fontSize: 15, color: 'var(--muted)' }}>נסו לסרוק את יד2, או בדקו מחירים ידנית.</div>
          </div>
        )}

        {/* Selling plan (collapsible) */}
        {plan && (
          <div>
            <button
              className="collapse-header"
              onClick={() => setPlanOpen(v => !v)}
            >
              <span>📝 תוכנית מכירה מלאה + טיפים</span>
              {planOpen ? <ChevronUp size={20} color="var(--muted)" /> : <ChevronDown size={20} color="var(--muted)" />}
            </button>
            <AnimatePresence>
              {planOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div className="card" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, marginTop: 2, fontSize: 15, color: 'var(--muted)', lineHeight: 1.75 }}>
                    {plan.split('\n').map((line, i) => {
                      if (line.startsWith('# ')) return <h2 key={i} style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 8, marginTop: i > 0 ? 20 : 0 }}>{line.slice(2)}</h2>
                      if (line.startsWith('## ')) return <h3 key={i} style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, marginTop: 16 }}>{line.slice(3)}</h3>
                      if (line.startsWith('- ')) return <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}><span style={{ color: 'var(--accent)', flexShrink: 0, fontWeight: 700 }}>›</span><span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.+?)\*\*/g, '<strong style="color:#111827">$1</strong>') }} /></div>
                      if (line.startsWith('---')) return <div key={i} style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />
                      if (line.trim() === '') return <div key={i} style={{ height: 6 }} />
                      return <p key={i} style={{ marginBottom: 4 }} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#111827">$1</strong>') }} />
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <motion.button
            className="btn-primary"
            onClick={onNext}
            whileTap={{ scale: 0.97 }}
            style={{ width: '100%', padding: '18px', fontSize: 19, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
          >
            דברו עם יועץ AI <ArrowRight size={18} />
          </motion.button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleSave}
              className="btn-ghost"
              disabled={saved}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 15 }}
            >
              <Save size={15} /> {saved ? 'נשמר ✓' : 'שמור'}
            </button>
            <button onClick={onRestart} className="btn-ghost" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 15 }}>
              <RotateCcw size={15} /> התחל מחדש
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
