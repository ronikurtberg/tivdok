import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, CartesianGrid,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, Save, ChevronDown, ChevronUp } from 'lucide-react'
import axios from 'axios'

const FUEL_OPTS = ['Petrol', 'Diesel', 'Hybrid', 'Electric', 'Plug-in Hybrid', 'Gas']
const GEAR_OPTS = ['Automatic', 'Manual', 'CVT']
const BODY_OPTS = ['Sedan', 'Hatchback', 'Crossover', 'SUV', 'Station Wagon', 'Coupe', 'Convertible', 'Van', 'Minivan', 'Pickup']

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function StatCard({ label, value, sub, color }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color: color || 'var(--text)' }}>
        {value ?? '—'}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

function PriceAdvice({ asking, market }) {
  if (!asking || !market?.median_price) return null
  const diff = asking - market.median_price
  const pct = Math.round((diff / market.median_price) * 100)
  const isHigh = diff > market.median_price * 0.08
  const isLow = diff < -market.median_price * 0.08

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 18px', borderRadius: 12,
      background: isHigh ? 'rgba(239,68,68,0.08)' : isLow ? 'rgba(34,197,94,0.08)' : 'rgba(59,130,246,0.08)',
      border: `1px solid ${isHigh ? 'rgba(239,68,68,0.3)' : isLow ? 'rgba(34,197,94,0.3)' : 'rgba(59,130,246,0.3)'}`,
    }}>
      {isHigh ? <TrendingUp size={20} color="var(--red)" /> : isLow ? <TrendingDown size={20} color="var(--green)" /> : <Minus size={20} color="var(--accent)" />}
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>
          {isHigh ? `${pct}% above market median — consider lowering` : isLow ? `${Math.abs(pct)}% below market — good deal positioning` : 'Priced in line with the market'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          Your price: ₪{asking.toLocaleString()} · Market median: ₪{Math.round(market.median_price).toLocaleString()}
        </div>
      </div>
    </div>
  )
}

function PlanSection({ plan }) {
  const [open, setOpen] = useState(true)
  if (!plan) return null

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          background: 'none', border: 'none', color: 'var(--text)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: 0, cursor: 'pointer', marginBottom: open ? 16 : 0,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 18 }}>📋 Selling Plan</span>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <pre style={{
              whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 14,
              color: 'var(--muted)', lineHeight: 1.7,
            }}>
              {plan}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function PriceHistogram({ listings }) {
  if (!listings?.length) return null
  const priced = listings.filter(l => l.price > 0)
  if (priced.length < 3) return null

  const min = Math.min(...priced.map(l => l.price))
  const max = Math.max(...priced.map(l => l.price))
  const buckets = 10
  const step = (max - min) / buckets || 1
  const bins = Array.from({ length: buckets }, (_, i) => ({
    range: `₪${Math.round((min + i * step) / 1000)}k`,
    count: priced.filter(l => l.price >= min + i * step && l.price < min + (i + 1) * step).length,
  }))

  return (
    <div style={{ height: 180 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={bins} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
          <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#9ca3af' }} />
          <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
          <Tooltip
            contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
          />
          <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function ListingsTable({ listings }) {
  const [show, setShow] = useState(10)
  if (!listings?.length) return null
  const visible = listings.slice(0, show)

  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Year', 'Model', 'KM', 'Hand', 'Price', 'City', ''].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--muted)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((l, i) => (
            <tr key={l.listing_id || i} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <td style={{ padding: '9px 10px' }}>{l.year || '—'}</td>
              <td style={{ padding: '9px 10px' }}>{[l.manufacturer_en, l.model_en, l.sub_model].filter(Boolean).join(' ')}</td>
              <td style={{ padding: '9px 10px' }}>{l.km ? l.km.toLocaleString() + ' km' : '—'}</td>
              <td style={{ padding: '9px 10px' }}>{l.hand ?? '—'}</td>
              <td style={{ padding: '9px 10px', fontWeight: 700 }}>{l.price ? '₪' + l.price.toLocaleString() : '—'}</td>
              <td style={{ padding: '9px 10px', color: 'var(--muted)' }}>{l.city_en || '—'}</td>
              <td style={{ padding: '9px 10px' }}>
                <a href={l.url} target="_blank" rel="noreferrer" style={{ fontSize: 11 }}>View →</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {listings.length > show && (
        <button className="btn-ghost" onClick={() => setShow(v => v + 20)} style={{ marginTop: 12, width: '100%' }}>
          Show more ({listings.length - show} remaining)
        </button>
      )}
    </div>
  )
}

export default function AnalyzePage({ prefill }) {
  const [form, setForm] = useState({
    manufacturer: prefill?.manufacturer_en || '',
    model: prefill?.commercial_name || prefill?.model_en || '',
    year: prefill?.year || new Date().getFullYear() - 3,
    km: 80000,
    hand: prefill?.hand || 1,
    color: prefill?.color_en || '',
    gear_box: '',
    engine_type: prefill?.fuel_type_en || '',
    engine_volume: prefill?.engine_volume || '',
    horse_power: '',
    doors: prefill?.doors || '',
    seats: '',
    body_type: prefill?.body_type_en || '',
    city: '',
    asking_price: '',
    description: '',
    max_items: 100,
    exclude_agents: false,
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (prefill) {
      setForm(f => ({
        ...f,
        manufacturer: prefill.manufacturer_en || f.manufacturer,
        model: prefill.commercial_name || prefill.model_en || f.model,
        year: prefill.year || f.year,
        hand: prefill.hand || f.hand,
        color: prefill.color_en || f.color,
        engine_type: prefill.fuel_type_en || f.engine_type,
        engine_volume: prefill.engine_volume || f.engine_volume,
        doors: prefill.doors || f.doors,
        body_type: prefill.body_type_en || f.body_type,
      }))
    }
  }, [prefill])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleAnalyze = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    setSaved(false)
    try {
      const payload = {
        ...form,
        year: Number(form.year),
        km: Number(form.km),
        hand: Number(form.hand),
        max_items: Number(form.max_items),
        engine_volume: form.engine_volume ? Number(form.engine_volume) : null,
        horse_power: form.horse_power ? Number(form.horse_power) : null,
        doors: form.doors ? Number(form.doors) : null,
        seats: form.seats ? Number(form.seats) : null,
        asking_price: form.asking_price ? Number(form.asking_price) : null,
      }
      const { data } = await axios.post('/api/analyze', payload)
      setResult(data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Analysis failed. Check the server.')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!result) return
    try {
      await axios.post('/api/cars', { car: result.car })
      setSaved(true)
    } catch {}
  }

  const m = result?.market

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 32px' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 13, color: 'var(--accent2)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Market Analysis
        </div>
        <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1, marginBottom: 4 }}>
          Find the right price for your car
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 15 }}>
          We scrape live Yad2 listings and compare with official catalog prices.
        </p>
      </div>

      {/* Form */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 20 }}>Your Car Details</div>
        <div className="grid-3" style={{ marginBottom: 16 }}>
          <Field label="Manufacturer *">
            <input value={form.manufacturer} onChange={e => set('manufacturer', e.target.value)} placeholder="Toyota, Hyundai…" />
          </Field>
          <Field label="Model *">
            <input value={form.model} onChange={e => set('model', e.target.value)} placeholder="Corolla, Tucson…" />
          </Field>
          <Field label="Year *">
            <input type="number" value={form.year} onChange={e => set('year', e.target.value)} min="1990" max="2026" />
          </Field>
          <Field label="Mileage (km) *">
            <input type="number" value={form.km} onChange={e => set('km', e.target.value)} placeholder="80000" />
          </Field>
          <Field label="Hand (owner #) *">
            <input type="number" value={form.hand} onChange={e => set('hand', e.target.value)} min="1" max="10" />
          </Field>
          <Field label="Asking Price (₪)">
            <input type="number" value={form.asking_price} onChange={e => set('asking_price', e.target.value)} placeholder="Optional" />
          </Field>
          <Field label="Fuel type">
            <select value={form.engine_type} onChange={e => set('engine_type', e.target.value)}>
              <option value="">Any</option>
              {FUEL_OPTS.map(o => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Transmission">
            <select value={form.gear_box} onChange={e => set('gear_box', e.target.value)}>
              <option value="">Any</option>
              {GEAR_OPTS.map(o => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Body type">
            <select value={form.body_type} onChange={e => set('body_type', e.target.value)}>
              <option value="">Any</option>
              {BODY_OPTS.map(o => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Engine (cc)">
            <input type="number" value={form.engine_volume} onChange={e => set('engine_volume', e.target.value)} placeholder="1600" />
          </Field>
          <Field label="Color">
            <input value={form.color} onChange={e => set('color', e.target.value)} placeholder="Silver" />
          </Field>
          <Field label="City">
            <input value={form.city} onChange={e => set('city', e.target.value)} placeholder="Tel Aviv" />
          </Field>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <Field label="Max listings to fetch">
            <select value={form.max_items} onChange={e => set('max_items', Number(e.target.value))} style={{ width: 120 }}>
              {[50, 100, 200, 300].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18, cursor: 'pointer', fontSize: 14 }}>
            <input type="checkbox" checked={form.exclude_agents} onChange={e => set('exclude_agents', e.target.checked)} />
            Private sellers only
          </label>
          <div style={{ flex: 1 }} />
          <button
            className="btn-primary"
            onClick={handleAnalyze}
            disabled={loading || !form.manufacturer || !form.model}
            style={{ marginTop: 18, minWidth: 160, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}
          >
            {loading
              ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Scraping Yad2…</>
              : '🔍 Analyze Market'
            }
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '12px 16px', borderRadius: 10, marginBottom: 20,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
          color: 'var(--red)', fontSize: 14,
        }}>
          {error}
        </div>
      )}

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            {/* Price advice */}
            {form.asking_price && m && (
              <div style={{ marginBottom: 16 }}>
                <PriceAdvice asking={Number(form.asking_price)} market={m} />
              </div>
            )}

            {/* Stats row */}
            <div className="grid-4" style={{ marginBottom: 20 }}>
              <StatCard label="Listings Found" value={m?.count ?? 0} />
              <StatCard
                label="Avg Price"
                value={m?.avg_price ? `₪${Math.round(m.avg_price).toLocaleString()}` : '—'}
                color="var(--accent2)"
              />
              <StatCard
                label="Median Price"
                value={m?.median_price ? `₪${Math.round(m.median_price).toLocaleString()}` : '—'}
              />
              <StatCard
                label="Price Range"
                value={m?.min_price && m?.max_price
                  ? `₪${Math.round(m.min_price / 1000)}k–${Math.round(m.max_price / 1000)}k`
                  : '—'}
                sub={m?.avg_km ? `Avg ${Math.round(m.avg_km).toLocaleString()} km` : null}
              />
            </div>

            {/* Chart + sellers breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 20 }}>
              <div className="card">
                <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 15 }}>Price Distribution</div>
                <PriceHistogram listings={result.market?.listings || []} />
              </div>
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>Seller Breakdown</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span style={{ color: 'var(--muted)' }}>Private sellers</span>
                    <span style={{ fontWeight: 600 }}>{m?.private_count ?? 0}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span style={{ color: 'var(--muted)' }}>Dealers / agents</span>
                    <span style={{ fontWeight: 600 }}>{m?.agent_count ?? 0}</span>
                  </div>
                  {result.official_price && (
                    <>
                      <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>Official catalog price</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--green)' }}>
                        ₪{result.official_price.toLocaleString()}
                      </div>
                    </>
                  )}
                </div>
                <div style={{ flex: 1 }} />
                <button
                  className="btn-ghost"
                  onClick={handleSave}
                  disabled={saved}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}
                >
                  <Save size={14} />
                  {saved ? 'Saved to Garage ✓' : 'Save to My Garage'}
                </button>
              </div>
            </div>

            {/* Listings table */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>
                Live Listings from Yad2
              </div>
              <ListingsTable listings={result.market?.listings} />
            </div>

            {/* Selling plan */}
            <PlanSection plan={result.selling_plan} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
