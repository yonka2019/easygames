# easygames

Browser mini-games site (14 games). Pure client-side SPA, no backend, no tests. Repo: https://github.com/yonka2019/easygames (branch `main`, tags `vX.Y.Z`, `CHANGELOG.md`).

## Run
- `npm run dev` → http://localhost:25753 (`host: true`, `strictPort`, also on LAN). Same port for `npm run preview`.
- `npm run build` → `dist/`. Verify changes with a build: `npx vite build`.
- `app.url` holds the local URL.
- Env (`.env.example`): `VITE_AUTHOR` = footer credit "by …" (default `yonka`). Restart dev after changing.

## Stack
Vite 8 (rolldown), React 19, Tailwind v4 (`@tailwindcss/vite`, no config file), Motion (`motion/react`), Phosphor icons (`*Icon` names), Geist + Geist Mono variable fonts (fontsource). Plain JSX, no TypeScript.

## Layout
- `src/main.jsx`: entry, imports fonts and `index.css`.
- `src/App.jsx`: route switch, page transition (`AnimatePresence`), `MotionConfig reducedMotion="user"`, sets `document.title`, global footer (`by {VITE_AUTHOR}`). Scroll-to-top runs in `onExitComplete` (after the old page leaves) to avoid a jump. Layout is `flex min-h-[100dvh] flex-col` + `main.flex-1` so the footer stays at the bottom while pages swap. Preloads every game chunk on idle.
- `src/lib/route.js`: hash router. `#/` = home, `#/g/<id>` = game. `gameHref(id)`.
- `src/lib/store.js`: localStorage scores. Key `easygame:v1` (old name kept on purpose, so saved data survives the rename). Slots `id` or `id:variant` → `{best, plays}`. `_name` keys = misc values (`getValue`/`setValue`, e.g. Word guess streak/daily).
- `src/lib/util.js`: `rand`, `pick`, `shuffle`, `cssVar`, `fmtMs`, `fmtTime`.
- `src/components/Header.jsx`: sticky header, typed wordmark (`WORD`) and theme toggle. Theme key `easygame:theme` (old name kept on purpose; also read inline in `index.html` to avoid a flash).
- `src/components/Home.jsx`: hero + `HeroShowcase` + bento grid of game tiles, random-game button, reset scores. Hero intro (blur/rise stagger) plays once per visit (`introPlayed` module flag). All tiles animate in on mount (not on scroll). Tiles preload their game chunk on hover/focus.
- `src/components/HeroShowcase.jsx`: hero right side. Live mini demo per game, auto-rotates every 6s (pauses on hover/focus, off under reduced motion), icon tabs + progress line, click opens the game.
- `src/components/demos.jsx`: `DEMOS` map id → looping mini demo (scripted, decorative). Driven by `useTick(ms)` (stays 0 under reduced motion = static frame). Type race demo lives in `TypingDemo.jsx`. Add a demo when adding a game.
- `src/components/GameFrame.jsx`: game page shell + `useGame()` context → `{ report(value), ended(), celebrate(), setVariant(v), variant }`. Shows the best score per variant (pill pops on a new best).
- `src/components/FinishBurst.jsx`: finish animation over the game area. `report` → burst (`best` big / `done` small), `ended()` (loss, no score) → grey ring, `celebrate()` (2048 reached) → big burst. Off under reduced motion.
- `src/components/ui.jsx`: `Button` (primary/ghost), `Segmented`, `Stat`, `Result` (end panel: spring in, finish-line sweep, staggered stats, big stat counts up; Enter = play again), `Kbd`, `useEnter`, `Swap` (cross-fade on key change — use for any in-game state swap), `EASE`.
- `src/games/registry.js`: `GAMES` list. Its order and `size` drive the home bento.
- `src/games/*.jsx`: one default-export component per game. `words.js` = word lists (`COMMON` for typing, `FIVE` for Word guess).

## Registry fields
`id, name, blurb, cat (Brain|Reflex|Memory|Puzzle|Classic), icon, size ('feature' 2x2 | 'wide' 2x1 | none), tone ('dots'|'lines'|'plain' = tile pattern), better ('high'|'low'), variant (default mode), vlabel?, fmt(score), Component`.
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
- Reduced motion: every animation is static or disabled under `prefers-reduced-motion` (CSS media query + `useReducedMotion`).

## Notes
- Header wordmark typing speed: `Header.jsx` `step()`. Type 260–400ms/char, delete 120ms, hold 2600ms, empty pause 450ms.
- Icon: `public/favicon.svg` (2x2 bento, one lime tile) + `public/apple-touch-icon.png` (180px, rendered from the SVG). No og:image (user declined).
- Casino (id `casino`, `Casino.jsx`): modes Slots / Roulette (European) / Levels / Pinpoint (variants). Pinpoint: number 0–100, click its spot on a blank line, 10 rounds, score = avg error (lower better; registry `better` can be a function of the variant). Play money, start 200 credits (hand-over animation `Deal` on every fresh bankroll), bets 1/5/10/25; score = peak balance (reported on Cash out or broke). Slots: bigger bet adds weight to star/diamond/seven (`BOOST`): return 94.6% / 96% / 97.5% / 99% and big-win odds ×1 / 3.5 / 3.9 / 4.3 for bets 1/5/10/25. Roulette 97.3%. Levels: success rate 100% → −5% per level (min 5%), one miss ends; score = levels cleared. `fmt(v, variant)` gets the variant.
- Claude run art (world size, sprites, `drawSprite`/`drawCactus`/`drawFly`, jump constants) lives in `src/games/claudeArt.js`, shared by the game and its home preview (canvas autopilot in `demos.jsx`, zoomed to a 380-wide view).
- Claude run (id `dino`, `Dino.jsx`): Claude (12×8 pixel figure from `ClaudeFigure.jsx`, `#d97757`, black eyes) jumps cacti; flying bugs come low (jump only), mid (duck), high (run under) or bobbing. Canvas runner in a fixed 600×170 world scaled to width. rAF loop with clamped delta, hold-to-jump-higher, duck, birds after 200 pts, speed 330→820 px/s. Colors read from CSS vars (refreshed on theme change). Score drawn on canvas.
- Aim trainer: score = avg ms per target; result also shows Precision (avg closeness to center) and Accuracy (misses).
- Home green glow: `useLit()` in `Home.jsx`. 1 random tile every 4s, 1.2s fade. Static random pick under reduced motion.
- Type race (id `typing`, file `Typing.jsx`): Tab, Esc or Ctrl+R restarts (Ctrl+R is caught, so the page doesn't reload).
- Editing several files at once while dev runs can leave Vite serving a half-saved module; `touch` the files to force a re-transform.
- `.gitignore`: `node_modules`, `dist`, `.playwright-mcp`.
- UI text must stay very short.
