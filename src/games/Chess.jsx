import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useGame } from '../components/GameFrame'
import { Button, EASE, Swap, useEnter } from '../components/ui'
import { BoardBar, FocusRing, SQ_DARK, SQ_LIGHT, useGridNav, usePc, usePcTurn } from './boardKit'
import { ChessPiece, PIECE_NAME } from './chessPieces'
import { BISHOP, BLACK, FLAG, KNIGHT, QUEEN, ROOK, WHITE, chessApply, chessKey, chessMoves, chessStart, chessStatus, colorOf, sqName, typeOf } from './chessLogic'

// Chess vs the PC, full rules. You play White. Score = your moves when you checkmate (fewer is better).

function fresh() {
  const s = chessStart()
  let id = 0
  return { s, ids: s.b.map((p) => (p ? ++id : 0)), keys: [chessKey(s)], moves: 0, over: null, check: false, last: null, taken: [[], []] }
}

// Position after move `m` (piece ids follow their pieces, so they slide; castling moves the rook's id too).
function commit(g, m) {
  const s = chessApply(g.s, m)
  const us = colorOf(m.piece)
  const ids = [...g.ids]
  const id = ids[m.from]
  ids[m.from] = 0
  if (m.flag === FLAG.EP) ids[m.to + (us === WHITE ? 8 : -8)] = 0
  ids[m.to] = id
  if (m.flag === FLAG.CASTLE_K) {
    ids[m.to - 1] = ids[m.to + 1]
    ids[m.to + 1] = 0
  } else if (m.flag === FLAG.CASTLE_Q) {
    ids[m.to + 1] = ids[m.to - 2]
    ids[m.to - 2] = 0
  }
  const keys = [...g.keys, chessKey(s)]
  const { over, check } = chessStatus(s, keys)
  const taken = m.cap ? g.taken.map((list, c) => (c === us ? [...list, typeOf(m.cap)].sort((x, y) => y - x) : list)) : g.taken
  return { s, ids, keys, moves: g.moves + (us === WHITE ? 1 : 0), over, check, last: m, taken }
}

const DRAW = {
  stalemate: 'Stalemate. Draw.',
  fifty: 'Draw: 50 moves without progress.',
  repeat: 'Draw: same position three times.',
  material: 'Draw: not enough pieces to mate.',
}
const PROMOTE = [QUEEN, ROOK, BISHOP, KNIGHT]

// Pieces one side has taken.
function Taken({ label, list, color }) {
  return (
    <div className="flex h-7 items-center gap-2 text-sm">
      <span className="w-7 text-muted">{label}</span>
      <span className="flex" role="img" aria-label={list.length ? `took ${list.map((t) => PIECE_NAME[t]).join(', ')}` : 'took nothing'}>
        {list.map((t, i) => (
          <motion.span key={i} className="-ml-2 block size-6 first:ml-0" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25, ease: EASE }}>
            <ChessPiece type={t} color={color} className="size-full" />
          </motion.span>
        ))}
      </span>
    </div>
  )
}

export default function Chess() {
  const { report, ended, variant } = useGame()
  const think = usePc('chess')
  const nav = useGridNav(8, 64, 52)
  const [g, setG] = useState(fresh)
  const [sel, setSel] = useState(null)
  const [promo, setPromo] = useState(null) // { from, to } waiting for a piece choice
  const [game, setGame] = useState(0)
  const [isNew, setIsNew] = useState(false)

  const { b } = g.s
  const mine = g.s.turn === WHITE && !g.over
  const won = g.over === 'mate' && g.s.turn === BLACK
  const legal = useMemo(() => (g.s.turn === WHITE && !g.over ? chessMoves(g.s) : []), [g])
  const from = useMemo(() => new Set(legal.map((m) => m.from)), [legal])
  const reach = new Map(sel === null ? [] : legal.filter((m) => m.from === sel).map((m) => [m.to, m]))

  const finish = (next) => {
    if (next.over === 'mate' && next.s.turn === BLACK) setIsNew(report(next.moves).isNew)
    else if (next.over) ended()
    setG(next)
  }

  const click = (sq) => {
    if (!mine || promo) return
    const hits = sel === null ? [] : legal.filter((m) => m.from === sel && m.to === sq)
    if (hits.length > 1) return setPromo({ from: sel, to: sq })
    if (hits.length === 1) {
      setSel(null)
      return finish(commit(g, hits[0]))
    }
    setSel(from.has(sq) ? sq : null)
  }

  const promote = (type) => {
    const m = legal.find((x) => x.from === promo.from && x.to === promo.to && x.promo === type)
    setPromo(null)
    setSel(null)
    if (m) finish(commit(g, m))
  }

  usePcTurn(g.s.turn === BLACK && !g.over, think, g.s, variant, (m) => m && finish(commit(g, m)))

  const newGame = useCallback(() => {
    setG(fresh())
    setSel(null)
    setPromo(null)
    setIsNew(false)
    setGame((n) => n + 1)
  }, [])
  useEnter(newGame, !!g.over)

  // Esc drops the selection (or closes the promotion picker).
  useEffect(() => {
    if (sel === null && !promo) return
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      setPromo(null)
      setSel(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sel, promo])

  const pieces = []
  b.forEach((p, sq) => {
    if (p) pieces.push({ id: g.ids[sq], p, sq })
  })
  // Fixed DOM order (by id): a node React re-inserts loses its CSS transition, so the slide would be skipped.
  pieces.sort((x, y) => x.id - y.id)
  const checked = g.check ? g.s.king[g.s.turn] : -1

  let say
  if (g.over === 'mate') {
    say = won ? (
      <span className="text-accent">
        Checkmate. You win in {g.moves} move{g.moves === 1 ? '' : 's'}.{isNew && ' New best.'}
      </span>
    ) : (
      <span className="text-danger">Checkmate. PC wins.</span>
    )
  } else if (g.over) say = <span className="text-ink">{DRAW[g.over]}</span>
  else if (!mine) say = <span className="text-muted">{g.check ? 'Check. PC is thinking…' : 'PC is thinking…'}</span>
  else {
    say = (
      <span className={g.check ? 'text-danger' : 'text-muted'}>
        {g.last && `PC played ${sqName(g.last.from)}–${sqName(g.last.to)}. `}
        {g.check ? 'Check.' : 'Your move.'}
      </span>
    )
  }

  return (
    <div className="mx-auto max-w-[520px]">
      <BoardBar locked={g.moves > 0 && !g.over} moves={g.moves} onNew={newGame} />
      <Taken label="PC" list={g.taken[BLACK]} color={WHITE} />
      <Swap k={game}>
        <div className="relative my-1 grid grid-cols-8 overflow-hidden rounded-xl border border-line" onKeyDown={nav.onKeyDown}>
          {b.map((p, i) => {
            const r = i >> 3
            const c = i & 7
            const dark = (r + c) % 2 === 1
            const last = g.last && (g.last.from === i || g.last.to === i)
            const target = reach.get(i)
            return (
              <button
                key={i}
                type="button"
                {...nav.cell(i)}
                onClick={() => click(i)}
                aria-label={`${sqName(i)}${p ? `, ${colorOf(p) ? 'black' : 'white'} ${PIECE_NAME[typeOf(p)]}` : ''}${target ? ', move here' : ''}`}
                className={`relative aspect-square ${dark ? SQ_DARK : SQ_LIGHT} ${mine && (target || from.has(i)) ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <span className={`absolute inset-0 bg-accent/30 transition-opacity duration-300 ${last ? 'opacity-100' : 'opacity-0'}`} />
                <span className={`absolute inset-0 bg-danger/55 transition-opacity duration-300 ${checked === i ? 'opacity-100' : 'opacity-0'}`} />
                <span className={`absolute inset-0 shadow-[inset_0_0_0_3px_var(--accent)] transition-opacity duration-200 ${sel === i ? 'opacity-100' : 'opacity-0'}`} />
                {/* Where the picked piece can go: a dot, or a ring on a capture. */}
                <span
                  className={`absolute transition-opacity duration-200 ${target ? 'opacity-80' : 'opacity-0'} ${
                    target?.cap ? 'inset-[6%] rounded-full shadow-[inset_0_0_0_4px_var(--accent)]' : 'inset-[36%] rounded-full bg-accent'
                  }`}
                />
                {c === 0 && <span aria-hidden="true" className="num absolute left-0.5 top-0 text-[9px] leading-tight text-muted sm:left-1 sm:text-[10px]">{8 - r}</span>}
                {r === 7 && <span aria-hidden="true" className="num absolute bottom-0 right-0.5 text-[9px] leading-tight text-muted sm:right-1 sm:text-[10px]">{'abcdefgh'[c]}</span>}
              </button>
            )
          })}
          <div className="pointer-events-none absolute inset-0">
            <AnimatePresence>
              {pieces.map((pc) => (
                <div
                  key={pc.id}
                  className={`absolute left-0 top-0 h-[12.5%] w-[12.5%] transition-[translate] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${pc.sq === g.last?.to ? 'z-10' : ''}`}
                  style={{ translate: `${(pc.sq & 7) * 100}% ${(pc.sq >> 3) * 100}%` }}
                >
                  <motion.div className="size-full" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.4 }} transition={{ duration: 0.25, ease: EASE }}>
                    <ChessPiece type={typeOf(pc.p)} color={colorOf(pc.p)} className="size-full" />
                  </motion.div>
                </div>
              ))}
            </AnimatePresence>
          </div>
          <FocusRing at={nav.ring} />
          <AnimatePresence>
            {promo && (
              <motion.div
                className="absolute inset-0 grid place-items-center bg-bg/70"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <div role="dialog" aria-label="Promote the pawn to" className="flex items-center gap-2 rounded-xl border border-line bg-surface p-2">
                  {PROMOTE.map((type, i) => (
                    <Button key={type} variant="ghost" onClick={() => promote(type)} autoFocus={i === 0} aria-label={PIECE_NAME[type]} className="h-14 w-14 px-0">
                      <ChessPiece type={type} color={WHITE} className="size-10" />
                    </Button>
                  ))}
                  <Button variant="ghost" onClick={() => setPromo(null)} className="h-14">
                    Back
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Swap>
      <Taken label="You" list={g.taken[WHITE]} color={BLACK} />

      <div className="mt-3 h-7 text-center">
        <Swap k={`${game}-${g.keys.length}-${g.over ?? ''}`}>{say}</Swap>
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        Click a piece, then a square (or arrows + Enter). You play White.{g.over && ' Enter = new game.'}
      </p>
    </div>
  )
}
