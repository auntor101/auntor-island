# Lumen Isle: project brief for Claude Code

## What this is
A small, stylised 3D open world that runs in the browser. It is meant to be the link in the owner's Instagram bio: people tap the link, land on a cosy island, talk to villagers, solve small quests and riddles, then zoom into a snow globe to reach a second world. The ending reveals a secret word they DM to the owner.

Most visitors arrive on a phone, inside Instagram's in-app browser. Every change must keep that experience fast and touch-friendly.

## Run it
- `npx serve .` (or `python3 -m http.server 8080`), then open http://localhost:3000 (or :8080).
- Opening `index.html` straight from the file system also works; a local server is still preferred.
- `npm install` then `npm test` runs the profile unit test (`tools/test-profile.js`) and the headless quest-flow test (`tools/test-flow.js`). The flow test loads the `js/` script tags from `index.html` in order, skipping `js/charselect.js`.
- `npm run shots` renders screenshots with Puppeteer into `tools/shots/` (desktop and phone sizes).

## Files
- `index.html`: the CSS, the HTML UI and the script tags.
- `js/game.js`: the whole game (the old inline script, unchanged in structure). Its banner sections are described below.
- `js/profile.js`: player profile validation and appearance data (pure, unit-tested by `tools/test-profile.js`).
- `js/charselect.js`: the start-screen character-select UI. It talks to the game only through `window.LI`.
- `vendor/three/`: three.js r128 and the post-processing files it uses (EffectComposer, RenderPass, ShaderPass, UnrealBloomPass, CopyShader, LuminosityHighPassShader, FXAAShader). These are the classic `examples/js` global-script builds, not ES modules, and they attach to `window.THREE`.
- `concepts/five-worlds.html`: the earlier five-concept sketch demo, kept for reference.
- `docs/brainstorm.md`: idea backlog (portal worlds, NPCs, question types, Instagram loop).
- `tools/`: the headless test and the screenshot script.
- `netlify.toml`: deploy config.

## How `js/game.js` is organised
The script is divided by `/* ===== ... ===== */` banners, in this order:
1. **setup**: quality profile `Q` (touch devices get fewer grass blades and a lower pixel ratio), math helpers, renderer, cameras.
2. **shared look**: the toon ramp texture `GRAD`, the `toon()` and `basic()` material caches, `ol()` for ink outlines (a back-face hull), `blob()` for soft blob shadows, `glowSprite()`, `makeSky()`, `makeTerrain()`, `particles()`, `grassField()` (instanced blades with wind and a player-push shader), and `forest()` (instanced trees).
3. **characters**: `makeChar(opts)` builds a chibi villager from primitives, with styles `player`, `mira`, `tobi` and `pip`; `makeFox()` builds the fox; `marker()` is the floating "!" quest marker.
4. **HUB (Lumen Isle)**: `hubH(x,z)` is the island height function and `PATHS` holds the dirt paths. `buildHub()` places the houses, windmill, dock, lanterns, trees, grass, fireflies, Mira's moonflowers, the villagers and the snow globe with its live portal shader.
5. **INNER (Snowglobe Hollow)**: `innerH()` and `buildInner()` build the night world: aurora, glass dome, cottages, pines, the lit tree, the fox and the exit ring.
6. **NPC plumbing**: `addNPC()`, plus `hasNews` (when an NPC shows the "!" marker).
7. **camera**: third-person follow with yaw/pitch/dist, `startCut()` for scripted camera moves, and `frameTalk()` for the conversation framing.
8. **world switching**: `computeInnerCam()`, `enterGlobe()`, `exitGlobe()`, `setWorld()`.
9. **scripts**: `SCRIPTS.<npc>` holds async dialogue functions built on `await say(npc, text, choices?)`, which resolves to the chosen index. Quest state lives in the single object `S`.
10. **UI**: the dialog typewriter, notes, stars, quest list (`objectives()`), action button and end card.
11. **audio**: a generated WebAudio pad and sound effects. There are no audio files.
12. **input**: virtual joystick on the left half of a touch screen, drag on the right to look, WASD and E on desktop, tap an NPC to talk.
13. **per-frame**: updates for the player, NPCs, labels and interaction prompts.
14. **post-processing**: RenderPass, then UnrealBloom, then a grade pass (exposure, saturation, vignette), then FXAA.
15. **boot**.

## The `LI` bridge
`window.LI` is how UI files talk to the game: `LI.profile` (current player profile), `LI.applyProfile(p)` (rebuilds the player), `LI.beforeStart` (called when Enter is pressed). Dialogue text may contain `{name}`, which `say()` replaces with the player's name.

## How the "zoom into another world" effect works
- The inner world is rendered every frame into `portalRT` from `innerCam`. The globe's shader samples that texture in screen space (`gl_FragCoord / uRes`), so the glass behaves like a window into the other scene.
- `innerCam` mirrors the main camera's orientation. Its position is `INNER.anchor + (camera.position - HUB.Gc) * K`, so moving toward the globe moves you toward the anchor inside it.
- `enterGlobe()` flies the camera until the globe fills the screen, then swaps to the inner scene at exactly the pose the portal was showing, which makes the switch seamless.
- `exitGlobe()` flashes to white, starts the camera inside the globe's surface and pulls back out.
- To add a new portal world:
  1. Write `buildX()` following the same `W` shape: `scene`, `sky`, `h`, `walk`, `colliders`, `npcs`, `inter`, `anchor`, `update`, `exposure`, `sat`.
  2. Give the portal object its own render target and portal material.
  3. Generalise `enterGlobe` and `exitGlobe` to take the target world.

## Look rules (keep these consistent)
- Use the toon materials (`toon()`) for anything lit. Use `basic()` only for things that should glow.
- **The bloom threshold is 0.9.** Lit surfaces must stay below about 0.85 brightness or they will glow. Only lamps, windows, fireflies, portals and the fox's tail should reach it.
- Ink outlines use `ol(mesh, scale)` with the shared colour `#2a1f3d`. Use them on characters and hero props, not on every small object.
- Palette:
  - Island: golden hour, with warm sunlight and cool lavender shadows.
  - Inner world: deep blue night with warm windows.
- Keep the UI in the storybook paper style: cream `#fff7ea` panels, ink `#2a1f3d` text, coral `#ff7a59` accent, Fraunces and Nunito fonts.

## Performance budget
- Target 60 fps on a mid-range phone.
- Prefer `InstancedMesh` for anything repeated more than about 10 times.
- Avoid adding real-time shadows or new lights; use blob shadows and emissive materials instead.
- The portal render only runs within `Q.portalNear` of the globe.
- If you add heavy features, branch on the `TOUCH` / `Q` profile.

## Debug hooks
- `window.__lumen` exposes the state `S`, the player `P`, `NPC`, `talk`, `enterGlobe`, `exitGlobe`, `pick`, `advance` and `step`. The tests use these.
- `window.__maxDt` raises the per-frame time cap, so slow headless renders can catch up.
- Remove these hooks before a public launch if you like; nothing else depends on them.

## TODO before going live
- Replace `@yourhandle` in `index.html` (start screen and end card) with the real Instagram handle.
- Choose the real secret word (currently `LUMEN`, in the fox script and the end card).
- Replace the primitive characters with rigged, animated models; GLB with GLTFLoader is the natural next step.
- Add a share-card image export and a social preview image (`og:image`).
- Test on a real phone inside Instagram's in-app browser.

## Deploy
- Netlify: drag the folder into app.netlify.com/drop, or run `npx netlify-cli deploy --prod --dir .`.
- The site is fully static and needs no build step.
