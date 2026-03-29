import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Camera, X, CheckCircle2, ChevronDown, ChevronUp, Loader2, Star } from 'lucide-react'
import axios from 'axios'

/* ── tiny helpers ─────────────────────────────────────────────────────────── */
function Tag({ children, color = '#e0e8ff', text = '#1d4ed8' }) {
  return (
    <span style={{
      background: color, color: text, borderRadius: 20,
      padding: '4px 12px', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
    }}>{children}</span>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
      {children}
    </div>
  )
}

function Input({ value, onChange, type = 'text', placeholder, large }) {
  return (
    <input
      type={type}
      inputMode={type === 'number' ? 'numeric' : 'text'}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        fontSize: large ? 28 : 16, fontWeight: large ? 800 : 600,
        padding: large ? '14px 16px' : '11px 14px',
        borderRadius: 12, border: '1.5px solid #e0e8ff',
        background: '#f7f9ff', color: '#111827', width: '100%',
        outline: 'none', transition: 'border-color 0.15s',
      }}
      onFocus={e => e.target.style.borderColor = '#1d6ef5'}
      onBlur={e => e.target.style.borderColor = '#e0e8ff'}
    />
  )
}

function SegmentPicker({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map(o => {
        const active = String(value) === String(o.id)
        return (
          <button key={o.id} onClick={() => onChange(String(o.id))} style={{
            flex: 1, minWidth: 54, borderRadius: 12, padding: '12px 8px',
            cursor: 'pointer', textAlign: 'center',
            border: active ? 'none' : '1.5px solid #e0e8ff',
            background: active ? '#1d6ef5' : '#fff',
            color: active ? '#fff' : '#374151',
            boxShadow: active ? '0 4px 16px rgba(29,110,245,0.28)' : 'none',
            transition: 'all 0.15s',
          }}>
            {o.emoji && <div style={{ fontSize: 18, marginBottom: 3 }}>{o.emoji}</div>}
            <div style={{ fontSize: 14, fontWeight: 700 }}>{o.label}</div>
            {o.sub && <div style={{ fontSize: 11, opacity: 0.8, marginTop: 1 }}>{o.sub}</div>}
          </button>
        )
      })}
    </div>
  )
}

/* ── photo score badge ───────────────────────────────────────────────────── */
function ScoreBadge({ score, verdict }) {
  const colors = {
    excellent: { bg: '#dcfce7', text: '#15803d', label: 'מצוינות' },
    good:      { bg: '#dbeafe', text: '#1d4ed8', label: 'טובות' },
    average:   { bg: '#fef9c3', text: '#a16207', label: 'ממוצעות' },
    poor:      { bg: '#fee2e2', text: '#dc2626', label: 'חלשות' },
  }
  const c = colors[verdict] || colors.average
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: c.bg, borderRadius: 14, padding: '10px 16px',
    }}>
      <div style={{ fontSize: 28, fontWeight: 900, color: c.text, lineHeight: 1 }}>{score}</div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 800, color: c.text }}>תמונות {c.label}</div>
        <div style={{ fontSize: 11, color: c.text, opacity: 0.8 }}>מתוך 10</div>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
        {[1,2,3,4,5].map(i => (
          <Star key={i} size={13} fill={i <= Math.round(score / 2) ? c.text : 'transparent'} color={c.text} />
        ))}
      </div>
    </div>
  )
}

/* ── main component ───────────────────────────────────────────────────────── */
export default function StepCarDetails({ carData, onConfirm, onBack }) {
  if (!carData) return null

  const make  = carData.manufacturer_en || carData.manufacturer_heb || ''
  const model = carData.commercial_name || carData.model_en || ''
  const year  = carData.year || ''
  const color = carData.color_heb || carData.color_en || ''
  const fuel  = carData.fuel_type_heb || carData.fuel_type_en || ''

  const [fields, setFields] = useState({
    manufacturer_en: make,
    model_en:        model,
    year:            String(year),
    color_en:        color,
    fuel_type_en:    fuel,
    engine_volume:   carData.engine_volume ? String(carData.engine_volume) : '',
    body_type_en:    carData.body_type_en || '',
    doors:           carData.doors ? String(carData.doors) : '',
    hand:            carData.hand ? String(carData.hand) : '1',
    km:              carData.mileage_at_last_test ? String(carData.mileage_at_last_test) : '',
    gear_box:        carData.gear_box || 'Automatic',
    horse_power:     carData.horse_power ? String(carData.horse_power) : '',
    asking_price:    '',
    description:     '',
  })
  const set = k => v => setFields(f => ({ ...f, [k]: v }))

  const [showGov, setShowGov]       = useState(false)
  const [showAdv, setShowAdv]       = useState(false)
  const [photos, setPhotos]         = useState([])   // { url, file }
  const [photoScore, setPhotoScore] = useState(null) // { score, verdict, strengths, improvements, market_impact }
  const [scoringPhotos, setScoringPhotos] = useState(false)
  const fileRef = useRef()

  const govFields = [
    { label: 'גרסה (Trim)',     value: carData.trim },
    { label: 'סוג בעלות',       value: carData.ownership_type },
    { label: 'עלייה לכביש',     value: carData.first_registration },
    { label: 'טסט אחרון',       value: carData.last_test_date },
    { label: 'צמיגים קדמיים',   value: carData.tire_front },
    { label: 'צמיגים אחוריים',  value: carData.tire_rear },
    { label: 'VIN / שלדה',      value: carData.vin },
  ].filter(f => f.value)

  const handlePhotoPick = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 6)
    if (!files.length) return
    const previews = files.map(f => ({ url: URL.createObjectURL(f), file: f }))
    setPhotos(previews)
    setPhotoScore(null)
    setScoringPhotos(true)
    try {
      const form = new FormData()
      files.forEach(f => form.append('files', f))
      const { data } = await axios.post('/api/score-photos', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setPhotoScore(data)
    } catch {
      setPhotoScore({ score: null, verdict: null, strengths: [], improvements: ['לא ניתן לנתח — בדקו את מפתח ה-API'], market_impact: '' })
    } finally {
      setScoringPhotos(false)
    }
  }

  const removePhoto = (i) => {
    setPhotos(prev => prev.filter((_, idx) => idx !== i))
    setPhotoScore(null)
  }

  const handleConfirm = () => {
    onConfirm({ ...carData, ...fields, plate: carData?.plate })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f7f9ff', paddingBottom: 120 }}>

      {/* ── sticky top bar ── */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #e0e8ff',
        padding: '12px 20px', position: 'sticky', top: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={onBack} style={{
          background: '#f0f5ff', border: 'none', borderRadius: 10,
          padding: '8px 10px', cursor: 'pointer', display: 'flex',
        }}>
          <ArrowLeft size={18} color="#6b7280" />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: '#111827' }}>
            {make} {model} {year && `· ${year}`}
          </div>
          {carData.plate && (
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1, display: 'flex', alignItems: 'center', gap: 5 }}>
              <CheckCircle2 size={11} color="#22c55e" />
              נתונים רשמיים ממשרד התחבורה
            </div>
          )}
        </div>
        {carData.plate && (
          <div style={{
            background: '#003DA5', color: '#fff', borderRadius: 10,
            padding: '4px 12px', fontSize: 14, fontWeight: 900, letterSpacing: 2,
          }}>{carData.plate}</div>
        )}
      </div>

      <div style={{ padding: '20px 16px', maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── hero identity card ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          style={{
            background: 'linear-gradient(135deg, #1d6ef5 0%, #0f4dbf 100%)',
            borderRadius: 24, padding: '28px 24px',
            boxShadow: '0 8px 32px rgba(29,110,245,0.28)',
          }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: -1, lineHeight: 1.1 }}>
                {make}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
                {model}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 42, fontWeight: 900, color: '#fff', letterSpacing: -1 }}>{year}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {color && <Tag color="rgba(255,255,255,0.2)" text="#fff">🎨 {color}</Tag>}
            {fuel  && <Tag color="rgba(255,255,255,0.2)" text="#fff">⛽ {fuel}</Tag>}
            {fields.gear_box && <Tag color="rgba(255,255,255,0.2)" text="#fff">⚙️ {fields.gear_box === 'Automatic' ? 'אוטומט' : fields.gear_box === 'Manual' ? 'ידני' : fields.gear_box}</Tag>}
            {fields.engine_volume && <Tag color="rgba(255,255,255,0.2)" text="#fff">🔧 {fields.engine_volume}cc</Tag>}
          </div>
        </motion.div>

        {/* ── KM — hero input ── */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
          style={{ background: '#fff', borderRadius: 20, padding: '22px 20px', boxShadow: '0 2px 12px rgba(29,110,245,0.07)', border: '1.5px solid #e0e8ff' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#6b7280', marginBottom: 10 }}>
            🛣️ כמה קילומטרים על הרכב? <span style={{ color: '#ef4444' }}>*</span>
          </div>
          <Input
            type="number" large
            value={fields.km}
            onChange={set('km')}
            placeholder="85,000"
          />
          {!fields.km && (
            <div style={{ marginTop: 8, fontSize: 13, color: '#ef4444', fontWeight: 600 }}>
              חובה — הכניסו את הק"מ שמופיע על לוח המחוונים
            </div>
          )}
          {carData.mileage_at_last_test && (
            <div style={{ marginTop: 6, fontSize: 13, color: '#6b7280' }}>
              בטסט האחרון: {Number(carData.mileage_at_last_test).toLocaleString()} ק"מ
            </div>
          )}
        </motion.div>

        {/* ── owner / hand ── */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.09 }}
          style={{ background: '#fff', borderRadius: 20, padding: '22px 20px', boxShadow: '0 2px 12px rgba(29,110,245,0.07)', border: '1.5px solid #e0e8ff' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#6b7280', marginBottom: 12 }}>👤 מספר בעלים (יד)</div>
          <SegmentPicker
            value={fields.hand}
            onChange={set('hand')}
            options={[1,2,3,4,5].map(n => ({
              id: String(n),
              label: n === 5 ? '5+' : String(n),
              sub: n === 1 ? 'חדש' : n === 2 ? 'שני' : `יד ${n}`,
            }))}
          />
          <div style={{ marginTop: 8, fontSize: 13, color: '#6b7280' }}>
            {fields.hand === '1' ? 'קניתם אותו חדש — יד ראשונה' :
             fields.hand === '2' ? 'בעלים שני' :
             `יד ${fields.hand} — ${Number(fields.hand)-1} בעלים קודמים`}
          </div>
        </motion.div>

        {/* ── transmission ── */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.11 }}
          style={{ background: '#fff', borderRadius: 20, padding: '22px 20px', boxShadow: '0 2px 12px rgba(29,110,245,0.07)', border: '1.5px solid #e0e8ff' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#6b7280', marginBottom: 12 }}>⚙️ תיבת הילוכים</div>
          <SegmentPicker
            value={fields.gear_box}
            onChange={set('gear_box')}
            options={[
              { id: 'Automatic', label: 'אוטומט', emoji: '🤖' },
              { id: 'Manual',    label: 'ידני',   emoji: '🕹️' },
              { id: 'CVT',       label: 'CVT',    emoji: '〰️' },
            ]}
          />
        </motion.div>

        {/* ── asking price ── */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13 }}
          style={{ background: '#fff', borderRadius: 20, padding: '22px 20px', boxShadow: '0 2px 12px rgba(29,110,245,0.07)', border: '1.5px solid #e0e8ff' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#6b7280', marginBottom: 10 }}>
            💰 מחיר מבוקש (אופציונלי — נמצא אותו בשבילכם)
          </div>
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
              fontSize: 20, fontWeight: 800, color: '#9ca3af', pointerEvents: 'none',
            }}>₪</div>
            <input
              type="number" inputMode="numeric"
              value={fields.asking_price}
              onChange={e => set('asking_price')(e.target.value)}
              placeholder="אם יש לכם מספר בראש"
              style={{
                fontSize: 20, fontWeight: 700, padding: '14px 16px 14px 40px',
                borderRadius: 12, border: '1.5px solid #e0e8ff',
                background: '#f7f9ff', color: '#111827', width: '100%',
              }}
            />
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>
            לא חובה — ניתוח השוק יציע מחיר אופטימלי
          </div>
        </motion.div>

        {/* ── photo upload ── */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          style={{ background: '#fff', borderRadius: 20, padding: '22px 20px', boxShadow: '0 2px 12px rgba(29,110,245,0.07)', border: '1.5px solid #e0e8ff' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#6b7280', marginBottom: 4 }}>📸 תמונות הרכב</div>
          <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 14 }}>
            ה-AI שלנו ינתח את התמונות שלכם ויציין אותן מול מודעות ביד2 — כדי שתדעו אם הן עוזרות או מזיקות למכירה
          </div>

          <input ref={fileRef} type="file" multiple accept="image/*" style={{ display: 'none' }}
            onChange={handlePhotoPick} />

          {photos.length === 0 ? (
            <motion.button
              onClick={() => fileRef.current?.click()}
              whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
              style={{
                width: '100%', border: '2px dashed #c7d8ff', borderRadius: 16,
                padding: '32px 20px', cursor: 'pointer', background: '#f7f9ff',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              }}>
              <Camera size={36} color="#93c5fd" />
              <div style={{ fontSize: 16, fontWeight: 700, color: '#374151' }}>העלו תמונות של הרכב</div>
              <div style={{ fontSize: 13, color: '#9ca3af' }}>עד 6 תמונות · JPG, PNG</div>
            </motion.button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {photos.map((p, i) => (
                  <div key={i} style={{ position: 'relative', aspectRatio: '4/3', borderRadius: 12, overflow: 'hidden', background: '#e0e8ff' }}>
                    <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      onClick={() => removePhoto(i)}
                      style={{
                        position: 'absolute', top: 4, right: 4,
                        background: 'rgba(0,0,0,0.55)', border: 'none',
                        borderRadius: '50%', width: 22, height: 22,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                      }}>
                      <X size={12} color="#fff" />
                    </button>
                  </div>
                ))}
                {photos.length < 6 && (
                  <button onClick={() => fileRef.current?.click()} style={{
                    aspectRatio: '4/3', borderRadius: 12, border: '2px dashed #c7d8ff',
                    background: '#f7f9ff', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Camera size={20} color="#93c5fd" />
                  </button>
                )}
              </div>

              {scoringPhotos && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#1d6ef5', fontSize: 14, fontWeight: 600 }}>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  מנתח תמונות…
                </div>
              )}

              {photoScore && !scoringPhotos && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {photoScore.score && (
                    <ScoreBadge score={photoScore.score} verdict={photoScore.verdict} />
                  )}
                  {photoScore.market_impact && (
                    <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, padding: '10px 14px', background: '#f0f5ff', borderRadius: 12 }}>
                      {photoScore.market_impact}
                    </div>
                  )}
                  {photoScore.strengths?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#15803d', marginBottom: 4 }}>✅ חוזקות</div>
                      {photoScore.strengths.map((s, i) => (
                        <div key={i} style={{ fontSize: 13, color: '#374151', marginBottom: 3 }}>· {s}</div>
                      ))}
                    </div>
                  )}
                  {photoScore.improvements?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#d97706', marginBottom: 4 }}>💡 שיפורים</div>
                      {photoScore.improvements.map((s, i) => (
                        <div key={i} style={{ fontSize: 13, color: '#374151', marginBottom: 3 }}>· {s}</div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          )}
        </motion.div>

        {/* ── description ── */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.17 }}
          style={{ background: '#fff', borderRadius: 20, padding: '22px 20px', boxShadow: '0 2px 12px rgba(29,110,245,0.07)', border: '1.5px solid #e0e8ff' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#6b7280', marginBottom: 10 }}>
            📝 הערות על הרכב (אופציונלי)
          </div>
          <textarea
            value={fields.description}
            onChange={e => set('description')(e.target.value)}
            placeholder="שירות מסודר, טיפולים במוסך מורשה, ריפוד חדש…"
            rows={3}
            style={{
              fontSize: 15, padding: '12px 14px', borderRadius: 12,
              border: '1.5px solid #e0e8ff', background: '#f7f9ff',
              color: '#111827', width: '100%', resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 5 }}>
            הערות אלו יועברו ל-AI ויעזרו לתמחר ולשווק נכון
          </div>
        </motion.div>

        {/* ── gov data collapsible ── */}
        {govFields.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.19 }}>
            <button
              onClick={() => setShowGov(v => !v)}
              style={{
                width: '100%', background: '#fff', border: '1.5px solid #e0e8ff',
                borderRadius: showGov ? '16px 16px 0 0' : 16,
                padding: '16px 20px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#374151' }}>
                🏛️ נתונים ממשרד התחבורה
              </span>
              {showGov ? <ChevronUp size={18} color="#9ca3af" /> : <ChevronDown size={18} color="#9ca3af" />}
            </button>
            <AnimatePresence>
              {showGov && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
                  <div style={{
                    background: '#fff', border: '1.5px solid #e0e8ff', borderTop: 'none',
                    borderRadius: '0 0 16px 16px', padding: '16px 20px',
                    display: 'flex', flexDirection: 'column', gap: 0,
                  }}>
                    {govFields.map(({ label, value }) => (
                      <div key={label} style={{
                        display: 'flex', justifyContent: 'space-between',
                        padding: '10px 0', borderBottom: '1px solid #f0f5ff',
                      }}>
                        <div style={{ fontSize: 13, color: '#9ca3af', fontWeight: 600 }}>{label}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>{value}</div>
                      </div>
                    ))}
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 10, lineHeight: 1.6 }}>
                      פרטי הבעלים מוגנים על פי חוק ואינם מוצגים.
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── advanced editable fields ── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <button
            onClick={() => setShowAdv(v => !v)}
            style={{
              width: '100%', background: '#fff', border: '1.5px solid #e0e8ff',
              borderRadius: showAdv ? '16px 16px 0 0' : 16,
              padding: '16px 20px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#374151' }}>
              🔧 עריכת פרטים (אופציונלי)
            </span>
            {showAdv ? <ChevronUp size={18} color="#9ca3af" /> : <ChevronDown size={18} color="#9ca3af" />}
          </button>
          <AnimatePresence>
            {showAdv && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
                <div style={{
                  background: '#fff', border: '1.5px solid #e0e8ff', borderTop: 'none',
                  borderRadius: '0 0 16px 16px', padding: '20px',
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16,
                }}>
                  {[
                    { label: 'יצרן', key: 'manufacturer_en', type: 'text' },
                    { label: 'דגם', key: 'model_en', type: 'text' },
                    { label: 'שנה', key: 'year', type: 'number' },
                    { label: 'מנוע (cc)', key: 'engine_volume', type: 'number' },
                    { label: 'כוח סוס', key: 'horse_power', type: 'number' },
                    { label: 'דלתות', key: 'doors', type: 'number' },
                  ].map(({ label, key, type }) => (
                    <Field key={key} label={label}>
                      <Input type={type} value={fields[key]} onChange={set(key)} />
                    </Field>
                  ))}
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
          transition={{ delay: 0.22 }}
          whileTap={{ scale: 0.97 }}
          style={{
            width: '100%', padding: '20px',
            background: fields.km
              ? 'linear-gradient(135deg, #1d6ef5 0%, #0f4dbf 100%)'
              : '#c7d8ff',
            border: 'none', borderRadius: 18,
            fontSize: 19, fontWeight: 800, color: '#fff',
            cursor: fields.km ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            boxShadow: fields.km ? '0 8px 28px rgba(29,110,245,0.38)' : 'none',
            transition: 'all 0.2s',
          }}>
          {fields.km
            ? <>המשך לניתוח שוק <ArrowRight size={20} /></>
            : <>הכניסו קילומטרים כדי להמשיך</>}
        </motion.button>

      </div>
    </div>
  )
}
