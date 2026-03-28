import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import StepLanding from './steps/StepLanding.jsx'
import StepIdentify from './steps/StepIdentify.jsx'
import StepApprove from './steps/StepApprove.jsx'
import StepMarketPrompt from './steps/StepMarketPrompt.jsx'
import StepHistory from './steps/StepHistory.jsx'
import StepMarket from './steps/StepMarket.jsx'
import StepPrice from './steps/StepPrice.jsx'
import StepAutopilot from './steps/StepAutopilot.jsx'

const STEPS = [
  'landing', 'identify', 'approve', 'market-prompt',
  'history', 'market', 'price', 'autopilot',
]

const STEP_LABELS = [
  'Plate', 'Identify', 'Confirm', 'Market?',
  'History', 'Listings', 'Price', 'Autopilot',
]

function ProgressBar({ step }) {
  const idx = STEPS.indexOf(step)
  if (idx <= 0) return null
  const pct = Math.round((idx / (STEPS.length - 1)) * 100)
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: 3, zIndex: 200,
      background: 'var(--border)',
    }}>
      <motion.div
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.4 }}
        style={{ height: '100%', background: 'var(--accent)', borderRadius: '0 2px 2px 0' }}
      />
    </div>
  )
}

function StepDots({ step }) {
  const idx = STEPS.indexOf(step)
  if (idx <= 0) return null
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', gap: 8, zIndex: 100,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)',
      padding: '8px 16px', borderRadius: 40, border: '1px solid var(--border)',
    }}>
      {STEPS.slice(1).map((s, i) => (
        <div
          key={s}
          title={STEP_LABELS[i + 1]}
          style={{
            width: i + 1 === idx ? 20 : 8,
            height: 8, borderRadius: 4,
            background: i + 1 <= idx ? 'var(--accent)' : 'var(--border2)',
            transition: 'all 0.3s',
          }}
        />
      ))}
    </div>
  )
}

export default function App() {
  const [step, setStep] = useState('landing')
  const [carData, setCarData] = useState(null)       // from plate lookup
  const [approvedCar, setApprovedCar] = useState(null) // after user confirms
  const [historyData, setHistoryData] = useState(null)
  const [marketData, setMarketData] = useState(null)
  const [scanKey, setScanKey] = useState(0)

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
      <ProgressBar step={step} />
      <StepDots step={step} />

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
              onFound={(data) => { setCarData(data); go('identify') }}
            />
          )}
          {step === 'identify' && (
            <StepIdentify
              carData={carData}
              onApprove={(car) => { setApprovedCar(car); go('approve') }}
              onBack={() => go('landing')}
            />
          )}
          {step === 'approve' && (
            <StepApprove
              car={approvedCar}
              onConfirm={(car) => { setApprovedCar(car); go('market-prompt') }}
              onBack={() => go('identify')}
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
              onRestart={() => { setCarData(null); setApprovedCar(null); setHistoryData(null); setMarketData(null); go('landing') }}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
