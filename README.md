# easygames

14 browser games: claude run, casino (slots, roulette, levels, pinpoint), type race, math sprint, number memory, sequence, reaction time, aim trainer, chimp test, memory pairs, word guess, snake, minesweeper, 2048.

Scores save to this browser only (localStorage).

## Run

```
npm install
npm run dev      # http://localhost:25753 (also on LAN; ngrok hosts allowed)
npm run build    # output: dist/
```

## Config

Copy `.env.example` to `.env`. `VITE_AUTHOR` = footer name (default `yonka`).

## Stack

Vite, React 19, Tailwind v4, Motion, Phosphor icons, Geist font.

## Add a game

1. Create `src/games/MyGame.jsx` (default export).
2. Add an entry in `src/games/registry.js`.
3. Call `useGame().report(score)` when a run ends, or `useGame().ended()` if there is no score.
