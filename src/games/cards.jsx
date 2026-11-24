import { ClubIcon, DiamondIcon, HeartIcon, SmileyIcon, SpadeIcon, StarIcon } from '@phosphor-icons/react'
import { cardName, isJoker, isRed, rankLabel } from './cardLogic'

// Shared card kit for the card games: one playing card (face + back) and small helpers.

export const SUIT_ICON = { s: SpadeIcon, h: HeartIcon, d: DiamondIcon, c: ClubIcon }

const SIZE = {
  sm: { box: 'h-14 w-10 rounded-md', rank: 'text-xs', pip: 9, big: 16, pad: 'left-1 top-1' },
  md: { box: 'h-[74px] w-[52px] rounded-lg sm:h-[92px] sm:w-16', rank: 'text-sm sm:text-base', pip: 11, big: 24, pad: 'left-1.5 top-1.5' },
  lg: { box: 'h-40 w-28 rounded-xl', rank: 'text-2xl', pip: 18, big: 52, pad: 'left-2.5 top-2.5' },
  // Fills its parent's width (patience columns). Rank and pip sit side by side so stacked cards stay readable.
  fluid: {
    box: 'w-full aspect-[5/7] rounded-[9cqw] [container-type:inline-size]',
    rank: 'text-[25cqw] tracking-[-0.06em]',
    pipCls: 'size-[19cqw]',
    bigCls: 'size-[46cqw]',
    pad: 'left-[8cqw] top-[5cqw] flex-row! gap-[3cqw]!',
  },
}

export const suitTint = (s) => (s === 'h' || s === 'd' ? 'text-danger' : 'text-ink')

function Face({ card, z }) {
  if (isJoker(card)) {
    return (
      <span className="absolute inset-0 text-accent">
        <StarIcon size={z.pip + 3} weight="fill" className={`absolute ${z.pad} ${z.pipCls ?? ''}`} />
        <SmileyIcon size={z.big + 4} weight="duotone" className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${z.bigCls ?? ''}`} />
      </span>
    )
  }
  const Icon = SUIT_ICON[card.s]
  return (
    <span className={`absolute inset-0 ${isRed(card) ? 'text-danger' : 'text-ink'}`}>
      <span className={`absolute flex flex-col items-center gap-0.5 leading-none ${z.pad}`}>
        <span className={`num font-semibold leading-none ${z.rank}`}>{rankLabel(card.r)}</span>
        <Icon size={z.pip} weight="fill" className={z.pipCls} />
      </span>
      <Icon size={z.big} weight="fill" className={`absolute bottom-[14%] right-[12%] ${z.bigCls ?? ''}`} />
    </span>
  )
}

// `up={false}` (or no card) shows the back; changing `up` flips the card. Static under reduced motion.
export function PlayingCard({ card, up = true, size = 'md', className = '' }) {
  const z = SIZE[size]
  const shown = up && card
  return (
    <span
      role="img"
      aria-label={shown ? cardName(card) : 'Face-down card'}
      className={`relative block shrink-0 [perspective:700px] ${z.box} ${className}`}
    >
      <span
        className="absolute inset-0 rounded-[inherit] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] [transform-style:preserve-3d]"
        style={{ transform: shown ? 'none' : 'rotateY(180deg)' }}
      >
        <span className="absolute inset-0 rounded-[inherit] border border-line bg-surface-2 shadow-sm [backface-visibility:hidden]">
          {card && <Face card={card} z={z} />}
        </span>
        <span className="absolute inset-0 overflow-hidden rounded-[inherit] border border-line bg-surface [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <span className="line-grid absolute inset-0" />
          <span className="absolute inset-[3px] rounded-[inherit] border border-accent/35" />
        </span>
      </span>
    </span>
  )
}

// Empty spot where a card will land.
export function CardSlot({ size = 'md', className = '' }) {
  return <span aria-hidden="true" className={`block shrink-0 border border-dashed border-line ${SIZE[size].box} ${className}`} />
}

// Width of an `md` card as a CSS var, for rows that size themselves around it.
export const CARD_W = '[--cw:52px] sm:[--cw:64px]'

// Overlap for a row of `n` cards `w` wide (CSS length), so the row always fits its container
// (the row needs `[container-type:inline-size]` and a width of its own). First card gets none.
export const overlap = (i, n, w = 'var(--cw)', gap = 6) => (i ? { marginLeft: `min(${gap}px, calc((100cqw - ${n} * ${w}) / ${n - 1}))` } : undefined)

// Width of a row of `n` md cards, capped at the space it has.
export const rowWidth = (n, gap = 6) => ({ width: `min(100%, calc(${n} * var(--cw) + ${(n - 1) * gap}px))` })
