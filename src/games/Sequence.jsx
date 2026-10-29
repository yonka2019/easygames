import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import { useGame } from '../components/GameFrame'
import { Button, EASE, Result, Swap } from '../components/ui'

const N = 9

// Fades in/out; inert while leaving so a double tap can't fire it twice.
function Fade({ children }) {
  const live = useIsPresent()
  return (
    <motion.div
      inert={!live}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

export default function Sequence() {
  const { report } = useGame()
  const [state, setState] = useState('idle') // idle | play | input | done
  const [seq, setSeq] = useState([])
  const [step, setStep] = useState(0)
  const [lit, setLit] = useState(-1)
  const [result, setResult] = useState(null)
  const timers = useRef([])

  const clear = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }
  useEffect(() => clear, [])

  const playback = (s) => {
    clear()
    setState('play')
    setStep(0)
    s.forEach((tile, i) => {
      timers.current.push(setTimeout(() => setLit(tile), 600 + i * 560))
      timers.current.push(setTimeout(() => setLit(-1), 600 + i * 560 + 380))
    })
    timers.current.push(setTimeout(() => setState('input'), 600 + s.length * 560))
  }

  const start = () => {
    const s = [Math.floor(Math.random() * N)]
    setSeq(s)
    setResult(null)
    playback(s)
  }

  const reset = useCallback(() => {
    clear()
    setState('idle')
    setResult(null)
  }, [])

  const tap = (i) => {
    if (state !== 'input') return
    clear()
    setLit(i)
    timers.current.push(setTimeout(() => setLit(-1), 180))
    if (seq[step] !== i) {
      const level = seq.length - 1
      const r = report(level)
      setResult({ level, isNew: r.isNew })
      setState('done')
      return
    }
    if (step + 1 === seq.length) {
      const next = [...seq, Math.floor(Math.random() * N)]
      setSeq(next)
      timers.current.push(setTimeout(() => playback(next), 300))
      setState('play')
    } else setStep(step + 1)
  }

  if (state === 'done' && result) {
    return (
      <Result
        title="Sequence"
        isNew={result.isNew}
        onAgain={reset}
        stats={[
          { label: 'Level', value: result.level },
          { label: 'Sequence length', value: result.level + 1 },
        ]}
      />
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: EASE }}
      className="mx-auto max-w-[460px]"
    >
      <div className="mb-4 flex justify-between text-sm">
        <Swap k={state} className="text-muted">
          {state === 'play' ? 'Watch' : state === 'input' ? 'Your turn' : 'Repeat the pattern'}
        </Swap>
        <Swap k={Math.max(seq.length, 1)} className="num text-ink">
          level {Math.max(seq.length, 1)}
        </Swap>
      </div>
      {/* Soft light: quick fade in, slower fade out (still clears before the same tile repeats). */}
      <div className="grid grid-cols-3 gap-3 rounded-xl border border-line bg-surface p-3">
        {Array.from({ length: N }, (_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Tile ${i + 1}`}
            disabled={state !== 'input'}
            onPointerDown={() => tap(i)}
            className={`aspect-square rounded-md transition-[background-color,scale] ease-out ${
              lit === i
                ? 'scale-[1.04] bg-accent duration-150 motion-reduce:scale-100'
                : `bg-surface-2 duration-250 ${state === 'input' ? 'hover:bg-surface-2/60' : ''}`
            }`}
          />
        ))}
      </div>
      {/* Fixed slot, so the grid doesn't jump when Start leaves. */}
      <div className="mt-6 flex h-11 justify-center">
        <AnimatePresence initial={false}>
          {state === 'idle' && (
            <Fade key="start">
              <Button className="h-11 px-6" onClick={start}>
                Start
              </Button>
            </Fade>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
