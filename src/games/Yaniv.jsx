import { useCallback, useEffect, useState } from 'react'
import { LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { useGame } from '../components/GameFrame'
import { shuffle } from '../lib/util'
import { Button, EASE, Result, Swap, useEnter } from '../components/ui'
import { CARD_W, CardSlot, PlayingCard, overlap, rowWidth } from './cards'
import { YANIV_MAX, cardName, handPoints, newDeck, takeable, validDrop, yanivMove, yanivPoints, yanivShouldCall } from './cardLogic'

// Yaniv vs the PC. Drop one card, a set or a run, then draw from the deck or take an end card of the last drop.
// At 7 points or less you may call Yaniv: the lower hand wins, a tie goes against the caller (Asaf).
// Score = rounds won in a row; one loss ends the run.

const HAND = 5
const sorted = (hand) => [...hand].sort((a, b) => yanivPoints(a) - yanivPoints(b) || a.r - b.r || a.id.localeCompare(b.id))
const MOVE = { layout: { duration: 0.35, ease: EASE } }

function deal() {
  const deck = newDeck(2)
  const me = deck.splice(0, HAND)
  const pc = deck.splice(0, HAND)
  return { deck, under: [], last: [deck.pop()], me, pc, turn: 'me', sel: [], show: null, step: 0 }
}

// `take` = a card of the last drop, or null for the deck (refilled from the old drops when empty).
function move(g, who, drop, take) {
  let deck = g.deck
  let under = [...g.under, ...g.last.filter((c) => c !== take)]
  let card = take
  if (!card) {
    if (!deck.length) {
      deck = shuffle(under)
      under = []
    }
    card = deck.at(-1)
    deck = deck.slice(0, -1)
  }
  const hand = [...g[who].filter((c) => !drop.includes(c)), card]
  return { ...g, deck, under, last: drop, [who]: hand, sel: [], turn: who === 'me' ? 'pc' : 'me', step: g.step + 1 }
}

function showdown(g, caller) {
  const me = handPoints(g.me)
  const pc = handPoints(g.pc)
  const other = caller === 'me' ? 'pc' : 'me'
  const winner = (caller === 'me' ? me < pc : pc < me) ? caller : other
  return { ...g, turn: 'over', sel: [], show: { caller, me, pc, winner }, step: g.step + 1 }
}

export default function Yaniv() {
  const { report, ended } = useGame()
  const reduce = useReducedMotion()
  const [g, setG] = useState(deal)
  const [wins, setWins] = useState(0)
  const [round, setRound] = useState(0)
  const [run, setRun] = useState(0)
  const [result, setResult] = useState(null)

  const mine = g.turn === 'me'
  const points = handPoints(g.me)
  const picked = g.me.filter((c) => g.sel.includes(c.id))
  const drop = mine ? validDrop(picked) : null
  const ends = takeable(g.last)
  const canCall = mine && points <= YANIV_MAX

  const toggle = (c) => mine && setG({ ...g, sel: g.sel.includes(c.id) ? g.sel.filter((id) => id !== c.id) : [...g.sel, c.id] })
  const take = (card) => drop && setG(move(g, 'me', drop, card))

  const call = () => {
    if (!canCall) return
    const next = showdown(g, 'me')
    if (next.show.winner === 'me') setWins(wins + 1)
    setG(next)
  }

  useEffect(() => {
    if (g.turn !== 'pc') return
    const id = setTimeout(
      () => {
        if (yanivShouldCall(g.pc)) {
          const next = showdown(g, 'pc')
          if (next.show.winner === 'me') setWins((n) => n + 1)
          return setG(next)
        }
        const mv = yanivMove(g.pc, g.last)
        setG(move(g, 'pc', mv.drop, mv.take))
      },
      reduce ? 400 : 1100,
    )
    return () => clearTimeout(id)
  }, [g, reduce])

  // Lost the showdown: the run ends.
  const lost = g.show?.winner === 'pc'
  useEffect(() => {
    if (!lost || result) return
    const id = setTimeout(
      () => {
        // No rounds won = no score to save.
        const isNew = wins ? report(wins).isNew : (ended(), false)
        setResult({ wins, me: g.show.me, pc: g.show.pc, isNew })
      },
      reduce ? 1200 : 2200,
    )
    return () => clearTimeout(id)
  }, [lost, g.show, wins, report, ended, result, reduce])

  const nextRound = useCallback(() => {
    setG(deal())
    setRound((n) => n + 1)
  }, [])
  const won = g.show?.winner === 'me'
  useEnter(nextRound, won && !result)

  const again = useCallback(() => {
    setG(deal())
    setWins(0)
    setResult(null)
    setRound(0)
    setRun((n) => n + 1)
  }, [])

  const deckTop = g.deck.at(-1)
  const lit = 'shadow-[0_0_0_2px_var(--accent)]'

  let say = <span className="text-muted">Pick cards to drop.</span>
  if (g.show) {
    const { caller, me, pc } = g.show
    if (caller === 'me') say = won ? <span className="text-accent">Yaniv! {me} vs {pc}. You win.</span> : <span className="text-danger">Asaf! PC has {pc}. You lose.</span>
    else say = won ? <span className="text-accent">PC called with {pc}, you have {me}. You win.</span> : <span className="text-danger">PC calls Yaniv: {pc} vs {me}.</span>
  } else if (g.turn === 'pc') say = <span className="text-muted">PC plays…</span>
  else if (drop) say = <span className="text-ink">Now tap the deck or a lit card.</span>
  else if (picked.length) say = <span className="text-ink">Not a set or a run.</span>
  else if (canCall) say = <span className="text-ink">{points} points. Call Yaniv, or keep playing.</span>

  return (
    <Swap fit k={result ? 'done' : `run-${run}`}>
      {result ? (
        <Result
          title="Yaniv"
          isNew={result.isNew}
          onAgain={again}
          stats={[
            { label: 'Rounds won in a row', value: result.wins },
            { label: 'Your hand', value: `${result.me} pts` },
            { label: 'PC hand', value: `${result.pc} pts` },
          ]}
        />
      ) : (
        <div className="mx-auto max-w-[620px]">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs text-muted">Wins</div>
              <Swap k={wins}>
                <div className="num min-w-[2ch] text-5xl text-accent">{wins}</div>
              </Swap>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted">Your points</div>
              <Swap k={points}>
                <div className={`num min-w-[2ch] text-3xl ${points <= YANIV_MAX ? 'text-accent' : 'text-ink'}`}>{points}</div>
              </Swap>
            </div>
          </div>

          <Swap k={round}>
            <LayoutGroup id={`yaniv-${run}-${round}`}>
              <div className="mt-6 flex h-14 justify-center [container-type:inline-size]" role="group" aria-label={g.show ? `PC hand, ${g.show.pc} points` : 'PC hand'}>
                {g.pc.map((c, i) => (
                  <motion.div key={c.id} layoutId={c.id} transition={MOVE} style={overlap(i, g.pc.length, '40px')}>
                    <PlayingCard card={c} size="sm" up={!!g.show} />
                  </motion.div>
                ))}
              </div>

              <div className={`mt-6 flex items-center justify-center gap-4 sm:gap-6 ${CARD_W}`}>
                <button
                  type="button"
                  onClick={() => take(null)}
                  disabled={!drop}
                  aria-label="Draw from the deck"
                  className={`relative shrink-0 rounded-lg transition-[box-shadow] duration-200 ${drop ? lit : ''}`}
                >
                  {deckTop ? (
                    <motion.div key={deckTop.id} layoutId={deckTop.id} transition={MOVE}>
                      <PlayingCard up={false} />
                    </motion.div>
                  ) : (
                    <CardSlot />
                  )}
                  <span className="num absolute inset-x-0 -bottom-5 text-center text-xs text-muted">{g.deck.length}</span>
                </button>
                {/* Last drop: only its first and last card can be taken. */}
                <div className="flex min-w-0 [container-type:inline-size]" style={rowWidth(g.last.length)}>
                  {g.last.map((c, i) => {
                    const open = !!drop && ends.includes(c)
                    return (
                      <motion.button
                        key={c.id}
                        layoutId={c.id}
                        transition={MOVE}
                        type="button"
                        onClick={() => take(c)}
                        disabled={!open}
                        aria-label={`Take ${cardName(c)}`}
                        style={overlap(i, g.last.length)}
                        className={`rounded-lg transition-[box-shadow] duration-200 ${open ? lit : ''}`}
                      >
                        <PlayingCard card={c} />
                      </motion.button>
                    )
                  })}
                </div>
              </div>

              <div className="mt-9 h-7 text-center">
                <Swap k={`${g.step}-${drop ? 'ok' : picked.length ? 'bad' : 'none'}`}>{say}</Swap>
              </div>

              <div className="mt-5 flex min-h-[74px] justify-center gap-1.5 sm:min-h-[92px] sm:gap-2">
                {sorted(g.me).map((c) => {
                  const on = g.sel.includes(c.id)
                  return (
                    <motion.button
                      key={c.id}
                      layoutId={c.id}
                      transition={MOVE}
                      type="button"
                      onClick={() => toggle(c)}
                      disabled={!mine}
                      aria-pressed={on}
                      aria-label={cardName(c)}
                      className={`rounded-lg transition-[translate,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${on ? `-translate-y-2.5 ${lit}` : mine ? 'hover:-translate-y-1' : ''}`}
                    >
                      <PlayingCard card={c} />
                    </motion.button>
                  )
                })}
              </div>
            </LayoutGroup>
          </Swap>

          <div className="mt-6 flex h-12 justify-center">
            <Swap k={won ? 'next' : 'call'} className="flex items-center gap-3">
              {won ? (
                <>
                  <Button onClick={nextRound} className="h-12 px-8 text-base">
                    Next round
                  </Button>
                  <span className="text-xs text-muted">or press Enter</span>
                </>
              ) : (
                <Button onClick={call} disabled={!canCall} className="h-12 px-8 text-base">
                  Yaniv!
                </Button>
              )}
            </Swap>
          </div>

          <p className="mx-auto mt-8 max-w-[52ch] text-center text-sm text-muted">
            Drop 1 card, a set (same rank) or a run (3+ in a row, one suit), then draw. At {YANIV_MAX} or less call Yaniv: the lower hand wins, a tie
            beats the caller. A = 1, J Q K = 10, Joker = 0.
          </p>
        </div>
      )}
    </Swap>
  )
}
