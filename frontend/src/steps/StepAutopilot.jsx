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
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(124,58,237,0.07) 0%, transparent 65%), var(--bg)',
      padding: '40px 24px 100px',
    }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            background: 'rgba(124,58,237,0.12)', color: '#a78bfa',
            border: '1px solid rgba(124,58,237,0.3)',
            padding: '4px 14px', borderRadius: 20, marginBottom: 14,
          }}>
            <Sparkles size={11} /> AI Advisor — Powered by your data
          </div>
          <h1 style={{ fontSize: 38, fontWeight: 900, letterSpacing: -1.5, lineHeight: 1.1, marginBottom: 10 }}>
            Your Personal<br />
            <span style={{ color: '#a78bfa' }}>Car Selling Advisor</span>
          </h1>
          <p style={{ fontSize: 15, color: 'var(--muted)', maxWidth: 500, margin: '0 auto', lineHeight: 1.6 }}>
            Unlike ChatGPT, this advisor knows <strong style={{ color: '#fff' }}>your specific car</strong>, your live market data,
            and your test history. Ask questions only an insider agent can answer.
          </p>
        </motion.div>

        {/* Chat panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            marginBottom: 28,
            overflow: 'hidden',
          }}
        >
          {/* Chat header */}
          <div style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'linear-gradient(90deg, rgba(124,58,237,0.07) 0%, transparent 100%)',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(124,58,237,0.35), rgba(59,130,246,0.3))',
              border: '1px solid rgba(124,58,237,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Bot size={16} color="#a78bfa" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Car Selling Advisor</div>
              <div style={{ fontSize: 11, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }} />
                Live context loaded — {car ? `${car.year || ''} ${car.manufacturer || ''} ${car.model || ''}`.trim() : 'your car'}
                {market?.count ? ` · ${market.count} market listings` : ''}
              </div>
            </div>
          </div>

          {/* Messages area */}
          <div style={{
            height: 360, overflowY: 'auto', padding: '18px 18px 8px',
          }}>
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => <ChatMessage key={i} msg={msg} />)}
            </AnimatePresence>
            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(59,130,246,0.3))',
                  border: '1px solid rgba(124,58,237,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Bot size={14} color="#a78bfa" />
                </div>
                <div style={{
                  padding: '10px 14px', borderRadius: '16px 16px 16px 4px',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                }}>
                  <TypingDots />
                </div>
              </motion.div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggested questions */}
          <div style={{
            padding: '8px 14px',
            borderTop: '1px solid var(--border)',
            display: 'flex', gap: 6, flexWrap: 'wrap',
          }}>
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q.text}
                onClick={() => sendMessage(q.text)}
                disabled={loading}
                style={{
                  fontSize: 11.5, fontWeight: 500,
                  background: 'rgba(124,58,237,0.08)',
                  border: '1px solid rgba(124,58,237,0.2)',
                  color: '#c4b5fd', borderRadius: 20,
                  padding: '4px 10px', cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4,
                  transition: 'all 0.15s',
                  opacity: loading ? 0.5 : 1,
                }}
                onMouseEnter={e => { if (!loading) e.target.style.background = 'rgba(124,58,237,0.18)' }}
                onMouseLeave={e => { e.target.style.background = 'rgba(124,58,237,0.08)' }}
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
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask anything about your sale… (Enter to send)"
              disabled={loading}
              style={{
                flex: 1, fontSize: 13.5, borderRadius: 10,
                background: 'var(--bg)', border: '1px solid var(--border)',
                color: 'var(--text)', padding: '10px 14px',
                outline: 'none',
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="btn-primary"
              style={{
                borderRadius: 10, padding: '10px 14px',
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
                opacity: loading || !input.trim() ? 0.5 : 1,
              }}
            >
              <Send size={14} /> Send
            </button>
          </div>
        </motion.div>

        {/* Coming soon features */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
          }}>
            <div style={{
              flex: 1, height: 1, background: 'var(--border)',
            }} />
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'var(--yellow)',
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
              padding: '4px 12px', borderRadius: 20,
            }}>
              <Lock size={10} /> Autopilot Mode — Coming Soon
            </div>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 32 }}>
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.07 }}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 14, padding: '16px 18px',
                  position: 'relative', overflow: 'hidden', opacity: 0.65,
                }}
              >
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'rgba(10,10,11,0.4)', backdropFilter: 'blur(1px)',
                  borderRadius: 14,
                }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 8,
                    background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <f.icon size={16} color="var(--accent2)" />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{f.title}</div>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>{f.desc}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Done + restart */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          style={{ textAlign: 'center' }}
        >
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>🎉 You're all set!</div>
          <div style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20 }}>
            You know your car's history, market position, and ideal asking price.
            {car?.manufacturer ? ` Good luck selling your ${car.manufacturer}!` : ' Good luck with your sale!'}
          </div>
          <button
            onClick={onRestart}
            className="btn-ghost"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px', borderRadius: 12 }}
          >
            <RotateCcw size={14} /> Scan another car
          </button>
        </motion.div>

      </div>
    </div>
  )
}
