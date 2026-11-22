import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { ArrowDownIcon, ArrowUpIcon } from '@phosphor-icons/react'
import { useGame } from '../components/GameFrame'
import { Button, EASE, Kbd, Result, Swap } from '../components/ui'
import { PlayingCard } from './cards'
import { hiloValue, newDeck, rankLabel } from './cardLogic'

// Higher or lower: guess the next card. Ace is high, the same rank is safe (no point). One miss ends the run.

function start() {
  const deck = newDeck()
  return { card: deck.pop(), deck, next: null, out: null, streak: 0, turn: 0 }
}

const SAY = {
  hit: <span className="text-accent">Right. +1</span>,
  same: <span className="text-ink">Same rank. Safe.</span>,
  miss: <span className="text-danger">Wrong.</span>,
}

export default function HiLo() {
  const { report, ended } = useGame()
  const reduce = useReducedMotion()
  const [g, setG] = useState(start)
  const [run, setRun] = useState(0)
  const [result, setResult] = useState(null)
  const lock = useRef(false) // a guess is being shown
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  const guess = useCallback(
    (up) => {
      if (lock.current || result) return
      lock.current = true
      // Deck ran out: shuffle a new one (without the card on the table).
      const deck = g.deck.length ? [...g.deck] : newDeck().filter((c) => c.id !== g.card.id)
      const next = deck.pop()
      const diff = hiloValue(next) - hiloValue(g.card)
      const out = diff === 0 ? 'same' : diff > 0 === up ? 'hit' : 'miss'
      const streak = g.streak + (out === 'hit' ? 1 : 0)
      setG({ ...g, deck, next, out, streak })
      timer.current = setTimeout(
        () => {
          lock.current = false
          if (out === 'miss') {
            // A miss on the first guess = no score to save.
            const isNew = streak ? report(streak).isNew : (ended(), false)
            setResult({ streak, from: g.card, to: next, seen: g.turn + 2, isNew })
          } else setG({ card: next, deck, next: null, out: null, streak, turn: g.turn + 1 })
        },
        reduce ? 600 : 1100,
      )
    },
    [g, result, report, ended, reduce],
  )

  useEffect(() => {
    if (result) return
    const onKey = (e) => {
      if ((e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || e.repeat || e.target.closest?.('input, textarea')) return
      e.preventDefault()
      guess(e.key === 'ArrowUp')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [guess, result])

  const again = useCallback(() => {
    clearTimeout(timer.current)
    lock.current = false
    setG(start())
    setResult(null)
    setRun((n) => n + 1)
  }, [])

  return (
    <Swap fit k={result ? 'done' : `run-${run}`}>
      {result ? (
        <Result
          title="Higher or lower"
          isNew={result.isNew}
          onAgain={again}
          stats={[
            { label: 'Streak', value: result.streak },
            { label: 'Missed on', value: `${rankLabel(result.from.r)} → ${rankLabel(result.to.r)}` },
            { label: 'Cards seen', value: result.seen },
          ]}
        />
      ) : (
        <div className="mx-auto max-w-[520px]">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs text-muted">Streak</div>
              <Swap k={g.streak}>
                <div className="num min-w-[2ch] text-5xl text-accent">{g.streak}</div>
              </Swap>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted">Cards left</div>
              <div className="num text-3xl text-ink">{g.deck.length}</div>
            </div>
          </div>

          {/* The guessed card flips on the right, then slides left to become the card to beat. */}
          <LayoutGroup id={`hilo-${run}`}>
            <div className="mt-8 flex justify-center gap-5 sm:gap-8">
              <div className="relative h-40 w-28">
                <AnimatePresence>
                  <motion.div
                    key={g.turn}
                    layoutId={`t${g.turn}`}
                    className="absolute inset-0"
                    initial={false}
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    transition={{ duration: 0.35, ease: EASE }}
                  >
                    <PlayingCard card={g.card} size="lg" />
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className="relative h-40 w-28">
                <motion.div
                  key={g.turn + 1}
                  layoutId={`t${g.turn + 1}`}
                  className="absolute inset-0"
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.35, ease: EASE }}
                >
                  <PlayingCard card={g.next} up={!!g.next} size="lg" />
                </motion.div>
              </div>
            </div>
          </LayoutGroup>

          <div className="mt-5 h-7 text-center">
            <Swap k={g.out ? `${g.turn}-${g.out}` : 'idle'}>{g.out ? SAY[g.out] : <span className="text-muted">Is the next card higher or lower?</span>}</Swap>
          </div>

          <div className="mt-5 flex justify-center gap-3">
            <Button onClick={() => guess(true)} disabled={!!g.next} className="h-12 w-36 text-base">
              <ArrowUpIcon size={18} weight="bold" />
              Higher
            </Button>
            <Button onClick={() => guess(false)} disabled={!!g.next} className="h-12 w-36 text-base">
              <ArrowDownIcon size={18} weight="bold" />
              Lower
            </Button>
          </div>

          <p className="mt-8 flex flex-wrap items-center justify-center gap-2 text-sm text-muted">
            <Kbd>↑</Kbd> <Kbd>↓</Kbd> to guess. Ace is high. Same rank is safe.
          </p>
        </div>
      )}
    </Swap>
  )
}
