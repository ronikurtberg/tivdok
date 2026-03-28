import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Search, ArrowRight, X, FileUp, FileCheck2 } from 'lucide-react'
import axios from 'axios'

const HOW_IT_WORKS = [
  { icon: '🔍', title: 'הכניסו מספר רכב', sub: 'פשוט כמו גוגל' },
  { icon: '📊', title: 'מקבלים ניתוח שוק', sub: 'ממודעות אמיתיות ביד2' },
  { icon: '💰', title: 'יודעים מה לבקש', sub: 'מחיר הוגן ומנצח' },
]

export default function StepLanding({ onFound }) {
  const [plate, setPlate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [pdfFile, setPdfFile] = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [mode, setMode] = useState('plate')
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
      setError(e.response?.data?.detail || 'לא מצאנו את הרכב. בדקו את המספר ונסו שוב.')
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
        setError('לא מצאנו מספר רכב בקובץ. נסו להקליד את המספר ידנית.')
        setPdfLoading(false)
        return
      }
      try {
        const { data: govData } = await axios.get(`/api/plate/${data.plate}`)
        const merged = { ...govData, ...Object.fromEntries(
          Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== '')
        )}
        onFound(merged)
      } catch {
        onFound(data)
      }
    } catch (e) {
      setError(e.response?.data?.detail || 'לא הצלחנו לקרוא את הקובץ. ודאו שמדובר ברישיון רכב ישראלי (PDF).')
      setPdfLoading(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file?.type === 'application/pdf') handlePdfUpload(file)
    else setError('יש להעלות קובץ PDF בלבד.')
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '48px 24px 80px',
      background: 'linear-gradient(180deg, #f0f5ff 0%, #ffffff 340px)',
    }}>

      {/* ── Logo / Brand ── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ marginBottom: 48, textAlign: 'center' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 36 }}>🚗</span>
          <span style={{
            fontSize: 36, fontWeight: 900, color: '#1d6ef5', letterSpacing: -1,
          }}>Tivdok</span>
          <span style={{ fontSize: 28 }}>|</span>
          <span style={{ fontSize: 26, fontWeight: 700, color: '#111827', letterSpacing: -0.5 }}>תבדוק</span>
        </div>
        <div style={{ fontSize: 16, color: '#6b7280', fontWeight: 500 }}>
          מכור את הרכב שלך במחיר הנכון — בלי לנחש
        </div>
      </motion.div>

      {/* ── Hero ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        style={{ textAlign: 'center', maxWidth: 600, marginBottom: 40 }}
      >
        <h1 style={{
          fontSize: 48, fontWeight: 900, letterSpacing: -1.5,
          lineHeight: 1.1, color: '#111827', marginBottom: 16,
        }}>
          כמה שווה<br />
          <span style={{ color: '#1d6ef5' }}>הרכב שלך?</span>
        </h1>

        <p style={{ fontSize: 20, color: '#4b5563', lineHeight: 1.6, marginBottom: 0 }}>
          הכניסו מספר רכב — נסרוק מאות מודעות ביד2 בזמן אמת
          ונגיד לכם בדיוק מה לבקש.
        </p>
      </motion.div>

      {/* ── Input Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        style={{
          width: '100%', maxWidth: 520, marginBottom: 48,
          background: '#fff',
          borderRadius: 24,
          boxShadow: '0 4px 32px rgba(29,110,245,0.12), 0 1px 4px rgba(0,0,0,0.06)',
          padding: '28px 28px 24px',
          border: '1px solid #e0e8ff',
        }}
      >
        {/* Mode tabs */}
        <div style={{
          display: 'flex', background: '#f0f5ff', borderRadius: 12,
          padding: 4, marginBottom: 20,
        }}>
          {[
            { key: 'plate', icon: <Search size={15} />, label: 'מספר רכב' },
            { key: 'pdf',   icon: <FileUp size={15} />, label: 'רישיון רכב PDF' },
          ].map(({ key, icon, label }) => (
            <button
              key={key}
              onClick={() => { setMode(key); setError(null) }}
              style={{
                flex: 1, border: 'none', borderRadius: 9, padding: '11px 14px',
                fontSize: 15, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                transition: 'all 0.18s',
                background: mode === key ? '#1d6ef5' : 'transparent',
                color: mode === key ? '#fff' : '#6b7280',
                boxShadow: mode === key ? '0 2px 10px rgba(29,110,245,0.3)' : 'none',
              }}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* Plate input */}
        {mode === 'plate' && (
          <>
            <div style={{
              background: '#f7f9ff',
              border: '2px solid #c7d8ff',
              borderRadius: 16,
              padding: '6px 6px 6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 14,
            }}>
              <div style={{
                background: '#003DA5', borderRadius: 10, width: 46, height: 46,
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 1, flexShrink: 0,
              }}>
                <span style={{ fontSize: 20 }}>🇮🇱</span>
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
                  fontSize: 32, fontWeight: 800, letterSpacing: 5,
                  color: '#111827', outline: 'none', textAlign: 'center',
                  padding: '6px 0', caretColor: '#1d6ef5', width: '100%',
                }}
              />
              {plate && (
                <button onClick={() => setPlate('')} style={{
                  background: '#eef0f4', border: 'none', color: '#6b7280',
                  cursor: 'pointer', padding: '8px', borderRadius: 8,
                  display: 'flex', alignItems: 'center',
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
                width: '100%',
                background: loading || !plate.trim() ? '#c7d8ff' : '#1d6ef5',
                border: 'none', borderRadius: 14, padding: '18px 24px',
                fontSize: 19, fontWeight: 800, color: '#fff',
                cursor: loading || !plate.trim() ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                boxShadow: plate.trim() && !loading ? '0 6px 24px rgba(29,110,245,0.35)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              {loading
                ? <><div className="spinner" style={{ width: 22, height: 22, borderWidth: 2, borderColor: '#fff3', borderTopColor: '#fff' }} /> מחפש את הרכב…</>
                : <>בדוק את הרכב שלי <ArrowRight size={18} /></>
              }
            </motion.button>

            <div style={{ marginTop: 12, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
              דוגמה:{' '}
              <span
                onClick={() => setPlate('1234567')}
                style={{ color: '#1d6ef5', cursor: 'pointer', fontWeight: 700, letterSpacing: 2 }}
              >
                12-345-67
              </span>
            </div>
          </>
        )}

        {/* PDF upload */}
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
                border: `2px dashed ${pdfFile ? '#1d6ef5' : '#c7d8ff'}`,
                borderRadius: 16,
                padding: '40px 24px',
                textAlign: 'center',
                cursor: pdfLoading ? 'default' : 'pointer',
                background: pdfFile ? '#f0f5ff' : '#f7f9ff',
                transition: 'all 0.2s',
              }}
            >
              {pdfLoading ? (
                <>
                  <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3, margin: '0 auto 14px', borderColor: '#c7d8ff', borderTopColor: '#1d6ef5' }} />
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#111827', marginBottom: 6 }}>קורא את הרישיון…</div>
                  <div style={{ fontSize: 15, color: '#6b7280' }}>מחלץ את כל פרטי הרכב מהקובץ</div>
                </>
              ) : pdfFile ? (
                <>
                  <FileCheck2 size={44} color="#1d6ef5" style={{ marginBottom: 12 }} />
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{pdfFile.name}</div>
                  <div style={{ fontSize: 14, color: '#6b7280' }}>לחצו להחלפת קובץ</div>
                </>
              ) : (
                <>
                  <FileUp size={44} color="#c7d8ff" style={{ marginBottom: 14 }} />
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
                    גררו לכאן את רישיון הרכב שלכם
                  </div>
                  <div style={{ fontSize: 15, color: '#6b7280', lineHeight: 1.6 }}>
                    או <strong style={{ color: '#1d6ef5' }}>לחצו לבחירת קובץ</strong> · PDF בלבד<br />
                    נחלץ יצרן, דגם, שנה, ק"מ ועוד אוטומטית
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
              marginTop: 14,
              background: '#fff5f5',
              border: '1px solid #fecaca',
              borderRadius: 10,
              padding: '12px 16px',
              color: '#dc2626',
              fontSize: 15,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontWeight: 500,
            }}
          >
            <X size={16} /> {error}
          </motion.div>
        )}
      </motion.div>

      {/* ── How it works ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.35 }}
        style={{ width: '100%', maxWidth: 560, marginBottom: 44 }}
      >
        <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 18 }}>
          איך זה עובד
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {HOW_IT_WORKS.map(({ icon, title, sub }, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              <div style={{
                background: '#fff',
                border: '1.5px solid #dde8ff',
                borderRadius: 16,
                padding: '16px 20px',
                textAlign: 'center',
                minWidth: 140,
                boxShadow: '0 2px 8px rgba(29,110,245,0.06)',
              }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 3 }}>{title}</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>{sub}</div>
              </div>
              {i < HOW_IT_WORKS.length - 1 && (
                <div style={{ fontSize: 20, color: '#c7d8ff', padding: '0 4px' }}>›</div>
              )}
            </div>
          ))}
        </div>
      </motion.div>

    </div>
  )
}
