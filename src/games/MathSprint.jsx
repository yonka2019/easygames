import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { rand, pick } from '../lib/util'
import { useGame } from '../components/GameFrame'
import { Button, EASE, Result, Segmented } from '../components/ui'

const LEVELS = {
  easy: { add: [2, 20], mul: [2, 10], mul2: [2, 10] },
  normal: { add: [2, 100], mul: [2, 12], mul2: [2, 100] },
  hard: { add: [10, 999], mul: [3, 20], mul2: [10, 200] },
}
const TIME = 60
// Soft tick for numbers that change (re-keyed on each new value).
const tick = {
  initial: { opacity: 0.35, y: -4 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: EASE },
}
// Cross-fade between state views. Leaving views stop taking clicks at once.
const fade = {
  initial: { opacity: 0, y: 6, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -6, scale: 0.98, pointerEvents: 'none' },
  transition: { duration: 0.2, ease: EASE },
}

function problem(level) {
  const L = LEVELS[level]
  const op = pick(['+', '-', '×', '÷'])
  if (op === '+' || op === '-') {
    const a = rand(...L.add)
    const b = rand(...L.add)
    return op === '+' ? { text: `${a} + ${b}`, ans: a + b } : { text: `${a + b} − ${a}`, ans: b }
  }
  const a = rand(...L.mul)
  const b = rand(...L.mul2)
  return op === '×' ? { text: `${a} × ${b}`, ans: a * b } : { text: `${a * b} ÷ ${a}`, ans: b }
}

export default function MathSprint() {
  const { report, setVariant, variant } = useGame()
  const level = variant || 'normal'
  const [status, setStatus] = useState('idle')
  const [p, setP] = useState(() => problem(level))
  const [value, setValue] = useState('')
  const [solved, setSolved] = useState(0)
  const [left, setLeft] = useState(TIME)
  const [result, setResult] = useState(null)
  const [flash, setFlash] = useState(0)
  const solvedRef = useRef(0)
  const inputRef = useRef(null)

  const reset = useCallback(() => {
    setStatus('idle')
    setP(problem(level))
    setValue('')
    setSolved(0)
    solvedRef.current = 0
    setLeft(TIME)
    setResult(null)
  }, [level])

  useEffect(reset, [reset])

  const start = () => {
    reset()
    setStatus('run')
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  useEffect(() => {
    if (status !== 'run') return
    const t0 = performance.now()
    const id = setInterval(() => {
      const l = TIME - (performance.now() - t0) / 1000
      setLeft(Math.max(0, l))
      if (l <= 0) {
        clearInterval(id)
        const n = solvedRef.current
        const r = report(n)
        setResult({ n, isNew: r.isNew })
        setStatus('done')
      }
    }, 100)
    return () => clearInterval(id)
  }, [status, report])

  const onChange = (e) => {
    const v = e.target.value.replace(/[^\d-]/g, '')
    if (Number(v) === p.ans && v !== '' && v !== '-') {
      solvedRef.current++
      setSolved(solvedRef.current)
      setP(problem(level))
      setValue('')
      setFlash((f) => f + 1)
    } else setValue(v)
  }

  const done = status === 'done' && result
  // popLayout: "Play again" starts the clock at once, so the new view must not wait for the old one to leave.
  return (
    <div className="relative">
      <AnimatePresence mode="popLayout" initial={false}>
        {done ? (
          // Result animates its own entrance; this wrapper only fades it out.
          <motion.div key="done" exit={fade.exit} transition={fade.transition}>
            <Result
              title={`Math sprint, ${level}`}
              isNew={result.isNew}
              onAgain={start}
              stats={[
                { label: 'Solved', value: result.n },
                { label: 'Per minute', value: result.n },
                { label: 'Avg time', value: result.n ? `${(TIME / result.n).toFixed(1)}s` : '-' },
              ]}
            />
          </motion.div>
        ) : (
          <motion.div key="play" {...fade} className="mx-auto max-w-[720px]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Segmented
                label="Difficulty"
                options={['easy', 'normal', 'hard']}
                value={level}
                onChange={(v) => status !== 'run' && setVariant(v)}
              />
              <div className="flex items-baseline gap-6">
                <span className="num text-sm text-muted">
                  solved{' '}
                  <motion.span key={solved} {...tick} className="inline-block">
                    {solved}
                  </motion.span>
                </span>
                <motion.span key={Math.ceil(left)} {...tick} className="num inline-block text-3xl text-accent">
                  {Math.ceil(left)}
                </motion.span>
              </div>
            </div>

            <div className="mt-8 rounded-xl border border-line bg-surface px-6 py-14 text-center md:py-20">
              {/* Both states share one cell; min height = the run view, so the panel never resizes. */}
              <div className="grid min-h-[152px] place-items-center md:min-h-[176px]">
                <AnimatePresence initial={false}>
                  {status === 'idle' ? (
                    <motion.div key="idle" {...fade} className="col-start-1 row-start-1">
                      <p className="text-muted">Answers submit on their own. 60 seconds.</p>
                      <Button className="mt-6 h-11 px-6" onClick={start}>
                        Start
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div key="run" {...fade} className="col-start-1 row-start-1 w-full">
                      <div key={flash} className="num pop text-5xl tracking-tight md:text-7xl">
                        {p.text}
                      </div>
                      <input
                        ref={inputRef}
                        value={value}
                        onChange={onChange}
                        inputMode="numeric"
                        autoComplete="off"
                        autoFocus
                        aria-label="Answer"
                        className="num mx-auto mt-10 block h-16 w-56 rounded-xl border border-line bg-bg text-center text-3xl text-ink outline-none transition-colors duration-200 focus:border-accent"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
