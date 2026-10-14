// Prints good camera targets per biome (for demo/flora.js): the 24 m cell with the most flowers / trees / pines ... inside each zone.
import { heightAt, zoneAt, isWet, woods, LANDMARKS } from '../src/world/island.js';
import { placeAll, STRIDE } from '../src/world/flora/placement.js';
const env = { heightAt, zoneAt, isWet, woods, landmarks: LANDMARKS };
const cells = {};
for (let cx = -6; cx < 6; cx++) for (let cz = -6; cz < 6; cz++) {
  const r = placeAll(cx, cz, env);
  for (const id of ['flower', 'tree', 'pine', 'dead', 'reed', 'rock', 'driftwood', 'bush']) for (let i = 0; i < r[id].n; i++) {
    const x = r[id].data[i * STRIDE], z = r[id].data[i * STRIDE + 2], k = Math.round(x / 16) + ',' + Math.round(z / 16);
    const c = cells[k] ||= { x: Math.round(x / 16) * 16, z: Math.round(z / 16) * 16, zone: zoneAt(Math.round(x / 16) * 16, Math.round(z / 16) * 16) };
    c[id] = (c[id] || 0) + 1;
  }
}
const best = (id, zone) => Object.values(cells).filter((c) => !zone || c.zone === zone).sort((a, b) => (b[id] || 0) - (a[id] || 0)).slice(0, 3).map((c) => `${c.x},${c.z} ${c.zone} h${heightAt(c.x, c.z).toFixed(0)} n=${c[id]}`);
for (const [id, zone] of [['flower', 'meadow'], ['tree', 'forest'], ['tree', 'grove'], ['flower', 'grove'], ['pine', null], ['dead', null], ['reed', 'cove'], ['driftwood', null], ['rock', null]]) console.log(id, zone || '', best(id, zone).join(' | '));
console.log(LANDMARKS);
