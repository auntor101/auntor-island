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
  for (const k of ['sea', 'beach', 'village', 'meadow', 'forest', 'roost', 'mountain', 'glacier', 'volcano', 'grove', 'tower', 'cove'])
    assert.ok(seen.has(k), `missing zone ${k}`);
});
