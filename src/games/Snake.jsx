import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { ArrowUpIcon, ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon, PathIcon } from '@phosphor-icons/react'
import { cssVar } from '../lib/util'
import { useGame } from '../components/GameFrame'
import { Button, EASE, Kbd, Swap } from '../components/ui'

const N = 20
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }
const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' }
const opposite = (a, b) => DIRS[a][0] + DIRS[b][0] === 0 && DIRS[a][1] + DIRS[b][1] === 0

function food(snake) {
  for (;;) {
    const f = { x: Math.floor(Math.random() * N), y: Math.floor(Math.random() * N) }
    if (!snake.some((p) => p.x === f.x && p.y === f.y)) return f
  }
}

function initial() {
  const snake = [
    { x: 8, y: 10 },
    { x: 7, y: 10 },
    { x: 6, y: 10 },
  ]
  return { snake, dir: 'right', queue: [], food: food(snake), speed: 130 }
}

// Drawing state between ticks: last step's snake, when it started, how long it lasts, eaten food.
const still = () => ({ prev: null, at: 0, dur: 1, ate: null, foodAt: 0, paused: 0 })

// Rolls the score to its new value.
function Count({ value }) {
  const reduce = useReducedMotion()
  const mv = useMotionValue(value)
  const text = useTransform(mv, (v) => Math.round(v))
  useEffect(() => {
    if (reduce) {
      mv.set(value)
      return
    }
    const c = animate(mv, value, { duration: 0.3, ease: EASE })
    return () => c.stop()
  }, [mv, value, reduce])
  return <motion.span>{text}</motion.span>
}

export default function Snake() {
  const { report, ended } = useGame()
  const canvas = useRef(null)
  const game = useRef(initial())
  const anim = useRef(still())
  const reduce = useReducedMotion()
  const reduced = useRef(reduce)
  reduced.current = reduce
  const [status, setStatus] = useState('idle') // idle | run | pause | over
  const [score, setScore] = useState(0)
  const [isNew, setIsNew] = useState(false)
  const touch = useRef(null)

  const draw = useCallback(() => {
    const c = canvas.current
    if (!c) return
    const size = c.clientWidth
    const dpr = window.devicePixelRatio || 1
    if (c.width !== Math.round(size * dpr)) {
      c.width = Math.round(size * dpr)
      c.height = Math.round(size * dpr)
    }
    const ctx = c.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const cell = size / N
    ctx.clearRect(0, 0, size, size)
    ctx.fillStyle = cssVar('--line')
    for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) ctx.fillRect(x * cell + cell / 2 - 1, y * cell + cell / 2 - 1, 2, 2)
    const { snake, food: f } = game.current
    const a = anim.current
    const now = performance.now()
    // k = progress of the current step (0..1). Body cells stay put; only the head and tail move.
    const k = reduced.current ? 1 : Math.min(1, (now - a.at) / a.dur)
    const dot = (p, r) => {
      ctx.beginPath()
      ctx.arc(p.x * cell + cell / 2, p.y * cell + cell / 2, r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = cssVar('--danger')
    // Eaten food stays until the head slides over it; the new one grows in.
    if (a.ate && k < 1) dot(a.ate, cell * 0.32)
    const grow = reduced.current ? 1 : Math.min(1, (now - a.foodAt) / 220)
    dot(f, cell * 0.32 * (1 - (1 - grow) ** 3))
    ctx.fillStyle = cssVar('--accent')
    // Rect in cell units, same inset and fade-by-index as a whole segment.
    const box = (x0, y0, x1, y1, i) => {
      const w = (x1 - x0) * cell - 3
      const h = (y1 - y0) * cell - 3
      if (w <= 0 || h <= 0) return
      ctx.globalAlpha = i <= 0 ? 1 : Math.max(0.45, 1 - i * 0.02)
      ctx.beginPath()
      ctx.roundRect(x0 * cell + 1.5, y0 * cell + 1.5, w, h, cell * 0.22)
      ctx.fill()
    }
    // Tail: the cell it leaves shrinks toward the body.
    const prev = a.prev ?? snake
    const last = snake.length - 1
    const t0 = prev[prev.length - 1]
    const dx = snake[last].x - t0.x
    const dy = snake[last].y - t0.y
    if (dx || dy) box(t0.x + (dx > 0 ? k : 0), t0.y + (dy > 0 ? k : 0), t0.x + 1 - (dx < 0 ? k : 0), t0.y + 1 - (dy < 0 ? k : 0), prev.length - 1 + k)
    for (let i = last; i >= 1; i--) box(snake[i].x, snake[i].y, snake[i].x + 1, snake[i].y + 1, i - 1 + k)
    // Head glides from the neck into its new cell.
    const hx = snake[1].x + (snake[0].x - snake[1].x) * k
    const hy = snake[1].y + (snake[0].y - snake[1].y) * k
    box(hx, hy, hx + 1, hy + 1, 0)
    ctx.globalAlpha = 1
  }, [])

  const reset = useCallback(() => {
    game.current = initial()
    anim.current = still()
    setScore(0)
    setIsNew(false)
    setStatus('idle')
    requestAnimationFrame(draw)
  }, [draw])

  useEffect(() => {
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(canvas.current)
    const mo = new MutationObserver(draw)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      ro.disconnect()
      mo.disconnect()
    }
  }, [draw])

  useEffect(() => {
    if (status !== 'run') return
    // Resume mid-step where the drawing paused.
    const a = anim.current
    if (a.paused) {
      const d = performance.now() - a.paused
      a.at += d
      a.foodAt += d
      a.paused = 0
    }
    let id
    const tick = () => {
      const g = game.current
      while (g.queue.length) {
        const d = g.queue.shift()
        if (d !== g.dir && !opposite(d, g.dir)) {
          g.dir = d
          break
        }
      }
      const [dx, dy] = DIRS[g.dir]
      const head = { x: g.snake[0].x + dx, y: g.snake[0].y + dy }
      const eat = head.x === g.food.x && head.y === g.food.y
      const body = eat ? g.snake : g.snake.slice(0, -1)
      if (head.x < 0 || head.y < 0 || head.x >= N || head.y >= N || body.some((p) => p.x === head.x && p.y === head.y)) {
        const pts = (g.snake.length - 3) * 10
        if (pts > 0) setIsNew(report(pts).isNew)
        else {
          setIsNew(false)
          ended()
        }
        setStatus('over')
        draw()
        return
      }
      const a = anim.current
      a.prev = g.snake
      a.ate = eat ? g.food : null
      g.snake = [head, ...body]
      if (eat) {
        g.food = food(g.snake)
        g.speed = Math.max(60, g.speed - 3)
        setScore((g.snake.length - 3) * 10)
        a.foodAt = performance.now()
      }
      a.at = performance.now()
      a.dur = g.speed
      draw()
      id = setTimeout(tick, g.speed)
    }
    id = setTimeout(tick, game.current.speed)
    return () => {
      clearTimeout(id)
      anim.current.paused = performance.now()
    }
  }, [status, draw, report, ended])

  // Glide between ticks. Reduced motion keeps the grid step.
  useEffect(() => {
    if (status !== 'run' || reduce) return
    let raf
    const frame = () => {
      draw()
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [status, reduce, draw])

  const steer = useCallback(
    (d) => {
      const g = game.current
      if (g.queue.length < 3) g.queue.push(d)
      setStatus((s) => (s === 'idle' ? 'run' : s))
    },
    [],
  )

  useEffect(() => {
    const onKey = (e) => {
      const d = KEYS[e.key]
      if (d && status !== 'over') {
        e.preventDefault()
        steer(d)
      } else if ((e.code === 'Space' || e.key === 'p') && (status === 'run' || status === 'pause')) {
        e.preventDefault()
        setStatus(status === 'run' ? 'pause' : 'run')
      } else if (e.key === 'Enter' && status === 'over') reset()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [status, steer, reset])

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
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up')
  }

  const pad = (d, Icon) => (
    <button
      type="button"
      aria-label={d}
      onPointerDown={() => steer(d)}
      className="grid size-14 place-items-center rounded-xl border border-line bg-surface text-ink transition-[scale,background-color] duration-150 active:scale-95 active:bg-surface-2 motion-reduce:transition-none"
    >
      <Icon size={22} weight="bold" />
    </button>
  )

  return (
    <div className="mx-auto max-w-[520px]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-muted">Score</div>
          <div className="num text-3xl text-accent">
            <Count value={score} />
          </div>
        </div>
        <AnimatePresence>
          {status === 'pause' && (
            <motion.span
              key="pause"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: EASE }}
              className="text-sm text-muted"
            >
              Paused
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="relative rounded-xl border border-line bg-surface p-2" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <canvas ref={canvas} className="block aspect-square w-full touch-none" aria-label="Snake board" />
        <AnimatePresence initial={false}>
          {(status === 'idle' || status === 'over') && (
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: EASE }}
              className="absolute inset-0 grid place-items-center rounded-xl bg-surface/85 p-6 text-center"
            >
              <Swap k={status}>
                {status === 'idle' ? (
                  <>
                    <PathIcon size={44} weight="duotone" className="mx-auto text-accent" />
                    <p className="mt-4 text-muted">Press an arrow key or swipe to start.</p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-semibold tracking-tight">Game over</p>
                    <p className="num mt-2 text-muted">
                      {score} pts{isNew ? ', new best' : ''}
                    </p>
                    <Button className="mt-6 h-11 px-6" onClick={reset}>
                      Play again
                    </Button>
                  </>
                )}
              </Swap>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-6 grid justify-center gap-2 sm:hidden">
        <div className="flex justify-center">{pad('up', ArrowUpIcon)}</div>
        <div className="flex gap-2">
          {pad('left', ArrowLeftIcon)}
          {pad('down', ArrowDownIcon)}
          {pad('right', ArrowRightIcon)}
        </div>
      </div>

      <p className="mt-4 hidden flex-wrap items-center justify-center gap-2 text-sm text-muted sm:flex">
        <Kbd>Arrows</Kbd> or <Kbd>WASD</Kbd> to steer. <Kbd>Space</Kbd> to pause.
      </p>
    </div>
  )
}
