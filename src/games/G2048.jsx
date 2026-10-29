import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { ArrowClockwiseIcon } from '@phosphor-icons/react'
import { useGame } from '../components/GameFrame'
import { Button, EASE, Kbd } from '../components/ui'

const S = 4
let uid = 0

function addTile(grid) {
  const empty = []
  grid.forEach((t, i) => !t && empty.push(i))
  if (!empty.length) return grid
  const g = [...grid]
  g[empty[Math.floor(Math.random() * empty.length)]] = { v: Math.random() < 0.9 ? 2 : 4, id: ++uid, fresh: true }
  return g
}

const fresh = () => addTile(addTile(Array(S * S).fill(null)))

// Slides one line toward index 0. Returns merged line + points.
// `from` keeps the merged pair's ids so they can be drawn sliding into the merge.
function slide(line) {
  const tiles = line.filter(Boolean).map((t) => ({ ...t, fresh: false, merged: false, from: null }))
  const out = []
  let pts = 0
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i + 1] && tiles[i].v === tiles[i + 1].v) {
      const v = tiles[i].v * 2
      out.push({ v, id: ++uid, merged: true, from: [tiles[i].id, tiles[i + 1].id] })
      pts += v
      i++
    } else out.push(tiles[i])
  }
  while (out.length < S) out.push(null)
  return { out, pts }
}

const idx = (dir, line, k) => {
  if (dir === 'left') return line * S + k
  if (dir === 'right') return line * S + (S - 1 - k)
  if (dir === 'up') return k * S + line
  return (S - 1 - k) * S + line
}

function move(grid, dir) {
  const g = Array(S * S).fill(null)
  let pts = 0
  let moved = false
  for (let line = 0; line < S; line++) {
    const cells = Array.from({ length: S }, (_, k) => grid[idx(dir, line, k)])
    const r = slide(cells)
    pts += r.pts
    r.out.forEach((t, k) => {
      const at = idx(dir, line, k)
      g[at] = t
      if ((t?.v ?? 0) !== (grid[at]?.v ?? 0)) moved = true
    })
  }
  return { g, pts, moved }
}

const canMove = (grid) => ['left', 'right', 'up', 'down'].some((d) => move(grid, d).moved)

function tileStyle(v) {
  const p = Math.min(100, Math.log2(v) * 9)
  return {
    background: `color-mix(in oklab, var(--accent) ${p}%, var(--surface-2))`,
    color: p > 55 ? 'var(--accent-ink)' : 'var(--text)',
  }
}

// Tiles to draw, sorted by id so React never reorders DOM nodes (that would cancel the slide).
// Merged-away tiles stay one more move, sliding under their merge result.
function layout(grid) {
  const out = []
  grid.forEach((t, at) => {
    if (!t) return
    out.push({ id: t.id, v: t.v, at, kind: t.fresh ? 'new' : t.merged ? 'merged' : 'move' })
    t.from?.forEach((id) => out.push({ id, v: t.v / 2, at, kind: 'move' }))
  })
  return out.sort((a, b) => a.id - b.id)
}

// New and merged tiles wait for the slide to land.
const SPAWN = { delay: 0.09, duration: 0.16, ease: EASE }
const POP = {
  scale: { type: 'spring', stiffness: 700, damping: 20, delay: 0.09 },
  opacity: { duration: 0.08, delay: 0.09 },
}

function Tile({ t }) {
  const step = '(100% + var(--g))'
  return (
    <div
      className="absolute left-0 top-0 aspect-square transition-transform duration-[120ms] ease-out motion-reduce:transition-none"
      style={{
        width: 'calc((100% - 3 * var(--g)) / 4)',
        transform: `translate(calc(${t.at % S} * ${step}), calc(${Math.floor(t.at / S)} * ${step}))`,
      }}
    >
      <motion.div
        initial={t.kind === 'move' ? false : { scale: t.kind === 'merged' ? 0.6 : 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={t.kind === 'merged' ? POP : SPAWN}
        className={`num grid size-full place-items-center rounded-md font-semibold ${t.v >= 1024 ? 'text-xl sm:text-2xl' : t.v >= 128 ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl'}`}
        style={tileStyle(t.v)}
      >
        {t.v}
      </motion.div>
    </div>
  )
}

// Rolls the score to its new value.
function Count({ value }) {
  const reduce = useReducedMotion()
  const mv = useMotionValue(value)
  const text = useTransform(mv, (v) => Math.round(v).toLocaleString())
  useEffect(() => {
    if (reduce) {
      mv.set(value)
      return
    }
    const c = animate(mv, value, { duration: 0.35, ease: EASE })
    return () => c.stop()
  }, [mv, value, reduce])
  return <motion.span>{text}</motion.span>
}

const KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' }

export default function G2048() {
  const { report, celebrate } = useGame()
  const [grid, setGrid] = useState(fresh)
  const [score, setScore] = useState(0)
  const [over, setOver] = useState(false)
  const [won, setWon] = useState(false)
  const [isNew, setIsNew] = useState(false)
  const [round, setRound] = useState(0)
  const touch = useRef(null)
  const state = useRef({})
  state.current = { grid, score, over, won }

  const reset = useCallback(() => {
    setGrid(fresh())
    setScore(0)
    setOver(false)
    setWon(false)
    setIsNew(false)
    setRound((r) => r + 1)
  }, [])

  const go = useCallback(
    (dir) => {
      const { grid, score, over, won } = state.current
      if (over) return
      const r = move(grid, dir)
      if (!r.moved) return
      const g = addTile(r.g)
      const s = score + r.pts
      setGrid(g)
      setScore(s)
      if (!won && g.some((t) => t?.v === 2048)) {
        setWon(true)
        celebrate()
      }
      if (!canMove(g)) {
        setOver(true)
        setIsNew(report(s).isNew)
      }
    },
    [report, celebrate],
  )

  useEffect(() => {
    const onKey = (e) => {
      const dir = KEYS[e.key]
      if (dir) {
        e.preventDefault()
        go(dir)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  const onTouchStart = (e) => {
    const t = e.touches[0]
    touch.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e) => {
    if (!touch.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touch.current.x
    const dy = t.clientY - touch.current.y
    touch.current = null
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return
    go(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up')
  }

  const endGame = () => {
    if (!over && score > 0) setIsNew(report(score).isNew)
    reset()
  }

  return (
    <div className="mx-auto max-w-[460px]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-muted">Score</div>
          <div className="num text-3xl text-accent">
            <Count value={score} />
          </div>
        </div>
        <Button variant="ghost" onClick={endGame}>
          <ArrowClockwiseIcon size={16} weight="bold" />
          New game
        </Button>
      </div>

      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="relative touch-none select-none rounded-xl border border-line bg-surface p-2.5 sm:p-3"
      >
        <div className="relative [--g:0.625rem] sm:[--g:0.75rem]">
          <div className="grid grid-cols-4 gap-(--g)">
            {Array.from({ length: S * S }, (_, i) => (
              <div key={i} className="aspect-square rounded-md bg-surface-2/60" />
            ))}
          </div>
          {/* Keyed by round: a new game fades the old tiles out while the new ones scale in. */}
          <AnimatePresence>
            <motion.div key={round} className="absolute inset-0" exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {layout(grid).map((t) => (
                <Tile key={t.id} t={t} />
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {(over || won === true) && (
            <motion.div
              key="end"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="absolute inset-0 z-10 grid place-items-center rounded-xl bg-surface/90 p-6 text-center"
            >
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.35, delay: 0.08, ease: EASE }}
              >
                <p className="text-2xl font-semibold tracking-tight">{over ? 'No moves left' : 'You made 2048'}</p>
                <p className="num mt-2 text-muted">
                  {score.toLocaleString()} pts{over && isNew ? ', new best' : ''}
                </p>
                <div className="mt-6 flex justify-center gap-3">
                  {!over && (
                    <Button variant="ghost" onClick={() => setWon('kept')}>
                      Keep going
                    </Button>
                  )}
                  <Button onClick={over ? reset : endGame}>New game</Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm text-muted">
        <Kbd>Arrows</Kbd> or <Kbd>WASD</Kbd> to slide. Swipe on touch.
      </p>
    </div>
  )
}
