import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowClockwiseIcon, CursorClickIcon } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { COMMON } from './words'
import { pick } from '../lib/util'
import { useGame } from '../components/GameFrame'
import { EASE, Kbd, Result, Segmented, Swap } from '../components/ui'

const DURATIONS = ['15', '30', '60']
const makeWords = (n) => Array.from({ length: n }, () => pick(COMMON))

function score(words, typed, input, seconds, keys) {
  let good = 0
  let raw = 0
  const c = { correct: 0, incorrect: 0, extra: 0, missed: 0 }
  const tally = (t, w, final) => {
    for (let j = 0; j < Math.max(t.length, final ? t.length : w.length); j++) {
      if (j >= w.length) c.extra++
      else if (j >= t.length) c.missed++
      else if (t[j] === w[j]) c.correct++
      else c.incorrect++
    }
  }
  typed.forEach((t, i) => {
    raw += t.length + 1
    if (t === words[i]) good += t.length + 1
    tally(t, words[i], false)
  })
  const w = words[typed.length] ?? ''
  raw += input.length
  if (input && w.startsWith(input)) good += input.length
  tally(input, w, true)
  const min = seconds / 60
  return {
    wpm: Math.round(good / 5 / min),
    raw: Math.round(raw / 5 / min),
    acc: keys.all ? Math.round((keys.ok / keys.all) * 100) : 0,
    chars: c,
  }
}

export default function Typing() {
  const { report, setVariant, variant } = useGame()
  const duration = Number(variant) || 30

  const [words, setWords] = useState(() => makeWords(120))
  const [typed, setTyped] = useState([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState('idle')
  const [left, setLeft] = useState(duration)
  const [result, setResult] = useState(null)
  const [focused, setFocused] = useState(false)
  const [shift, setShift] = useState(0)
  const [round, setRound] = useState(0)

  const startAt = useRef(0)
  const keys = useRef({ ok: 0, all: 0 })
  const live = useRef({})
  live.current = { words, typed, input }
  const inputRef = useRef(null)
  const boxRef = useRef(null)
  const activeRef = useRef(null)

  const reset = useCallback(() => {
    setWords(makeWords(120))
    setTyped([])
    setInput('')
    setStatus('idle')
    setLeft(duration)
    setResult(null)
    setShift(0)
    setRound((r) => r + 1)
    keys.current = { ok: 0, all: 0 }
    inputRef.current?.focus()
  }, [duration])

  useEffect(reset, [reset])

  // Web font swap changes line breaks: re-measure once fonts are in.
  const [fontsTick, setFontsTick] = useState(0)
  useEffect(() => {
    document.fonts?.ready.then(() => setFontsTick((t) => t + 1))
  }, [])

  const finish = useCallback(() => {
    const { words, typed, input } = live.current
    const s = score(words, typed, input, duration, keys.current)
    const r = report(s.wpm)
    setResult({ ...s, isNew: r.isNew })
    setStatus('done')
    inputRef.current?.blur()
  }, [duration, report])

  useEffect(() => {
    if (status !== 'run') return
    const id = setInterval(() => {
      const elapsed = (performance.now() - startAt.current) / 1000
      setLeft(Math.max(0, duration - elapsed))
      if (elapsed >= duration) {
        clearInterval(id)
        finish()
      }
    }, 100)
    return () => clearInterval(id)
  }, [status, duration, finish])

  // Keep the active word on the second visible line.
  useLayoutEffect(() => {
    const el = activeRef.current
    const box = boxRef.current
    if (!el || !box) return
    const lh = parseFloat(getComputedStyle(box).lineHeight)
    const line = Math.round(el.offsetTop / lh)
    setShift(Math.max(0, line - 1) * lh)
  }, [typed.length, words, fontsTick])

  // Typing anywhere focuses the test; Tab, Esc or Ctrl+R restarts (Ctrl+R no longer reloads the page here).
  useEffect(() => {
    const onKey = (e) => {
      const ctrlR = (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'r'
      if (e.key === 'Tab' || e.key === 'Escape' || ctrlR) {
        e.preventDefault()
        reset()
        return
      }
      if (status !== 'done' && document.activeElement !== inputRef.current && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [reset, status])

  const onChange = (e) => {
    if (status === 'done') return
    const v = e.target.value
    const idx = typed.length
    const target = words[idx]
    if (status === 'idle' && v.trim()) {
      startAt.current = performance.now()
      setStatus('run')
    }
    if (v.endsWith(' ')) {
      const word = v.trim()
      if (!word) return setInput('')
      keys.current.all++
      if (word === target) keys.current.ok++
      setTyped((t) => [...t, word])
      setInput('')
      if (idx > words.length - 40) setWords((w) => [...w, ...makeWords(60)])
      return
    }
    if (v.length > target.length + 8) return
    for (let p = input.length; p < v.length; p++) {
      keys.current.all++
      if (v[p] === target[p]) keys.current.ok++
    }
    setInput(v)
  }

  const onKeyDown = (e) => {
    if (e.key === 'Backspace' && input === '' && typed.length) {
      const last = typed.length - 1
      if (typed[last] !== words[last]) {
        e.preventDefault()
        setInput(typed[last])
        setTyped((t) => t.slice(0, -1))
      }
    }
  }

  const idx = typed.length
  const c = result?.chars
  return (
    <Swap k={status === 'done' && result ? 'done' : 'play'}>
      {status === 'done' && result ? (
        <Result
          title={`English, ${duration} seconds`}
          isNew={result.isNew}
          onAgain={reset}
          stats={[
            { label: 'Words per minute', value: result.wpm },
            { label: 'Accuracy', value: `${result.acc}%` },
            { label: 'Raw', value: result.raw },
            { label: 'Chars', value: `${c.correct}/${c.incorrect}/${c.extra}` },
          ]}
        >
          <p className="mt-4 text-xs text-muted">Chars: correct / incorrect / extra.</p>
        </Result>
      ) : (
        <div className="mx-auto max-w-[1000px]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Segmented
              label="Duration"
              options={DURATIONS.map((d) => ({ value: d, label: `${d}s` }))}
              value={String(duration)}
              onChange={setVariant}
            />
            {/* Each second ticks in softly instead of snapping. */}
            <motion.span
              key={status === 'run' ? Math.ceil(left) : duration}
              initial={{ opacity: 0.35, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="num inline-block text-3xl text-accent"
            >
              {status === 'run' ? Math.ceil(left) : duration}
            </motion.span>
          </div>

          <div className="relative mt-10" onClick={() => inputRef.current?.focus()}>
            <input
              ref={inputRef}
              value={input}
              onChange={onChange}
              onKeyDown={onKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              aria-label="Type the words shown"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              className="absolute inset-0 z-10 cursor-default opacity-0"
            />
            <div
              ref={boxRef}
              className={`num h-[4.8em] overflow-hidden text-2xl leading-[1.6] transition-[filter,opacity] duration-200 md:text-3xl ${focused ? '' : 'opacity-40 blur-[3px]'}`}
            >
              <div
                key={round}
                className={status === 'run' ? 'transition-transform duration-150 ease-out' : ''}
                style={{ transform: `translateY(-${shift}px)` }}
              >
                {words.map((w, i) => {
                  const t = i < idx ? typed[i] : i === idx ? input : ''
                  const wrong = i < idx && t !== w
                  const len = Math.max(w.length, i <= idx ? t.length : 0)
                  return (
                    <span
                      key={i}
                      ref={i === idx ? activeRef : null}
                      style={i < 48 ? { animationDelay: `${i * 6}ms` } : undefined}
                      className={`word-in mr-[0.55em] inline-block underline decoration-2 underline-offset-[6px] transition-[text-decoration-color] duration-200 ${wrong ? 'decoration-danger/70' : 'decoration-transparent'}`}
                    >
                      {Array.from({ length: len }, (_, j) => {
                        const ch = j < w.length ? w[j] : t[j]
                        let cls = 'text-muted/55'
                        if (i <= idx && j < t.length) cls = j >= w.length ? 'text-danger/70' : t[j] === w[j] ? 'text-ink' : 'text-danger'
                        const atCaret = i === idx && focused && j === t.length
                        const caretEnd = i === idx && focused && t.length >= len && j === len - 1
                        const caret = atCaret ? 'caret-before' : caretEnd ? 'caret-after' : ''
                        return (
                          <span key={j} className={`relative ${cls} ${caret} ${caret && status === 'idle' ? 'caret-blink' : ''}`}>
                            {ch}
                          </span>
                        )
                      })}
                    </span>
                  )
                })}
              </div>
            </div>
            <AnimatePresence initial={false}>
              {!focused && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.2, ease: EASE }}
                  className="pointer-events-none absolute inset-0 grid place-items-center"
                >
                  <span className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2 text-sm">
                    <CursorClickIcon size={16} weight="bold" className="text-accent" />
                    Click or start typing
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-muted">
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={reset} className="flex items-center gap-2 transition-colors hover:text-ink" aria-label="Restart test">
              <ArrowClockwiseIcon size={16} weight="bold" />
              Restart
            </button>
            <span className="flex items-center gap-2">
              <Kbd>Tab</Kbd> or <Kbd>Ctrl R</Kbd> restart
            </span>
            <span className="flex items-center gap-2">
              <Kbd>Backspace</Kbd> fix a wrong word
            </span>
          </div>
        </div>
      )}
    </Swap>
  )
}
