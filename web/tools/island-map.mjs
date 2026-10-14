// Debug: ASCII zone map (60x30) over [-200,200]^2 plus land stats. Run: node tools/island-map.mjs
import { heightAt, zoneAt } from '../src/world/island.js';
const L = { sea: '.', beach: 'b', village: 'V', meadow: 'm', forest: 'f', roost: 'R', mountain: 'M', glacier: 'G', volcano: 'O', grove: 'g', tower: 'T', cove: 'c' };
for (let j = 0; j < 30; j++) {
  let row = '';
  for (let i = 0; i < 60; i++) row += L[zoneAt(-200 + (i + 0.5) * 400 / 60, -200 + (j + 0.5) * 400 / 30)];
  console.log(row);
}
console.log(Object.entries(L).map(([k, v]) => `${v}=${k}`).join(' '), '(north up, east right, 400 m wide)');
let n = 0, max = 0, far = 0, steep = 0;
for (let x = -300; x <= 300; x += 5) for (let z = -300; z <= 300; z += 5) {
  const h = heightAt(x, z);
  if (h > 0) { n++; far = Math.max(far, Math.hypot(x, z)); }
  if (h > max) max = h;
  if (h > 0 && zoneAt(x, z) !== 'roost' && Math.abs(heightAt(x + 1, z) - h) > 1) steep++;
}
console.log(`land area ${n * 25} m2, farthest land ${far.toFixed(0)} m, max height ${max.toFixed(1)} m, steep (>1) land cells outside roost: ${steep}`);
