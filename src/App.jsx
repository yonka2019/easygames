import { Suspense, useEffect, useLayoutEffect, useRef } from 'react'
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react'
import { Header } from './components/Header'
import { Home } from './components/Home'
import { GameFrame } from './components/GameFrame'
import { GAMES, byId } from './games/registry'
import { useRoute } from './lib/route'

const AUTHOR = import.meta.env.VITE_AUTHOR || 'yonka'

// Sits inside GameFrame, so only the game area pulses while its chunk loads.
function Loading() {
  return <div className="mx-auto h-[360px] max-w-[1000px] animate-pulse rounded-xl bg-surface" aria-label="Loading" />
}

function NotFound() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-20 md:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Game not found</h1>
      <a href="#/" className="mt-4 inline-block text-accent underline-offset-4 hover:underline">
        Back to all games
      </a>
    </div>
  )
}

export default function App() {
  const route = useRoute()
  const game = route.page === 'game' ? byId(route.id) : null
  const key = route.page === 'game' ? route.id : route.page
  const reduce = useReducedMotion()

  // Back to home returns to where you were in the list; any other page starts at the top.
  const homeY = useRef(0)
  const prev = useRef(key)
  useLayoutEffect(() => {
    if (prev.current === 'home') homeY.current = window.scrollY
    prev.current = key
  }, [key])

  // Fetch every game chunk once while idle, so opening a game never shows a loading step.
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 300))
    idle(() => GAMES.forEach((g) => g.Component.preload?.()))
  }, [])

  useEffect(() => {
    document.title = game ? `${game.name} · easygames` : 'easygames'
  }, [key, game])

  return (
    // Reduced motion: every Motion animation jumps to its end state (opacity too), so nothing moves or fades.
    <MotionConfig reducedMotion="user" skipAnimations={!!reduce}>
      <div className="flex min-h-[100dvh] flex-col">
        <Header />
        {/* Scroll after the old page has left, so it doesn't snap to the top mid-fade.
            No initial={false} here: it would block enter animations of everything mounted later inside the page. */}
        <AnimatePresence
          mode="wait"
          onExitComplete={() => {
            window.scrollTo(0, 0)
            // Home mounts right after this callback: restore its position once it has height again.
            if (key === 'home' && homeY.current) requestAnimationFrame(() => window.scrollTo(0, homeY.current))
          }}
        >
          <motion.main
            key={key}
            className="flex-1"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {route.page === 'home' ? (
              <Home />
            ) : game ? (
              <GameFrame game={game}>
                <Suspense fallback={<Loading />}>
                  <game.Component />
                </Suspense>
              </GameFrame>
            ) : (
              <NotFound />
            )}
          </motion.main>
        </AnimatePresence>
        <footer className="mx-auto w-full max-w-[1200px] px-4 pb-8 text-center text-xs text-muted md:px-8">by {AUTHOR}</footer>
      </div>
    </MotionConfig>
  )
}
