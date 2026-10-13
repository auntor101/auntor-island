#!/usr/bin/env node
// Shrinks downloaded Quaternius GLBs into geometry-only GLBs plus shared WebP textures.
// Usage: node tools/prepare-assets.js <srcDir with .glb files> <outDir, e.g. assets/nature>
const fs = require('fs'), path = require('path'), crypto = require('crypto'), sharp = require('sharp');

const WANT = ['CommonTree_3', 'CommonTree_4', 'CommonTree_5', 'Bush_Common'];
const TEX_MAX = 512;

function readGLB(file) {
  return parseGLB(fs.readFileSync(file), file);
}
function parseGLB(b, label) {
  const bad = msg => { throw new Error((label || 'glb') + ': ' + msg); };
  if (b.length < 28) bad('too short');
  if (b.readUInt32LE(0) !== 0x46546C67) bad('missing glTF magic');
  if (b.readUInt32LE(4) !== 2) bad('unsupported glTF version');
  if (b.readUInt32LE(8) !== b.length) bad('declared length does not match file size');
  const jl = b.readUInt32LE(12);
  if (b.readUInt32LE(16) !== 0x4E4F534A) bad('first chunk is not JSON');
  if (28 + jl > b.length) bad('JSON chunk exceeds file');
  if (b.readUInt32LE(20 + jl + 4) !== 0x004E4942) bad('second chunk is not BIN');
  const binLen = b.readUInt32LE(20 + jl);
  if (28 + jl + binLen > b.length) bad('BIN chunk exceeds file');
  const json = JSON.parse(b.slice(20, 20 + jl).toString('utf8'));
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
  const textures = Object.create(null);
  const slice = (v, what) => {
    const s = v.byteOffset || 0;
    if (s + v.byteLength > bin.length) throw new Error(what + ' exceeds the BIN chunk');
    return bin.slice(s, s + v.byteLength);
  };
  for (const a of json.accessors || []) if (a.sparse) throw new Error('sparse accessors are not supported');
  for (const m of json.materials || []) {
    const t = m.pbrMetallicRoughness && m.pbrMetallicRoughness.baseColorTexture;
    if (t) {
      if (typeof m.name !== 'string' || !/^[A-Za-z0-9_]+$/.test(m.name)) throw new Error('bad material name: ' + m.name);
      const img = json.images[json.textures[t.index].source];
      if (img.bufferView === undefined || img.uri !== undefined) throw new Error('image in ' + m.name + ' must use bufferView, not uri');
      const png = slice(json.bufferViews[img.bufferView], 'texture bufferView');
      if (png.length < 4 || png.readUInt32BE(0) !== 0x89504E47) throw new Error('texture for ' + m.name + ' is not a PNG');
      textures[m.name] = png;
    }
    delete m.normalTexture; delete m.occlusionTexture; delete m.emissiveTexture;
    if (m.pbrMetallicRoughness) { delete m.pbrMetallicRoughness.baseColorTexture; delete m.pbrMetallicRoughness.metallicRoughnessTexture; }
  }
  for (const i of json.images || []) if (i.uri !== undefined || i.bufferView === undefined) throw new Error('image must use bufferView, not uri');
  const drop = new Set((json.images || []).map(i => i.bufferView));
  delete json.images; delete json.textures; delete json.samplers;
  const remap = Object.create(null), chunks = [];
  let off = 0, kept = 0;
  json.bufferViews.forEach((v, i) => {
    if (drop.has(i)) return;
    const data = slice(v, 'bufferView ' + i);
    const pad = (4 - off % 4) % 4;
    if (pad) { chunks.push(Buffer.alloc(pad)); off += pad; }
    remap[i] = kept++; v.byteOffset = off; chunks.push(data); off += data.length;
  });
  json.bufferViews = json.bufferViews.filter((v, i) => !drop.has(i));
  for (const a of json.accessors) {
    if (a.bufferView === undefined) continue;
    if (remap[a.bufferView] === undefined) throw new Error('accessor points at a removed or missing bufferView');
    a.bufferView = remap[a.bufferView];
  }
  const newBin = Buffer.concat(chunks);
  json.buffers = [{ byteLength: newBin.length }];
  return { json, bin: newBin, textures };
}

async function main() {
  const [src, out] = process.argv.slice(2);
  if (!src || !out) throw new Error('usage: node tools/prepare-assets.js <srcDir> <outDir>');
  fs.mkdirSync(path.join(out, 'tex'), { recursive: true });
  const manifest = Object.create(null), hashes = Object.create(null), seen = new Set();
  for (const f of fs.readdirSync(src).filter(n => n.endsWith('.glb'))) {
    const { json, bin } = readGLB(path.join(src, f));
    const name = json.meshes[0].name;
    if (!WANT.includes(name)) continue;
    const r = stripImages(json, bin);
    for (const [mat, png] of Object.entries(r.textures)) {
      if (!/^[A-Za-z0-9_]+$/.test(mat)) throw new Error('bad material name: ' + mat);
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
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(Object.assign({}, manifest), null, 1) + '\n');
  console.log('manifest:', Object.keys(manifest).join(', '));
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
else module.exports = { readGLB, parseGLB, writeGLB, stripImages };
