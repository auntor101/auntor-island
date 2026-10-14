# Auntor Island

A tiny 3D world for an Instagram bio link. Wander the island, help the villagers, answer riddles, and zoom into a snow globe to find a hidden winter world and a secret word.

## Quick start
```bash
npx serve .            # then open the printed URL
# or
python3 -m http.server 8080
```

## Working on it with Claude Code
```bash
cd lumen-isle
claude
```
Claude Code reads `CLAUDE.md` automatically. It explains how the code is laid out, how the portal effect works, the visual rules and the performance budget. Some good first requests:
- "Replace @101auntojje with @myname and change the secret word to ..."
- "Add a second portal: a painting in Mira's house that leads to a watercolour meadow"
- "Swap the player for a GLB model with walk and idle animations"

## Tests
```bash
npm install
npm test          # plays the whole quest chain headlessly and checks for errors
npm run shots     # saves desktop and phone screenshots to tools/shots/
```

## Deploy
`npm run build` writes `dist/`, which holds only what visitors need (page, scripts, vendor, assets) and adds a Content-Security-Policy meta tag. Never publish the project root: it contains sources, docs and `node_modules`.

- **GitHub Pages (current):** the `gh-pages` branch holds a copy of `dist/`. Publish with `npm run build`, then push `dist/` to `gh-pages` (see CLAUDE.md).
- **Netlify / Cloudflare Pages:** build command `node tools/build-site.js`, publish directory `dist`.

Put the live URL in your Instagram bio.

## Controls
- Phone: drag the left half of the screen to walk and the right half to look. Tap a villager or press the action button to talk.
- Desktop: WASD or the arrow keys to walk, drag to look, scroll to zoom, E to talk.

## Credits
three.js r128 (MIT), included in `vendor/three/`. Fonts: Fraunces and Nunito from Google Fonts. Trees: Quaternius Stylized Nature MegaKit, CC0 (see `assets/CREDITS.md`). three.js r128 is MIT licensed (`vendor/three/LICENSE`).
