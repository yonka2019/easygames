import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { useGame } from '../components/GameFrame'
import { Kbd, Swap, useEnter } from '../components/ui'
import { BoardBar, usePc, usePcTurn } from './boardKit'
import { COLS, ROWS, fourDrop, fourFull, fourNew, fourRow, fourWin } from './fourLogic'

// Four in a row vs the PC. You move first; four in a line wins. Score = your discs when you win (fewer is better).

const fresh = () => ({ cells: fourNew(), turn: 1, moves: 0, over: null, last: -1 })
const COL_LIST = Array.from({ length: COLS }, (_, c) => c)
const ROW_LIST = Array.from({ length: ROWS }, (_, r) => r)

export default function Four() {
  const { report, ended, variant } = useGame()
  const think = usePc('four')
  const [g, setG] = useState(fresh)
  const live = useRef(g) // the game right now: two keys in one tick must not both read the same old board
  const [game, setGame] = useState(0)
  const [isNew, setIsNew] = useState(false)

  const drop = (col, who) => {
    const g = live.current
    if (g.over || g.turn !== who) return
    const d = fourDrop(g.cells, col, who)
    if (!d) return
    const moves = g.moves + (who === 1 ? 1 : 0)
    const win = fourWin(d.cells)
    const over = win ?? (fourFull(d.cells) ? { who: 0, line: [] } : null)
    if (over?.who === 1) setIsNew(report(moves).isNew)
    else if (over) ended()
    live.current = { cells: d.cells, turn: 3 - who, moves, over, last: d.index }
    setG(live.current)
  }

  usePcTurn(g.turn === 2 && !g.over, think, g.cells, variant, (col) => drop(col, 2))

  const newGame = useCallback(() => {
    live.current = fresh()
    setG(live.current)
    setIsNew(false)
    setGame((n) => n + 1)
  }, [])
  useEnter(newGame, !!g.over)

  // Keys 1-7 drop a disc.
  const play = useRef(null)
  play.current = (col) => drop(col, 1)
  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea')) return
      if (e.key >= '1' && e.key <= String(COLS)) play.current(Number(e.key) - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const mine = g.turn === 1 && !g.over

  let say = <span className="text-muted">Your turn.</span>
  if (g.over?.who === 1) {
    say = (
      <span className="text-accent">
        You win in {g.moves} moves.{isNew && ' New best.'}
      </span>
    )
  } else if (g.over?.who === 2) say = <span className="text-danger">PC wins.</span>
  else if (g.over) say = <span className="text-ink">Draw.</span>
  else if (g.turn === 2) say = <span className="text-muted">PC is thinking…</span>

  return (
    <div className="mx-auto max-w-[520px]">
      <BoardBar locked={g.moves > 0 && !g.over} moves={g.moves} onNew={newGame} />
      <Swap k={game}>
        <div className="grid grid-cols-7 gap-1 overflow-hidden rounded-xl border border-line bg-surface p-2 sm:gap-1.5 sm:p-3">
          {COL_LIST.map((c) => {
            const land = fourRow(g.cells, c)
            return (
              <button
                key={c}
                type="button"
                onClick={() => drop(c, 1)}
                disabled={!mine || land < 0}
                aria-label={`Column ${c + 1}`}
                className="group flex flex-col-reverse gap-1 rounded-lg transition-colors duration-200 enabled:hover:bg-accent/10 sm:gap-1.5"
              >
                {ROW_LIST.map((r) => {
                  const i = r * COLS + c
                  const who = g.cells[i]
                  const won = g.over?.line.includes(i)
                  return (
                    <span key={r} className="relative block aspect-square rounded-full bg-bg shadow-[inset_0_0_0_1px_var(--line)]">
                      {who ? (
                        <motion.span
                          initial={{ y: `-${(ROWS - r) * 112}%` }}
                          animate={{ y: '0%' }}
                          transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                          className={`absolute inset-[6%] grid place-items-center rounded-full transition-opacity duration-300 ${who === 1 ? 'bg-accent' : 'bg-danger'} ${g.over?.who && !won ? 'opacity-35' : ''}`}
                        >
                          <span className={`size-1/4 rounded-full bg-bg transition-opacity duration-200 ${won || (g.last === i && !g.over) ? 'opacity-80' : 'opacity-0'}`} />
                        </motion.span>
                      ) : (
                        r === land && <span className="absolute inset-[6%] rounded-full bg-accent opacity-0 transition-opacity duration-200 group-enabled:group-hover:opacity-25" />
                      )}
                    </span>
                  )
                })}
              </button>
            )
          })}
        </div>
      </Swap>

      <div className="mt-4 h-7 text-center">
        <Swap k={g.over ? `over-${game}` : `${game}-${g.turn}`}>{say}</Swap>
      </div>

      <p className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm text-muted">
        <Kbd>1</Kbd>–<Kbd>7</Kbd> drop a disc. Four in a line wins.{g.over && ' Enter = new game.'}
      </p>
    </div>
  )
}
