import { lazy } from 'react'
import {
  KeyboardIcon,
  MathOperationsIcon,
  LightningIcon,
  CrosshairIcon,
  NumpadIcon,
  SquaresFourIcon,
  TextAaIcon,
  PathIcon,
  BombIcon,
  CirclesFourIcon,
  CardsIcon,
  GridFourIcon,
  PokerChipIcon,
} from '@phosphor-icons/react'
import { fmtMs, fmtTime } from '../lib/util'
import Typing from './Typing.jsx' // eager: main game, no loading step on refresh

// lazy() plus preload(), so home tiles can fetch the chunk on hover before the click.
const lazyGame = (load) => Object.assign(lazy(load), { preload: load })

// Order + size drive the home bento (4 cols on desktop). "feature" = 2x2, "wide" = 2x1.
export const GAMES = [
  {
    id: 'typing', name: 'Type race', blurb: 'Type the words. Measure your WPM.',
    cat: 'Brain', icon: KeyboardIcon, size: 'feature', tone: 'plain',
    better: 'high', variant: '30', vlabel: (v) => `${v}s`, fmt: (v) => `${v} wpm`,
    Component: Typing,
  },
  {
    id: 'math', name: 'Math sprint', blurb: 'Solve as many as you can in 60s.',
    cat: 'Brain', icon: MathOperationsIcon, size: 'wide', tone: 'lines',
    better: 'high', variant: 'normal', fmt: (v) => `${v} solved`,
    Component: lazyGame(() => import('./MathSprint.jsx')),
  },
  {
    id: 'reaction', name: 'Reaction time', blurb: 'Click the moment it turns green.',
    cat: 'Reflex', icon: LightningIcon, tone: 'plain',
    better: 'low', fmt: fmtMs,
    Component: lazyGame(() => import('./Reaction.jsx')),
  },
  {
    id: 'aim', name: 'Aim trainer', blurb: 'Hit 30 targets fast.',
    cat: 'Reflex', icon: CrosshairIcon, tone: 'dots',
    better: 'low', fmt: fmtMs,
    Component: lazyGame(() => import('./Aim.jsx')),
  },
  {
    id: 'numbers', name: 'Number memory', blurb: 'Remember the longest number.',
    cat: 'Memory', icon: NumpadIcon, tone: 'dots',
    better: 'high', fmt: (v) => `${v} digits`,
    Component: lazyGame(() => import('./NumberMemory.jsx')),
  },
  {
    id: 'sequence', name: 'Sequence', blurb: 'Repeat the growing pattern.',
    cat: 'Memory', icon: SquaresFourIcon, size: 'wide', tone: 'plain',
    better: 'high', fmt: (v) => `level ${v}`,
    Component: lazyGame(() => import('./Sequence.jsx')),
  },
  {
    id: 'word', name: 'Word guess', blurb: 'Find the 5-letter word in six tries.',
    cat: 'Puzzle', icon: TextAaIcon, size: 'wide', tone: 'plain',
    better: 'high', fmt: (v) => `${v} streak`,
    Component: lazyGame(() => import('./WordGuess.jsx')),
  },
  {
    id: 'snake', name: 'Snake', blurb: 'Eat, grow, avoid your tail.',
    cat: 'Classic', icon: PathIcon, size: 'wide', tone: 'lines',
    better: 'high', fmt: (v) => `${v} pts`,
    Component: lazyGame(() => import('./Snake.jsx')),
  },
  {
    id: 'mines', name: 'Minesweeper', blurb: 'Clear the field. Flag the mines.',
    cat: 'Classic', icon: BombIcon, size: 'wide', tone: 'plain',
    better: 'low', variant: 'easy', fmt: (v) => fmtTime(v),
    Component: lazyGame(() => import('./Minesweeper.jsx')),
  },
  {
    id: 'chimp', name: 'Chimp test', blurb: 'Tap the hidden numbers in order.',
    cat: 'Memory', icon: CirclesFourIcon, tone: 'dots',
    better: 'high', fmt: (v) => `${v} numbers`,
    Component: lazyGame(() => import('./Chimp.jsx')),
  },
  {
    id: 'pairs', name: 'Memory pairs', blurb: 'Flip cards, match every pair.',
    cat: 'Memory', icon: CardsIcon, size: 'wide', tone: 'plain',
    better: 'low', fmt: (v) => `${v} moves`,
    Component: lazyGame(() => import('./Pairs.jsx')),
  },
  {
    id: '2048', name: '2048', blurb: 'Slide and merge to reach 2048.',
    cat: 'Classic', icon: GridFourIcon, size: 'wide', tone: 'plain',
    better: 'high', fmt: (v) => `${v.toLocaleString()} pts`,
    Component: lazyGame(() => import('./G2048.jsx')),
  },
  {
    id: 'casino', name: 'Casino', blurb: 'Slots, roulette and a risk ladder. Play money.',
    cat: 'Luck', icon: PokerChipIcon, size: 'wide', tone: 'dots',
    better: 'high', variant: 'slots', vlabel: (v) => v[0].toUpperCase() + v.slice(1),
    fmt: (v, mode) => (mode === 'levels' ? `level ${v}` : `${v.toLocaleString()} coins`),
    Component: lazyGame(() => import('./Casino.jsx')),
  },
]

export const byId = (id) => GAMES.find((g) => g.id === id)
