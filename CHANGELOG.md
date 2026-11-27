# Changelog

## [v2.5.1] : 2026-11-27

- Snake: slower. Start step 130 → 175ms, top speed 60 → 95ms.

## [v2.5.0] : 2026-11-24

- Cards: Hold'em vs 3 PCs (score = hands won), Solitaire (Draw 1 / Draw 3), FreeCell (score = time). Click or drag cards, unlimited undo.
- Casino and Blackjack: bigger bets 50 / 100 / All in.
- Checkers: rule switches in a Rules dropdown (Must jump, Flying kings, Men jump back, Take most). All off by default, so jumps are now optional.

## [v2.4.1] : 2026-11-24

- Repo: `.claude/` is tracked now (project command `sync-from-ext-vp`).

## [v2.4.0] : 2026-11-22

- New "Board" box, you vs the PC (Easy / Normal / Hard): Chess, Checkers, Four in a row. Score = fewest moves to win, per level.
- New "Cards" box: Blackjack (play money), Higher or lower, Crazy Eights and Yaniv vs the PC.
- Home: live demos for Chess and Blackjack.
- Fix: a button could stop taking clicks after a quick view change (seen under reduced motion).

## [v2.3.0] : 2026-11-02

- Minesweeper: keyboard play. Arrows move, Enter/Space open, F flags, Home/End jump.

## [v2.2.0] : 2026-11-02

- Casino split into 4 standalone games: Slots, Roulette, Levels, Pinpoint (own page, own best).
- Home: the 4 games sit in a "Casino" group box. Claude run tile is full width.
- Old Casino scores carry over; old `#/g/casino` links open Slots.

## [v2.1.0] : 2026-11-02

----------- ENV CHANGES -------------
- `VITE_AUTHOR` (changed): Docker image now reads it at container start (`docker run -e VITE_AUTHOR=...`). Build-time `.env` still works.
---------------------------------------

- Runtime config: Docker env is applied at container start via `/config.js` (no rebuild).

## [v2.0.0] : 2026-11-01

----------- ENV CHANGES -------------
- `PORT` (new, Docker runtime): listen port. Default `8080`, must be ≥ 1024.
---------------------------------------

- BREAKING: container port 80 → 8080. Point Services/Routes at `8080`.
- Docker image runs as non-root (OpenShift ready; fixes `client_temp` permission denied).
- Listen port set by `PORT` env.

## [v1.0.1] : 2026-10-31

- Type race: caret no longer jumps back to the line start after the first word.

## [v1.0.0] : 2026-10-31

- First stable release.

## [v0.5.0] : 2026-10-31

- Docker image (nginx serving the built site).
- Tag push builds the image → GitHub release + S3 zip.

## [v0.4.0] : 2026-10-31

- Site version shown in the footer.

## [v0.3.0] : 2026-10-31

- Smoother animations: play ↔ result swaps ease their height, burst lands with the result panel.
- Type race: gliding caret, faster typing (no lag), restart cross-fade, no focus-hint flash.
- Aim trainer: miss marker, hit fades finish, no console errors.
- Math sprint: wrong answer shakes and clears; difficulty locked mid-run; steady number row.
- Reduced motion: everything static now (fades too).
- Keyboard: Chimp and Sequence playable, Type race Tab no longer traps, hero tabs use arrows.
- Enter starts a new game in 2048 and Minesweeper.
- Word guess: streak counts Daily only.
- Fixed: Reset button hidden with some scores, corrupt storage breaking saves, 2048 moving under its overlay, Minesweeper flag mode first click, bad links opening a game.
- Back to home keeps your scroll spot.
- Better contrast (typing words, roulette numbers).
- Dev server allows ngrok hosts.

## [v0.2.0] : 2026-10-30

- New game: Claude run (offline-dino style runner, cacti and flying bugs).
- Casino: Pinpoint mode (find the number on a 0–100 line).
- Casino: 200 starting credits with a hand-over animation.
- Casino: bigger bets make big wins likelier; bets above balance disabled.
- Fixed: casino reels and result panels not animating.
- Home preview of Claude run uses the real game art.

## [v0.1.0] : 2026-10-29

----------- ENV CHANGES -------------
- `VITE_AUTHOR` (new): footer name "by …". Default `yonka`.
---------------------------------------

- 13 browser games: type race, math sprint, reaction, aim trainer, number memory, sequence, word guess, snake, minesweeper, chimp test, memory pairs, 2048, casino.
- Casino: slots, roulette, levels. Play money.
- Home hero showcase with live demos per game.
- Smooth animations in all games, finish burst on run end.
- Aim trainer precision stat.
- Type race: Tab, Esc or Ctrl+R restarts.
- Scores saved in the browser only.
- Site icon.
