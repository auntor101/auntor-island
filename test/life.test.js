import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATS, DOGS, DRAGONS, capBright, makeAnimal, stepAnimal, petAnimal, makeCompanion, stepCompanion, companionTarget, NOTICE_DIST, MEET_DIST, COMP } from '../src/life/animal.js';
import { createLife } from '../src/life/index.js';

const lcg = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const chan = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const yes = () => true;

test('breeds: 10 cats, 7 dogs, 4 dragon colourways, unique names, hex colours', () => {
  assert.equal(CATS.length, 10); assert.equal(DOGS.length, 7); assert.equal(DRAGONS.length, 4);
  for (const l of [CATS, DOGS, DRAGONS]) assert.equal(new Set(l.map((b) => b.name)).size, l.length);
  for (const b of [...CATS, ...DOGS]) assert.ok(/^#[0-9a-f]{6}$/i.test(b.body) && /^#[0-9a-f]{6}$/i.test(b.accent) && b.scale > 0.7 && b.scale < 1.4, b.name);
});

test('capBright caps the brightest channel at 0.85 and keeps hue', () => {
  assert.equal(capBright('#34303a'), '#34303a');
  assert.equal(capBright('#ffffff'), '#d9d9d9');
  for (const b of [...CATS, ...DOGS, ...DRAGONS]) for (const k of ['body', 'accent', 'belly', 'wing']) if (b[k]) assert.ok(Math.max(...chan(capBright(b[k]))) <= 0.85 + 1 / 255);
});

test('a free animal wanders inside its area and walks', () => {
  const rand = lcg(7), ok = (x, z) => Math.hypot(x, z) < 10, a = makeAnimal('cat', 0, 0, rand);
  let moved = 0, walked = false;
  for (let i = 0; i < 4000; i++) { const px = a.x, pz = a.z; stepAnimal(a, 0.05, rand, ok, { px: 500, pz: 500, night: false }); moved += Math.hypot(a.x - px, a.z - pz); walked ||= a.mode === 'walk'; assert.ok(Math.hypot(a.x, a.z) < 10); }
  assert.ok(walked && moved > 5);
});

test('an animal with nowhere to go stays put', () => {
  const a = makeAnimal('dog', 3, 3, lcg(3));
  for (let i = 0; i < 1000; i++) stepAnimal(a, 0.05, lcg(i + 1), () => false, { px: 500, pz: 500, night: false });
  assert.deepEqual([a.x, a.z, a.mode], [3, 3, 'idle']);
});

test('notice, approach to about 1.2 m, then meow (cat) or bark (dog)', () => {
  for (const [kind, ev] of [['cat', 'meow'], ['dog', 'bark']]) {
    const evs = [], a = makeAnimal(kind, 0, 0, lcg(1)), ctx = { px: 8, pz: 0, night: false };
    a.timer = 99;
    let min = 99, met = false;
    for (let i = 0; i < 1200 && !met; i++) {
      stepAnimal(a, 0.05, () => 0.1, yes, ctx); // rand 0.1: always interested
      if (a.ev) evs.push(a.ev);
      if (a.mode === 'notice') assert.ok(Math.abs(a.look) <= Math.PI, 'head turns');
      min = Math.min(min, Math.hypot(8 - a.x, a.z)); met = a.mode === 'greet';
    }
    assert.deepEqual(evs.slice(0, 2), ['notice', ev]);
    assert.ok(min <= MEET_DIST + 0.15 && min > 0.5, `closest ${min}`);
  }
});

test('beyond notice range nothing happens; walking away cancels the approach', () => {
  const a = makeAnimal('cat', 0, 0, lcg(2)); a.timer = 99;
  stepAnimal(a, 0.05, () => 0.1, yes, { px: NOTICE_DIST + 2, pz: 0, night: false });
  assert.equal(a.mode, 'idle');
  a.mode = 'approach';
  stepAnimal(a, 0.05, () => 0.1, yes, { px: 100, pz: 0, night: false });
  assert.equal(a.mode, 'idle');
});

test('petting makes a cat purr and follow for a while, then stop', () => {
  const a = makeAnimal('cat', 0, 0, lcg(4)), ctx = { px: 6, pz: 0, night: false };
  assert.equal(petAnimal(a), 'purr'); assert.equal(petAnimal({ kind: 'dog', mode: 'idle' }), 'bark');
  assert.equal(a.mode, 'follow');
  for (let i = 0; i < 80; i++) stepAnimal(a, 0.05, lcg(1), yes, ctx);
  assert.ok(Math.hypot(6 - a.x, a.z) < 2.2, 'came to the player');
  for (let i = 0; i < 400; i++) stepAnimal(a, 0.05, lcg(1), yes, ctx);
  assert.notEqual(a.mode, 'follow');
});

test('sleep at night (no moving), wake at dawn', () => {
  const a = makeAnimal('dog', 0, 0, lcg(5)), r = lcg(9);
  a.mode = 'walk'; a.tx = 5; a.tz = 0;
  stepAnimal(a, 0.05, r, yes, { px: 1, pz: 0, night: true });
  assert.equal(a.mode, 'sleep');
  const x = a.x;
  for (let i = 0; i < 200; i++) stepAnimal(a, 0.05, r, yes, { px: 1, pz: 0, night: true });
  assert.equal(a.x, x); assert.equal(a.mode, 'sleep');
  assert.equal(petAnimal(a), 'bark'); assert.equal(a.mode, 'sleep');
  stepAnimal(a, 0.05, r, yes, { px: 500, pz: 0, night: false });
  assert.equal(a.mode, 'idle'); assert.equal(a.ev, 'wake');
});

test('the wander speed is bounded', () => {
  const a = makeAnimal('cat', 0, 0, lcg(5)); a.mode = 'walk'; a.tx = 9; a.tz = 0; a.timer = 99; a.cool = 99;
  stepAnimal(a, 1, lcg(5), yes, { px: 500, pz: 0, night: false });
  assert.ok(Math.abs(a.x) > 0.5 && Math.abs(a.x) < 1.2);
});

test('companion keeps 2 to 3 m from a walking player and catches a runner', () => {
  const r = lcg(3), c = makeCompanion(0, 3), p = { x: 0, z: 0, heading: 0, speed: 0 };
  let worst = 0;
  for (let i = 0; i < 600; i++) { // 20 s walking north at 2.2 m/s, then 10 s running at 5.5
    p.speed = i < 400 ? 2.2 : 5.5; p.z -= p.speed / 30;
    stepCompanion(c, 1 / 30, p, yes, r);
    if (i > 100) worst = Math.max(worst, Math.hypot(c.x - p.x, c.z - p.z));
  }
  assert.ok(worst < 5.5, `worst ${worst}`);
  const d = Math.hypot(c.x - p.x, c.z - p.z);
  assert.ok(d > 1.2 && d < 4, `final ${d}`);
});

test('companion stops near you, glances about, sidesteps water, teleports when far', () => {
  const r = lcg(8), c = makeCompanion(2, 2), p = { x: 0, z: 0, heading: 0, speed: 0 };
  let looks = new Set();
  for (let i = 0; i < 600; i++) { stepCompanion(c, 1 / 30, p, yes, r); looks.add(Math.round(c.look * 10)); }
  assert.ok(!c.moving && c.speed < 0.2 && looks.size > 1 && c.idleT > 5);
  const water = (x, z) => !(x > -1 && x < 1 && z > 0.5 && z < 5); // a pond between companion and spot
  const c2 = makeCompanion(0, 8); let wet = 0;
  for (let i = 0; i < 300; i++) { stepCompanion(c2, 1 / 30, p, water, r); if (!water(c2.x, c2.z)) wet++; }
  assert.equal(wet, 0);
  const c3 = makeCompanion(60, 60); stepCompanion(c3, 1 / 30, p, yes, r);
  assert.ok(c3.teleported && Math.hypot(c3.x, c3.z) < COMP.behind + 2);
});

test('companion target avoids wet spots', () => {
  const out = { x: 0, z: 0 }, p = { x: 0, z: 0, heading: 0, speed: 0 };
  companionTarget(p, 1, (x, z) => z < 1.5, out); // behind (z>0) is water beyond 1.5
  assert.ok(out.z <= 1.5);
});

test('createLife fails soft without a model and without a DOM', async () => {
  const life = createLife({ add() {}, remove() {} }, { heightAt: () => 0, isWet: () => false, zoneAt: () => 'meadow', onSfx() {}, isTouch: false });
  assert.equal(life.getCompanion(), 'dragon');
  assert.doesNotThrow(() => life.update(0.016, { x: 0, z: 0, y: 0, heading: 0, speed: 0 }, { position: { x: 0, y: 0, z: 0 } }, { stars: 0 }));
  assert.equal(life.befriended().total, 0);
  await life.ready;
  life.dispose();
});

test('collider test keeps animals out of boxes and circles', async () => {
  const { clear } = await import('../src/game/companion-ui.js');
  const box = { kind: 'box', x: 0, z: 0, hw: 2, hd: 1, rot: 0 }, cir = { kind: 'circle', x: 10, z: 0, r: 1 };
  assert.ok(!clear(box, 1, 0.5, 0.4) && clear(box, 5, 0, 0.4) && !clear(cir, 10.5, 0, 0.4) && clear(cir, 12, 0, 0.4));
});
