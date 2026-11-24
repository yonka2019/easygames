// Solitaire (Klondike) and FreeCell rules: pure, no React (also runs in plain Node).
// State = { game: 'klondike' | 'freecell', draw: 1 | 3, piles: { [key]: Card[] } }, Card here = { id, s, r, up }.
// Pile keys: 's' stock + 'w' waste (Klondike), 'c0'-'c3' free cells (FreeCell), 'f0'-'f3' foundations
// (one per suit, in SUITS order), 't0'.. tableau columns (7 Klondike, 8 FreeCell). Last card = top.
import { SUITS, newDeck } from './cardLogic.js'

export const FOUND = SUITS.map((_, i) => `f${i}`)
export const CELLS = ['c0', 'c1', 'c2', 'c3']
export const foundOf = (s) => `f${SUITS.indexOf(s)}`
export const tabKeys = (game) => Array.from({ length: game === 'klondike' ? 7 : 8 }, (_, i) => `t${i}`)
const red = (c) => c.s === 'h' || c.s === 'd'

export function patienceDeal(game, draw = 1) {
  const deck = newDeck()
  const piles = {}
  for (const f of FOUND) piles[f] = []
  if (game === 'klondike') {
    tabKeys(game).forEach((k, i) => (piles[k] = deck.splice(0, i + 1).map((c, j) => ({ ...c, up: j === i }))))
    piles.s = deck.map((c) => ({ ...c, up: false }))
    piles.w = []
  } else {
    for (const k of CELLS) piles[k] = []
    for (const k of tabKeys(game)) piles[k] = []
    deck.forEach((c, i) => piles[`t${i % 8}`].push({ ...c, up: true }))
  }
  return { game, draw, piles }
}

// Descending, alternating colors, all face up.
const isRun = (cards) => cards.every((c, i) => c.up && (!i || (c.r === cards[i - 1].r - 1 && red(c) !== red(cards[i - 1]))))

// FreeCell: cards moved at once = (empty cells + 1) * 2 ^ empty columns (the target column not counted).
export function maxRun(st, to) {
  if (st.game !== 'freecell') return 52
  const cells = CELLS.filter((k) => !st.piles[k].length).length
  const cols = tabKeys(st.game).filter((k) => k !== to && !st.piles[k].length).length
  return (cells + 1) * 2 ** cols
}

// Can the top `n` cards of pile `key` be lifted?
export function canPick(st, key, n) {
  const pile = st.piles[key]
  if (!pile || key === 's' || n < 1 || n > pile.length) return false
  if (key[0] !== 't') return n === 1 && pile.at(-1).up
  return isRun(pile.slice(-n))
}

export function canMove(st, from, n, to) {
  if (from === to || !canPick(st, from, n)) return false
  const c = st.piles[from].at(-n)
  const top = st.piles[to]?.at(-1)
  if (to[0] === 'f') return n === 1 && to === foundOf(c.s) && c.r === (top?.r ?? 0) + 1
  if (to[0] === 'c') return n === 1 && !top && to in st.piles
  if (to[0] !== 't' || !st.piles[to]) return false
  if (n > maxRun(st, to)) return false
  if (!top) return st.game === 'freecell' || c.r === 13
  return top.up && top.r === c.r + 1 && red(top) !== red(c)
}

// Moves the top `n` cards; Klondike turns the newly exposed column card face up.
export function applyMove(st, from, n, to) {
  const src = st.piles[from].slice(0, -n)
  const moving = st.piles[from].slice(-n)
  if (st.game === 'klondike' && from[0] === 't' && src.length && !src.at(-1).up) src[src.length - 1] = { ...src.at(-1), up: true }
  return { ...st, piles: { ...st.piles, [from]: src, [to]: [...st.piles[to], ...moving] } }
}

// Klondike stock click: turn `draw` cards onto the waste, or turn the waste back over when the stock is empty.
export function drawCards(st) {
  const stock = [...st.piles.s]
  const waste = [...st.piles.w]
  if (stock.length) {
    for (let i = 0; i < st.draw && stock.length; i++) waste.push({ ...stock.pop(), up: true })
  } else if (waste.length) {
    while (waste.length) stock.push({ ...waste.pop(), up: false })
  } else return null
  return { ...st, piles: { ...st.piles, s: stock, w: waste } }
}

export const isWon = (st) => FOUND.every((f) => st.piles[f].length === 13)

// Nothing left to decide: stock/waste empty, every card face up, every column in falling rank order.
// Then the lowest card left is always free, so the game plays itself out.
export function canFinish(st) {
  if (st.game === 'klondike' && (st.piles.s.length || st.piles.w.length)) return false
  return tabKeys(st.game).every((k) => st.piles[k].every((c, i, col) => c.up && (!i || c.r <= col[i - 1].r)))
}

// One step of the play-out: the lowest free card to its foundation. Null when none fits.
export function finishStep(st) {
  let best = null
  for (const k of [...tabKeys(st.game), ...CELLS, 'w']) {
    const c = st.piles[k]?.at(-1)
    if (c && canMove(st, k, 1, foundOf(c.s)) && (!best || c.r < best.c.r)) best = { k, c }
  }
  return best && { from: best.k, to: foundOf(best.c.s), state: applyMove(st, best.k, 1, foundOf(best.c.s)) }
}

// Where a clicked card goes: its foundation, a column that takes it, an empty column, then a free cell.
export function bestTarget(st, from, n) {
  const c = st.piles[from].at(-n)
  if (n === 1 && canMove(st, from, 1, foundOf(c.s))) return foundOf(c.s)
  const cols = tabKeys(st.game)
  const built = cols.find((k) => st.piles[k].length && canMove(st, from, n, k))
  if (built) return built
  // An empty column only helps if the move leaves something behind (not a whole column hopping over).
  const whole = from[0] === 't' && n === st.piles[from].length
  const empty = !whole && cols.find((k) => !st.piles[k].length && canMove(st, from, n, k))
  if (empty) return empty
  if (st.game === 'freecell' && n === 1 && from[0] !== 'c') return CELLS.find((k) => canMove(st, from, 1, k)) ?? null
  return null
}

// Every legal move (for checks and the "no moves left" hint).
export function legalMoves(st) {
  const out = []
  for (const from of Object.keys(st.piles)) {
    for (let n = 1; n <= st.piles[from].length; n++) {
      if (!canPick(st, from, n)) continue
      for (const to of Object.keys(st.piles)) if (canMove(st, from, n, to)) out.push({ from, n, to })
    }
  }
  return out
}
