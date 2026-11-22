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
  CoinsIcon,
  SpinnerBallIcon,
  LadderSimpleIcon,
  MapPinIcon,
  CardsThreeIcon,
  SpadeIcon,
  ArrowsDownUpIcon,
  NumberEightIcon,
  HandPalmIcon,
  StrategyIcon,
  HorseIcon,
  CheckerboardIcon,
  DotsNineIcon,
} from '@phosphor-icons/react'
import { fmtMs, fmtTime } from '../lib/util'
import { ClaudeFigure } from '../components/ClaudeFigure'
import Typing from './Typing.jsx' // eager: main game, no loading step on refresh

// lazy() plus preload(), so home tiles can fetch the chunk on hover before the click.
const lazyGame = (load) => Object.assign(lazy(load), { preload: load })

// Casino games (and Blackjack, which uses the same bank) share one chunk; each page renders it in a fixed mode.
const casino = (name) => lazyGame(() => import('./Casino.jsx').then((m) => ({ default: m[name] })))
const credits = (v) => `${v.toLocaleString()} credits`
const inRow = (v) => `${v} in a row`
const moves = (v) => `${v} move${v === 1 ? '' : 's'}`

// Home group boxes: games with `group` render together in one full-width box.
export const GROUPS = {
  board: { name: 'Board', note: 'You vs PC', icon: StrategyIcon },
  cards: { name: 'Cards', note: 'Deal me in', icon: CardsThreeIcon },
  casino: { name: 'Casino', note: 'Play money', icon: PokerChipIcon },
}

// Order + size drive the home bento (4 cols on desktop). "feature" = 2x2, "wide" = 2x1, "full" = whole row.
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
    cat: 'Memory', icon: SquaresFourIcon, tone: 'plain',
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
    cat: 'Classic', icon: BombIcon, tone: 'plain',
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
    id: 'chess', name: 'Chess', blurb: 'Checkmate the PC in the fewest moves.', group: 'board',
    cat: 'Classic', icon: HorseIcon, size: 'wide', tone: 'lines',
    better: 'low', variant: 'normal', fmt: moves,
    Component: lazyGame(() => import('./Chess.jsx')),
  },
  {
    id: 'checkers', name: 'Checkers', blurb: 'Jump every PC piece.', group: 'board',
    cat: 'Classic', icon: CheckerboardIcon, tone: 'plain',
    better: 'low', variant: 'normal', fmt: moves,
    Component: lazyGame(() => import('./Checkers.jsx')),
  },
  {
    id: 'four', name: 'Four in a row', blurb: 'Line up four discs first.', group: 'board',
    cat: 'Classic', icon: DotsNineIcon, tone: 'dots',
    better: 'low', variant: 'normal', fmt: moves,
    Component: lazyGame(() => import('./Four.jsx')),
  },
  {
    id: 'blackjack', name: 'Blackjack', blurb: 'Beat the dealer to 21.', group: 'cards',
    cat: 'Luck', icon: SpadeIcon, tone: 'dots',
    better: 'high', fmt: credits,
    Component: casino('BlackjackGame'),
  },
  {
    id: 'hilo', name: 'Higher or lower', blurb: 'Guess the next card.', group: 'cards',
    cat: 'Luck', icon: ArrowsDownUpIcon, tone: 'lines',
    better: 'high', fmt: (v) => `${v} streak`,
    Component: lazyGame(() => import('./HiLo.jsx')),
  },
  {
    id: 'eights', name: 'Crazy Eights', blurb: 'Empty your hand before the PC.', group: 'cards',
    cat: 'Classic', icon: NumberEightIcon, tone: 'plain',
    better: 'high', fmt: inRow,
    Component: lazyGame(() => import('./CrazyEights.jsx')),
  },
  {
    id: 'yaniv', name: 'Yaniv', blurb: 'Get to 7 or less, then call it.', group: 'cards',
    cat: 'Classic', icon: HandPalmIcon, tone: 'dots',
    better: 'high', fmt: inRow,
    Component: lazyGame(() => import('./Yaniv.jsx')),
  },
  {
    id: 'slots', name: 'Slots', blurb: 'Spin three reels. Match to win.', group: 'casino',
    cat: 'Luck', icon: CoinsIcon, tone: 'dots',
    better: 'high', fmt: credits,
    Component: casino('SlotsGame'),
  },
  {
    id: 'roulette', name: 'Roulette', blurb: 'Spin the European wheel.', group: 'casino',
    cat: 'Luck', icon: SpinnerBallIcon, tone: 'lines',
    better: 'high', fmt: credits,
    Component: casino('RouletteGame'),
  },
  {
    id: 'levels', name: 'Levels', blurb: 'Climb high. One miss ends it.', group: 'casino',
    cat: 'Luck', icon: LadderSimpleIcon, tone: 'plain',
    better: 'high', fmt: (v) => `level ${v}`,
    Component: casino('LevelsGame'),
  },
  {
    id: 'pinpoint', name: 'Pinpoint', blurb: 'Find the number on a blank line.', group: 'casino',
    cat: 'Luck', icon: MapPinIcon, tone: 'dots',
    better: 'low', fmt: (v) => `${v} off`,
    Component: casino('PinpointGame'),
  },
  {
    id: 'dino', name: 'Claude run', blurb: 'Jump the cacti, dodge the bugs.',
    cat: 'Reflex', icon: ClaudeFigure, size: 'full', tone: 'lines',
    better: 'high', fmt: (v) => `${v.toLocaleString()} pts`,
    Component: lazyGame(() => import('./Dino.jsx')),
  },
]

// Old ids still open a game (Casino was one game with modes before v2.2).
const ALIAS = { casino: 'slots' }
export const byId = (id) => GAMES.find((g) => g.id === (ALIAS[id] ?? id))
