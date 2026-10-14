import test from 'node:test';
import assert from 'node:assert/strict';
import { heightAt, zoneAt, isWet, woods, LANDMARKS } from '../src/world/island.js';
import { placeAll, chunkField, placeChunk, STRIDE } from '../src/world/flora/placement.js';
import { SPECIES, SPECIES_BY_ID, MAX_PER_CHUNK } from '../src/world/flora/species.js';

const env = { heightAt, zoneAt, isWet, woods, landmarks: LANDMARKS };
const chunks = []; for (let cx = -6; cx <= 5; cx++) for (let cz = -6; cz <= 5; cz++) chunks.push([cx, cz]);
const all = chunks.map(([cx, cz]) => ({ cx, cz, r: placeAll(cx, cz, env) }));
const each = (fn) => { for (const { r } of all) for (const s of SPECIES) { const { n, data } = r[s.id]; for (let i = 0; i < n; i++) fn(s, data.subarray(i * STRIDE, (i + 1) * STRIDE), i); } };

test('placement is deterministic', () => {
  const a = placeAll(-3, -2, env), b = placeAll(-3, -2, env);
  for (const s of SPECIES) assert.deepEqual(a[s.id].data, b[s.id].data);
});

test('the island gets a believable amount of every kind of plant', () => {
  const total = {}; each((s) => { total[s.id] = (total[s.id] || 0) + 1; });
  for (const s of SPECIES) assert.ok(total[s.id] > 3, s.id + ' appears');
  for (const { r } of all) for (const s of SPECIES) assert.ok(r[s.id].n <= MAX_PER_CHUNK);
  assert.ok(total.tree > 300 && total.tree < 6000, 'trees ' + total.tree);
});

test('nothing grows in water or on a steep slope', () => {
  let steep = 0, total = 0; // the lattice is 2 m: a rare clump may straddle a sharp edge, so slope is judged in aggregate
  each((s, o) => {
    const [x, y, z] = o;
    assert.ok(!isWet(x, z), s.id + ' in water at ' + x + ',' + z);
    assert.ok(Math.abs(y - heightAt(x, z)) < (s.noY ? 0.2 : 1e-3), s.id + ' height');
    if (s.water >= 2) assert.ok(!isWet(x + 2, z) && !isWet(x - 2, z) && !isWet(x, z + 2) && !isWet(x, z - 2), s.id + ' needs a water margin');
    const sl = Math.hypot(heightAt(x + 1, z) - heightAt(x - 1, z), heightAt(x, z + 1) - heightAt(x, z - 1)) / 2;
    total++; if (sl > s.slope * 1.3 + 0.15) steep++;
  });
  assert.ok(steep <= total * 0.004, steep + ' of ' + total + ' too steep');
});

test('same-species spacing is respected, also across chunk borders', () => {
  for (const id of ['tree', 'pine', 'bush', 'rock']) {
    const s = SPECIES_BY_ID[id], min = s.cell * (1 - s.jit) - 1e-3, pts = [];
    for (const { r } of all) for (let i = 0; i < r[id].n; i++) pts.push([r[id].data[i * STRIDE], r[id].data[i * STRIDE + 2]]);
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      if (Math.abs(pts[i][0] - pts[j][0]) > min || Math.abs(pts[i][1] - pts[j][1]) > min) continue;
      assert.ok(Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) >= min, id + ' too close');
    }
  }
});

test('bushes and rocks keep clear of trees', () => {
  const trees = []; each((s, o) => { if (s.id === 'tree' || s.id === 'pine') trees.push([o[0], o[2], SPECIES_BY_ID[s.id].r]); });
  let bad = 0, checked = 0;
  each((s, o) => {
    if (s.id !== 'bush' && s.id !== 'rock') return;
    checked++;
    for (const [x, z, r] of trees) if (Math.hypot(x - o[0], z - o[2]) < (r + s.r) * 0.85) bad++;
  });
  assert.ok(checked > 50);
  assert.ok(bad <= checked * 0.01, bad + ' of ' + checked + ' overlap'); // chunk borders use a clamped lattice, so a stray overlap is allowed
});

test('clear zones: no trees at the spawn or the village centre; keep-out hook is obeyed', () => {
  each((s, o) => {
    if (!s.solid) return;
    assert.ok(Math.hypot(o[0] - LANDMARKS.spawn.x, o[2] - LANDMARKS.spawn.z) >= 7, s.id + ' at spawn');
    if (s.id !== 'rock') assert.ok(Math.hypot(o[0], o[2]) >= 13, s.id + ' at the village');
  });
  const blocked = (x, z, r) => Math.hypot(x + 60, z + 20) < 25 + r;
  for (const [cx, cz] of [[-2, -1], [-3, -1], [-2, 0]]) {
    const f = chunkField(cx, cz, { ...env, keepOut: blocked }), r = placeChunk(f, { ...env, keepOut: blocked }, 0);
    for (const id of ['tree', 'pine', 'dead']) for (let i = 0; i < r[id].n; i++) assert.ok(!blocked(r[id].data[i * STRIDE], r[id].data[i * STRIDE + 2], 0), 'keep-out ignored');
  }
});

test('biomes: no grass on the volcano, no trees on the beach, pines on the mountain', () => {
  const by = {}; each((s, o) => { const z = zoneAt(o[0], o[2]); (by[s.id] = by[s.id] || {})[z] = (by[s.id][z] || 0) + 1; });
  const edge = (id, zs) => zs.reduce((n, z) => n + (by[id][z] || 0), 0); // the lattice is 2 m, so a few clumps may straddle a zone border
  assert.ok(edge('grass', ['volcano', 'glacier', 'beach']) < 0.02 * Object.values(by.grass).reduce((a, b) => a + b, 0));
  assert.ok(edge('tree', ['beach', 'volcano', 'glacier']) <= 2);
  assert.ok(Object.values(by.pine).reduce((a, b) => a + b, 0) > 30 && by.dead.volcano > 0);
  assert.ok(by.tree.grove > 5 && by.flower.meadow > 20);
});

test('a chunk is cheap enough to build on a phone', () => {
  placeAll(0, 2, env); // warm up the JIT
  const t = performance.now(); for (let i = 0; i < 6; i++) placeAll(-1 + i, 1, env);
  assert.ok((performance.now() - t) / 6 < 40, 'ms per chunk ' + ((performance.now() - t) / 6).toFixed(1));
});
