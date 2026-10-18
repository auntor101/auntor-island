import { test } from 'node:test';
import assert from 'node:assert/strict';
import { birdsAway } from '../src/world/birds.js';

test('birds: home by day, leaving through sunset, gone by dusk and night, back at sunrise', () => {
  for (const h of [7, 12, 17]) assert.equal(birdsAway(h), 0);
  for (const h of [19, 21, 23, 0, 3, 5.5]) assert.equal(birdsAway(h), 1);
  let prev = 0;
  for (let h = 17.5; h <= 18.7; h += 0.05) { const a = birdsAway(h); assert.ok(a >= prev); prev = a; }
  assert.ok(birdsAway(18) > 0.2 && birdsAway(18) < 0.8);
  assert.ok(birdsAway(6.2) > 0 && birdsAway(6.2) < 1);
  assert.equal(birdsAway(24 + 12), 0); // wraps
});
