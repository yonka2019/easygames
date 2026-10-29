import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { ShuffleIcon, ArrowRightIcon } from '@phosphor-icons/react'
import { GAMES } from '../games/registry'
import { getBest, resetAll } from '../lib/store'
import { gameHref } from '../lib/route'
import { pick, shuffle } from '../lib/util'
import { Button } from './ui'
import { HeroShowcase } from './HeroShowcase'

const SPAN = {
  feature: 'sm:col-span-2 sm:row-span-2',
  wide: 'sm:col-span-2',
}

const SAMPLE = 'there will be time to think about it later'

// Hero intro plays once per visit, not on every return to home.
let introPlayed = false
const EASE = [0.16, 1, 0.3, 1]
const rise = (delay) => ({
  initial: { opacity: 0, y: 24, filter: 'blur(8px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  transition: { duration: 0.8, delay, ease: EASE },
})

// Green glow hops between random tiles. Picked once and kept still under reduced motion.
const LIT_COUNT = 1
const LIT_EVERY = 4000

function pickLit(prev = []) {
  const fresh = shuffle(GAMES.map((g) => g.id).filter((id) => !prev.includes(id)))
  return fresh.slice(0, LIT_COUNT)
}

function useLit() {
  const reduce = useReducedMotion()
  const [lit, setLit] = useState(pickLit)
  useEffect(() => {
    if (reduce) return
    const id = setInterval(() => setLit(pickLit), LIT_EVERY)
    return () => clearInterval(id)
  }, [reduce])
  return lit
}

function Tile({ game, best, index, lit, wait }) {
  const Icon = game.icon
  const feature = game.size === 'feature'
  return (
    <motion.a
      href={gameHref(game.id)}
      onPointerEnter={() => game.Component.preload?.()}
      onFocus={() => game.Component.preload?.()}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.5, delay: wait + index * 0.035, ease: [0.16, 1, 0.3, 1] } }}
      // Lift via Motion, not CSS: a CSS transition on transform fights Motion's own transform updates.
      whileHover={{ y: -2, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } }}
      className={`group relative isolate flex min-h-[176px] flex-col overflow-hidden rounded-xl border p-5 transition-[border-color] duration-[1200ms] hover:border-accent/60 hover:duration-300 motion-reduce:transition-none md:p-6 bg-surface ${lit ? 'border-accent/25' : 'border-line'} ${SPAN[game.size] ?? ''}`}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 -z-10 bg-accent/[0.07] transition-opacity duration-[1200ms] ease-in-out motion-reduce:transition-none ${lit ? 'opacity-100' : 'opacity-0'}`}
      />
      {game.tone === 'dots' && (
        <div className="dot-grid pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(to_left,black,transparent_70%)]" />
      )}
      {game.tone === 'lines' && (
        <div className="line-grid pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(to_top_left,black,transparent_65%)]" />
      )}

      <div className="flex items-start justify-between gap-3">
        <span className="grid size-11 place-items-center rounded-xl border border-line bg-bg/60 text-accent">
          <Icon size={22} weight="duotone" />
        </span>
        <ArrowRightIcon
          size={18}
          weight="bold"
          className="text-muted transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-accent"
        />
      </div>

      {feature && (
        <p className="num mt-8 hidden text-2xl leading-snug sm:block lg:text-3xl" aria-hidden="true">
          <span className="text-ink">{SAMPLE.slice(0, 19)}</span>
          <span className="relative caret-before text-muted/60">{SAMPLE[19]}</span>
          <span className="text-muted/60">{SAMPLE.slice(20)}</span>
        </p>
      )}

      <div className="mt-auto pt-6">
        <h3 className={`font-semibold tracking-tight ${feature ? 'text-2xl md:text-3xl' : 'text-lg'}`}>{game.name}</h3>
        <p className="mt-1 text-sm text-muted">{game.blurb}</p>
        <p className={`num mt-3 text-sm ${best === null ? 'text-muted' : 'text-accent'}`}>
          {best === null ? 'No score yet' : `Best ${game.fmt(best)}`}
        </p>
      </div>
    </motion.a>
  )
}

export function Home() {
  const [bests, setBests] = useState(() => Object.fromEntries(GAMES.map((g) => [g.id, getBest(g.id, g.variant)])))

  const random = () => {
    window.location.hash = gameHref(pick(GAMES).id)
  }

  const reset = () => {
    if (!window.confirm('Delete all saved scores? This cannot be undone.')) return
    resetAll()
    setBests(Object.fromEntries(GAMES.map((g) => [g.id, null])))
  }

  const lit = useLit()
  const [intro] = useState(() => !introPlayed)
  useEffect(() => {
    introPlayed = true
  }, [])
  const enter = (delay) => (intro ? rise(delay) : {})
  const hasScores = Object.values(bests).some((v) => v !== null)

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 md:px-8">
      <section className="grid items-center gap-10 pb-16 pt-12 md:pt-20 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        <div>
          <h1 className="text-4xl font-semibold leading-[1.05] tracking-tighter md:text-6xl">
            <motion.span className="block" {...enter(0.1)}>
              Short games.
            </motion.span>
            <motion.span className="block text-muted" {...enter(0.22)}>
              Real scores.
            </motion.span>
          </h1>
          <motion.p {...enter(0.36)} className="mt-6 max-w-[42ch] text-base leading-relaxed text-muted md:text-lg">
            Typing, math, memory, reflex and classic puzzles. No signup. Scores stay in your browser.
          </motion.p>
          <motion.div {...enter(0.46)} className="mt-8 flex flex-wrap gap-3">
            <a
              href={gameHref('typing')}
              className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-xl bg-accent px-5 text-sm font-medium text-accent-ink transition-transform hover:brightness-110 active:scale-[0.97]"
            >
              Start type race
            </a>
            <Button variant="ghost" onClick={random} className="h-11 px-5">
              <ShuffleIcon size={16} weight="bold" />
              Random game
            </Button>
          </motion.div>
        </div>
        <motion.div
          {...(intro && {
            initial: { opacity: 0, scale: 0.96, y: 16 },
            animate: { opacity: 1, scale: 1, y: 0 },
            transition: { duration: 0.9, delay: 0.5, ease: EASE },
          })}
        >
          <HeroShowcase />
        </motion.div>
      </section>

      <section className="pb-20">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-2xl font-semibold tracking-tight">All games</h2>
          <span className="num text-sm text-muted">{GAMES.length}</span>
        </div>
        <div className="grid grid-flow-dense grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {GAMES.map((g, i) => (
            <Tile key={g.id} game={g} best={bests[g.id]} index={i} lit={lit.includes(g.id)} wait={intro ? 0.7 : 0} />
          ))}
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-line py-8 text-sm text-muted">
        <span>Scores are saved in this browser only.</span>
        {hasScores && (
          <button type="button" onClick={reset} className="underline-offset-4 hover:text-danger hover:underline">
            Reset all scores
          </button>
        )}
      </footer>
    </div>
  )
}
