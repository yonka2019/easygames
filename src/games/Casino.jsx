import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, animate, motion, useReducedMotion } from 'motion/react'
import {
  BellIcon,
  CherriesIcon,
  CoinIcon,
  CloverIcon,
  DiamondIcon,
  NumberSevenIcon,
  OrangeSliceIcon,
  StarIcon,
} from '@phosphor-icons/react'
import { useGame } from '../components/GameFrame'
import { Button, EASE, Kbd, Result, Segmented, Swap } from '../components/ui'

// Play money only. Slots return 94.6% at bet 1 up to 99% at bet 25 (bigger bets make rare symbols likelier);
// European roulette 97.3%. The house still wins over time.
const START = 200
const BETS = ['1', '5', '10', '25']
const MODES = [
  { value: 'slots', label: 'Slots' },
  { value: 'roulette', label: 'Roulette' },
  { value: 'levels', label: 'Levels' },
  { value: 'pinpoint', label: 'Pinpoint' },
]

const weighted = (items) => {
  const total = items.reduce((n, s) => n + s.w, 0)
  let r = Math.random() * total
  return items.findIndex((s) => (r -= s.w) < 0)
}

// Balance that counts to its new value instead of jumping. `start` makes the first count run up from there.
function Coins({ value, start }) {
  const reduce = useReducedMotion()
  const [n, setN] = useState(reduce ? value : (start ?? value))
  const from = useRef(reduce ? value : (start ?? value))
  useEffect(() => {
    if (reduce) {
      from.current = value
      return setN(value)
    }
    const c = animate(from.current, value, {
      duration: from.current === start ? 0.9 : 0.6,
      ease: EASE,
      onUpdate: (v) => {
        from.current = v
        setN(Math.round(v))
      },
    })
    return () => c.stop()
  }, [value, reduce])
  return n.toLocaleString()
}

// Shared bankroll for slots and roulette. The run ends on cash out or when broke; the score is the peak balance.
function useBank() {
  const [bank, setBank] = useState({ balance: START, peak: START, spins: 0, biggest: 0 })
  const settle = (bet, win) =>
    setBank((b) => {
      const balance = b.balance - bet + win
      return { balance, peak: Math.max(b.peak, balance), spins: b.spins + 1, biggest: Math.max(b.biggest, win - bet) }
    })
  const reset = () => setBank({ balance: START, peak: START, spins: 0, biggest: 0 })
  return { bank, settle, reset }
}

// Starting credits handed over: a few coins fly up into the balance with a "+200" tag. Off under reduced motion.
function Deal({ amount }) {
  const reduce = useReducedMotion()
  if (reduce) return null
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <motion.span
        className="num absolute -top-5 right-0 text-sm font-medium text-accent"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: [0, 1, 1, 0], y: [10, 0, -4, -12] }}
        transition={{ duration: 1.3, times: [0, 0.2, 0.75, 1], ease: EASE }}
      >
        +{amount}
      </motion.span>
      {Array.from({ length: 7 }, (_, i) => (
        <motion.span
          key={i}
          className="absolute bottom-0 right-6 text-accent"
          initial={{ opacity: 0, x: (i - 3) * 14, y: 46, scale: 0.6 }}
          animate={{ opacity: [0, 1, 1, 0], x: [(i - 3) * 14, (i - 3) * 6, 0], y: [46, 18, 0], scale: [0.6, 1, 0.5] }}
          transition={{ duration: 0.55, delay: i * 0.06, ease: 'easeOut', opacity: { duration: 0.55, delay: i * 0.06, times: [0, 0.2, 0.8, 1] } }}
        >
          <CoinIcon size={16} weight="fill" />
        </motion.span>
      ))}
    </div>
  )
}

/* ---------- Slots ---------- */

const SYMS = [
  { id: 'cherry', Icon: CherriesIcon, w: 8, pay: 10, tint: 'text-danger' },
  { id: 'orange', Icon: OrangeSliceIcon, w: 7, pay: 14, tint: 'text-accent' },
  { id: 'bell', Icon: BellIcon, w: 6, pay: 18, tint: 'text-ink' },
  { id: 'clover', Icon: CloverIcon, w: 5, pay: 28, tint: 'text-accent' },
  { id: 'star', Icon: StarIcon, w: 3, pay: 60, tint: 'text-ink' },
  { id: 'diamond', Icon: DiamondIcon, w: 2, pay: 100, tint: 'text-accent' },
  { id: 'seven', Icon: NumberSevenIcon, w: 1, pay: 500, tint: 'text-danger' },
]
const CELL = 84
// Bigger bets add weight to star, diamond and seven (tuned offline for the returns below).
const BOOST = [
  { min: 25, a: 2.655, rtp: 99, big: 4.3 },
  { min: 10, a: 2.436, rtp: 97.5, big: 3.9 },
  { min: 5, a: 2.187, rtp: 96, big: 3.5 },
  { min: 1, a: 0, rtp: 94.6, big: 1 },
]
const RARE = { star: 1, diamond: 0.7, seven: 0.35 }
const boostFor = (bet) => BOOST.find((b) => bet >= b.min) ?? BOOST.at(-1)
const reelFor = (bet) => {
  const { a } = boostFor(bet)
  return SYMS.map((s) => ({ ...s, w: s.w + a * (RARE[s.id] ?? 0) }))
}
const roll = (reel = SYMS) => weighted(reel)

// Multiplier on the bet (stake included). Center line only.
function slotPay([a, b, c]) {
  if (a === b && b === c) return SYMS[a].pay
  if (a === 0 && b === 0) return 3
  if (a === 0) return 1
  return 0
}

const reelTime = (index) => 1 + index * 0.35

function Reel({ strip, spin, index, reduce }) {
  return (
    <div className="relative overflow-hidden rounded-lg bg-surface-2/60" style={{ height: CELL * 3 }}>
      <motion.div
        key={spin}
        initial={{ y: 0 }}
        animate={{ y: -(strip.length - 3) * CELL }}
        transition={reduce || !spin ? { duration: 0 } : { duration: reelTime(index), ease: [0.12, 0.8, 0.25, 1] }}
      >
        {strip.map((s, i) => {
          const { Icon, tint } = SYMS[s]
          return (
            <div key={i} className="grid place-items-center" style={{ height: CELL }}>
              <Icon size={46} weight="duotone" className={tint} />
            </div>
          )
        })}
      </motion.div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-surface to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-surface to-transparent" />
    </div>
  )
}

function Slots({ bet, busy, setBusy, settle }) {
  const reduce = useReducedMotion()
  const [view, setView] = useState(() => [0, 1, 2].map(() => [roll(), roll(), roll()]))
  const [strips, setStrips] = useState(view)
  const [spin, setSpin] = useState(0)
  const [win, setWin] = useState(null)
  const pending = useRef(null)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  const go = useCallback(() => {
    if (busy) return
    const reel = reelFor(bet)
    const next = [0, 1, 2].map(() => [roll(reel), roll(reel), roll(reel)])
    setStrips(view.map((old, r) => [...old, ...Array.from({ length: 16 + r * 5 }, () => roll(reel)), ...next[r]]))
    pending.current = { next, bet }
    setWin(null)
    setBusy(true)
    setSpin((s) => s + 1)
    // Settle on a timer matched to the last reel (onAnimationComplete is unreliable across remounts).
    timer.current = setTimeout(settleSpin, reduce ? 0 : reelTime(2) * 1000 + 60)
  }, [busy, view, bet, setBusy, reduce]) // eslint-disable-line react-hooks/exhaustive-deps

  function settleSpin() {
    if (!pending.current) return
    const { next, bet: b } = pending.current
    pending.current = null
    const mult = slotPay(next.map((r) => r[1]))
    setView(next)
    setStrips(next)
    setSpin(0)
    setWin({ mult, amount: mult * b, k: Date.now() })
    settle(b, mult * b)
    setBusy(false)
  }

  useSpace(go, !busy)

  const lit = win && win.mult > 1
  return (
    <div>
      <div className="relative grid grid-cols-3 gap-3 rounded-xl border border-line bg-surface p-3 sm:gap-4 sm:p-4">
        {strips.map((s, r) => (
          <Reel key={r} strip={s} spin={spin} index={r} reduce={reduce} />
        ))}
        {/* Pay line */}
        <div
          className={`pointer-events-none absolute inset-x-2 top-1/2 h-[84px] -translate-y-1/2 rounded-lg border-2 transition-[border-color,background-color] duration-300 ${lit ? 'border-accent bg-accent/10' : 'border-line/70'}`}
        />
      </div>
      <div className="mt-4 h-7 text-center">
        <Swap k={busy ? 'spin' : win ? win.k : 'idle'}>
          {busy ? (
            <span className="text-muted">Spinning…</span>
          ) : win ? (
            win.mult > 1 ? (
              <span className="num text-lg text-accent">+{(win.amount - bet).toLocaleString()} · {win.mult}x</span>
            ) : win.mult === 1 ? (
              <span className="text-muted">Bet back</span>
            ) : (
              <span className="text-muted">No win</span>
            )
          ) : (
            <span className="text-muted">3 in the middle row win. Bigger bets = bigger wins more often.</span>
          )}
        </Swap>
      </div>
      <div className="mt-5 flex justify-center">
        <Button onClick={go} disabled={busy} className="h-12 px-10 text-base">
          Spin
        </Button>
      </div>
      <PayTable />
    </div>
  )
}

function PayTable() {
  return (
    <div className="mx-auto mt-8 grid max-w-md grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
      {[...SYMS].reverse().map(({ id, Icon, pay, tint }) => (
        <div key={id} className="flex items-center justify-between gap-2">
          <span className="flex">
            {[0, 1, 2].map((i) => (
              <Icon key={i} size={16} weight="duotone" className={tint} />
            ))}
          </span>
          <span className="num text-muted">{pay}x</span>
        </div>
      ))}
      <div className="flex items-center justify-between gap-2">
        <span className="flex">
          <CherriesIcon size={16} weight="duotone" className="text-danger" />
          <CherriesIcon size={16} weight="duotone" className="text-danger" />
        </span>
        <span className="num text-muted">3x</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <CherriesIcon size={16} weight="duotone" className="text-danger" />
        <span className="num text-muted">1x</span>
      </div>
    </div>
  )
}

/* ---------- Roulette (European, single zero) ---------- */

const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])
const SLICE = 360 / WHEEL.length
const colorOf = (n) => (n === 0 ? 'green' : RED.has(n) ? 'red' : 'black')
const PICKS = [
  { value: 'red', label: 'Red', wins: (n) => colorOf(n) === 'red', pay: 2 },
  { value: 'black', label: 'Black', wins: (n) => colorOf(n) === 'black', pay: 2 },
  { value: 'odd', label: 'Odd', wins: (n) => n > 0 && n % 2 === 1, pay: 2 },
  { value: 'even', label: 'Even', wins: (n) => n > 0 && n % 2 === 0, pay: 2 },
  { value: 'low', label: '1–18', wins: (n) => n >= 1 && n <= 18, pay: 2 },
  { value: 'high', label: '19–36', wins: (n) => n >= 19, pay: 2 },
  { value: 'zero', label: '0', wins: (n) => n === 0, pay: 36 },
]
// Fixed dark for black pockets so they stay black in the light theme too.
const BLACK = '#1b1d21'
const FILL = { red: 'var(--danger)', black: BLACK, green: 'var(--accent)' }

function wedge(i, r) {
  const a0 = ((i - 0.5) * SLICE - 90) * (Math.PI / 180)
  const a1 = ((i + 0.5) * SLICE - 90) * (Math.PI / 180)
  return `M0 0 L${r * Math.cos(a0)} ${r * Math.sin(a0)} A${r} ${r} 0 0 1 ${r * Math.cos(a1)} ${r * Math.sin(a1)} Z`
}

const SPIN_S = 3.4

function Wheel({ rotation, duration }) {
  return (
    <div className="relative mx-auto aspect-square w-[min(100%,320px)]">
      <motion.svg
        viewBox="-110 -110 220 220"
        className="size-full"
        initial={false}
        animate={{ rotate: rotation }}
        transition={{ duration, ease: [0.15, 0.6, 0.2, 1] }}
      >
        <circle r="108" fill="var(--line)" />
        {WHEEL.map((n, i) => (
          <g key={n}>
            <path d={wedge(i, 104)} fill={FILL[colorOf(n)]} stroke="var(--bg)" strokeWidth="0.6" />
            <text
              x="0"
              y="-92"
              transform={`rotate(${i * SLICE})`}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="8"
              className="num"
              fill={n === 0 ? 'var(--accent-ink)' : '#f2f3f0'}
            >
              {n}
            </text>
          </g>
        ))}
        <circle r="62" fill="var(--surface)" stroke="var(--line)" />
      </motion.svg>
      {/* Pointer */}
      <div className="absolute left-1/2 top-0 -ml-2 h-0 w-0 border-x-8 border-t-[14px] border-x-transparent border-t-ink" />
    </div>
  )
}

function Roulette({ bet, busy, setBusy, settle }) {
  const reduce = useReducedMotion()
  const [pick, setPick] = useState('red')
  const [rotation, setRotation] = useState(0)
  const [last, setLast] = useState(null)
  const [shown, setShown] = useState(null)
  const pending = useRef(null)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  const go = useCallback(() => {
    if (busy) return
    const i = Math.floor(Math.random() * WHEEL.length)
    const target = -i * SLICE
    const turn = (((target - rotation) % 360) + 360) % 360
    pending.current = { n: WHEEL[i], bet, pick }
    setShown(null)
    setBusy(true)
    setRotation(rotation + (reduce ? 0 : 360 * 5) + turn)
    // Settle when the wheel stops; right away under reduced motion (no spin there).
    timer.current = setTimeout(done, reduce ? 0 : SPIN_S * 1000 + 60)
  }, [busy, rotation, bet, pick, reduce, setBusy]) // eslint-disable-line react-hooks/exhaustive-deps

  function done() {
    if (!pending.current) return
    const { n, bet: b, pick: p } = pending.current
    pending.current = null
    const rule = PICKS.find((x) => x.value === p)
    const win = rule.wins(n) ? rule.pay * b : 0
    setLast(n)
    setShown({ n, win, b })
    settle(b, win)
    setBusy(false)
  }

  useSpace(go, !busy)

  return (
    <div>
      <div className="relative">
        <Wheel rotation={rotation} duration={reduce ? 0 : SPIN_S} />
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <Swap k={busy ? 'spin' : last ?? 'none'}>
            {busy || last === null ? (
              <span className="text-sm text-muted">{busy ? 'Spinning…' : 'Pick a bet'}</span>
            ) : (
              <span
                className={`num grid size-16 place-items-center rounded-full text-2xl font-semibold ${
                  colorOf(last) === 'red' ? 'bg-danger text-[#f2f3f0]' : colorOf(last) === 'green' ? 'bg-accent text-accent-ink' : 'bg-[#1b1d21] text-[#f2f3f0]'
                }`}
              >
                {last}
              </span>
            )}
          </Swap>
        </div>
      </div>
      <div className="mt-4 h-7 text-center">
        <Swap k={shown ? `${shown.n}-${rotation}` : 'none'}>
          {shown ? (
            shown.win ? (
              <span className="num text-lg text-accent">+{(shown.win - shown.b).toLocaleString()}</span>
            ) : (
              <span className="text-muted">No win</span>
            )
          ) : (
            <span className="text-muted">Red, black, odd, even, low, high pay 2x. Zero pays 36x.</span>
          )}
        </Swap>
      </div>
      <div className="mt-5 flex flex-col items-center gap-4">
        <div className={`max-w-full overflow-x-auto transition-opacity duration-200 ${busy ? 'pointer-events-none opacity-50' : ''}`}>
          <Segmented label="Bet on" options={PICKS} value={pick} onChange={setPick} />
        </div>
        <Button onClick={go} disabled={busy} className="h-12 px-10 text-base">
          Spin
        </Button>
      </div>
    </div>
  )
}

/* ---------- Levels: each level is harder, one miss ends the run ---------- */

const rateOf = (level) => Math.max(5, 105 - level * 5)

function Levels({ onFail }) {
  const reduce = useReducedMotion()
  const [level, setLevel] = useState(1)
  const [busy, setBusy] = useState(false)
  const [marker, setMarker] = useState(null)
  const [msg, setMsg] = useState(null)
  const rate = rateOf(level)

  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  const go = useCallback(() => {
    if (busy) return
    const roll = Math.random() * 100
    const m = { roll, k: Date.now() }
    setBusy(true)
    setMsg(null)
    setMarker(m)
    timer.current = setTimeout(() => landed(m), reduce ? 0 : 1460)
  }, [busy, reduce]) // eslint-disable-line react-hooks/exhaustive-deps

  function landed(marker) {
    const ok = marker.roll < rate
    setBusy(false)
    if (ok) {
      setMsg({ ok, k: marker.k })
      setLevel((l) => l + 1)
    } else {
      setMsg({ ok, k: marker.k })
      timer.current = setTimeout(() => onFail(level - 1), reduce ? 0 : 700)
    }
  }

  useSpace(go, !busy && !(msg && !msg.ok))

  return (
    <div className="mx-auto max-w-[640px]">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs text-muted">Level</div>
          <Swap k={level}>
            <div className="num text-5xl text-accent">{level}</div>
          </Swap>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted">Success rate</div>
          <Swap k={rate}>
            <div className="num text-3xl text-ink">{rate}%</div>
          </Swap>
        </div>
      </div>

      <div className="relative mt-8 h-14 overflow-hidden rounded-xl border border-line bg-surface">
        <motion.div
          className="absolute inset-y-0 left-0 bg-accent/25"
          initial={false}
          animate={{ width: `${rate}%` }}
          transition={{ duration: 0.5, ease: EASE }}
        />
        <motion.div
          className="absolute inset-y-0 border-l border-accent"
          initial={false}
          animate={{ left: `${rate}%` }}
          transition={{ duration: 0.5, ease: EASE }}
        />
        {marker && (
          <motion.div
            key={marker.k}
            className="absolute inset-y-1 -ml-[3px] w-1.5 rounded-full bg-ink"
            initial={{ left: '0%' }}
            animate={{ left: reduce ? `${marker.roll}%` : ['0%', '100%', '0%', '100%', `${marker.roll}%`] }}
            transition={reduce ? { duration: 0 } : { duration: 1.4, ease: 'easeInOut', times: [0, 0.22, 0.44, 0.66, 1] }}
          />
        )}
      </div>

      <div className="mt-4 h-7 text-center">
        <Swap k={msg ? msg.k : busy ? 'busy' : 'idle'}>
          {busy ? (
            <span className="text-muted">Rolling…</span>
          ) : msg ? (
            <span className={msg.ok ? 'text-accent' : 'text-danger'}>{msg.ok ? 'Success. Next level.' : 'Missed.'}</span>
          ) : (
            <span className="text-muted">Land in the green zone to climb.</span>
          )}
        </Swap>
      </div>
      <div className="mt-5 flex justify-center">
        <Button onClick={go} disabled={busy || (msg && !msg.ok)} className="h-12 px-10 text-base">
          Try
        </Button>
      </div>
    </div>
  )
}

/* ---------- Pinpoint: click where the number sits on a blank 0–100 line ---------- */

const PIN_ROUNDS = 10
const randTarget = () => Math.floor(Math.random() * 101)

function Pinpoint({ onDone }) {
  const reduce = useReducedMotion()
  const [round, setRound] = useState(0)
  const [target, setTarget] = useState(randTarget)
  const [pick, setPick] = useState(null) // { at, off }
  const [errs, setErrs] = useState([])
  const line = useRef(null)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  const click = (e) => {
    if (pick) return
    const box = line.current.getBoundingClientRect()
    const at = Math.max(0, Math.min(100, ((e.clientX - box.left) / box.width) * 100))
    const off = Math.abs(at - target)
    const next = [...errs, off]
    setPick({ at, off })
    setErrs(next)
    timer.current = setTimeout(() => {
      if (next.length >= PIN_ROUNDS) return onDone(next)
      setRound((r) => r + 1)
      setTarget(randTarget())
      setPick(null)
    }, reduce ? 700 : 1400)
  }

  const avg = errs.length ? errs.reduce((a, b) => a + b, 0) / errs.length : null
  const tone = (off) => (off <= 3 ? 'text-accent' : off <= 10 ? 'text-ink' : 'text-danger')
  const reveal = { duration: 0.45, delay: 0.15, ease: EASE }

  return (
    <div className="mx-auto max-w-[680px]">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs text-muted">Round</div>
          <Swap k={round}>
            <div className="num text-3xl">
              {round + 1}
              <span className="text-muted">/{PIN_ROUNDS}</span>
            </div>
          </Swap>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted">Avg off</div>
          <Swap k={errs.length}>
            <div className="num text-3xl">{avg === null ? '-' : avg.toFixed(1)}</div>
          </Swap>
        </div>
      </div>

      <div className="mt-6 text-center">
        <div className="text-sm text-muted">Find</div>
        <Swap k={round}>
          <div className="num text-7xl text-accent">{target}</div>
        </Swap>
      </div>

      <div
        ref={line}
        onPointerDown={click}
        className={`relative mt-8 h-24 touch-none select-none ${pick ? '' : 'cursor-crosshair'}`}
        aria-label={`Click where ${target} is on the line`}
      >
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-line" />
        <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 bg-muted" />
        <span className="absolute right-0 top-1/2 h-6 w-0.5 -translate-y-1/2 bg-muted" />
        <span className="num absolute left-0 top-[calc(50%+18px)] -translate-x-1/2 text-sm text-muted">0</span>
        <span className="num absolute right-0 top-[calc(50%+18px)] translate-x-1/2 text-sm text-muted">100</span>
        <AnimatePresence>
          {pick && (
            <motion.div key={`r${round}`} className="pointer-events-none absolute inset-0" exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {/* Gap between your click and the real spot */}
              <motion.span
                className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-accent/40"
                initial={{ left: `${pick.at}%`, width: '0%' }}
                animate={{ left: `${Math.min(pick.at, target)}%`, width: `${Math.abs(pick.at - target)}%` }}
                transition={reveal}
              />
              {/* Your click */}
              <motion.span
                className="absolute top-1/2 -ml-[1.5px] -mt-5 h-10 w-[3px] rounded-full bg-ink"
                style={{ left: `${pick.at}%` }}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.18, ease: EASE }}
              />
              {/* Real spot slides out from your click */}
              <motion.span
                className="absolute top-1/2 -ml-2 -mt-2 size-4 rounded-full border-2 border-accent bg-surface"
                initial={{ left: `${pick.at}%`, opacity: 0 }}
                animate={{ left: `${target}%`, opacity: 1 }}
                transition={reveal}
              />
              <motion.span
                className="num absolute bottom-[calc(50%+16px)] -ml-4 w-8 text-center text-sm text-accent"
                initial={{ left: `${pick.at}%`, opacity: 0 }}
                animate={{ left: `${target}%`, opacity: 1 }}
                transition={reveal}
              >
                {target}
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-6 h-7 text-center">
        <Swap k={pick ? `r${round}` : 'idle'}>
          {pick ? (
            <span className={`num ${tone(pick.off)}`}>{pick.off < 0.5 ? 'Bullseye' : `Off by ${pick.off.toFixed(1)}`}</span>
          ) : (
            <span className="text-muted">Click the line where {target} is.</span>
          )}
        </Swap>
      </div>
    </div>
  )
}

/* ---------- Shell ---------- */

function useSpace(fn, active) {
  useEffect(() => {
    if (!active) return
    const onKey = (e) => {
      if (e.code === 'Space' && !e.repeat && !e.target.closest?.('button, input')) {
        e.preventDefault()
        fn()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fn, active])
}

export default function Casino() {
  const { report, setVariant, variant } = useGame()
  const mode = variant || 'slots'
  const { bank, settle, reset } = useBank()
  const [bet, setBet] = useState('5')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [round, setRound] = useState(0)
  const [deal, setDeal] = useState(0) // bumps on every fresh bankroll, replaying the hand-over animation

  const coinMode = mode === 'slots' || mode === 'roulette'
  const stake = Math.min(Number(bet), bank.balance)
  const broke = bank.balance <= 0
  const betOptions = BETS.map((b) => ({ value: b, label: b, disabled: Number(b) > bank.balance }))

  // Can't afford the chosen bet any more: drop to the biggest one that fits.
  useEffect(() => {
    if (busy || Number(bet) <= bank.balance) return
    const fit = [...BETS].reverse().find((b) => Number(b) <= bank.balance)
    if (fit) setBet(fit)
  }, [bank.balance, bet, busy])

  const cashOut = useCallback(() => {
    const r = report(bank.peak)
    setResult({ kind: 'bank', ...bank, isNew: r.isNew })
  }, [report, bank])

  // Broke ends the run once the last spin has settled.
  useEffect(() => {
    if (broke && !busy && !result) cashOut()
  }, [broke, busy, result, cashOut])

  const levelFail = useCallback(
    (cleared) => {
      const r = report(cleared)
      setResult({ kind: 'levels', cleared, isNew: r.isNew })
    },
    [report],
  )

  const pinDone = useCallback(
    (errs) => {
      const avg = Math.round((errs.reduce((a, b) => a + b, 0) / errs.length) * 10) / 10
      const r = report(avg)
      setResult({ kind: 'pinpoint', avg, best: Math.min(...errs), worst: Math.max(...errs), isNew: r.isNew })
    },
    [report],
  )

  const again = useCallback(() => {
    reset()
    setResult(null)
    setBusy(false)
    setRound((n) => n + 1)
    setDeal((n) => n + 1)
  }, [reset])

  // Switching mode starts a fresh bankroll; the inner cross-fade handles the swap.
  const switchMode = (m) => {
    if (busy) return
    setVariant(m)
    reset()
    setDeal((n) => n + 1)
  }

  return (
    <Swap k={result ? 'done' : `play-${round}`}>
      {result ? (
        result.kind === 'pinpoint' ? (
          <Result
            title="Casino, pinpoint"
            isNew={result.isNew}
            onAgain={again}
            stats={[
              { label: 'Average off', value: result.avg.toFixed(1) },
              { label: 'Closest', value: result.best.toFixed(1) },
              { label: 'Farthest', value: result.worst.toFixed(1) },
            ]}
          />
        ) : result.kind === 'levels' ? (
          <Result
            title="Casino, levels"
            isNew={result.isNew}
            onAgain={again}
            stats={[
              { label: 'Levels cleared', value: result.cleared },
              { label: 'Missed at', value: `${rateOf(result.cleared + 1)}%` },
            ]}
          />
        ) : (
          <Result
            title={`Casino, ${mode}`}
            isNew={result.isNew}
            onAgain={again}
            stats={[
              { label: 'Peak credits', value: result.peak.toLocaleString() },
              { label: 'Final', value: result.balance.toLocaleString() },
              { label: 'Spins', value: result.spins },
              { label: 'Biggest win', value: `+${result.biggest.toLocaleString()}` },
            ]}
          >
            {result.balance <= 0 && <p className="mt-4 text-xs text-muted">Out of credits.</p>}
          </Result>
        )
      ) : (
        <div className="mx-auto max-w-[720px]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Segmented label="Mode" options={MODES} value={mode} onChange={switchMode} />
            {coinMode && (
              <div key={deal} className="relative text-right">
                <div className="text-xs text-muted">Credits</div>
                <div className="num text-3xl text-accent">
                  <Coins value={bank.balance} start={0} />
                </div>
                <Deal amount={START} />
              </div>
            )}
          </div>

          {coinMode && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-3">
                <span className="text-muted">Bet</span>
                <div className={`transition-opacity duration-200 ${busy ? 'pointer-events-none opacity-50' : ''}`}>
                  <Segmented label="Bet" options={betOptions} value={bet} onChange={setBet} />
                </div>
                {mode === 'slots' && (
                  <Swap k={boostFor(stake).min}>
                    <span className="num text-xs text-muted">
                      Big wins ×{boostFor(stake).big} · {boostFor(stake).rtp}% return
                    </span>
                  </Swap>
                )}
              </div>
              <Button variant="ghost" onClick={cashOut} disabled={busy || bank.spins === 0}>
                Cash out
              </Button>
            </div>
          )}

          <div className="mt-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8, pointerEvents: 'none' }}
                transition={{ duration: 0.2, ease: EASE }}
              >
                {mode === 'slots' && <Slots bet={stake} busy={busy} setBusy={setBusy} settle={settle} />}
                {mode === 'roulette' && <Roulette bet={stake} busy={busy} setBusy={setBusy} settle={settle} />}
                {mode === 'levels' && <Levels onFail={levelFail} />}
                {mode === 'pinpoint' && <Pinpoint onDone={pinDone} />}
              </motion.div>
            </AnimatePresence>
          </div>

          <p className="mt-8 flex flex-wrap items-center justify-center gap-2 text-sm text-muted">
            {mode === 'pinpoint' ? (
              '10 rounds. Lower average wins.'
            ) : (
              <>
                <Kbd>Space</Kbd> {mode === 'levels' ? 'to try.' : 'to spin.'} Play money only.
              </>
            )}
          </p>
        </div>
      )}
    </Swap>
  )
}
