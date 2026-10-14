import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heightAt, zoneAt, isWet, LANDMARKS } from '../src/world/island.js';
import { planVillage, VENUES, rectGap, footSlope, toWorld, MAX_SLOPE } from '../src/world/village/layout.js';

const env = { heightAt, isWet, zoneAt };
const L = planVillage(env);

test('deterministic', () => {
  const strip = ({ keepOut, ...r }) => JSON.stringify(r);
  assert.equal(strip(planVillage(env)), strip(L));
});

test('counts and every venue present', () => {
  const homes = L.buildings.filter((b) => b.type === 'longhouse');
  assert.ok(homes.length >= 10 && homes.length <= 14, `longhouses ${homes.length}`);
  for (const t of ['hall', 'forge', 'theatre', 'stables']) assert.equal(L.buildings.filter((b) => b.type === t).length, 1, t);
  const venues = L.buildings.filter((b) => b.type === 'shop').map((b) => b.venue).sort();
  assert.deepEqual(venues, [...VENUES].sort());
  for (const v of VENUES) assert.ok(L.anchors[v], 'anchor ' + v);
  for (const a of ['greatHall', 'forge', 'market', 'theatre', 'stables', 'harbourDock', 'spawnCart']) assert.ok(L.anchors[a], a);
  assert.equal(L.ships.length, 2);
});

test('footprints: flat, dry within 3 m, apart', () => {
  for (const f of L.buildings) {
    assert.ok(footSlope(f, heightAt) < MAX_SLOPE, `${f.type} slope`);
    for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6; j++) assert.ok(!isWet(...toWorld(f, (i / 6 - 0.5) * (f.w + 6), (j / 6 - 0.5) * (f.d + 6))), `${f.type} wet`);
  }
  for (let i = 0; i < L.buildings.length; i++) for (let j = i + 1; j < L.buildings.length; j++) {
    const a = L.buildings[i], b = L.buildings[j], need = a.type === 'shop' && b.type === 'shop' ? 0.5 : 2.5;
    assert.ok(rectGap(a, b) >= need, `${a.type}/${b.type} gap ${rectGap(a, b)}`);
  }
});

test('anchors on land, roads out of water, ships in water', () => {
  for (const [k, p] of Object.entries(L.anchors)) assert.ok(heightAt(...p) > 0.5, 'anchor ' + k);
  for (const r of L.roads) for (const p of r.pts) assert.ok(!isWet(...p), 'road ' + r.name);
  for (const s of L.ships) assert.ok(isWet(s.x, s.z));
  assert.ok(Array.isArray(L.bridgeSpots));
});

test('keepOut covers buildings and not far wilderness', () => {
  for (const f of L.buildings) assert.ok(L.keepOut(f.x, f.z, 0));
  assert.ok(!L.keepOut(-100, 40, 0));
  assert.ok(L.keepOut(L.center[0], L.center[1], 0));
  assert.ok(LANDMARKS.village);
});
