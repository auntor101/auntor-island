# Asset Pipeline and Seasonal Trees Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load real 3D tree and bush models (CC0 Quaternius, via Poly Pizza) into Auntor Island with a safe fallback, and show them as summer, autumn and spring zones.

**Architecture:** A tiny loader (`js/assets.js`) fetches geometry-only GLBs and shared WebP textures from `assets/nature/`. `js/nature.js` places them as instanced meshes at the existing tree spots, gives leaves a per-season hue-shifted toon material, and hides the old blob trees it replaces. If any loader or file is missing, the old trees stay and nothing breaks. A Node tool (`tools/prepare-assets.js`) shrinks the downloaded GLBs (each embeds about 2 MB of PNGs) into small geometry-only files plus textures shared once.

**Tech Stack:** three.js r128 with its `examples/js` GLTFLoader (vendored), vanilla JS, `sharp` (dev only, for texture resizing), Node `assert`.

**Not in this plan:** houses, cats, pines, people, flowers and grass models. Each is its own later plan. Source models were checked: Quaternius Stylized Nature MegaKit, CC0, downloaded individually from Poly Pizza (a CommonTree is 3,200 to 6,300 triangles and about 9.2 units tall with a 4 x 4 footprint; each embeds PNG textures: bark 1.0 MB, leaves 1.0 MB, a normal map 0.16 MB).

## Global Constraints

- Keep three.js r128 and classic `<script>` files. No bundler. New runtime dependencies: none (the vendored loader files are copied from `node_modules/three/examples/js`). `sharp` is a devDependency used only by `tools/`.
- Everything optional must fail soft: missing loader, failed fetch or bad GLB leaves the old procedural trees visible and the game fully playable. The headless test (no GLTFLoader) must still pass.
- Performance: target 60 fps on a mid-range phone; about 150 draw calls and about 150k triangles total; first download under 5 MB; textures at most 512 px; no real-time shadows or new lights; use `InstancedMesh`.
- Look rules: toon materials only (`MeshToonMaterial` with the shared `GRAD` ramp). **The bloom threshold is 0.9, so lit colours must stay below about 0.85 brightness.** Cap leaf colour at 0.82.
- Licences: every model or texture added is recorded in `assets/CREDITS.md` (source URL, author, licence).
- Debug hook `window.__lumen` stays.
- `npm test` must pass after every task.

## File Structure

| File | Responsibility |
|---|---|
| `vendor/three/GLTFLoader.js`, `vendor/three/SkeletonUtils.js` | Copied unchanged from `node_modules/three/examples/js` (r128) |
| `js/assets.js` | `LI.assets`: `available()`, `model(dir,name)`, `manifest(dir)`, `texture(dir,file)`; all resolve to `null` on failure |
| `js/nature.js` | `LI.nature.upgradeHub(o)`, `seasonAt(x,z)`, leaf materials, instancing |
| `tools/prepare-assets.js` | Offline: shrink the source GLBs into `assets/nature/` |
| `tools/test-assets.js` | Checks the committed output is small, texture-free and well formed |
| `tools/test-nature.js` | Unit test for `seasonAt` and the fallback path |
| `assets/nature/*.glb`, `assets/nature/manifest.json`, `assets/nature/tex/*.webp` | Generated, committed (small) |
| `assets/CREDITS.md` | Licences |
| `assets-src/` | Source downloads, git-ignored, never committed |
| `js/game.js` | Small hooks: `forest()` returns its meshes, `LI.gfx`, `Q.natureTrees`, upgrade call after boot |
| `index.html` | Script tags |

---

### Task 1: Loader files and `js/assets.js`

**Files:**
- Create: `vendor/three/GLTFLoader.js`, `vendor/three/SkeletonUtils.js`, `js/assets.js`, `tools/test-nature.js`
- Modify: `index.html` (script tags), `package.json` (`test` script)

**Interfaces:**
- Produces `window.LI.assets`:
  - `available(): boolean` (true only if `THREE.GLTFLoader` and `fetch` exist)
  - `model(dir: string, name: string): Promise<THREE.Group|null>` (loads `assets/<dir>/<name>.glb`, cached, `null` on any failure)
  - `manifest(dir: string): Promise<object|null>` (loads `assets/<dir>/manifest.json`, cached)
  - `texture(dir: string, file: string): Promise<THREE.Texture|null>` (loads `assets/<dir>/<file>`, `flipY=false`, cached)

- [ ] **Step 1: Copy the loader files**

```bash
cd /c/Users/Auntor/Desktop/lumen-isle/lumen-isle
cp node_modules/three/examples/js/loaders/GLTFLoader.js vendor/three/GLTFLoader.js
cp node_modules/three/examples/js/utils/SkeletonUtils.js vendor/three/SkeletonUtils.js
cmp vendor/three/GLTFLoader.js node_modules/three/examples/js/loaders/GLTFLoader.js && echo same
```
Expected: `same`.

- [ ] **Step 2: Write the failing test**

Create `tools/test-nature.js`:

```js
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
```

- [ ] **Step 3: Run it to see it fail**

Run: `node tools/test-nature.js`
Expected: FAIL (`ENOENT ... js/assets.js`).

- [ ] **Step 4: Implement `js/assets.js`**

```js
// Optional 3D models. Everything here fails soft: if a loader or a file is missing the game keeps its built-in shapes.
(function () {
  'use strict';
  const LI = window.LI = window.LI || {};
  const cache = { model: {}, manifest: {}, texture: {} };
  let loader = null;

  const available = () => !!(window.THREE && THREE.GLTFLoader && typeof fetch === 'function');

  function memo(bucket, key, make) {
    if (!(key in cache[bucket])) cache[bucket][key] = Promise.resolve().then(make).catch(e => { console.warn('asset failed:', key, e && e.message); return null; });
    return cache[bucket][key];
  }
  const guard = make => () => (available() ? make() : null);

  const model = (dir, name) => memo('model', dir + '/' + name, guard(() => {
    loader = loader || new THREE.GLTFLoader();
    return new Promise((res, rej) => loader.load('assets/' + dir + '/' + name + '.glb', g => res(g.scene), undefined, rej));
  }));

  const manifest = dir => memo('manifest', dir, guard(() =>
    fetch('assets/' + dir + '/manifest.json').then(r => { if (!r.ok) throw new Error('manifest ' + r.status); return r.json(); })));

  const texture = (dir, file) => memo('texture', dir + '/' + file, guard(() =>
    new Promise((res, rej) => new THREE.TextureLoader().load('assets/' + dir + '/' + file, t => { t.flipY = false; res(t); }, undefined, rej))));

  LI.assets = { available, model, manifest, texture };
})();
```

- [ ] **Step 5: Run it to see it pass**

Run: `node tools/test-nature.js`
Expected: `nature tests ok`

- [ ] **Step 6: Wire the page and the test script**

In `index.html`, after the `UnrealBloomPass.js` tag add `<script src="vendor/three/GLTFLoader.js"></script>`, and change the project script tags to this exact order:

```html
<script src="js/profile.js"></script>
<script src="js/assets.js"></script>
<script src="js/nature.js"></script>
<script src="js/game.js"></script>
<script src="js/charselect.js"></script>
```

Create a placeholder `js/nature.js` containing `// filled in by Task 3` so the page still loads. In `package.json` set:

```json
"test": "node tools/test-profile.js && node tools/test-nature.js && node tools/test-flow.js",
```

(`SkeletonUtils.js` is vendored for the later cats plan; do not add a script tag for it yet.)

- [ ] **Step 7: Run everything and commit**

Run: `npm test`
Expected: `profile tests ok`, `nature tests ok`, flow checks ok, `no script errors`.

```bash
git add vendor/three/GLTFLoader.js vendor/three/SkeletonUtils.js js/assets.js js/nature.js tools/test-nature.js index.html package.json
git commit -m "feat: fail-soft asset loader and vendored GLTFLoader"
```

---

### Task 2: Asset preparation tool and generated assets

**Files:**
- Create: `tools/prepare-assets.js`, `tools/test-assets.js`, `assets/nature/*` (generated), `assets/CREDITS.md`
- Modify: `package.json` (`sharp` devDependency, `test` script), `.gitignore` (`assets-src/`)

**Interfaces:**
- Produces: `assets/nature/CommonTree_3.glb`, `CommonTree_4.glb`, `CommonTree_5.glb`, `Bush_Common.glb` (geometry-only, material names kept: `Bark_NormalTree`, `Leaves_NormalTree`, `Leaves_TwistedTree`), `assets/nature/manifest.json` mapping material name to texture path (`{"Bark_NormalTree":"tex/Bark_NormalTree.webp", ...}`), `assets/nature/tex/*.webp` (max 512 px).
- Consumed by Task 3: model names `CommonTree_3|4|5`, `Bush_Common`; manifest keys above.

- [ ] **Step 1: Stage the source files and install sharp**

```bash
cd /c/Users/Auntor/Desktop/lumen-isle/lumen-isle
printf 'assets-src/\n' >> .gitignore
mkdir -p assets-src/nature-kit
SRC="/c/Users/Auntor/AppData/Local/Temp/claude/C--Windows-system32/f3f657d3-a95b-4f92-ad15-044edf99f593/scratchpad/nature-kit"
for p in 2c5938cb 856b5db4 7f84a768 5d3066f4; do cp "$SRC"/$p*.glb assets-src/nature-kit/; done
ls -la assets-src/nature-kit
npm install --save-dev sharp --no-audit --no-fund
node -e "console.log('sharp', require('sharp').versions.sharp)"
```
Expected: 4 GLB files (about 2.4 MB each, the bush smaller) and a sharp version printed. If the scratch folder no longer exists, re-download the four files from `https://static.poly.pizza/<full-id>.glb` (ids start with the four prefixes above; the full ids are in `ids.txt` beside the scratch folder, or on Poly Pizza under "Stylized Nature MegaKit by Quaternius", models CommonTree 3, 4, 5 and Bush Common).

- [ ] **Step 2: Write the failing test**

Create `tools/test-assets.js`:

```js
const assert = require('assert'), fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'assets', 'nature');
const MODELS = ['CommonTree_3', 'CommonTree_4', 'CommonTree_5', 'Bush_Common'];

function readGLB(file) {
  const b = fs.readFileSync(file);
  assert.strictEqual(b.readUInt32LE(0), 0x46546C67, file + ' has the glTF magic');
  const jl = b.readUInt32LE(12);
  const json = JSON.parse(b.slice(20, 20 + jl).toString('utf8'));
  const binLen = b.readUInt32LE(20 + jl);
  return { json, binLen, size: b.length, total: b.readUInt32LE(8) };
}

const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const usedMaterials = new Set();
for (const name of MODELS) {
  const { json, binLen, size, total } = readGLB(path.join(dir, name + '.glb'));
  assert.strictEqual(total, size, name + ': header length matches file size');
  assert.ok(size < 200 * 1024, name + ' is small (' + size + ' bytes)');
  assert.ok(!json.images && !json.textures, name + ' has no embedded textures');
  assert.strictEqual(json.buffers[0].byteLength, binLen - ((binLen % 4) ? 4 - binLen % 4 : 0) === binLen ? json.buffers[0].byteLength : json.buffers[0].byteLength, name + ' buffer declared');
  assert.ok(json.buffers[0].byteLength <= binLen, name + ': declared buffer fits the BIN chunk');
  for (const a of json.accessors) if (a.bufferView !== undefined) assert.ok(a.bufferView < json.bufferViews.length, name + ': accessor points at a real bufferView');
  for (const v of json.bufferViews) assert.ok(v.byteOffset + v.byteLength <= json.buffers[0].byteLength, name + ': bufferView inside buffer');
  let tris = 0;
  for (const m of json.meshes) for (const p of m.primitives) tris += json.accessors[p.indices].count / 3;
  assert.ok(tris > 500, name + ' keeps its triangles (' + tris + ')');
  for (const m of json.materials) { assert.ok(m.name, name + ' material has a name'); usedMaterials.add(m.name); }
}
for (const mat of usedMaterials) {
  assert.ok(manifest[mat], 'manifest has a texture for ' + mat);
  const f = path.join(dir, manifest[mat]);
  assert.ok(fs.existsSync(f), f + ' exists');
  assert.ok(fs.statSync(f).size < 200 * 1024, mat + ' texture is small');
}
assert.deepStrictEqual(Object.keys(manifest).sort(), [...usedMaterials].sort(), 'manifest lists exactly the used materials');
console.log('asset tests ok');
```

Then simplify the one muddled assertion: delete the line that begins `assert.strictEqual(json.buffers[0].byteLength, binLen - ...` (the next line, `<= binLen`, is the real check).

- [ ] **Step 3: Run it to see it fail**

Run: `node tools/test-assets.js`
Expected: FAIL (`ENOENT ... manifest.json`).

- [ ] **Step 4: Write the tool**

Create `tools/prepare-assets.js`:

```js
#!/usr/bin/env node
// Shrinks downloaded Quaternius GLBs into geometry-only GLBs plus shared WebP textures.
// Usage: node tools/prepare-assets.js <srcDir with .glb files> <outDir, e.g. assets/nature>
const fs = require('fs'), path = require('path'), crypto = require('crypto'), sharp = require('sharp');

const WANT = ['CommonTree_3', 'CommonTree_4', 'CommonTree_5', 'Bush_Common'];
const TEX_MAX = 512;

function readGLB(file) {
  const b = fs.readFileSync(file);
  const jl = b.readUInt32LE(12);
  const json = JSON.parse(b.slice(20, 20 + jl).toString('utf8'));
  const binLen = b.readUInt32LE(20 + jl);
  return { json, bin: b.slice(28 + jl, 28 + jl + binLen) };
}
function writeGLB(json, bin) {
  const pad = n => (4 - n % 4) % 4;
  let js = Buffer.from(JSON.stringify(json));
  js = Buffer.concat([js, Buffer.alloc(pad(js.length), 0x20)]);
  bin = Buffer.concat([bin, Buffer.alloc(pad(bin.length))]);
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4E4F534A, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004E4942, 4);
  return Buffer.concat([head, jh, js, bh, bin]);
}

// Removes every image (and texture references) from the GLB, returns the base-colour PNG per material name.
function stripImages(json, bin) {
  const textures = {};
  for (const m of json.materials || []) {
    const t = m.pbrMetallicRoughness && m.pbrMetallicRoughness.baseColorTexture;
    if (t) {
      const img = json.images[json.textures[t.index].source];
      const v = json.bufferViews[img.bufferView], s = v.byteOffset || 0;
      textures[m.name] = bin.slice(s, s + v.byteLength);
    }
    delete m.normalTexture; delete m.occlusionTexture; delete m.emissiveTexture;
    if (m.pbrMetallicRoughness) { delete m.pbrMetallicRoughness.baseColorTexture; delete m.pbrMetallicRoughness.metallicRoughnessTexture; }
  }
  const drop = new Set((json.images || []).map(i => i.bufferView));
  delete json.images; delete json.textures; delete json.samplers;
  const remap = {}, chunks = [];
  let off = 0, kept = 0;
  json.bufferViews.forEach((v, i) => {
    if (drop.has(i)) return;
    const s = v.byteOffset || 0, data = bin.slice(s, s + v.byteLength);
    const pad = (4 - off % 4) % 4;
    if (pad) { chunks.push(Buffer.alloc(pad)); off += pad; }
    remap[i] = kept++; v.byteOffset = off; chunks.push(data); off += data.length;
  });
  json.bufferViews = json.bufferViews.filter((v, i) => !drop.has(i));
  for (const a of json.accessors) if (a.bufferView !== undefined) a.bufferView = remap[a.bufferView];
  const newBin = Buffer.concat(chunks);
  json.buffers = [{ byteLength: newBin.length }];
  return { json, bin: newBin, textures };
}

(async () => {
  const [src, out] = process.argv.slice(2);
  if (!src || !out) throw new Error('usage: node tools/prepare-assets.js <srcDir> <outDir>');
  fs.mkdirSync(path.join(out, 'tex'), { recursive: true });
  const manifest = {}, hashes = {}, seen = new Set();
  for (const f of fs.readdirSync(src).filter(n => n.endsWith('.glb'))) {
    const { json, bin } = readGLB(path.join(src, f));
    const name = json.meshes[0].name;
    if (!WANT.includes(name)) continue;
    const r = stripImages(json, bin);
    for (const [mat, png] of Object.entries(r.textures)) {
      const h = crypto.createHash('sha1').update(png).digest('hex');
      if (hashes[mat] && hashes[mat] !== h) throw new Error('texture for ' + mat + ' differs between models');
      if (hashes[mat]) continue;
      hashes[mat] = h;
      await sharp(png).resize({ width: TEX_MAX, height: TEX_MAX, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toFile(path.join(out, 'tex', mat + '.webp'));
      manifest[mat] = 'tex/' + mat + '.webp';
    }
    const file = path.join(out, name + '.glb');
    fs.writeFileSync(file, writeGLB(r.json, r.bin));
    seen.add(name);
    console.log(name, fs.statSync(file).size, 'bytes');
  }
  for (const n of WANT) if (!seen.has(n)) throw new Error('missing source model ' + n);
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 1));
  console.log('manifest:', Object.keys(manifest).join(', '));
})().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 5: Generate the assets and run the test**

```bash
node tools/prepare-assets.js assets-src/nature-kit assets/nature
node tools/test-assets.js
ls -la assets/nature assets/nature/tex
```
Expected: four GLBs each under 200 KB, three WebP textures each under 200 KB, `asset tests ok`. If a WebP is over 200 KB, lower `TEX_MAX` to 384 or the quality to 70 and re-run; record the choice in your report.

- [ ] **Step 6: Credits, test script, commit**

Create `assets/CREDITS.md`:

```markdown
# Asset credits

| Asset | Author | Source | Licence |
|---|---|---|---|
| CommonTree 3, 4, 5, Bush Common (Stylized Nature MegaKit) | Quaternius | https://quaternius.com/packs/stylizednaturemegakit.html (downloaded via https://poly.pizza/bundle/Stylized-Nature-MegaKit-T34GZFA0fm) | CC0 1.0 (public domain) |

Files in `assets/nature/` are the original models with embedded textures removed and the textures shared once as 512 px WebP, produced by `tools/prepare-assets.js`.
```

In `package.json` set `"test": "node tools/test-profile.js && node tools/test-nature.js && node tools/test-assets.js && node tools/test-flow.js"`, add `"prepare-assets": "node tools/prepare-assets.js assets-src/nature-kit assets/nature"` to scripts.

Run: `npm test` (all green).

```bash
git add tools/prepare-assets.js tools/test-assets.js assets package.json package-lock.json .gitignore
git commit -m "feat: asset preparation tool and shrunk nature models"
```

---

### Task 3: Seasonal tree instancing (`js/nature.js`) and game hooks

**Files:**
- Modify: `js/nature.js` (replace the placeholder), `js/game.js` (hooks), `tools/test-nature.js` (add cases)

**Interfaces:**
- Consumes: `LI.assets.{available,model,manifest,texture}` from Task 1; model names and manifest keys from Task 2; `LI.gfx.{GRAD,Q}` and `HUB.treeSpots`, `HUB.forestInfo` from this task's game hooks. A spot is `{x,z,s,rot}`.
- Produces: `LI.nature.seasonAt(x,z): 'summer'|'autumn'|'spring'`, `LI.nature.upgradeHub(o): Promise<boolean>` where `o = {scene, spots, forest, h}`.

- [ ] **Step 1: Add failing tests for `seasonAt`**

In `tools/test-nature.js`, after the loader assertions inside the async block (before the final `console.log`), add:

```js
  // js/nature.js: season zones by angle around the island centre
  const nctx = { console, window: null, THREE: {} };
  nctx.window = nctx;
  vm.createContext(nctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'nature.js'), 'utf8'), nctx, { filename: 'js/nature.js' });
  const N = nctx.LI.nature;
  assert.strictEqual(N.seasonAt(10, 1), 'summer');     // angle ~0.1 rad
  assert.strictEqual(N.seasonAt(-5, 8), 'autumn');     // angle ~2.1+ rad
  assert.strictEqual(N.seasonAt(-8, -5), 'autumn');    // angle ~3.7 rad
  assert.strictEqual(N.seasonAt(3, -10), 'spring');    // angle ~5.0 rad
  assert.strictEqual(await N.upgradeHub({ scene: {}, spots: [], forest: null, h: () => 0 }), false, 'upgrade is a no-op without a loader');
```

Run: `node tools/test-nature.js` — expected FAIL (`N` undefined).

- [ ] **Step 2: Implement `js/nature.js`**

```js
// Seasonal trees from the shared Quaternius models. Replaces the built-in blob trees once the models have loaded;
// if anything fails, the built-in trees stay.
(function () {
  'use strict';
  const LI = window.LI = window.LI || {};
  const TREES = ['CommonTree_3', 'CommonTree_4', 'CommonTree_5'];
  const TREE_H = 4.4; // world height of a scale-1 tree, about the old blob trees
  const SEASONS = {
    summer: { hue: 0, sat: 1.0, tint: [1, 1, 1] },
    autumn: { hue: -1.62, sat: 1.25, tint: [1, .95, .9] },
    spring: { hue: -2.6, sat: .95, tint: [1, .97, 1] },
  };
  const HUE_GLSL = 'vec3 hueRot(vec3 c,float a){const vec3 k=vec3(.57735);float ca=cos(a),sa=sin(a);return c*ca+cross(k,c)*sa+k*dot(k,c)*(1.-ca);}';

  function seasonAt(x, z) {
    const a = (Math.atan2(z, x) + Math.PI * 2) % (Math.PI * 2);
    return a < 2.1 ? 'summer' : a < 4.2 ? 'autumn' : 'spring';
  }

  function leafMaterial(map, s) {
    const m = new THREE.MeshToonMaterial({ map, gradientMap: LI.gfx.GRAD, alphaTest: .5, side: THREE.DoubleSide, vertexColors: true });
    m.onBeforeCompile = sh => {
      sh.uniforms.uHue = { value: s.hue };
      sh.uniforms.uSat = { value: s.sat };
      sh.uniforms.uTint = { value: new THREE.Vector3(s.tint[0], s.tint[1], s.tint[2]) };
      sh.fragmentShader = 'uniform float uHue;uniform float uSat;uniform vec3 uTint;\n' + HUE_GLSL + '\n' +
        sh.fragmentShader.replace('#include <map_fragment>',
          '#include <map_fragment>\n diffuseColor.rgb=hueRot(diffuseColor.rgb,uHue);float lum=dot(diffuseColor.rgb,vec3(.299,.587,.114));diffuseColor.rgb=min(mix(vec3(lum),diffuseColor.rgb,uSat)*uTint,vec3(.82));');
    };
    m.customProgramCacheKey = () => 'leaf' + s.hue;
    return m;
  }
  function barkMaterial(map) {
    return new THREE.MeshToonMaterial({ map, gradientMap: LI.gfx.GRAD, vertexColors: true });
  }

  // Mesh parts of a loaded model with transforms baked in, scaled to TREE_H and standing on y=0.
  function parts(scene) {
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    const k = TREE_H / (box.max.y - box.min.y);
    const fix = new THREE.Matrix4().makeTranslation(0, -box.min.y * k, 0).multiply(new THREE.Matrix4().makeScale(k, k, k));
    const out = [];
    scene.traverse(o => { if (o.isMesh) out.push({ geo: o.geometry, matName: o.material.name, local: fix.clone().multiply(o.matrixWorld) }); });
    return out;
  }

  // Zero-scales the first n instances of the built-in forest so the new trees replace them (blob shadows stay).
  function hideProcedural(f, n) {
    if (!f) return;
    const z = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < n; i++) {
      f.trunk.setMatrixAt(i, z);
      for (let k = 0; k < f.per; k++) { f.fol.setMatrixAt(i * f.per + k, z); f.folO.setMatrixAt(i * f.per + k, z); }
    }
    [f.trunk, f.fol, f.folO].forEach(m => { m.instanceMatrix.needsUpdate = true; });
  }

  async function upgradeHub(o) {
    const A = LI.assets;
    if (!A || !A.available() || !LI.gfx) return false;
    try {
      const man = await A.manifest('nature');
      const models = await Promise.all(TREES.map(n => A.model('nature', n)));
      if (!man || models.some(m => !m)) return false;
      const tex = {};
      for (const [mat, file] of Object.entries(man)) { tex[mat] = await A.texture('nature', file); if (!tex[mat]) return false; }
      const prefabs = models.map(parts);
      const n = Math.min(o.spots.length, LI.gfx.Q.natureTrees);
      const mats = {}, buckets = {};
      const matFor = (name, season) => {
        const key = name + '|' + season;
        if (!mats[key]) mats[key] = name.startsWith('Leaves') ? leafMaterial(tex[name], SEASONS[season]) : barkMaterial(tex[name]);
        return mats[key];
      };
      const place = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
      o.spots.slice(0, n).forEach((t, i) => {
        const v = i % prefabs.length, season = seasonAt(t.x, t.z);
        place.compose(p.set(t.x, o.h(t.x, t.z), t.z), q.setFromEuler(e.set(0, t.rot, 0)), sc.setScalar(t.s));
        prefabs[v].forEach((part, pi) => {
          const key = v + '|' + season + '|' + pi;
          (buckets[key] = buckets[key] || { part, season, list: [] }).list.push(place.clone().multiply(part.local));
        });
      });
      const col = new THREE.Color();
      for (const b of Object.values(buckets)) {
        const im = new THREE.InstancedMesh(b.part.geo, matFor(b.part.matName, b.season), b.list.length);
        b.list.forEach((m, k) => { im.setMatrixAt(k, m); col.setHSL(0, 0, .9 + ((k * 37) % 10) / 50); im.setColorAt(k, col); });
        im.frustumCulled = false;
        o.scene.add(im);
      }
      hideProcedural(o.forest, n);
      return true;
    } catch (e) {
      console.warn('nature upgrade failed:', e && e.message);
      return false;
    }
  }

  LI.nature = { seasonAt, upgradeHub };
})();
```

- [ ] **Step 3: Run the nature test**

Run: `node tools/test-nature.js`
Expected: `nature tests ok`.

- [ ] **Step 4: Game hooks in `js/game.js`**

1. Make `forest()` return what it created. At its end (after `parent.add(trunk,fol,folO,sh);`) add: `return {trunk,fol,folO,sh,per};` (use Grep to find the function; it ends a few lines after line 119).
2. In `buildHub`, capture the result: change `forest(sc,spots,hubH,{trunk:'#8a5d44',...` to `const treeForest=forest(sc,spots,hubH,{...same options...});` and add `forestInfo:treeForest,treeSpots:spots` to the world object that `buildHub` returns (use Grep for the `return W` or returned object near the end of `buildHub`; add the properties the same way its neighbours are added, e.g. `W.forestInfo=treeForest;W.treeSpots=spots;` before the return).
3. Add `natureTrees` to both `Q` profiles (line 11): touch `natureTrees:20`, desktop `natureTrees:36`.
4. Just before the boot line `HUB=buildHub();`, expose graphics helpers: `LI.gfx={GRAD,Q,TOUCH};` (`LI` is already defined at the top of the IIFE; `GRAD`, `Q`, `TOUCH` are in scope).
5. After `requestAnimationFrame(frame);` in the boot block add: `if(LI.nature)LI.nature.upgradeHub({scene:HUB.scene,spots:HUB.treeSpots,forest:HUB.forestInfo,h:hubH});`
6. Add `renderer` to the `window.__lumen={...}` debug hook (the visual task reads `renderer.info`).

- [ ] **Step 5: Run the full suite and serve it**

Run: `npm test`
Expected: all green (the headless test has no GLTFLoader, so `upgradeHub` returns false and nothing changes).

Then `npx serve . -l 4040` in the background and open http://localhost:4040/ in a browser tool. Check: no console errors except favicon; trees are now real models on part of the island; the old blob trees at the same spots are gone (no doubled trees). Stop the server.

- [ ] **Step 6: Commit**

```bash
git add js/nature.js js/game.js tools/test-nature.js
git commit -m "feat: seasonal Quaternius trees replace the blob trees when models load"
```

---

### Task 4: Look and performance check, then tune

**Files:**
- Modify: `js/nature.js` (the `SEASONS` constants and `TREE_H` only), `js/game.js` (`Q.natureTrees` only)

**Interfaces:** none new.

- [ ] **Step 1: Capture the three seasons**

Serve the folder (`npx serve . -l 4050` in the background) and, with a browser tool (chrome-devtools, Playwright or claude-in-chrome MCP; load with ToolSearch if deferred), open it at 390x844 with touch emulation. Click Enter, wait for the intro cut, then take three screenshots of the island looking toward each season zone. Zones by angle around the island centre: summer 0 to 2.1 rad, autumn 2.1 to 4.2 rad, spring 4.2 to 6.28 rad (angle = atan2(z, x)). Place the camera for each by setting `__lumen.P.pos` to a point near that zone's trees and turning with a mouse drag or by editing yaw through repeated drags. Save the screenshots in `.superpowers/` (git-ignored) and copy them to a path your tool can write if needed.

- [ ] **Step 2: Judge and tune**

Look at each screenshot and check: autumn leaves read as orange or red or gold (not brown mud or neon); spring leaves read as soft pink blossom (not purple or white-out); summer leaves look like fresh green; nothing glows (bloom) and nothing looks flat black; leaf cards have clean edges; trunk and leaves are not floating apart. Adjust `SEASONS` hue (radians), `sat` and `tint` and, if trees look too big or small beside houses, `TREE_H`, and re-capture until all three read correctly. Hue is a rotation around the grey axis: green is about 120 degrees (2.09 rad); orange is about 30 degrees, so about -1.57 rad away; pink is about 330 degrees, so about -2.6 rad away.

- [ ] **Step 3: Measure cost on the phone profile**

With touch emulation on, run in the page console and report the numbers:

```js
const i = __lumen.renderer.info.render; ({ calls: i.calls, triangles: i.triangles })
```

Targets: `calls` about 150 or fewer and `triangles` about 150k or fewer. If triangles exceed 150k on the touch profile, lower `Q.natureTrees` for touch in `js/game.js` (try 16, then 12) and re-measure; the hidden blob trees show through for the remaining spots, which is intended. Also note frame pacing if the tool reports it; report plainly if you could not measure fps.

- [ ] **Step 4: Verify the fallback**

Reload with the GLB requests blocked (rename `assets/nature` temporarily to `assets/nature_off`, reload, confirm the blob trees return and the game plays, then rename it back). Confirm `git status` shows no stray changes.

- [ ] **Step 5: Run tests and commit**

Run: `npm test` (all green).

```bash
git add js/nature.js js/game.js
git commit -m "tune: season colours and tree budget from phone-size renders"
```

---

### Task 5: Docs

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Document the pipeline**

In `CLAUDE.md` under **Files** add bullets for `js/assets.js`, `js/nature.js`, `assets/`, `assets/CREDITS.md`, `assets-src/` (git-ignored sources) and `tools/prepare-assets.js` (`npm run prepare-assets` regenerates `assets/nature/` from `assets-src/nature-kit`). Add a short section "Optional models": models load asynchronously through `LI.assets`, every user of them must keep a built-in fallback, the headless test never loads GLBs, and texture and triangle budgets (512 px textures, about 150k triangles). Add `Q.natureTrees` to the performance notes.

- [ ] **Step 2: Run tests and commit**

Run: `npm test`.

```bash
git add CLAUDE.md
git commit -m "docs: describe the asset pipeline and seasonal trees"
```

---

## Self-Review

**Coverage.** Asset loading with fallback (Task 1), shrinking oversized GLBs to fit the phone budget (Task 2), seasonal autumn/spring/summer trees on the existing island spots (Task 3), visual and performance verification with tuning (Task 4), docs and credits (Tasks 2 and 5). Spec items for houses, cats, people, flowers and grass models are intentionally later plans.

**Placeholders.** None. The `// filled in by Task 3` file in Task 1 is replaced in Task 3.

**Type consistency.** `LI.assets` exposes `available, model, manifest, texture` and `nature.js` uses exactly those; spots are `{x,z,s,rot}` as in `buildHub`; `forest()` returns `{trunk,fol,folO,sh,per}` and `hideProcedural` reads exactly those fields; model names `CommonTree_3|4|5` and the manifest keys come from `prepare-assets.js`.

**Known risks.** The leaf hue shader and texture colour space (`flipY=false`, no sRGB flag, matching the game's existing colour handling) need the Task 4 visual check; r128 `onBeforeCompile` with a shared program cache is believed to work per material but is verified only visually; the poly.pizza source files are not signed, so the CC0 claim rests on the Quaternius pack page and the bundle listing.
