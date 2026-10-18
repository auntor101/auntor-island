import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heightAt, zoneAt, isWet } from '../src/world/island.js';
import { planVillage } from '../src/world/village/layout.js';
import { planSites } from '../src/world/landmarks/sites.js';
import { planNpcs } from '../src/world/npcs/place.js';
import { DEFS } from '../src/world/npcs/defs.js';
import { WALK } from '../src/play/player.js';
import { QUESTS, CARD } from '../src/story/questdata.js';
import { TYPES, newState, startQuest, progress, currentObjective, compassTarget, offers, sanitizeState, load, save, itemSpots, needOf, isDusk, isNight, KEY } from '../src/story/quests.js';

const V = planVillage({ heightAt, isWet, zoneAt }), P = planSites({ heightAt, isWet, zoneAt }, V.keepOut, V.center);
const village = { layout: V, colliders: V.colliders, anchors: Object.fromEntries(Object.entries(V.anchors).map(([k, v]) => [k, { x: v[0], z: v[1] }])) };
const pos = { village: { x: V.center[0], z: V.center[1] } };
for (const n of planNpcs(DEFS, village, heightAt, isWet)) pos[n.def.id] = { x: n.x, z: n.z };
for (const i of P.info) pos[i.id] = { x: i.x, z: i.z };
Object.assign(pos, village.anchors);
const where = (id) => pos[id] || null;

// Plays a quest to the end by feeding the events its steps want.
function play(state, id, extra = {}) {
  state = startQuest(state, id);
  const q = QUESTS.find((x) => x.id === id);
  assert.equal(state.cur?.id, id, 'started ' + id);
  for (let guard = 0; state.cur && guard < 50; guard++) {
    const c = state.cur, s = q.steps[c.step], ev = TYPES[s.type];
    let e;
    if (s.type === 'time') e = { t: ev, id: s.target, secs: s.secs, night: true };
    else if (s.type === 'ring-course' || s.type === 'pet') e = { t: ev, n: needOf(s) };
    else if (s.type === 'wait-night') e = { t: ev };
    else { const list = Array.isArray(s.target) ? s.target.filter((t) => !c.seen.includes(t)) : s.target === 'any' ? ['n' + c.seen.length] : [s.target]; e = { t: ev, id: list[0] }; }
    state = progress(state, e).state;
  }
  return state;
}

test('quest data: 12 quests plus the finale, 2 to 4 steps, known step types, givers and places', () => {
  assert.equal(QUESTS.length, 13);
  assert.equal(new Set(QUESTS.map((q) => q.id)).size, QUESTS.length);
  const ids = new Set(DEFS.map((d) => d.id));
  for (const q of QUESTS) {
    assert.ok(ids.has(q.giver), q.id + ' giver');
    assert.ok(q.steps.length >= 2 && q.steps.length <= 4, q.id + ' steps ' + q.steps.length);
    assert.ok(Number.isInteger(q.reward.stars) && q.reward.stars >= 0 && q.reward.stars <= 3);
    assert.ok(q.offer.length >= 2 && q.offer.length <= 3 && q.accept && q.hint, q.id + ' text');
    const last = q.steps.at(-1);
    assert.ok(last.type === 'talk' && last.target === q.giver, q.id + ' ends with the giver');
    for (const s of q.steps) {
      assert.ok(TYPES[s.type], q.id + ' type ' + s.type);
      assert.ok(s.text && s.text.length <= 40, q.id + ' tracker text: ' + s.text);
      for (const t of [].concat(s.target ?? [])) if (t !== 'any' && s.type !== 'collect') assert.ok(where(t) || ids.has(t), q.id + ' unknown place ' + t);
      if (s.type === 'collect') for (const t of [s.at, ...(s.line || [])].filter(Boolean)) assert.ok(where(t), q.id + ' collect place ' + t);
      if (s.type === 'answer') for (const t of s.target) assert.ok(s.qs[t] && s.qs[t].opts.length === 3 && s.qs[t].right >= 0 && s.qs[t].right < 3, q.id + ' question ' + t);
      if (s.type === 'talk' && Array.isArray(s.target)) for (const t of s.target) assert.ok(s.say[t], q.id + ' says ' + t);
    }
  }
});

test('pacing: the first quest is under 90 s of walking, stars unlock the rest, the finale is reachable', () => {
  const first = QUESTS.find((q) => !q.needs), pts = [first.giver];
  for (const s of first.steps) pts.push(s.at || s.target);
  let m = 0; for (let i = 1; i < pts.length; i++) m += Math.hypot(where(pts[i]).x - where(pts[i - 1]).x, where(pts[i]).z - where(pts[i - 1]).z);
  assert.ok(m / WALK < 90, `first quest ${Math.round(m / WALK)} s`);
  assert.ok(QUESTS.filter((q) => !q.needs).length >= 3, 'three quests to start with');
  // greedy: always take the first open quest; everything must unlock and the finale needs no more stars than the rest give
  let s = newState(), order = [];
  for (let k = 0; k < 20; k++) { const q = QUESTS.find((x) => !s.done.includes(x.id) && offers(s, x.giver).some((o) => o.id === x.id)); if (!q) break; s = play(s, q.id); order.push(q.id); }
  assert.equal(order.length, QUESTS.length, 'all quests reachable: ' + order);
  assert.equal(order.at(-1), 'globe');
  const globe = QUESTS.find((q) => q.id === 'globe'), rest = QUESTS.filter((q) => q !== globe).reduce((a, q) => a + q.reward.stars, 0);
  assert.ok(globe.needs <= rest && globe.needs >= rest * 0.6, 'finale needs most stars: ' + globe.needs + '/' + rest);
  for (const q of QUESTS) { // every quest can be reached from the stars of easier ones
    const before = QUESTS.filter((o) => (o.needs || 0) < (q.needs || 0) || (o !== q && !o.needs && !q.needs)).reduce((a, o) => a + o.reward.stars, 0);
    assert.ok((q.needs || 0) <= before, q.id + ' gated too high');
  }
});

test('start rules: one at a time, not twice, not before its stars', () => {
  let s = newState();
  assert.equal(startQuest(s, 'notes'), s, 'locked');
  assert.equal(startQuest(s, 'nope'), s);
  s = startQuest(s, 'ladle');
  assert.equal(s.cur.id, 'ladle');
  assert.equal(startQuest(s, 'taste'), s, 'busy');
  assert.deepEqual(offers(s, 'nanda'), []);
  s = play(newState(), 'ladle');
  assert.deepEqual(s.done, ['ladle']); assert.equal(s.stars, 1); assert.equal(s.cur, null);
  assert.equal(startQuest(s, 'ladle'), s, 'done quests stay done');
  assert.ok(offers(s, 'nma').length === 0 && offers(s, 'nanda').some((q) => q.id === 'fireflies'));
});

test('events: wrong events change nothing, collect counts, distinct talk, time needs night', () => {
  let s = startQuest(newState(), 'fireflies');
  assert.equal(progress(s, { t: 'talked', id: 'nanda' }).advanced, false);
  assert.equal(progress(s, { t: 'collected', id: 'ladle' }).advanced, false);
  for (let i = 0; i < 4; i++) { const r = progress(s, { t: 'collected', id: 'firefly' }); s = r.state; assert.equal(r.stepDone, false); }
  assert.equal(currentObjective(s).n, 4);
  let r = progress(s, { t: 'collected', id: 'firefly' });
  assert.ok(r.stepDone && r.state.cur.step === 1 && r.completed === null);
  r = progress(r.state, { t: 'talked', id: 'nanda' });
  assert.equal(r.completed, 'fireflies'); assert.equal(r.state.stars, 1);
  // taste: each counter once
  s = startQuest(r.state, 'taste');
  s = progress(s, { t: 'talked', id: 'bighob' }).state;
  assert.equal(progress(s, { t: 'talked', id: 'bighob' }).advanced, false, 'same counter twice');
  assert.equal(progress(s, { t: 'talked', id: 'nma' }).advanced, false, 'not a counter');
  // arena: only at night, only inside, seconds add up
  s = play(play(play(newState(), 'ladle'), 'fireflies'), 'taste');
  s = play(play(s, 'lanterns'), 'springs'); s = play(s, 'hatchery'); s = play(s, 'flight');
  s = startQuest(s, 'arena'); s = progress(s, { t: 'arrived', id: 'arena' }).state;
  assert.equal(progress(s, { t: 'stayed', id: 'arena', secs: 5, night: false }).advanced, false);
  assert.equal(progress(s, { t: 'stayed', id: 'springs', secs: 5, night: true }).advanced, false);
  s = progress(s, { t: 'stayed', id: 'arena', secs: 5, night: true }).state;
  assert.equal(currentObjective(s).n, 5);
  assert.equal(progress(s, { t: 'stayed', id: 'arena', secs: 3, night: true }).stepDone, true);
});

test('inspection: the Colonel himself does not count as one of the five', () => {
  let s = play(play(play(newState(), 'ladle'), 'fireflies'), 'taste');
  s = startQuest(s, 'inspection'); s = progress(s, { t: 'petted', n: 1 }).state;
  assert.equal(progress(s, { t: 'talked', id: 'colonel' }).advanced, false);
  for (const id of ['nma', 'tom', 'fenn', 'sela']) s = progress(s, { t: 'talked', id }).state;
  assert.equal(currentObjective(s).n, 4);
  s = progress(s, { t: 'talked', id: 'mungma' }).state;
  assert.equal(currentObjective(s).step.target, 'colonel');
});

test('compass: points at the nearest unfinished target, nothing when idle', () => {
  const from = pos.village;
  assert.equal(compassTarget(newState(), where, from), null);
  let s = startQuest(newState(), 'ladle');
  const t = compassTarget(s, where, from);
  assert.deepEqual([t.x, t.z], [pos.feastStreet.x, pos.feastStreet.z]);
  s = play(play(play(newState(), 'ladle'), 'fireflies'), 'taste'); s = startQuest(s, 'notes');
  const a = compassTarget(s, where, pos.springs), b = compassTarget(s, where, pos.grove);
  assert.deepEqual([a.x, a.z], [pos.springs.x, pos.springs.z]); assert.deepEqual([b.x, b.z], [pos.grove.x, pos.grove.z]);
  s = progress(s, { t: 'answered', id: 'springs' }).state;
  assert.notDeepEqual([compassTarget(s, where, pos.springs).x], [pos.springs.x], 'done places drop out');
});

test('saving: round trip, junk is dropped, stars are derived', () => {
  const mem = { d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = v; } };
  let s = startQuest(play(newState(), 'ladle'), 'fireflies');
  s = progress(s, { t: 'collected', id: 'firefly' }).state;
  save(s, mem);
  assert.deepEqual(load(mem), s);
  assert.deepEqual(load({ getItem() { throw new Error('blocked'); } }), newState());
  assert.deepEqual(load({ getItem: () => '{not json' }), newState());
  const bad = sanitizeState({ done: ['ladle', 'ladle', 'ghost', 5], stars: 900, cur: { id: 'notes', step: 9, n: 'x' } });
  assert.deepEqual(bad, { done: ['ladle'], stars: 1, cur: null });
  assert.equal(sanitizeState({ cur: { id: 'taste', step: 1, n: -4, seen: ['a b', 'ok', 7] } }).cur.n, 0);
  assert.deepEqual(sanitizeState({ cur: { id: 'taste', step: 0, n: 1, seen: ['a b', 'ok', 7] } }).cur.seen, ['ok']);
  assert.deepEqual(sanitizeState(null), newState()); assert.deepEqual(sanitizeState([1]), newState());
  assert.match(KEY, /^isle\./);
});

test('collectables: the right number, seeded, dry, near the place', () => {
  for (const q of QUESTS) for (const s of q.steps.filter((x) => x.type === 'collect')) {
    const a = itemSpots(s, where, heightAt, isWet, 3), b = itemSpots(s, where, heightAt, isWet, 3);
    assert.equal(a.length, needOf(s)); assert.deepEqual(a, b);
    for (const p of a) { assert.ok(!isWet(p.x, p.z) && heightAt(p.x, p.z) > 0.4, q.id + ' wet item'); const c = where(s.at || s.line[0]); assert.ok(Math.hypot(p.x - c.x, p.z - c.z) < 200); }
  }
});

test('dusk and night windows, finale card', () => {
  assert.ok(isDusk(18) && isDusk(2) && !isDusk(12) && !isDusk(8));
  assert.ok(isNight(23) && isNight(3) && !isNight(18));
  assert.equal(CARD.word, 'LUMEN'); assert.equal(CARD.handle, '@101auntojje');
});
