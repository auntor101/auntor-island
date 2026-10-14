import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunkKey, chunkOf, chunksAround, lodFor, CHUNK, VIEW_RADIUS } from '../src/world/chunks.js';
import { buildChunkMesh } from '../src/world/terrain.js';

test('chunkOf uses 32 m cells', () => {
  assert.deepEqual(chunkOf(0, 0), { cx: 0, cz: 0 });
  assert.deepEqual(chunkOf(-0.1, 31.9), { cx: -1, cz: 0 });
  assert.equal(CHUNK, 32);
  assert.equal(chunkKey(-1, 2), '-1,2');
});
test('chunksAround is nearest first, unique, includes origin', () => {
  const list = chunksAround(0, 0, 100);
  assert.ok(list.some((c) => c.cx === 0 && c.cz === 0));
  assert.equal(new Set(list.map((c) => chunkKey(c.cx, c.cz))).size, list.length);
  const d = (c) => Math.hypot((c.cx + 0.5) * CHUNK, (c.cz + 0.5) * CHUNK);
  for (let i = 1; i < list.length; i++) assert.ok(d(list[i - 1]) <= d(list[i]));
});
test('lodFor bands', () => {
  assert.equal(lodFor(10), 0);
  assert.equal(lodFor(100), 1);
  assert.equal(lodFor(300), 2);
});
test('chunk count within the view radius stays below 220', () => {
  assert.ok(chunksAround(0, 0, VIEW_RADIUS).length < 220);
});
test('chunk mesh: 33x33 grid plus skirts, finite data; deep sea chunk is skipped', () => {
  const m = buildChunkMesh(0, 0, 0);
  assert.equal(m.geometry.attributes.position.count, 33 * 33 + 4 * 33);
  for (const a of ['position', 'normal', 'wa', 'wb', 'aux']) assert.ok(m.geometry.attributes[a].array.every(Number.isFinite));
  assert.equal(buildChunkMesh(20, 20, 2), null);
});
