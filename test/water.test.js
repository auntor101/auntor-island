import test from 'node:test';
import assert from 'node:assert/strict';
import { createRipples } from '../src/world/ripples.js';
import { buildSea, buildSkyline, buildRibbons } from '../src/world/water.js';

test('ripples: ring buffer of 8 reuses the oldest slot', () => {
  const r = createRipples();
  for (let i = 0; i < 9; i++) { r.setTime(i); r.add(i, 0, 1); }
  const xs = r.uniform.value.map((v) => v.x);
  assert.equal(xs.length, 8);
  assert.equal(xs[0], 8); // the 9th ripple overwrote the 1st
  assert.equal(r.uniform.value[0].z, 8);
});

test('sea mesh stays under 30k triangles', () => {
  const g = buildSea();
  assert.ok(g.index.count / 3 < 30000);
});

test('skyline: flat ground is below the horizon line, a wall to the north is not', () => {
  assert.ok(buildSkyline(() => 0, 0, 0, 4).every((v) => v < 25));
  const sky = buildSkyline((x, z) => (z < -50 ? 60 : 0), 0, 0, 4);
  assert.ok(Math.max(...sky) > 100);
});

test('river ribbon never rises downstream and flags steep drops', () => {
  const g = buildRibbons([{ width: 4, pts: [[0, 0], [0, 20], [0, 40]] }], () => 0, (x, z) => (z < 20 ? 10 : 2));
  const y = g.attributes.position.array, cols = 7;
  for (let i = cols * 3 + 1; i < y.length; i += cols * 3) assert.ok(y[i] <= y[i - cols * 3] + 1e-6);
  assert.ok(Math.max(...g.attributes.aSlope.array) > 1);
});
