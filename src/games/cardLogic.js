// Pure card rules shared by the card games (no React, so they also run in plain Node).
import { shuffle } from '../lib/util.js'

export const SUITS = ['s', 'h', 'd', 'c']
export const SUIT_NAME = { s: 'Spades', h: 'Hearts', d: 'Diamonds', c: 'Clubs' }
const FACE = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }

// Card = { id, s: suit ('s' | 'h' | 'd' | 'c' | 'j' for a joker), r: rank 1-13 (ace = 1, joker = 0) }.
export const rankLabel = (r) => FACE[r] ?? String(r)
export const isJoker = (c) => c.s === 'j'
export const isRed = (c) => c.s === 'h' || c.s === 'd'
export const cardName = (c) => (isJoker(c) ? 'Joker' : `${rankLabel(c.r)} of ${SUIT_NAME[c.s].toLowerCase()}`)

export function newDeck(jokers = 0) {
  const cards = SUITS.flatMap((s) => Array.from({ length: 13 }, (_, i) => ({ id: `${s}${i + 1}`, s, r: i + 1 })))
  for (let i = 1; i <= jokers; i++) cards.push({ id: `j${i}`, s: 'j', r: 0 })
  return shuffle(cards)
}

/* ---------- Blackjack ---------- */

export function bjTotal(cards) {
  const hard = cards.reduce((n, c) => n + Math.min(c.r, 10), 0)
  const soft = cards.some((c) => c.r === 1) && hard + 10 <= 21
  return { total: soft ? hard + 10 : hard, soft }
}

export const isBlackjack = (cards) => cards.length === 2 && bjTotal(cards).total === 21

// Dealer draws to 17 and stands on every 17 (soft too).
export const dealerHits = (cards) => bjTotal(cards).total < 17

// `win` = credits handed back, stake included. Blackjack pays 3:2 (rounded to a whole credit).
export function bjPayout(player, dealer, bet) {
  const p = bjTotal(player).total
  const d = bjTotal(dealer).total
  const pBj = isBlackjack(player)
  const dBj = isBlackjack(dealer)
  if (p > 21) return { outcome: 'bust', win: 0 }
  if (pBj && dBj) return { outcome: 'push', win: bet }
  if (pBj) return { outcome: 'blackjack', win: Math.round(bet * 2.5) }
  if (dBj) return { outcome: 'lose', win: 0 }
  if (d > 21 || p > d) return { outcome: 'win', win: bet * 2 }
  if (p === d) return { outcome: 'push', win: bet }
  return { outcome: 'lose', win: 0 }
}

/* ---------- Higher or lower ---------- */

// Ace is high.
export const hiloValue = (c) => (c.r === 1 ? 14 : c.r)

/* ---------- Crazy Eights ---------- */

// `suit` = the suit in play: the top card's, or the one named with an eight.
export const c8Legal = (card, top, suit) => card.r === 8 || card.s === suit || card.r === top.r

// PC move: keeps eights for when it is stuck, and steers play to the suit it holds most of.
export function c8Pick(hand, top, suit) {
  const legal = hand.filter((c) => c8Legal(c, top, suit))
  if (!legal.length) return null
  const held = (s, played) => hand.filter((c) => c !== played && c.r !== 8 && c.s === s).length
  const plain = legal.filter((c) => c.r !== 8)
  if (plain.length) {
    const card = plain.reduce((a, b) => (held(b.s, b) > held(a.s, a) ? b : a))
    return { card, suit: card.s }
  }
  const card = legal[0]
  return { card, suit: SUITS.reduce((a, b) => (held(b, card) > held(a, card) ? b : a)) }
}

/* ---------- Yaniv ---------- */

export const YANIV_MAX = 7
export const yanivPoints = (c) => (isJoker(c) ? 0 : Math.min(c.r, 10))
export const handPoints = (cards) => cards.reduce((n, c) => n + yanivPoints(c), 0)

// The cards in run order (3+ in a row, one suit, jokers fill gaps or extend an end), or null.
export function asRun(cards) {
  if (cards.length < 3) return null
  const real = cards.filter((c) => !isJoker(c)).sort((a, b) => a.r - b.r)
  const spare = cards.filter(isJoker)
  if (!real.length || real.some((c) => c.s !== real[0].s)) return null
  const out = [real[0]]
  for (let i = 1; i < real.length; i++) {
    const gap = real[i].r - real[i - 1].r - 1
    if (gap < 0 || gap > spare.length) return null
    for (let g = 0; g < gap; g++) out.push(spare.pop())
    out.push(real[i])
  }
  let lo = real[0].r
  let hi = real.at(-1).r
  while (spare.length) {
    if (hi < 13) {
      out.push(spare.pop())
      hi++
    } else if (lo > 1) {
      out.unshift(spare.pop())
      lo--
    } else return null
  }
  return out
}

// A legal drop: one card, a set (2+ of one rank) or a run. Returns the cards in table order, or null.
export function validDrop(cards) {
  if (!cards.length) return null
  if (cards.length === 1) return cards
  if (cards.every((c) => c.r === cards[0].r)) return cards
  return asRun(cards)
}

// Only the first or last card of the previous drop can be taken.
export const takeable = (drop) => (drop.length > 1 ? [drop[0], drop.at(-1)] : drop.slice(0, 1))

export function allDrops(hand) {
  const drops = []
  for (let mask = 1; mask < 1 << hand.length; mask++) {
    const drop = validDrop(hand.filter((_, i) => mask & (1 << i)))
    if (drop) drops.push(drop)
  }
  return drops
}

// PC calls as soon as it can: a player sitting lower would have called already.
export const yanivShouldCall = (hand) => handPoints(hand) <= YANIV_MAX

const DECK_AVG = 6.3 // expected points of an unseen card
const SEEN = 1.5 // cost of taking a card the player has seen: only low cards are worth it

// PC move: the drop + draw that leaves the fewest points. Taking a card that pairs up counts as a future set.
export function yanivMove(hand, last, deckLeft = 1) {
  let best = null
  for (const drop of allDrops(hand)) {
    const rest = hand.filter((c) => !drop.includes(c))
    const base = handPoints(rest)
    const options = takeable(last).map((take) => {
      const pts = yanivPoints(take)
      const pairs = !isJoker(take) && rest.some((c) => c.r === take.r)
      return { drop, take, cost: base + (pairs ? -0.6 * pts : pts + SEEN) }
    })
    if (deckLeft > 0) options.push({ drop, take: null, cost: base + DECK_AVG })
    for (const o of options) if (!best || o.cost < best.cost) best = o
  }
  return best
}
