import { Suspense, useEffect } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
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
  const key = route.page === 'game' ? route.id : 'home'

  // Fetch every game chunk once while idle, so opening a game never shows a loading step.
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 300))
    idle(() => GAMES.forEach((g) => g.Component.preload?.()))
  }, [])

  useEffect(() => {
    document.title = game ? `${game.name} · easygames` : 'easygames'
  }, [key, game])

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-[100dvh] flex-col">
        <Header />
        {/* Scroll after the old page has left, so it doesn't snap to the top mid-fade.
            No initial={false} here: it would block enter animations of everything mounted later inside the page. */}
        <AnimatePresence mode="wait" onExitComplete={() => window.scrollTo(0, 0)}>
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
