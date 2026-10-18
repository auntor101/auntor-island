import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heightAt, zoneAt, isWet } from '../src/world/island.js';
import { planVillage } from '../src/world/village/layout.js';
import { planSites, ringsPassed, RING_R, LANDMARK_INFO } from '../src/world/landmarks/sites.js';

const env = { heightAt, isWet, zoneAt }, V = planVillage(env), P = planSites(env, V.keepOut, V.center);

test('deterministic', () => {
  const j = (p) => JSON.stringify([p.sites, p.rings, p.info]);
  assert.equal(j(planSites(env, (x, z, r) => V.keepOut(x, z, r), V.center)), j(P));
});

test('eight sites: dry, clear of the village and of each other', () => {
  assert.equal(P.sites.length, 8);
  for (const s of P.sites) {
    assert.ok(!isWet(s.x, s.z) && heightAt(s.x, s.z) > 0.8, s.id + ' dry');
    assert.ok(!V.keepOut(s.x, s.z, s.r * 0.7 - 2), s.id + ' clear of the village');
    for (const o of P.sites) if (o !== s) assert.ok(Math.hypot(o.x - s.x, o.z - s.z) >= o.r + s.r, s.id + ' vs ' + o.id);
  }
});

test('info names every place with a position and a blurb', () => {
  assert.equal(P.info.length, LANDMARK_INFO.length);
  for (const i of P.info) { assert.ok(i.name && i.blurb.endsWith('.') && Number.isFinite(i.x + i.z), i.id); }
  assert.equal(new Set(P.info.map((i) => i.id)).size, 9);
});

test('colliders: village-shaped, every site has some, trail entries stay free', () => {
  for (const c of P.colliders) assert.ok(c.kind === 'circle' ? c.r > 0 : c.hw > 0 && c.hd > 0 && Number.isFinite(c.rot));
  for (const s of P.sites) {
    assert.ok(s.colliders.length >= 1, s.id);
    const free = (x, z) => P.colliders.every((c) => c.kind === 'circle' ? Math.hypot(x - c.x, z - c.z) > c.r + 0.4 : (() => { const co = Math.cos(c.rot), si = Math.sin(c.rot), ax = x - c.x, az = z - c.z, lx = ax * co - az * si, lz = ax * si + az * co; return Math.abs(lx) > c.hw + 0.4 || Math.abs(lz) > c.hd + 0.4; })());
    assert.ok(free(s.ex, s.ez), s.id + ' entry is free');
  }
});

test('keepOut covers the footprint, not the open meadow', () => {
  const s = P.byId.tower;
  assert.ok(P.keepOut(s.x + 3, s.z));
  assert.ok(!P.keepOut(s.x + s.r + 20, s.z + 30));
});

test('race rings: 8, above ground, ringsPassed counts a clean fly-through once', () => {
  assert.equal(P.rings.length, 8);
  P.rings.forEach((q) => assert.ok(q.y > heightAt(q.x, q.z) + 3 && Math.abs(Math.hypot(q.nx, q.nz) - 1) < 1e-9));
  const q = P.rings[2], at = (t, off = 0) => ({ x: q.x + q.nx * t - q.nz * off, y: q.y, z: q.z + q.nz * t + q.nx * off });
  assert.deepEqual(ringsPassed(at(-2), at(2), P.rings), [2]);
  assert.deepEqual(ringsPassed(at(2), at(-2), P.rings), [2]); // either direction
  assert.deepEqual(ringsPassed(at(-2, RING_R + 1), at(2, RING_R + 1), P.rings), []); // flew past the side
  assert.deepEqual(ringsPassed(at(-2), at(-1), P.rings), []); // never reached the plane
});

test('trails reach every landmark: its signpost place is near the entry and the ?at= spot is free', async () => {
  const { buildPaths } = await import('../src/world/paths/network.js');
  const N = buildPaths(V);
  const free = (x, z) => P.colliders.every((c) => c.kind === 'circle' ? Math.hypot(x - c.x, z - c.z) > c.r + 0.4 : (() => { const co = Math.cos(c.rot), si = Math.sin(c.rot), ax = x - c.x, az = z - c.z, lx = ax * co - az * si, lz = ax * si + az * co; return Math.abs(lx) > c.hw + 0.4 || Math.abs(lz) > c.hd + 0.4; })());
  for (const s of P.sites) {
    const q = N.poi[s.id];
    assert.ok(q, s.id + ' has a place');
    assert.ok(Math.hypot(q.x - s.ex, q.z - s.ez) < 9, s.id + ' place near its entry');
    assert.ok(free(q.x, q.z) && free(q.x + 3, q.z + 3), s.id + ' place and ?at= spot are free');
  }
  assert.ok(N.poi.rings);
});
