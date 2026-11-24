import { useCallback, useEffect, useRef, useState } from 'react'
import { LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { ArrowCounterClockwiseIcon, ArrowsClockwiseIcon } from '@phosphor-icons/react'
import { useGame } from '../components/GameFrame'
import { Button, EASE, Kbd, Result, Segmented, Swap } from '../components/ui'
import { fmtTime } from '../lib/util'
import { PlayingCard, SUIT_ICON, suitTint } from './cards'
import { SUITS, cardName } from './cardLogic'
import { CELLS, FOUND, applyMove, bestTarget, canFinish, canMove, canPick, drawCards, finishStep, isWon, patienceDeal, tabKeys } from './patience'

// Solitaire (Klondike, Draw 1 / Draw 3 = variant) and FreeCell. Click a card: it goes to the best legal
// spot. Drag: you pick the spot. Unlimited undo (counts as a move). Score = seconds to clear (lower is better).

const MOVE = { layout: { duration: 0.32, ease: EASE } }
const CARD_H = 140 // card height in % of the column width (5:7 card)
const DOWN = 13 // gap under a face-down column card, same unit
const UP = 31 // gap under a face-up column card (rank + pip stay readable)
const MAX_H = { klondike: 560, freecell: 600 } // tall columns squeeze their face-up gap to fit this
const DRAWS = [
  { value: '1', label: 'Draw 1' },
  { value: '3', label: 'Draw 3' },
]

// Top offsets of a column's cards (cqw) and the column's height.
function stackOf(cards, game) {
  const downs = cards.filter((c, i) => !c.up && i < cards.length - 1).length
  const ups = Math.max(0, cards.length - 1 - downs)
  const up = ups ? Math.min(UP, (MAX_H[game] - CARD_H - downs * DOWN) / ups) : UP
  const tops = []
  let y = 0
  for (const c of cards) {
    tops.push(y)
    y += c.up ? up : DOWN
  }
  return { tops, height: (tops.at(-1) ?? 0) + CARD_H }
}

const shakeEl = (el, reduce) => !reduce && el?.animate([{ translate: '0' }, { translate: '-5px 0' }, { translate: '5px 0' }, { translate: '-3px 0' }, { translate: '0' }], { duration: 260, easing: 'ease-out' })

export default function Patience({ game = 'klondike' }) {
  const { report, variant, setVariant } = useGame()
  const reduce = useReducedMotion()
  const klondike = game === 'klondike'
  const draw = klondike ? Number(variant) || 1 : 1
  const [st, setSt] = useState(() => patienceDeal(game, draw))
  const [hist, setHist] = useState([])
  const [moves, setMoves] = useState(0)
  const [t0, setT0] = useState(null)
  const [t1, setT1] = useState(null)
  const [now, setNow] = useState(0)
  const [lifted, setLifted] = useState([]) // ids of the cards last moved: drawn above the rest while they fly
  const [drag, setDrag] = useState(null) // { from, n, ids, dx, dy }
  const [result, setResult] = useState(null)
  const [round, setRound] = useState(0)
  const live = useRef(st)
  live.current = st
  const dragged = useRef(false) // a drag just ended: swallow the click that follows the pointerup

  const won = isWon(st)
  const finishing = !won && canFinish(st)

  const commit = (next, ids) => {
    setHist((h) => [...h, live.current])
    live.current = next
    setSt(next)
    setLifted(ids)
    setMoves((m) => m + 1)
    if (t0 === null) setT0(performance.now())
  }

  const fresh = useCallback(
    (d = draw) => {
      const next = patienceDeal(game, d)
      live.current = next
      setSt(next)
      setHist([])
      setMoves(0)
      setT0(null)
      setT1(null)
      setLifted([])
      setDrag(null)
      setRound((n) => n + 1)
    },
    [game, draw],
  )

  const undo = useCallback(() => {
    if (!hist.length || won || finishing) return
    const prev = hist.at(-1)
    const ids = Object.values(st.piles).flat().filter((c) => !Object.values(prev.piles).flat().some((p) => p.id === c.id && p.up === c.up && pileOf(prev, c.id) === pileOf(st, c.id)))
    live.current = prev
    setSt(prev)
    setHist(hist.slice(0, -1))
    setLifted(ids.map((c) => c.id))
    setMoves((m) => m + 1)
  }, [hist, st, won, finishing])

  // Z (or Ctrl+Z) undoes.
  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat || e.altKey || e.target.closest?.('input, textarea')) return
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo])

  // Clock: runs from the first move until the last card lands.
  useEffect(() => {
    if (t0 === null || t1 !== null) return
    const id = setInterval(() => setNow(performance.now()), 250)
    return () => clearInterval(id)
  }, [t0, t1])
  const secs = t0 === null ? 0 : Math.max(0, ((t1 ?? now) - t0) / 1000)

  // Nothing left to decide: the cards fly home one by one.
  useEffect(() => {
    if (!finishing) return
    const id = setTimeout(
      () => {
        const step = finishStep(live.current)
        if (!step) return
        live.current = step.state
        setSt(step.state)
        setLifted([live.current.piles[step.to].at(-1).id])
      },
      reduce ? 40 : 110,
    )
    return () => clearTimeout(id)
  }, [st, finishing, reduce])

  // Cleared: stop the clock, then the result once the last card has landed.
  useEffect(() => {
    if (!won || t1 !== null) return
    const end = performance.now()
    setT1(end)
    const sec = Math.max(1, Math.round((end - (t0 ?? end)) / 1000))
    const id = setTimeout(() => setResult({ sec, moves, isNew: report(sec).isNew }), reduce ? 300 : 900)
    return () => clearTimeout(id)
  }, [won]) // eslint-disable-line react-hooks/exhaustive-deps

  const again = useCallback(() => {
    setResult(null)
    fresh()
  }, [fresh])

  const changeDraw = (v) => {
    if (moves > 0 && !won) return
    setVariant(v)
    fresh(Number(v))
  }

  // Click: send the card (and the run on top of it) to its best spot, or shake.
  const tap = (e, key, index) => {
    if (dragged.current) return (dragged.current = false)
    if (won || finishing || key[0] === 'f') return // foundation cards only move by drag
    const n = st.piles[key].length - index
    const to = canPick(st, key, n) && bestTarget(st, key, n)
    if (!to) return shakeEl(e.currentTarget, reduce)
    commit(applyMove(st, key, n, to), st.piles[key].slice(-n).map((c) => c.id))
  }

  const deal = () => {
    if (won || finishing) return
    const next = drawCards(st)
    if (!next) return
    const ids = next.piles.w.length > st.piles.w.length ? next.piles.w.slice(st.piles.w.length).map((c) => c.id) : st.piles.w.map((c) => c.id)
    commit(next, ids)
  }

  // Drag: lift the run under the pointer; drop on the pile under the pointer if the move is legal.
  const down = (e, key, index) => {
    if (e.button !== 0 || won || finishing) return
    const pile = live.current.piles[key]
    const n = pile.length - index
    if (!canPick(live.current, key, n)) return
    const ids = pile.slice(-n).map((c) => c.id)
    const x0 = e.clientX
    const y0 = e.clientY
    let moving = false
    const move = (ev) => {
      const dx = ev.clientX - x0
      const dy = ev.clientY - y0
      if (!moving && Math.hypot(dx, dy) < 6) return
      moving = true
      setDrag({ from: key, n, ids, dx, dy })
    }
    const up = (ev) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (!moving) return
      dragged.current = true
      setTimeout(() => (dragged.current = false), 0) // no click came (pointer left the card): stop swallowing
      const to = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-pile]')?.dataset.pile
      const cur = live.current
      if (to && canMove(cur, key, n, to)) commit(applyMove(cur, key, n, to), ids)
      setDrag(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const cols = tabKeys(game)
  const lift = new Set(lifted)

  // One card. `top`/`left` in cqw of its pile; `key` + `index` = where it sits.
  const card = (c, key, index, { top = 0, left = 0, z = index, hit = true } = {}) => {
    const dragging = drag?.ids.includes(c.id)
    const pick = hit && c.up
    return (
      <motion.button
        key={c.id}
        layoutId={c.id}
        transition={MOVE}
        type="button"
        disabled={!pick}
        tabIndex={pick ? 0 : -1}
        aria-label={c.up ? cardName(c) : 'Face-down card'}
        onClick={(e) => tap(e, key, index)}
        onPointerDown={(e) => down(e, key, index)}
        className={`absolute left-0 w-full rounded-[9cqw] focus-visible:outline-offset-1 ${dragging ? '' : 'transition-[translate] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]'}`}
        style={{
          top: `${top}cqw`,
          left: `${left}cqw`,
          zIndex: dragging ? 50 : lift.has(c.id) ? 30 + z : z,
          translate: dragging ? `${drag.dx}px ${drag.dy}px` : undefined,
          pointerEvents: dragging || !hit ? 'none' : undefined,
          touchAction: pick ? 'none' : undefined,
        }}
      >
        <PlayingCard card={c} up={c.up} size="fluid" />
      </motion.button>
    )
  }

  // A fixed card-sized spot (stock, waste, cell, foundation).
  const slot = (key, children, ghost) => (
    <div key={key} data-pile={key} className="relative [container-type:inline-size]">
      <div className="flex aspect-[5/7] items-center justify-center rounded-[9cqw] border border-dashed border-line text-line">{ghost}</div>
      {children}
    </div>
  )

  const w = st.piles.w ?? []
  const shownWaste = w.slice(draw === 3 ? -4 : -2)
  const fan = draw === 3 ? Math.min(3, w.length) : 1

  const top = (
    <div className={`grid gap-1.5 sm:gap-2.5 ${klondike ? 'grid-cols-7' : 'grid-cols-8'}`}>
      {klondike ? (
        <>
          <div className="relative [container-type:inline-size]">
            <div className="aspect-[5/7] rounded-[9cqw] border border-dashed border-line" />
            {st.piles.s.slice(-3).map((c, i, a) => card(c, 's', st.piles.s.length - a.length + i, { hit: false, z: i }))}
            {/* The real control sits above the stock cards (they are not buttons of their own). */}
            <button
              type="button"
              onClick={deal}
              aria-label={st.piles.s.length ? `Draw. ${st.piles.s.length} left` : 'Turn the waste over'}
              disabled={!st.piles.s.length && !w.length}
              className="absolute inset-0 z-10 grid place-items-center rounded-[9cqw] text-muted transition-colors duration-200 enabled:hover:text-ink"
            >
              {!st.piles.s.length && w.length > 0 && <ArrowsClockwiseIcon className="size-[36cqw]" />}
            </button>
            {st.piles.s.length > 0 && <span className="num pointer-events-none absolute inset-x-0 -bottom-5 text-center text-[11px] text-muted">{st.piles.s.length}</span>}
          </div>
          {slot(
            'w',
            shownWaste.map((c, i) => {
              const pos = Math.max(0, fan - (shownWaste.length - i))
              return card(c, 'w', w.length - shownWaste.length + i, { left: pos * 30, z: i, hit: i === shownWaste.length - 1 })
            }),
          )}
          <div />
        </>
      ) : (
        CELLS.map((k) => slot(k, st.piles[k].map((c, i) => card(c, k, i))))
      )}
      {FOUND.map((f, i) => {
        const Icon = SUIT_ICON[SUITS[i]]
        const pile = st.piles[f]
        const shown = pile.slice(-2)
        return slot(
          f,
          shown.map((c, j) => card(c, f, pile.length - shown.length + j, { z: j })),
          <Icon weight="fill" className={`size-[38cqw] opacity-40 ${suitTint(SUITS[i])}`} />,
        )
      })}
    </div>
  )

  const board = (
    <div className={`mt-7 grid gap-1.5 sm:gap-2.5 ${klondike ? 'grid-cols-7' : 'grid-cols-8'}`}>
      {cols.map((k) => {
        const pile = st.piles[k]
        const { tops, height } = stackOf(pile, game)
        return (
          <div key={k} data-pile={k} className="relative [container-type:inline-size]">
            <div style={{ height: `${height}cqw` }} />
            <div className="absolute inset-x-0 top-0 aspect-[5/7] rounded-[9cqw] border border-dashed border-line" />
            {pile.map((c, i) => card(c, k, i, { top: tops[i] }))}
          </div>
        )
      })}
    </div>
  )

  return (
    <Swap fit k={result ? 'done' : `deal-${round}`}>
      {result ? (
        <Result
          title={klondike ? `Solitaire · Draw ${draw}` : 'FreeCell'}
          isNew={result.isNew}
          onAgain={again}
          stats={[
            { label: 'Time', value: fmtTime(result.sec) },
            { label: 'Moves', value: result.moves },
          ]}
        />
      ) : (
        <div className="mx-auto max-w-[640px] select-none">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            {klondike ? (
              <div className={`transition-opacity duration-200 ${moves > 0 && !won ? 'pointer-events-none opacity-50' : ''}`}>
                <Segmented label="Draw" options={DRAWS} value={String(draw)} onChange={changeDraw} />
              </div>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted">
                Time <span className="num ml-1 inline-block min-w-[4ch] text-ink">{fmtTime(secs)}</span>
              </span>
              <span className="text-muted">
                Moves <span className="num ml-1 inline-block min-w-[2ch] text-ink">{moves}</span>
              </span>
            </div>
          </div>

          <LayoutGroup id={`${game}-${round}`}>
            {top}
            {board}
          </LayoutGroup>

          <div className="mt-6 flex justify-center gap-2">
            <Button variant="ghost" onClick={undo} disabled={!hist.length || won || finishing}>
              <ArrowCounterClockwiseIcon size={16} weight="bold" /> Undo
            </Button>
            <Button variant="ghost" onClick={() => fresh()}>
              New deal
            </Button>
          </div>

          <p className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm text-muted">
            Click a card to move it, or drag it. <Kbd>Z</Kbd> undo.
          </p>
        </div>
      )}
    </Swap>
  )
}

const pileOf = (st, id) => Object.keys(st.piles).find((k) => st.piles[k].some((c) => c.id === id))

export const SolitaireGame = () => <Patience game="klondike" />
export const FreeCellGame = () => <Patience game="freecell" />
