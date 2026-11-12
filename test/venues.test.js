import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MENUS, ALL_ITEMS, BUFFS, KEY, load, eat, venueNear, give, tick, speedMul } from '../src/game/venues.js';
import { VENUES } from '../src/world/village/layout.js';

const mem = (init) => { const m = new Map(init ? [[KEY, init]] : []); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

test('every village venue has a menu with three dishes and valid buffs', () => {
  for (const v of VENUES) assert.equal(MENUS[v]?.items.length, 3, v);
  for (const i of ALL_ITEMS) assert.ok(BUFFS[i.buff], i.id);
  assert.equal(new Set(ALL_ITEMS.map((i) => i.id)).size, ALL_ITEMS.length);
});

test('first taste stamps the passport, repeats only count', () => {
  const s = mem();
  const a = eat(s, 'tira-classic'), b = eat(s, 'tira-classic'), c = eat(s, 'mn-veg');
  assert.ok(a.first && !b.first && c.first && c.tried === 2 && c.total === 24);
  assert.deepEqual(load(s), { 'tira-classic': 2, 'mn-veg': 1 });
  assert.equal(eat(s, 'nope'), null);
});

test('hostile storage is ignored', () => {
  assert.deepEqual(load(mem('{"tira-classic":2,"evil":5,"mn-veg":-1,"cf-flat":"x"}')), { 'tira-classic': 2 });
  assert.deepEqual(load(mem('}{')), {});
});

test('venueNear finds the closest anchor within range', () => {
  const a = { coffee: { x: 10, z: 10 }, mungdi: { x: 40, z: 0 } };
  assert.equal(venueNear(a, { x: 11, z: 10 }), 'coffee');
  assert.equal(venueNear(a, { x: 0, z: 0 }), null);
});

test('buffs run down and swift speeds you up', () => {
  let b = give({}, 'swift');
  assert.equal(speedMul(b), 1.25);
  b = tick(b, 30); assert.equal(speedMul(b), 1.25);
  b = tick(b, 20); assert.deepEqual(b, {}); assert.equal(speedMul(b), 1);
});
