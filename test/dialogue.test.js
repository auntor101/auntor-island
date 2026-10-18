import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, createConversation, pickBanter, sanitizeState, lineWeight, fill } from '../src/story/dialogue.js';

const mem = (init) => { const m = new Map(init ? [['k', init]] : []); return { getItem: () => m.get('k') ?? null, setItem: (_, v) => m.set('k', v) }; };

test('fill replaces every {name} and falls back', () => {
  assert.equal(fill('Hi {name}, {name}!', 'Sam'), 'Hi Sam, Sam!');
  assert.equal(fill('Hi {name}', ''), 'Hi Traveler');
  assert.equal(fill('{name}', 'a$&b'), 'a$&b');
});

test('sanitizeState drops junk', () => {
  const s = sanitizeState({ flags: { ok: true, 'bad key!': 1, n: 3, big: 'x'.repeat(50), o: {} }, met: ['nma', 5, 'nma', '<b>'], visits: { nma: 2, x: -1, y: 1.5 } });
  assert.deepEqual(s.flags, { ok: true, n: 3 });
  assert.deepEqual(s.met, ['nma']);
  assert.deepEqual(s.visits, { nma: 2 });
  assert.deepEqual(sanitizeState('nope'), { flags: {}, met: [], visits: {} });
  assert.deepEqual(sanitizeState([1]).met, []);
});

test('store persists, survives corrupt and throwing storage', () => {
  const st = mem(); const a = createStore(st);
  a.set('q', true); assert.equal(a.visit('nma'), 1); assert.equal(a.visit('nma'), 2);
  const b = createStore(st);
  assert.equal(b.flag('q'), true); assert.equal(b.visits('nma'), 2); assert.ok(b.met('nma'));
  assert.equal(createStore(mem('{not json')).visits('nma'), 0);
  const bad = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  const c = createStore(bad); c.set('a', 1); assert.equal(c.flag('a'), 1);
  a.set('bad key', 1); assert.equal(a.flag('bad key'), undefined);
  assert.equal(createStore(null).visit('x'), 1);
});

const G = [
  { id: 'a', who: 'nma', text: 'Hi {name}', choices: [{ text: 'Yes {name}', next: 'b', set: { friend: true } }, { text: 'No', next: 'c' }] },
  { id: 'b', who: 'nma', text: 'Great', once: true, next: 'c' },
  { id: 'c', who: 'nma', text: 'Bye' },
];
test('conversation follows choices, sets flags, ends', () => {
  const store = createStore(null), c = createConversation(G, 'a', store, 'Sam');
  assert.equal(c.node.text, 'Hi Sam'); assert.equal(c.node.choices[0].text, 'Yes Sam');
  c.choose(5); assert.equal(c.node.id, 'a'); // bad index is ignored
  c.choose(0); assert.equal(store.flag('friend'), true); assert.equal(c.node.id, 'b');
  c.choose(); assert.equal(c.node.id, 'c');
  c.choose(); assert.ok(c.done); assert.equal(c.node, null);
});
test('once nodes are skipped the second time', () => {
  const store = createStore(null);
  createConversation(G, 'a', store, 'S').choose(0);
  const c = createConversation(G, 'a', store, 'S'); c.choose(0);
  assert.equal(c.node.id, 'c');
});

const POOL = [
  { t: 'day', c: 'day', h: [6, 18] }, { t: 'night', c: 'night', h: [20, 5] }, { t: 'snow', c: 'snow', snow: true },
  { t: 'near {name}', c: 'rumour', near: 'arena' }, { t: 'dragon', c: 'comp', comp: 'dragon' }, { t: 'late', c: 'x', min: 3 },
  { t: 'a', c: 'a' }, { t: 'b', c: 'a' }, { t: 'c', c: 'a' }, { t: 'd', c: 'a' }, { t: 'e', c: 'a' }, { t: 'f', c: 'a' },
];
const ctx = (o) => ({ hours: 12, snow: 0, near: null, name: 'Sam', comp: 'cat', met: 1, ...o });

test('weights respect hours, snow, near, companion, times met', () => {
  assert.ok(lineWeight(POOL[0], ctx({ hours: 12 })) > 1);
  assert.equal(lineWeight(POOL[0], ctx({ hours: 22 })), 0);
  assert.ok(lineWeight(POOL[1], ctx({ hours: 2 })) > 0); // wraps midnight
  assert.equal(lineWeight(POOL[2], ctx({ snow: 0 })), 0);
  assert.ok(lineWeight(POOL[2], ctx({ snow: 1 })) > 1);
  assert.equal(lineWeight(POOL[3], ctx()), 0);
  assert.ok(lineWeight(POOL[3], ctx({ near: 'arena' })) > 1);
  assert.equal(lineWeight(POOL[4], ctx()), 0);
  assert.equal(lineWeight(POOL[5], ctx({ met: 2 })), 0);
  assert.ok(lineWeight(POOL[5], ctx({ met: 3 })) > 0);
});

test('pickBanter never repeats the last 4 and fills the name', () => {
  const store = createStore(null); let seed = 1; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const ids = [];
  for (let i = 0; i < 200; i++) ids.push(pickBanter('nma', POOL, ctx({ near: 'arena' }), store, rand).id);
  for (let i = 4; i < ids.length; i++) assert.ok(!ids.slice(i - 4, i).includes(ids[i]), 'repeat at ' + i);
  assert.ok(ids.includes(3));
  assert.equal(pickBanter('y', POOL.slice(3, 4), ctx({ near: 'arena' }), createStore(null)).text, 'near Sam');
  const only = [{ t: 'only {name}', c: 'a' }];
  assert.equal(pickBanter('z', only, ctx(), store).text, 'only Sam');
  assert.equal(pickBanter('z', only, ctx(), store).text, 'only Sam'); // a small pool still answers
  assert.equal(pickBanter('z', [{ t: 'n', c: 'a', h: [1, 2] }], ctx(), store), null);
});
test('night context picks night lines, snow lines only in snow', () => {
  const store = createStore(null);
  for (let i = 0; i < 50; i++) { const l = pickBanter('t' + i, POOL, ctx({ hours: 23 }), store); assert.notEqual(l.c, 'day'); assert.notEqual(l.c, 'snow'); }
});
