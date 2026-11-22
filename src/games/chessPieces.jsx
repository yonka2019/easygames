// Chess piece set: simple flat shapes drawn for this site (100 x 100 box). `color` 0 = white, 1 = black.
// Fixed fills (not theme tokens), so both sides read on light and dark squares in both themes.

// Board squares (chess, checkers, the home demo). Mixed from theme tokens, mid-toned in both themes
// so light and dark pieces both stand out.
export const SQ_LIGHT = 'bg-[color-mix(in_oklab,var(--text)_16%,var(--surface))]'
export const SQ_DARK = 'bg-[color-mix(in_oklab,var(--accent)_34%,var(--surface))]'

const BASE = 'M24 83 Q24 76 31 76 H69 Q76 76 76 83 V89 H24 Z'

const SHAPES = {
  // pawn
  1: { paths: ['M42 45 Q50 49 58 45 Q58 61 68 76 H32 Q42 61 42 45 Z'], dots: [[50, 32, 12.5]] },
  // knight (faces left)
  2: { paths: ['M33 76 C33 61 46 57 48 45 L37 51 Q30 53 26 47 L39 27 L41 13 L52 22 C68 27 74 47 70 76 Z'], eye: [43, 33] },
  // bishop
  3: {
    paths: ['M50 18 C64 30 66 42 58 52 H42 C34 42 36 30 50 18 Z', 'M38 53 H62 V60 H38 Z', 'M42 60 H58 Q58 68 66 76 H34 Q42 68 42 60 Z'],
    dots: [[50, 13, 4.5]],
    lines: ['M55 29 L46 41'],
  },
  // rook
  4: { paths: ['M30 20 H40 V27 H46 V20 H54 V27 H60 V20 H70 V38 L64 44 V66 L70 76 H30 L36 66 V44 L30 38 Z'] },
  // queen
  5: {
    paths: ['M24 35 L34 66 H66 L76 35 L64 51 L58 27 L50 49 L42 27 L36 51 Z', 'M34 66 H66 L70 76 H30 Z'],
    dots: [[24, 31, 4.2], [42, 23, 4.2], [58, 23, 4.2], [76, 31, 4.2]],
  },
  // king
  6: {
    paths: ['M47 7 H53 V14 H60 V20 H53 V31 H47 V20 H40 V14 H47 Z', 'M30 45 C30 30 46 30 50 43 C54 30 70 30 70 45 L64 66 H36 Z', 'M36 66 H64 L70 76 H30 Z'],
  },
}

const LOOK = [
  { fill: '#f4f5f0', line: '#1b1d21' },
  { fill: '#17191c', line: '#eceee7' },
]

export const PIECE_NAME = ['', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king']

export function ChessPiece({ type, color = 0, className = '' }) {
  const shape = SHAPES[type]
  const { fill, line } = LOOK[color]
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={className} fill={fill} stroke={line} strokeWidth={color ? 3 : 3.5} strokeLinejoin="round" strokeLinecap="round">
      {shape.paths.map((d) => (
        <path key={d} d={d} />
      ))}
      {shape.dots?.map(([cx, cy, r]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
      ))}
      {shape.lines?.map((d) => (
        <path key={d} d={d} fill="none" />
      ))}
      {shape.eye && <circle cx={shape.eye[0]} cy={shape.eye[1]} r="2.4" fill={line} stroke="none" />}
      <path d={BASE} />
    </svg>
  )
}
