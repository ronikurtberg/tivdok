import { motion } from 'framer-motion'
import { BarChart3, ArrowRight, Zap, TrendingUp, AlertTriangle, Award } from 'lucide-react'

export default function StepMarketPrompt({ car, onScan, onSkip }) {
  const mfr = car?.manufacturer_en || ''
  let mdl = car?.commercial_name || car?.model_en || ''
  if (mfr && mdl.toLowerCase().startsWith(mfr.toLowerCase())) mdl = mdl.slice(mfr.length).trim()

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px 100px',
      background: 'radial-gradient(ellipse 70% 50% at 50% 30%, rgba(59,130,246,0.07) 0%, transparent 70%), var(--bg)',
    }}>
      <div style={{ maxWidth: 540, width: '100%', textAlign: 'center' }}>

        <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>📡</div>
          <h1 style={{ fontSize: 34, fontWeight: 900, letterSpacing: -1.2, marginBottom: 10, lineHeight: 1.1 }}>
            Scan the live market<br />
            <span style={{ color: 'var(--accent2)' }}>before you price</span>
          </h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 24 }}>
            We'll scrape Yad2 live for {mfr} {mdl} listings and build a full command center —
            ranked deals, anomalies, price heatmap, and exactly where your car stands.
          </p>
        </motion.div>

        {/* What you'll get */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 22, textAlign: 'left' }}
        >
          {[
            { icon: Award, color: '#10b981', label: 'Best deals flagged', sub: '🔥 listings 15%+ below median' },
            { icon: AlertTriangle, color: '#f59e0b', label: 'Overpriced cars', sub: 'Dealer vs private gap' },
            { icon: TrendingUp, color: '#3b82f6', label: 'Your price ranked', sub: 'Where you sit vs market' },
            { icon: Zap, color: '#a78bfa', label: 'Mileage anomalies', sub: 'Cars with unusual km' },
          ].map(({ icon: Icon, color, label, sub }) => (
            <div key={label} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '11px 13px', display: 'flex', alignItems: 'flex-start', gap: 9,
            }}>
              <Icon size={15} color={color} style={{ marginTop: 1, flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 12 }}>{label}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{sub}</div>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Search params pill */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
          style={{
            background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: 10, padding: '8px 14px', marginBottom: 20,
            fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap',
          }}
        >
          <span>🚗 {mfr} {mdl}</span>
          {car?.year && <span>📅 {car.year - 1}–{Number(car.year) + 1}</span>}
          {car?.km && <span>🛣️ up to {Math.round(car.km * 1.4 / 1000)}k km</span>}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <motion.button
            className="btn-primary"
            onClick={onScan}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            style={{ width: '100%', padding: 15, fontSize: 15, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 4px 24px rgba(59,130,246,0.3)' }}
          >
            <BarChart3 size={17} /> Launch Market Command Center <ArrowRight size={15} />
          </motion.button>
          <button onClick={onSkip} className="btn-ghost"
            style={{ width: '100%', padding: 12, fontSize: 13, borderRadius: 12 }}>
            Skip — go straight to price estimate
          </button>
        </motion.div>

        <div style={{ marginTop: 14, fontSize: 11, color: 'var(--muted2)' }}>
          ⚡ Live Yad2 data · typically 30–150 listings · ~10 seconds
        </div>
      </div>
    </div>
  )
}
