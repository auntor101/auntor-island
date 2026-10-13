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
  assert.ok(size < 256 * 1024, name + ' is under 256 KB (' + size + ' bytes)');
  assert.ok(!json.images && !json.textures, name + ' has no embedded textures');
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
function dirSize(d) { let t = 0; for (const e of fs.readdirSync(d, { withFileTypes: true })) t += e.isDirectory() ? dirSize(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size; return t; }
const total = dirSize(dir);
assert.ok(total < 1.5 * 1024 * 1024, 'assets/nature total is under 1.5 MB (' + total + ' bytes)');
console.log('asset tests ok, total ' + total + ' bytes');
