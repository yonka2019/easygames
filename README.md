# easygames

24 browser games: claude run, board vs PC (chess, checkers, four in a row), cards (blackjack, higher or lower, crazy eights, yaniv), casino (slots, roulette, levels, pinpoint), type race, math sprint, number memory, sequence, reaction time, aim trainer, chimp test, memory pairs, word guess, snake, minesweeper, 2048.

Scores save to this browser only (localStorage).

## Run

```
npm install
npm run dev      # http://localhost:25753 (also on LAN; ngrok hosts allowed)
npm run build    # output: dist/
```

## Docker

```
docker build -t easygames .
docker run -p 8080:8080 easygames   # http://localhost:8080
docker run -e PORT=9000 -p 9000:9000 easygames   # other port
docker run -e VITE_AUTHOR=yourname -p 8080:8080 easygames   # footer name
```

`PORT` = listen port (default `8080`, must be ≥ 1024). Runs as non-root (OpenShift ready).
`VITE_AUTHOR` is read at container start.

## Config

Copy `.env.example` to `.env`.

- `VITE_AUTHOR` = footer name (default `yonka`).

## Stack

Vite, React 19, Tailwind v4, Motion, Phosphor icons, Geist font.

## Add a game

1. Create `src/games/MyGame.jsx` (default export).
2. Add an entry in `src/games/registry.js` (`group` = put it in a home box: `board`, `cards` or `casino`).
3. Call `useGame().report(score)` when a run ends, or `useGame().ended()` if there is no score.
