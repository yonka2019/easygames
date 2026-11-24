import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useGame } from '../components/GameFrame'
import { Button, EASE, Kbd, Result, Swap, useEnter } from '../components/ui'
import { CardSlot, PlayingCard } from './cards'
import { act, handName, handScore, newTable, nextStreet, options, pcMove, potSize, raiseSizes, startHand } from './pokerLogic'

// Texas hold'em, you + 3 PCs, 1000 chips each. Blinds 10/20, doubling every 10 hands (pokerLogic BLIND_EVERY).
// The run ends when you bust or hold every chip. Score = hands won.

const NAMES = ['You', 'PC 1', 'PC 2', 'PC 3']
const ME = 0
const fresh = () => startHand(newTable(NAMES))

function Dealer() {
  return <span className="grid size-4 place-items-center rounded-full bg-ink text-[9px] font-semibold text-bg" aria-label="Dealer">D</span>
}

// One card dealt onto the table (slides in), face down unless `up`.
function Dealt({ card, up, size, i = 0 }) {
  return (
    <motion.div initial={{ opacity: 0, y: -14, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.3, ease: EASE, delay: i * 0.07 }}>
      <PlayingCard card={card} up={up} size={size} />
    </motion.div>
  )
}

function Seat({ p, i, t, showCards, won }) {
  const turn = t.phase === 'act' && t.turn === i
  return (
    <div
      className={`rounded-xl border bg-surface p-2.5 transition-[opacity,border-color,box-shadow] duration-300 sm:p-3 ${turn ? 'border-accent shadow-[0_0_0_1px_var(--accent)]' : won ? 'border-accent/60' : 'border-line'} ${p.out ? 'opacity-30' : p.folded ? 'opacity-45' : ''}`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="flex items-center gap-1.5 text-sm text-ink">
          {p.name}
          {t.dealer === i && <Dealer />}
        </span>
        <span className="num text-xs text-muted">{p.chips.toLocaleString()}</span>
      </div>
      <div className="mt-2 flex h-14 justify-center gap-1">
        {p.hole.map((c, k) => (
          <Dealt key={c.id} card={c} up={showCards} size="sm" i={k} />
        ))}
      </div>
      <div className="mt-2 flex h-5 items-center justify-between text-xs">
        <Swap k={`${t.hand}-${p.last ?? (turn ? 'think' : '')}`}>
          <span className={p.last === 'Fold' ? 'text-muted' : 'text-ink'}>{p.out ? 'Out' : (p.last ?? (turn ? 'Thinking…' : ''))}</span>
        </Swap>
        <Swap k={p.bet}>
          <span className="num text-accent">{p.bet > 0 ? p.bet.toLocaleString() : ''}</span>
        </Swap>
      </div>
    </div>
  )
}

export default function Holdem() {
  const { report, ended } = useGame()
  const reduce = useReducedMotion()
  const [t, setT] = useState(fresh)
  const [wins, setWins] = useState(0)
  const [result, setResult] = useState(null)
  const [run, setRun] = useState(0)
  const live = useRef(t)

  const step = useCallback((next) => {
    if (next.phase === 'done' && live.current.phase !== 'done' && next.result.won[ME] > 0) setWins((w) => w + 1)
    live.current = next
    setT(next)
  }, [])

  const me = t.players[ME]
  const pcsLeft = t.players.filter((p, i) => i !== ME && !p.out).length
  const runOver = t.phase === 'done' && (me.out || !pcsLeft)
  const mine = t.phase === 'act' && t.turn === ME

  // The table moves on by itself: next street, PC moves.
  useEffect(() => {
    if (t.phase === 'street') {
      const id = setTimeout(() => step(nextStreet(live.current)), reduce ? 250 : 750)
      return () => clearTimeout(id)
    }
    if (t.phase === 'act' && t.turn !== ME) {
      const id = setTimeout(() => step(act(live.current, pcMove(live.current))), reduce ? 300 : 800)
      return () => clearTimeout(id)
    }
  }, [t, reduce, step])

  // You bust or hold every chip: the run ends.
  useEffect(() => {
    if (!runOver || result) return
    const id = setTimeout(
      () => {
        const isNew = wins ? report(wins).isNew : (ended(), false)
        setResult({ wins, hands: t.hand, chips: me.chips, all: !pcsLeft, isNew })
      },
      reduce ? 700 : 1800,
    )
    return () => clearTimeout(id)
  }, [runOver, result, wins, report, ended, t.hand, me.chips, pcsLeft, reduce])

  const nextHand = useCallback(() => step(startHand(live.current)), [step])
  useEnter(nextHand, t.phase === 'done' && !runOver)

  const again = useCallback(() => {
    const next = fresh()
    live.current = next
    setT(next)
    setWins(0)
    setResult(null)
    setRun((n) => n + 1)
  }, [])

  const o = mine ? options(t) : null
  const sizes = mine && o.canRaise ? raiseSizes(t) : null
  const doAct = (a) => mine && step(act(t, a))

  // F folds, C checks or calls.
  const keys = useRef(null)
  keys.current = (e) => {
    if (!mine || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
    if (e.key === 'f' || e.key === 'F') doAct({ type: 'fold' })
    if (e.key === 'c' || e.key === 'C') doAct({ type: o.check ? 'check' : 'call' })
  }
  useEffect(() => {
    const onKey = (e) => keys.current(e)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const done = t.phase === 'done'
  const shown = done && t.result.shown
  const myHand = me.hole.length && t.board.length >= 3 && !me.folded ? handName(handScore([...me.hole, ...t.board])) : null

  let say = <span className="text-muted">PC to act…</span>
  if (done) {
    const lines = t.result.won
      .map((n, i) => n > 0 && `${i === ME ? 'You win' : `${NAMES[i]} wins`} ${n.toLocaleString()}${shown && t.result.names[i] ? ` · ${t.result.names[i]}` : ''}`)
      .filter(Boolean)
    say = <span className={t.result.won[ME] > 0 ? 'text-accent' : 'text-ink'}>{lines.join(' · ')}</span>
  } else if (mine) say = <span className="text-ink">Your turn.</span>
  else if (t.phase === 'street') say = <span className="text-muted">Dealing…</span>
  else if (me.folded) say = <span className="text-muted">You folded.</span>

  const raises = sizes && [
    { label: 'Min', to: sizes.min },
    { label: '½ pot', to: sizes.half },
    { label: 'Pot', to: sizes.pot },
    { label: 'All in', to: sizes.max },
  ]

  return (
    <Swap fit k={result ? 'done' : `run-${run}`}>
      {result ? (
        <Result
          title="Hold'em"
          isNew={result.isNew}
          onAgain={again}
          stats={[
            { label: 'Hands won', value: result.wins },
            { label: 'Hands played', value: result.hands },
            { label: 'Chips', value: result.chips.toLocaleString() },
          ]}
        >
          <p className="mt-4 text-xs text-muted">{result.all ? 'You took every chip.' : 'Out of chips.'}</p>
        </Result>
      ) : (
        <div className="mx-auto max-w-[640px]">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs text-muted">Hands won</div>
              <Swap k={wins}>
                <div className="num min-w-[2ch] text-5xl text-accent">{wins}</div>
              </Swap>
            </div>
            <div className="text-right text-xs text-muted">
              <div>
                Hand <span className="num text-ink">{t.hand}</span>
              </div>
              <Swap k={t.bb}>
                <div className="mt-1">
                  Blinds <span className="num text-ink">{t.sb}/{t.bb}</span>
                </div>
              </Swap>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
            {t.players.map((p, i) => i !== ME && <Seat key={i} p={p} i={i} t={t} showCards={shown && !p.folded} won={done && t.result.won[i] > 0} />)}
          </div>

          <div className="mt-6 flex flex-col items-center">
            <div className="flex gap-1.5 sm:gap-2">
              {Array.from({ length: 5 }, (_, k) =>
                t.board[k] ? <Dealt key={t.board[k].id} card={t.board[k]} up size="md" i={k < 3 ? k : 0} /> : <CardSlot key={`slot-${k}`} />,
              )}
            </div>
            <div className="mt-3 text-sm text-muted">
              Pot{' '}
              <Swap k={potSize(t)} className="inline-block">
                <span className="num text-ink">{potSize(t).toLocaleString()}</span>
              </Swap>
            </div>
          </div>

          <div className="mt-4 flex min-h-7 items-center justify-center text-center text-sm sm:text-base">
            <Swap k={done ? `done-${t.hand}` : `${t.hand}-${t.street}-${t.turn}-${t.phase}`}>{say}</Swap>
          </div>

          <div className={`mx-auto mt-4 max-w-[360px] rounded-xl border bg-surface p-3 transition-[border-color,box-shadow,opacity] duration-300 ${mine ? 'border-accent shadow-[0_0_0_1px_var(--accent)]' : 'border-line'} ${me.folded ? 'opacity-60' : ''}`}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm text-ink">
                You {t.dealer === ME && <Dealer />}
              </span>
              <span className="num text-sm text-ink">{me.chips.toLocaleString()}</span>
            </div>
            <div className="mt-2 flex items-center justify-center gap-2">
              {me.hole.map((c, k) => (
                <Dealt key={c.id} card={c} up size="md" i={k} />
              ))}
            </div>
            <div className="mt-2 flex h-5 items-center justify-between text-xs">
              <Swap k={myHand ?? ''}>
                <span className="text-muted">{myHand ?? ''}</span>
              </Swap>
              <Swap k={me.bet}>
                <span className="num text-accent">{me.bet > 0 ? me.bet.toLocaleString() : ''}</span>
              </Swap>
            </div>
          </div>

          <div className="mt-5 flex min-h-24 justify-center">
            <Swap k={done ? 'next' : 'act'} className="flex w-full flex-col items-center gap-2">
              {done ? (
                runOver ? null : (
                  <div className="flex items-center gap-3">
                    <Button onClick={nextHand} className="h-12 px-8 text-base">
                      Next hand
                    </Button>
                    <span className="text-xs text-muted">or press Enter</span>
                  </div>
                )
              ) : (
                <>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => doAct({ type: 'fold' })} disabled={!mine} className="h-11 px-5">
                      Fold
                    </Button>
                    <Button onClick={() => doAct({ type: o?.check ? 'check' : 'call' })} disabled={!mine} className="h-11 min-w-[8.5rem] px-5">
                      {!mine ? 'Check' : o.check ? 'Check' : `Call ${o.call.toLocaleString()}`}
                    </Button>
                  </div>
                  <div className="grid w-full max-w-[360px] grid-cols-4 gap-1.5" role="group" aria-label="Raise to">
                    {(raises ?? [{ label: 'Min' }, { label: '½ pot' }, { label: 'Pot' }, { label: 'All in' }]).map((r) => (
                      <Button key={r.label} variant="ghost" onClick={() => doAct({ type: 'raise', to: r.to })} disabled={!raises} className="h-12 flex-col gap-0.5 px-1 text-xs leading-none">
                        {r.label}
                        <span className="num text-[11px] text-muted">{r.to !== undefined ? r.to.toLocaleString() : '–'}</span>
                      </Button>
                    ))}
                  </div>
                </>
              )}
            </Swap>
          </div>

          <p className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm text-muted">
            <Kbd>F</Kbd> fold <Kbd>C</Kbd> call · Raise = your total bet.
          </p>
        </div>
      )}
    </Swap>
  )
}
