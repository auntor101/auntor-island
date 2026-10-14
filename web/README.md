# Auntor Island (new app)

A modern anime-style island you walk across as a man, woman, elf or wizard, under a day and night sky with stars, a moon, sunrise, sunset and switchable snow. The old small game still lives at the repository root; this app is its rebuild.

## Run it
```
cd web
npm install
npm run dev          # prints a Local and a Network address
```
Open the **Network** address on your phone (same Wi-Fi). `npm test` runs the unit tests, `npm run build` makes `dist/`, `npm run build:preview` makes a relative-path build you can host in any sub-folder.

## Controls
- Phone: drag on the left half to walk (push the stick past the ring to run, or hold **Run**), drag on the right half to look.
- Keyboard and mouse: WASD or arrows, Shift to run, drag to look.
- **Sky** button (top right): Time (Auto, Dawn, Day, Sunset, Night) and Snow on or off. **stats** shows frame rate, draw calls and triangles.

## URL tools (for testing)
`?char=man|woman|elf|wizard&name=Sam` skips the select screen, `?t=<hours>` fixes the time (0 to 24), `?snow=1`, `?phase=<0..1>` moon phase, `?cam=spawn|aerial|beach|volcano|peak|village` debug views, `?fly` free camera.

## Performance goals (to be confirmed on a real phone)
60 fps on a flagship phone, at least 45 on mid-range, about 300 draw calls and 600k triangles in the busiest view, a frame-time governor that lowers the pixel ratio before frames drop. Measured so far (software rendering, so only the counts mean anything): about 70 to 85 draw calls and 62k to 78k triangles with a character on screen.

## Real-phone checklist (please try this and send back the answers)
1. Open the link on your phone and tap **stats**.
2. Pick a character, enter a name, press Start, and walk for a minute (also run).
3. Open **Sky**: try Sunset and Night, then Snow.
4. Send back: your phone model and browser, whether it ran smoothly (and where it stuttered), the **fps, calls and tris** shown, whether the buttons were easy to reach with one thumb, and a screenshot.

## Layout
`src/render` renderer, post-processing, frame-time governor. `src/world` island shape (`island.js`), terrain chunks, sky, water, time of day, stars, moon, snow. `src/play` player, controls, camera, roster and attachments. `src/ui` HUD and the select screen. `public/models` the four characters (CC0 VRoid sample models, shrunk). `tools/shoot.mjs` headless screenshot tool, `tools/touch-check.mjs` touch test (needs a server).
