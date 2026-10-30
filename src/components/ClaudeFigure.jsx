// The Claude run character as an SVG (same 12×8 grid as the canvas sprite). Works as a registry icon.
export const CLAUDE_ORANGE = '#d97757'
export const CLAUDE_ROWS = [
  '..########..',
  '..#o####o#..',
  '############',
  '############',
  '..########..',
  '..########..',
  '..#.#..#.#..',
  '..#.#..#.#..',
]

export function ClaudeFigure({ size = 24, className = '' }) {
  const cells = []
  CLAUDE_ROWS.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch !== '.') cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1.02" height="1.02" fill={ch === 'o' ? '#000' : CLAUDE_ORANGE} />)
    }),
  )
  return (
    <svg viewBox="0 -2 12 12" width={size} height={size} className={className} aria-hidden="true" shapeRendering="crispEdges">
      {cells}
    </svg>
  )
}
