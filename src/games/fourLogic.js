// Four in a row: pure rules + PC search (no React; also runs in the board worker and in plain Node).
// Board = 42 cells, index = row * 7 + col, row 0 is the bottom. 0 empty, 1 player, 2 PC.

export const COLS = 7
export const ROWS = 6
const at = (r, c) => r * COLS + c

// Every line of four on the board.
const LINES = []
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const r3 = r + dr * 3
      const c3 = c + dc * 3
      if (r3 < ROWS && c3 >= 0 && c3 < COLS) LINES.push([0, 1, 2, 3].map((k) => at(r + dr * k, c + dc * k)))
    }
  }
}

export const fourNew = () => Array(ROWS * COLS).fill(0)

// Row a disc lands on in `col`, or -1 when the column is full.
export function fourRow(cells, col) {
  for (let r = 0; r < ROWS; r++) if (!cells[at(r, col)]) return r
  return -1
}

export function fourDrop(cells, col, who) {
  const row = fourRow(cells, col)
  if (row < 0) return null
  const next = [...cells]
  next[at(row, col)] = who
  return { cells: next, row, index: at(row, col) }
}

export function fourWin(cells) {
  for (const line of LINES) {
    const who = cells[line[0]]
    if (who && cells[line[1]] === who && cells[line[2]] === who && cells[line[3]] === who) return { who, line }
  }
  return null
}

export const fourFull = (cells) => cells.every(Boolean)

/* ---------- PC ---------- */

const ORDER = [3, 2, 4, 1, 5, 0, 6] // center first: better pruning, better play
const WIN = 100000

function evaluate(cells, me) {
  const them = 3 - me
  let score = 0
  for (const line of LINES) {
    let mine = 0
    let theirs = 0
    for (const i of line) {
      if (cells[i] === me) mine++
      else if (cells[i] === them) theirs++
    }
    if (mine && theirs) continue
    if (mine) score += mine === 3 ? 50 : mine === 2 ? 8 : 1
    else if (theirs) score -= theirs === 3 ? 50 : theirs === 2 ? 8 : 1
  }
  for (let r = 0; r < ROWS; r++) {
    if (cells[at(r, 3)] === me) score += 4
    else if (cells[at(r, 3)] === them) score -= 4
  }
  return score
}

function wonAt(cells, i, who) {
  const r0 = Math.floor(i / COLS)
  const c0 = i % COLS
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    let n = 1
    for (const dir of [1, -1]) {
      let r = r0 + dr * dir
      let c = c0 + dc * dir
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && cells[at(r, c)] === who) {
        n++
        r += dr * dir
        c += dc * dir
      }
    }
    if (n >= 4) return true
  }
  return false
}

// Negamax with alpha-beta on a board it mutates and restores.
function search(cells, who, depth, alpha, beta, ply, clock) {
  if (clock.end && ++clock.nodes % 2048 === 0 && Date.now() > clock.end) clock.out = true
  if (clock.out) return 0
  let best = -Infinity
  let moved = false
  for (const col of ORDER) {
    const row = fourRow(cells, col)
    if (row < 0) continue
    moved = true
    const i = at(row, col)
    cells[i] = who
    let score
    if (wonAt(cells, i, who)) score = WIN - ply
    else if (depth <= 1) score = evaluate(cells, who)
    else score = -search(cells, 3 - who, depth - 1, -beta, -alpha, ply + 1, clock)
    cells[i] = 0
    if (score > best) best = score
    if (best > alpha) alpha = best
    if (alpha >= beta) break
  }
  return moved ? best : 0
}

function bestAt(cells, who, depth, clock) {
  let best = { col: -1, score: -Infinity }
  // Shuffle equal columns a little so games differ: start from a random rotation of the two center-most ties.
  const order = Math.random() < 0.5 ? ORDER : [3, 4, 2, 5, 1, 6, 0]
  for (const col of order) {
    const row = fourRow(cells, col)
    if (row < 0) continue
    const i = at(row, col)
    cells[i] = who
    const score = wonAt(cells, i, who) ? WIN : depth <= 1 ? evaluate(cells, who) : -search(cells, 3 - who, depth - 1, -Infinity, -best.score, 1, clock)
    cells[i] = 0
    if (clock.out) break
    if (score > best.score) best = { col, score }
  }
  return best
}

const LEVEL = {
  easy: { depth: 2, slip: 0.3 },
  normal: { depth: 4, slip: 0 },
  hard: { depth: 12, slip: 0, ms: 700 },
}

// Column the PC plays. Easy sometimes plays a random column (never when a four is one move away).
export function fourBest(cells0, level = 'normal', who = 2) {
  const cells = [...cells0]
  const open = ORDER.filter((c) => fourRow(cells, c) >= 0)
  if (!open.length) return -1
  const { depth, slip, ms } = LEVEL[level] ?? LEVEL.normal
  if (slip) {
    // A slip never skips a win, and never ignores a four the player is about to finish.
    const urgent = bestAt(cells, who, 1, {}).score >= WIN || bestAt(cells, 3 - who, 1, {}).score >= WIN
    if (!urgent && Math.random() < slip) return open[Math.floor(Math.random() * open.length)]
  }
  if (!ms) return bestAt(cells, who, depth, {}).col
  // Hard: deepen until the time is up, keep the last finished depth.
  const clock = { end: Date.now() + ms, nodes: 0, out: false }
  let best = bestAt(cells, who, 2, {})
  for (let d = 4; d <= depth; d += 2) {
    const next = bestAt(cells, who, d, clock)
    if (clock.out) break
    best = next
    if (Math.abs(best.score) >= WIN - 50) break
  }
  return best.col
}
