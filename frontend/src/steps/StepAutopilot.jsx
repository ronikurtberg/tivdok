import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RotateCcw, Bot, Megaphone, MessageSquare, Globe, TrendingUp, Lock, Send, Sparkles } from 'lucide-react'
import axios from 'axios'

const SUGGESTED_QUESTIONS = [
  { icon: '💰', text: 'המחיר שלי תחרותי?' },
  { icon: '📝', text: 'כתוב לי כותרת ותיאור למודעה ביד2' },
  { icon: '🏁', text: 'מה נקודות המכירה החזקות שלי?' },
  { icon: '⏱️', text: 'כמה זמן ייקח למכור?' },
  { icon: '🤝', text: 'איך להתמודד עם הורדת מחיר?' },
  { icon: '📸', text: 'אילו תמונות כדאי לצלם?' },
]

const FEATURES = [
  {
    icon: Megaphone,
    title: 'Auto-publish listing',
    desc: 'Agent writes the perfect ad copy and publishes to Yad2, Facebook Marketplace, and more.',
  },
  {
    icon: MessageSquare,
    title: 'Manage buyer inquiries',
    desc: 'AI responds 24/7, qualifies serious buyers, answers questions, and schedules viewings.',
  },
  {
    icon: TrendingUp,
    title: 'Dynamic price optimizer',
    desc: 'Monitors market daily and adjusts your price to stay competitive automatically.',
  },
  {
    icon: Globe,
    title: 'Multi-platform coverage',
    desc: 'Yad2, Facebook, Instagram, WhatsApp groups — your listing spreads everywhere.',
  },
]

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 2px' }}>
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
          style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--muted)' }}
        />
      ))}
    </div>
  )
}

function ChatMessage({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 12,
      }}
    >
      {!isUser && (
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(59,130,246,0.3))',
          border: '1px solid rgba(124,58,237,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginRight: 8, marginTop: 2,
        }}>
          <Bot size={14} color="#a78bfa" />
        </div>
      )}
      <div style={{
        maxWidth: '80%',
        padding: '10px 14px',
        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        background: isUser
          ? 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(59,130,246,0.2))'
          : 'var(--surface)',
        border: isUser
          ? '1px solid rgba(124,58,237,0.35)'
          : '1px solid var(--border)',
        fontSize: 13.5,
        lineHeight: 1.65,
        color: 'var(--text)',
        whiteSpace: 'pre-wrap',
      }}>
        {msg.content}
      </div>
    </motion.div>
  )
}

function buildAutoGreeting(car, market) {
  const mkt = market?.market || market
  const hasMarket = mkt && mkt.count > 0
  if (!car || !hasMarket) return null

  const carName = [car.year, car.manufacturer_en || car.manufacturer, car.model_en || car.model].filter(Boolean).join(' ')
  const median = mkt.median_price
  const count = mkt.count
  const askingPrice = car.asking_price ? Number(car.asking_price) : null
  const km = car.km ? Number(car.km) : null
  const avgKm = mkt.avg_km ? Number(mkt.avg_km) : null

  const lines = [`היי! אני יועץ המכירה שלך ל${carName}.`, '']

  if (median && askingPrice) {
    const diffPct = Math.round(((askingPrice - median) / median) * 100)
    if (diffPct > 5)
      lines.push(`💡 המחיר שביקשת (₪${askingPrice.toLocaleString()}) גבוה ב-${diffPct}% מהחציון של השוק (₪${Math.round(median).toLocaleString()}). ייתכן שזה יאט את המכירה — שווה לבדוק.`)
    else if (diffPct < -5)
      lines.push(`✅ המחיר שלך (₪${askingPrice.toLocaleString()}) נמוך ב-${Math.abs(diffPct)}% מהחציון — רכב טוב לדיל. יש סיכוי שמכרת בזול.`)
    else
      lines.push(`✅ המחיר שלך (₪${askingPrice.toLocaleString()}) ממוקם מצוין — ±${Math.abs(diffPct)}% מהחציון (₪${Math.round(median).toLocaleString()}) מתוך ${count} מודעות.`)
  } else if (median) {
    lines.push(`📊 סרקתי ${count} מודעות. חציון השוק עומד על ₪${Math.round(median).toLocaleString()}.`)
  }

  if (km && avgKm) {
    const kmDiff = km - avgKm
    if (kmDiff < -10000)
      lines.push(`🔋 ק"מ נמוך משמעותית מהממוצע (${km.toLocaleString()} לעומת ${Math.round(avgKm).toLocaleString()} ממוצע שוק) — זו נקודת מכירה חזקה, כדאי להדגיש.`)
    else if (kmDiff > 15000)
      lines.push(`⚠️ הק"מ שלך (${km.toLocaleString()}) גבוה מהממוצע (${Math.round(avgKm).toLocaleString()}) — קונים עשויים לנהל משא ומתן. היה מוכן.`)
  }

  lines.push('', 'שאל אותי כל דבר — אני כאן כדי לעזור לך למכור נכון.')
  return lines.join('\n')
}

export default function StepAutopilot({ car, market, history, provider = 'openai', onProviderChange, onRestart, onHabasta, onAgentBuilder, onLobby }) {
  const autoGreeting = buildAutoGreeting(car, market)
  const staticGreeting = car
    ? `היי! אני יועץ המכירה האישי שלך לרכב זה. שאל אותי כל דבר.`
    : 'היי! אני יועץ מכירת רכב. שאל אותי כל דבר.'

  const [messages, setMessages] = useState([
    { role: 'assistant', content: autoGreeting || staticGreeting },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const autoFiredRef = useRef(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = useCallback(async (text) => {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setLoading(true)
    try {
      const { data } = await axios.post('/api/chat', {
        message: msg,
        car: car || null,
        market: market || null,
        official_price: market?.official_price || null,
        history: history || null,
        provider,
      })
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply, provider: data.provider }])
    } catch (err) {
      const detail = err.response?.data?.detail || 'Something went wrong. Please try again.'
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${detail}` }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [input, loading, car, market, history])

  useEffect(() => {
    if (autoFiredRef.current || !autoGreeting) return
    const mkt = market?.market || market
    if (!mkt?.count) return
    autoFiredRef.current = true
    const initQ = car?.asking_price
      ? 'תן לי ניתוח קצר של מיקום המחיר שלי בשוק והמלצה אחת עיקרית לפני שמתחיל.'
      : 'תן לי סיכום קצר של השוק הנוכחי והמלצה אחת עיקרית לפני שמתחיל.'
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const { data } = await axios.post('/api/chat', {
          message: initQ,
          car: car || null,
          market: market || null,
          official_price: market?.official_price || null,
          history: history || null,
          provider,
        })
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply, provider: data.provider }])
      } catch {}
      finally { setLoading(false) }
    }, 900)
    return () => clearTimeout(timer)
  }, [])

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f5ff', padding: '0 0 100px' }}>

      {/* Top bar */}
      <div style={{
        background: '#fff', padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#111827' }}>🤖 יועץ מכירה AI</div>
            <div style={{ fontSize: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }} />
              {car ? `${car.year || ''} ${car.manufacturer_en || car.manufacturer || ''} ${car.model_en || car.model || ''}`.trim() : 'הרכב שלך'} — נתונים חיים
            </div>
          </div>
          {onProviderChange && (
            <div style={{ display: 'flex', background: '#f0f5ff', borderRadius: 12, padding: 3, gap: 2 }}>
              {[
                { id: 'openai', label: 'GPT', icon: '🟢' },
                { id: 'claude', label: 'Claude', icon: '🟠' },
              ].map(p => {
                const active = provider === p.id
                return (
                  <button key={p.id} onClick={() => onProviderChange(p.id)} style={{
                    padding: '6px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: active ? '#fff' : 'transparent',
                    color: active ? '#111827' : '#9ca3af',
                    fontWeight: active ? 700 : 500, fontSize: 13,
                    boxShadow: active ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.15s',
                  }}>
                    {p.icon} {p.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Chat panel */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
          style={{ padding: 0, overflow: 'hidden' }}
        >
          {/* Messages area */}
          <div style={{ height: 340, overflowY: 'auto', padding: '16px 16px 8px' }}>
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => <ChatMessage key={i} msg={msg} />)}
            </AnimatePresence>
            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: '#e0e7ff', border: '1px solid #c7d2fe',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Bot size={14} color="#4f46e5" />
                </div>
                <div style={{
                  padding: '10px 14px', borderRadius: '16px 16px 16px 4px',
                  background: '#f1f5f9', border: '1px solid var(--border)',
                }}>
                  <TypingDots />
                </div>
              </motion.div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggested questions */}
          <div style={{
            padding: '10px 14px',
            borderTop: '1px solid var(--border)',
            display: 'flex', gap: 6, flexWrap: 'wrap',
            background: '#f8faff',
          }}>
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q.text}
                onClick={() => sendMessage(q.text)}
                disabled={loading}
                style={{
                  fontSize: 13, fontWeight: 500,
                  background: '#fff',
                  border: '1.5px solid #c7d2fe',
                  color: '#4f46e5', borderRadius: 20,
                  padding: '6px 12px', cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4,
                  transition: 'all 0.15s',
                  opacity: loading ? 0.5 : 1,
                }}
              >
                {q.icon} {q.text}
              </button>
            ))}
          </div>

          {/* Input */}
          <div style={{
            padding: '12px 14px',
            borderTop: '1px solid var(--border)',
            display: 'flex', gap: 8,
            background: '#fff',
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="שאלו אותי כל דבר על המכירה… (Enter לשליחה)"
              disabled={loading}
              style={{
                flex: 1, fontSize: 16, borderRadius: 12,
                background: '#f7f9ff', border: '1.5px solid #c7d2fe',
                color: '#111827', padding: '12px 14px',
                outline: 'none',
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              style={{
                background: input.trim() && !loading ? '#1d6ef5' : '#c7d8ff',
                border: 'none', borderRadius: 12, padding: '12px 16px',
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 700,
                color: '#fff', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s',
              }}
            >
              <Send size={16} />
            </button>
          </div>
        </motion.div>

        {/* Coming soon features */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
          }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 700,
              color: '#92400e',
              background: '#fffbeb', border: '1px solid #fcd34d',
              padding: '4px 14px', borderRadius: 20,
            }}>
              <Lock size={11} /> Autopilot — בקרוב
            </div>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.06 }}
                className="card"
                style={{ opacity: 0.7, display: 'flex', alignItems: 'flex-start', gap: 14 }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: '#e0e7ff', border: '1px solid #c7d2fe',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <f.icon size={18} color="#4f46e5" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 3 }}>{f.title}</div>
                  <div style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.5 }}>{f.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* הבסטה CTA */}
        {onHabasta && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            style={{
              background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
              borderRadius: 16, padding: '20px', border: '1px solid #4338ca', textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 6 }}>⚔️</div>
            <div style={{ fontWeight: 800, fontSize: 17, color: '#fff', marginBottom: 6 }}>הבסטה — זירת הסוכנים</div>
            <div style={{ fontSize: 13, color: '#a5b4fc', marginBottom: 16, lineHeight: 1.6 }}>
              שלח סוכן AI לנהל את המשא ומתן בשמך.<br />
              קונים עם סוכנים משלהם — עסקאות נסגרות אוטומטית.
            </div>
            <button onClick={onHabasta} style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              border: 'none', borderRadius: 12, padding: '12px 28px',
              color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer',
            }}>
              ⚔️ כנס להבסטה
            </button>
          </motion.div>
        )}

        {/* Agent Builder CTA */}
        {onAgentBuilder && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            style={{
              background: 'linear-gradient(135deg, #1e1035, #2d1b69)',
              borderRadius: 16, padding: '20px', border: '1px solid #6d28d9', textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 6 }}>⚡</div>
            <div style={{ fontWeight: 800, fontSize: 17, color: '#fff', marginBottom: 6 }}>חנות הכישורים</div>
            <div style={{ fontSize: 13, color: '#c4b5fd', marginBottom: 16, lineHeight: 1.6 }}>
              צייד את הסוכן שלך בסופרפאוורים.<br />
              WhatsApp אוטומטי, פרסום מרובה-פלטפורמות, מחיר דינמי ועוד.
            </div>
            <button onClick={onAgentBuilder} style={{
              background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              border: 'none', borderRadius: 12, padding: '12px 28px',
              color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer',
            }}>
              ⚡ בנה את הסוכן שלך
            </button>
          </motion.div>
        )}

        {/* Dealer Lobby CTA */}
        {onLobby && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42 }}
            style={{
              background: 'linear-gradient(135deg, #0c1a2e, #0f2744)',
              borderRadius: 16, padding: '20px', border: '1px solid #1e40af', textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 6 }}>🏪</div>
            <div style={{ fontWeight: 800, fontSize: 17, color: '#fff', marginBottom: 6 }}>לובי הדילרים</div>
            <div style={{ fontSize: 13, color: '#93c5fd', marginBottom: 16, lineHeight: 1.6 }}>
              גש לסוכני AI של מוכרי רכב — כל אחד עם אישיות ייחודית.<br />
              יוסי מפ"ת, מירי מת"א, ג'קי מחדרה — התמקח ונסה לסגור עסקה.
            </div>
            <button onClick={onLobby} style={{
              background: 'linear-gradient(135deg, #1d4ed8, #1e40af)',
              border: 'none', borderRadius: 12, padding: '12px 28px',
              color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer',
            }}>
              🏪 כנס ללובי
            </button>
          </motion.div>
        )}

        {/* Done + restart */}
        <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginBottom: 6 }}>🎉 סיימתם!</div>
          <div style={{ color: 'var(--muted)', fontSize: 15, marginBottom: 20 }}>
            יש לכם את כל המידע שצריך כדי למכור נכון.
            {car?.manufacturer ? ` בהצלחה עם ה${car.manufacturer}!` : ' בהצלחה!'}
          </div>
          <button onClick={onRestart} className="btn-ghost"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 14, fontSize: 16 }}>
            <RotateCcw size={16} /> סרוק רכב אחר
          </button>
        </div>

      </div>
    </div>
  )
}
