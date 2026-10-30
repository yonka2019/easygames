import { CLAUDE_ORANGE, CLAUDE_ROWS } from '../components/ClaudeFigure'

// Shared art for Claude run and its home preview: world size, sprites, draw helpers.
export { CLAUDE_ORANGE }
export const W = 600
export const H = 170
export const GROUND = 150
export const PX = 2 // sprite pixel size
export const DINO_X = 48
export const GRAVITY = 2400
export const JUMP = -600

// Claude: the 12×8 pixel figure (orange body, black eyes). Legs alternate while running; ducking squashes it.
export const CPX = 3.5 // Claude pixel size
const LEGS_A = ['..#.#..#.#..', '..#.#..#.#..']
const LEGS_B = ['..#.#..#.#..', '...#.#..#.#.']
export const STAND = CLAUDE_ROWS
export const RUN = [[...CLAUDE_ROWS.slice(0, 6), ...LEGS_A], [...CLAUDE_ROWS.slice(0, 6), ...LEGS_B]]
const DUCK_TOP = ['..########..', '..#o####o#..', '############', '..########..']
export const DUCK = [
  [...DUCK_TOP, '..#.#..#.#..'],
  [...DUCK_TOP, '...#.#..#.#.'],
]
export const STAND_W = 12 * CPX
export const STAND_H = STAND.length * CPX
export const DUCK_W = 12 * CPX
export const DUCK_H = DUCK[0].length * CPX

// '#' = current fill, 'o' = black (eyes / spots).
export function drawSprite(ctx, rows, x, y, px = PX) {
  const fill = ctx.fillStyle
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const ch = row[c]
      if (ch === '.') continue
      ctx.fillStyle = ch === 'o' ? '#000' : fill
      // +0.4 overlap hides hairline seams between pixels when the canvas is scaled.
      ctx.fillRect(x + c * px, y + r * px, px + 0.4, px + 0.4)
    }
  })
  ctx.fillStyle = fill
}

// Ground obstacles: cacti (single or groups).
export const CACTI = [
  { w: 14, h: 30 },
  { w: 20, h: 40 },
]
// Flying bugs: side-view fly, wings flap above / below the body.
export const FLY = [
  ['...##..##.....', '..####.####...', '...##..##.....', '.###########..', 'o###########..', '.###########..', '..#.#..#.#....'],
  ['..............', '..............', '.###########..', 'o###########..', '.###########..', '..####.####...', '...##..##.....'],
]
export const FLY_W = FLY[0][0].length * PX
export const FLY_H = FLY[0].length * PX

export function drawCactus(ctx, o) {
  for (let i = 0; i < o.count; i++) {
    const x = o.x + i * (o.unit + 4)
    const tw = Math.round(o.unit * 0.42)
    const tx = x + (o.unit - tw) / 2
    ctx.fillRect(tx, o.y, tw, o.h)
    const arm = Math.round(o.h * 0.35)
    ctx.fillRect(x, o.y + o.h * 0.3, 3, arm)
    ctx.fillRect(x, o.y + o.h * 0.3 + arm - 3, tx - x, 3)
    ctx.fillRect(x + o.unit - 3, o.y + o.h * 0.18, 3, arm)
    ctx.fillRect(tx + tw, o.y + o.h * 0.18 + arm - 3, x + o.unit - 3 - (tx + tw), 3)
  }
}

export function drawFly(ctx, o, t) {
  drawSprite(ctx, FLY[Math.floor(t * 10) % 2], o.x, o.y)
}
