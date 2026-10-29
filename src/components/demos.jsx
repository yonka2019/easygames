import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { HeartIcon, LeafIcon, LightningIcon, MoonIcon, StarIcon, SunIcon, FlagIcon, CherriesIcon, BellIcon, DiamondIcon, NumberSevenIcon, CloverIcon } from '@phosphor-icons/react'
import { EASE, Swap } from './ui'
import { TypingDemo } from './TypingDemo'

// Looping mini previews for the home hero, one per game. All decorative (aria-hidden by the parent).
// Each runs off a tick counter that stays at 0 under reduced motion, so every demo has a static first frame.

function useTick(ms) {
  const reduce = useReducedMotion()
  const [t, setT] = useState(0)
  useEffect(() => {
    if (reduce) return
    const id = setInterval(() => setT((x) => x + 1), ms)
    return () => clearInterval(id)
  }, [ms, reduce])
  return t
}

const pct = (n, of) => `${(n / of) * 100}%`

function Top({ left, right }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="num text-accent">{left}</span>
      <span className="text-muted">{right}</span>
    </div>
  )
}

const PROBS = [['12 + 7', '19'], ['9 × 6', '54'], ['45 − 18', '27'], ['64 ÷ 8', '8'], ['13 + 29', '42']]

function MathDemo() {
  const t = useTick(220)
  const n = Math.floor(t / 10)
  const step = t % 10
  const [q, a] = PROBS[n % PROBS.length]
  const typed = a.slice(0, Math.max(0, step - 3))
  const done = step > 3 + a.length
  return (
    <div className="flex h-full flex-col">
      <Top left={`${n} solved`} right="60s" />
      <div className="grid flex-1 place-items-center">
        <Swap k={n}>
          <div className="num text-5xl tracking-tight md:text-6xl">
            {q} = <span className={`transition-colors duration-200 ${done ? 'text-accent' : 'text-ink'}`}>{typed || <span className="text-muted/50">?</span>}</span>
          </div>
        </Swap>
      </div>
    </div>
  )
}

function ReactionDemo() {
  const t = useTick(400) % 10
  const phase = t < 5 ? 'wait' : t < 7 ? 'go' : 'shown'
  const look = {
    wait: 'bg-danger/15 border-danger/40',
    go: 'bg-accent border-accent text-accent-ink',
    shown: 'bg-surface-2 border-line',
  }[phase]
  return (
    <div className={`grid h-full place-items-center rounded-lg border text-center transition-colors duration-300 ${look}`}>
      <Swap k={phase}>
        {phase === 'wait' && <span className="text-2xl font-semibold tracking-tight md:text-3xl">Wait for green</span>}
        {phase === 'go' && <span className="text-4xl font-semibold tracking-tight md:text-5xl">Click!</span>}
        {phase === 'shown' && <span className="num text-5xl text-accent md:text-6xl">231 ms</span>}
      </Swap>
    </div>
  )
}

const SPOTS = [[22, 30], [74, 24], [50, 66], [26, 74], [80, 64], [58, 36]]

function AimDemo() {
  const t = useTick(700)
  const [x, y] = SPOTS[t % SPOTS.length]
  const [px, py] = SPOTS[(t + SPOTS.length - 1) % SPOTS.length]
  return (
    <div className="dot-grid relative h-full overflow-hidden rounded-lg border border-line">
      <span className="num absolute right-3 top-3 text-sm text-muted">{30 - (t % 30)} left</span>
      {t > 0 && (
        <motion.span
          key={`hit${t}`}
          className="absolute -ml-7 -mt-7 size-14 rounded-full border-2 border-accent"
          style={{ left: `${px}%`, top: `${py}%` }}
          initial={{ scale: 1, opacity: 0.8 }}
          animate={{ scale: 1.8, opacity: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        />
      )}
      <motion.span
        key={`t${t}`}
        className="absolute -ml-7 -mt-7 grid size-14 place-items-center rounded-full border-2 border-accent bg-accent/20"
        style={{ left: `${x}%`, top: `${y}%` }}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 22 }}
      >
        <span className="size-2 rounded-full bg-accent" />
      </motion.span>
    </div>
  )
}

const NUMS = ['4829', '73015', '561829', '9043716']

function NumbersDemo() {
  const t = useTick(450)
  const lvl = Math.floor(t / 9) % NUMS.length
  const s = t % 9
  const num = NUMS[lvl]
  const phase = s < 4 ? 'show' : s < 8 ? 'type' : 'ok'
  const typed = phase === 'type' ? num.slice(0, Math.ceil(((s - 3) / 4) * num.length)) : num
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <span className="text-sm text-muted">Level {lvl + 1}</span>
      <Swap k={`${lvl}${phase === 'show'}`}>
        <div className={`num text-5xl tracking-[0.15em] transition-colors duration-200 md:text-6xl ${phase === 'ok' ? 'text-accent' : ''}`}>
          {typed}
          <span className="text-muted/40">{'_'.repeat(num.length - typed.length)}</span>
        </div>
      </Swap>
      <div className="h-1.5 w-48 overflow-hidden rounded-full bg-surface-2">
        {phase === 'show' && (
          <motion.div
            key={lvl}
            className="h-full bg-accent"
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: 1.8, ease: 'linear' }}
          />
        )}
      </div>
    </div>
  )
}

const SEQ = [0, 4, 8, 2, 6, 1]

function SequenceDemo() {
  const t = useTick(380)
  const len = 3 + (Math.floor(t / 16) % 3)
  const s = t % 16
  const lit = s % 2 === 0 && s / 2 < len ? SEQ[s / 2] : -1
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5">
      <span className="text-sm text-muted">Level {len - 2}</span>
      <div className="grid w-[min(100%,210px)] grid-cols-3 gap-3">
        {Array.from({ length: 9 }, (_, i) => (
          <span
            key={i}
            className={`aspect-square rounded-lg transition-[background-color,scale] duration-200 ease-out ${i === lit ? 'scale-[1.04] bg-accent' : 'bg-surface-2'}`}
          />
        ))}
      </div>
    </div>
  )
}

const WORD = 'brave'
const GUESSES = ['crane', 'grape', 'brave']
const LOOK = {
  correct: 'bg-accent border-accent text-accent-ink',
  present: 'border-accent text-accent',
  absent: 'bg-surface-2 border-surface-2 text-muted',
}
const grade = (g) => [...g].map((ch, i) => (WORD[i] === ch ? 'correct' : WORD.includes(ch) ? 'present' : 'absent'))

function WordDemo() {
  const t = useTick(170) % 34
  return (
    <div className="grid h-full place-items-center">
      <div className="grid gap-1.5">
        {Array.from({ length: 4 }, (_, r) => {
          const g = GUESSES[r] ?? ''
          const start = r * 8
          const shown = Math.max(0, Math.min(5, t - start))
          const revealed = g && t >= start + 6
          const res = g ? grade(g) : []
          return (
            <div key={r} className="flex gap-1.5">
              {Array.from({ length: 5 }, (_, i) => (
                <span
                  key={i}
                  style={{ transitionDelay: revealed ? `${i * 80}ms` : '0ms' }}
                  className={`num grid size-11 place-items-center rounded-md border-2 text-xl font-semibold uppercase transition-colors duration-300 md:size-12 ${
                    revealed ? LOOK[res[i]] : i < shown ? 'border-muted text-ink' : 'border-line text-transparent'
                  }`}
                >
                  {i < shown ? g[i] : ''}
                </span>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Snake runs a loop around the board; segments glide between cells.
const SW = 16
const SH = 10
const LOOP = (() => {
  const p = []
  for (let x = 2; x <= 13; x++) p.push([x, 2])
  for (let y = 3; y <= 7; y++) p.push([13, y])
  for (let x = 12; x >= 2; x--) p.push([x, 7])
  for (let y = 6; y >= 3; y--) p.push([2, y])
  return p
})()

function SnakeDemo() {
  const t = useTick(140)
  const L = LOOP.length
  const head = t % L
  const eaten = Math.floor(t / 14)
  const food = LOOP[((eaten + 1) * 14) % L]
  return (
    <div className="flex h-full flex-col">
      <Top left={`${eaten * 10} pts`} right="snake" />
      <div className="grid flex-1 place-items-center">
        <div className="line-grid relative aspect-[16/10] w-full max-w-[420px] rounded-lg border border-line">
          <span
            className="absolute rounded-full bg-danger transition-[left,top] duration-200"
            style={{ left: pct(food[0] + 0.2, SW), top: pct(food[1] + 0.2, SH), width: pct(0.6, SW), height: pct(0.6, SH) }}
          />
          {Array.from({ length: 5 }, (_, k) => {
            const [x, y] = LOOP[(head - k + L) % L]
            return (
              <span
                key={k}
                className={`absolute rounded-[3px] transition-[left,top] duration-[140ms] ease-linear ${k === 0 ? 'bg-accent' : 'bg-accent/60'}`}
                style={{ left: pct(x + 0.05, SW), top: pct(y + 0.05, SH), width: pct(0.9, SW), height: pct(0.9, SH) }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

const MW = 9
const MH = 6
const MINES = new Set([3, 14, 22, 30, 41, 47])
const ORIGIN = [1, 4]
const MCELLS = Array.from({ length: MW * MH }, (_, i) => {
  const x = i % MW
  const y = Math.floor(i / MW)
  let n = 0
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx
      const ny = y + dy
      if ((dx || dy) && nx >= 0 && ny >= 0 && nx < MW && ny < MH && MINES.has(ny * MW + nx)) n++
    }
  return { i, n, d: Math.hypot(x - ORIGIN[0], y - ORIGIN[1]) }
})
const MORDER = MCELLS.filter((c) => !MINES.has(c.i)).sort((a, b) => a.d - b.d).map((c) => c.i)
const MRANK = Object.fromEntries(MORDER.map((i, r) => [i, r]))
const MFLAGS = [...MINES]

function MinesDemo() {
  const t = useTick(130) % 34
  const open = t * 3
  const flags = Math.max(0, t - 17)
  return (
    <div className="grid h-full place-items-center">
      <div className="grid w-full max-w-[400px] grid-cols-9 gap-1">
        {MCELLS.map((c) => {
          const isOpen = !MINES.has(c.i) && MRANK[c.i] < open
          const flagged = MFLAGS.indexOf(c.i) > -1 && MFLAGS.indexOf(c.i) < flags
          return (
            <span
              key={c.i}
              className={`num grid aspect-square place-items-center rounded-md text-sm font-semibold transition-colors duration-200 ${isOpen ? 'bg-surface-2' : 'bg-line'}`}
            >
              <AnimatePresence>
                {isOpen && c.n > 0 && (
                  <motion.span key="n" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className={c.n > 1 ? 'text-danger' : 'text-accent'}>
                    {c.n}
                  </motion.span>
                )}
                {flagged && (
                  <motion.span key="f" initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}>
                    <FlagIcon size={14} weight="fill" className="text-accent" />
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
          )
        })}
      </div>
    </div>
  )
}

const CHIMP = [[18, 30], [62, 22], [40, 62], [80, 58], [24, 78]]

function ChimpDemo() {
  const t = useTick(380) % 14
  const hidden = t >= 5
  const tapped = Math.max(0, t - 5)
  return (
    <div className="relative h-full overflow-hidden rounded-lg border border-line">
      <AnimatePresence>
        {CHIMP.map(([x, y], i) =>
          i < tapped ? null : (
            <motion.span
              key={i}
              className={`num absolute -ml-6 -mt-6 grid size-12 place-items-center rounded-lg border-2 border-accent text-xl font-semibold transition-colors duration-200 ${hidden ? 'bg-accent text-transparent' : 'bg-surface text-ink'}`}
              style={{ left: `${x}%`, top: `${y}%` }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.25, ease: EASE }}
            >
              {i + 1}
            </motion.span>
          ),
        )}
      </AnimatePresence>
    </div>
  )
}

const SYMS = [HeartIcon, StarIcon, MoonIcon, SunIcon, LeafIcon, LightningIcon]
const DECK = [0, 3, 1, 5, 2, 4, 3, 0, 5, 1, 4, 2]
const STEPS = [[0, 3], [0, 7], [2, 5], [2, 9], [1, 6], [4, 11], [3, 8], [5, 10]]

function PairsDemo() {
  const t = useTick(420) % (STEPS.length * 3 + 5)
  const step = Math.floor(t / 3)
  const sub = t % 3
  const up = new Set()
  STEPS.forEach(([a, b], s) => {
    const match = DECK[a] === DECK[b]
    if (s < step && match) up.add(a).add(b)
    if (s === step) {
      up.add(a)
      if (sub >= 1) up.add(b)
      if (sub === 2 && !match) {
        up.delete(a)
        up.delete(b)
      }
    }
  })
  return (
    <div className="grid h-full place-items-center">
      <div className="grid w-full max-w-[340px] grid-cols-4 gap-2.5">
        {DECK.map((s, i) => {
          const Icon = SYMS[s]
          const on = up.has(i)
          return (
            <span key={i} className="aspect-square [perspective:600px]">
              <span
                className="relative block size-full transition-transform duration-300 [transform-style:preserve-3d]"
                style={{ transform: on ? 'rotateY(180deg)' : 'none' }}
              >
                <span className="absolute inset-0 rounded-lg border border-line bg-surface-2 [backface-visibility:hidden]" />
                <span className="absolute inset-0 grid place-items-center rounded-lg border border-accent/50 bg-accent/10 text-accent [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  <Icon size={22} weight="duotone" />
                </span>
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

// 2048: scripted moves. Tiles keep ids so they slide; "gone" tiles slide into their merge partner and fade.
const MOVES = [
  [{ id: 1, v: 2, r: 0, c: 0 }, { id: 2, v: 2, r: 0, c: 2 }, { id: 3, v: 4, r: 2, c: 1 }, { id: 4, v: 8, r: 3, c: 3 }],
  [{ id: 1, v: 4, r: 0, c: 0 }, { id: 2, v: 2, r: 0, c: 0, gone: 1 }, { id: 3, v: 4, r: 2, c: 0 }, { id: 4, v: 8, r: 3, c: 0 }, { id: 5, v: 2, r: 1, c: 3 }],
  [{ id: 1, v: 4, r: 2, c: 0, gone: 1 }, { id: 3, v: 8, r: 2, c: 0 }, { id: 4, v: 8, r: 3, c: 0 }, { id: 5, v: 2, r: 3, c: 3 }, { id: 6, v: 2, r: 0, c: 1 }],
  [{ id: 3, v: 8, r: 3, c: 0, gone: 1 }, { id: 4, v: 16, r: 3, c: 0 }, { id: 5, v: 2, r: 3, c: 3 }, { id: 6, v: 2, r: 3, c: 1 }, { id: 7, v: 4, r: 0, c: 2 }],
]

function tile(v) {
  const p = Math.min(100, Math.log2(v) * 9)
  return { background: `color-mix(in oklab, var(--accent) ${p}%, var(--surface-2))`, color: p > 55 ? 'var(--accent-ink)' : 'var(--text)' }
}

function G2048Demo() {
  const t = useTick(900) % (MOVES.length + 1)
  const state = MOVES[Math.min(t, MOVES.length - 1)]
  return (
    <div className="grid h-full place-items-center">
      <div className="relative aspect-square w-[min(100%,250px)] rounded-xl border border-line bg-surface p-2">
        <div className="grid size-full grid-cols-4 grid-rows-4 gap-2">
          {Array.from({ length: 16 }, (_, i) => (
            <span key={i} className="rounded-md bg-surface-2/60" />
          ))}
        </div>
        <div className="absolute inset-2">
          <AnimatePresence>
            {state.map((s) => (
              <motion.span
                key={s.id}
                className="num absolute grid place-items-center rounded-md text-xl font-semibold"
                style={{ ...tile(s.v), width: 'calc(25% - 6px)', height: 'calc(25% - 6px)', zIndex: s.gone ? 0 : 1 }}
                initial={{ opacity: 0, scale: 0.4, left: `calc(${s.c * 25}% + ${s.c * 2}px)`, top: `calc(${s.r * 25}% + ${s.r * 2}px)` }}
                animate={{ opacity: s.gone ? 0 : 1, scale: 1, left: `calc(${s.c * 25}% + ${s.c * 2}px)`, top: `calc(${s.r * 25}% + ${s.r * 2}px)` }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15, ease: 'easeOut', opacity: { duration: 0.2, delay: s.gone ? 0.1 : 0.05 } }}
              >
                {s.v}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

// Casino: three reels scroll and stop left to right; every other spin lands a win.
const REEL = [CherriesIcon, BellIcon, DiamondIcon, NumberSevenIcon, CloverIcon]
const LANDS = [[3, 3, 3], [0, 2, 1], [1, 1, 1], [4, 0, 2]]
const RH = 64

function CasinoDemo() {
  const t = useTick(110) % 30
  const spin = Math.floor(useTick(3300) % LANDS.length)
  const land = LANDS[spin]
  const win = land[0] === land[1] && land[1] === land[2]
  const stopped = (r) => t >= 8 + r * 5
  const allStopped = stopped(2)
  return (
    <div className="flex h-full flex-col">
      <Top left={`${100 + spin * 15} coins`} right="slots" />
      <div className="grid flex-1 place-items-center">
        <div className="relative grid w-full max-w-[320px] grid-cols-3 gap-3 rounded-xl border border-line p-3">
          {[0, 1, 2].map((r) => {
            const idx = stopped(r) ? land[r] : (t + r * 2) % REEL.length
            const Icon = REEL[idx]
            return (
              <div key={r} className="relative grid place-items-center overflow-hidden rounded-lg bg-surface-2/60" style={{ height: RH * 1.6 }}>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={`${idx}-${stopped(r)}-${stopped(r) ? spin : t}`}
                    initial={{ y: -RH, opacity: 0.4 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: RH, opacity: 0.4 }}
                    transition={stopped(r) ? { type: 'spring', stiffness: 380, damping: 22 } : { duration: 0.1, ease: 'linear' }}
                  >
                    <Icon size={38} weight="duotone" className={idx === 0 || idx === 3 ? 'text-danger' : 'text-accent'} />
                  </motion.span>
                </AnimatePresence>
              </div>
            )
          })}
          <div
            className={`pointer-events-none absolute inset-1 rounded-lg border-2 transition-colors duration-300 ${allStopped && win ? 'border-accent' : 'border-transparent'}`}
          />
        </div>
      </div>
    </div>
  )
}

export const DEMOS = {
  typing: TypingDemo,
  math: MathDemo,
  reaction: ReactionDemo,
  aim: AimDemo,
  numbers: NumbersDemo,
  sequence: SequenceDemo,
  word: WordDemo,
  snake: SnakeDemo,
  mines: MinesDemo,
  chimp: ChimpDemo,
  pairs: PairsDemo,
  2048: G2048Demo,
  casino: CasinoDemo,
}
