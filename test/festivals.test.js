import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FESTIVALS, current, newRound, start, tap, tick, best, saveBest, ROUND_SECS, KEY } from '../src/game/festivals.js';

const mem = (init) => { const m = new Map(init ? [[KEY, init]] : []); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

test('one festival per in-game day, cycling', () => {
  assert.equal(current(0).id, FESTIVALS[0].id);
  assert.equal(current(24 * 3 + 5).id, FESTIVALS[3].id);
  assert.equal(current(24 * FESTIVALS.length).id, FESTIVALS[0].id);
  assert.equal(current(-1).id, FESTIVALS[FESTIVALS.length - 1].id);
});

test('override picks by id, unknown gives null', () => {
  assert.equal(current(0, 'winter').id, 'winter');
  assert.equal(current(0, 'nope'), null);
});

test('every festival has colours, a motion and a verb', () => {
  for (const f of FESTIVALS) { assert.ok(f.colors.length >= 3 && f.colors.every((c) => /^#[0-9a-f]{6}$/i.test(c))); assert.ok(['fall', 'rise', 'drift'].includes(f.motion)); assert.ok(f.verb && f.blurb); }
  assert.equal(new Set(FESTIVALS.map((f) => f.id)).size, FESTIVALS.length);
});

test('round: taps only count while on, ends after ROUND_SECS', () => {
  let r = tap(newRound()); assert.equal(r.score, 0);
  r = start(r); r = tap(tap(r)); assert.equal(r.score, 2);
  r = tick(r, ROUND_SECS - 1); assert.ok(r.on);
  r = tick(r, 2); assert.ok(r.done && !r.on);
  assert.equal(tap(r).score, 2);
});

test('best score only goes up and survives bad storage', () => {
  const s = mem();
  assert.ok(saveBest(s, 12)); assert.ok(!saveBest(s, 5)); assert.equal(best(s), 12);
  assert.equal(best(mem('-3')), 0); assert.equal(best(mem('abc')), 0);
  assert.equal(best({ getItem() { throw new Error('x'); } }), 0);
});
