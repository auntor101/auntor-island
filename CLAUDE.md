# Auntor Island: project brief for Claude Code

## What this is
A modern anime-style 3D island game for the browser, linked from the owner's Instagram (@101auntojje). You choose a character (man, woman, elf or wizard), walk and later ride a dragon across a big varied island under a day and night sky with stars, a moon, sunrise, sunset and switchable snow. Most visitors are on **mid-range to flagship phones including iPhone**, so every change must stay fast and touch-friendly.

The old small game was replaced on 2026-10-14. It is preserved, untouched, at git branch `archive/old-game`, tag `old-game-final` (source) and tag `old-site-final` (the old live site). Never modify those. Read old code with `git show archive/old-game:js/game.js` when porting (dialogue system, WebAudio engine, quests, cats, snow-globe finale).

## Commands
- `npm install`, `npm run dev` (prints a Network address for the phone), `npm test` (node:test), `npm run build` (writes `dist/`).
- `node tools/shoot.mjs <url> <out.png> [--size 390x844] [--touch] [--wait <regex>] [--delay ms] [--eval js]`: headless Edge screenshots with software GL. fps there is meaningless; **draw calls and triangles are meaningful**. Playwright and Chrome MCP tools are often disconnected, so use this.
- `node tools/touch-check.mjs`: real touch events through the select screen and stick (needs a server).

## Layout
- `index.html`, `vite.config.js` (base `./`, so the same build works at a site root or sub-folder).
- `src/render` renderer, post-processing (bloom, ACES, SMAA), frame-time governor. `src/world` island shape (`island.js`: pure `heightAt`, `zoneAt`, `LANDMARKS`, `SEA_STACKS`), chunked terrain, sky, water, time of day, stars, moon, snow. `src/play` player, controls, camera, roster, attachments. `src/ui` HUD and select screen. `src/profile.js` name rules.
- `public/models` four VRM characters and portraits, `public/world` cat, dog, trees (CC0), `public/_headers` Cloudflare headers.
- `scripts/` offline asset tools (fetch roster, shrink VRM, portraits). `demo/` small harness pages. `test/` unit tests for the pure modules. `docs/superpowers/` specs and plans (start with `plans/2026-10-14-master-roadmap.md`).
- `CREDITS.md` licence of every asset. Everything shipped is CC0 or has a verified permissive embedded licence.

## Look rules
Modern anime/storybook: cel shading, warm palette, sharp silhouettes, painted surfaces. Tone mapping is ACES in the composer, so judge colours in screenshots. Paper UI: cream `#fff7ea`, ink `#2a1f3d`, coral `#ff7a59`, Fraunces and Nunito. Units are metres (person 1.75 m, island about 300 m across, 1 unit = 1 m).

## Performance rules
Goals (to be proven on a real phone): 60 fps flagship, at least 45 mid-range; about 300 draw calls and 600k triangles in the busiest view; first playable load about 8 MB or less. Instance repeated things, build per 32 m chunk, no real-time shadows, keep fragment shaders to a few noise octaves, no per-frame allocation in hot loops. A frame-time governor lowers the pixel ratio before frames drop.

## Working rules
- Plain JavaScript ES modules, no TypeScript, no UI framework, smallest working change (ponytail). Reuse and port before rewriting.
- Tests first for pure logic. Every feature ends with a real-browser screenshot critique at 390x844 and 844x390, measured draw calls and triangles, an independent code review and (for input, storage, network or new files) a security review.
- Commits use the GitHub no-reply identity already configured here; never commit a personal email. End commit messages with the `Co-Authored-By` trailer.
- Names are shown with `textContent` only. Storage reads are try/catch and validated. Third-party assets only if their licence is verified.
- Content rules: PG-13, no gore, fictional names for characters and politics, nothing aimed at real people or at festivals and their communities. The death screen is slapstick: "You died successfully. Wanna try again?".

## Code map (graphify)
A free code graph of `src/` lives in `graphify-out/` (git-ignored; rebuilt by git hooks or `graphify update src`). Ask it before reading files: `graphify query "what calls stepPlayer" --graph graphify-out/graph.json`, `graphify explain "createLife"`, `graphify path "main.js" "createWater"`. Install: `pip install graphifyy` (CLI `graphify`). `graphify-out/GRAPH_REPORT.md` lists the module communities.

## Known gaps
Village, flora, animals, companion and sound exist. Still missing: trails and minimap (in progress), dragon-island landmarks, cast and quests, riding, vehicles and crash screen, festivals, analytics; real-phone performance unverified. See the roadmap.

## Deploy
Cloudflare Pages/Workers builds with `node tools/build-site.js` (runs `vite build`) and serves `dist/` using `wrangler.jsonc`; GitHub Pages serves the same `dist/` from the `gh-pages` branch. Never publish the repo root.
