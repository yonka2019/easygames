import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AnchorIcon,
  BicycleIcon,
  CactusIcon,
  CameraIcon,
  CoffeeIcon,
  FishIcon,
  GuitarIcon,
  PlanetIcon,
} from '@phosphor-icons/react'
import { motion, useReducedMotion } from 'motion/react'
import { shuffle } from '../lib/util'
import { useGame } from '../components/GameFrame'
import { EASE, Result, Swap } from '../components/ui'

const FACES = [AnchorIcon, BicycleIcon, CactusIcon, CameraIcon, CoffeeIcon, FishIcon, GuitarIcon, PlanetIcon]
const deal = () => shuffle([...FACES.keys(), ...FACES.keys()]).map((face, id) => ({ id, face }))

export default function Pairs() {
  const { report } = useGame()
  const [cards, setCards] = useState(deal)
  const [open, setOpen] = useState([])
  const [done, setDone] = useState(new Set())
  const [moves, setMoves] = useState(0)
  const [secs, setSecs] = useState(0)
  const [result, setResult] = useState(null)
  const started = useRef(0)
  const lock = useRef(false)
  const reduce = useReducedMotion()

  const reset = useCallback(() => {
    setCards(deal())
    setOpen([])
    setDone(new Set())
    setMoves(0)
    setSecs(0)
    setResult(null)
    started.current = 0
    lock.current = false
  }, [])

  useEffect(() => {
    if (!moves || result) return
    const id = setInterval(() => setSecs(Math.floor((performance.now() - started.current) / 1000)), 250)
    return () => clearInterval(id)
  }, [moves, result])

  const flip = (c) => {
    if (lock.current || open.includes(c.id) || done.has(c.face)) return
    if (!started.current) started.current = performance.now()
    const now = [...open, c.id]
    setOpen(now)
    if (now.length < 2) return
    const m = moves + 1
    setMoves(m)
    const [a, b] = now.map((id) => cards[id])
    if (a.face === b.face) {
      const d = new Set(done).add(a.face)
      setDone(d)
      setOpen([])
      if (d.size === FACES.length) {
        const r = report(m)
        setTimeout(() => setResult({ moves: m, secs: Math.floor((performance.now() - started.current) / 1000), isNew: r.isNew }), 450)
      }
    } else {
      lock.current = true
      setTimeout(() => {
        setOpen([])
        lock.current = false
      }, 750)
    }
  }

  if (result) {
    return (
      <Result
        title="Memory pairs"
        isNew={result.isNew}
        onAgain={reset}
        stats={[
          { label: 'Moves', value: result.moves },
          { label: 'Time', value: `${result.secs}s` },
          { label: 'Fewest possible', value: FACES.length },
        ]}
      />
    )
  }

  return (
    <div className="mx-auto max-w-[520px]">
      <div className="mb-4 flex justify-between text-sm">
        <span className="num text-muted">{secs}s</span>
        <Swap k={moves} className="num text-ink">
          {moves} move{moves === 1 ? '' : 's'}
        </Swap>
      </div>
      <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
        {cards.map((c, i) => {
          const up = open.includes(c.id) || done.has(c.face)
          const Face = FACES[c.face]
          // 3D flip; reduced motion swaps it for a cross-fade.
          const flipped = up && !reduce
          return (
            <motion.div
              key={c.id}
              className="[perspective:900px]"
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, delay: i * 0.02, ease: EASE }}
            >
              <button
                type="button"
                onClick={() => flip(c)}
                aria-label={up ? 'Open card' : 'Hidden card'}
                className="relative block aspect-square w-full [transform-style:preserve-3d] transition-transform duration-300"
                style={{ transform: flipped ? 'rotateY(180deg)' : 'none' }}
              >
                <span
                  className={`line-grid absolute inset-0 rounded-xl border border-line bg-surface transition-opacity duration-200 [backface-visibility:hidden] ${
                    reduce && up ? 'opacity-0' : ''
                  }`}
                />
                <span
                  className={`absolute inset-0 grid place-items-center rounded-xl border transition-[opacity,background-color,border-color,color] duration-300 [backface-visibility:hidden] ${
                    reduce ? (up ? '' : 'opacity-0') : '[transform:rotateY(180deg)]'
                  } ${done.has(c.face) ? 'border-accent/50 bg-accent/10 text-accent' : 'border-line bg-surface-2 text-ink'}`}
                >
                  <Face size={34} weight="duotone" />
                </span>
              </button>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
