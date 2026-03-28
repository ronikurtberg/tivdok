import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RotateCcw, Bot, Megaphone, MessageSquare, Globe, TrendingUp, Lock, Send, Sparkles } from 'lucide-react'
import axios from 'axios'

const SUGGESTED_QUESTIONS = [
  { icon: '💰', text: 'Is my asking price competitive?' },
  { icon: '📝', text: 'Write me a Yad2 listing title and description' },
  { icon: '🏁', text: 'What are my strongest selling points?' },
  { icon: '⏱️', text: 'How long will it take to sell?' },
  { icon: '🤝', text: 'How should I handle price negotiation?' },
  { icon: '📸', text: 'What photos should I take?' },
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

export default function StepAutopilot({ car, market, history, onRestart }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: car
        ? `Hi! I'm your personal selling advisor for this ${car.year ? car.year + ' ' : ''}${car.manufacturer || ''} ${car.model || ''}. I have your car's full data, live Yad2 market numbers, and test history loaded. Ask me anything — I'll give you specific advice based on your actual numbers, not generic tips.`
        : "Hi! I'm your personal car-selling advisor. Ask me anything about selling your car.",
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (text) => {
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
      })
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch (err) {
      const detail = err.response?.data?.detail || 'Something went wrong. Please try again.'
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${detail}` }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f5ff', padding: '0 0 100px' }}>

      {/* Top bar */}
      <div style={{
        background: '#fff', padding: '14px 20px',
        borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ fontWeight: 800, fontSize: 20, color: '#111827' }}>🤖 יועץ מכירה AI</div>
        <div style={{ fontSize: 13, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
          {car ? `${car.year || ''} ${car.manufacturer || ''} ${car.model || ''}`.trim() : 'הרכב שלך'} — מחובר לנתונים חיים
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

        {/* Done + restart */}
        <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginBottom: 6 }}>🎉 סיימתם!</div>
          <div style={{ color: 'var(--muted)', fontSize: 15, marginBottom: 20 }}>
            יש לכם את כל המידע שצריך כדי למכור נכון.
            {car?.manufacturer ? ` בהצלחה עם ה${car.manufacturer}!` : ' בהצלחה!'}
          </div>
          <button
            onClick={onRestart}
            className="btn-ghost"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 14, fontSize: 16 }}
          >
            <RotateCcw size={16} /> סרוק רכב אחר
          </button>
        </div>

      </div>
    </div>
  )
}
