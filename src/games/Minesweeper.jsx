import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { BombIcon, FlagIcon, ArrowClockwiseIcon } from '@phosphor-icons/react'
import { useGame } from '../components/GameFrame'
import { Button, EASE, Segmented, useEnter } from '../components/ui'

const LEVELS = {
  easy: { rows: 9, cols: 9, mines: 10 },
  medium: { rows: 16, cols: 16, mines: 40 },
  hard: { rows: 16, cols: 30, mines: 99 },
}

const empty = ({ rows, cols }) => Array.from({ length: rows * cols }, () => ({ mine: false, n: 0, open: false, flag: false }))

function neighbors(i, { rows, cols }) {
  const r = Math.floor(i / cols)
  const c = i % cols
  const out = []
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue
      const rr = r + dr
      const cc = c + dc
      if (rr >= 0 && cc >= 0 && rr < rows && cc < cols) out.push(rr * cols + cc)
    }
  return out
}

// Mines are placed after the first click, never on or around it.
function plant(board, first, cfg) {
  const safe = new Set([first, ...neighbors(first, cfg)])
  const spots = board.map((_, i) => i).filter((i) => !safe.has(i))
  for (let k = 0; k < cfg.mines; k++) {
    const j = k + Math.floor(Math.random() * (spots.length - k))
    ;[spots[k], spots[j]] = [spots[j], spots[k]]
    board[spots[k]].mine = true
  }
  board.forEach((cell, i) => (cell.n = neighbors(i, cfg).filter((j) => board[j].mine).length))
}

// Cell content (number, mine) fades and scales in on mount, after the cell's ripple delay.
const APPEAR =
  '[grid-area:1/1] transition-[scale,opacity] duration-200 delay-(--d) ease-out starting:scale-50 starting:opacity-0 motion-reduce:transition-none'

// Reveal ripple: delay (ms) grows with distance from where the click landed.
const ripple = (i, from, { cols }, step, max) =>
  from < 0 ? 0 : Math.min(max, Math.round(Math.hypot(Math.floor(i / cols) - Math.floor(from / cols), (i % cols) - (from % cols)) * step))

function flood(board, start, cfg) {
  const stack = [start]
  while (stack.length) {
    const i = stack.pop()
    const cell = board[i]
    if (cell.open || cell.flag) continue
    cell.open = true
    if (!cell.n && !cell.mine) neighbors(i, cfg).forEach((j) => !board[j].open && stack.push(j))
  }
}

export default function Minesweeper() {
  const { report, ended, setVariant, variant } = useGame()
  const level = variant || 'easy'
  const cfg = LEVELS[level]
  const [board, setBoard] = useState(() => empty(cfg))
  const [status, setStatus] = useState('idle') // idle | run | won | lost
  const [flagMode, setFlagMode] = useState(false)
  const [secs, setSecs] = useState(0)
  const [isNew, setIsNew] = useState(false)
  const [boom, setBoom] = useState(-1)
  const [origin, setOrigin] = useState(-1)
  const [round, setRound] = useState(0)
  const reduce = useReducedMotion()
  const t0 = useRef(0)
  const press = useRef(null)

  const reset = useCallback(() => {
    setBoard(empty(LEVELS[level]))
    setStatus('idle')
    setSecs(0)
    setIsNew(false)
    setBoom(-1)
    setOrigin(-1)
  }, [level])

  useEffect(reset, [reset])

  // "New board" also cross-fades the board (round is its key), so revealed cells don't blink out.
  const again = () => {
    setRound((r) => r + 1)
    reset()
  }

  useEffect(() => {
    if (status !== 'run') return
    const id = setInterval(() => setSecs(Math.floor((performance.now() - t0.current) / 1000)), 250)
    return () => clearInterval(id)
  }, [status])

  const settle = (b) => {
    if (b.some((c) => c.open && c.mine)) {
      b.forEach((c) => c.mine && (c.open = true))
      setStatus('lost')
      ended()
    } else if (b.every((c) => c.mine || c.open)) {
      const s = Math.max(1, Math.round((performance.now() - t0.current) / 1000))
      setSecs(s)
      setIsNew(report(s).isNew)
      setStatus('won')
    }
    setBoard(b)
  }

  const open = (i) => {
    if (status === 'won' || status === 'lost') return
    setOrigin(i)
    const b = board.map((c) => ({ ...c }))
    if (status === 'idle') {
      plant(b, i, cfg)
      t0.current = performance.now()
      setStatus('run')
    }
    const cell = b[i]
    if (cell.flag) return
    if (cell.open) {
      // Chord: open neighbors when flags match the number.
      const ns = neighbors(i, cfg)
      if (cell.n && ns.filter((j) => b[j].flag).length === cell.n) {
        ns.forEach((j) => {
          if (b[j].flag || b[j].open) return
          if (b[j].mine) {
            b[j].open = true
            setBoom(j)
          } else flood(b, j, cfg)
        })
        settle(b)
      }
      return
    }
    if (cell.mine) {
      cell.open = true
      setBoom(i)
    } else flood(b, i, cfg)
    settle(b)
  }

  const flag = (i) => {
    if (status !== 'run' || board[i].open) return
    const b = board.map((c) => ({ ...c }))
    b[i].flag = !b[i].flag
    setBoard(b)
  }

  // Enter = new board once the game is over.
  useEnter(again, status === 'won' || status === 'lost')

  const flags = board.filter((c) => c.flag).length
  const big = cfg.cols > 16

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Segmented label="Difficulty" options={Object.keys(LEVELS)} value={level} onChange={setVariant} />
        <div className="flex items-center gap-5">
          <span className="num flex items-center gap-1.5 text-ink">
            <FlagIcon size={16} weight="fill" className="text-accent" />
            {cfg.mines - flags}
          </span>
          <span className="num w-14 text-right text-2xl text-accent">{secs}s</span>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button variant={flagMode ? 'primary' : 'ghost'} onClick={() => setFlagMode(!flagMode)} aria-pressed={flagMode}>
          <FlagIcon size={16} weight="bold" />
          Flag mode
        </Button>
        <Button variant="ghost" onClick={again}>
          <ArrowClockwiseIcon size={16} weight="bold" />
          New board
        </Button>
        <span className="text-sm text-muted">Right-click or long-press to flag.</span>
      </div>

      <div className="relative mt-6 overflow-x-auto pb-2">
        {/* New board/difficulty: the old board fades out on top, click-through; the new one is live at once. */}
        <AnimatePresence mode="popLayout">
          <motion.div
            key={`${level}:${round}`}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98, pointerEvents: 'none' }}
            transition={{ duration: 0.18, ease: EASE }}
            className="mx-auto grid w-max gap-[3px] rounded-xl border border-line bg-surface p-2"
            style={{ gridTemplateColumns: `repeat(${cfg.cols}, ${big ? '1.75rem' : '2.1rem'})` }}
            onContextMenu={(e) => e.preventDefault()}
          >
            {board.map((c, i) => {
              const numCls = c.n >= 3 ? 'text-danger' : c.n === 2 ? 'text-ink' : 'text-accent'
              // Opened cells ripple out from the click; on a loss the mines ripple out from the blast.
              const d = !c.open ? 0 : c.mine && boom >= 0 ? ripple(i, boom, cfg, 28, 700) : ripple(i, origin, cfg, 16, 320)
              return (
                <button
                  key={i}
                  type="button"
                  style={c.open ? { '--d': `${d}ms` } : undefined}
                  aria-label={c.open ? (c.mine ? 'Mine' : `${c.n}`) : c.flag ? 'Flagged' : 'Hidden'}
                  onClick={() => {
                    if (press.current === 'long') return (press.current = null)
                    // A fresh board always opens: flags need mines, which are planted by the first open.
                    flagMode && !c.open && status === 'run' ? flag(i) : open(i)
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    flag(i)
                  }}
                  onTouchStart={() => {
                    press.current = setTimeout(() => {
                      press.current = 'long'
                      flag(i)
                    }, 450)
                  }}
                  onTouchEnd={() => typeof press.current === 'number' && clearTimeout(press.current)}
                  onTouchMove={() => typeof press.current === 'number' && clearTimeout(press.current)}
                  className={`num grid aspect-square select-none place-items-center rounded-md text-sm font-semibold transition-[background-color,box-shadow,color] duration-200 delay-(--d) motion-reduce:transition-none ${
                    c.open
                      ? c.mine
                        ? i === boom
                          ? 'bg-danger text-bg'
                          : 'bg-surface-2 text-danger'
                        : 'bg-bg/50'
                      : 'bg-line shadow-[inset_0_1px_0_color-mix(in_oklab,var(--text)_10%,transparent)] hover:bg-muted/40'
                  }`}
                >
                  {c.open &&
                    (c.mine ? (
                      <BombIcon size={16} weight="fill" className={APPEAR} />
                    ) : c.n ? (
                      <span className={`${numCls} ${APPEAR}`}>{c.n}</span>
                    ) : null)}
                  {/* Always mounted, so a flag can scale out as well as in. */}
                  <FlagIcon
                    size={14}
                    weight="fill"
                    aria-hidden="true"
                    className={`text-accent [grid-area:1/1] transition-[scale,opacity] duration-200 motion-reduce:transition-none ${
                      c.flag && !c.open ? 'ease-[cubic-bezier(0.34,1.56,0.64,1)]' : 'scale-0 opacity-0 ease-in'
                    }`}
                  />
                </button>
              )
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence initial={false}>
        {(status === 'won' || status === 'lost') && (
          <motion.div
            key="end"
            initial={{ opacity: 0, height: reduce ? 'auto' : 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: reduce ? 'auto' : 0, transition: { duration: 0.2, ease: EASE } }}
            transition={{ duration: 0.3, delay: status === 'lost' ? 0.3 : 0.1, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center justify-center gap-4 pb-1 pt-6 text-center">
              <p className={`text-xl font-semibold ${status === 'won' ? 'text-accent' : 'text-danger'}`}>
                {status === 'won' ? `Cleared in ${secs}s${isNew ? ', new best' : ''}` : 'Boom. Try again.'}
              </p>
              <Button onClick={again}>New board</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
