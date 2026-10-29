import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion, useAnimate, useReducedMotion } from 'motion/react'
import { BackspaceIcon } from '@phosphor-icons/react'
import { ANSWERS, FIVE } from './words'
import { pick } from '../lib/util'
import { getValue, setValue } from '../lib/store'
import { useGame } from '../components/GameFrame'
import { Button, EASE, Segmented, Swap } from '../components/ui'

const TRIES = 6
const VALID = new Set(FIVE)
const ROWS = ['qwertyuiop', 'asdfghjkl', '+zxcvbnm-']
const today = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000)
const dailyWord = (day) => ANSWERS[(day * 7919) % ANSWERS.length]

// Two-pass scoring so repeated letters are marked correctly.
function grade(guess, answer) {
  const res = Array(5).fill('absent')
  const left = {}
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) res[i] = 'correct'
    else left[answer[i]] = (left[answer[i]] ?? 0) + 1
  }
  for (let i = 0; i < 5; i++) {
    if (res[i] !== 'correct' && left[guess[i]]) {
      res[i] = 'present'
      left[guess[i]]--
    }
  }
  return res
}

const LOOK = {
  correct: 'bg-accent border-accent text-accent-ink',
  present: 'border-accent text-accent',
  absent: 'bg-surface-2 border-surface-2 text-muted',
}
const RANK = { absent: 1, present: 2, correct: 3 }

// Reveal timing (s): each tile flips after the previous one; colors swap when edge-on.
const FLIP = 0.4
const STAGGER = 0.1
const DONE = 4 * STAGGER + FLIP
const ms = (s) => `${Math.round(s * 1000)}ms`

export default function WordGuess() {
  const { report, ended } = useGame()
  const [mode, setMode] = useState('daily')
  const [answer, setAnswer] = useState('')
  const [guesses, setGuesses] = useState([])
  const [current, setCurrent] = useState('')
  const [msg, setMsg] = useState('')
  const [shake, setShake] = useState(0)
  const [streak, setStreak] = useState(() => getValue('wordStreak', 0))
  const [board, shakeRow] = useAnimate()
  const reduce = useReducedMotion()

  // Rows keep their identity (so the reveal can flip), so the shake is played here instead of by remount.
  useEffect(() => {
    if (shake) shakeRow('[data-cur]', { x: [0, -6, 6, -6, 6, 0] }, { duration: 0.32, ease: [0.36, 0.07, 0.19, 0.97] })
  }, [shake, shakeRow])

  const load = useCallback((m) => {
    setCurrent('')
    setMsg('')
    if (m === 'daily') {
      const day = today()
      const saved = getValue('wordDaily', null)
      setAnswer(dailyWord(day))
      setGuesses(saved?.day === day ? saved.guesses : [])
    } else {
      setAnswer(pick(ANSWERS))
      setGuesses([])
    }
  }, [])

  useEffect(() => load(mode), [mode, load])

  const won = guesses.includes(answer)
  const over = won || guesses.length >= TRIES

  const submit = useCallback(() => {
    if (current.length < 5) {
      setMsg('Not enough letters')
      return setShake((s) => s + 1)
    }
    if (!VALID.has(current)) {
      setMsg('Not in word list')
      return setShake((s) => s + 1)
    }
    const next = [...guesses, current]
    setGuesses(next)
    setCurrent('')
    setMsg('')
    if (mode === 'daily') setValue('wordDaily', { day: today(), guesses: next })
    const win = current === answer
    if (win || next.length >= TRIES) {
      const s = win ? streak + 1 : 0
      setStreak(s)
      setValue('wordStreak', s)
      if (win) report(s)
      else ended()
    }
  }, [current, guesses, mode, answer, streak, report, ended])

  const key = useCallback(
    (k) => {
      if (over) return
      if (k === 'enter') return submit()
      if (k === 'back') return setCurrent((c) => c.slice(0, -1))
      if (/^[a-z]$/.test(k)) setCurrent((c) => (c.length < 5 ? c + k : c))
    },
    [over, submit],
  )

  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'Enter') {
        e.preventDefault()
        if (over && mode === 'random') return load('random')
        key('enter')
      } else if (e.key === 'Backspace') key('back')
      else key(e.key.toLowerCase())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [key, over, mode, load])

  const letters = {}
  guesses.forEach((g) =>
    grade(g, answer).forEach((r, i) => {
      if ((RANK[r] ?? 0) > (RANK[letters[g[i]]] ?? 0)) letters[g[i]] = r
    }),
  )

  return (
    <div className="mx-auto max-w-[520px]">
      <div className="flex items-center justify-between gap-4">
        <Segmented
          label="Mode"
          options={[
            { value: 'daily', label: 'Daily' },
            { value: 'random', label: 'Random' },
          ]}
          value={mode}
          onChange={setMode}
        />
        <div className="num flex items-center gap-1 text-sm text-muted">
          streak <Swap k={streak}>{streak}</Swap>
        </div>
      </div>

      <div ref={board} className="mt-8 grid justify-center gap-1.5">
        {Array.from({ length: TRIES }, (_, r) => {
          const g = guesses[r]
          const isCur = r === guesses.length && !over
          const word = g ?? (isCur ? current : '')
          const res = g ? grade(g, answer) : null
          return (
            <div key={r} data-cur={isCur || undefined} className="flex gap-1.5">
              {/* Flip on reveal; the CSS color delay lands on the flip midpoint, when the tile is edge-on. */}
              {Array.from({ length: 5 }, (_, i) => (
                <motion.div
                  key={i}
                  initial={false}
                  animate={{ rotateX: res ? [0, 90, 0] : 0 }}
                  transition={{ duration: FLIP, delay: i * STAGGER, ease: 'easeInOut' }}
                  style={{
                    transformPerspective: 400,
                    ...(res && { transitionDelay: ms(i * STAGGER + FLIP / 2 - 0.03), transitionDuration: '60ms' }),
                  }}
                  className={`num grid size-12 place-items-center min-[380px]:size-14 rounded-md border-2 text-2xl font-semibold uppercase transition-colors duration-150 motion-reduce:transition-none sm:size-16 ${
                    res ? LOOK[res[i]] : word[i] ? 'border-muted text-ink' : 'border-line'
                  }`}
                >
                  <AnimatePresence initial={false}>
                    {word[i] && (
                      <motion.span
                        key={word[i]}
                        className="[grid-area:1/1]"
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.14, ease: EASE }}
                      >
                        {word[i]}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          )
        })}
      </div>

      <div className="mt-5 min-h-12 text-center" aria-live="polite">
        <Swap k={over ? 'over' : msg}>
          {over ? (
            // Waits for the last tile to flip.
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: reduce ? 0 : DONE, ease: EASE }}
              className="flex flex-wrap items-center justify-center gap-3"
            >
              <p className={won ? 'text-accent' : 'text-ink'}>
                {won ? `Solved in ${guesses.length}` : <>The word was <span className="num uppercase text-accent">{answer}</span></>}
              </p>
              {mode === 'random' ? (
                <Button onClick={() => load('random')}>Next word</Button>
              ) : (
                <span className="text-sm text-muted">New daily word tomorrow.</span>
              )}
            </motion.div>
          ) : (
            msg && <p className="text-sm text-danger">{msg}</p>
          )}
        </Swap>
      </div>

      <div className="mt-4 grid gap-1.5">
        {ROWS.map((row) => (
          <div key={row} className="flex justify-center gap-1.5">
            {row.split('').map((ch) => {
              const k = ch === '+' ? 'enter' : ch === '-' ? 'back' : ch
              const st = letters[ch]
              // A new key color waits for the row reveal; the press scale never waits.
              return (
                <button
                  key={ch}
                  type="button"
                  onClick={() => key(k)}
                  aria-label={k === 'back' ? 'Backspace' : k}
                  style={st ? { transitionDelay: `${ms(DONE)}, ${ms(DONE)}, ${ms(DONE)}, 0ms` } : undefined}
                  className={`num grid h-12 place-items-center rounded-md border text-sm font-medium uppercase transition-[color,background-color,border-color,scale] duration-200 active:scale-95 motion-reduce:transition-none ${
                    k.length > 1 ? 'min-w-0 max-w-16 flex-[1.5] px-1' : 'min-w-0 max-w-10 flex-1'
                  } ${st ? LOOK[st] : 'border-line bg-surface text-ink hover:bg-surface-2'}`}
                >
                  {k === 'enter' ? 'Enter' : k === 'back' ? <BackspaceIcon size={18} weight="bold" /> : ch}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
