import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepFlight, CRUISE, BOOST, MAX_STAMINA } from '../src/play/flight.js';

const flat = () => 2;
const start = (o = {}) => ({ x: 0, z: 0, y: 40, heading: 0, speed: CRUISE, bank: 0, stamina: MAX_STAMINA, status: 'flying', ...o });
const run = (s, input, secs, h = flat) => { for (let t = 0; t < secs - 1e-9; t += 1 / 60) s = stepFlight(s, { x: 0, y: 0, boost: false, ...input }, 1 / 60, h); return s; };

test('cruise moves along the heading (0 faces -z)', () => {
  const s = run(start(), {}, 1);
  assert.ok(s.z < -CRUISE * 0.9 && Math.abs(s.x) < 0.01, `pos ${s.x},${s.z}`);
});

test('stick right turns clockwise and banks', () => {
  const s = run(start(), { x: 1 }, 1);
  assert.ok(s.heading < 0 && s.bank > 0.2, `h ${s.heading} bank ${s.bank}`);
});

test('boost is faster but drains stamina, and stops at empty', () => {
  const s = run(start(), { boost: true }, 1);
  assert.ok(s.speed > CRUISE + 3 && s.stamina < MAX_STAMINA);
  const e = run(start({ stamina: 0.05 }), { boost: true }, 2);
  assert.ok(e.stamina === 0 && e.speed <= CRUISE + 1, `speed ${e.speed}`);
  assert.ok(BOOST > CRUISE);
});

test('stamina refills at cruise', () => {
  const s = run(start({ stamina: 0 }), {}, 2);
  assert.ok(s.stamina > 0.5);
});

test('slow descent onto flat ground lands; fast dive crashes', () => {
  const soft = run(start({ y: 6 }), { y: -0.3 }, 6);
  assert.equal(soft.status, 'landed');
  const hard = run(start({ y: 12 }), { y: -1 }, 4);
  assert.equal(hard.status, 'crashed');
});

test('cannot climb above the ceiling', () => {
  const s = run(start({ y: 118 }), { y: 1 }, 3);
  assert.ok(s.y <= 120);
});

test('flying into deep water or a cliff face crashes', () => {
  const sea = run(start({ y: 3 }), { y: -1 }, 3, () => -3);
  assert.equal(sea.status, 'crashed');
  const wall = run(start({ y: 10 }), {}, 2, (x, z) => (z < -20 ? 60 : 2));
  assert.equal(wall.status, 'crashed');
});

test('finished flights do not move', () => {
  const s = run(start({ status: 'landed' }), { y: 1 }, 1);
  assert.equal(s.z, 0);
});
