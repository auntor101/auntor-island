# Lumen Isle Expansion: Design

Date: 2026-10-14. Status: awaiting owner review.

## Goal
Grow Lumen Isle from a small quest island into a phone-first anime open world: pick a character, ride and crash, eat at venues, visit a Festival Quarter, trade banter with a fictional cast, and see mountains, sunsets and beaches. Single-player with a "fake crowd" of NPCs. Real multiplayer is out of scope for now.

## Decisions (settled)
- Keep three.js r128, vanilla JS, classic `<script>` files. No bundler, no physics engine, no VRM loader.
- No backend for gameplay. Progress lives in `localStorage`.
- Avatar: two VRoid Studio exports (male, female) loaded as GLB through the r128 `GLTFLoader`, materials swapped to the toon look. Mixamo clips retargeted to the VRoid skeleton. Fallback: procedural male and female chibi so the game runs without assets.
- Higgsfield: concept art, painted sky and cloud textures, props. Not the avatar.
- Hosting: Cloudflare Pages (Netlify config stays valid).
- Analytics: Cloudflare Web Analytics for visits, plus an optional tiny Worker that counts events (character, venues, festivals, crashes). Counts only, no names, no personal data.
- Content rules: PG-13, stylised non-sexual avatars, no gore. Cast is fictional. Politics banter targets invented countries and the MCU, not real people. Festival content (Bizu, Pani Khela) is respectful and should be reviewed by someone from the community. Sarcasm targets the cast and the player, never a festival or its people.
- "Brothel" is built as the Velvet Lounge, a non-sexual neon cabaret.
- Mungdi is a ramen-style noodle dish, so it is the signature dish of the Mungdi Noodle House (replaces a generic ramen bar).

## Architecture
`index.html` keeps the CSS, HTML and boot. The inline script is split along its existing banners into `js/*.js`, loaded in order: `core.js` (setup, look helpers), `characters.js`, `hub.js`, `inner.js`, `avatar.js`, `world-coast.js`, `venues.js`, `vehicles.js`, `activities.js`, `festivals.js`, `banter.js`, `ui.js`, `audio.js`, `input.js`, `analytics.js`, `main.js`. Debug hooks `window.__lumen` stay. The existing world shape (`scene, sky, h, walk, colliders, npcs, inter, update`) is reused for new zones.

## Features
1. **Character select:** male/female, name (max 12 chars, set via `textContent` only, stored on device), hair/outfit presets.
2. **World:** coast, beach, mountain strip, fixed golden-hour sunset sky, sakura petals.
3. **Venues** (one shared venue builder, data-driven menu): tiramisu shop, blueberry cheesecake, coffee shop, steakhouse, seafood, Asian fusion, Mungdi Noodle House, Velvet Lounge, sushi, pizza, ice cream, bubble tea, bakery, street food. Pick a dish, short eating animation, small mood buff, Food Passport entry.
4. **Vehicles:** horse, donkey, car, motorbike with arcade movement. Crash above a speed threshold launches the rider on a ballistic tumble, manga impact text, comic "you died" caption, respawn. NPC riders add the crowd feel.
5. **Festival Quarter** (one festival-venue builder, per-festival data): Bizu Riverside (flower floating), Pani Khela Ground, Holi Square, Diwali Lantern Street, Eid Night Bazaar, Pohela Boishakh Mela, Songkran Street, Hanami Park, Carnival Parade, Winter/Oktoberfest Market. Pani Khela, Holi and Songkran share one splash/colour-throw game.
6. **Activities:** fishing, surfing, beach volleyball, campfire, paraglide, hot-air balloon, karaoke/rap rhythm game, dance emotes.
7. **Banter:** cast Nma, the Colonel (fictional, Gaddgafi-style), Ukk-ass, Bang-odi, Tom, Nanda. Topic banks: MCU, invented-country politics, science, astrology. Teasing, sarcasm and rage-bait choices that reference the player's name, choices, crashes and dishes. Written through the existing `say()`/`SCRIPTS` pattern and passed through `deai-writing`.
8. **Retention:** photo mode with 9:16 share card, Food Passport, daily streak, crash counter.

## Mobile and performance
Budgets: about 150 draw calls, about 150k triangles, first download under 5 MB, 60 fps on a mid-range phone. Interiors and the mountain lazy-load on approach and are freed on exit. Instancing for repeated props; no real-time shadows. A frame-time monitor lowers pixel ratio and bloom automatically. Far NPCs animate at a lower rate. One-thumb controls, emote wheel, Low Battery mode. Audio unlocks on first tap. Test Instagram's in-app browser.

## Build order
0 split files, 1 character select and avatar, 2 coast/sunset, 3 food venues, 4 vehicles, 5 Festival Quarter, 6 activities, 7 banter, 8 analytics and photo mode, 9 phone testing and deploy. Phases 0 to 5 form the first demo. Each phase ends with `npm test` plus a phone-size screenshot, and a perf check against the budgets.

## Delegation
`impeccable`/`design-taste-frontend` for UI flows, `ui-motion-pro-max`/`transitions-dev` for motion, `genjutsu` for the anime look, `deai-writing` for dialogue, `subagent-driven-development` with one agent per venue/activity/festival, `webapp-testing`/Playwright/Lighthouse for checks.

## Out of scope
Real multiplayer, VRM/Rapier, live-AI banter, the other backlog portal worlds.

## Known risks (unchecked)
VRoid and Mixamo licence terms and skeleton retargeting; r128 `GLTFLoader` with VRoid exports; Instagram in-app WebGL/memory limits; analytics consent rules by region; Higgsfield credit cost; community review of Bizu and Pani Khela content.
