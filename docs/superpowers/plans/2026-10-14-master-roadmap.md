# Auntor Island: Master Roadmap (everything the owner asked for)

Status: **awaiting owner approval. Nothing below is executed yet.** Written 2026-10-14. This plan replaces the earlier "Build order" tables; the design (`2026-10-14-dragon-isle-rebuild-design.md`) and the foundation plan stay valid for what they cover.

## Owner decisions (from the chat)
- **Replace the old game completely.** The new game becomes the only thing on the site and in `main`. The old game is backed up first (a git branch, a tag and a copy of the old live site) and then left untouched forever.
- **Build the village and everything else now**, without waiting for a building pack. Buildings are made procedurally first; free packs are swapped in later if downloaded.
- **Original dragon**, not Toothless (DreamWorks owns that character). Our own species, names and look.
- **Optimise hard.** Cloudflare, a backend and "GPU" may be used. What that means in practice is below.
- Names (Auntor's Island, Nma, the Colonel, Ukk-ass, Bang-odi, Tom, Nanda) and the banter stay.
- Wizards and elves, a 20 times bigger island, anime or cartoon quality, mid-range to flagship phones including iPhone, lean code (ponytail).

## Already built and live in the new game (at /dragon/ today)
| Feature | State |
|---|---|
| Sun, sunrise, sunset, noon, **night with a sky full of stars, a moon with phases**, switchable **snow**, an Auto day cycle (about 6 real minutes) | Built. Polish left: daytime snow is washed out, moon craters faint, no crossfade between fixed times |
| **Mountains:** snow-capped north mountain, volcano with a lava crater, west cliffs, sea stacks, black-sand beach, cove, tower headland | Built. Polish left: mountain rock looks striped, needs natural strata and gullies |
| **20 times bigger island** (about 300 m across, 70,000 m2) | Built; it is still **empty** between landmarks (that is what Phase 1 fixes) |
| Painted anime ground (grass strokes, patches, forest dapples) | Built as a surface texture; **real 3D grass and flowers are still to do** |
| Four anime characters, select screen, name, welcome, walking, touch controls | Built |

## What "use backend, GPU or Cloudflare" will mean (honest version)
| Idea | Verdict |
|---|---|
| Use the phone's **GPU** well | **Yes, the main lever.** Instancing, per-chunk culling, GPU-compressed textures (KTX2), compressed meshes (meshopt), level of detail for characters, vertex-shader wind, a frame-time governor. |
| Move heavy maths off the main thread | **Yes.** Terrain chunk building (about 7,000 height lookups per chunk today) moves to Web Workers. This removes streaming stutter. |
| **Cloudflare Pages and CDN** for the game files | **Yes.** Content-hashed filenames, long cache lifetimes, Brotli compression, real security headers. |
| **Cloudflare Workers** (backend) | **Yes, small:** an analytics endpoint that counts visits and plays (no names), later optional cloud saves and a leaderboard. Durable Objects only if real multiplayer is added later. |
| **Cloudflare Workers AI** (server GPUs) for images | **Optional.** Could make concept art or tileable textures; needs your Cloudflare login to be authorised. Not on the critical path. |
| Rendering the game on a server and streaming video | **No.** It adds lag, costs money for every player and fails on mobile data. |
| WebGPU renderer | **Not now.** Evaluate after launch; the WebGL path must work on every iPhone first. |

## Phase 0: Backup, replace, set up the pipeline (first, small)
1. **Backups (before any deletion):** tag `old-game-final` on current `main` (c5961ad) and push; create and push branch `archive/old-game` from it; tag the current `gh-pages` commit `old-site-final` (the live old site). Verify each exists on GitHub. After that nothing touches them.
2. **Keep what the new game reuses:** copy the cat model, the tree and bush models and textures, and the credits into the new app's `public/` before the old files are removed; also fetch the dog from the same CC0 animal pack.
3. **Promote the new app to the repository root:** move `web/` up one level (one package.json, one `src/`, one `public/`), delete the old game files (old `index.html`, `js/`, `vendor/`, `concepts/`, old tools and tests, old `netlify.toml`), update paths in docs and scripts, keep `docs/`. `main` then contains only the new game; the old one lives in the archive branch.
4. **Deploy the new game at the site root** (GitHub Pages `gh-pages` root replaced with the new build; Cloudflare config points at the new `dist/`). Verify the live link, then remove `/dragon/`.
5. **Pipeline:** `@gltf-transform/cli` + `meshoptimizer` + KTX2 for model and texture compression in one `npm run assets` script; content-hashed output names; `_headers` for caching and CSP; self-host Fraunces and Nunito.
6. **Perf infrastructure:** terrain chunk Web Worker; a perf HUD that records draw calls, triangles, frame times and long frames; a repeatable "walk the island" bot that reports frame-time percentiles.
Gate: all tests green, live link works at root, old game restorable from the archive branch (proved by checking it out in a temp folder and building it).

## Phase 1: The living world (parallel agents, disjoint files; tasks A, B, C, J, K, L, M, run in two or three waves)
- **A. Vegetation and props:** instanced trees (summer, autumn and spring belts), pines, bushes, **flowers and grass tufts** (from the CC0 nature kit already in use), rocks, reeds, driftwood; wind sway in the vertex shader; biome rules from `zoneAt`. Fix the mountain look (irregular rock strata and snow, no candy stripes).
- **B. Village and buildings:** a procedural longhouse generator (timber A-frames, turf and shingle roofs, carved gables, doors, banners, lanterns), the **Auntor's Harbour** layout (roads, harbour with longships, great hall, forge), the **Feast Quarter** street (tavern district), **Wizard Tower** headland, **Elven Grove** treehouses, bridges and docks. Night lighting with emissive windows and a few cheap point lights. Buildings are instanced and merged per chunk.
- **C. Companion and animals:** the original dragon hatchling plus dog and cat companions (picker at the start), bonding (pet, feed, play), cats and dogs roaming the island, noticing you, coming over and **meowing** and barking (generated sound), petting.
- **J. Paths, landmarks and navigation (was missing):** a **trail network** that joins every landmark (village to harbour, roost, hatchery and academy, beach, cove, wizard tower, elven grove, volcano ember field, mountain viewpoint and glacier ice cave): routes planned with a path search over the terrain (avoid steep slopes and water), a worn dirt or cobble path painted into the ground and gently flattened, wooden **signposts** at junctions with arrows to each place, **lanterns** along main roads that light at dusk, bridges where a trail crosses a gorge, small rest spots with benches and a view, a **minimap** and a compass arrow to the current objective, quest markers, and a **point of interest about every 40 to 60 m** so the 300 m island never feels empty. Fast travel signposts unlock as you discover places.
- **K. The dragon island itself (How to Train Your Dragon-style, original):** the **Dragon Academy** with a training yard and an **arena**, the **Hatchery** (eggs, nests, warm glow), **Roost cliffs** with nests and takeoff ledges, **dragon race courses** of rings through the sea stacks and around the volcano, an **ice cave** in the glacier with crystals and treasure, **hot springs** on the beach, a **great hall** with a hearth and long tables, a **forge**, longships in the harbour, banners and carved posts, a **volcano ember field** with fire dragons. All names, shapes and music original.
- **L. 3D grass and flowers:** instanced grass blades around the player (thinning with distance), wildflower fields, flower meadows near the village and the festival fields, wind in the vertex shader, trampled grass where you walk.
- **M. World reacts to time:** lanterns and windows light at dusk, villagers walk home and sleep at night while night NPCs appear (the stargazer, the owl cats), fireflies at night, dawn mist and sunset glow on the sea, snow piles on roofs when snow is on, cats sleep curled at night.
Gate (each): screenshot critique at 390×844 and 844×390, draw calls and triangles measured, code and security review.

## Phase 2: People, voices and story
- **D. NPC cast:** Nma, the Colonel (made-up chieftain), Ukk-ass, Bang-odi, Tom, Nanda, and the invented film-star visitors of the Saga Theatre, built from the CC0 anime models with attachments (more elves and wizards), idle and walk, placed in the village with home spots.
- **E. Dialogue, banter and quests:** dialogue box and choices (thumb-friendly), the banter engine (MCU, made-up politics, science, astrology, teasing, sarcasm, rage-bait, always aimed at the cast and the player, never real people or communities), the quest board (about 12 fun quests of three difficulty tiers, hints after being stuck, never a dead end), the 3 stars and secret word finale. Dialogue goes through the `deai-writing` pass.
Gate as above, plus a read-through of all dialogue for tone and safety.

## Phase 3: Dragons, rides and slapstick
- **F. Dragon riding:** takeoff from the roost cliffs, glide plus flap and boost, banking, stamina, landing assist, third-person flight camera, a hatchery, species recolours. Chunk streaming looks ahead of the dragon.
- **G. Rides and crashes:** ponies and donkeys at the Stables, **the Colonel's Garage** with an absurd cart, trike and motorbike, comic crashes (no blood), and the **"You died successfully. Wanna try again?"** screen with respawn and a "Ways I Died" list (cliff, fire, sea, cart, crash).
Gate as above.

## Phase 4: Venues, festivals, retention
- **H. Feast Quarter venues:** tiramisu shop, blueberry cheesecake, **Mungdi** noodle house, coffee shop, steakhouse, seafood harbour stalls, Asian fusion, **Velvet Lounge** (non-sexual cabaret tavern), plus more; each with a menu, food props, a short eating animation, small buffs and a Food Passport.
- **I. Festival Fields:** Bizu and Pani Khela (flower floating and water games, with care and respect), Holi, Diwali-style lantern flights on dragons, Eid night bazaar, Pohela Boishakh fair, Songkran, Hanami, and a winter market. One shared splash and colour game, per-festival data.
Gate as above.

## Phase 5: Backend, analytics, hardening, launch
- Cloudflare Worker analytics (visit and play counts, no names, no IP stored), optional cloud save, optional leaderboard.
- Security: strict headers and CSP, no debug hooks, input validation, dependency audit, licence file for every asset.
- Final: Lighthouse, a full independent code and security review of the whole app, the real-phone and iPhone test you run, launch checklist.

## How I will run it (so it is fast and safe)
- **Parallel agents in separate git worktrees** (up to four at once on disjoint files), integrated one at a time; a ledger records every task and review.
- **Every task ends with:** tests, a real-browser screenshot critique (headless Edge, software rendering, so only draw calls and triangles count), an independent code review, a security review for anything that touches input, storage, network or new files, then merge. Reviews find real bugs (they have, repeatedly); I fix them before moving on.
- Skills used: impeccable, design-taste-frontend, genjutsu, ui-motion-pro-max, transitions-dev, design-critique, accessibility-review, deai-writing, ponytail, and the installed three.js skills.
- Progress bar and a short status after each phase.

## Performance budgets (to be proven on your phone)
60 fps on flagship and at least 45 on mid-range; about 300 draw calls and 600k triangles in the busiest view; first playable load about 8 MB or less with the rest streamed; a long-frame counter must stay under 2% in the walk bot.

## Risks and what I need
- **Buildings are procedural at first.** They will look clean and stylised but simpler than a hand-modelled pack. A downloaded Medieval Village pack, when you have it, replaces them without code changes to the layout.
- **The dragon is the small free model** (recoloured and scaled) until a better one exists.
- **Only one male character exists** and he is a young anime boy; more men need your VRoid models.
- **I cannot test a real phone or iPhone.** You run a short checklist after Phase 0, Phase 2 and Phase 3.
- **Needs from you later:** Cloudflare authorisation (Phase 0 and 5), the phone test results, optional VRoid characters and building pack.
- **Rough size:** large. Phases 0 to 2 are the biggest visible change (a populated village with people, cats and a companion); riding, crashes, venues and festivals follow. No promise on calendar time; each phase takes several agent hours.
