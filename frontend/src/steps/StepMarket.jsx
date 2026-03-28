import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, ExternalLink, RefreshCw, TrendingUp, AlertTriangle, Users, Zap, Target } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import axios from 'axios'

// ── Utilities ─────────────────────────────────────────────────────────────────

function pct(n, total) { return total ? Math.round((n / total) * 100) : 0 }
function fmt(n) { return n ? `₪${Math.round(n).toLocaleString()}` : '—' }
function fmtK(n) { return n ? `₪${Math.round(n / 1000)}k` : '—' }

function classifyListing(l, median, avgKm) {
  if (!l.price || !median) return 'normal'
  const priceDelta = (l.price - median) / median
  const kmDelta = avgKm && l.km ? (l.km - avgKm) / avgKm : 0
  if (priceDelta < -0.15) return 'deal'          // great deal
  if (priceDelta > 0.18) return 'overpriced'     // overpriced
  if (Math.abs(kmDelta) > 0.35) return 'anomaly' // mileage anomaly
  if (priceDelta < -0.07) return 'good'          // good price
  return 'normal'
}

const CLASS_META = {
  deal:      { label: '🔥 Deal',      color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)' },
  good:      { label: '👍 Good',      color: '#3b82f6', bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.3)'  },
  normal:    { label: '➖ Fair',       color: '#9ca3af', bg: 'var(--surface2)',       border: 'var(--border)'         },
  overpriced:{ label: '💸 High',      color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.3)'  },
  anomaly:   { label: '⚡ Anomaly',   color: '#a78bfa', bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.3)' },
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function IntelCard({ icon: Icon, label, value, sub, color, bg, border }) {
  return (
    <div style={{
      background: bg || 'var(--surface)',
      border: `1px solid ${border || 'var(--border)'}`,
      borderRadius: 14, padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
        <Icon size={13} color={color || 'var(--muted)'} />
        <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color: color || '#fff', letterSpacing: -0.5 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

function PriceHistogram({ listings, median, yourPrice, height = 180 }) {
  const priced = listings.filter(l => l.price > 0)
  if (priced.length < 3) return null
  const prices = priced.map(l => l.price).sort((a, b) => a - b)
  const min = prices[0], max = prices[prices.length - 1]
  const step = (max - min) / 14 || 1
  const bins = Array.from({ length: 14 }, (_, i) => {
    const from = min + i * step, to = min + (i + 1) * step
    const inBin = priced.filter(l => l.price >= from && l.price < to)
    const hasYours = yourPrice && yourPrice >= from && yourPrice < to
    const hasMedian = median && median >= from && median < to
    return { range: fmtK(from + step / 2), count: inBin.length, hasYours, hasMedian, from }
  })
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={bins} margin={{ top: 4, right: 4, bottom: 4, left: -24 }}>
        <XAxis dataKey="range" tick={{ fontSize: 9, fill: '#6b7280' }} interval={2} />
        <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} />
        <Tooltip
          contentStyle={{ background: '#18181c', border: '1px solid #2a2a32', borderRadius: 8, fontSize: 11 }}
          formatter={(v) => [`${v} listings`, '']}
        />
        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
          {bins.map((b, i) => (
            <Cell key={i} fill={b.hasYours ? '#f59e0b' : b.hasMedian ? '#3b82f6' : '#2563eb66'} />
          ))}
        </Bar>
        {median && <ReferenceLine x={fmtK(median)} stroke="#3b82f6" strokeDasharray="3 3" />}
        {yourPrice && <ReferenceLine x={fmtK(yourPrice)} stroke="#f59e0b" strokeDasharray="3 3" />}
      </BarChart>
    </ResponsiveContainer>
  )
}

function QuadrantGrid({ listings, classified, yourKm, yourPrice, median, avgKm }) {
  const [hovered, setHovered] = useState(null)

  const withData = (classified || listings)
    .filter(l => l.price > 0 && l.km > 0)
    .slice(0, 100)

  if (withData.length < 4) {
    return (
      <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>
        Not enough km data yet — enriching listings…
      </div>
    )
  }

  const prices = withData.map(l => l.price)
  const kms = withData.map(l => l.km)
  const minP = Math.min(...prices), maxP = Math.max(...prices)
  const minK = Math.min(...kms),   maxK = Math.max(...kms)
  const padP = (maxP - minP) * 0.05 || 5000
  const padK = (maxK - minK) * 0.05 || 5000
  const rangeP = maxP - minP + padP * 2
  const rangeK = maxK - minK + padK * 2

  // Map a listing to SVG coords (0–100%)
  const toX = km    => ((km - minK + padK) / rangeK) * 100
  const toY = price => 100 - ((price - minP + padP) / rangeP) * 100

  // Quadrant pivot = median price, avg km
  const pivotP = median || (minP + maxP) / 2
  const pivotK = avgKm || (minK + maxK) / 2
  const pivotX = toX(pivotK)
  const pivotY = toY(pivotP)

  const classColor = { deal: '#10b981', good: '#3b82f6', normal: '#6b7280', overpriced: '#f59e0b', anomaly: '#a78bfa' }

  const QUADRANTS = [
    { label: '🏆 Best Buy',     sub: 'Low price · Low km',  x: '2%',  y: '2%',  color: '#10b981' },
    { label: '💸 Overpriced',   sub: 'High price · Low km', x: '55%', y: '2%',  color: '#f59e0b' },
    { label: '⚡ Value Worn',   sub: 'Low price · High km', x: '2%',  y: '56%', color: '#a78bfa' },
    { label: '🚫 Avoid',        sub: 'High price · High km',x: '55%', y: '56%', color: '#ef4444' },
  ]

  return (
    <div style={{ position: 'relative', width: '100%', height: 260 }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        {/* Quadrant dividers */}
        <line x1={`${pivotX}%`} y1="0" x2={`${pivotX}%`} y2="100%" stroke="#ffffff10" strokeWidth={1} strokeDasharray="4 4" />
        <line x1="0" y1={`${pivotY}%`} x2="100%" y2={`${pivotY}%`} stroke="#ffffff10" strokeWidth={1} strokeDasharray="4 4" />

        {/* Quadrant labels */}
        {QUADRANTS.map(q => (
          <text key={q.label} x={q.x} y={q.y} fill={q.color} fontSize={9} fontWeight={700} opacity={0.55}>
            {q.label}
          </text>
        ))}

        {/* Listing dots */}
        {withData.map((l, i) => {
          const x = toX(l.km)
          const y = toY(l.price)
          const cls = l._class || 'normal'
          const col = classColor[cls] || '#6b7280'
          const isHovered = hovered?.listing_id === l.listing_id
          return (
            <g key={l.listing_id || i}
              onMouseEnter={() => setHovered({ ...l, _x: x, _y: y })}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={`${x}%`} cy={`${y}%`}
                r={isHovered ? 6 : l.is_agent ? 4 : 3.5}
                fill={col}
                opacity={isHovered ? 1 : l.is_agent ? 0.45 : 0.65}
                stroke={isHovered ? '#fff' : 'none'}
                strokeWidth={1.5}
              />
            </g>
          )
        })}

        {/* Your car star */}
        {yourKm && yourPrice && (() => {
          const x = toX(yourKm)
          const y = toY(yourPrice)
          return (
            <g>
              <circle cx={`${x}%`} cy={`${y}%`} r={10} fill="#f59e0b" opacity={0.18} />
              <text x={`${x}%`} y={`${y}%`} textAnchor="middle" dominantBaseline="middle"
                fontSize={13} fill="#f59e0b" fontWeight={900}>★</text>
            </g>
          )
        })()}

        {/* Axis labels */}
        <text x="50%" y="98%" textAnchor="middle" fontSize={8} fill="#4b5563">← lower km · higher km →</text>
        <text x="1%" y="50%" textAnchor="middle" fontSize={8} fill="#4b5563" transform="rotate(-90, 8, 130)">price ↑</text>
      </svg>

      {/* Hover tooltip */}
      {hovered && (
        <div style={{
          position: 'absolute',
          left: `clamp(0px, calc(${hovered._x}% + 12px), calc(100% - 180px))`,
          top:  `clamp(0px, calc(${hovered._y}% - 20px), calc(100% - 90px))`,
          background: '#18181c', border: '1px solid #2a2a32',
          borderRadius: 10, padding: '8px 12px', fontSize: 11,
          pointerEvents: 'none', zIndex: 10, minWidth: 160,
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: classColor[hovered._class] || '#fff' }}>
            {CLASS_META[hovered._class]?.label}
          </div>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 13 }}>
            {hovered.price ? fmt(hovered.price) : '—'}
          </div>
          <div style={{ color: 'var(--muted)', marginTop: 2 }}>
            {hovered.km ? `${hovered.km.toLocaleString()} km` : 'km unknown'}
            {hovered.year ? ` · ${hovered.year}` : ''}
            {hovered.hand ? ` · Hand ${hovered.hand}` : ''}
          </div>
          <div style={{ color: 'var(--muted2)', marginTop: 2 }}>
            {hovered.is_agent ? '🏢 Dealer' : '👤 Private'}
            {hovered.city_en ? ` · ${hovered.city_en}` : ''}
          </div>
          <a href={hovered.url} target="_blank" rel="noreferrer"
            style={{ color: 'var(--accent2)', fontSize: 10, marginTop: 4, display: 'block', pointerEvents: 'all' }}>
            Open on Yad2 ↗
          </a>
        </div>
      )}
    </div>
  )
}

function ListingRow({ l, rank, classified, median }) {
  const meta = CLASS_META[classified]
  const priceDelta = median && l.price ? ((l.price - median) / median * 100).toFixed(1) : null
  return (
    <motion.a
      href={l.url}
      target="_blank"
      rel="noreferrer"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.03 }}
      style={{
        display: 'grid',
        gridTemplateColumns: '28px 1fr auto auto',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 10,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        textDecoration: 'none', color: 'inherit',
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
    >
      <div style={{ fontSize: 11, color: 'var(--muted2)', fontWeight: 700, textAlign: 'center' }}>#{rank + 1}</div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          {[l.year, l.sub_model || l.model_en].filter(Boolean).join(' ')}
          <span style={{ fontSize: 10, fontWeight: 700, color: meta.color, background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: 10, padding: '1px 7px' }}>
            {meta.label}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {l.km && <span>{l.km.toLocaleString()} km</span>}
          {l.hand && <span>Hand {l.hand}</span>}
          {l.gear_box && <span>{l.gear_box}</span>}
          {l.city_en && <span>{l.city_en}</span>}
          <span>{l.is_agent ? '🏢 Dealer' : '👤 Private'}</span>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: meta.color }}>
          {l.price ? fmt(l.price) : '—'}
        </div>
        {priceDelta !== null && (
          <div style={{ fontSize: 10, color: Number(priceDelta) < 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
            {Number(priceDelta) < 0 ? '' : '+'}{priceDelta}% vs median
          </div>
        )}
      </div>
      <ExternalLink size={12} color="var(--muted2)" />
    </motion.a>
  )
}

function AnomalyCard({ icon, title, desc, color, bg, border }) {
  return (
    <div style={{
      background: bg, border: `1px solid ${border}`,
      borderRadius: 12, padding: '12px 14px',
      display: 'flex', alignItems: 'flex-start', gap: 10,
    }}>
      <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, color, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function StepMarket({ car, onDone }) {
  const [status, setStatus] = useState('idle')
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [rescanCount, setRescanCount] = useState(0)
  const [filter, setFilter] = useState('all')   // all | private | dealer | deal | good | overpriced
  const [sort, setSort] = useState('price-asc') // price-asc | price-desc | km-asc | km-desc
  const [showAll, setShowAll] = useState(false)

  const rescan = () => { setResult(null); setError(null); setShowAll(false); setRescanCount(c => c + 1) }

  useEffect(() => {
    if (!car) return
    setStatus('loading'); setResult(null); setError(null); setProgress('Connecting to Yad2…')
    const mfr = car.manufacturer_en || car.manufacturer || ''
    let mdl = car.commercial_name || car.model_en || ''
    if (mfr && mdl.toLowerCase().startsWith(mfr.toLowerCase())) mdl = mdl.slice(mfr.length).trim()
    const payload = {
      manufacturer: mfr, model: mdl,
      sub_model: car.sub_model || car.trim || null,
      year: Number(car.year), km: Number(car.km) || 80000, hand: Number(car.hand) || 1,
      color: car.color_en || '', engine_type: car.fuel_type_en || '',
      engine_volume: car.engine_volume ? Number(car.engine_volume) : null,
      body_type: car.body_type_en || '', doors: car.doors ? Number(car.doors) : null,
      gear_box: car.gear_box || '', horse_power: car.horse_power ? Number(car.horse_power) : null,
      seats: null, city: '', test_date: null,
      asking_price: car.asking_price ? Number(car.asking_price) : null,
      description: car.description || '', max_items: 100, exclude_agents: false,
    }
    setTimeout(() => setProgress('Scraping live listings…'), 800)
    setTimeout(() => setProgress('Computing intelligence…'), 3200)
    axios.post('/api/analyze', payload)
      .then(({ data }) => { setResult(data); setStatus('done') })
      .catch(e => { setError(e.response?.data?.detail || 'Failed to fetch market data'); setStatus('error') })
  }, [car?.plate, car?.manufacturer_en, car?.model_en, car?.commercial_name, car?.year, rescanCount])

  const m = result?.market
  const allListings = m?.listings || []
  const median = m?.median_price
  const avgKm = m?.avg_km

  // Classify all listings
  const classified = useMemo(() =>
    allListings.map(l => ({ ...l, _class: classifyListing(l, median, avgKm) })),
    [allListings, median, avgKm]
  )

  // Intel derived values
  const priced = classified.filter(l => l.price > 0)
  const deals = classified.filter(l => l._class === 'deal')
  const overpriced = classified.filter(l => l._class === 'overpriced')
  const anomalies = classified.filter(l => l._class === 'anomaly')
  const privateListings = classified.filter(l => !l.is_agent)
  const dealerListings = classified.filter(l => l.is_agent)
  const privateAvg = privateListings.filter(l => l.price).reduce((s, l, _, a) => s + l.price / a.length, 0)
  const dealerAvg = dealerListings.filter(l => l.price).reduce((s, l, _, a) => s + l.price / a.length, 0)
  const cheapest = priced.length ? priced.reduce((a, b) => a.price < b.price ? a : b) : null
  const priciest = priced.length ? priced.reduce((a, b) => a.price > b.price ? a : b) : null

  // Sorted + filtered
  const carSubModel = car?.sub_model || car?.trim || null

  const filtered = useMemo(() => {
    let list = [...classified]
    if (filter === 'private') list = list.filter(l => !l.is_agent)
    else if (filter === 'dealer') list = list.filter(l => l.is_agent)
    else if (filter === 'trim' && carSubModel) {
      const keyword = carSubModel.toUpperCase().split(/[\s\-/]/)[0]
      list = list.filter(l => l.sub_model && l.sub_model.toUpperCase().includes(keyword))
    }
    else if (['deal', 'good', 'overpriced', 'anomaly'].includes(filter)) list = list.filter(l => l._class === filter)
    if (sort === 'price-asc')  list.sort((a, b) => (a.price || 999999) - (b.price || 999999))
    if (sort === 'price-desc') list.sort((a, b) => (b.price || 0) - (a.price || 0))
    if (sort === 'km-asc')    list.sort((a, b) => (a.km || 999999) - (b.km || 999999))
    if (sort === 'km-desc')   list.sort((a, b) => (b.km || 0) - (a.km || 0))
    return list
  }, [classified, filter, sort, carSubModel])

  const visible = showAll ? filtered : filtered.slice(0, 12)

  // Build anomaly insights
  const insights = []
  if (deals.length > 0)
    insights.push({ icon: '🔥', title: `${deals.length} listings priced 15%+ below median`, desc: `Best deal: ${fmt(deals.reduce((a,b) => a.price < b.price ? a : b, deals[0])?.price)} — check condition carefully`, color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)' })
  if (overpriced.length > 0)
    insights.push({ icon: '💸', title: `${overpriced.length} listings priced 18%+ above median`, desc: `Could be dealer premium, extras, or stale listings. Market will negotiate them down.`, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)' })
  if (anomalies.length > 0)
    insights.push({ icon: '⚡', title: `${anomalies.length} mileage anomalies detected`, desc: `These cars have unusually high or low km vs the ${Math.round(avgKm / 1000)}k avg — worth investigating.`, color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.25)' })
  if (privateAvg && dealerAvg && Math.abs(privateAvg - dealerAvg) > 3000)
    insights.push({ icon: '🏢', title: `Dealers ask ${fmt(Math.round(Math.abs(dealerAvg - privateAvg)))} ${dealerAvg > privateAvg ? 'more' : 'less'} than private sellers`, desc: `Private avg: ${fmt(Math.round(privateAvg))} · Dealer avg: ${fmt(Math.round(dealerAvg))}`, color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)' })
  if (result?.official_price && median) {
    const dep = Math.round((1 - median / result.official_price) * 100)
    insights.push({ icon: '📉', title: `${dep}% market depreciation vs catalog price`, desc: `Official catalog: ${fmt(result.official_price)} · Market median: ${fmt(Math.round(median))}`, color: '#9ca3af', bg: 'var(--surface)', border: 'var(--border)' })
  }

  const yourPrice = car?.asking_price ? Number(car.asking_price) : null
  const yourVsMedian = yourPrice && median ? ((yourPrice - median) / median * 100).toFixed(1) : null

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse 70% 45% at 50% 0%, rgba(59,130,246,0.07) 0%, transparent 60%), var(--bg)',
      padding: '36px 20px 100px',
    }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--accent2)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
              Market Command Center
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: -1, marginBottom: 4 }}>
              {status === 'done' ? `${m?.count ?? 0} listings analyzed` : 'Scanning Yad2…'}
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>
              {car?.manufacturer_en} {car?.model_en || car?.commercial_name} · live data
            </p>
          </div>
          {status === 'done' && (
            <button onClick={rescan} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '7px 14px' }}>
              <RefreshCw size={12} /> Rescan
            </button>
          )}
        </motion.div>

        {/* Loading */}
        {status === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '80px 0' }}>
            <div style={{ position: 'relative' }}>
              <div className="spinner" style={{ width: 52, height: 52, borderWidth: 3 }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📊</div>
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 15 }}>{progress}</div>
            <div style={{ fontSize: 12, color: 'var(--muted2)', maxWidth: 300, textAlign: 'center' }}>Scraping live data · 5–15 seconds</div>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div style={{ padding: '24px', borderRadius: 14, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--red)', fontSize: 15, textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>⚠️</div>
            {error}
            <div style={{ marginTop: 14 }}>
              <button className="btn-primary" onClick={() => onDone(null)}>Continue without market data →</button>
            </div>
          </div>
        )}

        {status === 'done' && result && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>

            {/* ── Trim context banner ── */}
            {(() => {
              const subModel = car?.sub_model || car?.trim
              if (!subModel) return null
              const trimListings = classified.filter(l => l.sub_model && l.sub_model.toUpperCase().includes(subModel.toUpperCase().split(/[\s\-/]/)[0]))
              const trimCount = trimListings.length
              return (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}
                  style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 12, padding: '10px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16 }}>🏷️</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#a5b4fc' }}>Trim-aware pricing: </span>
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                      Median is weighted toward <strong style={{ color: '#fff' }}>{subModel}</strong> listings
                      {trimCount > 0 ? ` · ${trimCount} exact trim match${trimCount !== 1 ? 'es' : ''} found` : ' · comparing all trims (no exact matches)'}
                    </span>
                  </div>
                  {trimCount > 0 && (
                    <button onClick={() => setFilter('trim')} style={{
                      fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '3px 12px', cursor: 'pointer', border: 'none',
                      background: filter === 'trim' ? 'rgba(99,102,241,0.35)' : 'rgba(99,102,241,0.15)',
                      color: '#a5b4fc',
                    }}>
                      {filter === 'trim' ? '✓ Filtered' : 'Show only'}
                    </button>
                  )}
                </motion.div>
              )
            })()}

            {/* ── Row 1: Key intel stats ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
              <IntelCard icon={Target} label="Median price" value={fmt(Math.round(median || 0))} sub="50th percentile" color="var(--accent2)" bg="rgba(59,130,246,0.07)" border="rgba(59,130,246,0.25)" />
              <IntelCard icon={TrendingUp} label="Avg price" value={fmt(Math.round(m?.avg_price || 0))} sub={`${m?.count} listings`} />
              <IntelCard icon={Zap} label="Best deal" value={fmt(cheapest?.price)} sub={cheapest ? `${cheapest.km?.toLocaleString()} km` : ''} color="#10b981" bg="rgba(16,185,129,0.07)" border="rgba(16,185,129,0.25)" />
              <IntelCard icon={AlertTriangle} label="Highest ask" value={fmt(priciest?.price)} sub={priciest ? `${priciest.km?.toLocaleString()} km` : ''} color="#f59e0b" bg="rgba(245,158,11,0.07)" border="rgba(245,158,11,0.25)" />
              <IntelCard icon={Users} label="Private / Dealer" value={`${m?.private_count ?? 0} / ${m?.agent_count ?? 0}`} sub={`Private avg ${fmtK(Math.round(privateAvg || 0))}`} />
            </div>

            {/* ── Row 2: Your position ── */}
            {yourPrice && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                style={{
                  background: Number(yourVsMedian) > 10 ? 'rgba(245,158,11,0.08)' : Number(yourVsMedian) < -10 ? 'rgba(16,185,129,0.08)' : 'rgba(59,130,246,0.07)',
                  border: `1px solid ${Number(yourVsMedian) > 10 ? 'rgba(245,158,11,0.3)' : Number(yourVsMedian) < -10 ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.25)'}`,
                  borderRadius: 12, padding: '12px 16px', marginBottom: 16,
                  display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: 20 }}>
                  {Number(yourVsMedian) > 10 ? '⚠️' : Number(yourVsMedian) < -5 ? '✅' : '🎯'}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    Your asking price {fmt(yourPrice)} is{' '}
                    <span style={{ color: Number(yourVsMedian) > 0 ? '#f59e0b' : '#10b981' }}>
                      {Number(yourVsMedian) > 0 ? `+${yourVsMedian}%` : `${yourVsMedian}%`} vs market median
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    {Number(yourVsMedian) > 15 ? 'You may be overpriced — consider a 5–10% reduction to attract more buyers.' :
                     Number(yourVsMedian) > 5 ? 'Slightly above median. Reasonable if condition is good.' :
                     Number(yourVsMedian) < -10 ? 'Below market — you could ask more. Make sure you\'re not leaving money on the table.' :
                     'Right in the sweet spot — you\'re priced competitively.'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Market rank</div>
                  <div style={{ fontWeight: 800, fontSize: 18 }}>
                    #{priced.filter(l => l.price < yourPrice).length + 1} / {priced.length}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Row 3: Charts ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div className="card" style={{ padding: '16px 18px' }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Price distribution</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>
                  <span style={{ color: '#3b82f6' }}>■</span> Median &nbsp;
                  {yourPrice && <><span style={{ color: '#f59e0b' }}>■</span> Your price</>}
                </div>
                <PriceHistogram listings={allListings} median={median} yourPrice={yourPrice} height={240} />
              </div>
              <div className="card" style={{ padding: '16px 18px' }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>Price vs km map</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
                  Hover any dot · {yourPrice ? '★ = your car · ' : ''}colored by rating
                </div>
                <QuadrantGrid
                  listings={allListings}
                  classified={classified}
                  yourKm={car?.km ? Number(car.km) : null}
                  yourPrice={yourPrice}
                  median={median}
                  avgKm={avgKm}
                />
              </div>
            </div>

            {/* ── Row 4: Class breakdown bar ── */}
            <div className="card" style={{ padding: '14px 18px', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Market composition</div>
              <div style={{ display: 'flex', height: 24, borderRadius: 6, overflow: 'hidden', marginBottom: 10, gap: 1 }}>
                {Object.entries(CLASS_META).map(([cls, meta]) => {
                  const cnt = classified.filter(l => l._class === cls).length
                  const w = pct(cnt, classified.length)
                  if (!w) return null
                  return (
                    <div key={cls} title={`${meta.label}: ${cnt} (${w}%)`}
                      style={{ width: `${w}%`, background: meta.color + 'bb', transition: 'width 0.5s' }} />
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {Object.entries(CLASS_META).map(([cls, meta]) => {
                  const cnt = classified.filter(l => l._class === cls).length
                  if (!cnt) return null
                  return (
                    <button key={cls} onClick={() => setFilter(filter === cls ? 'all' : cls)} style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      display: 'flex', alignItems: 'center', gap: 5,
                      opacity: filter !== 'all' && filter !== cls ? 0.4 : 1,
                    }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: meta.color }} />
                      <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: filter === cls ? 700 : 400 }}>
                        {meta.label} <strong style={{ color: '#fff' }}>{cnt}</strong>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Row 5: Intel insights ── */}
            {insights.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
                {insights.map((ins, i) => <AnomalyCard key={i} {...ins} />)}
              </div>
            )}

            {/* ── Row 6: Listings grid ── */}
            <div className="card" style={{ padding: '16px 18px', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>
                  {filter === 'all' ? `All ${classified.length} listings` : `${filtered.length} ${CLASS_META[filter]?.label || filter} listings`}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Filter chips */}
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[['all', 'All'], ['private', '👤 Private'], ['dealer', '🏢 Dealer']].map(([v, lbl]) => (
                      <button key={v} onClick={() => setFilter(v)} style={{
                        fontSize: 11, fontWeight: 600, borderRadius: 20, padding: '3px 10px', cursor: 'pointer', border: 'none',
                        background: filter === v ? 'rgba(59,130,246,0.2)' : 'var(--surface2)',
                        color: filter === v ? 'var(--accent2)' : 'var(--muted)',
                        outline: filter === v ? '1px solid rgba(59,130,246,0.4)' : 'none',
                      }}>{lbl}</button>
                    ))}
                  </div>
                  {/* Sort */}
                  <select value={sort} onChange={e => setSort(e.target.value)} style={{
                    fontSize: 11, background: 'var(--surface2)', border: '1px solid var(--border)',
                    color: 'var(--muted)', borderRadius: 8, padding: '4px 8px', cursor: 'pointer',
                  }}>
                    <option value="price-asc">Price ↑</option>
                    <option value="price-desc">Price ↓</option>
                    <option value="km-asc">km ↑</option>
                    <option value="km-desc">km ↓</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <AnimatePresence mode="popLayout">
                  {visible.map((l, i) => (
                    <ListingRow key={l.listing_id || i} l={l} rank={i} classified={l._class} median={median} />
                  ))}
                </AnimatePresence>
              </div>

              {filtered.length > 12 && (
                <button onClick={() => setShowAll(v => !v)} className="btn-ghost"
                  style={{ width: '100%', marginTop: 10, fontSize: 13 }}>
                  {showAll ? 'Show less' : `Show all ${filtered.length} listings`}
                </button>
              )}
            </div>

            {/* ── CTA ── */}
            <motion.button
              className="btn-primary"
              onClick={() => onDone(result)}
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.98 }}
              style={{ width: '100%', padding: 15, fontSize: 15, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 4px 24px rgba(59,130,246,0.3)' }}
            >
              Calculate my ideal selling price <ArrowRight size={15} />
            </motion.button>

          </motion.div>
        )}
      </div>
    </div>
  )
}
