Sync this repo from X:\EXT-VP\easygames — everything except the "Send review" button (ReviewBox).

Source: `X:\EXT-VP\easygames` (read-only, never change it). Target: this repo.

1. Source must be clean (`git status --short`); if not, stop and tell me. Uncommitted earlier syncs here are fine. If `CLAUDE.md` doesn't apply: copy the source's and redo steps 4–5 on it.
2. Base = this repo's `package.json` version → tag `v<version>` in the source. Nothing newer there → say "up to date" and stop.
3. In the source: `git diff --binary v<version> HEAD -- . ':!src/components/ReviewBox.jsx' ':!.github'` → `git apply` it here. Conflict → stop and show it.
4. Remove every ReviewBox piece that came along:
   - `src/App.jsx`: `ReviewBox` import + `<ReviewBox />`.
   - `src/index.css`: the `.rb-*` block and its reduced-motion rule.
   - `vite.config.js`: `REVIEWBOX_` in `envPrefix`.
   - `docker/40-config.sh`, `public/config.js`, `Dockerfile`, `.env.example`: `REVIEWBOX_*` / `reviewbox*`. Edit `40-config.sh` with the Edit tool (shell `sed`/heredoc eats its backslashes); keep LF.
   - `README.md`, `CHANGELOG.md`, `CLAUDE.md`: ReviewBox lines.
5. Keep this repo's own differences:
   - `CLAUDE.md` repo URL stays `https://github.com/yonka2019/easygames`.
   - No `.github/workflows/on-tag.yml` here (deleted on purpose): don't restore it, drop lines that mention it.
6. Check: `grep -rniE 'reviewbox|rb-' . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist` → no hits. Then `npx vite build` (no `node_modules` → ask before `npm ci`).
7. Report what came over (versions, changelog lines). Do NOT commit, push or tag.
