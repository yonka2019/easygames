// Checkers (English rules): pure rules + PC search (no React; also runs in the board worker and in plain Node).
// Board = 64 cells, index = row * 8 + col, row 0 is the PC's back row. Dark squares only.
// 1 = player man (moves up), 2 = player king, -1 = PC man (moves down), -2 = PC king.
// Jumps are forced, a multi-jump must be finished, kings step one square, a man that is crowned stops.

const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]]
const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8

export function checkersNew() {
  const b = Array(64).fill(0)
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 0) continue
      if (r < 3) b[r * 8 + c] = -1
      else if (r > 4) b[r * 8 + c] = 1
    }
  }
  return b
}

const dirsOf = (p) => (p === 2 || p === -2 ? DIAG : p === 1 ? DIAG.slice(0, 2) : DIAG.slice(2))
const crowns = (p, row) => (p === 1 && row === 0) || (p === -1 && row === 7)

function jumpsFrom(b, from, sq, p, path, caps, out) {
  const r = sq >> 3
  const c = sq & 7
  let found = false
  for (const [dr, dc] of dirsOf(p)) {
    const r2 = r + dr * 2
    const c2 = c + dc * 2
    if (!inside(r2, c2)) continue
    const mid = (r + dr) * 8 + c + dc
    const land = r2 * 8 + c2
    if (b[mid] * p >= 0 || caps.includes(mid)) continue // needs an enemy piece not taken yet
    if (b[land] !== 0 && land !== from) continue
    found = true
    const next = { path: [...path, land], caps: [...caps, mid] }
    if (crowns(p, r2)) out.push({ from, to: land, ...next })
    else jumpsFrom(b, from, land, p, next.path, next.caps, out)
  }
  if (!found && caps.length) out.push({ from, to: sq, path, caps })
}

// Legal moves for `side` (1 player, -1 PC): { from, to, path: squares landed on, caps: squares taken }.
export function checkersMoves(b, side) {
  const jumps = []
  for (let sq = 0; sq < 64; sq++) if (b[sq] * side > 0) jumpsFrom(b, sq, sq, b[sq], [], [], jumps)
  if (jumps.length) return jumps
  const steps = []
  for (let sq = 0; sq < 64; sq++) {
    const p = b[sq]
    if (p * side <= 0) continue
    for (const [dr, dc] of dirsOf(p)) {
      const r = (sq >> 3) + dr
      const c = (sq & 7) + dc
      if (inside(r, c) && !b[r * 8 + c]) steps.push({ from: sq, to: r * 8 + c, path: [r * 8 + c], caps: [] })
    }
  }
  return steps
}

export function checkersApply(b, m) {
  const next = [...b]
  const p = next[m.from]
  next[m.from] = 0
  for (const sq of m.caps) next[sq] = 0
  next[m.to] = crowns(p, m.to >> 3) ? p * 2 : p
  return next
}

export const checkersCount = (b, side) => b.reduce((n, p) => n + (p * side > 0 ? 1 : 0), 0)

/* ---------- PC ---------- */

const WIN = 100000

function evaluate(b, side) {
  let score = 0
  for (let sq = 0; sq < 64; sq++) {
    const p = b[sq]
    if (!p) continue
    const r = sq >> 3
    const c = sq & 7
    let v
    if (p === 2 || p === -2) v = 175 + (c > 1 && c < 6 && r > 1 && r < 6 ? 6 : 0)
    else {
      const gone = p === 1 ? 7 - r : r // rows advanced
      v = 100 + gone * 3 + (gone === 0 ? 8 : 0) + (c > 1 && c < 6 ? 2 : 0)
    }
    score += p * side > 0 ? v : -v
  }
  return score
}

function search(b, side, depth, alpha, beta, ply, clock) {
  if (clock.end && ++clock.nodes % 1024 === 0 && Date.now() > clock.end) clock.out = true
  if (clock.out) return 0
  const moves = checkersMoves(b, side)
  if (!moves.length) return -WIN + ply
  // Out of depth: stop only on a quiet position (a pending jump is always played out).
  if (depth <= 0 && (!moves[0].caps.length || ply > 40)) return evaluate(b, side)
  let best = -Infinity
  for (const m of moves) {
    const score = -search(checkersApply(b, m), -side, depth - 1, -beta, -alpha, ply + 1, clock)
    if (score > best) best = score
    if (best > alpha) alpha = best
    if (alpha >= beta) break
  }
  return best
}

function bestAt(b, side, moves, depth, clock) {
  let best = { move: moves[0], score: -Infinity }
  for (const m of moves) {
    const score = -search(checkersApply(b, m), -side, depth - 1, -Infinity, -best.score, 1, clock)
    if (clock.out) break
    if (score > best.score) best = { move: m, score }
  }
  return best
}

const LEVEL = {
  easy: { depth: 2, slip: 0.25 },
  normal: { depth: 4, slip: 0 },
  hard: { depth: 14, slip: 0, ms: 900 },
}

// Move the PC plays, or null when it has none. Easy sometimes plays a random legal move.
export function checkersBest(b, level = 'normal', side = -1) {
  const moves = checkersMoves(b, side)
  if (!moves.length) return null
  if (moves.length === 1) return moves[0]
  for (let i = moves.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[moves[i], moves[j]] = [moves[j], moves[i]]
  }
  const { depth, slip, ms } = LEVEL[level] ?? LEVEL.normal
  if (slip && Math.random() < slip) return moves[0]
  if (!ms) return bestAt(b, side, moves, depth, {}).move
  const clock = { end: Date.now() + ms, nodes: 0, out: false }
  let best = bestAt(b, side, moves, 2, {})
  for (let d = 4; d <= depth; d += 2) {
    const next = bestAt(b, side, moves, d, clock)
    if (clock.out) break
    best = next
    if (Math.abs(best.score) >= WIN - 100) break
  }
  return best.move
}
