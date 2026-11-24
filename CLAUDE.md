# easygames

Browser mini-games site (24 games; 3 in the Board group, 4 in the Cards group, 4 in the Casino group). Pure client-side SPA, no backend, no tests. Repo: https://github.com/yonka2019/easygames (branch `main`, tags `vX.Y.Z`, `CHANGELOG.md`).

## Run
- `npm run dev` → http://localhost:25753 (`host: true`, `strictPort`, also on LAN). Same port for `npm run preview`.
- `server.allowedHosts` in `vite.config.js` allows ngrok domains (`.ngrok-free.app/.dev`, `.ngrok.app`, `.ngrok.io`); preview inherits it. Other hosts get Vite's 403 "Blocked request".
- `npm run build` → `dist/`. Verify changes with a build: `npx vite build`.
- `app.url` holds the local URL.
- `Dockerfile`: node:22-alpine build → `nginxinc/nginx-unprivileged` serving `dist/`. Listen port = runtime env `PORT` (default `8080`, must be ≥ 1024), filled into `nginx/default.conf.template` by the nginx entrypoint (`envsubst` on `/etc/nginx/templates/`). Hash router, so no SPA fallback. Runs as a non-root random UID, so OpenShift works; plain `nginx` fails there with `client_temp` permission denied.
- Env (`.env.example`): `VITE_AUTHOR` = footer credit "by …" (default `yonka`). Order: `window.__ENV.author` (runtime) → `import.meta.env.VITE_AUTHOR` (build-time `.env`; Vite reads `.env` only, not `.env.example`; restart dev after changing) → `'yonka'`.
- Runtime config: `index.html` loads `/config.js` (sync, before the app). `public/config.js` = empty `window.__ENV = {}` (dev/preview). Docker: `docker/40-config.sh` (nginx `/docker-entrypoint.d/`) writes `/tmp/config.js` from env at start (`author`; JSON-escaped: control chars dropped, `\` and `"` escaped); nginx `location = /config.js` aliases it, `no-store`. `.env` is dockerignored. `.gitattributes` forces LF on `*.sh` (autocrlf would break the script).

## Stack
Vite 8 (rolldown), React 19, Tailwind v4 (`@tailwindcss/vite`, no config file), Motion (`motion/react`), Phosphor icons (`*Icon` names), Geist + Geist Mono variable fonts (fontsource). Plain JSX, no TypeScript.

## Layout
- `src/main.jsx`: entry, imports fonts and `index.css`. On a game deep link it awaits that game's chunk before the first render (no loading placeholder, no height snap).
- `src/App.jsx`: route switch, page transition (`AnimatePresence`), `MotionConfig reducedMotion="user" skipAnimations={reduce}`, sets `document.title`, global footer (`by {VITE_AUTHOR} · v{version}`, version imported from `package.json`, so a release bump updates it). Scroll-to-top runs in `onExitComplete` (after the old page leaves) to avoid a jump. Layout is `flex min-h-[100dvh] flex-col` + `main.flex-1` so the footer stays at the bottom while pages swap. Preloads every game chunk on idle.
- `src/lib/route.js`: hash router. `#/` = home, `#/g/<id>` = game (exact match), anything else = `missing` → "Game not found". `gameHref(id)`. App restores the home scroll position on return; other pages start at the top.
- `src/lib/store.js`: localStorage scores. Key `easygame:v1` (old name kept on purpose, so saved data survives the rename). Slots `id` or `id:variant` → `{best, plays}`. `_name` keys = misc values (`getValue`/`setValue`, e.g. Word guess streak/daily). Non-object data reads as `{}`. `hasScores()` drives the home Reset button. `resetAll()` keeps `_wordDaily` (today's word stays played). `migrate()` (in `read`) moves old `casino:<mode>` slots to `<mode>` (v2.2 split).
- `src/lib/util.js`: `rand`, `pick`, `shuffle`, `cssVar`, `fmtMs`, `fmtTime`.
- `src/components/Header.jsx`: sticky header, typed wordmark (`WORD`) and theme toggle. Theme key `easygame:theme` (old name kept on purpose; also read inline in `index.html` to avoid a flash).
- `src/components/Home.jsx`: hero + `HeroShowcase` + bento grid of game tiles (games with `group` render together in a full-width `GroupBox` at the first member's spot; `ITEMS`), random-game button, reset scores. Hero intro (blur/rise stagger) plays once per visit (`introPlayed` module flag). All tiles animate in on mount (not on scroll). Tiles preload their game chunk on hover/focus.
- `src/components/HeroShowcase.jsx`: hero right side. Live mini demo per game that has one in `DEMOS` (`SHOWN`; Board: Chess only, Cards: Blackjack only, Casino: Slots only), auto-rotates every 6s (pauses on hover/focus, off under reduced motion), icon tabs + progress line (one Tab stop, arrows/Home/End move), click opens the game.
- `src/components/demos.jsx`: `DEMOS` map id → looping mini demo (scripted, decorative). Driven by `useTick(ms)` (stays 0 under reduced motion = static frame). Type race demo lives in `TypingDemo.jsx`. Add a demo when adding a game.
- `src/components/GameFrame.jsx`: game page shell + `useGame()` context → `{ report(value), ended(), celebrate(), setVariant(v), variant }`. Shows the best score per variant (pill pops on a new best; on a mode change its label cross-fades and its width eases). Bursts fire 200ms after `report`/`ended`/`celebrate`, so they land with the result panel.
- `src/components/FinishBurst.jsx`: finish animation over the game area. `report` → burst (`best` big / `done` small), `ended()` (loss, no score) → grey ring, `celebrate()` (2048 reached) → big burst. Off under reduced motion.
- `src/components/ui.jsx`: `Button` (primary/ghost), `Segmented`, `Stat`, `Result` (end panel: spring in, finish-line sweep, staggered stats, big stat counts up; Enter = play again), `Kbd`, `useEnter`, `Swap` (cross-fade on key change — use for any in-game state swap; `fit` = also animate height, use it for play ↔ result swaps), `Fit` (animates its height, or width with `horizontal`, to follow its content), `EASE`. `Segmented` keeps focus on mouse click (a game's input never blurs).
- `src/games/registry.js`: `GAMES` list. Its order and `size` drive the home bento.
- `src/games/*.jsx`: one default-export component per game. `words.js` = word lists (`COMMON` for typing, `FIVE` for Word guess).
- `src/games/chessLogic.js`, `checkersLogic.js`, `fourLogic.js`: pure rules + PC search per board game (no React; run in the worker and in plain Node). Each exports `<game>Best(state, level)`.
- `src/games/boardWorker.js`: Web Worker running the PC search (`{ id, game, state, level }` → `{ id, move }`). Vite bundles it via `new Worker(new URL('./boardWorker.js', import.meta.url), { type: 'module' })`.
- `src/games/boardKit.jsx`: board game kit. `usePc(game)` → `think(state, level)`, `usePcTurn(active, think, state, level, onMove)` (min 600ms per PC turn, stale answers dropped), `BoardBar` (level picker locked mid-game, move count, New game), `useGridNav` (roving tabindex: arrows, Home/End; spread `nav.cell(i)` on each square) + `FocusRing` (keyboard focus marker drawn above the pieces; the native outline is off on squares because neighbours and pieces paint over it).
- `src/games/chessPieces.jsx`: `ChessPiece` (own SVG set, fixed fills), `PIECE_NAME`, `SQ_LIGHT` / `SQ_DARK` board square colors (chess, checkers, home demo).
- `src/games/cardLogic.js`: pure card rules, no React (deck, blackjack totals/payout, Crazy Eights legal move + PC pick, Yaniv drops/runs/points + PC move). Runs in plain Node, so rule changes can be checked with a script.
- `src/games/cards.jsx`: card kit. `PlayingCard` (`card`, `up`, `size` sm/md/lg; changing `up` flips it), `CardSlot`, `SUIT_ICON`, `suitTint`, `overlap()` + `CARD_W` + `rowWidth()` (rows that overlap cards to fit; the row needs `[container-type:inline-size]`).

## Registry fields
`id, name, blurb, cat (Brain|Reflex|Memory|Puzzle|Classic|Luck), icon, size ('feature' 2x2 | 'wide' 2x1 | 'full' whole row | none), group? (key in `GROUPS` = home box: name, note, icon), tone ('dots'|'lines'|'plain' = tile pattern), better ('high'|'low'), variant (default mode), vlabel?, fmt(score), Component`.
Typing is imported eagerly; all others use `lazyGame()` (= `lazy` + `.preload()`).

## Add a game
1. `src/games/MyGame.jsx` (default export).
2. Add an entry to `GAMES`, and a demo to `DEMOS` in `demos.jsx`.
3. Call `useGame().report(score)` when a run ends (returns `{best, isNew}`), or `ended()` when it ends with no score. Use `setVariant` for modes.

## Styling conventions
- Tokens are CSS vars in `src/index.css`. Dark is the default; light comes from the system or `data-theme`. Light tokens are duplicated (media query + `[data-theme=light]`), so edit both.
- Tailwind colors: `bg, surface, surface-2, line, ink, muted, accent, accent-ink, danger`.
- `.num` = mono tabular numbers. Helpers: `.dot-grid`, `.line-grid`, `.caret-before/after`, `.blink`, `.pop`, `.shake`, `.word-in`.
- Radius: surfaces `rounded-xl`; game cells ≈6px. Max width `1200px`, gutters `px-4 md:px-8`.
- No sharp moves: every in-game state change must animate (fade/scale/slide, 150–300ms). Exception: stimuli that measure reaction (Reaction "go") stay instant.
- Never use `AnimatePresence initial={false}` around content that mounts motion elements later: it silently skips their enter animations (broke casino reels and result panels). Only OK around leaf nodes.
- `html { scrollbar-gutter: stable }` stops the page shifting sideways when the scrollbar appears.
- Reduced motion: every animation is static under `prefers-reduced-motion`. Global: `MotionConfig skipAnimations` (App.jsx, opacity included) + the CSS reset in `index.css` (transitions 0s, keyframes off). Per component: `useReducedMotion` for JS-driven loops (demos, CountUp, burst, WAAPI shakes).
- Size changes (play ↔ result, labels) animate via `Fit`/`Swap fit`, with ease-in-out (not `EASE`: expo-out moves the page below ~70% in the first frames). Numbers whose digit count changes get a fixed width (`min-w-[2ch]`).
- CSS transitions use the `EASE` curve too: `ease-[cubic-bezier(0.16,1,0.3,1)]`. Fades that must stay visible (markers) use `'easeOut'`.

## Notes
- Header wordmark typing speed: `Header.jsx` `step()`. Type 260–400ms/char, delete 120ms, hold 2600ms, empty pause 450ms.
- Icon: `public/favicon.svg` (2x2 bento, one lime tile) + `public/apple-touch-icon.png` (180px, rendered from the SVG). No og:image (user declined).
- Board (`group: 'board'`, home box before Cards; Chess tile is `wide`): `chess`, `checkers`, `four`. All vs the PC, levels `easy` / `normal` / `hard` = the game `variant` (default `normal`). Score = your moves when you win (lower is better); a loss or draw calls `ended()`. The board stays up when a game ends (status line + Enter = new game), no `Result` panel.
  - Chess (`Chess.jsx`): full rules (castling, en passant, promotion picker over the board, mate, stalemate, 50 moves, threefold, bare material). You play White. Board index 0 = a8. PC: alpha-beta + captures-only search + piece-square tables; Easy = 1 ply, no capture search, 20% random move; Normal = depth 3; Hard = deepening for 1.2s.
  - Checkers (`Checkers.jsx`): English rules (forced jumps, multi-jump played hop by hop, kings step one square, a crowned man stops). You move first, up the board. 80 plies without a capture = draw. PC depth 2 (25% random) / 4 / deepening for 0.9s.
  - Four in a row (`Four.jsx`): 7×6, you move first, keys 1–7. PC depth 2 (30% random, never when a four is one move away) / 4 / deepening for 0.7s.
  - Pieces are absolutely placed and keyed by a stable id (`ids` array beside the board), so a move is a CSS `translate` transition; captures fade out via `AnimatePresence`. Render pieces sorted by id: a DOM node React re-inserts loses its transition (the PC's pieces used to jump instead of slide).
  - Rule changes: check with move counts (perft). Chess start = 20 / 400 / 8902 / 197281; checkers start = 7 / 49 / 302 / 1469 / 7361.
  - Theme text token is `--text` (Tailwind name `ink`); there is no `--ink` CSS var.
  - Esc drops the selection in Chess and Checkers. `Four.jsx` reads the game from a ref (`live`) in `drop`, so several keys in one tick play only the first.
- `Swap` sets `pointerEvents: 'inherit'` in `animate`: when `k` returns to a view that is still exiting, Motion revives that element with the exit's `pointer-events: none` (Blackjack's Deal took no clicks after an instant hand under reduced motion).
- Cards (`group: 'cards'`, home box before Casino): `blackjack`, `hilo`, `eights`, `yaniv`. Card = `{ id, s, r }` (`s` = s/h/d/c, `j` = joker; ace `r` = 1).
  - Blackjack (`Blackjack.jsx`): a Casino mode (`BlackjackGame`, shared bank/bets/Cash out, score = peak credits). Hit / Stand / Double, pays 3:2 (rounded to a whole credit), dealer stands on every 17, fresh shuffle per hand. Keys: Space deal, H / S / D. Last credits lost → the table holds 1.3s before the result.
  - Higher or lower (`HiLo.jsx`): ace high, same rank = safe (no point), one miss ends. Score = streak. Keys ↑ ↓.
  - Crazy Eights (`CrazyEights.jsx`) and Yaniv (`Yaniv.jsx`): vs the PC. Score = rounds won in a row; one lost round ends the run. PC moves run on a timer effect keyed on the game state.
  - Crazy Eights: 7 cards each, eights wild (name a suit), draw 1 only when stuck; a drawn card that fits may be played. Both stuck with nothing to draw → fewer cards wins.
  - Yaniv: 5 cards each, 2 jokers (0 pts), A = 1, J/Q/K = 10. Drop 1 card / set / run (jokers fill runs), then draw from the deck or take the first/last card of the last drop. Call at ≤ 7; a tie goes against the caller. PC calls as soon as it can.
  - A run that ends with 0 (first-guess miss, no round won) calls `ended()`, not `report(0)`.
  - Cards move between hand / pile / deck with Motion `layoutId` (= card id) inside a `LayoutGroup` whose id changes per round.
- Casino (`Casino.jsx`): 4 standalone games `slots` / `roulette` (European) / `levels` / `pinpoint`, `group: 'casino'`. One component, `mode` prop fixed per page (named exports `SlotsGame`… loaded via `casino(name)` in the registry, shared chunk); no mode switcher. Also hosts Blackjack (Cards group). Old `#/g/casino` → Slots (`ALIAS` in `byId`). Pinpoint: number 0–100, click its spot on a blank line, 10 rounds, score = avg error (lower better; registry `better` can also be a function of the variant). Play money, start 200 credits (hand-over animation `Deal` on every fresh bankroll), bets 1/5/10/25; score = peak balance (reported on Cash out or broke). Slots: bigger bet adds weight to star/diamond/seven (`BOOST`): return 94.6% / 96% / 97.5% / 99% and big-win odds ×1 / 3.5 / 3.9 / 4.3 for bets 1/5/10/25. Roulette 97.3%. Levels: success rate 100% → −5% per level (min 5%), one miss ends; score = levels cleared.
- Claude run art (world size, sprites, `drawSprite`/`drawCactus`/`drawFly`, jump constants) lives in `src/games/claudeArt.js`, shared by the game and its home preview (canvas autopilot in `demos.jsx`, zoomed to a 380-wide view).
- Claude run (id `dino`, `Dino.jsx`): Claude (12×8 pixel figure from `ClaudeFigure.jsx`, `#d97757`, black eyes) jumps cacti; flying bugs come low (jump only), mid (duck), high (run under) or bobbing. Canvas runner in a fixed 600×170 world scaled to width. rAF loop with clamped delta, hold-to-jump-higher, duck, birds after 200 pts, speed 330→820 px/s. Colors read from CSS vars (refreshed on theme change). Score drawn on canvas.
- Aim trainer: score = avg ms per target; result also shows Precision (avg closeness to center) and Accuracy (misses).
- Home green glow: `useLit()` in `Home.jsx`. 1 random tile every 4s, 1.2s fade. Static random pick under reduced motion.
- Type race (id `typing`, file `Typing.jsx`): Esc or Ctrl+R restarts (Ctrl+R is caught, so the page doesn't reload); Tab restarts only mid-test (otherwise it moves focus). Restart cross-fades the old words out. Max 4 extra letters per word. Words are a memoised `Word` (a keystroke re-renders one word). One caret element glides between letters (measured with layout offsets; the `word-in` fill makes Chrome use the word as the letters' `offsetParent`, so the word's offset is added). `focused` starts true, so the "Click or start typing" hint never flashes on mount.
- Aim trainer: misses show a grey ring at the click; the last 3 hit rings/dots stay mounted so their fades finish.
- Math sprint: wrong answer with all digits typed → input shakes red and clears. Difficulty is locked while the clock runs.
- `Result` inside a `Swap` skips its own fade (springs only); outside a Swap it fades in too.
- Pointer-first cells (Chimp, Sequence) also take keyboard: `onClick` with `e.detail === 0`. Aim and Pinpoint stay pointer-only (aiming).
- Word guess: streak + saved score count Daily only; a Random win plays `celebrate()`.
- 2048: input frozen while an overlay is up; Enter = new game when no moves are left. Minesweeper: Enter = new board after win/loss (focus stays on the board); Flag mode never blocks the first open. Keyboard: cells = roving tabindex (one Tab stop, `cur`), arrows move, Home/End = row edge (Ctrl = board corner), Enter/Space open (native click, so Flag mode applies), F flags.
- Claude run touch: swipe down cancels the tap's rising jump, then ducks.
- Roulette red = `color-mix(danger 72%, black)` so white pocket numbers pass contrast.
- Editing several files at once while dev runs can leave Vite serving a half-saved module; `touch` the files to force a re-transform.
- `.gitignore`: `node_modules`, `dist`, `.playwright-mcp`, `app.url`. `.claude/` is tracked (project commands).
- UI text must stay very short.
