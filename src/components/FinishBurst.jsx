import { useMemo } from 'react'
import { motion, useReducedMotion } from 'motion/react'

// Played when a run ends. "best" = big burst, "done" = small burst, "end" (a loss) = quiet ring only.
// Off under reduced motion.
const COUNT = { best: 30, done: 14, end: 0 }

function Particles({ n, big }) {
  const parts = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.5
        const d = (big ? 170 : 110) + Math.random() * (big ? 140 : 70)
        return {
          x: Math.cos(a) * d,
          y: Math.sin(a) * d + 30,
          size: 4 + Math.random() * 6,
          rot: Math.random() * 360,
          square: i % 3 === 0,
          delay: Math.random() * 0.08,
        }
      }),
    [n, big],
  )
  return parts.map((p, i) => (
    <motion.span
      key={i}
      className={`absolute bg-accent ${p.square ? 'rounded-[2px]' : 'rounded-full'}`}
      style={{ width: p.size, height: p.size, left: -p.size / 2, top: -p.size / 2 }}
      initial={{ x: 0, y: 0, opacity: 1, scale: 0.4, rotate: 0 }}
      animate={{ x: p.x, y: p.y, opacity: 0, scale: 1, rotate: p.rot }}
      transition={{ duration: big ? 1.1 : 0.9, delay: p.delay, ease: [0.16, 1, 0.3, 1] }}
    />
  ))
}

export function FinishBurst({ burst }) {
  const reduce = useReducedMotion()
  if (!burst || reduce) return null
  const { kind } = burst
  return (
    <div key={burst.id} aria-hidden="true" className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
      <div className="relative size-0">
        <motion.span
          className={`absolute -left-10 -top-10 size-20 rounded-full border-2 ${kind === 'end' ? 'border-muted' : 'border-accent'}`}
          initial={{ scale: 0.2, opacity: 0.7 }}
          animate={{ scale: kind === 'best' ? 5 : 3.5, opacity: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
        <Particles n={COUNT[kind]} big={kind === 'best'} />
      </div>
    </div>
  )
}
