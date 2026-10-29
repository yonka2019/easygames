import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import { NumpadIcon } from '@phosphor-icons/react'
import { useGame } from '../components/GameFrame'
import { Button, EASE, Result } from '../components/ui'

const makeNumber = (len) => Array.from({ length: len }, (_, i) => (i === 0 ? 1 + Math.floor(Math.random() * 9) : Math.floor(Math.random() * 10))).join('')
const showMs = (len) => 1000 + len * 600

// Phase cross-fade. popLayout (not wait) so the next phase mounts at once: show timing and input focus stay exact.
// The leaving copy is inert, so a double tap can't fire its button twice.
function Phase({ ref, children }) {
  const live = useIsPresent()
  return (
    <motion.div
      ref={ref}
      inert={!live}
      className="w-full"
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ duration: 0.18, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

export default function NumberMemory() {
  const { report } = useGame()
  const [state, setState] = useState('idle') // idle | show | input | right | done
  const [len, setLen] = useState(2)
  const [num, setNum] = useState('')
  const [guess, setGuess] = useState('')
  const [result, setResult] = useState(null)
  const timer = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  const round = (n) => {
    setLen(n)
    setNum(makeNumber(n))
    setGuess('')
    setState('show')
    timer.current = setTimeout(() => {
      setState('input')
      requestAnimationFrame(() => inputRef.current?.focus())
    }, showMs(n))
  }

  const reset = useCallback(() => {
    clearTimeout(timer.current)
    setState('idle')
    setResult(null)
  }, [])

  const submit = (e) => {
    e.preventDefault()
    if (!guess) return
    if (guess === num) return setState('right')
    const reached = len - 1
    const r = report(reached)
    setResult({ reached, num, guess, isNew: r.isNew })
    setState('done')
  }

  useEffect(() => {
    if (state !== 'right') return
    const onKey = (e) => e.key === 'Enter' && round(len + 1)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (state === 'done' && result) {
    return (
      <Result
        title="Number memory"
        isNew={result.isNew}
        onAgain={reset}
        stats={[
          { label: 'Digits remembered', value: result.reached },
          { label: 'Number', value: result.num },
          { label: 'You typed', value: result.guess },
        ]}
      />
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: EASE }}
      className="mx-auto max-w-[760px] rounded-xl border border-line bg-surface px-6 py-16 text-center md:py-24"
    >
      {/* min-h fits every phase, so swaps don't resize the card. */}
      <div className="relative grid min-h-52 place-items-center">
        <AnimatePresence mode="popLayout" initial={false}>
          <Phase key={state}>
            {state === 'idle' && (
              <>
                <NumpadIcon size={44} weight="duotone" className="mx-auto text-accent" />
                <p className="mt-4 text-muted">Memorize the number. It grows by one digit each round.</p>
                <Button className="mt-8 h-11 px-6" onClick={() => round(2)}>
                  Start
                </Button>
              </>
            )}

            {state === 'show' && (
              <>
                <div className="num break-all text-5xl tracking-wider md:text-7xl">{num}</div>
                <div className="mx-auto mt-10 h-1 max-w-xs overflow-hidden rounded-full">
                  <div
                    key={num}
                    className="h-full origin-left bg-accent"
                    style={{ animation: `shrink ${showMs(len)}ms linear forwards` }}
                  />
                </div>
                <style>{'@keyframes shrink{from{transform:scaleX(1)}to{transform:scaleX(0)}}'}</style>
              </>
            )}

            {state === 'input' && (
              <form onSubmit={submit}>
                <p className="text-muted">What was the number?</p>
                <input
                  ref={inputRef}
                  value={guess}
                  onChange={(e) => setGuess(e.target.value.replace(/\D/g, ''))}
                  inputMode="numeric"
                  autoComplete="off"
                  aria-label="Number"
                  className="num mx-auto mt-6 block h-16 w-full max-w-md rounded-xl border border-line bg-bg px-4 text-center text-3xl text-ink outline-none transition-colors focus:border-accent"
                />
                <Button type="submit" className="mt-6 h-11 px-6">
                  Submit
                </Button>
              </form>
            )}

            {state === 'right' && (
              <>
                <p className="text-sm text-muted">Correct</p>
                <div className="num mt-2 break-all text-4xl text-accent md:text-5xl">{num}</div>
                <p className="mt-6 text-muted">Level {len}</p>
                <Button className="mt-6 h-11 px-6" onClick={() => round(len + 1)}>
                  Next
                </Button>
              </>
            )}
          </Phase>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
