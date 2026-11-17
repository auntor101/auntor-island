# Status and next steps (2026-11-13)

Checked against `git log`, `src/` and the master roadmap. Tests: 135 pass; build OK.

## Done (all on `main`)
- Phase 0: old game archived, new app at repo root, asset pipeline, terrain worker.
- Phase 1: flora and wind, village, companion and animals, paths and minimap, landmarks, sound engine, world reacts to time.
- Phase 2: NPC cast, dialogue and banter, 13 quests with tracker, markers, compass, finale card; `p4/fixes` (NPC idle life, camera ease, pet button) merged today.

## Done 2026-11-13
- Dragon riding (flight physics, mount, camera, landing), death card with Ways I Died, garage cart/trike/bike, Feast Quarter menus + Food Passport + buffs, festivals with a shared splash game, anonymous analytics worker, debug hooks gated.

## Left
1. A licensed horse model to replace the procedural pony (optional).
2. Real-phone and iPhone test, tuning of flight and vehicle feel (owner).
3. Cloudflare authorisation and first deploy with the worker.

## Order
F pure physics -> F wiring -> G death screen -> G vehicles -> H -> I -> 5.
Each step: tests first, screenshot at 390x844 and 844x390, draw calls and triangles, review.
