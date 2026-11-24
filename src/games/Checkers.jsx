import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { CaretDownIcon, CheckIcon, CrownSimpleIcon, SlidersHorizontalIcon } from '@phosphor-icons/react'
import { useGame } from '../components/GameFrame'
import { getValue, setValue } from '../lib/store'
import { Button, EASE, Swap, useEnter } from '../components/ui'
import { BoardBar, FocusRing, SQ_DARK, SQ_LIGHT, useGridNav, usePc, usePcTurn } from './boardKit'
import { DEFAULT_RULES, checkersApply, checkersMoves, checkersNew } from './checkersLogic'

// Checkers vs the PC. You move first, up the board. A multi-jump is played hop by hop. Rule switches
// (checkersLogic `rules`) are saved and locked mid-game. Score = your moves when you win (fewer is better).

const RULES = [
  { key: 'force', label: 'Must jump' },
  { key: 'flying', label: 'Flying kings' },
  { key: 'back', label: 'Men jump back' },
  { key: 'most', label: 'Take most', needs: 'force' },
]
const loadRules = () => {
  const saved = getValue('checkersRules', {})
  return Object.fromEntries(Object.keys(DEFAULT_RULES).map((k) => [k, typeof saved?.[k] === 'boolean' ? saved[k] : DEFAULT_RULES[k]]))
}

const QUIET_MAX = 80 // plies without a capture = draw (40 moves each)
const HOP = 320 // ms per hop of a PC multi-jump

function fresh() {
  const b = checkersNew()
  let id = 0
  return { b, ids: b.map((p) => (p ? ++id : 0)), turn: 1, quiet: 0, moves: 0, over: null, last: null }
}

// Position after `side` plays `m` (piece ids follow their pieces, so they slide instead of jumping).
function commit(g, m, side, rules) {
  const b = checkersApply(g.b, m)
  const ids = [...g.ids]
  const id = ids[m.from]
  ids[m.from] = 0
  for (const sq of m.caps) ids[sq] = 0
  ids[m.to] = id
  const quiet = m.caps.length ? 0 : g.quiet + 1
  let over = null
  if (!checkersMoves(b, -side, rules).length) over = side === 1 ? 'win' : 'lose'
  else if (quiet >= QUIET_MAX) over = 'draw'
  return { b, ids, turn: -side, quiet, moves: g.moves + (side === 1 ? 1 : 0), over, last: m }
}

const sqLabel = (i) => 'abcdefgh'[i & 7] + (8 - (i >> 3))
const PIECE = { 1: 'your man', 2: 'your king', '-1': 'PC man', '-2': 'PC king' }

// Rules button + dropdown with the rule switches. Closes on Esc or a click outside. Locked mid-game.
function RulesMenu({ rules, locked, onToggle }) {
  const [open, setOpen] = useState(false)
  const box = useRef(null)
  const btn = useRef(null)
  const isOn = (r) => rules[r.key] && !(r.needs && !rules[r.needs])
  const count = RULES.filter(isOn).length

  useEffect(() => {
    if (!open) return
    const onDown = (e) => !box.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      btn.current?.focus()
    }
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={box} className="relative">
      <Button ref={btn} variant="ghost" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="checkers-rules" aria-label={`Rules, ${count} on`} className="gap-2 px-3">
        <span className="relative">
          <SlidersHorizontalIcon size={16} />
          {/* Rules on: a small count on the icon corner (keeps the button one width, so the bar never wraps). */}
          <span
            className={`num absolute -right-1.5 -top-2 grid size-3.5 place-items-center rounded-full bg-accent text-[9px] leading-none text-accent-ink transition-[opacity,scale] duration-200 ${count ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}
          >
            {count || ''}
          </span>
        </span>
        Rules
        <CaretDownIcon size={12} weight="bold" className={`text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </Button>
      <AnimatePresence>
        {open && (
          <motion.div
            id="checkers-rules"
            role="group"
            aria-label="Rules"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1, pointerEvents: 'auto' }}
            exit={{ opacity: 0, y: -6, scale: 0.97, pointerEvents: 'none' }}
            transition={{ duration: 0.16, ease: EASE }}
            style={{ transformOrigin: 'top center' }}
            className="absolute left-1/2 top-full z-30 mt-2 w-56 -translate-x-1/2 rounded-xl border border-line bg-surface p-1.5 shadow-[0_14px_36px_-10px_rgb(0_0_0/0.4)]"
          >
            {RULES.map((r) => {
              const on = isOn(r)
              return (
                <button
                  key={r.key}
                  type="button"
                  aria-pressed={on}
                  disabled={locked || (r.needs && !rules[r.needs])}
                  onClick={() => onToggle(r.key)}
                  className={`flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm transition-[color,background-color,opacity] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-surface-2 disabled:opacity-35 ${on ? 'text-ink' : 'text-muted hover:text-ink'}`}
                >
                  <span className={`grid size-4 shrink-0 place-items-center rounded-[5px] border transition-colors duration-200 ${on ? 'border-accent bg-accent text-accent-ink' : 'border-line'}`}>
                    <CheckIcon size={11} weight="bold" className={`transition-opacity duration-200 ${on ? 'opacity-100' : 'opacity-0'}`} />
                  </span>
                  {r.label}
                </button>
              )
            })}
            {locked && <p className="px-2.5 pb-1 pt-1.5 text-xs text-muted">Locked until this game ends.</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Disc({ p }) {
  return (
    <span
      className={`grid size-full place-items-center rounded-full shadow-[inset_0_-3px_0_rgb(0_0_0/0.22),inset_0_0_0_2px_rgb(0_0_0/0.12)] ${p > 0 ? 'bg-accent text-accent-ink' : 'bg-danger text-[#fff7f5]'}`}
    >
      {(p === 2 || p === -2) && (
        // Crown pops in when a man reaches the far row.
        <motion.span className="block size-1/2" initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 15, delay: 0.2 }}>
          <CrownSimpleIcon weight="fill" className="size-full" />
        </motion.span>
      )}
    </span>
  )
}

export default function Checkers() {
  const { report, ended, variant } = useGame()
  const reduce = useReducedMotion()
  const think = usePc('checkers')
  const nav = useGridNav(8, 64, 40)
  const [g, setG] = useState(fresh)
  const [rules, setRules] = useState(loadRules)
  const [sel, setSel] = useState(null) // { from, prefix: squares hopped so far }
  const [walk, setWalk] = useState(null) // PC multi-jump being shown: { move, k: hops shown }
  const [game, setGame] = useState(0)
  const [isNew, setIsNew] = useState(false)

  const mine = g.turn === 1 && !g.over && !walk
  const locked = g.moves > 0 && !g.over
  const legal = useMemo(() => (g.turn === 1 && !g.over ? checkersMoves(g.b, 1, rules) : []), [g, rules])
  const movable = useMemo(() => new Set(legal.map((m) => m.from)), [legal])
  const mustJump = rules.force && legal.length > 0 && legal[0].caps.length > 0
  const cands = sel ? legal.filter((m) => m.from === sel.from && sel.prefix.every((sq, i) => m.path[i] === sq)) : []
  const targets = new Set(cands.map((m) => m.path[sel.prefix.length]).filter((sq) => sq !== undefined))
  // Mid-chain with jumps optional: the hops so far are a full move, so the turn may end here.
  const stop = sel?.prefix.length ? cands.find((m) => m.path.length === sel.prefix.length) : null

  const finish = (next) => {
    if (next.over === 'win') setIsNew(report(next.moves).isNew)
    else if (next.over) ended()
    setG(next)
  }

  const play = (m) => {
    setSel(null)
    finish(commit(g, m, 1, rules))
  }

  const click = (sq) => {
    if (!mine) return
    if (sel && targets.has(sq)) {
      const prefix = [...sel.prefix, sq]
      const at = cands.filter((m) => m.path[prefix.length - 1] === sq)
      const done = at.find((m) => m.path.length === prefix.length)
      if (done && !at.some((m) => m.path.length > prefix.length)) return play(done)
      return setSel({ from: sel.from, prefix }) // more hops to take (or, when optional, to choose)
    }
    if (stop && sq === sel.prefix.at(-1)) return play(stop) // click the jumping piece = end turn
    setSel(movable.has(sq) ? { from: sq, prefix: [] } : null)
  }

  const toggle = (key) => {
    if (locked) return
    const next = { ...rules, [key]: !rules[key] }
    setRules(next)
    setValue('checkersRules', next)
    setSel(null)
  }

  const pcState = useMemo(() => ({ b: g.b, rules }), [g.b, rules])
  usePcTurn(g.turn === -1 && !g.over && !walk, think, pcState, variant, (move) => {
    if (!move) return
    if (move.path.length > 1 && !reduce) setWalk({ move, k: 1 })
    else finish(commit(g, move, -1, rules))
  })

  // PC multi-jump: one hop at a time, the last hop lands with the move itself.
  useEffect(() => {
    if (!walk) return
    const id = setTimeout(() => {
      if (walk.k + 1 < walk.move.path.length) return setWalk({ move: walk.move, k: walk.k + 1 })
      setWalk(null)
      finish(commit(g, walk.move, -1, rules))
    }, HOP)
    return () => clearTimeout(id)
  }, [walk]) // eslint-disable-line react-hooks/exhaustive-deps

  const newGame = useCallback(() => {
    setG(fresh())
    setSel(null)
    setWalk(null)
    setIsNew(false)
    setGame((n) => n + 1)
  }, [])
  useEnter(newGame, !!g.over)

  // Esc drops the selection.
  useEffect(() => {
    if (!sel) return
    const onKey = (e) => e.key === 'Escape' && setSel(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sel])

  // A jump in progress: the piece sits on its last hop, taken pieces fade until the move lands.
  let trail = null
  if (walk) trail = { from: walk.move.from, path: walk.move.path.slice(0, walk.k), caps: walk.move.caps.slice(0, walk.k) }
  else if (sel?.prefix.length) trail = { from: sel.from, path: sel.prefix, caps: cands[0]?.caps.slice(0, sel.prefix.length) ?? [] }
  const picked = trail ? trail.path.at(-1) : (sel?.from ?? -1)
  const pieces = []
  g.b.forEach((p, sq) => {
    if (p) pieces.push({ id: g.ids[sq], p, sq: trail && sq === trail.from ? trail.path.at(-1) : sq, faded: !!trail && trail.caps.includes(sq) })
  })
  // Fixed DOM order (by id): a node React re-inserts loses its CSS transition, so the slide would be skipped.
  pieces.sort((x, y) => x.id - y.id)
  const moving = trail ? trail.path.at(-1) : (g.last?.to ?? -1) // drawn above the piece it jumps

  let say = <span className="text-muted">{mustJump ? 'You must jump.' : 'Your move.'}</span>
  if (g.over === 'win') {
    say = (
      <span className="text-accent">
        You win in {g.moves} moves.{isNew && ' New best.'}
      </span>
    )
  } else if (g.over === 'lose') say = <span className="text-danger">PC wins.</span>
  else if (g.over) say = <span className="text-ink">Draw: 40 moves without a capture.</span>
  else if (!mine) say = <span className="text-muted">PC is thinking…</span>
  else if (stop) {
    say = (
      <span className="inline-flex items-center gap-3 text-ink">
        Jump again?
        <Button variant="ghost" onClick={() => play(stop)} className="h-8 px-3">
          End turn
        </Button>
      </span>
    )
  } else if (sel?.prefix.length) say = <span className="text-ink">Keep jumping.</span>

  return (
    <div className="mx-auto max-w-[520px]">
      <BoardBar
        locked={locked}
        moves={g.moves}
        onNew={newGame}
        extra={<RulesMenu rules={rules} locked={locked} onToggle={toggle} />}
      />
      <Swap k={game}>
        <div className="relative grid grid-cols-8 overflow-hidden rounded-xl border border-line" onKeyDown={nav.onKeyDown}>
          {g.b.map((p, i) => {
            const dark = ((i >> 3) + (i & 7)) % 2 === 1
            const last = g.last && (g.last.from === i || g.last.to === i)
            return (
              <button
                key={i}
                type="button"
                {...nav.cell(i)}
                onClick={() => click(i)}
                aria-label={`${sqLabel(i)}${p ? `, ${PIECE[p]}` : ''}${targets.has(i) ? ', move here' : ''}`}
                className={`relative aspect-square ${dark ? SQ_DARK : SQ_LIGHT} ${mine && (targets.has(i) || movable.has(i)) ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <span className={`absolute inset-0 bg-accent/25 transition-opacity duration-300 ${last ? 'opacity-100' : 'opacity-0'}`} />
                <span
                  className={`absolute inset-0 shadow-[inset_0_0_0_3px_var(--accent)] transition-opacity duration-200 ${
                    picked === i ? 'opacity-100' : mine && mustJump && !sel && movable.has(i) ? 'opacity-45' : 'opacity-0'
                  }`}
                />
                <span className={`absolute inset-[36%] rounded-full bg-accent transition-opacity duration-200 ${targets.has(i) ? 'opacity-80' : 'opacity-0'}`} />
              </button>
            )
          })}
          <div className="pointer-events-none absolute inset-0">
            <AnimatePresence>
              {pieces.map((pc) => (
                <div
                  key={pc.id}
                  className={`absolute left-0 top-0 h-[12.5%] w-[12.5%] p-[1.6%] transition-[translate] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${pc.sq === moving ? 'z-10' : ''}`}
                  style={{ translate: `${(pc.sq & 7) * 100}% ${(pc.sq >> 3) * 100}%` }}
                >
                  <motion.div
                    className="size-full"
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: pc.faded ? 0.3 : 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.4 }}
                    transition={{ duration: 0.25, ease: EASE }}
                  >
                    <Disc p={pc.p} />
                  </motion.div>
                </div>
              ))}
            </AnimatePresence>
          </div>
          <FocusRing at={nav.ring} />
        </div>
      </Swap>

      <div className="mt-4 flex h-9 items-center justify-center text-center">
        <Swap k={g.over ? `over-${game}` : `${game}-${mine}-${mustJump}-${stop ? 'stop' : sel?.prefix.length ? 'hop' : ''}`}>{say}</Swap>
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        Click a piece, then a square (or arrows + Enter). {rules.force ? 'Jumps are forced.' : 'Jumps are optional.'} Reach the far row for a king.{g.over && ' Enter = new game.'}
      </p>
    </div>
  )
}
