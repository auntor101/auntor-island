# Dragon Isle Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new Vite and current-three.js app in `web/` that shows a huge, good-looking anime-style island and lets you walk across it as a real anime character, streaming terrain so it stays fast on modern phones.

**Architecture:** `web/` is a separate app next to the old game (which keeps running and deploying until the new one replaces it). Pure logic (island shape, zones, chunk maths) lives in small modules with `node:test` tests; rendering modules use it. Terrain is built per 32-unit chunk with two detail levels and loaded and unloaded around the camera. The hero is a VRM character with the MToon anime shader and a procedural walk.

**Tech Stack:** Vite 8, three 0.186, `@pixiv/three-vrm` 3.5, `postprocessing` 6.39, plain JavaScript modules, `node:test`.

**Not in this plan:** buildings, villagers, cats and dogs, dragons, quests (later plans). Trees reuse the already-prepared nature models.

## Global Constraints

- Plain JavaScript ES modules, no TypeScript, no UI framework. Smallest working code (ponytail): no abstractions or options nobody needs yet.
- Units: 1 unit is 1 metre. A person is about 1.75 high, a tree 8 to 12, the island land radius about 150 (so about 300 across, roughly 20 times the old island relative to a character).
- Target devices: mid-range to flagship phones including iPhone (roughly iPhone 12 and newer). Goals: 60 fps flagship, at least 45 mid-range; about 300 draw calls and about 600k triangles in the busiest view; first playable load about 8 MB; a frame-time governor lowers pixel ratio before frames drop. These are goals to be measured, not promises.
- Look: anime and storybook-cartoon: clean cel shading, warm palette, soft haze, sharp silhouettes. Keep the existing paper UI tokens (cream `#fff7ea`, ink `#2a1f3d`, coral `#ff7a59`, Fraunces and Nunito).
- Phone first: touch controls, safe-area insets, 44 px or larger targets, no horizontal scroll; keyboard and mouse also work.
- Do not touch the old game files outside `web/` and docs, except where a task says so.
- Every task ends with `npm test` (inside `web/`) green and a commit. Commit messages end with a blank line and `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Repo author identity is already set to the GitHub no-reply address; never change it.

## File Structure

| File | Responsibility |
|---|---|
| `web/package.json`, `web/vite.config.js`, `web/index.html` | App shell, scripts `dev`, `build`, `test` |
| `web/src/main.js` | Boot, renderer, loop, governor wiring |
| `web/src/render/renderer.js` | Renderer, post-processing, pixel-ratio governor |
| `web/src/world/island.js` | Pure: `heightAt`, `zoneAt`, `coastRadius`, landmarks, sea stacks |
| `web/src/world/chunks.js` | Pure chunk maths plus `ChunkManager` (build, detail levels, load and unload) |
| `web/src/world/terrain.js` | Builds one chunk's mesh with colours from zone and slope |
| `web/src/world/sky.js`, `web/src/world/water.js` | Painted sky dome with sun, water plane with shore foam |
| `web/src/play/player.js`, `web/src/play/controls.js`, `web/src/play/camera.js` | Walking, input (touch and keyboard), spring camera |
| `web/src/play/hero.js` | VRM hero loading and procedural walk |
| `web/src/ui/hud.js` | Minimal HUD plus a dev stats panel (fps, draw calls, triangles) |
| `web/test/*.test.js` | `node:test` tests for the pure modules |

---

### Task 1: Scaffold the Vite app

**Files:**
- Create: `web/package.json`, `web/vite.config.js`, `web/index.html`, `web/src/main.js`, `web/src/render/renderer.js`, `web/.gitignore`
- Modify: root `.gitignore` (add `web/node_modules/`, `web/dist/`)

**Interfaces:**
- Produces `createRenderer(canvas) -> { renderer, composer, render(scene, camera), setPixelRatio(n), resize(), stats() }` where `stats()` returns `{ calls, triangles, fps, pixelRatio }`.
- Produces `startLoop(update) -> stop`, where `update(dt, now)` receives `dt` clamped to at most 0.05 s.
- `npm run dev`, `npm run build`, `npm test` all work inside `web/`.

- [ ] **Step 1:** In `web/`, run `npm init -y`, then `npm install three@0.186.1 @pixiv/three-vrm@3.5.5 postprocessing@6.39.5` and `npm install -D vite@8.3.4`. Set `"type": "module"` and scripts `"dev": "vite --host"`, `"build": "vite build"`, `"preview": "vite preview --host"`, `"test": "node --test test/"`. Pin exact versions (no carets).
- [ ] **Step 2:** `index.html`: a full-viewport `<canvas id="gl">`, `<div id="hud">`, the viewport meta with `viewport-fit=cover`, theme colour, title `Auntor Island`, the paper CSS tokens and the two fonts, `touch-action:none` on the canvas, and a module script `/src/main.js`. A favicon as an inline SVG (reuse the old one).
- [ ] **Step 3:** `renderer.js`: a `WebGLRenderer` (antialias off, power preference high-performance, `outputColorSpace` sRGB, ACES filmic tone mapping with exposure about 1.0), an `EffectComposer` from `postprocessing` with a render pass, bloom (threshold about 0.85, intensity modest) and SMAA or FXAA, `setPixelRatio` clamped to `min(devicePixelRatio, 2)`, resize handling, and a frame-time governor: track a moving average of frame time; if above 20 ms for 2 seconds lower the pixel ratio by 0.25 (not below 1), if below 12 ms for 5 seconds raise it by 0.25 up to the ceiling. `stats()` reads `renderer.info.render` (reset each frame) and the moving fps.
- [ ] **Step 4:** `main.js`: a scene with a placeholder lit ground and a rotating test cube, the loop, and a stats overlay in the HUD (fps, calls, triangles, pixel ratio) toggled by a small button.
- [ ] **Step 5:** Run `npm run build` (must succeed, report the bundle size) and `npm run dev` in the background; open it with a browser tool (Playwright, chrome-devtools or claude-in-chrome MCP; load with ToolSearch if deferred) at 390 by 844, confirm the cube renders and the stats show numbers, no console errors besides a favicon 404 if any. Stop the server. Commit: `feat: vite app scaffold with renderer and governor`.

---

### Task 2: The island shape (pure logic, tested)

**Files:**
- Create: `web/src/world/island.js`, `web/test/island.test.js`

**Interfaces:**
- `heightAt(x, z) -> number` (metres above the sea surface at y = 0; sea floor negative), deterministic, smooth (no cliffs unless intended).
- `zoneAt(x, z) -> 'sea'|'beach'|'village'|'meadow'|'forest'|'roost'|'mountain'|'glacier'|'volcano'|'grove'|'tower'|'cove'`.
- `coastRadius(theta) -> number` (radius of the shoreline at an angle).
- `LANDMARKS` object with `{ x, z }` for `village`, `roost`, `mountain`, `volcano`, `beach`, `tower`, `grove`, `cove`, `spawn`, plus `SEA_STACKS` array of `{ x, z, h }`.

- [ ] **Step 1: Write the failing test** `web/test/island.test.js` using `node:test` and `node:assert/strict`. It imports `../src/world/island.js` and checks:
  - determinism: calling `heightAt(12.3, -45.6)` twice gives the same value;
  - the sea: `heightAt` at radius 260 in 16 directions is below -2 and `zoneAt` is `'sea'`;
  - land area: sample a 5-unit grid over [-300, 300]; count cells with `heightAt > 0`; area (count times 25) is between 55,000 and 95,000 square units (about 20 times the old island);
  - land radius: the farthest land cell from the origin is between 130 and 190 and the nearest sea cell in some direction is below 200;
  - `LANDMARKS.spawn`: `heightAt` between 1.2 and 6, local slope (max difference to the 4 neighbours at 1 unit) below 0.3, `zoneAt` is `'village'`;
  - `LANDMARKS.mountain`: height at least 55; `LANDMARKS.volcano`: height at least 40; `LANDMARKS.beach`: height between 0.1 and 1.6; `LANDMARKS.tower`: between 8 and 35; `LANDMARKS.grove`: between 3 and 14; `LANDMARKS.roost`: at least 15 and has a cliff: the maximum slope within 10 units is above 1.0; `LANDMARKS.cove` is `'cove'` with height between 0 and 2;
  - every landmark's `zoneAt` equals its own name (except `spawn`, `village`);
  - sea stacks: at least 5 entries, each outside the coast (`heightAt(x,z)` of the stack at the stack position is at least `h - 3`, and the 12 unit ring around it, average height below -1.5), `h` between 8 and 30;
  - every `zoneAt` value in the list above appears somewhere on the grid.
- [ ] **Step 2:** Run `npm test` and see it fail (module missing).
- [ ] **Step 3: Implement** `island.js`. Design guidance (choose the numbers to satisfy the test; keep it small): a coastline `coastRadius(theta)` of about 150 times (1 plus 0.16 times a few summed sines of theta); a land mask by smoothstep across the coast; rolling base hills from two or three octaves of cheap value or sine noise, damped near the coast and in the village; the **village** flat at the centre (landmark spawn near the origin); the **mountain** a broad Gaussian peak to the north (negative z) with a **glacier** zone above a height threshold; the **volcano** a cone with a crater to the east; **roost** cliffs on the west coast (steep falloff to the sea); **beach** flats of sand at the south-west coast with gentle slope; **tower** headland to the north-east; **grove** a lowland valley to the west with its own zone disc; **cove** a small sheltered bay on the south coast; **sea stacks** as steep narrow Gaussians placed just offshore around the island from a seeded list. `zoneAt` is derived from the landmarks' discs plus height and slope rules, with `meadow` and `forest` as the lowland fallbacks by a noise threshold. Export small helpers only if the tests need them.
- [ ] **Step 4:** Run `npm test`, adjust the numbers until green, run it twice to confirm determinism.
- [ ] **Step 5:** Write a one-off debug script `web/tools/island-map.mjs` that prints an ASCII map of the zones (60 columns by 30 rows) so the shape can be eyeballed, run it, and include the output in your report. Commit: `feat: island height and zone functions`.

---

### Task 3: Chunked terrain, sky and water

**Files:**
- Create: `web/src/world/chunks.js`, `web/src/world/terrain.js`, `web/src/world/sky.js`, `web/src/world/water.js`, `web/test/chunks.test.js`
- Modify: `web/src/main.js`

**Interfaces:**
- `chunkKey(cx, cz) -> string`, `chunkOf(x, z) -> {cx, cz}` (32-unit cells), `chunksAround(x, z, radius) -> {cx, cz}[]` sorted nearest first, `lodFor(distance) -> 0|1|2` (0: 33 by 33 vertices up to 80 units, 1: 17 by 17 up to 160, 2: 9 by 9 beyond).
- `class ChunkManager { constructor(scene, material); update(cameraPos) ; dispose() }` builds at most 2 chunk meshes per frame, removes chunks beyond the view radius (about 220 units on flagship), swaps detail level with a short cross-over (no gaps at seams: use skirts or matching edge vertices).
- `buildChunkMesh(cx, cz, lod) -> THREE.Mesh` using `heightAt` and `zoneAt`/slope for vertex colours (grass, forest floor, rock on slopes, sand, black sand near the beach, snow on the glacier, ember rock on the volcano) with a toon-friendly material (`MeshToonMaterial` with a 4-step gradient map, vertex colours, fog).
- `createSky() -> {mesh, update(sunDir)}` a large inverted sphere with a painted gradient (warm horizon, deep zenith), a sun disc and soft cloud bands, no depth writes. `createWater(radius) -> {mesh, update(time)}` a large plane at y = 0 with a shader: colour depth from the height field sampled by distance to shore (use a small baked low-resolution texture of `heightAt` clamped, no depth buffer), foam along the shore, gentle wave normals, fog.

- [ ] **Step 1: Failing test** `web/test/chunks.test.js`: `chunkOf(0,0)` is (0,0); `chunkOf(-0.1, 31.9)` is (-1, 0); `chunksAround(0,0,100)` includes (0,0), is sorted by distance, and has no duplicates; `lodFor(10)` is 0, `lodFor(100)` is 1, `lodFor(300)` is 2; and the number of chunks within radius 220 is below 220 (a sanity cap).
- [ ] **Step 2:** See it fail, implement the pure functions in `chunks.js` (keep `ChunkManager` in the same file but importing three only inside it so the pure functions load under Node: use a dynamic import or keep three-dependent code behind a separate export file `chunk-manager.js` if the import breaks the test), see it pass.
- [ ] **Step 3:** Implement `terrain.js`, `sky.js`, `water.js` and `ChunkManager`; in `main.js` replace the placeholder ground: fog colour matched to the sky horizon, fog near 80 and far 260, camera far 600, a hemisphere light plus one warm directional light (no shadows yet), the `ChunkManager` updated each frame around a free-fly debug camera (WASD plus touch drag) placed above the village.
- [ ] **Step 4: Look and measure.** Serve the app, open at 390 by 844 (touch emulation) and at 1280 by 720. Take screenshots from: the spawn looking at the mountain, high over the whole island, the beach at sunset, the volcano. Read `stats()`: report draw calls, triangles, fps (headless numbers are indicative only; say so). Check there are no gaps or cracks between chunks and different detail levels, no popping you can see when moving at running speed, the water meets the shore cleanly, and the mood is warm and anime-storybook, not flat. Tune colours, fog and light until they are. Save the screenshots to `web/shots/` (git-ignored).
- [ ] **Step 5:** `npm test` and `npm run build` green. Commit: `feat: chunked terrain, painted sky and shore water`.

---

### Task 4: Walk the island as an anime hero

**Files:**
- Create: `web/src/play/player.js`, `web/src/play/controls.js`, `web/src/play/camera.js`, `web/src/play/hero.js`, `web/scripts/prepare-hero.mjs`, `web/public/models/` (hero), `web/test/player.test.js`
- Modify: `web/src/main.js`, `web/src/ui/hud.js` (create)

**Interfaces:**
- `stepPlayer(state, input, dt, heightAt) -> state` pure: `state = {x, z, y, heading, speed}`, `input = {x, y, run}` (stick values in [-1, 1]); acceleration and friction, walk 2.2 m/s and run 5.5 m/s, heading turns toward the move direction, y follows `heightAt` with slope limiting (cannot climb slopes steeper than 1.2, slides back), stays out of deep water (y below -0.6 blocks movement).
- `createControls(canvas, hud) -> {read() -> {x, y, run, lookDX, lookDY}}`: left-half touch joystick, right-half drag to look, tap-hold for run, keyboard WASD/arrows plus Shift, mouse drag to look.
- `createCamera(camera) -> {update(playerState, lookDX, lookDY, dt)}`: third person, distance about 4.5, shoulder offset, spring damping, collision with the terrain height so it never goes under the ground, a small field-of-view kick with speed.
- `loadHero() -> Promise<{root, update(dt, speed, heading)}>` loads `/models/hero.vrm` with `GLTFLoader` plus `VRMLoaderPlugin` (three-vrm), uses `VRMUtils.rotateVRM0` as needed, MToon materials left as authored, and drives a **procedural walk** on the normalised humanoid bones (leg and arm swing, slight torso twist, bob) from `speed`, plus blink and idle breathing through `vrm.expressionManager` and humanoid bones, and head look-at disabled for now.

- [ ] **Step 1: Failing test** `web/test/player.test.js` for `stepPlayer` with a flat `heightAt = () => 2`: pushing forward for 1 second reaches about walk speed and moves in the heading direction; with `run` the speed rises toward 5.5; zero input decelerates to a stop in under 1 second; with a steep wall (`heightAt = (x) => x > 5 ? 10 : 2`) the player cannot pass x = 5; with a sea (`heightAt = () => -3`) the player does not move. See it fail, implement, see it pass.
- [ ] **Step 2: The hero asset.** Download the three-vrm sample `VRM1_Constraint_Twist_Sample.vrm` with `gh api repos/pixiv/three-vrm/contents/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm -H "Accept: application/vnd.github.raw" > assets-src/hero-sample.vrm` (its own embedded licence says everyone may use, modify and redistribute it, no credit needed; record it in `assets/CREDITS.md`). Treat it as untrusted data: only read it with the VRM loader or a JSON/binary parser. `prepare-hero.mjs` shrinks its textures (about 19 images, some 4096 px) to at most 1024 px WebP or JPEG using `sharp` (devDependency) and repacks the file so that the VRM extension JSON (`VRMC_vrm`, `VRMC_springBone`, `VRMC_materials_mtoon`, node constraints) is preserved byte for byte, writing `web/public/models/hero.vrm`. Target under 4 MB; if you cannot repack safely, copy the file as it is and report the size and why. Verify by loading it in the app and reading the VRM meta.
- [ ] **Step 3:** Implement `controls.js`, `camera.js`, `player.js`, `hero.js`, wire into `main.js` (player starts at `LANDMARKS.spawn`, hero root follows the player, chunk manager follows the player, the debug fly camera is kept behind a `?fly` URL flag), add a small HUD: the stats toggle and a joystick drawn in CSS.
- [ ] **Step 4: Look and measure.** In a real browser at 390 by 844 with touch emulation, spawn, take screenshots of the hero from behind and from the side standing and walking, and a wide shot with the island behind. Judge honestly against the bar "modern anime, sharp, proper proportions, no floating feet, no clipping, smooth": report what is not good and fix what is cheap to fix (foot placement to ground, scale about 1.7 to 1.8 m, shading, outline thickness, lighting tuned so the skin does not blow out under bloom). Record draw calls, triangles and frame time while walking. Check that walking up a steep slope slides back and the camera never enters the ground.
- [ ] **Step 5:** `npm test` and `npm run build` green. Commit: `feat: walk the island as a VRM anime hero`.

---

### Task 5: Docs and the real-phone checklist

**Files:**
- Create: `web/README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1:** `web/README.md` with: what this app is, how to run (`npm install`, `npm run dev`, then open the printed network URL on your phone on the same Wi-Fi), controls, the goals table, and a short **real-device checklist** (open the link on your phone, walk for a minute, report: device model, whether it ran smoothly, any stutter or crashes, the stats panel numbers, and a screenshot).
- [ ] **Step 2:** In `CLAUDE.md` add a "New app in web/" section: the structure, the stack, that the old game is still at the root and deployed until replaced, and the commands.
- [ ] **Step 3:** `npm test` green in `web/` and at the root, commit: `docs: describe the web app and phone checklist`.

---

## Self-Review

**Coverage.** 20 times island (Tasks 2 and 3), anime hero (Task 4), mobile-first controls (Task 4), performance machinery and measurement (Tasks 1, 3, 4), lean stack (Task 1), real-device path (Task 5). Wizards, elves, buildings, people, cats, dragons and quests are later plans, as the design says.

**Placeholders.** Terrain colours and island numbers are deliberately left to the implementer to tune against the stated tests and the screenshot bar; the tests pin the observable properties.

**Known risks.** Repacking the VRM without losing its extension data is the fragile part; the fallback is to ship it unshrunk for now. The headless browser numbers do not predict a real phone. Chunk seams and water-shore colouring are visual and are checked by eye.
