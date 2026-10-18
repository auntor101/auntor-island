import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sunDirection, moonDirection, skyPalette } from '../src/world/time.js';

test('sun path: east at 6, high at noon, west at 18, below at night', () => {
  assert.ok(sunDirection(12)[1] > 0.8);
  assert.ok(sunDirection(0)[1] < -0.8);
  for (const h of [6, 18]) assert.ok(Math.abs(sunDirection(h)[1]) < 0.1);
  assert.ok(sunDirection(6)[0] * sunDirection(18)[0] < 0);
  assert.ok(sunDirection(6)[0] > 0.5); // east is +x
});

test('moon is opposite the sun and directions are unit', () => {
  for (const h of [0, 3.3, 6, 12, 17.7, 23]) {
    const s = sunDirection(h), m = moonDirection(h);
    m.forEach((v, i) => assert.ok(Math.abs(v + s[i]) < 1e-9));
    assert.ok(Math.abs(Math.hypot(...s) - 1) < 1e-9);
  }
});

test('palette visibility, wrap and format', () => {
  assert.equal(skyPalette(12).stars, 0);
  assert.equal(skyPalette(0).stars, 1);
  assert.equal(skyPalette(0).moon, 1);
  assert.equal(skyPalette(12).moon, 0);
  assert.deepEqual(skyPalette(24), skyPalette(0));
  assert.deepEqual(skyPalette(-6), skyPalette(18));
  const p = skyPalette(7.3);
  for (const k of ['zenith', 'horizon', 'sunColor', 'ambient', 'fog']) assert.match(p[k], /^#[0-9a-f]{6}$/);
  assert.equal(typeof p.sunIntensity, 'number');
});

test('palette is continuous (no pops) through the whole day', () => {
  const rgb = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  let prev = skyPalette(0);
  for (let h = 0.05; h <= 24.0001; h += 0.05) {
    const p = skyPalette(h);
    for (const k of ['zenith', 'horizon', 'fog']) rgb(p[k]).forEach((v, i) => assert.ok(Math.abs(v - rgb(prev[k])[i]) < 0.06, `${k} jumps at ${h.toFixed(2)}`));
    prev = p;
  }
});

test('drawn moon stays low enough for the follow camera to see it', async () => {
  const { moonSkyDirection } = await import('../src/world/time.js');
  for (let h = 0; h < 24; h += 0.25) {
    const m = moonSkyDirection(h), t = moonDirection(h);
    assert.ok(Math.abs(Math.hypot(...m) - 1) < 1e-9);
    assert.ok(m[1] <= 0.27, 'altitude under about 17 degrees');
    assert.equal(m[1] > 0, t[1] > 0);
  }
});
