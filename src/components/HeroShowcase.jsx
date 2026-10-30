import { useEffect, useState } from 'react'
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from 'motion/react'
import { ArrowRightIcon } from '@phosphor-icons/react'
import { GAMES } from '../games/registry'
import { gameHref } from '../lib/route'
import { DEMOS } from './demos'
import { EASE } from './ui'

const EVERY = 6000

// Home hero: a live mini demo per game. Auto-rotates (paused on hover/focus, off under reduced motion); tabs pick one.
export function HeroShowcase() {
  const reduce = useReducedMotion()
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const game = GAMES[i]
  const Demo = DEMOS[game.id]
  const Icon = game.icon
  const auto = !reduce && !paused

  // One value drives both the progress line and the switch, so a hover pause freezes the line where it is.
  const fill = useMotionValue(0)
  useEffect(() => fill.set(0), [i, fill])
  useEffect(() => {
    if (!auto) return
    const c = animate(fill, 1, {
      duration: (EVERY / 1000) * (1 - fill.get()),
      ease: 'linear',
      onComplete: () => setI((n) => (n + 1) % GAMES.length),
    })
    return () => c.stop()
  }, [auto, i, fill])

  return (
    <div
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <a
        href={gameHref(game.id)}
        onPointerEnter={() => game.Component.preload?.()}
        className="group block rounded-xl border border-line bg-surface p-5 transition-colors duration-300 hover:border-accent/60 md:p-7"
      >
        <div className="flex items-center justify-between gap-3">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={game.id}
              className="flex items-center gap-2 font-medium"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: EASE }}
            >
              <Icon size={18} weight="duotone" className="text-accent" />
              {game.name}
            </motion.span>
          </AnimatePresence>
          <span className="flex items-center gap-1 text-sm text-muted transition-colors group-hover:text-accent">
            Play
            <ArrowRightIcon size={14} weight="bold" className="transition-transform duration-300 group-hover:translate-x-0.5" />
          </span>
        </div>
        <div className="relative mt-5 h-[250px] md:h-[280px]" aria-hidden="true">
          <AnimatePresence mode="wait">
            <motion.div
              key={game.id}
              className="absolute inset-0"
              initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
              transition={{ duration: 0.35, ease: EASE }}
            >
              <Demo />
            </motion.div>
          </AnimatePresence>
        </div>
      </a>

      {/* Story-style progress: one line per game, the active one fills until the next switch. */}
      <div role="tablist" aria-label="Preview a game" className="mt-4 flex gap-1.5">
        {GAMES.map((g, n) => {
          const on = n === i
          return (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={on}
              aria-label={g.name}
              title={g.name}
              onClick={() => setI(n)}
              className="group/bar flex h-5 flex-1 items-center"
            >
              <span
                className={`relative h-1 w-full overflow-hidden rounded-full transition-colors duration-300 group-hover/bar:bg-muted/50 ${on ? 'bg-muted/40' : 'bg-line'}`}
              >
                {on && (
                  <motion.span
                    className="absolute inset-0 origin-left rounded-full bg-accent"
                    style={{ scaleX: reduce ? 1 : fill }}
                  />
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
