import { useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'

const TEXT = 'small games for short breaks keep your hands busy and your head sharp while the kettle boils'
const WRONG_AT = 23 // one deliberate typo so the demo shows error coloring

// Live preview of the type race for the home hero showcase. Static under reduced motion.
export function TypingDemo() {
  const reduce = useReducedMotion()
  const [pos, setPos] = useState(reduce ? 41 : 0)

  useEffect(() => {
    if (reduce) return
    const id = setInterval(() => setPos((p) => (p >= TEXT.length + 12 ? 0 : p + 1)), 95)
    return () => clearInterval(id)
  }, [reduce])

  const typed = Math.min(pos, TEXT.length)
  const wpm = Math.round((typed / 5) / Math.max((pos * 0.095) / 60, 0.05))

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between text-sm">
        <span className="num text-accent">{pos > 3 ? Math.min(wpm, 140) : 0} wpm</span>
        <span className="text-muted">english · 30s</span>
      </div>
      <p className="num mt-5 text-xl leading-relaxed">
        {TEXT.split('').map((ch, i) => {
          const done = i < typed
          const cls = !done ? 'text-muted/60' : i === WRONG_AT ? 'text-danger' : 'text-ink'
          const caret = i === typed && !reduce ? 'caret-before caret-blink' : ''
          return (
            <span key={i} className={`relative ${cls} ${caret}`}>
              {ch}
            </span>
          )
        })}
      </p>
    </div>
  )
}
