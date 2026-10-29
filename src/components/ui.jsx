import { useEffect, useState } from 'react'
import { AnimatePresence, animate, motion, useReducedMotion } from 'motion/react'

export const EASE = [0.16, 1, 0.3, 1]

// Cross-fades its content whenever `k` changes. Use for any in-game state swap so nothing pops in.
export function Swap({ k, children, className = '' }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={k}
        className={className}
        initial={{ opacity: 0, y: 6, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.98, pointerEvents: 'none' }}
        transition={{ duration: 0.18, ease: EASE }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

// Counts the leading number of a stat up from 0 ("82 wpm", "1,204 pts", "64%"). Plain text stays as is.
function CountUp({ value }) {
  const reduce = useReducedMotion()
  const m = typeof value === 'number' || typeof value === 'string' ? String(value).match(/^(\d[\d,]*)(.*)$/s) : null
  const target = m ? Number(m[1].replace(/,/g, '')) : 0
  const [n, setN] = useState(m && !reduce ? 0 : target)
  useEffect(() => {
    if (!m || reduce) return
    const c = animate(0, target, { duration: 0.9, ease: EASE, onUpdate: (v) => setN(Math.round(v)) })
    return () => c.stop()
  }, [target, reduce]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!m) return value
  return `${m[1].includes(',') ? n.toLocaleString() : n}${m[2]}`
}

// Enter restarts from any result screen.
export function useEnter(fn, active = true) {
  useEffect(() => {
    if (!active) return
    const onKey = (e) => {
      if (e.key === 'Enter' && !e.repeat) {
        e.preventDefault()
        fn()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fn, active])
}

const base =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 h-10 text-sm font-medium transition-[transform,scale,background-color,color,border-color] duration-200 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none'

export function Button({ variant = 'primary', className = '', ...props }) {
  const look =
    variant === 'primary'
      ? 'bg-accent text-accent-ink hover:brightness-110'
      : 'border border-line text-ink hover:bg-surface-2'
  return <button type="button" className={`${base} ${look} ${className}`} {...props} />
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl border border-line bg-surface p-1">
      {options.map((o) => {
        const v = typeof o === 'object' ? o.value : o
        const text = typeof o === 'object' ? o.label : o
        const on = v === value
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(v)}
            className={`h-8 rounded-lg px-3 text-sm transition-colors ${on ? 'bg-surface-2 text-accent' : 'text-muted hover:text-ink'}`}
          >
            {text}
          </button>
        )
      })}
    </div>
  )
}

export function Stat({ label, value, big = false }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted">{label}</div>
      <div className={`num leading-tight ${big ? 'text-5xl text-accent md:text-6xl' : 'text-2xl text-ink'}`}>
        {big ? <CountUp value={value} /> : value}
      </div>
    </div>
  )
}

// Result panel shown when a run ends.
export function Result({ title, stats, isNew, onAgain, children }) {
  useEnter(onAgain)
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 24 }}
      className="relative mx-auto w-full max-w-xl overflow-hidden rounded-xl border border-line bg-surface p-6 md:p-8"
    >
      {/* Finish-line sweep across the panel. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-accent/15 to-transparent"
        initial={{ x: '-100%' }}
        animate={{ x: '250%' }}
        transition={{ duration: 1.1, delay: 0.15, ease: EASE }}
      />
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-medium">{title}</h2>
        {isNew && (
          <motion.span
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 14, delay: 0.5 }}
            className="text-sm font-medium text-accent"
          >
            New best
          </motion.span>
        )}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-3">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            className={i === 0 ? 'col-span-2 sm:col-span-3' : ''}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 + i * 0.08, ease: EASE }}
          >
            <Stat label={s.label} value={s.value} big={i === 0} />
          </motion.div>
        ))}
      </div>
      {children}
      <div className="mt-8 flex items-center gap-3">
        <Button onClick={onAgain}>Play again</Button>
        <span className="text-xs text-muted">or press Enter</span>
      </div>
    </motion.div>
  )
}

export function Kbd({ children }) {
  return (
    <kbd className="num rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink">{children}</kbd>
  )
}
