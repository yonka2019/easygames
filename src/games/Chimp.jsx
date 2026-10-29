import { useCallback, useState } from 'react'
import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import { CirclesFourIcon } from '@phosphor-icons/react'
import { shuffle } from '../lib/util'
import { useGame } from '../components/GameFrame'
import { Button, EASE, Result, Swap } from '../components/ui'

const COLS = 8
const ROWS = 5
const STRIKES = 3

const layout = (n) => {
  const cells = shuffle(Array.from({ length: COLS * ROWS }, (_, i) => i)).slice(0, n)
  return Object.fromEntries(cells.map((c, i) => [c, i + 1]))
}

// Between-rounds overlay. Fades in/out; inert while leaving so a double tap can't fire its button twice.
function Overlay({ children }) {
  const live = useIsPresent()
  return (
    <motion.div
      inert={!live}
      className="absolute inset-0 grid place-items-center rounded-xl bg-surface/95 p-6 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: EASE }}
    >
      <motion.div
        initial={{ y: 8, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: -6, scale: 0.98 }}
        transition={{ duration: 0.2, ease: EASE }}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

export default function Chimp() {
  const { report } = useGame()
  const [state, setState] = useState('idle') // idle | play | between | done
  const [count, setCount] = useState(4)
  const [cells, setCells] = useState({})
  const [next, setNext] = useState(1)
  const [strikes, setStrikes] = useState(0)
  const [best, setBest] = useState(0)
  const [result, setResult] = useState(null)

  const round = (n) => {
    setCount(n)
    setCells(layout(n))
    setNext(1)
    setState('play')
  }

  const reset = useCallback(() => {
    setState('idle')
    setStrikes(0)
    setBest(0)
    setResult(null)
  }, [])

  const tap = (cell) => {
    const v = cells[cell]
    if (!v) return
    if (v !== next) {
      const s = strikes + 1
      setStrikes(s)
      if (s >= STRIKES) {
        const r = report(best)
        setResult({ best, isNew: r.isNew })
        setState('done')
      } else setState('between-fail')
      return
    }
    const rest = { ...cells }
    delete rest[cell]
    setCells(rest)
    if (v === count) {
      setBest(count)
      setState('between')
    } else setNext(v + 1)
  }

  if (state === 'done' && result) {
    return (
      <Result
        title="Chimp test"
        isNew={result.isNew}
        onAgain={reset}
        stats={[
          { label: 'Numbers', value: result.best },
          { label: 'Strikes', value: `${STRIKES}/${STRIKES}` },
        ]}
      />
    )
  }

  const hidden = next > 1

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: EASE }}
      className="mx-auto max-w-[760px]"
    >
      <div className="mb-4 flex justify-between text-sm">
        <Swap k={strikes} className="text-muted">
          Strikes {strikes}/{STRIKES}
        </Swap>
        <Swap k={count} className="num text-ink">
          {count} numbers
        </Swap>
      </div>
      <div className="relative rounded-xl border border-line bg-surface p-3">
        <div className="grid grid-cols-8 gap-1.5 sm:gap-2">
          {Array.from({ length: COLS * ROWS }, (_, i) => {
            const v = state === 'play' ? cells[i] : undefined
            return (
              <button
                key={i}
                type="button"
                tabIndex={v ? 0 : -1}
                aria-label={v ? (hidden ? 'Hidden number' : `Number ${v}`) : undefined}
                onPointerDown={() => tap(i)}
                className={`num relative aspect-square select-none rounded-md text-lg font-medium sm:text-2xl ${v ? '' : 'pointer-events-none'}`}
              >
                {/* Numbers pop in, fade to a filled tile on hide (short, so the glimpse stays the same), and fade out when tapped. */}
                <AnimatePresence>
                  {v && (
                    <motion.span
                      key="n"
                      aria-hidden="true"
                      className={`absolute inset-0 grid place-items-center rounded-md border-2 transition-colors duration-150 ease-out ${
                        hidden ? 'border-ink bg-ink text-transparent' : 'border-accent text-accent'
                      }`}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.18, ease: EASE }}
                    >
                      {v}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            )
          })}
        </div>

        <AnimatePresence initial={false}>
          {state !== 'play' && (
            <Overlay key={state}>
              {state === 'idle' && (
                <>
                  <CirclesFourIcon size={44} weight="duotone" className="mx-auto text-accent" />
                  <p className="mt-4 max-w-sm text-muted">Tap the numbers in order. After the first tap, the rest hide.</p>
                  <Button className="mt-6 h-11 px-6" onClick={() => round(4)}>
                    Start
                  </Button>
                </>
              )}
              {state === 'between' && (
                <>
                  <p className="num text-4xl text-accent">{count}</p>
                  <p className="mt-2 text-muted">Cleared. Next: {count + 1} numbers.</p>
                  <Button className="mt-6 h-11 px-6" onClick={() => round(count + 1)}>
                    Continue
                  </Button>
                </>
              )}
              {state === 'between-fail' && (
                <>
                  <p className="text-2xl font-semibold text-danger">Wrong order</p>
                  <p className="mt-2 text-muted">
                    Strike {strikes} of {STRIKES}.
                  </p>
                  <Button className="mt-6 h-11 px-6" onClick={() => round(count)}>
                    Retry
                  </Button>
                </>
              )}
            </Overlay>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
