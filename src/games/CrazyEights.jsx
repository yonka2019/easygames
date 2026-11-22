import { useCallback, useEffect, useState } from 'react'
import { LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { useGame } from '../components/GameFrame'
import { shuffle } from '../lib/util'
import { Button, EASE, Result, Swap, useEnter } from '../components/ui'
import { CardSlot, PlayingCard, SUIT_ICON, overlap, suitTint } from './cards'
import { SUITS, SUIT_NAME, c8Legal, c8Pick, cardName, newDeck } from './cardLogic'

// Crazy Eights vs the PC. Match the suit or rank, eights are wild (name a suit), draw one when stuck.
// First empty hand wins the round. Score = rounds won in a row; one loss ends the run.

const HAND = 7
const ORDER = { s: 0, h: 1, c: 2, d: 3 }
const sorted = (hand) => [...hand].sort((a, b) => ORDER[a.s] - ORDER[b.s] || a.r - b.r)
const MOVE = { layout: { duration: 0.35, ease: EASE } }

function deal() {
  const deck = newDeck()
  const me = deck.splice(0, HAND)
  const pc = deck.splice(0, HAND)
  const [top] = deck.splice(deck.findIndex((c) => c.r !== 8), 1) // never start on an eight
  return { deck, pile: [top], suit: top.s, me, pc, turn: 'me', drew: false, ask: null, note: null, winner: null, step: 0 }
}

// Takes the top deck card; an empty deck is refilled from the pile under its top card.
function drawOne(g) {
  let { deck, pile } = g
  if (!deck.length) {
    if (pile.length < 2) return { g, card: null }
    deck = shuffle(pile.slice(0, -1))
    pile = pile.slice(-1)
  }
  return { g: { ...g, deck: deck.slice(0, -1), pile }, card: deck.at(-1) }
}

function place(g, who, card, suit) {
  const hand = g[who].filter((c) => c !== card)
  const next = { ...g, [who]: hand, pile: [...g.pile, card], suit, drew: false, ask: null, step: g.step + 1 }
  if (!hand.length) return { ...next, turn: 'over', winner: who }
  return { ...next, turn: who === 'me' ? 'pc' : 'me', note: who === 'pc' && card.r === 8 ? 'named' : null }
}

const pass = (g, who, note) => ({ ...g, turn: who === 'me' ? 'pc' : 'me', drew: false, note, step: g.step + 1 })

export default function CrazyEights() {
  const { report, ended } = useGame()
  const reduce = useReducedMotion()
  const [g, setG] = useState(deal)
  const [wins, setWins] = useState(0)
  const [round, setRound] = useState(0)
  const [run, setRun] = useState(0)
  const [result, setResult] = useState(null)

  const top = g.pile.at(-1)
  const mine = g.turn === 'me' && !g.ask
  const stuck = mine && !g.me.some((c) => c8Legal(c, top, g.suit))
  const canDraw = stuck && !g.drew
  const hasCard = g.deck.length > 0 || g.pile.length > 1

  const play = (card) => {
    if (!mine || !c8Legal(card, top, g.suit)) return
    if (card.r === 8 && g.me.length > 1) return setG({ ...g, ask: card })
    const next = place(g, 'me', card, card.s)
    if (next.winner) setWins(wins + 1)
    setG(next)
  }

  const name = (suit) => g.ask && setG(place(g, 'me', g.ask, suit))

  const draw = () => {
    if (!canDraw) return
    const { g: g2, card } = drawOne(g)
    if (!card) {
      // Nothing left to draw. If the PC was stuck too, fewer cards takes the round.
      if (g.note !== 'pc-pass') return setG(pass(g, 'me', 'me-pass'))
      const winner = g.me.length < g.pc.length ? 'me' : 'pc'
      if (winner === 'me') setWins(wins + 1)
      return setG({ ...g, turn: 'over', winner, step: g.step + 1 })
    }
    const me = [...g2.me, card]
    if (c8Legal(card, top, g.suit)) setG({ ...g2, me, drew: true, step: g.step + 1 })
    else setG(pass({ ...g2, me }, 'me', 'me-pass'))
  }

  // PC turn: play, or draw one and play it if it fits.
  useEffect(() => {
    if (g.turn !== 'pc') return
    const id = setTimeout(
      () => {
        const pick = c8Pick(g.pc, g.pile.at(-1), g.suit)
        if (pick) return setG(place(g, 'pc', pick.card, pick.suit))
        if (g.drew) return setG(pass(g, 'pc', 'pc-drew'))
        const { g: g2, card } = drawOne(g)
        if (!card) return setG(pass(g, 'pc', 'pc-pass'))
        setG({ ...g2, pc: [...g2.pc, card], drew: true, step: g.step + 1 })
      },
      reduce ? 400 : g.drew ? 700 : 1000,
    )
    return () => clearTimeout(id)
  }, [g, reduce])

  // PC emptied its hand: the run ends.
  useEffect(() => {
    if (g.winner !== 'pc' || result) return
    const id = setTimeout(
      () => {
        // No rounds won = no score to save.
        const isNew = wins ? report(wins).isNew : (ended(), false)
        setResult({ wins, left: g.me.length, isNew })
      },
      reduce ? 700 : 1400,
    )
    return () => clearTimeout(id)
  }, [g.winner, g.me.length, wins, report, ended, result, reduce])

  const nextRound = useCallback(() => {
    setG(deal())
    setRound((n) => n + 1)
  }, [])
  useEnter(nextRound, g.winner === 'me' && !result)

  const again = useCallback(() => {
    setG(deal())
    setWins(0)
    setResult(null)
    setRound(0)
    setRun((n) => n + 1)
  }, [])

  const SuitNow = SUIT_ICON[g.suit]
  const deckTop = g.deck.at(-1)

  let say = <span className="text-muted">Your turn.</span>
  if (g.winner === 'me') say = <span className="text-accent">You win the round.</span>
  else if (g.winner === 'pc') say = <span className="text-danger">PC wins the round.</span>
  else if (g.ask) say = <span className="text-ink">Name a suit.</span>
  else if (g.turn === 'pc') say = <span className="text-muted">{g.note === 'me-pass' ? 'No match. PC plays…' : 'PC plays…'}</span>
  else if (canDraw) say = <span className="text-ink">{hasCard ? 'No match. Draw a card.' : 'No match. Pass.'}</span>
  else if (g.drew) say = <span className="text-ink">It fits. Play it.</span>
  else if (g.note === 'named') say = <span className="text-ink">PC named {SUIT_NAME[g.suit]}. Your turn.</span>
  else if (g.note === 'pc-drew' || g.note === 'pc-pass') say = <span className="text-ink">PC is stuck. Your turn.</span>

  return (
    <Swap fit k={result ? 'done' : `run-${run}`}>
      {result ? (
        <Result
          title="Crazy Eights"
          isNew={result.isNew}
          onAgain={again}
          stats={[
            { label: 'Rounds won in a row', value: result.wins },
            { label: 'Cards you held', value: result.left },
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
              <div className="text-xs text-muted">PC cards</div>
              <Swap k={g.pc.length}>
                <div className="num min-w-[2ch] text-3xl text-ink">{g.pc.length}</div>
              </Swap>
            </div>
          </div>

          <Swap k={round}>
            <LayoutGroup id={`eights-${run}-${round}`}>
              <div className="mt-6 flex h-14 justify-center [container-type:inline-size]" role="group" aria-label={`PC holds ${g.pc.length} cards`}>
                {g.pc.map((c, i) => (
                  <motion.div key={c.id} layoutId={c.id} transition={MOVE} style={overlap(i, g.pc.length, '40px')}>
                    <PlayingCard size="sm" up={false} />
                  </motion.div>
                ))}
              </div>

              <div className="mt-6 flex items-center justify-center gap-5 sm:gap-8">
                <button
                  type="button"
                  onClick={draw}
                  disabled={!canDraw}
                  aria-label={`Draw a card. ${g.deck.length} left`}
                  className={`relative rounded-lg transition-[box-shadow] duration-200 ${canDraw ? 'shadow-[0_0_0_2px_var(--accent)]' : ''}`}
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
                <div className="relative">
                  {g.pile.slice(-2).map((c, i, shown) => (
                    <motion.div key={c.id} layoutId={c.id} transition={MOVE} className={i < shown.length - 1 ? 'absolute inset-0' : 'relative'}>
                      <PlayingCard card={c} />
                    </motion.div>
                  ))}
                </div>
                <div className="w-14 text-center">
                  <div className="text-xs text-muted">Suit</div>
                  <Swap k={g.suit}>
                    <SuitNow size={30} weight="fill" className={`mx-auto mt-1 ${suitTint(g.suit)}`} aria-label={SUIT_NAME[g.suit]} />
                  </Swap>
                </div>
              </div>

              <div className="mt-9 h-7 text-center">
                <Swap k={g.step}>{say}</Swap>
              </div>

              <div className="mt-4 flex min-h-[74px] flex-wrap justify-center gap-1.5 sm:min-h-[92px] sm:gap-2">
                {sorted(g.me).map((c) => {
                  const ok = mine && c8Legal(c, top, g.suit)
                  const asked = g.ask === c
                  return (
                    <motion.button
                      key={c.id}
                      layoutId={c.id}
                      transition={MOVE}
                      type="button"
                      onClick={() => play(c)}
                      disabled={!ok}
                      aria-label={cardName(c)}
                      className={`rounded-lg transition-[opacity,translate,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                        asked ? '-translate-y-2 shadow-[0_0_0_2px_var(--accent)]' : ok ? 'hover:-translate-y-1.5' : g.turn === 'me' && !g.ask ? 'opacity-45' : ''
                      }`}
                    >
                      <PlayingCard card={c} />
                    </motion.button>
                  )
                })}
              </div>
            </LayoutGroup>
          </Swap>

          <div className="mt-6 flex h-12 justify-center">
            <Swap k={g.winner === 'me' ? 'next' : g.ask ? 'suit' : 'draw'} className="flex items-center gap-2 sm:gap-3">
              {g.winner === 'me' ? (
                <>
                  <Button onClick={nextRound} className="h-12 px-8 text-base">
                    Next round
                  </Button>
                  <span className="text-xs text-muted">or press Enter</span>
                </>
              ) : g.ask ? (
                <>
                  {SUITS.map((s) => {
                    const Icon = SUIT_ICON[s]
                    return (
                      <Button key={s} variant="ghost" onClick={() => name(s)} aria-label={SUIT_NAME[s]} className="h-12 w-12 px-0">
                        <Icon size={22} weight="fill" className={suitTint(s)} />
                      </Button>
                    )
                  })}
                  <Button variant="ghost" onClick={() => setG({ ...g, ask: null })} className="h-12">
                    Back
                  </Button>
                </>
              ) : (
                <Button variant="ghost" onClick={draw} disabled={!canDraw} className="h-12 px-8 text-base">
                  {hasCard ? 'Draw' : 'Pass'}
                </Button>
              )}
            </Swap>
          </div>

          <p className="mt-8 text-center text-sm text-muted">Match the suit or rank. Eights are wild. Empty your hand first.</p>
        </div>
      )}
    </Swap>
  )
}
