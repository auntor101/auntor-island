# Status and next steps (2026-11-13)

Checked against `git log`, `src/` and the master roadmap. Tests: 135 pass; build OK.

## Done (all on `main`)
- Phase 0: old game archived, new app at repo root, asset pipeline, terrain worker.
- Phase 1: flora and wind, village, companion and animals, paths and minimap, landmarks, sound engine, world reacts to time.
- Phase 2: NPC cast, dialogue and banter, 13 quests with tracker, markers, compass, finale card; `p4/fixes` (NPC idle life, camera ease, pet button) merged today.

## Left
1. **Phase 3F dragon riding** (in progress): pure flight physics + tests, then mount/takeoff UI, flight camera, landing.
2. **Phase 3G rides and crashes:** pony/cart/trike at the Stables and Garage; death screen "You died successfully. Wanna try again?", respawn, "Ways I Died" list (cliff, fire, sea, cart, crash).
3. **Phase 4H venues:** Feast Quarter menus, food passport. **4I festivals.**
4. **Phase 5:** Cloudflare analytics worker, CSP/headers, remove debug hooks (`globalThis.__npcs` etc.), licence audit, Lighthouse, final reviews.
5. **Owner-only:** real-phone and iPhone test (performance is unproven), Cloudflare authorisation.

## Order
F pure physics -> F wiring -> G death screen -> G vehicles -> H -> I -> 5.
Each step: tests first, screenshot at 390x844 and 844x390, draw calls and triangles, review.
