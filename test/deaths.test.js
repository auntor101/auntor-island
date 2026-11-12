import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, record, total, KEY, CAUSES } from '../src/game/deaths.js';

const mem = (init) => { const m = new Map(init ? [[KEY, init]] : []); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

test('record counts per cause and persists', () => {
  const s = mem();
  record(s, 'sea'); record(s, 'sea'); const log = record(s, 'cliff');
  assert.deepEqual(log, { sea: 2, cliff: 1 });
  assert.deepEqual(load(s), log);
  assert.equal(total(log), 3);
});

test('unknown cause becomes ground', () => assert.deepEqual(record(mem(), '<b>x</b>'), { ground: 1 }));

test('corrupt or hostile storage is ignored', () => {
  assert.deepEqual(load(mem('{nope')), {});
  assert.deepEqual(load(mem('{"sea":-4,"cliff":"9","fire":1.5,"evil":3,"cart":2}')), { cart: 2 });
  assert.deepEqual(load({ getItem() { throw new Error('blocked'); } }), {});
  assert.doesNotThrow(() => record({ getItem: () => null, setItem() { throw new Error('full'); } }, 'fire'));
});

test('every cause has a line of text', () => { for (const k in CAUSES) assert.ok(CAUSES[k].length > 10); });
