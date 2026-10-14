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
// Clear spots: >= 5 m from every tree/bush/rock but with many trees within 18 m, for the given centres.
const all = [];
for (let cx = -6; cx < 6; cx++) for (let cz = -6; cz < 6; cz++) { const r = placeAll(cx, cz, env); for (const id of ['tree', 'pine', 'bush', 'rock', 'dead']) for (let i = 0; i < r[id].n; i++) all.push([r[id].data[i * STRIDE], r[id].data[i * STRIDE + 2], id]);
}
for (const [name, c] of [['forest', [-80, 80]], ['forest2', [-40, 70]], ['grove', [-70, -30]], ['meadow', [60, -50]], ['meadow2', [-60, 60]], ['mountain', [-120, 10]], ['summer', [60, 50]], ['summer2', [35, 25]]]) {
  let best = null;
  for (let x = c[0] - 25; x <= c[0] + 25; x += 2) for (let z = c[1] - 25; z <= c[1] + 25; z += 2) {
    if (isWet(x, z)) continue;
    let dmin = 99, near = 0; for (const [tx, tz] of all) { const d = Math.hypot(tx - x, tz - z); if (d < dmin) dmin = d; if (d < 18) near++; }
    if (dmin >= 5 && (!best || near > best.near)) best = { x, z, near, dmin: dmin.toFixed(1), zone: zoneAt(x, z) };
  }
  console.log('clear', name, JSON.stringify(best));
}
{ // densest forest-zone spot that is still >= 4.5 m from every trunk
  let best = null;
  for (let x = -150; x <= 150; x += 3) for (let z = -150; z <= 150; z += 3) {
    if (zoneAt(x, z) !== 'forest' || isWet(x, z)) continue;
    let dmin = 99, near = 0; for (const [tx, tz, id] of all) { if (id !== 'tree') continue; const d = Math.hypot(tx - x, tz - z); if (d < dmin) dmin = d; if (d < 16) near++; }
    if (dmin >= 4.5 && (!best || near > best.near)) best = { x, z, near, dmin: dmin.toFixed(1) };
  }
  console.log('forest-core', JSON.stringify(best));
}
