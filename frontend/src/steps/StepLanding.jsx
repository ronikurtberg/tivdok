import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Search, ArrowRight, X, Bot, MessageSquare, Megaphone, BadgeCheck, TrendingUp, FileUp, FileCheck2 } from 'lucide-react'
import axios from 'axios'

const BALCAR_URL = 'https://balcar.co.il/?Aff1=GABrand&gad_source=1&gad_campaignid=14123148844&gbraid=0AAAAABUgJY45yoFHpRyxjeh2Xw20kFOxX'

const AGENT_STEPS = [
  { icon: '📋', title: 'You confirm details', sub: '2 minutes' },
  { icon: '📣', title: 'Agent publishes everywhere', sub: 'Yad2, Facebook, WhatsApp' },
  { icon: '💬', title: 'Agent handles all buyers', sub: '24/7, zero effort from you' },
  { icon: '🤝', title: 'Agent negotiates', sub: 'Gets you the best price' },
  { icon: '💰', title: 'You just show up to sign', sub: 'That\'s it' },
]

export default function StepLanding({ onFound }) {
  const [plate, setPlate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [pdfFile, setPdfFile] = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [mode, setMode] = useState('plate') // 'plate' | 'pdf'
  const inputRef = useRef()
  const fileRef = useRef()

  const handleSearch = async () => {
    const clean = plate.replace(/[-\s]/g, '').trim()
    if (!clean) return
    setLoading(true)
    setError(null)
    try {
      const { data } = await axios.get(`/api/plate/${clean}`)
      onFound(data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Plate not found. Check the number and try again.')
      setLoading(false)
    }
  }

  const handleKey = (e) => { if (e.key === 'Enter') handleSearch() }

  const handlePdfUpload = async (file) => {
    if (!file) return
    setPdfFile(file)
    setPdfLoading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const { data } = await axios.post('/api/parse-license', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      if (!data.plate) {
        setError('Could not find a plate number in the PDF. Try typing it manually.')
        setPdfLoading(false)
        return
      }
      // Merge with gov API data — PDF fields take priority over empty gov fields
      try {
        const { data: govData } = await axios.get(`/api/plate/${data.plate}`)
        // Gov data wins only when PDF field is missing/null; PDF always wins for body_type, engine_volume, city
        const merged = { ...govData, ...Object.fromEntries(
          Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== '')
        )}
        onFound(merged)
      } catch {
        // Gov lookup failed, use PDF data only
        onFound(data)
      }
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not read the PDF. Make sure it is an Israeli vehicle license (רישיון רכב).')
      setPdfLoading(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file?.type === 'application/pdf') handlePdfUpload(file)
    else setError('Please drop a PDF file.')
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '32px 24px 60px',
      background: `
        radial-gradient(ellipse 90% 55% at 50% -5%, rgba(124,58,237,0.12) 0%, transparent 60%),
        radial-gradient(ellipse 60% 40% at 80% 80%, rgba(59,130,246,0.07) 0%, transparent 60%),
        var(--bg)
      `,
    }}>

      {/* ── Hero ── */}
      <motion.div
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
        style={{ textAlign: 'center', maxWidth: 620, marginBottom: 28 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 32 }}>🤖</span>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            background: 'rgba(124,58,237,0.12)', color: '#a78bfa',
            border: '1px solid rgba(124,58,237,0.3)',
            padding: '4px 12px', borderRadius: 20,
          }}>
            <Bot size={10} /> AI Car Selling Agent · Israel
          </div>
        </div>

        <h1 style={{
          fontSize: 40, fontWeight: 900, letterSpacing: -1.8,
          lineHeight: 1.08, color: '#fff', marginBottom: 12,
        }}>
          Sell your car smarter.<br />
          <span style={{
            background: 'linear-gradient(90deg, #a78bfa, #60a5fa)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            AI handles the whole process.
          </span>
        </h1>

        <p style={{ fontSize: 15, color: 'var(--muted)', lineHeight: 1.6, maxWidth: 500, margin: '0 auto 16px' }}>
          Enter your plate number or upload your license PDF. We'll identify your car, check history,
          scan live market prices, and set the ideal asking price.
        </p>

        {/* Social proof row */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
          {[
            { icon: <BadgeCheck size={12} />, label: 'Ministry of Transport data' },
            { icon: <TrendingUp size={12} />, label: 'Live Yad2 scan' },
            { icon: <MessageSquare size={12} />, label: 'Agent handles buyers' },
          ].map(({ icon, label }) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 12, color: 'var(--muted)',
            }}>
              <span style={{ color: 'var(--accent2)' }}>{icon}</span>
              {label}
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Input section ── */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.18 }}
        style={{ width: '100%', maxWidth: 500, marginBottom: 56 }}
      >
        {/* Mode switcher tabs */}
        <div style={{
          display: 'flex', background: 'var(--surface)', borderRadius: 14,
          padding: 4, marginBottom: 16, border: '1px solid var(--border)',
        }}>
          {[
            { key: 'plate', icon: <Search size={14} />, label: 'Type plate number' },
            { key: 'pdf',   icon: <FileUp size={14} />,  label: 'Upload רישיון רכב (PDF)' },
          ].map(({ key, icon, label }) => (
            <button
              key={key}
              onClick={() => { setMode(key); setError(null) }}
              style={{
                flex: 1, border: 'none', borderRadius: 10, padding: '10px 14px',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'all 0.18s',
                background: mode === key ? 'linear-gradient(135deg, #7c3aed, #3b82f6)' : 'transparent',
                color: mode === key ? '#fff' : 'var(--muted)',
                boxShadow: mode === key ? '0 2px 12px rgba(124,58,237,0.3)' : 'none',
              }}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* ── Mode: type plate ── */}
        {mode === 'plate' && (
          <>
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border2)',
              borderRadius: 20,
              padding: 6,
              display: 'flex',
              gap: 8,
              boxShadow: '0 0 60px rgba(124,58,237,0.12)',
            }}>
              <div style={{
                background: '#003DA5', borderRadius: 14, width: 44,
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 2, flexShrink: 0,
              }}>
                <span style={{ fontSize: 18 }}>🇮🇱</span>
                <span style={{ fontSize: 8, color: '#fff', fontWeight: 700, letterSpacing: 1 }}>IL</span>
              </div>
              <input
                ref={inputRef}
                value={plate}
                onChange={e => setPlate(e.target.value)}
                onKeyDown={handleKey}
                placeholder="12-345-67"
                maxLength={10}
                disabled={loading}
                autoFocus
                style={{
                  flex: 1, background: 'transparent', border: 'none',
                  fontSize: 28, fontWeight: 800, letterSpacing: 6,
                  color: '#fff', outline: 'none', textAlign: 'center',
                  padding: '8px 0', caretColor: 'var(--accent)',
                }}
              />
              {plate && (
                <button onClick={() => setPlate('')} style={{
                  background: 'transparent', border: 'none', color: 'var(--muted)',
                  cursor: 'pointer', padding: '0 8px', display: 'flex', alignItems: 'center',
                }}>
                  <X size={16} />
                </button>
              )}
            </div>

            <motion.button
              onClick={handleSearch}
              disabled={loading || !plate.trim()}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                width: '100%', marginTop: 10,
                background: loading ? 'var(--surface2)' : 'linear-gradient(135deg, #7c3aed, #3b82f6)',
                border: 'none', borderRadius: 14, padding: '17px 24px',
                fontSize: 17, fontWeight: 700, color: '#fff',
                cursor: loading || !plate.trim() ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                opacity: !plate.trim() ? 0.45 : 1,
                boxShadow: plate.trim() && !loading ? '0 6px 32px rgba(124,58,237,0.35)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              {loading
                ? <><div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> Identifying car…</>
                : <><Bot size={18} /> Start Selling My Car <ArrowRight size={16} /></>
              }
            </motion.button>
          </>
        )}

        {/* ── Mode: PDF upload ── */}
        {mode === 'pdf' && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              style={{ display: 'none' }}
              onChange={e => handlePdfUpload(e.target.files?.[0])}
            />
            <motion.div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => !pdfLoading && fileRef.current?.click()}
              whileHover={{ scale: pdfLoading ? 1 : 1.01 }}
              style={{
                border: `2px dashed ${pdfFile ? 'var(--accent)' : 'var(--border2)'}`,
                borderRadius: 20,
                padding: '36px 24px',
                textAlign: 'center',
                cursor: pdfLoading ? 'default' : 'pointer',
                background: pdfFile ? 'rgba(59,130,246,0.05)' : 'var(--surface)',
                transition: 'all 0.2s',
              }}
            >
              {pdfLoading ? (
                <>
                  <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3, margin: '0 auto 12px' }} />
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Reading your license…</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>Extracting all vehicle details from PDF</div>
                </>
              ) : pdfFile ? (
                <>
                  <FileCheck2 size={40} color="var(--accent)" style={{ marginBottom: 10 }} />
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{pdfFile.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>Click to change file</div>
                </>
              ) : (
                <>
                  <FileUp size={40} color="var(--muted)" style={{ marginBottom: 12 }} />
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
                    Drop your רישיון רכב here
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                    Or click to browse · <strong style={{ color: 'var(--accent2)' }}>PDF only</strong><br />
                    We'll extract make, model, year, VIN, mileage, and more automatically
                  </div>
                </>
              )}
            </motion.div>
          </>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              marginTop: 10,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 10,
              padding: '10px 14px',
              color: 'var(--red)',
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <X size={14} /> {error}
          </motion.div>
        )}

        <div style={{ marginTop: 16, textAlign: 'center', color: 'var(--muted2)', fontSize: 13 }}>
          Try an example:{' '}
          <span
            onClick={() => setPlate('1234567')}
            style={{ color: 'var(--accent2)', cursor: 'pointer', fontFamily: 'monospace', letterSpacing: 2 }}
          >
            12-345-67
          </span>
        </div>
      </motion.div>

      {/* ── Compact steps row ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.35 }}
        style={{ width: '100%', maxWidth: 620, marginBottom: 28 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, flexWrap: 'nowrap', overflowX: 'auto' }}>
          {AGENT_STEPS.map(({ icon, title }, i) => (
            <div key={title} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '7px 12px',
              }}>
                <span style={{ fontSize: 16 }}>{icon}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{title}</span>
              </div>
              {i < AGENT_STEPS.length - 1 && (
                <div style={{ color: 'var(--border2)', fontSize: 14, padding: '0 4px', flexShrink: 0 }}>›</div>
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Balcar promo strip ── */}
      <motion.a
        href={BALCAR_URL}
        target="_blank"
        rel="noreferrer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.75 }}
        whileHover={{ scale: 1.01 }}
        style={{
          marginTop: 40,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.04))',
          border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: 14,
          padding: '14px 22px',
          textDecoration: 'none',
          maxWidth: 520,
          width: '100%',
        }}
      >
        <div style={{ fontSize: 28, flexShrink: 0 }}>🛡️</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--yellow)', marginBottom: 3 }}>
            Want a full certified history report?
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            Get a Balcar report — accidents, liens, ownership history, and more. We'll link it into your analysis.
          </div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 18, color: 'var(--yellow)', flexShrink: 0 }}>→</div>
      </motion.a>

    </div>
  )
}
