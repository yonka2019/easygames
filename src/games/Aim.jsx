import { useCallback, useRef, useState } from 'react'
import { CrosshairIcon } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useGame } from '../components/GameFrame'
import { EASE, Result, Swap } from '../components/ui'

const TOTAL = 30
const spot = () => ({ x: 6 + Math.random() * 88, y: 8 + Math.random() * 84 })

export default function Aim() {
  const { report } = useGame()
  const [state, setState] = useState('idle')
  const [hits, setHits] = useState(0)
  const [misses, setMisses] = useState(0)
  const [pos, setPos] = useState(spot)
  const [result, setResult] = useState(null)
  const [ghosts, setGhosts] = useState([]) // last hit spots, fade out (visual only)
  const [miss, setMiss] = useState(null) // last missed click, fades out (visual only)
  const t0 = useRef(0)
  const arena = useRef(null)
  const aim = useRef(0) // sum of per-hit precision, 1 = dead center, 0 = edge

  const reset = useCallback(() => {
    setState('idle')
    setHits(0)
    setMisses(0)
    setResult(null)
  }, [])

  const start = () => {
    setHits(0)
    setMisses(0)
    setPos(spot())
    setGhosts([])
    setMiss(null)
    setState('run')
    aim.current = 0
    t0.current = performance.now()
  }

  const hit = (e) => {
    e.stopPropagation()
    const box = e.currentTarget.getBoundingClientRect()
    const dx = e.clientX - (box.left + box.width / 2)
    const dy = e.clientY - (box.top + box.height / 2)
    const p = Math.max(0, 1 - Math.hypot(dx, dy) / (box.width / 2))
    aim.current += p
    const n = hits + 1
    if (n >= TOTAL) {
      const avg = Math.round((performance.now() - t0.current) / TOTAL)
      const r = report(avg)
      const acc = Math.round((TOTAL / (TOTAL + misses)) * 100)
      const prec = Math.round((aim.current / TOTAL) * 100)
      setResult({ avg, acc, prec, isNew: r.isNew })
      setState('done')
      return
    }
    setHits(n)
    // Keep the last few so each fade finishes even on fast hits.
    setGhosts((g) => [...g.slice(-2), { ...pos, dx, dy, good: p >= 0.7, k: n }])
    setPos(spot())
  }

  const missed = (e) => {
    if (state !== 'run') return
    const box = arena.current.getBoundingClientRect()
    setMisses((m) => m + 1)
    setMiss({ x: e.clientX - box.left, y: e.clientY - box.top, k: (miss?.k ?? 0) + 1 })
  }

  const idle = state === 'idle'
  return (
    <Swap fit k={state === 'done' && result ? 'done' : 'play'}>
      {state === 'done' && result ? (
        <Result
          title={`Aim trainer, ${TOTAL} targets`}
          isNew={result.isNew}
          onAgain={reset}
          stats={[
            { label: 'Avg per target', value: `${result.avg} ms` },
            { label: 'Precision', value: `${result.prec}%` },
            { label: 'Accuracy', value: `${result.acc}%` },
            { label: 'Misses', value: misses },
          ]}
        />
      ) : (
        <div className="mx-auto max-w-[1000px]">
          <div className="mb-4 flex justify-between text-sm text-muted">
            <span>Click the targets as fast as you can.</span>
            <span className="num text-ink">
              <motion.span
                key={state === 'run' ? TOTAL - hits : TOTAL}
                initial={{ opacity: 0.35, y: -3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: EASE }}
                className="inline-block min-w-[2ch] text-right"
              >
                {state === 'run' ? TOTAL - hits : TOTAL}
              </motion.span>{' '}
              left
            </span>
          </div>
          <div
            ref={arena}
            onPointerDown={missed}
            className="dot-grid relative h-[420px] w-full touch-none select-none overflow-hidden rounded-xl border border-line bg-surface md:h-[520px]"
          >
            {/* Start screen stays mounted and fades; it stops taking clicks the moment the run starts. */}
            <motion.button
              type="button"
              onClick={start}
              tabIndex={idle ? 0 : -1}
              aria-hidden={!idle}
              initial={false}
              animate={{ opacity: idle ? 1 : 0, scale: idle ? 1 : 0.96 }}
              transition={{ duration: 0.2, ease: EASE }}
              className={`absolute inset-0 flex flex-col items-center justify-center gap-3 ${idle ? '' : 'pointer-events-none'}`}
            >
              <CrosshairIcon size={44} weight="duotone" className="text-accent" />
              <span className="text-2xl font-semibold tracking-tight">Click to start</span>
            </motion.button>
            {!idle &&
              ghosts.map((g) => (
                <motion.span
                  key={`ring${g.k}`}
                  aria-hidden="true"
                  initial={{ opacity: 0.7, scale: 1 }}
                  animate={{ opacity: 0, scale: 1.5 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  className="pointer-events-none absolute -ml-8 -mt-8 size-16 rounded-full border-2 border-accent"
                  style={{ left: `${g.x}%`, top: `${g.y}%` }}
                />
              ))}
            {!idle &&
              ghosts.map((g) => (
                // Where the click landed inside the target: green near the center, grey near the edge.
                <motion.span
                  key={`dot${g.k}`}
                  aria-hidden="true"
                  initial={{ opacity: 1, scale: 0.4 }}
                  animate={{ opacity: 0, scale: 1 }}
                  transition={{ duration: 0.45, ease: EASE }}
                  className={`pointer-events-none absolute -ml-1.5 -mt-1.5 size-3 rounded-full ${g.good ? 'bg-accent' : 'bg-muted'}`}
                  style={{ left: `calc(${g.x}% + ${g.dx}px)`, top: `calc(${g.y}% + ${g.dy}px)` }}
                />
              ))}
            {!idle && miss && (
              // A miss: small grey ring where the click landed.
              <motion.span
                key={`miss${miss.k}`}
                aria-hidden="true"
                initial={{ opacity: 0.9, scale: 0.5 }}
                animate={{ opacity: 0, scale: 1.4 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="pointer-events-none absolute -ml-3 -mt-3 size-6 rounded-full border-2 border-muted"
                style={{ left: miss.x, top: miss.y }}
              />
            )}
            {!idle && (
              // Full hit area from the first frame; only the inner look scales in (.pop).
              <button
                type="button"
                aria-label="Target"
                onPointerDown={hit}
                className="absolute size-16 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                key={`t${hits}`}
              >
                <span className="pop absolute inset-0 grid place-items-center rounded-full border-2 border-accent bg-accent/20">
                  <span className="size-6 rounded-full bg-accent" />
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </Swap>
  )
}
