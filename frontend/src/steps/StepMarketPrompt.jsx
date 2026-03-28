import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

export default function StepMarketPrompt({ car, onScan, onSkip }) {
  const mfr = car?.manufacturer_en || ''
  let mdl = car?.commercial_name || car?.model_en || ''
  if (mfr && mdl.toLowerCase().startsWith(mfr.toLowerCase())) mdl = mdl.slice(mfr.length).trim()

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '32px 20px 80px',
      background: 'linear-gradient(180deg, #f0f5ff 0%, #fff 300px)',
    }}>
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 20 }}>

        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>📊</div>
          <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: -1, lineHeight: 1.15, color: '#111827', marginBottom: 10 }}>
            כמה מוכרים אחרים<br />
            <span style={{ color: '#1d6ef5' }}>מבקשים על {mfr} {mdl}?</span>
          </h1>
          <p style={{ fontSize: 18, color: '#4b5563', lineHeight: 1.6 }}>
            נסרוק עכשיו מאות מודעות ביד2 ונראה לכם בדיוק
            כמה שווה הרכב שלכם בשוק — עכשיו, היום.
          </p>
        </motion.div>

        {/* What you get — simple list */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="card"
          style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 0 }}
        >
          {[
            { e: '🧹', t: 'מסננים מודעות ללא מחיר, ללא ק"מ, ועם סטיות קיצוניות', sub: 'רק נתונים שניתן לסמוך עליהם' },
            { e: '🔍', t: 'רואים את כל הרכבים שהשתמשנו בהם', sub: 'מחיר, ק"מ, פרטי — שקיפות מלאה' },
            { e: '📍', t: 'איפה הרכב שלכם עומד בשוק', sub: 'לא ממוצע גנרי — רכבים דומים לשלכם' },
            { e: '💡', t: 'המחיר המוצע מוסבר — לא מופיע סתם', sub: 'כל החלטה מנומקת' },
            { e: '🤖', t: 'AI שמכיר את הנתונים שלכם', sub: 'שאלו כל שאלה — תקבלו תשובה ספציפית' },
          ].map(({ e, t, sub }, i, arr) => (
            <div key={t} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              padding: '12px 0',
              borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <span style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>{e}</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{t}</div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 1 }}>{sub}</div>
              </div>
            </div>
          ))}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <motion.button
            className="btn-primary"
            onClick={onScan}
            whileTap={{ scale: 0.97 }}
            style={{ width: '100%', padding: '18px', fontSize: 19, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
          >
            בדוק את השוק עכשיו <ArrowRight size={18} />
          </motion.button>
          <button onClick={onSkip} className="btn-ghost"
            style={{ width: '100%', padding: '14px', fontSize: 16, borderRadius: 14 }}>
            דלג — אני יודע את המחיר
          </button>
        </motion.div>

        <div style={{ fontSize: 13, color: '#9ca3af' }}>
          ⚡ סורק יד2 בזמן אמת · בדרך כלל 10–30 שניות
        </div>
      </div>
    </div>
  )
}
