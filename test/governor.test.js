import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextPixelRatio } from '../src/render/governor.js';

const args = (cur, avg, above, below, ceil = 2) => [cur, avg, above, below, ceil];

test('lowers by 0.25 after 2s above 20ms', () => {
  assert.equal(nextPixelRatio(...args(2, 25, 2000, 0)), 1.75);
});
test('does not lower before 2s', () => {
  assert.equal(nextPixelRatio(...args(2, 25, 1999, 0)), 2);
});
test('never goes below 1', () => {
  assert.equal(nextPixelRatio(...args(1, 30, 5000, 0)), 1);
});
test('raises by 0.25 after 5s below 12ms, up to ceiling', () => {
  assert.equal(nextPixelRatio(...args(1.5, 8, 0, 5000)), 1.75);
  assert.equal(nextPixelRatio(...args(2, 8, 0, 9000)), 2);
});
test('does not raise before 5s', () => {
  assert.equal(nextPixelRatio(...args(1.5, 8, 0, 4999)), 1.5);
});
test('respects a ceiling under 2', () => {
  assert.equal(nextPixelRatio(...args(1.5, 8, 0, 6000, 1.5)), 1.5);
});

import { clampPixelRatio, smoothMs } from '../src/render/governor.js';

test('clampPixelRatio clamps to [1, ceiling]', () => {
  assert.equal(clampPixelRatio(0.5, 2), 1);
  assert.equal(clampPixelRatio(3, 2), 2);
  assert.equal(clampPixelRatio(1.5, 2), 1.5);
  assert.equal(clampPixelRatio(2, 1.5), 1.5);
});
test('smoothMs follows raw frame time beyond 50 ms', () => {
  let a = 16;
  for (let i = 0; i < 200; i++) a = smoothMs(a, 100);
  assert.ok(a > 95); // 10 fps is reported as 10, not capped at 20
});
