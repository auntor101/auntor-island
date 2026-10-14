import test from 'node:test';
import assert from 'node:assert/strict';
import { moodFor, daylight, intensity, makeRng, nextDegree, degreeToMidi, midiToHz, nextGap, MOOD, MOODS } from '../src/audio/music.js';
import { createVoiceLimiter, createRateLimiter, spatial } from '../src/audio/limits.js';
import { SFX, SFX_NAMES } from '../src/audio/sfx.js';

test('mood boundaries from hours', () => {
  const m = (h) => moodFor(h, false);
  assert.equal(m(0), 'night'); assert.equal(m(4.4), 'night');
  assert.equal(m(4.5), 'sunrise'); assert.equal(m(7.9), 'sunrise');
  assert.equal(m(8), 'day'); assert.equal(m(16.9), 'day');
  assert.equal(m(17), 'sunset'); assert.equal(m(20.4), 'sunset');
  assert.equal(m(20.5), 'night'); assert.equal(m(23.9), 'night');
  assert.equal(m(24 + 12), 'day'); assert.equal(m(-1), 'night');
  for (const h of [0, 6, 12, 18, 23]) assert.equal(moodFor(h, true), 'snow');
  assert.ok(MOODS.every((k) => MOOD[k]));
});
test('daylight and speed intensity are clamped', () => {
  assert.equal(daylight(0), 0); assert.equal(daylight(12), 1); assert.equal(daylight(22), 0);
  assert.ok(daylight(6) > 0 && daylight(6) < 1);
  assert.equal(intensity(0), 0); assert.equal(intensity(100), 1); assert.equal(intensity(undefined), 0);
  assert.ok(intensity(6) > intensity(3));
});
test('seeded note generation is deterministic and in range', () => {
  const run = (seed) => { const r = makeRng(seed); let d = 4; const out = []; for (let i = 0; i < 500; i++) { d = nextDegree(r, d, 5); out.push(d); } return out; };
  assert.deepEqual(run(7), run(7));
  assert.notDeepEqual(run(7), run(8));
  const a = run(1);
  assert.ok(a.every((d) => d >= 0 && d < 10));
  assert.ok(a.every((d, i) => i === 0 || Math.abs(d - a[i - 1]) <= 2), 'steps stay small');
  assert.ok(new Set(a).size >= 6, 'wanders over the scale');
  for (const k of MOODS) {
    const P = MOOD[k], r = makeRng(3);
    for (let i = 0; i < 50; i++) { const f = midiToHz(degreeToMidi(P.scale, P.root, i % 10)); assert.ok(f > 200 && f < 3000); const g = nextGap(r, k, 0); assert.ok(g > 0.1 && g < 15); }
  }
  assert.equal(midiToHz(69), 440);
  assert.ok(nextGap(makeRng(1), 'day', 1) < nextGap(makeRng(1), 'day', 0));
});
test('voice limiter caps and frees voices', () => {
  const v = createVoiceLimiter(3);
  assert.ok(v.tryAcquire(0, 1) && v.tryAcquire(0, 1) && v.tryAcquire(0.5, 1));
  assert.equal(v.tryAcquire(0.9, 1), false);
  assert.equal(v.tryAcquire(1.1, 1), true); // two earlier voices ended
  assert.equal(v.count, 2);
});
test('rate limiter is per name', () => {
  const r = createRateLimiter();
  assert.ok(r.allow('a', 0, 0.1)); assert.equal(r.allow('a', 0.05, 0.1), false);
  assert.ok(r.allow('b', 0.05, 0.1)); assert.ok(r.allow('a', 0.11, 0.1));
});
test('spatial gain and pan', () => {
  assert.equal(spatial(0, 0, 0, 0, 0).gain, 1);
  assert.equal(spatial(0, 0, 0, 100, 0).gain, 0);
  assert.ok(spatial(0, 0, 0, 10, 0).gain > spatial(0, 0, 0, 30, 0).gain);
  const l = spatial(0, 0, 0, -20, 0).pan, r = spatial(0, 0, 0, 20, 0).pan;
  assert.ok(l * r < 0 && Math.abs(l + r) < 1e-9);
  assert.ok(Math.abs(spatial(0, 0, 0, 0, 20).pan) < 1e-9, 'straight ahead is centred');
  assert.ok(Math.abs(spatial(0, 0, Math.PI / 2, 20, 0).pan) < 1e-9, 'turning the head moves the pan');
});
const REQUIRED = `footstep-grass footstep-dirt footstep-sand footstep-stone footstep-wood footstep-snow footstep-water jump land splash ui-tap ui-open ui-close select confirm note-pop star fanfare meow purr bark whine pant pet dragon-chirp dragon-flap dragon-whoosh fire-breath crash death respawn eat bonk door lantern`.split(' ');
test('every required sfx exists, is short, and runs against a stub synth', () => {
  for (const n of REQUIRED) assert.ok(SFX[n], 'missing ' + n);
  assert.equal(SFX_NAMES.length, REQUIRED.length);
  const calls = [];
  const h = { p: 1, r: Math.random };
  for (const k of ['tone', 'noise', 'vox', 'pulse']) h[k] = (...a) => { calls.push(a); return {}; };
  for (const n of REQUIRED) {
    const [gap, dur, fn] = SFX[n];
    assert.ok(gap > 0 && dur > 0 && dur <= 1.5, n);
    calls.length = 0; fn(h);
    assert.ok(calls.length > 0, n + ' makes sound');
    for (const a of calls) assert.ok(a.every((x) => x !== undefined && !Number.isNaN(x)), n + ' args');
  }
});
