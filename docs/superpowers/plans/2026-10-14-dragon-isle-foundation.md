# Dragon Isle Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new Vite and current-three.js app in `web/` that shows a huge, good-looking anime-style island and lets you walk across it as a real anime character (man, woman, elf or wizard), with sunrise, sunset, a starry night with a moon, and toggleable snow, streaming terrain so it stays fast on modern phones.

**Architecture:** `web/` is a separate app next to the old game (which keeps running and deploying until the new one replaces it). Pure logic (island shape, zones, chunk maths) lives in small modules with `node:test` tests; rendering modules use it. Terrain is built per 32-unit chunk with two detail levels and loaded and unloaded around the camera. The hero is a VRM character with the MToon anime shader and a procedural walk.

**Tech Stack:** Vite 8, three 0.186, `@pixiv/three-vrm` 3.5, `postprocessing` 6.39, plain JavaScript modules, `node:test`.

**Not in this plan:** buildings, villagers, cats and dogs, dragons, quests (later plans). Trees reuse the already-prepared nature models.

## Global Constraints

- Plain JavaScript ES modules, no TypeScript, no UI framework. Smallest working code (ponytail): no abstractions or options nobody needs yet.
- Units: 1 unit is 1 metre. A person is about 1.75 high, a tree 8 to 12, the island land radius about 150 (so about 300 across, roughly 20 times the old island relative to a character).
- Target devices: mid-range to flagship phones including iPhone (roughly iPhone 12 and newer). Goals: 60 fps flagship, at least 45 mid-range; about 300 draw calls and about 600k triangles in the busiest view; first playable load about 8 MB; a frame-time governor lowers pixel ratio before frames drop. These are goals to be measured, not promises.
- Look: anime and storybook-cartoon: clean cel shading, warm palette, soft haze, sharp silhouettes. Keep the existing paper UI tokens (cream `#fff7ea`, ink `#2a1f3d`, coral `#ff7a59`, Fraunces and Nunito).
- Phone first: touch controls, safe-area insets, 44 px or larger targets, no horizontal scroll; keyboard and mouse also work.
- Sky: the day and night cycle (sunrise, noon, sunset, night with a sky full of stars and a moon) and the snow effect are required features, each switchable from the HUD, and they must cost only a handful of draw calls.
- Characters: man, woman, elf and wizard are required and playable; only characters with a verified CC0 or permissive embedded licence are used; elves and wizards are built from CC0 characters with attached ears, robes, hats and staffs.
- No AI image or 3D generation is used in this plan (no API keys, no credits, and the local GPU is too small); the sky is procedural and the characters are real models.
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
| `web/src/world/time.js`, `stars.js`, `moon.js`, `snow.js` | Day and night palette (pure), starfield, procedural moon, snow |
| `web/src/play/roster.js`, `attachments.js`, `web/src/ui/select.js` | The four playable characters, elf ears, wizard hat and robe, select screen |
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

### Task 4: Time of day, starry night, moon, sunrise, sunset and snow

**Files:**
- Create: `web/src/world/time.js`, `web/src/world/stars.js`, `web/src/world/moon.js`, `web/src/world/snow.js`, `web/test/time.test.js`
- Modify: `web/src/world/sky.js`, `web/src/world/terrain.js` (snow cover uniform), `web/src/main.js`, `web/src/ui/hud.js`

**Interfaces:**
- Pure, tested, in `time.js`: `sunDirection(hours) -> [x, y, z]` unit vector (the sun rises in the east at 6, is highest at 12, sets in the west at 18, is below the horizon otherwise); `moonDirection(hours) -> [x, y, z]` (opposite the sun); `skyPalette(hours) -> { zenith, horizon, sunColor, sunIntensity, ambient, fog, stars, moon }` where colours are `#rrggbb` strings and `stars` and `moon` are 0 to 1 visibility; hours wrap at 24; palette keyframes at about 0, 5, 6.5, 12, 17.5, 19, 21 with smooth interpolation (deep navy night, pink and gold sunrise, clear blue day with a warm horizon, orange-magenta sunset, then dusk).
- `createStars() -> { points, update(time, visibility) }`: about 3000 stars on a large sphere, a magnitude distribution (a few bright, most faint), a denser band along one great circle (a milky way), per-star twinkle in the shader, fade with `visibility`, no depth write, follows the camera.
- `createMoon() -> { group, update(hours, phase, visibility) }`: a disc with a procedural crater look (noise based, no image files), phase lighting by a uniform (new, crescent, half, gibbous, full), a soft glow sprite, placed on `moonDirection`; `phase` advances one step per in-game day.
- `createSnow(camera) -> { points, setEnabled(bool), update(time) }`: about 4000 flakes in a box around the camera that wrap in the vertex shader (no per-frame JavaScript loop), gentle wind, soft round sprites, flake size scaled by distance; when enabled the terrain gets a snow cover (a uniform that whitens up-facing surface colours) and fog is a little whiter and closer.
- HUD controls (large thumb-friendly toggles in a collapsible panel): **Time** Auto, Dawn, Day, Sunset, Night; **Snow** on or off; the choices persist in `localStorage` inside try/catch. Auto is a full day in about 6 real minutes; choosing a fixed time pauses the cycle.

- [ ] **Step 1: Failing test** `web/test/time.test.js`: `sunDirection(12)[1] > 0.8`; `sunDirection(0)[1] < -0.8`; `Math.abs(sunDirection(6)[1]) < 0.1` and the same at 18, with x of opposite signs at 6 and 18; `moonDirection(h)` is the negation of `sunDirection(h)` for several `h`; `skyPalette(12).stars === 0` and `skyPalette(0).stars === 1` and `skyPalette(0).moon === 1`, `skyPalette(12).moon === 0`; `skyPalette(24)` equals `skyPalette(0)`; continuity: stepping `h` by 0.05 from 0 to 24 the largest change in any RGB channel of `zenith`, `horizon` and `fog` between steps is below 0.06; colours parse as `#rrggbb`. See it fail.
- [ ] **Step 2:** Implement `time.js` until green.
- [ ] **Step 3:** Implement `stars.js`, `moon.js`, `snow.js`, extend `sky.js` so the dome gradient, sun disc, cloud tint, light colour and intensity, ambient, and fog all follow `skyPalette`, and add the terrain snow-cover uniform. Wire everything in `main.js` and `hud.js`. Keep fog and water colours in step with the palette so the horizon always blends.
- [ ] **Step 4: Look and measure.** In a real browser at 390 by 844 and 1280 by 720 take screenshots at 05:30 (sunrise), 12:00, 18:00 (sunset), 00:00 (a sky full of stars and the moon), and snow on at day and at night. Judge honestly: stars should read as a rich sky, not a few dots; the moon should look like a moon with a soft glow; sunrise and sunset should have warm gradients and a visible sun; nothing flickers; snow flakes are soft and not distracting; the terrain, water, trees and the character stay readable at night (do not go black; keep a cool blue ambient). Measure draw calls, triangles and frame time with every effect on; the effects must add only a handful of draw calls. Tune until good.
- [ ] **Step 5:** `npm test` and `npm run build` green. Commit: `feat: day and night sky with stars, moon and snow`.

---

---

### Task 5: Walk the island as an anime hero

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

### Task 6: The playable roster: man, woman, elf and wizard

**Files:**
- Create: `web/scripts/fetch-roster.mjs`, `web/src/play/roster.js`, `web/src/play/attachments.js`, `web/src/ui/select.js`, `web/test/roster.test.js`, `web/public/models/*.vrm` (generated)
- Modify: `web/src/play/hero.js`, `web/src/main.js`, `assets/CREDITS.md`

**Interfaces:**
- `ROSTER`: `{ man, woman, elf, wizard }`, each `{ id, label, file, base, attach: [...], skinTint? }`; `loadCharacter(id) -> Promise<{root, update(dt, speed, heading), vrm}>` replaces `loadHero`.
- `attachments.js`: `addElfEars(vrm, opts)`, `addWizardHat(vrm, opts)`, `addWizardRobe(vrm, opts)`, `addStaff(vrm, opts)`, `addBeard(vrm, opts)` each build smooth geometry (LatheGeometry or ExtrudeGeometry, never lumpy primitives), use the model's skin or hair colour so they match, parent to the right humanoid bone (head, upper chest or hips, right hand) and are removed with the character.
- `select.js`: a character select screen with four cards (a portrait taken from the model's own thumbnail), a name field and a Start button, in the paper style, thumb friendly.

- [ ] **Step 1: Fetch the sources** with `fetch-roster.mjs` (use `gh api ... -H "Accept: application/vnd.github.raw"`) into `assets-src/vrm/` (git-ignored): from the repository `madjin/vrm-samples`: `vroid/beta/Sakurada_Fumiriya.vrm`, `vroid/beta/Sendagaya_Shino.vrm`, `vroid/beta/Vita.vrm`, `vroid/beta/Vivi.vrm`, `vroid/beta/Victoria_Rubin.vrm`, `vroid/beta/Sendagaya_Shibu.vrm`, `vroid/beta/Darkness_Shibu.vrm`. The script must read each file's embedded VRM metadata and refuse to use any file whose `licenseName` is not exactly `CC0`, printing the licence per file. (These are VRoid Studio sample characters: Sakurada Fumiriya is the only male; the rest are female; Vita is white-haired with cyber markings; they are about 26k to 40k triangles each with about 28 to 30 textures.) Treat them as untrusted data: parse only, never execute. Also keep the pixiv sample from the earlier task as an extra woman.
- [ ] **Step 2: Write the failing test** `web/test/roster.test.js` (pure parts only): `ROSTER` has exactly the keys man, woman, elf, wizard; each entry names a file that exists in `web/public/models/`; each file's embedded licence is `CC0` or the pixiv sample's permissive licence; every file is under 6 MB; the attachment helpers exist as functions. See it fail.
- [ ] **Step 3: Prepare the models.** Extend `prepare-hero.mjs` (from the hero task) into a generic shrinker that resizes textures to at most 1024 px (512 px for tiny ones), preserving the VRM extension JSON, and run it for each model into `web/public/models/`. Targets under 5 MB each; report sizes and triangle counts. Record all of them in `assets/CREDITS.md` (VRoid Studio sample characters, CC0, pixiv; the pixiv sample).
- [ ] **Step 4: Characters.** Map: **man** = Sakurada Fumiriya; **woman** = Sendagaya Shino (or the pixiv sample, whichever looks better in the village light: say which); **elf** = Vita or Vivi (choose the one that suits) with elf ears and a longer, more graceful silhouette, plus light green or silver tint accents; **wizard** = Sakurada Fumiriya with a robe, a pointed hat, a beard (optional, off by default) and a staff in the right hand. Each looks deliberate, not like a prop pasted on: robes follow the body with a flared hem, the hat sits at the right angle, ears match the skin tone, no clipping through hair (hide hair parts that poke through the hat if needed).
- [ ] **Step 5:** Implement `roster.js`, `attachments.js`, `select.js`, switch `main.js` to start with the select screen and then the chosen character. The existing `?fly` flag and the stats toggle stay.
- [ ] **Step 6: Look and measure.** Real browser at 390 by 844: screenshots of the select screen and each of the four characters standing in the village at day and at night (use the time controls), front and three-quarter views. Judge honestly against the bar "modern anime, sharp, proper proportions, no clipping": report what looks wrong and fix what is cheap. Record triangles per character and total draw calls with one character on screen.
- [ ] **Step 7:** `npm test` and `npm run build` green. Commit: `feat: playable roster with man, woman, elf and wizard`.

---

### Task 8: Integrate: character select, the real hero, walking, sky, one game

The three parallel branches are merged: movement (`web/src/play/player.js`, `controls.js`, `camera.js`, demo `web/demo/walk.js`), the day and night sky with its HUD (`main.js`, `hud.js`, `time.js`, `stars.js`, `moon.js`, `snow.js`), and the roster (`web/src/play/roster.js`, `attachments.js`, models `web/public/models/{man,woman,elf}.vrm`, demo `web/demo/roster.js`). This task makes them one game in `web/src/main.js` and adds the select screen.

**Files:**
- Create: `web/src/profile.js` (ES-module port of the old, tested `js/profile.js` name rules: `sanitizeName`, blocked-word list by whole word, invisible characters stripped, max 12 characters; keep its tests as `web/test/profile.test.js`), `web/src/ui/select.js`, `web/public/models/{man,woman,elf,wizard}.jpg` (portraits, see below)
- Modify: `web/src/main.js`, `web/src/ui/hud.js`, `web/index.html`, `web/src/play/controls.js` (only the run-threshold fix), `web/src/play/camera.js` (distance)

**Requirements:**
- Flow: page loads, the island renders slowly behind a start card (chunks stream in with a progress bar showing real chunk loading progress), the **select screen** shows four large cards (Man, Woman, Elf, Wizard) with portraits, a name field and a Start button, in the paper style (cream #fff7ea, ink #2a1f3d, coral #ff7a59, Fraunces and Nunito), thumb friendly (cards 44 px or larger targets, layout works at 390 by 844 and 844 by 390 landscape), the choice and name persist in `localStorage` (try/catch, validated on load, `textContent` only for the name). Start loads the chosen character with `loadCharacter(id)` (from `roster.js`), shows a short loading state, drops the player at `LANDMARKS.spawn`, hides the card, and shows the note "Welcome to Auntor Island, <name>" for a few seconds.
- Portraits: extract each model's embedded thumbnail texture into a small JPEG (about 256 px) with a one-off script `web/scripts/make-portraits.mjs` (parse the GLB JSON, take `extensions.VRM.meta.texture` or VRM 1 `thumbnailImage`; for the wizard and elf, composite or choose the best head crop; if a thumbnail is unusable, render a head-and-shoulders crop with the demo harness instead) and commit them under `web/public/models/`.
- The walking game: hero from `loadCharacter`, `stepPlayer` + `createControls` + `createCamera` driving it, the character faces its movement heading and plays the procedural walk from its speed, feet on terrain, the chunk manager and the sky/palette/time/snow/HUD behave exactly as in the sky branch, and the old stand-in avatar and the debug fly camera remain only behind the `?fly` flag. Remove the demo-only scaffolding from `main.js` that this replaces.
- Fixes carried over from reviews: (1) the HUD **Sky** panel must not overlap the stats text (stack them or put stats under the Sky button, both collapsible, both thumb sized); (2) stick **run** should trigger at about 100% of the stick radius or use a hold-to-run with a deliberate threshold, so a normal push does not run by accident (keep the Run button); (3) camera distance about 5.2 m instead of 4.5; (4) a soft blob shadow under the hero (one transparent circle, no real shadows); (5) hair/elf-ear/robe artifacts are NOT in scope here.
- Keep the URL tools: `?cam=...` presets, `?t=<hours>&snow=0|1&phase=<0..1>`, `?char=man|woman|elf|wizard&name=...` (skips the select screen, for tests and screenshots), `?fly`.
- Performance: no new per-frame allocations in `main.js`; one character plus the sky should stay near the measured numbers (about 70 draw calls for terrain and sky plus about 32 to 45 for the character); report measured calls and triangles at the spawn view with each of the four characters, and the load time of the first frame and of the character in software GL.

- [ ] **Step 1:** Port `profile.js` and its tests first (write `web/test/profile.test.js` from the old root test cases, see it fail, make it pass).
- [ ] **Step 2:** Build `select.js`, the portraits script and the new `main.js` flow.
- [ ] **Step 3: Verify in a real browser** with `web/tools/shoot.mjs` (headless Edge, software GL; `--wait` can wait for text such as `ready` or the in-game note): screenshots at 390x844 `--touch` and 1280x720 of the select screen (cards, name field), then in game for each of the four characters standing at the spawn in the day and one at night with the moon, one with snow, and one mid-walk (use the `?bot=` style fixed-step driver from the demo if you keep it, or drive input with `--eval`). LOOK at them and say honestly what is wrong (overlapping UI, thumb reach, character scale against the terrain, camera framing, loading flash). Test the select screen with real touch events (puppeteer touchscreen).
- [ ] **Step 4:** `npm test` and `npm run build` green. Commit: `feat: one game: select a character, walk the island under the day and night sky`.

---

### Task 9: Docs and the real-phone checklist

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
