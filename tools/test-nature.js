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
  console.log('nature tests ok');
})().catch(e => { console.error(e); process.exit(1); });
