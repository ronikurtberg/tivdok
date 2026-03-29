import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import StepLanding from './steps/StepLanding.jsx'
import StepCarDetails from './steps/StepCarDetails.jsx'
import StepMarketPrompt from './steps/StepMarketPrompt.jsx'
import StepHistory from './steps/StepHistory.jsx'
import StepMarket from './steps/StepMarket.jsx'
import StepPrice from './steps/StepPrice.jsx'
import StepAutopilot from './steps/StepAutopilot.jsx'

const STEPS = [
  'landing', 'car-details', 'market-prompt',
  'history', 'market', 'price', 'autopilot',
]

const STEP_META = [
  { label: 'התחלה',    icon: '🏠', mins: 0 },
  { label: 'פרטי רכב', icon: '🚗', mins: 1 },
  { label: 'שוק?',     icon: '📊', mins: 2 },
  { label: 'היסטוריה', icon: '📋', mins: 3 },
  { label: 'מודעות',   icon: '📈', mins: 4 },
  { label: 'מחיר',     icon: '💰', mins: 5 },
  { label: 'יועץ',     icon: '🤖', mins: 6 },
]

function CarBadge({ car }) {
  if (!car) return null
  const plate = car.plate || ''
  const name = [car.year, car.manufacturer_en || car.manufacturer, car.model_en || car.model]
    .filter(Boolean).join(' ')
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        position: 'fixed', top: 8, right: 12, zIndex: 300,
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)',
        border: '1.5px solid #dde8ff',
        borderRadius: 40, padding: '5px 14px 5px 6px',
        boxShadow: '0 2px 12px rgba(29,110,245,0.12)',
      }}
    >
      <div style={{
        background: '#003DA5', borderRadius: 20,
        padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <span style={{ fontSize: 12 }}>🇮🇱</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: 1 }}>
          {plate}
        </span>
      </div>
      {name && (
        <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </span>
      )}
    </motion.div>
  )
}

function Timeline({ step }) {
  const idx = STEPS.indexOf(step)
  if (idx <= 0) return null
  const remaining = STEP_META.length - 1 - idx
  const minsLeft = remaining * 1.5

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
      background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)',
      borderTop: '1px solid #e0e8ff',
      padding: '10px 16px 12px',
    }}>
      {/* Step labels row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 0, maxWidth: 520, margin: '0 auto 8px',
        overflowX: 'auto',
      }}>
        {STEP_META.slice(1).map((s, i) => {
          const stepIdx = i + 1
          const done = stepIdx < idx
          const active = stepIdx === idx
          return (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{
                  width: active ? 28 : 22, height: active ? 28 : 22,
                  borderRadius: '50%',
                  background: done ? '#1d6ef5' : active ? '#1d6ef5' : '#e0e8ff',
                  border: active ? '2.5px solid #1d6ef5' : done ? '2px solid #1d6ef5' : '2px solid #c7d8ff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: active ? 13 : 11,
                  boxShadow: active ? '0 0 0 3px rgba(29,110,245,0.18)' : 'none',
                  transition: 'all 0.3s',
                  color: done || active ? '#fff' : '#9ca3af',
                  fontWeight: 700,
                }}>
                  {done ? '✓' : s.icon}
                </div>
                <span style={{
                  fontSize: 10, fontWeight: active ? 700 : 500,
                  color: active ? '#1d6ef5' : done ? '#6b7280' : '#9ca3af',
                  whiteSpace: 'nowrap',
                }}>
                  {s.label}
                </span>
              </div>
              {i < STEP_META.length - 2 && (
                <div style={{
                  width: 20, height: 2, margin: '0 1px',
                  background: i + 1 < idx ? '#1d6ef5' : '#e0e8ff',
                  borderRadius: 2, marginBottom: 14, flexShrink: 0,
                  transition: 'background 0.3s',
                }} />
              )}
            </div>
          )
        })}
      </div>
      {/* Time estimate */}
      <div style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>
        {remaining === 0
          ? '🎉 סיימתם!'
          : `עוד ~${minsLeft < 1 ? 'פחות מדקה' : `${Math.round(minsLeft)} דקות`} לסיום`}
      </div>
    </div>
  )
}

export default function App() {
  const [step, setStep] = useState('landing')
  const [carData, setCarData] = useState(null)
  const [approvedCar, setApprovedCar] = useState(null)
  const [historyData, setHistoryData] = useState(null)
  const [marketData, setMarketData] = useState(null)
  const [scanKey, setScanKey] = useState(0)
  const [aiProvider, setAiProvider] = useState('openai')

  const go = (s) => {
    if (s === 'market') setScanKey(k => k + 1)
    setStep(s)
  }

  const slideVariants = {
    initial: { opacity: 0, x: 40 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -40 },
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <CarBadge car={step !== 'landing' ? (approvedCar || carData) : null} />
      <Timeline step={step} />

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          variants={slideVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.28, ease: 'easeInOut' }}
          style={{ minHeight: '100vh' }}
        >
          {step === 'landing' && (
            <StepLanding
              onFound={(data) => { setCarData(data); go('car-details') }}
            />
          )}
          {step === 'car-details' && (
            <StepCarDetails
              carData={carData}
              onConfirm={(car) => { setApprovedCar(car); go('market-prompt') }}
              onBack={() => go('landing')}
            />
          )}
          {step === 'market-prompt' && (
            <StepMarketPrompt
              car={approvedCar}
              onScan={() => go('history')}
              onSkip={() => go('price')}
            />
          )}
          {step === 'history' && (
            <StepHistory
              plate={approvedCar?.plate}
              onDone={(hist) => { setHistoryData(hist); go('market') }}
              onSkip={() => go('market')}
            />
          )}
          {step === 'market' && (
            <StepMarket
              key={scanKey}
              car={approvedCar}
              onDone={(mkt) => { setMarketData(mkt); go('price') }}
            />
          )}
          {step === 'price' && (
            <StepPrice
              car={approvedCar}
              market={marketData}
              history={historyData}
              onNext={() => go('autopilot')}
              onRestart={() => { setCarData(null); setApprovedCar(null); setHistoryData(null); setMarketData(null); go('landing') }}
            />
          )}
          {step === 'autopilot' && (
            <StepAutopilot
              car={approvedCar}
              market={marketData}
              history={historyData}
              provider={aiProvider}
              onProviderChange={setAiProvider}
              onRestart={() => { setCarData(null); setApprovedCar(null); setHistoryData(null); setMarketData(null); go('landing') }}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
