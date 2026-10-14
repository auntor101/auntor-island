# Big Island Update: Design

Date: 2026-10-14. Status: awaiting owner approval. Supersedes the build order in `2026-10-14-lumen-isle-expansion-design.md` (that spec's feature list still stands).

## Why this update
Playtest feedback: the island is small and empty, the quests are boring, the people are short and chunky, there is no companion, the cats do not react, and the requested places (coast, venues, riding, festivals) are not in the game. This update makes the world feel like a place worth exploring, then fills it.

## Facts about the current build (measured from the code)
- Island radius `R = 34`, shoreline about 28 to 31 units (about 2,800 to 3,000 square units of land). Height field `hubH`, fog 40 to 160.
- One terrain mesh (`2R+20` square, 110 segments on touch). Trees, grass and flowers are single `InstancedMesh`es with `frustumCulled = false`, so everything is always drawn.
- Touch profile already costs about 116 draw calls and 158k triangles with 6 cats; there is no headroom.
- People are chibi primitives from `makeChar` (head about a quarter of the body height). The quest chain is Mira, fireflies, Pip, Tobi's riddles, the globe, Kit, with state in the object `S`.

## Goals and decisions
1. **Island about 10 times bigger by area** (radius about 108, roughly 3.2 times wider). If "10 times" meant 10 times across (100 times the area) this is not feasible on a phone, so I am assuming area.
2. **Taller, handsome people for men and women**, same toon look.
3. **A companion who always walks with you.**
4. **Cats that notice you, come over and meow.**
5. **Quests that are fun: varied, medium difficulty, never a dead end.**
6. **The cast is on the island with names, places and personalities.**
7. First vehicle (**horse**) arrives in this update, because a bigger island needs a way to cross it.

## The hard problem: 10 times the land on a phone with no headroom
Making the world bigger must not make it slower. The design rules:
- **Chunk the world** into a grid of 32 by 32 unit cells. Each chunk owns its own small `InstancedMesh`es (trees, grass, rocks, flowers, props). Only chunks within about 70 units of the camera are visible; the fog (far plane about 140) hides the pop-in. Frustum culling is turned back on per chunk. This keeps draw calls and triangles roughly constant however large the island is.
- **One terrain mesh at lower vertex density** (about 1.3 units per cell instead of 0.8) plus height-based colouring, so the 3.2 times wider ground costs about 4 times the vertices, not 10 times.
- **Distance rules for life:** cats, companions and NPCs simulate only within 30 units; grass density thins with distance; far trees use only the cheapest model.
- **Budget gate before any content lands:** touch profile stays at or under about 150 draw calls and 160k triangles in the busiest spot, measured in a real browser. If a feature breaks the budget, it gets a lower count on touch, never a lower frame rate.
- **Navigation:** a minimap or compass arrow to the current objective, and signposts. Without them a big island is just lost players.

## People
Honest options:
- **A. Rebuild `makeChar` as a taller, better proportioned procedural figure (about 7.5 heads tall, shaped limbs, jaw, brow, eyes, 6 hairstyles for men and 6 for women, outfits).** Fast, fits the toon look, cheap on phones. Looks "stylised handsome", not photoreal.
- **B. Real rigged models.** Quaternius Universal Base Characters (CC0, male and female, regular proportions, 20 hairstyles, about 13k triangles each, not anime) or your VRoid avatars (anime, handsome, usually 20 to 50k triangles and need decimating). Too heavy to show many at once on a phone; fine for the player and companion with the rest at lower detail.

Plan: do **A now** for everyone so the island is populated immediately and consistently, then upgrade the player and companion to **B** when your two VRoid files exist. I will check triangle counts before putting any real model on phones.

## Companion
- Chosen at the start (pick from 3 cast members or a cat). Follows at 2 to 3 units behind with simple steering and obstacle avoidance, catches up if you run, teleports to you if left far behind (such as after a mount).
- Talks: remarks on places you reach, gives hints when you are stuck for a while, banters, reacts when you crash or eat. Cheap triggers in the existing `say()` and `note()` system.
- Mounts a second horse when you mount.

## Cats
- Existing wander code stays. New states: **notice** (player within 10 units: head turns, ears up), **approach** (walks to you), **meow** (a generated WebAudio meow, no audio files), **rub** (circles you). A tap or the action button pets it: a heart pops and a "cats befriended" counter grows (Food Passport style collection). 12 cats on desktop, 6 on touch, always within the chunk simulation distance.

## Quests that are fun
Design rules: three difficulty tiers mixed in one session, never a hard fail, hints after 2 wrong tries, each quest ends in a surprise or a joke, and every quest uses the big island.
- **Replace the single chain with a quest board of about 12 quests**, 3 live at a time (easy, medium, one wild card), spread across the zones.
- **Quest types:** fetch with a twist, delivery along a route, find the missing cat, race a rival on a horse, fishing, photo requests (frame a landmark in photo mode later), a riddle trail, a food order (arrives with the venues), a dance-off.
- **Keep the finale:** 3 stars still lead to the snow-globe secret and the Instagram word.
- Adaptive help: after 90 seconds stuck, the companion nudges; after 3 minutes, an arrow shows.

## Slapstick deaths (comedy, no blood)
Dying is a joke in this game, in the style of cartoon pratfalls. Rules: no blood, no gore, nothing graphic, and the tone is silly, never grim.
- **Ways to die (added as each zone arrives):** walk or jump off a cliff or the mountain edge, fall into deep water, stand in a campfire or fire pit and burn (cartoon flames, a smoking charcoal figure), get run over by a car on the road, crash a horse, donkey or motorbike, get launched by a trampoline into the sea, and more silly ones later.
- **The death moment:** a quick tumble or ragdoll flop, manga text ("BONK!", "SPLAT!" shown as a comic burst, "AAAA!"), stars circling a halo, the ghost floats up, a tiny tombstone gag, then fade out.
- **The screen:** exactly the text **"You died successfully."** and under it **"Wanna try again?"** with a big Try Again button. Respawn at the last checkpoint with all quest progress and stars kept.
- **Collection:** a "Ways I Died" list (cliff, fire, car, horse, water and so on) with a counter, shown on the share card. Finding every way is a mini-goal.
- **Pause menu:** a **"Dramatic exit"** button for a deliberate silly death (pick a method) and a **"Stuck? Respawn"** button. The UI does not use the word suicide.
- **Safety and fun:** deaths never cost progress or time beyond a few seconds, they are always optional, and they happen to the same stylised character as everything else. Cars and fire are props that react to the player, not scripted traps that punish exploring.
- **Phone cost:** reuse the existing particle and blob-shadow code, no physics engine; tumble is a short scripted arc.

## The cast
Fictional characters only. Nma, the Colonel (a swaggering made-up leader of a made-up country), Ukk-ass, Bang-odi, Tom, Nanda, plus an invented film-star set. Each gets a home zone, a look, a voice pitch, a banter style (MCU, made-up politics, science, astrology, teasing and sarcasm toward the player and each other) and one quest. Dialogue goes through the existing `say()` with `{name}` expansion and a style pass for natural, funny writing. No real people, no real countries' leaders, no festival or community jokes.

## Island layout (about 216 units across)
- **Hub village** (existing island centre, kept) with Mira, Tobi, Pip, the snow globe hill.
- **Coast road, beach and sunset cove** to the west (golden-hour sky, painted gradient, sakura or palm props).
- **Mountain** to the north with a viewpoint (paraglide later).
- **Festival quarter** to the east (later phase).
- **Venue street** to the south (tiramisu, cheesecake, Mungdi noodles, coffee, steakhouse, seafood, Asian fusion, Velvet Lounge) (later phase).
- **Meadow and orchard** zones with the autumn and spring tree belts extended.
Roads and signposts connect the zones so the map reads clearly.

## Build order (each step is playable and measured)
| # | Step | Notes |
|---|---|---|
| 1 | **Chunked big world** | New `R`, terrain at lower density, chunked trees/grass/props, shore and water, minimap/compass, budget measured |
| 2 | **Taller people** | `makeChar` v2, male and female, new hair and outfits, applied to the player and every NPC |
| 3 | **Companion and cats that meow** | Follow system, companion picker, notice/approach/meow/rub, petting, cat counter |
| 4 | **Quest board and cast** | About 12 quests, hints, the six named cast members with banter |
| 5 | **Horse and the death system** | First mount, crash, the "You died successfully" screen and respawn, cliff, water and fire deaths; cars later with roads |
| 6 | **Coast, beach, mountain, sunset** | Zones with props and music |
| 7 | **Venues and festivals** | Shops with menus, Food Passport, festival games |
| 8 | **Real models and polish** | VRoid player/companion if provided, analytics, launch headers |

Steps 1 to 4 are the "feels like a game" milestone. Step 5 follows immediately because it is the answer to the walking distance.

## Risks
- The chunk system touches `buildHub`, which is a 300-line function that places everything by hand; it will need to be broken into per-chunk generators. This is the largest code change so far.
- 10 times the land means 10 times the content to place; much of it will be generated by rules (noise-based tree, rock and flower placement) rather than hand placed.
- Procedural "handsome" is a judgement call; I will show front and side renders of men and women for your approval before applying it everywhere.
- Real phone frame rate remains unmeasured; each step reports draw calls and triangles, and a real-device check is needed before launch.

## Out of scope for this update
Multiplayer, live AI chat, cars and motorbikes (they follow the horse), Higgsfield assets (no credits), the festival and venue content itself (step 7).
