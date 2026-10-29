import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { MoonIcon, SunIcon } from '@phosphor-icons/react'

const WORD = 'easygames'

// Types, holds, deletes, repeats. Static under reduced motion.
function TypedWordmark() {
  const reduce = useReducedMotion()
  const [n, setN] = useState(reduce ? WORD.length : 0)

  useEffect(() => {
    if (reduce) return setN(WORD.length)
    let i = 0
    let dir = 1
    let id
    const step = () => {
      i += dir
      setN(i)
      if (dir === 1 && i === WORD.length) {
        dir = -1
        id = setTimeout(step, 2600)
      } else if (dir === -1 && i === 0) {
        dir = 1
        id = setTimeout(step, 450)
      } else id = setTimeout(step, dir === 1 ? 260 + Math.random() * 140 : 120)
    }
    id = setTimeout(step, 250)
    return () => clearTimeout(id)
  }, [reduce])

  return (
    <span aria-hidden="true">
      {WORD.slice(0, Math.min(n, 4))}
      <span className="text-accent">{WORD.slice(4, n)}</span>
      <span
        className={`ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[3px] bg-accent ${n >= WORD.length ? 'blink' : ''}`}
      />
    </span>
  )
}

function currentTheme() {
  const set = document.documentElement.dataset.theme
  if (set) return set
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function Header() {
  const [theme, setTheme] = useState(currentTheme)

  // Follow system changes until the user picks a theme.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const sync = () => setTheme(currentTheme())
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem('easygame:theme', next)
    } catch {}
    setTheme(next)
  }

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-0 z-20 border-b border-line/60 bg-bg/85 backdrop-blur-md"
    >
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 md:px-8">
        <a href="#/" className="num text-lg font-medium tracking-tight" aria-label="easygames home">
          <TypedWordmark />
        </a>
        <button
          type="button"
          onClick={toggle}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          className="grid size-10 place-items-center rounded-xl border border-line text-muted transition-colors hover:text-ink active:scale-95"
        >
          {theme === 'dark' ? <SunIcon size={18} weight="bold" /> : <MoonIcon size={18} weight="bold" />}
        </button>
      </div>
    </motion.header>
  )
}
