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
