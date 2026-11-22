// Chess: pure rules + PC search (no React; also runs in the board worker and in plain Node).
// Board = 64 squares, index = row * 8 + col, row 0 is rank 8 (a8 = 0, h1 = 63). White moves up (index - 8).
// Piece = type (1 pawn, 2 knight, 3 bishop, 4 rook, 5 queen, 6 king), + 8 for black. 0 = empty.
// State = { b, turn (0 white, 1 black), castle (bits: 1 K, 2 Q, 4 k, 8 q), ep (square or -1), half, full, king: [sq, sq] }.
// Move = { from, to, piece, cap (piece taken or 0), promo (type or 0), flag }.

export const PAWN = 1
export const KNIGHT = 2
export const BISHOP = 3
export const ROOK = 4
export const QUEEN = 5
export const KING = 6
export const WHITE = 0
export const BLACK = 1

const EP = 1
const CASTLE_K = 2
const CASTLE_Q = 3
const DOUBLE = 4
export const FLAG = { EP, CASTLE_K, CASTLE_Q, DOUBLE }

export const typeOf = (p) => p & 7
export const colorOf = (p) => p >> 3
export const sqName = (i) => 'abcdefgh'[i & 7] + (8 - (i >> 3))

const KNIGHT_STEPS = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]
const KING_STEPS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]
const DIAGONAL = [[-1, -1], [-1, 1], [1, -1], [1, 1]]
const STRAIGHT = [[-1, 0], [1, 0], [0, -1], [0, 1]]

// Castling rights lost when a piece leaves or lands on a king or rook home square.
const RIGHTS = Array(64).fill(15)
RIGHTS[60] = 12
RIGHTS[63] = 14
RIGHTS[56] = 13
RIGHTS[4] = 3
RIGHTS[7] = 11
RIGHTS[0] = 7

const FEN_PIECE = { p: PAWN, n: KNIGHT, b: BISHOP, r: ROOK, q: QUEEN, k: KING }
export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export function chessFromFen(fen) {
  const [rows, turn = 'w', rights = '-', ep = '-', half = '0', full = '1'] = fen.trim().split(/\s+/)
  const b = Array(64).fill(0)
  const king = [-1, -1]
  let sq = 0
  for (const ch of rows) {
    if (ch === '/') continue
    if (ch >= '1' && ch <= '8') {
      sq += Number(ch)
      continue
    }
    const type = FEN_PIECE[ch.toLowerCase()]
    const color = ch === ch.toLowerCase() ? BLACK : WHITE
    b[sq] = type | (color << 3)
    if (type === KING) king[color] = sq
    sq++
  }
  let castle = 0
  if (rights.includes('K')) castle |= 1
  if (rights.includes('Q')) castle |= 2
  if (rights.includes('k')) castle |= 4
  if (rights.includes('q')) castle |= 8
  return {
    b,
    turn: turn === 'w' ? WHITE : BLACK,
    castle,
    ep: ep === '-' ? -1 : 'abcdefgh'.indexOf(ep[0]) + (8 - Number(ep[1])) * 8,
    half: Number(half),
    full: Number(full),
    king,
  }
}

export const chessStart = () => chessFromFen(START_FEN)
const clone = (s) => ({ ...s, b: [...s.b], king: [...s.king] })

// Is `sq` attacked by a piece of color `by`?
export function attacked(b, sq, by) {
  const r = sq >> 3
  const c = sq & 7
  const tint = by << 3
  // Pawns: a white pawn attacks up the board, so it sits one row below the square.
  const pr = by === WHITE ? r + 1 : r - 1
  if (pr >= 0 && pr < 8) {
    if (c > 0 && b[pr * 8 + c - 1] === (PAWN | tint)) return true
    if (c < 7 && b[pr * 8 + c + 1] === (PAWN | tint)) return true
  }
  for (const [dr, dc] of KNIGHT_STEPS) {
    const r2 = r + dr
    const c2 = c + dc
    if (r2 >= 0 && r2 < 8 && c2 >= 0 && c2 < 8 && b[r2 * 8 + c2] === (KNIGHT | tint)) return true
  }
  for (const [dr, dc] of KING_STEPS) {
    const r2 = r + dr
    const c2 = c + dc
    if (r2 >= 0 && r2 < 8 && c2 >= 0 && c2 < 8 && b[r2 * 8 + c2] === (KING | tint)) return true
  }
  for (let d = 0; d < 8; d++) {
    const [dr, dc] = d < 4 ? DIAGONAL[d] : STRAIGHT[d - 4]
    const slider = d < 4 ? BISHOP : ROOK
    let r2 = r + dr
    let c2 = c + dc
    while (r2 >= 0 && r2 < 8 && c2 >= 0 && c2 < 8) {
      const p = b[r2 * 8 + c2]
      if (p) {
        if (p >> 3 === by && ((p & 7) === slider || (p & 7) === QUEEN)) return true
        break
      }
      r2 += dr
      c2 += dc
    }
  }
  return false
}

// Pseudo-legal moves (the king may still be left in check). `loud` = captures and promotions only.
function pseudo(s, loud = false) {
  const { b, turn: us } = s
  const them = us ^ 1
  const moves = []
  const add = (from, to, piece, flag = 0, promo = 0) => moves.push({ from, to, piece, cap: flag === EP ? PAWN | (them << 3) : b[to], promo, flag })
  for (let from = 0; from < 64; from++) {
    const piece = b[from]
    if (!piece || piece >> 3 !== us) continue
    const type = piece & 7
    const r = from >> 3
    const c = from & 7
    if (type === PAWN) {
      const dir = us === WHITE ? -1 : 1
      const r1 = r + dir
      const last = r1 === (us === WHITE ? 0 : 7)
      const push = (to, flag = 0) => {
        if (last) for (const promo of [QUEEN, KNIGHT, ROOK, BISHOP]) add(from, to, piece, 0, promo)
        else add(from, to, piece, flag)
      }
      const one = r1 * 8 + c
      if (!b[one]) {
        if (!loud || last) push(one)
        const two = one + dir * 8
        if (!loud && r === (us === WHITE ? 6 : 1) && !b[two]) add(from, two, piece, DOUBLE)
      }
      for (const dc of [-1, 1]) {
        const c1 = c + dc
        if (c1 < 0 || c1 > 7) continue
        const to = r1 * 8 + c1
        if (b[to] && b[to] >> 3 === them) push(to)
        else if (to === s.ep) add(from, to, piece, EP)
      }
    } else if (type === KNIGHT || type === KING) {
      for (const [dr, dc] of type === KNIGHT ? KNIGHT_STEPS : KING_STEPS) {
        const r2 = r + dr
        const c2 = c + dc
        if (r2 < 0 || r2 > 7 || c2 < 0 || c2 > 7) continue
        const to = r2 * 8 + c2
        if (b[to] ? b[to] >> 3 === them : !loud) add(from, to, piece)
      }
    } else {
      for (let d = 0; d < 8; d++) {
        if (type === BISHOP && d > 3) break
        if (type === ROOK && d < 4) continue
        const [dr, dc] = d < 4 ? DIAGONAL[d] : STRAIGHT[d - 4]
        let r2 = r + dr
        let c2 = c + dc
        while (r2 >= 0 && r2 < 8 && c2 >= 0 && c2 < 8) {
          const to = r2 * 8 + c2
          if (b[to]) {
            if (b[to] >> 3 === them) add(from, to, piece)
            break
          }
          if (!loud) add(from, to, piece)
          r2 += dr
          c2 += dc
        }
      }
    }
  }
  if (!loud) {
    // Castling: rights, empty squares between, and the king never on or through an attacked square.
    const home = us === WHITE ? 60 : 4
    const bits = us === WHITE ? s.castle & 3 : (s.castle >> 2) & 3
    if (bits && b[home] === (KING | (us << 3)) && !attacked(b, home, them)) {
      const rook = ROOK | (us << 3)
      if (bits & 1 && !b[home + 1] && !b[home + 2] && b[home + 3] === rook && !attacked(b, home + 1, them) && !attacked(b, home + 2, them)) {
        add(home, home + 2, b[home], CASTLE_K)
      }
      if (bits & 2 && !b[home - 1] && !b[home - 2] && !b[home - 3] && b[home - 4] === rook && !attacked(b, home - 1, them) && !attacked(b, home - 2, them)) {
        add(home, home - 2, b[home], CASTLE_Q)
      }
    }
  }
  return moves
}

function make(s, m) {
  const { b } = s
  const us = s.turn
  const undo = { castle: s.castle, ep: s.ep, half: s.half }
  b[m.from] = 0
  b[m.to] = m.promo ? m.promo | (us << 3) : m.piece
  if (m.flag === EP) b[m.to + (us === WHITE ? 8 : -8)] = 0
  else if (m.flag === CASTLE_K) {
    b[m.to + 1] = 0
    b[m.to - 1] = ROOK | (us << 3)
  } else if (m.flag === CASTLE_Q) {
    b[m.to - 2] = 0
    b[m.to + 1] = ROOK | (us << 3)
  }
  if ((m.piece & 7) === KING) s.king[us] = m.to
  s.castle &= RIGHTS[m.from] & RIGHTS[m.to]
  s.ep = m.flag === DOUBLE ? (m.from + m.to) >> 1 : -1
  s.half = (m.piece & 7) === PAWN || m.cap ? 0 : s.half + 1
  if (us === BLACK) s.full++
  s.turn = us ^ 1
  return undo
}

function unmake(s, m, undo) {
  const { b } = s
  const us = s.turn ^ 1
  s.turn = us
  if (us === BLACK) s.full--
  s.castle = undo.castle
  s.ep = undo.ep
  s.half = undo.half
  b[m.from] = m.piece
  if (m.flag === EP) {
    b[m.to] = 0
    b[m.to + (us === WHITE ? 8 : -8)] = m.cap
  } else b[m.to] = m.cap
  if (m.flag === CASTLE_K) {
    b[m.to + 1] = ROOK | (us << 3)
    b[m.to - 1] = 0
  } else if (m.flag === CASTLE_Q) {
    b[m.to - 2] = ROOK | (us << 3)
    b[m.to + 1] = 0
  }
  if ((m.piece & 7) === KING) s.king[us] = m.from
}

function legal(s) {
  const us = s.turn
  return pseudo(s).filter((m) => {
    const undo = make(s, m)
    const ok = !attacked(s.b, s.king[us], us ^ 1)
    unmake(s, m, undo)
    return ok
  })
}

// Legal moves of the side to move.
export const chessMoves = (s) => legal(clone(s))

export function chessApply(s, m) {
  const next = clone(s)
  make(next, m)
  return next
}

export const chessInCheck = (s) => attacked(s.b, s.king[s.turn], s.turn ^ 1)

// Same key = same position for the threefold rule (pieces, side to move, castling, en passant).
export const chessKey = (s) => `${s.b.join('')}|${s.turn}|${s.castle}|${s.ep}`

function bareMaterial(b) {
  const rest = []
  for (let sq = 0; sq < 64; sq++) if (b[sq] && (b[sq] & 7) !== KING) rest.push(sq)
  if (!rest.length) return true
  const minor = (sq) => (b[sq] & 7) === KNIGHT || (b[sq] & 7) === BISHOP
  if (rest.length === 1) return minor(rest[0])
  if (rest.length === 2) {
    const [x, y] = rest
    const shade = (sq) => ((sq >> 3) + (sq & 7)) % 2
    return (b[x] & 7) === BISHOP && (b[y] & 7) === BISHOP && b[x] >> 3 !== b[y] >> 3 && shade(x) === shade(y)
  }
  return false
}

// `keys` = chessKey of every position so far (this one included).
// over: null | 'mate' (side to move lost) | 'stalemate' | 'fifty' | 'repeat' | 'material'.
export function chessStatus(s, keys = []) {
  const check = chessInCheck(s)
  if (!chessMoves(s).length) return { check, over: check ? 'mate' : 'stalemate' }
  if (s.half >= 100) return { check, over: 'fifty' }
  if (bareMaterial(s.b)) return { check, over: 'material' }
  const key = chessKey(s)
  if (keys.filter((k) => k === key).length >= 3) return { check, over: 'repeat' }
  return { check, over: null }
}

export function perft(s0, depth) {
  const s = clone(s0)
  const walk = (d) => {
    const us = s.turn
    let n = 0
    for (const m of pseudo(s)) {
      const undo = make(s, m)
      if (!attacked(s.b, s.king[us], us ^ 1)) n += d === 1 ? 1 : walk(d - 1)
      unmake(s, m, undo)
    }
    return n
  }
  return depth ? walk(depth) : 1
}

/* ---------- PC ---------- */

const VALUE = [0, 100, 320, 330, 500, 900, 0]
const MATE = 1000000

// Piece-square tables from White's side (index 0 = a8); Black reads them mirrored.
const PST = [
  null,
  [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
]
const KING_END = [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50]

// Score for the side to move.
function evaluate(s) {
  const { b } = s
  let score = 0
  let heavy = 0
  for (let sq = 0; sq < 64; sq++) {
    const p = b[sq]
    if (!p) continue
    const type = p & 7
    if (type !== PAWN && type !== KING) heavy += VALUE[type]
    if (type === KING) continue
    const v = VALUE[type] + PST[type][p >> 3 ? sq ^ 56 : sq]
    score += p >> 3 ? -v : v
  }
  const kings = heavy <= 2600 ? KING_END : PST[KING]
  score += kings[s.king[WHITE]] - kings[s.king[BLACK] ^ 56]
  return s.turn === WHITE ? score : -score
}

// Captures first (biggest victim, smallest attacker), then promotions; `first` = best move of the last pass.
function sort(moves, first) {
  for (const m of moves) {
    m.order = (m.cap ? 1000 + VALUE[m.cap & 7] * 10 - VALUE[m.piece & 7] : 0) + (m.promo ? 900 : 0)
    if (first && m.from === first.from && m.to === first.to && m.promo === first.promo) m.order = 1e9
  }
  return moves.sort((x, y) => y.order - x.order)
}

function quiet(s, alpha, beta, depth) {
  const stand = evaluate(s)
  if (stand >= beta || depth >= 6) return stand
  if (stand > alpha) alpha = stand
  const us = s.turn
  let best = stand
  for (const m of sort(pseudo(s, true))) {
    const undo = make(s, m)
    if (attacked(s.b, s.king[us], us ^ 1)) {
      unmake(s, m, undo)
      continue
    }
    const score = -quiet(s, -beta, -alpha, depth + 1)
    unmake(s, m, undo)
    if (score > best) best = score
    if (best > alpha) alpha = best
    if (alpha >= beta) break
  }
  return best
}

function search(s, depth, alpha, beta, ply, clock) {
  if (clock.end && (++clock.nodes & 1023) === 0 && Date.now() > clock.end) clock.out = true
  if (clock.out) return 0
  if (s.half >= 100) return 0
  const us = s.turn
  const check = attacked(s.b, s.king[us], us ^ 1)
  if (check && depth < 1 && ply < 40) depth = 1 // never stand pat while in check
  if (depth <= 0) return clock.loud ? quiet(s, alpha, beta, 0) : evaluate(s)
  let best = -Infinity
  let any = false
  for (const m of sort(pseudo(s))) {
    const undo = make(s, m)
    if (attacked(s.b, s.king[us], us ^ 1)) {
      unmake(s, m, undo)
      continue
    }
    any = true
    const score = -search(s, depth - 1, -beta, -alpha, ply + 1, clock)
    unmake(s, m, undo)
    if (score > best) best = score
    if (best > alpha) alpha = best
    if (alpha >= beta) break
  }
  if (!any) return check ? -MATE + ply : 0
  return best
}

function bestAt(s, moves, depth, clock, first) {
  let best = { move: null, score: -Infinity }
  for (const m of sort(moves, first)) {
    const undo = make(s, m)
    const score = -search(s, depth - 1, -Infinity, -best.score, 1, clock)
    unmake(s, m, undo)
    if (clock.out) break
    if (score > best.score) best = { move: m, score }
  }
  return best
}

const LEVEL = {
  easy: { depth: 1, slip: 0.2, loud: false },
  normal: { depth: 3, slip: 0, loud: true },
  hard: { depth: 8, slip: 0, loud: true, ms: 1200 },
}

// Move the PC plays for the side to move, or null when it has none.
// Easy looks one move ahead and sometimes plays a random legal move.
export function chessBest(s0, level = 'normal') {
  const s = clone(s0)
  const moves = legal(s)
  if (!moves.length) return null
  for (let i = moves.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[moves[i], moves[j]] = [moves[j], moves[i]]
  }
  const { depth, slip, loud, ms } = LEVEL[level] ?? LEVEL.normal
  const strip = ({ order, ...m }) => m
  if (slip && Math.random() < slip) return strip(moves[0])
  if (!ms) return strip(bestAt(s, moves, depth, { loud }).move)
  // Hard: deepen until the time is up, keep the last finished depth.
  const clock = { end: Date.now() + ms, nodes: 0, out: false, loud }
  let best = bestAt(s, moves, 2, { loud })
  for (let d = 3; d <= depth; d++) {
    const next = bestAt(s, moves, d, clock, best.move)
    if (clock.out) break
    best = next
    if (Math.abs(best.score) >= MATE - 100) break
  }
  return strip(best.move)
}
