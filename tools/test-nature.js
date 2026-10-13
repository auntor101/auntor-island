const assert = require('assert');
const vm = require('vm'), fs = require('fs'), path = require('path');

// js/assets.js must fail soft without THREE.GLTFLoader (the headless environment).
const ctx = { console, window: null };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'assets.js'), 'utf8'), ctx, { filename: 'js/assets.js' });
const A = ctx.LI.assets;
assert.strictEqual(typeof A.available, 'function');
assert.strictEqual(A.available(), false, 'no GLTFLoader means unavailable');

(async () => {
  assert.strictEqual(await A.model('nature', 'CommonTree_3'), null, 'model resolves null when unavailable');
  assert.strictEqual(await A.manifest('nature'), null, 'manifest resolves null when unavailable');
  assert.strictEqual(await A.texture('nature', 'tex/x.webp'), null, 'texture resolves null when unavailable');
  // js/nature.js: season zones by angle around the island centre
  const nctx = { console, window: null, THREE: {} };
  nctx.window = nctx;
  vm.createContext(nctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'assets.js'), 'utf8'), nctx, { filename: 'js/assets.js' });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'nature.js'), 'utf8'), nctx, { filename: 'js/nature.js' });
  const N = nctx.LI.nature;
  assert.strictEqual(N.seasonAt(10, 1), 'summer');     // angle ~0.1 rad
  assert.strictEqual(N.seasonAt(-5, 8), 'autumn');     // angle ~2.1+ rad
  assert.strictEqual(N.seasonAt(-8, -5), 'autumn');    // angle ~3.7 rad
  assert.strictEqual(N.seasonAt(3, -10), 'spring');    // angle ~5.0 rad
  const at = a => N.seasonAt(Math.cos(a) * 10, Math.sin(a) * 10);
  assert.strictEqual(at(2.09), 'summer'); assert.strictEqual(at(2.11), 'autumn');
  assert.strictEqual(at(4.19), 'autumn'); assert.strictEqual(at(4.21), 'spring');
  assert.strictEqual(N.seasonAt(1, -0.001), 'spring');  // wraps just below 2*pi
  assert.strictEqual(nctx.LI.assets.available(), false);
  assert.strictEqual(await N.upgradeHub({ scene: {}, spots: [], forest: null, h: () => 0 }), false, 'upgrade is a no-op without a loader');
  console.log('nature tests ok');
})().catch(e => { console.error(e); process.exit(1); });
