import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepPlayer } from '../src/play/player.js';

const flat = () => 2;
const start = (o = {}) => ({ x: 0, z: 0, y: 2, heading: 0, speed: 0, ...o });
const run = (s, input, secs, dt, h = flat) => { for (let t = 0; t < secs - 1e-9; t += dt) s = stepPlayer(s, { cameraYaw: 0, run: false, x: 0, y: 0, ...input }, dt, h); return s; };

test('forward 1 s reaches about walk speed and moves along the heading', () => {
  const s = run(start(), { y: 1 }, 1, 1 / 60);
  assert.ok(Math.abs(s.speed - 2.2) < 0.15, `speed ${s.speed}`);
  assert.ok(s.z < -1.5 && Math.abs(s.x) < 0.01, `pos ${s.x},${s.z}`);
});

test('run rises toward 5.5', () => {
  const s = run(start(), { y: 1, run: true }, 2, 1 / 60);
  assert.ok(s.speed > 5.2 && s.speed <= 5.5 + 1e-6, `speed ${s.speed}`);
});

test('zero input stops in under 1 s', () => {
  let s = run(start(), { y: 1, run: true }, 2, 1 / 60);
  s = run(s, {}, 1, 1 / 60);
  assert.ok(s.speed < 0.05, `speed ${s.speed}`);
});

test('a steep wall blocks', () => {
  const wall = (x) => (x > 5 ? 10 : 2);
  const s = run(start({ x: 3, heading: -Math.PI / 2 }), { y: 1, run: true, cameraYaw: -Math.PI / 2 }, 4, 1 / 60, wall);
  assert.ok(s.x < 5 && s.x > 4, `x ${s.x}`);
  assert.ok(run(s, { y: 1, run: true, cameraYaw: -Math.PI / 2 }, 2, 1 / 20, wall).x < 5);
});

test('standing on a steep slope slides downhill', () => {
  const s = run(start({ x: 0, y: 20 }), {}, 1, 1 / 60, (x) => 20 - 2 * x); // slope 2, high at -x
  assert.ok(s.x > 0.5, `x ${s.x}`);
});

test('sea blocks', () => {
  const s = run(start(), { y: 1 }, 2, 1 / 60, () => -3);
  assert.equal(s.x, 0); assert.equal(s.z, 0);
});

test('frame-rate independent within 5%', () => {
  const a = run(start(), { y: 1, run: true }, 2, 1 / 60), b = run(start(), { y: 1, run: true }, 2, 1 / 20);
  assert.ok(Math.abs(a.z - b.z) / Math.abs(a.z) < 0.05, `${a.z} vs ${b.z}`);
});

test('diagonal is not faster than straight', () => {
  const a = run(start(), { y: 1 }, 1, 1 / 60), d = run(start(), { x: 1, y: 1 }, 1, 1 / 60);
  assert.ok(Math.hypot(d.x, d.z) <= Math.hypot(a.x, a.z) + 0.05);
});
