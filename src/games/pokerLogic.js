// Texas hold'em: hand ranking, table engine (blinds, betting rounds, side pots) and the PC's play.
// Pure, no React (also runs in plain Node). Cards come from cardLogic (ace r = 1, counted high or low).
import { newDeck } from './cardLogic.js'

/* ---------- Hand ranking ---------- */

const NAMES = ['High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush']
const val = (c) => (c.r === 1 ? 14 : c.r)

// Highest straight in a set of values (5-high wheel counts), or 0.
function straightTop(vals) {
  const has = new Set(vals)
  if (has.has(14)) has.add(1)
  for (let top = 14; top >= 5; top--) {
    let ok = true
    for (let v = top; v > top - 5; v--) if (!has.has(v)) ok = false
    if (ok) return top
  }
  return 0
}

// Score of the best 5 of up to 7 cards: higher wins, equal = split. Category * 15^5 + tiebreak values.
export function handScore(cards) {
  const enc = (cat, ks) => ks.slice(0, 5).reduce((n, k, i) => n + k * 15 ** (4 - i), cat * 15 ** 5)
  const vals = cards.map(val).sort((a, b) => b - a)
  const bySuit = {}
  for (const c of cards) (bySuit[c.s] ??= []).push(val(c))
  const flush = Object.values(bySuit).find((v) => v.length >= 5)?.sort((a, b) => b - a)
  if (flush) {
    const sf = straightTop(flush)
    if (sf) return enc(8, [sf])
  }
  const count = {}
  for (const v of vals) count[v] = (count[v] ?? 0) + 1
  const groups = Object.entries(count)
    .map(([v, n]) => [Number(v), n])
    .sort((a, b) => b[1] - a[1] || b[0] - a[0])
  const kick = (skip) => vals.filter((v) => !skip.includes(v))
  const [a, b] = groups
  if (a[1] === 4) return enc(7, [a[0], ...kick([a[0]])])
  if (a[1] === 3 && b?.[1] >= 2) return enc(6, [a[0], b[0]])
  if (flush) return enc(5, flush)
  const st = straightTop(vals)
  if (st) return enc(4, [st])
  if (a[1] === 3) return enc(3, [a[0], ...kick([a[0]])])
  if (a[1] === 2 && b?.[1] === 2) return enc(2, [a[0], b[0], ...kick([a[0], b[0]])])
  if (a[1] === 2) return enc(1, [a[0], ...kick([a[0]])])
  return enc(0, vals)
}

export const handName = (score) => {
  const cat = Math.floor(score / 15 ** 5)
  return cat === 8 && Math.floor(score / 15 ** 4) % 15 === 14 ? 'Royal flush' : NAMES[cat]
}

// Chance to win (ties shared) against `opps` random hands, by `sims` random run-outs.
export function equity(hole, board, opps, sims = 300) {
  const known = new Set([...hole, ...board].map((c) => c.id))
  const rest = newDeck().filter((c) => !known.has(c.id))
  let won = 0
  for (let s = 0; s < sims; s++) {
    // Partial shuffle: only the cards this run-out needs.
    const need = opps * 2 + 5 - board.length
    for (let i = 0; i < need; i++) {
      const j = i + Math.floor(Math.random() * (rest.length - i))
      ;[rest[i], rest[j]] = [rest[j], rest[i]]
    }
    const full = [...board, ...rest.slice(opps * 2, need)]
    const mine = handScore([...hole, ...full])
    let best = 0
    let ties = 1
    let lost = false
    for (let o = 0; o < opps && !lost; o++) {
      const sc = handScore([rest[o * 2], rest[o * 2 + 1], ...full])
      if (sc > mine) lost = true
      else if (sc === mine) ties++
      best = Math.max(best, sc)
    }
    if (!lost) won += 1 / ties
  }
  return won / sims
}

/* ---------- Table ---------- */

// Player = { name, chips, hole, bet (this street), total (this hand), folded, allIn, acted, out (busted), last (shown action) }.
// Table = { players, dealer, hand, sb, bb, deck, board, street (0 pre-flop, 1 flop, 2 turn, 3 river), bet (to match),
//           raise (min raise size), turn (seat to act), phase: 'act' | 'street' | 'done', result }.
export const BLIND_EVERY = 10

export function newTable(names, chips = 1000) {
  return { players: names.map((name) => ({ name, chips, hole: [], bet: 0, total: 0, folded: false, allIn: false, acted: false, out: false, last: null })), dealer: -1, hand: 0, board: [], phase: 'done', result: null }
}

const seated = (t) => t.players.map((p, i) => i).filter((i) => !t.players[i].out)
const nextSeat = (t, from, ok) => {
  for (let k = 1; k <= t.players.length; k++) {
    const i = (from + k) % t.players.length
    if (ok(t.players[i], i)) return i
  }
  return -1
}
const canAct = (p) => !p.out && !p.folded && !p.allIn
const live = (p) => !p.out && !p.folded

function put(t, i, amount) {
  const p = t.players[i]
  const n = Math.min(amount, p.chips)
  p.chips -= n
  p.bet += n
  p.total += n
  if (!p.chips) p.allIn = true
}

export function startHand(t0) {
  const t = structuredClone(t0)
  t.hand += 1
  const level = Math.floor((t.hand - 1) / BLIND_EVERY)
  t.bb = 20 * 2 ** level
  t.sb = t.bb / 2
  for (const p of t.players) Object.assign(p, { hole: [], bet: 0, total: 0, folded: false, allIn: false, acted: false, last: null })
  t.dealer = nextSeat(t, t.dealer, (p) => !p.out)
  const heads = seated(t).length === 2
  const sbSeat = heads ? t.dealer : nextSeat(t, t.dealer, (p) => !p.out)
  const bbSeat = nextSeat(t, sbSeat, (p) => !p.out)
  put(t, sbSeat, t.sb)
  put(t, bbSeat, t.bb)
  t.deck = newDeck()
  for (let k = 0; k < 2; k++) for (const i of seated(t)) t.players[i].hole.push(t.deck.pop())
  t.board = []
  t.street = 0
  t.bet = t.bb
  t.raise = t.bb
  t.result = null
  t.phase = 'act'
  return settleTurn(t, bbSeat)
}

// What seat `t.turn` may do. Amounts are "raise to" totals for this street.
export function options(t) {
  const p = t.players[t.turn]
  const call = Math.min(t.bet - p.bet, p.chips)
  const max = p.bet + p.chips
  const min = Math.min(t.bet + t.raise, max)
  return { call, check: call === 0, min, max, canRaise: max > t.bet }
}

// Raise sizes for the buttons: min, half pot, pot, all in (all as "raise to" totals).
export function raiseSizes(t) {
  const { min, max } = options(t)
  const p = t.players[t.turn]
  const pot = potSize(t) + (t.bet - p.bet) // pot after calling
  const to = (x) => Math.max(min, Math.min(max, Math.round(x / t.sb) * t.sb))
  return { min, half: to(t.bet + pot / 2), pot: to(t.bet + pot), max }
}

export const potSize = (t) => t.players.reduce((n, p) => n + p.total, 0)

// Seat `t.turn` acts: { type: 'fold' | 'check' | 'call' | 'raise', to? }.
export function act(t0, a) {
  const t = structuredClone(t0)
  const i = t.turn
  const p = t.players[i]
  const o = options(t)
  if (a.type === 'fold') {
    p.folded = true
    p.last = 'Fold'
  } else if (a.type === 'check' || (a.type === 'call' && o.call === 0)) {
    p.last = 'Check'
  } else if (a.type === 'call') {
    put(t, i, o.call)
    p.last = p.allIn ? 'All in' : 'Call'
  } else {
    const to = Math.max(o.min, Math.min(o.max, a.to ?? o.min))
    const raisedBy = to - t.bet
    put(t, i, to - p.bet)
    if (raisedBy >= t.raise) t.raise = raisedBy // a short all-in does not raise the minimum
    t.bet = Math.max(t.bet, p.bet)
    p.last = p.allIn ? 'All in' : t0.bet ? 'Raise' : 'Bet'
  }
  p.acted = true
  return settleTurn(t, i)
}

// After a move: hand over, street over, or the next seat to act.
function settleTurn(t, from) {
  const left = t.players.filter(live)
  if (left.length === 1) return finish(t)
  const owes = (p) => canAct(p) && (!p.acted || p.bet < t.bet)
  const next = nextSeat(t, from, owes)
  if (next >= 0) {
    // Everyone else is all in and this seat has matched: nothing to decide.
    if (t.players.filter(canAct).length === 1 && t.players[next].bet >= t.bet) return { ...t, phase: 'street' }
    return { ...t, turn: next, phase: 'act' }
  }
  return { ...t, phase: 'street' }
}

// Deal the next street (or go to showdown after the river).
export function nextStreet(t0) {
  const t = structuredClone(t0)
  if (t.street === 3) return finish(t)
  t.street += 1
  t.board.push(...t.deck.splice(-(t.street === 1 ? 3 : 1)))
  for (const p of t.players) {
    p.bet = 0
    if (canAct(p)) {
      p.acted = false
      p.last = null
    }
  }
  t.bet = 0
  t.raise = t.bb
  if (t.players.filter(canAct).length < 2) return { ...t, phase: 'street' } // all in: run the board out
  t.turn = nextSeat(t, t.dealer, canAct)
  t.phase = 'act'
  return t
}

// Main pot and side pots from what each player put in: [{ amount, seats }].
export function pots(players) {
  const left = players.map((p) => p.total)
  const out = []
  while (left.some((n) => n > 0)) {
    const live = players.map((p, i) => i).filter((i) => !players[i].folded && !players[i].out && left[i] > 0)
    if (!live.length) {
      out.at(-1).amount += left.reduce((a, b) => a + b, 0) // folded chips above every live stake
      break
    }
    const level = Math.min(...live.map((i) => left[i]))
    let amount = 0
    left.forEach((n, i) => {
      const take = Math.min(n, level)
      left[i] -= take
      amount += take
    })
    if (out.length && out.at(-1).seats.join() === live.join()) out.at(-1).amount += amount
    else out.push({ amount, seats: live })
  }
  return out
}

// Pays every pot to its best hand(s). Odd chips go to the first winner left of the dealer.
function finish(t0) {
  const t = structuredClone(t0)
  const alive = t.players.map((p, i) => i).filter((i) => live(t.players[i]))
  const shown = alive.length > 1
  const scores = t.players.map((p) => (shown && live(p) ? handScore([...p.hole, ...t.board]) : 0))
  const won = t.players.map(() => 0)
  for (const pot of pots(t.players)) {
    const best = Math.max(...pot.seats.map((i) => scores[i]))
    const winners = pot.seats.filter((i) => scores[i] === best)
    const n = t.players.length
    const dist = (i) => (i - t.dealer + n) % n || n // seats left of the dealer, dealer last
    const order = [...winners].sort((a, b) => dist(a) - dist(b))
    const share = Math.floor(pot.amount / winners.length)
    winners.forEach((i) => (won[i] += share))
    won[order[0]] += pot.amount - share * winners.length
  }
  won.forEach((n, i) => (t.players[i].chips += n))
  for (const p of t.players) {
    p.bet = 0
    if (!p.chips) p.out = true
  }
  t.phase = 'done'
  t.result = { won, shown, names: shown ? scores.map((s) => (s ? handName(s) : null)) : [] }
  return t
}

/* ---------- PC ---------- */

// The PC's move for seat `t.turn`. Hand strength by simulation, weighed against the price to call.
export function pcMove(t, sims = 260) {
  const p = t.players[t.turn]
  const opps = t.players.filter((q, i) => i !== t.turn && live(q)).length
  const eq = equity(p.hole, t.board, opps, sims)
  const rel = eq * (opps + 1) // 1 = an average hand at this table
  const o = options(t)
  const pot = potSize(t)
  const odds = o.call / (pot + o.call || 1)
  const size = raiseSizes(t)
  const r = Math.random()
  if (o.canRaise && rel > 2.3 && r < 0.75) return { type: 'raise', to: r < 0.2 ? size.max : size.pot }
  if (o.canRaise && rel > 1.55 && r < 0.55 && t.bet <= t.bb * 4) return { type: 'raise', to: size.half }
  if (o.check) {
    if (o.canRaise && r < 0.07) return { type: 'raise', to: size.half } // the odd bluff
    return { type: 'check' }
  }
  if (eq >= odds + 0.04 || (rel > 1.1 && o.call <= t.bb)) return { type: 'call' }
  return { type: 'fold' }
}
