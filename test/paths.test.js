import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heightAt, zoneAt, isWet } from '../src/world/island.js';
import { planVillage } from '../src/world/village/layout.js';
import { buildPaths, EDGES, MAX_SLOPE } from '../src/world/paths/network.js';

const L = planVillage({ heightAt, isWet, zoneAt });
const P = buildPaths(L);
const sig = (n) => JSON.stringify([n.pois.map((p) => [p.id, p.x, p.z]), n.pieces.map((p) => p.pts), n.bridges.map((b) => [b.x, b.z, b.y])]);

test('every place is reached by its planned route', () => {
  assert.equal(P.pois.length, 14);
  assert.deepEqual(P.edges.filter((e) => !e.ok), []);
  // the graph is one connected component
  const seen = new Set(['village']);
  for (let k = 0; k < EDGES.length; k++) for (const [a, b] of EDGES) { if (seen.has(a)) seen.add(b); if (seen.has(b)) seen.add(a); }
  assert.equal(seen.size, P.pois.length);
});

test('places sit on dry, gentle ground', () => {
  for (const p of P.pois) { assert.ok(!isWet(p.x, p.z), p.id + ' dry'); assert.ok(heightAt(p.x, p.z) > 0.3, p.id + ' above the sea'); }
});

test('no trail cell is wet except under a bridge, and every bridge is short', () => {
  for (const p of P.pieces) p.pts.forEach(([x, z], k) => { if (isWet(x, z)) assert.ok(p.br[k], `${p.edge} sample ${k} wet at ${x.toFixed(1)},${z.toFixed(1)}`); });
  for (const b of P.bridges) assert.ok(b.len > 2 && b.len < 16, 'bridge length ' + b.len);
  for (const e of P.edges) for (const n of e.cells) { const x = -168 + ((n % 112) + 0.5) * 3, z = -168 + (((n / 112) | 0) + 0.5) * 3; if (isWet(x, z)) assert.ok(P.bridges.some((b) => Math.hypot(b.x - x, b.z - z) < b.len / 2 + 4), 'wet route cell without a bridge'); }
  assert.ok(P.bridges.length >= 1);
});

test('slope along every trail stays walkable', () => {
  for (const p of P.pieces) for (let k = 0; k + 2 < p.pts.length; k++) { // 3 m windows
    if (p.br[k] || p.br[k + 2]) continue;
    const [ax, az] = p.pts[k], [bx, bz] = p.pts[k + 2], d = Math.hypot(bx - ax, bz - az) || 1;
    assert.ok(Math.abs(heightAt(bx, bz) - heightAt(ax, az)) / d <= MAX_SLOPE + 0.25, `${p.edge} slope at ${ax.toFixed(0)},${az.toFixed(0)}`);
  }
});

test('deterministic', () => assert.equal(sig(buildPaths(L)), sig(P)));

test('total length is sane and the build is fast enough to run lazily', () => {
  assert.ok(P.stats.length > 500 && P.stats.length < 2500, 'length ' + P.stats.length);
  for (const e of P.edges) { const a = P.poi[e.from], b = P.poi[e.to], straight = Math.hypot(a.x - b.x, a.z - b.z); assert.ok(e.cells.length * 3 < straight * 2.2 + 30, `${e.from}-${e.to} detour`); }
  assert.ok(P.stats.buildMs < 1500, 'build ms ' + P.stats.buildMs);
});

test('queries: trail cells keep flora out, bridge deck height, open ground does not', () => {
  const p = P.pieces.find((q) => q.pts.length > 10), [x, z] = p.pts[Math.floor(p.pts.length / 2)];
  assert.ok(P.onTrail(x, z) || p.br.some(Boolean));
  assert.equal(P.onTrail(0, 150), false);
  const b = P.bridges[0];
  assert.equal(P.groundAt(b.x, b.z), b.y);
  assert.equal(P.groundAt(b.x + 40, b.z + 40), null);
});
