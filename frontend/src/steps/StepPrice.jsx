import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, ChevronDown, ChevronUp, Save, RotateCcw, ExternalLink, Info } from 'lucide-react'
import axios from 'axios'

const BALCAR_URL = 'https://balcar.co.il/?Aff1=GABrand&gad_source=1&gad_campaignid=14123148844&gbraid=0AAAAABUgJY45yoFHpRyxjeh2Xw20kFOxX'

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
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(59,130,246,0.07) 0%, transparent 60%), var(--bg)',
      padding: '40px 24px 100px',
    }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 13, color: 'var(--accent2)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Step 7 — Your Ideal Price
          </div>
          <h1 style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1.2, marginBottom: 8 }}>
            Here's what your car is worth.
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 15 }}>
            Based on {market?.market?.count ?? 0} live Yad2 listings
            {market?.official_price ? `, official catalog price ₪${market.official_price.toLocaleString()}` : ''}
            {history ? ', and your vehicle history' : ''}.
          </p>
        </motion.div>

        {options ? (
          <>
            {/* Interactive adjustment panel */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Info size={14} color="var(--accent2)" /> Adjust your price factors
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                {/* Original ownership */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Original ownership history</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[['private', 'Private 👤'], ['leasing', 'Leasing 🏢 −4%'], ['rental', 'Rental 🚗 −7%']].map(([val, lbl]) => (
                      <button key={val} onClick={() => setAdj('originalOwnership', val)} style={{
                        flex: 1, border: 'none', borderRadius: 8, padding: '7px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        background: adjustments.originalOwnership === val ? 'rgba(59,130,246,0.2)' : 'var(--surface2)',
                        color: adjustments.originalOwnership === val ? 'var(--accent2)' : 'var(--muted)',
                        outline: adjustments.originalOwnership === val ? '1px solid var(--accent2)' : '1px solid transparent',
                      }}>{lbl}</button>
                    ))}
                  </div>
                </div>
                {/* Accident toggle */}
                <button onClick={() => setAdj('hasAccident', !adjustments.hasAccident)} style={{
                  border: 'none', borderRadius: 8, padding: '10px 14px', cursor: 'pointer', textAlign: 'left',
                  background: adjustments.hasAccident ? 'rgba(239,68,68,0.12)' : 'var(--surface2)',
                  outline: adjustments.hasAccident ? '1px solid rgba(239,68,68,0.5)' : '1px solid transparent',
                }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>ACCIDENT HISTORY</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: adjustments.hasAccident ? 'var(--red)' : 'var(--muted2)' }}>
                    {adjustments.hasAccident ? '⚠️ Has accident −12%' : '✓ No accidents'}
                  </div>
                </button>
                {/* GPS toggle */}
                <button onClick={() => setAdj('hasGps', !adjustments.hasGps)} style={{
                  border: 'none', borderRadius: 8, padding: '10px 14px', cursor: 'pointer', textAlign: 'left',
                  background: adjustments.hasGps ? 'rgba(16,185,129,0.1)' : 'var(--surface2)',
                  outline: adjustments.hasGps ? '1px solid rgba(16,185,129,0.4)' : '1px solid transparent',
                }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>GPS SYSTEM</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: adjustments.hasGps ? 'var(--green)' : 'var(--muted2)' }}>
                    {adjustments.hasGps ? '📍 Has GPS +1%' : '— No GPS'}
                  </div>
                </button>
              </div>
              {/* Factors breakdown */}
              {options.factors.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>ADJUSTMENT BREAKDOWN — base ₪{options.base.toLocaleString()}</div>
                  {options.factors.map((f, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                      <span style={{ color: 'var(--muted)' }}>{f.detail}</span>
                      <span style={{ fontWeight: 700, color: f.sign >= 0 ? 'var(--green)' : 'var(--red)', fontVariantNumeric: 'tabular-nums' }}>
                        {f.sign >= 0 ? '+' : ''}₪{f.value.toLocaleString()}
                      </span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 4, fontWeight: 700, fontSize: 14 }}>
                    <span>Fair market value</span>
                    <span style={{ color: 'var(--accent2)' }}>₪{options.fair.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
              <PriceOption
                tier="Quick Sale" price={options.fast} label="2–3 weeks" tagColor="var(--green)"
                reason={`Priced ~9% below fair value. Buyers will act fast. Best if you need money quickly.`}
                tag={`vs market median: ${options.fast > (options.m?.median_price || 0) ? '+' : ''}${Math.round(((options.fast - (options.m?.median_price || options.fair)) / (options.m?.median_price || options.fair)) * 100)}%`}
              />
              <PriceOption
                tier="Fair Market" price={options.fair} label="4–8 weeks" tagColor="var(--accent2)" recommended
                reason={`Based on ${options.m?.count || 0} live listings with ${options.factors.length} adjustments applied. This is the optimal asking price for your specific car.`}
                tag={market?.official_price ? `Official catalog price: ₪${market.official_price.toLocaleString()}` : null}
              />
              <PriceOption
                tier="Premium Ask" price={options.premium} label="2–4 months" tagColor="var(--yellow)"
                reason={`~8% above fair value. Works if your car has exceptional condition, full service history, or desirable extras.`}
                tag={`Leave room to negotiate down to ₪${Math.round((options.premium * 0.95) / 500) * 500}`}
              />
            </div>
          </>
        ) : (
          <div style={{
            padding: '32px', borderRadius: 16, textAlign: 'center',
            border: '1px dashed var(--border)', color: 'var(--muted)', marginBottom: 28,
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
            <div style={{ fontSize: 16, marginBottom: 8 }}>Not enough market data for a precise estimate.</div>
            <div style={{ fontSize: 14, color: 'var(--muted2)' }}>
              Try running the market scan, or check Yad2 manually for comparable listings.
            </div>
          </div>
        )}

        {/* Key factors */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>📋 Key factors in this estimate</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Your mileage', value: car?.km ? `${Number(car.km).toLocaleString()} km` : '—' },
              { label: 'Market median', value: market?.market?.median_price ? `₪${Math.round(market.market.median_price).toLocaleString()}` : '—' },
              { label: 'Market avg', value: market?.market?.avg_price ? `₪${Math.round(market.market.avg_price).toLocaleString()}` : '—' },
              { label: 'Official catalog', value: market?.official_price ? `₪${market.official_price.toLocaleString()}` : 'Not found' },
              { label: 'Test records', value: history ? `${history.test_count ?? 0} found` : 'Not checked' },
              { label: 'History issues', value: history?.issues?.length ? `${history.issues.length} flagged` : history ? 'None ✓' : '—' },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{label}</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Balcar upsell — inline compact */}
        {!history && (
          <a
            href={BALCAR_URL}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20,
              background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.03))',
              border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: 14, padding: '14px 18px', textDecoration: 'none',
            }}
          >
            <span style={{ fontSize: 28, flexShrink: 0 }}>🛡️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--yellow)' }}>Boost your price with a Balcar report</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                Buyers trust cars with a verified report. Accidents, liens, full ownership history — adds credibility and lets you ask more.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700, color: 'var(--yellow)', flexShrink: 0 }}>
              Get it <ExternalLink size={12} />
            </div>
          </a>
        )}

        {/* Selling plan from AI/rule-based */}
        {plan && (
          <div className="card" style={{ marginBottom: 20 }}>
            <button
              onClick={() => setPlanOpen(v => !v)}
              style={{
                background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: 0, fontWeight: 700, fontSize: 15,
              }}
            >
              📝 Full Selling Plan & Negotiation Tips
              {planOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <AnimatePresence>
              {planOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{ marginTop: 16, fontSize: 13, color: 'var(--muted)', lineHeight: 1.75 }}>
                    {plan.split('\n').map((line, i) => {
                      if (line.startsWith('# ')) return <h2 key={i} style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 8, marginTop: i > 0 ? 20 : 0 }}>{line.slice(2)}</h2>
                      if (line.startsWith('## ')) return <h3 key={i} style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, marginTop: 16 }}>{line.slice(3)}</h3>
                      if (line.startsWith('- ')) return <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}><span style={{ color: 'var(--accent2)', flexShrink: 0 }}>›</span><span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.+?)\*\*/g, '<strong style="color:#fff">$1</strong>') }} /></div>
                      if (line.startsWith('---')) return <div key={i} style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />
                      if (line.trim() === '') return <div key={i} style={{ height: 6 }} />
                      return <p key={i} style={{ marginBottom: 4 }} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#fff">$1</strong>') }} />
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={handleSave}
            className="btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            disabled={saved}
          >
            <Save size={14} /> {saved ? 'Saved ✓' : 'Save to Garage'}
          </button>
          <button onClick={onRestart} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RotateCcw size={14} /> Start over
          </button>
          <motion.button
            className="btn-primary"
            onClick={onNext}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{ flex: 1, padding: 14, fontSize: 15, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 24px rgba(59,130,246,0.3)' }}
          >
            See Autopilot Mode <ArrowRight size={16} />
          </motion.button>
        </div>
      </div>
    </div>
  )
}
