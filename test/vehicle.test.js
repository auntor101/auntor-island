import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepVehicle, KINDS, CRASH_SPEED } from '../src/play/vehicle.js';

const flat = () => 2;
const start = (o = {}) => ({ x: 0, z: 0, y: 2, heading: 0, speed: 0, status: 'driving', ...o });
const run = (s, input, secs, h = flat, cols = [], kind = 'cart') => { for (let t = 0; t < secs - 1e-9; t += 1 / 60) s = stepVehicle(s, { x: 0, y: 0, ...input }, 1 / 60, h, cols, kind); return s; };

test('full throttle reaches top speed and moves along the heading', () => {
  for (const k in KINDS) { const s = run(start(), { y: 1 }, 6, flat, [], k); assert.ok(Math.abs(s.speed - KINDS[k].max) < 0.2, `${k} ${s.speed}`); assert.ok(s.z < -10 && Math.abs(s.x) < 0.01); }
});

test('half stick cruises slower', () => assert.ok(run(start(), { y: 0.5 }, 6).speed < KINDS.cart.max * 0.55));

test('steering needs speed and turns the right way', () => {
  assert.equal(run(start(), { x: 1 }, 1).heading, 0);
  assert.ok(run(start({ speed: 6 }), { x: 1, y: 0.6 }, 1).heading < -0.3);
});

test('coasting stops', () => assert.equal(run(start({ speed: 6 }), {}, 5).speed, 0));

test('hard hit on a wall crashes (cart), a gentle one only stops', () => {
  const wall = [{ kind: 'box', x: 0, z: -30, hw: 5, hd: 1, rot: 0 }];
  const hard = run(start({ speed: 8 }), { y: 1 }, 5, flat, wall);
  assert.equal(hard.status, 'crashed'); assert.equal(hard.cause, 'cart');
  const soft = run(start({ z: -25, speed: CRUISE_SOFT() }), {}, 5, flat, wall);
  assert.equal(soft.status, 'driving'); assert.equal(soft.speed, 0);
});
const CRUISE_SOFT = () => CRASH_SPEED - 2;

test('driving into the sea or up a cliff at speed crashes with that cause', () => {
  assert.equal(run(start({ speed: 8 }), { y: 1 }, 3, (x, z) => (z < -10 ? -3 : 2)).cause, 'sea');
  assert.equal(run(start({ speed: 8 }), { y: 1 }, 3, (x, z) => (z < -10 ? 40 : 2)).cause, 'cliff');
});

test('finished drives do not move', () => assert.equal(run(start({ status: 'crashed' }), { y: 1 }, 1).z, 0));
