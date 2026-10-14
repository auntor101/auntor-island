const assert = require('assert');
const cats = require('../js/cats.js');
const { BREEDS, stepCat, makeState } = cats;

// deterministic random
const lcg = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

assert.strictEqual(BREEDS.length, 10);
assert.strictEqual(new Set(BREEDS.map(b => b.name)).size, 10, 'breed names are unique');
for (const b of BREEDS) {
  assert.ok(/^#[0-9a-f]{6}$/i.test(b.body) && /^#[0-9a-f]{6}$/i.test(b.accent), b.name + ' has hex colours');
  assert.ok(b.scale >= 0.9 && b.scale <= 1.3, b.name + ' has a sane scale');
}

// a free cat eventually walks and moves, but never leaves a 10 unit radius
const rand = lcg(7);
const ok = (x, z) => Math.hypot(x, z) < 10;
const c = makeState(0, 0, rand);
let moved = 0, sawWalk = false;
for (let i = 0; i < 4000; i++) {
  const px = c.x, pz = c.z;
  stepCat(c, 0.05, rand, ok);
  moved += Math.hypot(c.x - px, c.z - pz);
  if (c.mode === 'walk') sawWalk = true;
  assert.ok(Math.hypot(c.x, c.z) < 10, 'stays inside the walkable area');
}
assert.ok(sawWalk && moved > 5, 'the cat walks around (moved ' + moved.toFixed(1) + ')');

// a cat with nowhere to go stays put
const stuck = makeState(3, 3, lcg(3));
for (let i = 0; i < 1000; i++) stepCat(stuck, 0.05, lcg(i + 1), () => false);
assert.ok(stuck.x === 3 && stuck.z === 3 && stuck.mode === 'idle', 'no walkable target means no movement');

// walking speed is bounded
const s = makeState(0, 0, lcg(5)); s.mode = 'walk'; s.tx = 9; s.tz = 0; s.timer = 99;
const before = s.x; stepCat(s, 1, lcg(5), () => true);
assert.ok(s.x - before > 0.5 && s.x - before < 1.2, 'one second moves about 0.9 units');

// spawn is a no-op without the loaders
const vm = require('vm'), fs = require('fs'), path = require('path');
const ctx = { console, window: null };
ctx.window = ctx; vm.createContext(ctx);
for (const f of ['js/assets.js', 'js/cats.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
(async () => {
  assert.strictEqual(await ctx.LI.cats.spawn({ scene: {}, h: () => 0, ok: () => true, count: 3, near: [0, 0] }), 0, 'spawn resolves 0 without loaders');
  assert.doesNotThrow(() => ctx.LI.cats.update(0.016, { x: 0, y: 0, z: 0 }, { x: 0, z: 0 }), 'update before spawn is a no-op');
  console.log('cats spawn tests ok');
})().catch(e => { console.error(e); process.exit(1); });

console.log('cats tests ok');
