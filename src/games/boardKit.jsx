import { useCallback, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { useGame } from '../components/GameFrame'
import { Button, Segmented } from '../components/ui'

// Shared bits for the board games (Chess, Checkers, Four in a row): level picker, PC worker, grid keys.

export const LEVELS = [
  { value: 'easy', label: 'Easy' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Hard' },
]

export { SQ_DARK, SQ_LIGHT } from './chessPieces'

// Asks the board worker for the PC's move: think(state, level) -> Promise<move>. Only the latest question resolves.
export function usePc(game) {
  const worker = useRef(null)
  const ask = useRef({ id: 0, done: null })
  useEffect(() => {
    const w = new Worker(new URL('./boardWorker.js', import.meta.url), { type: 'module' })
    w.onmessage = (e) => {
      if (e.data.id === ask.current.id) ask.current.done?.(e.data.move)
    }
    worker.current = w
    return () => w.terminate()
  }, [])
  return useCallback(
    (state, level) =>
      new Promise((resolve) => {
        ask.current = { id: ask.current.id + 1, done: resolve }
        worker.current.postMessage({ id: ask.current.id, game, state, level })
      }),
    [game],
  )
}

// While `active`, gets the PC's move for `state` and hands it to `onMove` (never sooner than `minMs`,
// so a fast answer still reads as a turn). A change of state or a new game drops the old answer.
export function usePcTurn(active, think, state, level, onMove, minMs = 600) {
  const reduce = useReducedMotion()
  const done = useRef(onMove)
  done.current = onMove
  useEffect(() => {
    if (!active) return
    let live = true
    let timer
    const t0 = performance.now()
    think(state, level).then((move) => {
      if (!live) return
      timer = setTimeout(() => live && done.current(move), Math.max(0, (reduce ? 200 : minMs) - (performance.now() - t0)))
    })
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [active, think, state, level, reduce, minMs])
}

// Top row of a board game: level picker (locked mid-game), move count, new game.
export function BoardBar({ locked, moves, onNew }) {
  const { variant, setVariant } = useGame()
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className={`transition-opacity duration-200 ${locked ? 'pointer-events-none opacity-50' : ''}`}>
        <Segmented label="Level" options={LEVELS} value={variant} onChange={(v) => !locked && setVariant(v)} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted">
          Moves <span className="num ml-1 inline-block min-w-[2ch] text-ink">{moves}</span>
        </span>
        <Button variant="ghost" onClick={onNew}>
          New game
        </Button>
      </div>
    </div>
  )
}

// Roving tabindex over a grid of `[data-i]` cells: one Tab stop, arrows move, Home/End = row edge.
export function useGridNav(cols, count, start = 0) {
  const [cur, setCur] = useState(start)
  const [keys, setKeys] = useState(false) // a cell holds keyboard focus (not a mouse click)
  const onKeyDown = (e) => {
    const i = Number(e.target.dataset?.i)
    if (Number.isNaN(i)) return
    const r = Math.floor(i / cols)
    const c = i % cols
    const n = {
      ArrowUp: r > 0 ? i - cols : i,
      ArrowDown: i + cols < count ? i + cols : i,
      ArrowLeft: c > 0 ? i - 1 : i,
      ArrowRight: c < cols - 1 ? i + 1 : i,
      Home: r * cols,
      End: r * cols + cols - 1,
    }[e.key]
    if (n === undefined) return
    e.preventDefault()
    setCur(n)
    e.currentTarget.querySelector(`[data-i="${n}"]`)?.focus()
  }
  // Props for cell `i`. The native outline is off: neighbours and the piece layer paint over it; FocusRing replaces it.
  const cell = (i) => ({
    'data-i': i,
    tabIndex: i === cur ? 0 : -1,
    style: { outline: 'none' },
    onFocus: (e) => {
      setCur(i)
      setKeys(e.target.matches(':focus-visible'))
    },
    onBlur: () => setKeys(false),
  })
  return { cur, setCur, onKeyDown, cell, ring: keys ? cur : -1 }
}

// Keyboard focus marker for an 8-column board, drawn above the pieces. `at` = cell index, or -1 when hidden.
export function FocusRing({ at }) {
  const last = useRef(0)
  if (at >= 0) last.current = at
  return (
    <span
      data-focus-ring
      aria-hidden="true"
      className={`pointer-events-none absolute left-0 top-0 z-20 h-[12.5%] w-[12.5%] shadow-[inset_0_0_0_2px_var(--text),inset_0_0_0_4px_var(--bg)] transition-opacity duration-150 ${at >= 0 ? 'opacity-100' : 'opacity-0'}`}
      style={{ translate: `${(last.current & 7) * 100}% ${(last.current >> 3) * 100}%` }}
    />
  )
}
