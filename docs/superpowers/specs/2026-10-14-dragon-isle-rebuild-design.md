# Auntor's Island, Dragon Isle Rebuild: Design

Date: 2026-10-14. Status: awaiting owner approval. Supersedes `2026-10-14-big-island-update-design.md` (its chunking, people, companion, cats, quest and slapstick-death sections carry over; the world, theme and build order below replace it). The earlier expansion spec's venue, festival and banter lists still stand.

## The idea
Rebuild the game from the ground up as a Viking-style dragon island: a big rugged island above the sea, a village of carved timber longhouses, dragons you hatch, bond with, train, and **ride across the island**. Your companion is one of three: a **baby dragon, a dog or a cat**. It is still Auntor's Island, with Auntor's name and the Instagram secret-word finale.

**Originality rule.** This takes its mood from that kind of story (Nordic island, cliffs and sea, dragon friendship) but is its own world. No DreamWorks characters, dragon names, music, logos or recognisable likenesses. Dragon species, characters and places get original names.

## Research notes (what I read, and how far to trust it)
Sources: web search (the Firecrawl connector was disconnected). I cannot watch video; this is from articles, a filmmaker interview, game wikis and indie dev logs. Several results were low-quality copies and are marked as such.
- **Look of the world.** Universal's own description of its Berk land: a "rugged, massive, and wildly colourful Viking village perched above the sea", with oversized wooden doors, carved benches, woven tapestries, real timber. A filmmaker interview (ACMI) says the village layout echoes the island's shape and was locked in by one approved painting. Secondary (low-trust) articles credit Iceland and Norway: glaciers, black sand beaches, hot springs, longhouses, wooden fortifications, carvings. Fan-art guidance (weakest source): warm earth tones, weathered textures, sharp lines. [ACMI](https://www.acmi.net.au/stories-and-ideas/how-train-your-dragon/) · Universal Epic Universe coverage via search results.
- **What the dragon-game loop is.** The old browser/mobile game School of Dragons (shut down in 2023): free a caged dragon, hatch an egg, bond (the more you do together, the higher you rank), train, fly, race (30+ courses), 400+ quests, and send dragons on missions for loot. Even flying was described as forgiving. Numbers come from promo listings and a fan wiki, so treat them as approximate. [School of Dragons wiki](https://schoolofdragons.wiki.gg/wiki/School_of_Dragons)
- **What makes dragon flight feel good** (indie devlogs, not a standard): a glide with exaggerated physics (less speed lost on a climb than reality) plus manual flaps or boost; a tap adds vertical speed smoothly over about half a second (not a jerk); touch gestures (drag for heading and pitch, a rotate gesture for bank); automatic righting when you stop banking; brake and hover on the boost button so flap stays free; a separate glide mode that needs a running start. [Making Flight Fun](https://souhad.itch.io/dragon-flight/devlog/121703/making-flight-fun) · [Better camera and flight controls](https://mystical-pidgeon.itch.io/dragons-fire/devlog/70994/better-camera-and-modified-flight-controls) · [School of Dragons: dragon flight](https://schoolofdragons.wiki.gg/wiki/Dragons/Dragon_Flight)
- **Free assets I verified.** `Animated Monster Pack by @Quaternius` (CC0, 1.4 MB): contains a **Dragon** (FBX, 879 KB; clips `Dragon_Flying`, `Dragon_Attack`, `Dragon_Attack2`, `Dragon_Hit`, `Dragon_Death`; materials Main, Wings, Belly, Claws, Eyes; 39 bones). The preview shows a small, cute, upright dragon with a big wingspan, not a ride-sized beast. The earlier animal pack contains a **Dog** and a **Cat** (we already ship the cat). Others I found are paid or attribution/share-alike licences, so I will not use them.

## What the free dragon can and cannot do
- **Can:** be the baby dragon companion (cute fits a hatchling), flap in flight (the `Flying` clip), breathe fire with the `Attack` clip, react to hits, and be recoloured into many species and scaled up.
- **Cannot:** it has no walk or idle clip, and its body is upright. For riding I will tilt the model forward in flight so the body is horizontal and seat the rider on its back; on the ground it perches with a procedural bob and wing fold. It will look charming, not epic. A truly majestic big dragon needs a better model: Higgsfield (needs credits, your balance is 0) or a model you provide.
- **Decision for you:** accept the cute free dragon for now and upgrade later (my recommendation), or wait.

## The world (about 10 times today's area, roughly 216 units across)
A rugged Nordic island, taller and wilder than today's gentle hill. Layout is by zone, linked by roads, bridges and signposts, with a minimap and an objective arrow.
- **Auntor's Harbour (the village).** Carved timber longhouses with turf and shingle roofs, big doors, banners and tapestries, a great hall, a forge, a harbour with longships. Warm earth tones and weathered textures, colourful banners as accents. The old hub (Mira, Tobi, Pip, the snow-globe hill) moves here.
- **Dragon Roost cliffs.** Tall cliff ledges where dragons nest and where you take off.
- **The Hatchery and the Academy.** Hatch eggs, bond, learn tricks and flight, run the obstacle ring courses.
- **Sea stacks and the open sea.** Tall rock pillars in the water to fly around; flying races go through them.
- **Black sand beach and hot springs** (Iceland-style), then the **glacier and ice cave**.
- **The volcano and the ember field** (fire dragons, lava hazards for the death system).
- **Autumn and spring tree belts** (existing, extended), a **mountain viewpoint** and a **sunset cove**.
- **Later:** the venue street and festival quarter, themed as a Viking market and feast hall (food stalls, the Velvet Lounge as the tavern).

## Core game loop
1. **Start:** pick your character (existing), then your **companion**: baby dragon, dog or cat. A dragon starts as an egg you hatch.
2. **Bond:** pet, feed (fish), play. Bond rank rises with what you do together and unlocks: follow, fetch, fire tricks, **ride**, glide, dive, barrel roll.
3. **Train:** academy mini-games: catch-the-fish toss, ring courses, target fireballs, a timing game.
4. **Fly:** ride your dragon across the island. Races, treasure hunts, missions you send the dragon on and collect from.
5. **Quests and cast** (about 12, varied, medium, hints, never a dead end), told by the Viking-style cast.
6. **Collections:** dragon species, cats and dogs befriended, ways you died, food eaten.
7. **Finale:** three stars still lead to the secret word for Instagram.

## Dragon riding (the headline feature)
- **Controls on a phone:** left thumb joystick steers (heading and pitch), right thumb: **Flap/Boost** button (a tap adds climb smoothly over about half a second) and **Brake/Hover** button; a two-finger rotate gesture banks. Desktop: WASD, Space (flap), Shift (boost), Ctrl (brake).
- **Feel:** exaggerated glide so you lose little speed climbing, automatic righting when you stop banking, a stamina bar that refills when gliding, landing assist near the ground, forgiving collisions (a soft bounce, not a crash). Comedy crashes only when you do something silly on purpose.
- **Camera:** third person, trailing, with a gentle speed-based field of view and look-ahead.
- **Takeoff:** from Roost cliffs or the ground with a short run.
- **Cost:** flight lets the camera see farther and faster, so the chunk streaming (below) must pre-load ahead of the dragon.

## Technical design
- **Chunked world, rebuilt from scratch.** Noise-based height field with sharp cliffs and sea stacks, generated per 32 by 32 chunk with its own instanced trees, rocks, grass, props and buildings. Only chunks within about 70 units are visible (more in flight, with lower detail), fog hides the edge, frustum culling back on. Draw calls and triangles stay roughly flat as the island grows.
- **Budget gate:** touch profile at or under about 150 draw calls and 160k triangles in the busiest spot, measured in a real browser, and a frame-time governor that drops detail on slow phones. If a feature breaks the budget it gets a lower touch count, not a lower frame rate.
- **Buildings:** a procedural longhouse generator (timber A-frames, turf roofs, carved gables from simple shapes) first; CC0 kit models (Quaternius building packs) if their formats and costs check out.
- **Dragons:** recoloured and scaled species from one model, a small set of procedural animation tweaks (tilt, bank, wing-fold, bob) over the available clips.
- **People:** taller, better-proportioned Viking-style figures (procedural first; VRoid models later when you provide them).
- **Audio:** generated WebAudio (wing flaps, fire whoosh, cat meow, dog bark, ambient wind and sea), no audio files.

## Slapstick deaths (comedy, no blood)
Carried over: cliff falls, drowning, fire (campfires, the volcano), getting run over (a cart or wagon on the roads, cars later), dragon crashes. The death screen says exactly **"You died successfully."** and **"Wanna try again?"** with a Try Again button; respawn at the last checkpoint with quests and stars kept; a "Ways I Died" collection. The pause menu has "Dramatic exit" (a silly chosen death) and "Stuck? Respawn". No blood or gore, no "suicide" wording in the UI.

## The cast, quests and cats
Unchanged from the earlier spec, re-dressed: Nma, the Colonel (a made-up chieftain of a made-up land), Ukk-ass, Bang-odi, Tom, Nanda and an invented set of "film star" visitors, with Viking-era outfits. Banter on MCU, made-up politics, science, astrology, with sarcasm and teasing aimed at the cast and the player, never at real people or communities. Cats come over and meow; dogs (from the same animal pack) bark and fetch.

## Build order (each step playable, measured and reviewed)
| # | Step | You will see |
|---|---|---|
| 1 | **Chunked Viking island** | The big new island: cliffs, sea stacks, harbour village, roads, minimap |
| 2 | **Viking people** | Taller, better looking men and women, new outfits and hair |
| 3 | **Companion and bonding** | Pick baby dragon, dog or cat, hatch an egg, pet, feed, cats and dogs react |
| 4 | **Dragon riding** | Take off from the roost and fly across the island |
| 5 | **Quests and the cast** | About 12 quests with the named cast and banter |
| 6 | **Death system and hazards** | "You died successfully", fire, cliffs, sea |
| 7 | **Academy, races and missions** | Training mini-games, dragon races, treasure missions |
| 8 | **Venues and festivals** | Tavern, food stalls, feast hall, festival games |
| 9 | **Real models, polish, analytics, launch headers** | VRoid people, better dragon if available, a real phone test |

Steps 1 to 4 are the first big milestone: the island, the people, a companion and flying.

## Risks
- Rebuilding the world generator replaces `buildHub`, the largest function in the game (about 300 lines of hand placement); everything that depends on its positions (quests, NPCs, cats, trees, the snow globe portal) must be re-placed. This is a rewrite, not a patch.
- The free dragon is small, cute and has few animations; riding it will look charming, not majestic.
- Flight speed multiplies the streaming problem; a bug here shows as pop-in, stutter or falling through the world.
- Phones have no spare budget; the chunk system and the governor are what make this possible, and they are unproven until step 1 is measured on a real phone.
- Procedural "handsome" people are a judgement call; I will show renders for your approval.
- The slapstick-death text uses a joke title. It stays comedy-only; I will keep gore and instructional detail out.

## Out of scope for now
Multiplayer, live AI chat, cars and motorbikes (carts and the dragon come first), Higgsfield assets (no credits), the venue and festival content itself.
