import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowLeftIcon, TrophyIcon } from '@phosphor-icons/react'
import { getBest, submitScore } from '../lib/store'
import { FinishBurst } from './FinishBurst'

const GameCtx = createContext(null)

// Games call report(value) when a run ends, ended() when a run ends with no score (a loss),
// celebrate() for a mid-run win (2048), and setVariant(mode) when the mode changes. All three play the finish animation.
export const useGame = () => useContext(GameCtx)

export function GameFrame({ game, children }) {
  const [variant, setVariant] = useState(game.variant)
  const [best, setBest] = useState(() => getBest(game.id, game.variant))
  const [burst, setBurst] = useState(null)
  const [flash, setFlash] = useState(0)

  const fire = useCallback((kind) => setBurst({ id: Math.random(), kind }), [])

  useEffect(() => {
    if (!burst) return
    const id = setTimeout(() => setBurst(null), 1400)
    return () => clearTimeout(id)
  }, [burst])

  const changeVariant = useCallback(
    (v) => {
      setVariant(v)
      setBest(getBest(game.id, v))
    },
    [game.id],
  )

  const report = useCallback(
    (value) => {
      const r = submitScore(game.id, variant, value, game.better)
      setBest(r.best)
      fire(r.isNew ? 'best' : 'done')
      if (r.isNew) setFlash((f) => f + 1)
      return r
    },
    [game.id, game.better, variant, fire],
  )

  const ended = useCallback(() => fire('end'), [fire])
  const celebrate = useCallback(() => fire('best'), [fire])

  const Icon = game.icon
  return (
    <GameCtx.Provider value={{ report, ended, celebrate, setVariant: changeVariant, variant }}>
      <section className="mx-auto w-full max-w-[1200px] px-4 pb-20 pt-6 md:px-8 md:pt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <a href="#/" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink">
              <ArrowLeftIcon size={16} weight="bold" />
              All games
            </a>
            <h1 className="mt-3 flex items-center gap-3 text-3xl font-semibold tracking-tight md:text-4xl">
              <Icon size={30} weight="duotone" className="shrink-0 text-accent" />
              {game.name}
            </h1>
          </div>
          <motion.div
            key={flash}
            initial={flash ? { scale: 1.15 } : false}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 14 }}
            className={`flex items-center gap-2 rounded-xl border bg-surface px-4 py-2 text-sm transition-colors duration-700 ${flash ? 'border-accent/60' : 'border-line'}`}
          >
            <TrophyIcon size={16} weight="duotone" className="text-accent" />
            <span className="text-muted">Best{variant ? ` (${game.vlabel ? game.vlabel(variant) : variant})` : ''}</span>
            <span className="num text-ink">{best === null ? '-' : game.fmt(best, variant)}</span>
          </motion.div>
        </div>
        <div className="relative mt-8 md:mt-10">
          {children}
          <FinishBurst burst={burst} />
        </div>
      </section>
    </GameCtx.Provider>
  )
}
