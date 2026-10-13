# Brainstorm backlog

## Core idea
A cosy open world in the browser, linked from an Instagram bio. People explore, meet villagers, solve small quests and riddles, and zoom into objects to reach new worlds. Each world hides one secret word that people DM to the owner.

## Portal objects: each one is a new world and a monthly content drop
- **Snow globe** leads to Snowglobe Hollow, a night village with northern lights and Kit the fox. *Built.*
- **A painting in Mira's house** leads to a watercolour meadow where everything is hand-painted and paint-stroke textures shift as you walk.
- **Tobi's message in a bottle** leads to an underwater shipwreck with glowing jellyfish and a treasure-chest puzzle.
- **The telescope on the windmill** leads to a tiny moon you can walk all the way around, with gravity that follows the sphere.
- **An old arcade cabinet** leads to a neon city with a mini racing game.
- **A phone on a café table** leads to a gallery world built from the owner's real Instagram photos.
- **A music box** leads to a world that pulses to the beat, with rhythm-tap puzzles.

## NPC ideas
- NPCs remember earlier answers; for example, Kit refers back to what you said the world was for.
- A rival kid who challenges you to races around the island.
- A cat that follows you after you feed it, and points out hidden secrets.
- A version of the owner as a villager, who gives the final quest.
- A traveling merchant who appears in a different place each day.

## Question and puzzle types
- Riddles with multiple-choice answers. *Built with Tobi.*
- "Pick one" personality questions that change the reply. *Built with Kit.*
- "Which of these is true about me?" questions about the owner, for followers who know them.
- Spot the difference between two paintings.
- Light-beam mirror puzzles, sound or melody memory, constellation drawing.
- Collection quests, such as fireflies. *Built.*

## Instagram loop
- One secret word per world, so people DM you once per drop.
- A share card ("I found 3/3 stars on Lumen Isle"), exported as a 9:16 image for stories.
- A limited-time easter egg that only appears for a week.
- Seasonal changes to the island: snow in December, cherry blossoms in spring.

## Getting to true animated-film quality
- Rigged, animated characters (GLB plus GLTFLoader and AnimationMixer) for walk, idle and talk cycles.
- Concept art and character turnarounds from Higgsfield, then image-to-3D for props.
- Painted sky textures in place of the gradient sky.
- Facial expressions through texture swaps during dialogue.
- A short cinematic teaser for the Instagram post, recorded in-engine or generated.

## Technical upgrades
- Move to Vite with ES-module three.js once there are several worlds, so each world can be a separate code-split chunk.
- Save progress in localStorage so returning visitors keep their stars.
- An analytics event when someone reaches each world.
