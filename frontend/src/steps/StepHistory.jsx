import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, AlertTriangle, Info, ArrowRight, SkipForward, ShieldCheck, ClipboardList, ExternalLink, Building2 } from 'lucide-react'
import axios from 'axios'

/* ── Gov source badge with hover tooltip ─────────────────────────────────── */
function GovBadge({ rawField, rawValue }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <div
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(v => !v)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 3, cursor: 'help',
          background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
          borderRadius: 5, padding: '1px 6px',
        }}
      >
        <Building2 size={8} color="#10b981" />
        <span style={{ fontSize: 9, color: '#10b981', fontWeight: 700 }}>Gov API</span>
      </div>
      <AnimatePresence>
        {show && rawField && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            style={{
              position: 'absolute', bottom: 'calc(100% + 6px)', right: 0,
              background: '#0f1117', border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 10, padding: '8px 12px',
              minWidth: 200, maxWidth: 300, zIndex: 200,
              boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
              pointerEvents: 'none',
            }}
          >
            <div style={{ fontSize: 9, color: '#10b981', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              🏛 data.gov.il · resource 053cea08
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>{rawField}</div>
            <div style={{
              fontFamily: 'monospace', fontSize: 12, color: '#e2e8f0',
              background: 'rgba(16,185,129,0.08)', borderRadius: 5, padding: '3px 6px',
              direction: rawValue && /[\u0590-\u05FF]/.test(String(rawValue)) ? 'rtl' : 'ltr',
              wordBreak: 'break-all',
            }}>
              {rawValue ?? '—'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Single gov data row ─────────────────────────────────────────────────── */
function GovField({ label, value, rawField, rawValue }) {
  if (!value && value !== 0) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', gap: 12,
    }}>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', textAlign: 'right' }}>{value}</span>
        <GovBadge rawField={rawField} rawValue={rawValue} />
      </div>
    </div>
  )
}

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

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(34,197,94,0.05) 0%, transparent 60%), var(--bg)',
      padding: '40px 24px 100px',
    }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Step 5 — Vehicle History
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1, marginBottom: 6 }}>
            Checking the car's history
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 15 }}>
            Official data from Israel's Ministry of Transport — annual road tests, odometer readings, and ownership details.
          </p>
        </motion.div>

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '80px 0' }}>
            <div className="spinner" style={{ width: 48, height: 48, borderWidth: 4 }} />
            <div style={{ color: 'var(--muted)', fontSize: 16 }}>Scanning government records…</div>
            <div style={{ fontSize: 13, color: 'var(--muted2)' }}>plate: {plate}</div>
          </div>
        )}

        {error && (
          <div style={{
            padding: '20px 24px', borderRadius: 14, marginBottom: 20,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
            color: 'var(--red)', fontSize: 14,
          }}>
            {error}
          </div>
        )}

        {history && !loading && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>

            {/* Issues banner */}
            {history.issues?.length > 0 && (
              <div style={{
                background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)',
                borderRadius: 14, padding: '14px 18px', marginBottom: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: 'var(--yellow)', fontWeight: 700 }}>
                  <AlertTriangle size={16} /> Watch out
                </div>
                {history.issues.map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, fontSize: 14, marginBottom: 6 }}>
                    <AlertTriangle size={13} color="var(--yellow)" style={{ marginTop: 2, flexShrink: 0 }} />
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Full gov registry card ── */}
            {history.vehicle_info && (
              <div style={{
                background: '#0a0f0a',
                border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: 18, overflow: 'hidden', marginBottom: 20,
                boxShadow: '0 0 40px rgba(16,185,129,0.05)',
              }}>
                {/* Card header */}
                <div style={{
                  padding: '14px 20px', borderBottom: '1px solid rgba(16,185,129,0.12)',
                  background: 'linear-gradient(90deg, rgba(16,185,129,0.07), transparent)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Building2 size={14} color="#10b981" />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>Government Registry Data</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                      data.gov.il · resource 053cea08 · Ministry of Transport · hover <span style={{ color: '#10b981' }}>Gov API</span> badges for proof
                    </div>
                  </div>
                </div>
                <div style={{ padding: '4px 20px 12px' }}>
                  {(() => {
                    const v = history.vehicle_info
                    return (<>
                      <GovField label="Ownership type" value={v.ownership_type} rawField="baalut" rawValue={v.ownership_type} />
                      <GovField label="First registration" value={v.first_registration} rawField="moed_aliya_lakvish" rawValue={v.first_registration} />
                      <GovField label="Last MOT test" value={v.last_test_date} rawField="mivchan_acharon_dt" rawValue={v.last_test_date} />
                      <GovField label="License expires" value={v.license_expiry} rawField="tokef_dt" rawValue={v.license_expiry} />
                      <GovField label="VIN / Chassis" value={v.vin} rawField="misgeret" rawValue={v.vin} />
                      <GovField label="Tires (front)" value={v.tire_front} rawField="zmig_kidmi" rawValue={v.tire_front} />
                      <GovField label="Tires (rear)" value={v.tire_rear} rawField="zmig_ahori" rawValue={v.tire_rear} />
                      <GovField label="Pollution group" value={v.pollution_group != null ? `Group ${v.pollution_group}` : null} rawField="kvutzat_zihum" rawValue={v.pollution_group} />
                    </>)
                  })()}
                </div>
              </div>
            )}

            {/* Positives strip */}
            {history.positives?.length > 0 && (
              <div style={{
                background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)',
                borderRadius: 12, padding: '12px 16px', marginBottom: 20,
                display: 'flex', flexWrap: 'wrap', gap: '6px 20px',
              }}>
                {history.positives.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    <CheckCircle2 size={13} color="var(--green)" />
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Timeline */}
            {history.tests?.length > 0 && (
              <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontWeight: 700, fontSize: 16 }}>
                  <ClipboardList size={16} /> Annual Road Test History
                </div>
                <div style={{ maxHeight: 400, overflowY: 'auto', paddingRight: 8 }}>
                  {history.tests.filter(t => !t.note?.toLowerCase().includes('estimated')).slice(0, 20).map((t, i) => (
                    <TimelineItem key={i} index={i} date={t.date} result={t.result} mileage={t.mileage} note={t.note} />
                  ))}
                </div>
              </div>
            )}

            {history.tests?.filter(t => !t.note?.toLowerCase().includes('estimated')).length === 0 && (
              <div style={{
                padding: '24px', textAlign: 'center', borderRadius: 14,
                border: '1px dashed var(--border)', color: 'var(--muted)', fontSize: 14, marginBottom: 20,
              }}>
                No test records available. The detailed test history dataset was removed from data.gov.il — only the most recent test date from the registry is shown above.
              </div>
            )}

            {/* Disclaimer */}
            <div style={{
              fontSize: 12, color: 'var(--muted2)', padding: '12px 16px',
              background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)',
              marginBottom: 20,
            }}>
              ⚠️ {history.disclaimer}
            </div>

            {/* Balcar upsell */}
            <motion.a
              href={BALCAR_URL}
              target="_blank"
              rel="noreferrer"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              whileHover={{ scale: 1.01 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24,
                background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.04))',
                border: '1px solid rgba(245,158,11,0.35)',
                borderRadius: 16, padding: '18px 22px', textDecoration: 'none',
              }}
            >
              <div style={{ fontSize: 36, flexShrink: 0 }}>🛡️</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--yellow)', marginBottom: 5 }}>
                  Get a full certified Balcar report
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.55 }}>
                  The free government data only shows annual tests. A <strong style={{ color: '#fff' }}>Balcar report</strong> adds:
                  accidents, liens, insurance claims, full ownership chain, and import history.
                  Essential for pricing your car accurately and building buyer trust.
                </div>
              </div>
              <div style={{
                flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)',
                borderRadius: 12, padding: '10px 16px',
              }}>
                <ExternalLink size={16} color="var(--yellow)" />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--yellow)', whiteSpace: 'nowrap' }}>Get Report →</span>
              </div>
            </motion.a>
          </motion.div>
        )}

        {/* Actions */}
        {!loading && (
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={onSkip} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <SkipForward size={14} /> Skip to market
            </button>
            <motion.button
              className="btn-primary"
              onClick={() => onDone(history)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{ flex: 1, padding: 14, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12 }}
            >
              Continue to Market Scan <ArrowRight size={16} />
            </motion.button>
          </div>
        )}
      </div>
    </div>
  )
}
