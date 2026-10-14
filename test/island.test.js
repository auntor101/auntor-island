import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heightAt, zoneAt, LANDMARKS, SEA_STACKS } from '../src/world/island.js';

const slope = (x, z) => {
  const h = heightAt(x, z);
  return Math.max(...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => Math.abs(heightAt(x + a, z + b) - h)));
};
const between = (v, lo, hi, what) => assert.ok(v >= lo && v <= hi, `${what} = ${v}, want ${lo}..${hi}`);

test('determinism', () => {
  assert.equal(heightAt(12.3, -45.6), heightAt(12.3, -45.6));
});

test('open sea at radius 260', () => {
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, x = 260 * Math.cos(a), z = 260 * Math.sin(a);
    assert.ok(heightAt(x, z) < -2, `height at angle ${i}`);
    assert.equal(zoneAt(x, z), 'sea');
  }
});

test('land area and radius', () => {
  let n = 0, far = 0, near = Infinity;
  for (let x = -300; x <= 300; x += 5) for (let z = -300; z <= 300; z += 5) {
    const r = Math.hypot(x, z);
    if (heightAt(x, z) > 0) { n++; far = Math.max(far, r); } else near = Math.min(near, r);
  }
  between(n * 25, 55000, 95000, 'land area');
  between(far, 130, 190, 'farthest land');
  assert.ok(near < 200, `nearest sea ${near}`);
});

test('spawn is a flat village', () => {
  const { x, z } = LANDMARKS.spawn;
  between(heightAt(x, z), 1.2, 6, 'spawn height');
  assert.ok(slope(x, z) < 0.3);
  assert.equal(zoneAt(x, z), 'village');
});

test('landmark heights', () => {
  const h = (k) => heightAt(LANDMARKS[k].x, LANDMARKS[k].z);
  assert.ok(h('mountain') >= 55, 'mountain');
  assert.ok(h('volcano') >= 40, 'volcano');
  between(h('beach'), 0.1, 1.6, 'beach');
  between(h('tower'), 8, 35, 'tower');
  between(h('grove'), 3, 14, 'grove');
  between(h('cove'), 0, 2, 'cove');
  assert.ok(h('roost') >= 15, 'roost');
  let max = 0;
  for (let dx = -10; dx <= 10; dx++) for (let dz = -10; dz <= 10; dz++)
    if (dx * dx + dz * dz <= 100) max = Math.max(max, slope(LANDMARKS.roost.x + dx, LANDMARKS.roost.z + dz));
  assert.ok(max > 1.0, `roost cliff slope ${max}`);
});

test('landmark zones match their names', () => {
  for (const k of ['roost', 'mountain', 'volcano', 'beach', 'tower', 'grove', 'cove'])
    assert.equal(zoneAt(LANDMARKS[k].x, LANDMARKS[k].z), k);
});

test('sea stacks stand offshore', () => {
  assert.ok(SEA_STACKS.length >= 5);
  for (const { x, z, h } of SEA_STACKS) {
    between(h, 8, 30, 'stack h');
    assert.ok(heightAt(x, z) >= h - 3, 'stack top');
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += heightAt(x + 12 * Math.cos(i * Math.PI / 6), z + 12 * Math.sin(i * Math.PI / 6));
    assert.ok(sum / 12 < -1.5, `ring avg ${sum / 12}`);
  }
});

test('every zone appears on the grid', () => {
  const seen = new Set();
  for (let x = -300; x <= 300; x += 5) for (let z = -300; z <= 300; z += 5) seen.add(zoneAt(x, z));
  for (const k of ['sea', 'lake', 'river', 'beach', 'village', 'meadow', 'forest', 'roost', 'mountain', 'glacier', 'volcano', 'grove', 'tower', 'cove'])
    assert.ok(seen.has(k), `missing zone ${k}`);
});

// ---- fresh water, cliffs, walkability ----
import { LAKE, RIVERS, FALLS, waterSurfaceAt, isWet } from '../src/world/island.js';

const depthAt = (x, z) => { const s = waterSurfaceAt(x, z); return s === null ? 0 : s - heightAt(x, z); };

test('water surface: sea, lake, rivers, dry land', () => {
  assert.equal(waterSurfaceAt(260, 0), 0);
  assert.equal(waterSurfaceAt(LAKE.x, LAKE.z), LAKE.level);
  assert.equal(waterSurfaceAt(LANDMARKS.village.x + 12, LANDMARKS.village.z + 30), null);
  assert.equal(isWet(LAKE.x, LAKE.z), true);
  assert.equal(zoneAt(LAKE.x, LAKE.z), 'lake');
});

test('lake: deep middle, shallow rim, irregular shore, mean radius LAKE.r', () => {
  assert.ok(LAKE.level - heightAt(LAKE.x, LAKE.z) >= 2.5, 'centre depth');
  const rs = [];
  for (let i = 0; i < 72; i++) {
    const t = i / 72 * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
    let r = 0; while (r < 60 && waterSurfaceAt(LAKE.x + (r + 0.5) * c, LAKE.z + (r + 0.5) * s) === LAKE.level) r += 0.5;
    rs.push(r);
    // wading: somewhere between the shore and the middle the depth is under 0.5 m for at least 2 m of the way in
    if (s > -0.3) assert.ok(depthAt(LAKE.x + (r - 2) * c, LAKE.z + (r - 2) * s) < 0.5, `rim depth at angle ${i}`); // the north headwall may be sheer
  }
  const mean = rs.reduce((a, b) => a + b) / rs.length;
  between(mean, LAKE.r - 3, LAKE.r + 3, 'mean shore radius');
  assert.ok(Math.max(...rs) - Math.min(...rs) > 4, 'irregular shoreline');
});

test('rivers: water level only goes down, outflow reaches the sea level near the cove', () => {
  for (const rv of RIVERS) {
    let prev = Infinity, n = 0;
    for (let i = 0; i < rv.pts.length - 1; i++) for (let k = 0; k < 20; k++) {
      const [a, b] = [rv.pts[i], rv.pts[i + 1]], u = k / 20, x = a[0] + (b[0] - a[0]) * u, z = a[1] + (b[1] - a[1]) * u;
      const s = waterSurfaceAt(x, z);
      if (s === null) continue;
      assert.ok(s <= prev + 1e-6, `${rv.name} level rises at ${x.toFixed(0)},${z.toFixed(0)}: ${s} > ${prev}`);
      prev = s; n++;
    }
    assert.ok(n > 30, `${rv.name} is wet along its line`);
  }
  const end = RIVERS[1].pts.at(-1);
  between(waterSurfaceAt(end[0], end[1]), 0, 0.6, 'outflow level at the mouth');
});

test('waterfall: a cliff step of FALLS.drop with a plunge pool below', () => {
  const f = FALLS[0], top = waterSurfaceAt(f.x, f.z - 3);
  between(top - LAKE.level, f.drop - 1.5, f.drop + 1.5, 'drop');
  assert.ok(depthAt(f.x + 0.5, f.z + 3) >= 1.5, 'plunge pool');
  let steep = 0;
  for (let z = f.z - 2; z <= f.z + 5; z += 0.5) steep = Math.max(steep, Math.abs(heightAt(f.x, z) - heightAt(f.x, z + 0.5)) / 0.5);
  assert.ok(steep > 2, `face slope ${steep}`);
});

test('each river has a wadeable crossing (whole cross-section at most 0.6 m deep)', () => {
  for (const rv of RIVERS) {
    let ok = false;
    for (let i = 0; i < rv.pts.length - 1 && !ok; i++) for (let k = 0; k < 40 && !ok; k++) {
      const [a, b] = [rv.pts[i], rv.pts[i + 1]], u = k / 40, l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const x = a[0] + (b[0] - a[0]) * u, z = a[1] + (b[1] - a[1]) * u, nx = -(b[1] - a[1]) / l, nz = (b[0] - a[0]) / l;
      ok = depthAt(x, z) > 0.05;
      for (let o = -6; o <= 6 && ok; o += 0.5) ok = depthAt(x + nx * o, z + nz * o) <= 0.6;
    }
    assert.ok(ok, `${rv.name} crossing`);
  }
});

test('cliffs: roost at least 15 m, NE tower band, headwall by the falls; ledges are flat treads', () => {
  assert.ok(heightAt(LANDMARKS.roost.x, LANDMARKS.roost.z) >= 15);
  const drop = (x0, z0, x1, z1) => { let m = 0; for (let k = 0; k < 40; k++) m = Math.max(m, Math.abs(heightAt(x0 + (x1 - x0) * k / 40, z0 + (z1 - z0) * k / 40) - heightAt(x0 + (x1 - x0) * (k + 1) / 40, z0 + (z1 - z0) * (k + 1) / 40)) / (Math.hypot(x1 - x0, z1 - z0) / 40)); return m; };
  const t = LANDMARKS.tower, tn = Math.hypot(t.x, t.z);
  assert.ok(drop(t.x, t.z, t.x * 1.25, t.z * 1.25) > 1.5 && tn > 100, 'tower cliff band slope');
  // a west ledge: a run of flat cells (slope < 0.15, at least 2 m long) with steep ground (> 1.5) on the seaward side
  let treads = 0;
  for (let a = Math.PI - 0.3; a <= Math.PI + 0.3; a += 0.05) for (let r = 100; r < 150; r += 1) {
    const x = r * Math.cos(a), z = r * Math.sin(a), h = heightAt(x, z);
    if (h < 6) continue;
    const s1 = Math.abs(heightAt(x + 1, z) - h), s2 = Math.abs(heightAt(x + 2, z) - h);
    if (s1 < 0.15 && s2 < 0.3 && Math.abs(heightAt(x - 1.5, z) - h) > 0.8) treads++;
  }
  assert.ok(treads >= 6, `west ledge treads ${treads}`);
});

test('the village stays calm: dry land within 30 m has slopes under 0.25 (the ramp up to the hills starts at 30 m)', () => {
  let worst = 0;
  for (let x = -40; x <= 40; x += 2) for (let z = -40; z <= 40; z += 2) {
    if (Math.hypot(x, z) > 30 || [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3]].some(([a, b]) => isWet(x + a, z + b))) continue; // banks within 3 m of water are wet-edge terrain
    if (Math.hypot(x - LAKE.x, z - LAKE.z) < 30) continue; // the lake bank is a feature, not the village
    worst = Math.max(worst, slope(x, z));
  }
  assert.ok(worst < 0.25, `village slope ${worst}`);
});

test('every landmark is reachable on foot from spawn (2 m cells, slope < 1.2, water <= 0.6 m)', () => {
  const N = 95, S = 2, cell = new Map();
  const h = (i, j) => { const k = i * 1000 + j; let v = cell.get(k); if (v === undefined) { const x = i * S, z = j * S; v = [heightAt(x, z), depthAt(x, z)]; cell.set(k, v); } return v; };
  const start = [Math.round(LANDMARKS.spawn.x / S), Math.round(LANDMARKS.spawn.z / S)], seen = new Set([start[0] * 1000 + start[1]]), q = [start];
  for (let n = 0; n < q.length; n++) {
    const [i, j] = q[n], [h0] = h(i, j);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      if (!a && !b) continue;
      const ni = i + a, nj = j + b, k = ni * 1000 + nj;
      if (seen.has(k) || Math.abs(ni) > N || Math.abs(nj) > N) continue;
      const [h1, d1] = h(ni, nj);
      if (d1 > 0.6 || h1 < -0.6 || Math.abs(h1 - h0) / (S * Math.hypot(a, b)) >= 1.2) continue;
      seen.add(k); q.push([ni, nj]);
    }
  }
  for (const [name, p] of Object.entries(LANDMARKS)) {
    let ok = false;
    for (let a = -2; a <= 2 && !ok; a++) for (let b = -2; b <= 2 && !ok; b++) ok = seen.has((Math.round(p.x / S) + a) * 1000 + Math.round(p.z / S) + b);
    assert.ok(ok, `${name} unreachable`);
  }
  // lake rim wadeable, lake middle blocked
  assert.ok(seen.has(Math.round((LAKE.x + LAKE.r - 3) / S) * 1000 + Math.round(LAKE.z / S)) || seen.has(Math.round((LAKE.x - LAKE.r + 3) / S) * 1000 + Math.round(LAKE.z / S)), 'lake rim');
  assert.ok(!seen.has(Math.round(LAKE.x / S) * 1000 + Math.round(LAKE.z / S)), 'lake middle blocked');
});
