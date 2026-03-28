import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, AlertTriangle, ArrowRight, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import axios from 'axios'

const BALCAR_URL = 'https://balcar.co.il/?Aff1=GABrand&gad_source=1&gad_campaignid=14123148844&gbraid=0AAAAABUgJY45yoFHpRyxjeh2Xw20kFOxX'

function TimelineItem({ date, result, mileage, note, index }) {
  const passed = result && (result.includes('עבר') || result.includes('תקין') || result === '1' || result?.toLowerCase() === 'passed')
  const isEstimated = note && note.toLowerCase().includes('estimated')
  const color = isEstimated ? 'var(--muted2)' : passed ? 'var(--green)' : result ? 'var(--red)' : 'var(--muted2)'

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
        <div style={{
          width: 12, height: 12, borderRadius: '50%', flexShrink: 0, marginTop: 4,
          background: isEstimated ? 'transparent' : color,
          border: isEstimated ? '1px dashed var(--muted2)' : 'none',
          boxShadow: isEstimated ? 'none' : `0 0 8px ${color}60`,
          boxSizing: 'border-box',
        }} />
        {index < 20 && <div style={{ width: 1, height: 32, background: 'var(--border)' }} />}
      </div>
      <div style={{ paddingBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: isEstimated ? 'var(--muted)' : 'inherit' }}>
          {date ? date.slice(0, 7) : 'Unknown date'}
        </div>
        <div style={{ fontSize: 13, color, fontWeight: 500 }}>
          {isEstimated ? '○ Annual test (estimated)' : passed ? '✓ Passed' : result ? `✗ ${result}` : '— result not recorded'}
        </div>
        {mileage && (
          <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 2 }}>
            {Number(mileage).toLocaleString()} km at test
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default function StepHistory({ plate, onDone, onSkip }) {
  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!plate) { setLoading(false); return }
    axios.get(`/api/history/${plate}`)
      .then(({ data }) => { setHistory(data); setLoading(false) })
      .catch(e => { setError(e.response?.data?.detail || 'History lookup failed'); setLoading(false) })
  }, [plate])

  const [showGovData, setShowGovData] = useState(false)

  return (
    <div style={{ minHeight: '100vh', background: '#f0f5ff', padding: '0 0 100px' }}>

      {/* Top bar */}
      <div style={{
        background: '#fff', padding: '14px 20px',
        borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ fontWeight: 800, fontSize: 20, color: '#111827' }}>📋 היסטוריית הרכב</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
          נתונים רשמיים ממשרד התחבורה
        </div>
      </div>

      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '60px 0' }}>
            <div className="spinner" style={{ width: 44, height: 44, borderWidth: 4 }} />
            <div style={{ color: 'var(--muted)', fontSize: 17, fontWeight: 600 }}>בודק רישומים ממשלתיים…</div>
          </div>
        )}

        {error && (
          <div className="card" style={{ background: 'rgba(220,38,38,0.05)', border: '1.5px solid rgba(220,38,38,0.3)', color: 'var(--red)', fontSize: 16 }}>
            {error}
          </div>
        )}

        {history && !loading && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Issues banner */}
            {history.issues?.length > 0 && (
              <div className="card" style={{ background: '#fffbeb', border: '1.5px solid #fcd34d' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: '#92400e', fontWeight: 800, fontSize: 16 }}>
                  <AlertTriangle size={18} color="#d97706" /> שימו לב
                </div>
                {history.issues.map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, fontSize: 15, marginBottom: 6, color: '#78350f' }}>
                    <AlertTriangle size={15} color="#d97706" style={{ marginTop: 2, flexShrink: 0 }} />
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Positives strip */}
            {history.positives?.length > 0 && (
              <div className="card" style={{ background: 'rgba(22,163,74,0.05)', border: '1.5px solid rgba(22,163,74,0.25)' }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--green)', marginBottom: 10 }}>✅ סימנים חיוביים</div>
                {history.positives.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, marginBottom: 6 }}>
                    <CheckCircle2 size={15} color="var(--green)" flexShrink={0} />
                    <span style={{ color: '#111827' }}>{p}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Timeline */}
            {history.tests?.filter(t => !t.note?.toLowerCase().includes('estimated')).length > 0 && (
              <div className="card">
                <div style={{ fontWeight: 700, fontSize: 16, color: '#111827', marginBottom: 16 }}>
                  🔧 היסטוריית טסטים שנתיים
                </div>
                {history.tests.filter(t => !t.note?.toLowerCase().includes('estimated')).slice(0, 20).map((t, i) => (
                  <TimelineItem key={i} index={i} date={t.date} result={t.result} mileage={t.mileage} note={t.note} />
                ))}
              </div>
            )}

            {history.tests?.filter(t => !t.note?.toLowerCase().includes('estimated')).length === 0 && (
              <div className="card" style={{ textAlign: 'center', padding: '32px 20px' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📂</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 6 }}>אין רישומי טסט מפורטים</div>
                <div style={{ fontSize: 14, color: 'var(--muted)' }}>
                  הנתונים הוסרו מ-data.gov.il — רק תאריך הטסט האחרון מוצג.
                </div>
              </div>
            )}

            {/* Collapsible gov data */}
            {history.vehicle_info && (
              <div>
                <button className="collapse-header" onClick={() => setShowGovData(v => !v)}>
                  <span>🏛️ נתוני רישוי רשמיים</span>
                  {showGovData ? <ChevronUp size={20} color="var(--muted)" /> : <ChevronDown size={20} color="var(--muted)" />}
                </button>
                <AnimatePresence>
                  {showGovData && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
                      <div className="card" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, marginTop: 2 }}>
                        {(() => {
                          const v = history.vehicle_info
                          return [
                            ['סוג בעלות', v.ownership_type],
                            ['עלייה לכביש', v.first_registration],
                            ['טסט אחרון', v.last_test_date],
                            ['תוקף רישיון', v.license_expiry],
                            ['VIN / שלדה', v.vin],
                            ['צמיגים קדמיים', v.tire_front],
                            ['צמיגים אחוריים', v.tire_rear],
                          ].filter(([, val]) => val).map(([label, value]) => (
                            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                              <span style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 500 }}>{label}</span>
                              <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{value}</span>
                            </div>
                          ))
                        })()}
                        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted2)' }}>
                          🏛️ data.gov.il · משרד התחבורה
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Disclaimer */}
            {history.disclaimer && (
              <div style={{ fontSize: 13, color: 'var(--muted2)', padding: '12px 16px', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
                ⚠️ {history.disclaimer}
              </div>
            )}

            {/* Balcar upsell */}
            <a href={BALCAR_URL} target="_blank" rel="noreferrer" style={{
              display: 'flex', alignItems: 'center', gap: 14,
              background: '#fffbeb', border: '1.5px solid #fcd34d',
              borderRadius: 16, padding: '16px', textDecoration: 'none',
            }}>
              <span style={{ fontSize: 32, flexShrink: 0 }}>🛡️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#92400e', marginBottom: 3 }}>
                  קבלו דוח Balcar מלא
                </div>
                <div style={{ fontSize: 14, color: '#78350f', lineHeight: 1.5 }}>
                  תאונות, עיקולים, שרשרת בעלות — שקיפות = קונים יותר רציניים ומחיר גבוה יותר.
                </div>
              </div>
              <ExternalLink size={18} color="#92400e" style={{ flexShrink: 0 }} />
            </a>

          </motion.div>
        )}

        {/* Actions */}
        {!loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <motion.button
              className="btn-primary"
              onClick={() => onDone(history)}
              whileTap={{ scale: 0.97 }}
              style={{ width: '100%', padding: '18px', fontSize: 19, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
            >
              המשך לסריקת שוק <ArrowRight size={18} />
            </motion.button>
            <button onClick={onSkip} className="btn-ghost"
              style={{ width: '100%', padding: '14px', fontSize: 16, borderRadius: 14 }}>
              דלג לשוק
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
