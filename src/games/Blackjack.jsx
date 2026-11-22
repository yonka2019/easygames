import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Button, EASE, Swap } from '../components/ui'
import { CARD_W, CardSlot, PlayingCard, overlap } from './cards'
import { bjPayout, bjTotal, dealerHits, isBlackjack, newDeck } from './cardLogic'

// Blackjack table for the Casino shell (bank, bets and cash out live there).
// Hit / Stand / Double. Blackjack pays 3:2, dealer stands on 17, fresh shuffle every hand.

const STEP = 0.14 // seconds between dealt cards
const TURN = 620 // ms between dealer cards

// A card sliding in from the shoe.
function Dealt({ delay = 0, style, children }) {
  return (
    <motion.div
      style={style}
      initial={{ opacity: 0, x: 28, y: -22, rotate: 8 }}
      animate={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
      transition={{ duration: 0.34, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

function Row({ label, note, total, children }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-muted">
          {label}
          {note && <span className="num ml-2 text-xs">{note}</span>}
        </span>
        <Swap k={total ?? 'none'}>
          <span className="num block min-w-[2ch] text-right text-lg text-ink">{total ?? '-'}</span>
        </Swap>
      </div>
      <div className={`flex min-h-[74px] [container-type:inline-size] sm:min-h-[92px] ${CARD_W}`}>{children}</div>
    </div>
  )
}

const OUT = {
  win: (h) => <span className="num text-lg text-accent">+{(h.out.win - h.stake).toLocaleString()}</span>,
  blackjack: (h) => <span className="num text-lg text-accent">+{(h.out.win - h.stake).toLocaleString()} · Blackjack</span>,
  push: () => <span className="text-muted">Push. Bet back.</span>,
  lose: () => <span className="text-muted">Dealer wins.</span>,
  bust: () => <span className="text-danger">Bust.</span>,
}

export default function Blackjack({ bet, balance, busy, setBusy, settle }) {
  const reduce = useReducedMotion()
  const [hand, setHand] = useState(null) // { n, player, dealer, stake, phase: deal | player | dealer | done, out }
  const cur = useRef(null) // same hand, readable right away (two key presses in one frame)
  const deck = useRef([])
  const timers = useRef([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const later = (fn, ms) => timers.current.push(setTimeout(fn, reduce ? 0 : ms))
  const put = (h) => {
    cur.current = h
    setHand(h)
  }

  const phase = hand?.phase ?? 'idle'
  const canDeal = !busy && bet > 0 && (phase === 'idle' || phase === 'done')
  const canDouble = phase === 'player' && hand.player.length === 2 && balance >= hand.stake * 2

  function finish(h) {
    const out = bjPayout(h.player, h.dealer, h.stake)
    put({ ...h, phase: 'done', out })
    const end = () => {
      settle(h.stake, out.win)
      setBusy(false)
    }
    // Last credits lost: hold the table a moment before the run ends.
    if (balance - h.stake + out.win <= 0) later(end, 1300)
    else end()
  }

  function dealerPlay(h) {
    const step = (at) => {
      if (!dealerHits(at.dealer)) return finish(at)
      const next = { ...at, dealer: [...at.dealer, deck.current.pop()] }
      put(next)
      later(() => step(next), TURN)
    }
    const start = { ...h, phase: 'dealer' }
    put(start)
    later(() => step(start), TURN)
  }

  function deal() {
    if (!canDeal || cur.current?.phase === 'deal') return
    const d = newDeck()
    const h = { n: (hand?.n ?? 0) + 1, player: [d.pop(), d.pop()], dealer: [d.pop(), d.pop()], stake: bet, phase: 'deal' }
    deck.current = d
    setBusy(true)
    put(h)
    // Old hand fades out (Swap), then four cards land.
    later(() => (isBlackjack(h.player) || isBlackjack(h.dealer) ? finish(h) : put({ ...h, phase: 'player' })), 180 + STEP * 3000 + 340)
  }

  function hit() {
    const h0 = cur.current
    if (h0?.phase !== 'player') return
    const h = { ...h0, player: [...h0.player, deck.current.pop()] }
    const total = bjTotal(h.player).total
    if (total > 21) finish(h)
    else if (total === 21) dealerPlay(h)
    else put(h)
  }

  function stand() {
    if (cur.current?.phase === 'player') dealerPlay(cur.current)
  }

  function double() {
    const h0 = cur.current
    if (h0?.phase !== 'player' || h0.player.length !== 2 || balance < h0.stake * 2) return
    const h = { ...h0, stake: h0.stake * 2, player: [...h0.player, deck.current.pop()] }
    if (bjTotal(h.player).total > 21) finish(h)
    else dealerPlay(h)
  }

  // Space deals, H / S / D play the hand.
  const keys = useRef(null)
  keys.current = { Space: deal, KeyH: hit, KeyS: stand, KeyD: double }
  useEffect(() => {
    const onKey = (e) => {
      const fn = keys.current[e.code]
      if (!fn || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.target.closest?.(e.code === 'Space' ? 'button, input, textarea' : 'input, textarea')) return
      e.preventDefault()
      fn()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const hidden = phase === 'deal' || phase === 'player'
  const dealerTotal = hand ? bjTotal(hidden ? hand.dealer.slice(0, 1) : hand.dealer).total : null
  const playerTotal = hand ? bjTotal(hand.player).total : null
  const acting = phase === 'deal' || phase === 'player' || phase === 'dealer'

  return (
    <div className="mx-auto max-w-[520px]">
      <div className="rounded-xl border border-line bg-surface p-4 sm:p-6">
        <Swap k={hand?.n ?? 0}>
          <div className="grid gap-5">
            <Row label="Dealer" total={dealerTotal}>
              {hand ? (
                hand.dealer.map((c, i) => (
                  <Dealt key={c.id} delay={i < 2 ? STEP * (i * 2 + 1) : 0} style={overlap(i, hand.dealer.length, 'var(--cw)', 8)}>
                    <PlayingCard card={c} up={i !== 1 || !hidden} />
                  </Dealt>
                ))
              ) : (
                <div className="flex gap-2">
                  <CardSlot />
                  <CardSlot />
                </div>
              )}
            </Row>
            <Row label="You" note={hand && `Bet ${hand.stake}`} total={playerTotal}>
              {hand ? (
                hand.player.map((c, i) => (
                  <Dealt key={c.id} delay={i < 2 ? STEP * i * 2 : 0} style={overlap(i, hand.player.length, 'var(--cw)', 8)}>
                    <PlayingCard card={c} />
                  </Dealt>
                ))
              ) : (
                <div className="flex gap-2">
                  <CardSlot />
                  <CardSlot />
                </div>
              )}
            </Row>
          </div>
        </Swap>
      </div>

      <div className="mt-4 h-7 text-center">
        <Swap k={hand ? `${hand.n}-${phase}` : 'idle'}>
          {phase === 'idle' && <span className="text-sm text-muted">Beat the dealer to 21. Blackjack pays 3:2.</span>}
          {phase === 'deal' && <span className="text-muted">Dealing…</span>}
          {phase === 'player' && <span className="text-muted">Hit or stand?</span>}
          {phase === 'dealer' && <span className="text-muted">Dealer plays…</span>}
          {phase === 'done' && OUT[hand.out.outcome](hand)}
        </Swap>
      </div>

      <div className="mt-5 flex h-12 justify-center">
        <Swap k={acting ? 'act' : 'deal'} className="flex gap-2 sm:gap-3">
          {acting ? (
            <>
              <Button onClick={hit} disabled={phase !== 'player'} className="h-12 px-6 text-base">
                Hit
              </Button>
              <Button variant="ghost" onClick={stand} disabled={phase !== 'player'} className="h-12 px-6 text-base">
                Stand
              </Button>
              <Button variant="ghost" onClick={double} disabled={!canDouble} className="h-12 px-6 text-base">
                Double
              </Button>
            </>
          ) : (
            <Button onClick={deal} disabled={!canDeal} className="h-12 px-10 text-base">
              Deal
            </Button>
          )}
        </Swap>
      </div>
    </div>
  )
}
