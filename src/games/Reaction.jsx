import { useCallback, useEffect, useRef, useState } from 'react'
import { LightningIcon, WarningIcon } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useGame } from '../components/GameFrame'
import { EASE, Result, Swap } from '../components/ui'

const ROUNDS = 5
// Message cross-fade. Entering 'go' is instant both ways: the green stimulus must never be delayed or muddied.
const msg = {
  from: { opacity: 0, y: 6, scale: 0.98 },
  in: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.2, ease: EASE } },
  out: (next) => (next === 'go' ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -6, scale: 0.98, transition: { duration: 0.15, ease: EASE } }),
}

export default function Reaction() {
  const { report } = useGame()
  const [state, setState] = useState('idle') // idle | wait | go | early | shown | done
  const [times, setTimes] = useState([])
  const [result, setResult] = useState(null)
  const timer = useRef(null)
  const goAt = useRef(0)

  const reset = useCallback(() => {
    clearTimeout(timer.current)
    setState('idle')
    setTimes([])
    setResult(null)
  }, [])

  useEffect(() => () => clearTimeout(timer.current), [])

  const arm = () => {
    setState('wait')
    timer.current = setTimeout(() => {
      goAt.current = performance.now()
      setState('go')
    }, 1400 + Math.random() * 3000)
  }

  const press = () => {
    if (state === 'idle' || state === 'early' || state === 'shown') return arm()
    if (state === 'wait') {
      clearTimeout(timer.current)
      return setState('early')
    }
    if (state === 'go') {
      const ms = performance.now() - goAt.current
      const next = [...times, ms]
      setTimes(next)
      if (next.length >= ROUNDS) {
        const avg = Math.round(next.reduce((a, b) => a + b, 0) / next.length)
        const r = report(avg)
        setResult({ avg, best: Math.round(Math.min(...next)), isNew: r.isNew })
        setState('done')
      } else setState('shown')
    }
  }

  useEffect(() => {
    if (state === 'done') return
    const onKey = (e) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault()
        press()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const last = times.at(-1)
  const look = {
    idle: 'bg-surface border-line',
    wait: 'bg-danger/15 border-danger/40',
    go: 'bg-accent border-accent text-accent-ink',
    early: 'bg-surface border-danger/60',
    shown: 'bg-surface border-line',
  }[state]

  return (
    <Swap k={state === 'done' && result ? 'done' : 'play'}>
      {state === 'done' && result ? (
        <Result
          title={`Reaction time, ${ROUNDS} tries`}
          isNew={result.isNew}
          onAgain={reset}
          stats={[
            { label: 'Average', value: `${result.avg} ms` },
            { label: 'Fastest', value: `${result.best} ms` },
            { label: 'Tries', value: times.map((t) => Math.round(t)).join(' ') },
          ]}
        />
      ) : (
        <div className="mx-auto max-w-[900px]">
          <button
            type="button"
            onPointerDown={press}
            className={`grid min-h-[380px] w-full select-none place-items-center rounded-xl border px-6 text-center md:min-h-[460px] ${state === 'go' ? 'transition-none [&>[data-s]:not([data-s=go])]:invisible' : 'transition-colors duration-200'} ${look}`}
          >
            {/* Messages share one grid cell so they cross-fade without moving each other. On 'go' the old one is hidden by CSS at once. */}
            <AnimatePresence initial={false} custom={state}>
              <motion.span
                key={state}
                data-s={state}
                custom={state}
                variants={msg}
                initial={state === 'go' ? false : 'from'}
                animate="in"
                exit="out"
                className="col-start-1 row-start-1 flex flex-col items-center gap-4"
              >
                {state === 'idle' && (
                  <>
                    <LightningIcon size={44} weight="duotone" className="text-accent" />
                    <span className="text-2xl font-semibold tracking-tight md:text-3xl">Click to start</span>
                    <span className="text-muted">Wait for green, then click as fast as you can.</span>
                  </>
                )}
                {state === 'wait' && <span className="text-3xl font-semibold tracking-tight md:text-4xl">Wait for green</span>}
                {state === 'go' && <span className="text-4xl font-semibold tracking-tight md:text-6xl">Click!</span>}
                {state === 'early' && (
                  <>
                    <WarningIcon size={40} weight="duotone" className="text-danger" />
                    <span className="text-2xl font-semibold tracking-tight md:text-3xl">Too soon</span>
                    <span className="text-muted">Click to try again.</span>
                  </>
                )}
                {state === 'shown' && (
                  <>
                    <span className="num text-6xl text-accent md:text-7xl">{Math.round(last)} ms</span>
                    <span className="text-muted">Click to keep going.</span>
                  </>
                )}
              </motion.span>
            </AnimatePresence>
          </button>
          <div className="mt-6 flex justify-center gap-2" aria-label={`${times.length} of ${ROUNDS} tries done`}>
            {Array.from({ length: ROUNDS }, (_, i) => (
              <span key={i} className={`h-1.5 w-10 rounded-full transition-colors duration-300 ${i < times.length ? 'bg-accent' : 'bg-surface-2'}`} />
            ))}
          </div>
          <p className="mt-4 text-center text-sm text-muted">Space works too.</p>
        </div>
      )}
    </Swap>
  )
}
