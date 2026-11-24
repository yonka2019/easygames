// PC search for the board games, off the main thread so the page never freezes.
// In: { id, game, state, level }. Out: { id, move }.
import { chessBest } from './chessLogic.js'
import { checkersBest } from './checkersLogic.js'
import { fourBest } from './fourLogic.js'

// Checkers state = { b, rules }.
const BEST = { chess: chessBest, checkers: (s, level) => checkersBest(s.b, level, -1, s.rules), four: fourBest }

self.onmessage = (e) => {
  const { id, game, state, level } = e.data
  self.postMessage({ id, move: BEST[game](state, level) })
}
