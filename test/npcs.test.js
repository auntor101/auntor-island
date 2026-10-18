import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heightAt, zoneAt, isWet } from '../src/world/island.js';
import { planVillage, VENUES } from '../src/world/village/layout.js';
import { clear } from '../src/game/companion-ui.js';
import { DEFS } from '../src/world/npcs/defs.js';
import { planNpcs } from '../src/world/npcs/place.js';

const L = planVillage({ heightAt, isWet, zoneAt });
const village = { layout: L, colliders: L.colliders, anchors: Object.fromEntries(Object.entries(L.anchors).map(([k, v]) => [k, { x: v[0], z: v[1] }])) };
const plan = planNpcs(DEFS, village, heightAt, isWet);

test('every npc is placed on dry land, clear of buildings and of each other', () => {
  assert.equal(plan.length, DEFS.length);
  for (const p of plan) {
    assert.ok(!isWet(p.x, p.z), p.def.id + ' wet');
    assert.ok(village.colliders.every((c) => clear(c, p.x, p.z, 0.45)), p.def.id + ' inside a collider');
    assert.ok(Number.isFinite(p.yaw));
  }
  for (let i = 0; i < plan.length; i++) for (let j = i + 1; j < plan.length; j++) assert.ok(Math.hypot(plan[i].x - plan[j].x, plan[i].z - plan[j].z) > 1.2, plan[i].def.id + '/' + plan[j].def.id);
});
test('ids unique, bases known, shopkeepers stand at their shop', () => {
  assert.equal(new Set(DEFS.map((d) => d.id)).size, DEFS.length);
  assert.ok(DEFS.every((d) => ['man', 'woman', 'elf'].includes(d.base)));
  for (const p of plan.filter((q) => q.def.spot.at === 'venue')) {
    assert.ok(VENUES.includes(p.def.spot.v));
    const a = village.anchors[p.def.spot.v];
    assert.ok(Math.hypot(a.x - p.x, a.z - p.z) < 3.5, p.def.id + ' far from its counter');
  }
});
