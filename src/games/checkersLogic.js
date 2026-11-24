// Checkers: pure rules + PC search (no React; also runs in the board worker and in plain Node).
// Board = 64 cells, index = row * 8 + col, row 0 is the PC's back row. Dark squares only.
// 1 = player man (moves up), 2 = player king, -1 = PC man (moves down), -2 = PC king.
// A man that is crowned mid-jump stops. Rule switches (`rules`), all off by default:
//   force  = jumps are forced and a multi-jump must be finished (English rules). Off: jumping is
//            optional and a multi-jump may stop after any hop (every hop is its own move).
//   flying = kings slide any distance and jump from afar (land on any empty square beyond).
//   back   = men may also jump backwards.
//   most   = with force: only the chains that take the most pieces.

export const DEFAULT_RULES = { force: false, flying: false, back: false, most: false }
export const ENGLISH = { ...DEFAULT_RULES, force: true }

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

const isKing = (p) => p === 2 || p === -2
const forward = (p) => (p > 0 ? DIAG.slice(0, 2) : DIAG.slice(2))
const crowns = (p, row) => (p === 1 && row === 0) || (p === -1 && row === 7)

function jumpsFrom(b, from, sq, p, path, caps, out, rules) {
  const fly = isKing(p) && rules.flying
  const free = (i) => b[i] === 0 || i === from // the moving piece has left its square
  let found = false
  for (const [dr, dc] of isKing(p) || rules.back ? DIAG : forward(p)) {
    let r = (sq >> 3) + dr
    let c = (sq & 7) + dc
    if (fly) {
      while (inside(r, c) && free(r * 8 + c)) {
        r += dr
        c += dc
      }
    }
    if (!inside(r, c)) continue
    const mid = r * 8 + c
    if (b[mid] * p >= 0 || caps.includes(mid)) continue // needs an enemy piece not taken yet
    for (let r2 = r + dr, c2 = c + dc; inside(r2, c2) && free(r2 * 8 + c2); r2 += dr, c2 += dc) {
      const land = r2 * 8 + c2
      const next = { from, to: land, path: [...path, land], caps: [...caps, mid] }
      found = true
      if (!rules.force) out.push(next)
      if (crowns(p, r2)) {
        if (rules.force) out.push(next)
      } else jumpsFrom(b, from, land, p, next.path, next.caps, out, rules)
      if (!fly) break
    }
  }
  if (rules.force && !found && caps.length) out.push({ from, to: sq, path, caps })
}

// Legal moves for `side` (1 player, -1 PC): { from, to, path: squares landed on, caps: squares taken }.
export function checkersMoves(b, side, rules = DEFAULT_RULES) {
  let jumps = []
  for (let sq = 0; sq < 64; sq++) if (b[sq] * side > 0) jumpsFrom(b, sq, sq, b[sq], [], [], jumps, rules)
  if (rules.force && jumps.length) {
    if (rules.most) {
      const top = Math.max(...jumps.map((m) => m.caps.length))
      jumps = jumps.filter((m) => m.caps.length === top)
    }
    return jumps
  }
  const steps = []
  for (let sq = 0; sq < 64; sq++) {
    const p = b[sq]
    if (p * side <= 0) continue
    const fly = isKing(p) && rules.flying
    for (const [dr, dc] of isKing(p) ? DIAG : forward(p)) {
      for (let r = (sq >> 3) + dr, c = (sq & 7) + dc; inside(r, c) && !b[r * 8 + c]; r += dr, c += dc) {
        steps.push({ from: sq, to: r * 8 + c, path: [r * 8 + c], caps: [] })
        if (!fly) break
      }
    }
  }
  return jumps.length ? [...jumps, ...steps] : steps // jumps first: better pruning
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

function search(b, side, depth, alpha, beta, ply, clock, rules) {
  if (clock.end && ++clock.nodes % 1024 === 0 && Date.now() > clock.end) clock.out = true
  if (clock.out) return 0
  const moves = checkersMoves(b, side, rules)
  if (!moves.length) return -WIN + ply
  let list = moves
  let best = -Infinity
  // Out of depth: stop on a quiet position. Forced jumps are always played out; optional ones are
  // searched against the score of not jumping (stand pat).
  if (depth <= 0) {
    if (!moves[0].caps.length || ply > 40) return evaluate(b, side)
    if (!rules.force) {
      best = evaluate(b, side)
      if (best >= beta) return best
      if (best > alpha) alpha = best
      list = moves.filter((m) => m.caps.length)
    }
  }
  for (const m of list) {
    const score = -search(checkersApply(b, m), -side, depth - 1, -beta, -alpha, ply + 1, clock, rules)
    if (score > best) best = score
    if (best > alpha) alpha = best
    if (alpha >= beta) break
  }
  return best
}

function bestAt(b, side, moves, depth, clock, rules) {
  let best = { move: moves[0], score: -Infinity }
  for (const m of moves) {
    const score = -search(checkersApply(b, m), -side, depth - 1, -Infinity, -best.score, 1, clock, rules)
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
export function checkersBest(b, level = 'normal', side = -1, rules = DEFAULT_RULES) {
  const moves = checkersMoves(b, side, rules)
  if (!moves.length) return null
  if (moves.length === 1) return moves[0]
  for (let i = moves.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[moves[i], moves[j]] = [moves[j], moves[i]]
  }
  const { depth, slip, ms } = LEVEL[level] ?? LEVEL.normal
  if (slip && Math.random() < slip) return moves[0]
  moves.sort((x, y) => y.caps.length - x.caps.length) // stable: random order within equal captures
  if (!ms) return bestAt(b, side, moves, depth, {}, rules).move
  const clock = { end: Date.now() + ms, nodes: 0, out: false }
  let best = bestAt(b, side, moves, 2, {}, rules)
  for (let d = 4; d <= depth; d += 2) {
    const next = bestAt(b, side, moves, d, clock, rules)
    if (clock.out) break
    best = next
    if (Math.abs(best.score) >= WIN - 100) break
  }
  return best.move
}
