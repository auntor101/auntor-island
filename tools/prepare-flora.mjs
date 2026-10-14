#!/usr/bin/env node
// Shrinks the Quaternius Stylized Nature MegaKit (CC0, poly.pizza mirror) into compact flora GLBs + shared WebP atlases.
// Usage: node tools/prepare-flora.mjs <srcDir with the downloaded .glb files> [outDir=public/world/flora]
// Treats the inputs as untrusted data: parses bytes only, never runs anything from them.
// UV v is stored as (v+30)/31 because bark tiles; the shader decodes it and picks the atlas half from the leaf flag.
// Output GLB: one mesh, POSITION f32, NORMAL i8, TEXCOORD_0 u16, COLOR_0 u8 (r = leaf flag, g = inner shade), u16 indices.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const [src, out = 'public/world/flora'] = process.argv.slice(2);
if (!src) { console.error('usage: node tools/prepare-flora.mjs <srcDir> [outDir]'); process.exit(2); }

const MODELS = { // out name <- [kit name, atlas, kind]
  tree_a: ['CommonTree_3', 'tree', 'tree'], tree_b: ['CommonTree_4', 'tree', 'tree'], tree_c: ['CommonTree_5', 'tree', 'tree'],
  pine_a: ['Pine_5', 'pine', 'tree'], pine_b: ['Pine_4', 'pine', 'tree'],
  dead: ['DeadTree_5', null, 'dead'], bush: ['Bush_Common', null, 'bush'], fern: ['Fern_1', null, 'fern'],
  shroom: ['Mushroom_Common', null, 'plain'], rock_a: ['Rock_Medium_1', null, 'plain'], rock_b: ['Rock_Medium_2', null, 'plain'], rock_c: ['Rock_Medium_3', null, 'plain'],
};
const ATLAS = { tree: ['Bark_NormalTree', 'Leaves_NormalTree'], pine: ['Bark_NormalTree', 'Leaves_Pine'] }; // [left half, right half]
const SINGLE = { dead: 'Bark_DeadTree', bush: 'Leaves_TwistedTree', fern: 'Leaves', shroom: 'Mushrooms', rock_a: 'Rocks', rock_b: 'Rocks', rock_c: 'Rocks' };
const SIZES = { Bark_DeadTree: 256, Leaves_TwistedTree: 512, Leaves: 256, Mushrooms: 256, Rocks: 512 };

function parseGLB(b) {
  if (b.length < 28 || b.readUInt32LE(0) !== 0x46546C67 || b.readUInt32LE(4) !== 2 || b.readUInt32LE(8) > b.length) throw new Error('bad GLB header');
  const jl = b.readUInt32LE(12);
  if (b.readUInt32LE(16) !== 0x4E4F534A || 28 + jl > b.length || b.readUInt32LE(20 + jl + 4) !== 0x004E4942) throw new Error('bad GLB chunks');
  const bl = b.readUInt32LE(20 + jl);
  if (28 + jl + bl > b.length) throw new Error('BIN exceeds file');
  return { json: JSON.parse(b.slice(20, 20 + jl).toString('utf8')), bin: b.slice(28 + jl, 28 + jl + bl) };
}
const CT = { 5126: [Float32Array, 4], 5123: [Uint16Array, 2], 5125: [Uint32Array, 4] }, NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
function accessor({ json, bin }, i) {
  const a = json.accessors[i], v = json.bufferViews[a.bufferView], [T, sz] = CT[a.componentType] || [], n = NC[a.type];
  if (!T || a.sparse || (v.byteStride && v.byteStride !== sz * n)) throw new Error('unsupported accessor ' + i);
  const off = (v.byteOffset || 0) + (a.byteOffset || 0);
  if (off + a.count * n * sz > bin.length) throw new Error('accessor exceeds BIN');
  return new T(bin.buffer.slice(bin.byteOffset + off, bin.byteOffset + off + a.count * n * sz));
}
function textures({ json, bin }) { // base colour PNG per material name
  const t = {};
  for (const m of json.materials) {
    const bt = m.pbrMetallicRoughness?.baseColorTexture;
    if (!bt) continue;
    const img = json.images[json.textures[bt.index].source], v = json.bufferViews[img.bufferView];
    const png = bin.slice(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
    if (png.readUInt32BE(0) !== 0x89504E47) throw new Error('texture is not a PNG');
    t[m.name] = png;
  }
  return t;
}

const files = {};
for (const f of fs.readdirSync(src).filter((f) => f.endsWith('.glb'))) { // the mirror left a few XML error pages named .glb: skip anything that is not a valid GLB
  try { const g = parseGLB(fs.readFileSync(path.join(src, f))); files[g.json.meshes[0].name] = g; } catch (e) { console.warn('skip', f, e.message); }
}
const pngs = {};

// Read a model into flat arrays: per vertex position, normal, uv, leaf flag; indices.
function load(kitName, atlas, kind) {
  const g = files[kitName];
  if (!g) throw new Error('missing ' + kitName);
  Object.assign(pngs, textures(g));
  const P = [], N = [], U = [], L = [], I = [];
  for (const prim of g.json.meshes[0].primitives) {
    const mat = g.json.materials[prim.material].name, pos = accessor(g, prim.attributes.POSITION), nor = accessor(g, prim.attributes.NORMAL), uv = accessor(g, prim.attributes.TEXCOORD_0), idx = accessor(g, prim.indices);
    const base = P.length / 3, leaf = /^Leaves/.test(mat) ? 1 : 0;
        for (let i = 0; i < pos.length / 3; i++) {
      P.push(pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]); N.push(nor[3 * i], nor[3 * i + 1], nor[3 * i + 2]);
      const u = uv[2 * i], v = uv[2 * i + 1];
      if (u < -7.999 || u > 7.999 || v < -63.999 || v > 3.999) throw new Error(kitName + ': uv outside range ' + u + ',' + v + ' ' + mat);
      U.push((u + 8) / 16, (v + 64) / 68); L.push(leaf); // raw uv; v tiles downward on bark, the shader decodes u*16-8, v*68-64 and wraps it
    }
    for (const k of idx) I.push(k + base);
  }
  return { P, N, U, L, I, kind };
}

// Leaves get radial normals from the crown centre (soft puffy cel shading) and an inner-shade value in the green channel.
function shade(m, flat, up) {
  const lv = []; m.L.forEach((l, i) => l && lv.push(i));
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (const i of lv) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], m.P[3 * i + k]); hi[k] = Math.max(hi[k], m.P[3 * i + k]); }
  const c = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2), R = Math.max(hi[0] - lo[0], hi[2] - lo[2]) / 2;
  m.S = new Array(m.L.length).fill(255);
  for (const i of lv) {
    let d = [m.P[3 * i] - c[0], (m.P[3 * i + 1] - c[1]) / flat, m.P[3 * i + 2] - c[2]];
    const len = Math.hypot(...d) || 1;
    d = d.map((x) => x / len); d[1] += up; const l2 = Math.hypot(...d); d = d.map((x) => x / l2);
    m.N[3 * i] = d[0]; m.N[3 * i + 1] = d[1]; m.N[3 * i + 2] = d[2];
    m.S[i] = Math.round(255 * (0.5 + 0.5 * Math.min(1, len / (R * 1.1))));
  }
  m.crown = { c, R, lo, hi };
}

function write(name, m) {
  const nv = m.P.length / 3, ni = m.I.length, ip = Math.ceil(ni * 2 / 4) * 4;
  const pos = Buffer.alloc(nv * 12), nor = Buffer.alloc(nv * 4), uv = Buffer.alloc(nv * 4), col = Buffer.alloc(nv * 4), idx = Buffer.alloc(ip);
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (let i = 0; i < nv; i++) {
    for (let k = 0; k < 3; k++) { const p = m.P[3 * i + k]; pos.writeFloatLE(p, 12 * i + 4 * k); lo[k] = Math.min(lo[k], p); hi[k] = Math.max(hi[k], p); nor.writeInt8(Math.round(Math.max(-1, Math.min(1, m.N[3 * i + k])) * 127), 4 * i + k); }
    uv.writeUInt16LE(Math.round(m.U[2 * i] * 65535), 4 * i); uv.writeUInt16LE(Math.round(m.U[2 * i + 1] * 65535), 4 * i + 2);
    col.writeUInt8(m.L[i] ? 255 : 0, 4 * i); col.writeUInt8(m.S ? m.S[i] : 255, 4 * i + 1); col.writeUInt8(255, 4 * i + 2); col.writeUInt8(255, 4 * i + 3);
  }
  m.I.forEach((v, i) => idx.writeUInt16LE(v, 2 * i));
  const views = [], bufs = []; let off = 0;
  const add = (b, target, stride) => { views.push({ buffer: 0, byteOffset: off, byteLength: b.length, target, ...(stride ? { byteStride: stride } : {}) }); bufs.push(b); off += b.length; return views.length - 1; };
  const vi = add(idx, 34963), vp = add(pos, 34962, 12), vn = add(nor, 34962, 4), vu = add(uv, 34962, 4), vc = add(col, 34962, 4);
  const acc = [
    { bufferView: vi, componentType: 5123, count: ni, type: 'SCALAR' },
    { bufferView: vp, componentType: 5126, count: nv, type: 'VEC3', min: lo, max: hi },
    { bufferView: vn, componentType: 5120, normalized: true, count: nv, type: 'VEC3' },
    { bufferView: vu, componentType: 5123, normalized: true, count: nv, type: 'VEC2' },
    { bufferView: vc, componentType: 5121, normalized: true, count: nv, type: 'VEC4' },
  ];
  const json = { asset: { version: '2.0', generator: 'prepare-flora' }, extensionsUsed: ['KHR_mesh_quantization'], extensionsRequired: ['KHR_mesh_quantization'], scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name }], meshes: [{ name, primitives: [{ attributes: { POSITION: 1, NORMAL: 2, TEXCOORD_0: 3, COLOR_0: 4 }, indices: 0 }] }], accessors: acc, bufferViews: views, buffers: [{ byteLength: off }] };
  const bin = Buffer.concat(bufs);
  let js = Buffer.from(JSON.stringify(json)); js = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]);
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4E4F534A, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004E4942, 4);
  const file = path.join(out, name + '.glb');
  fs.writeFileSync(file, Buffer.concat([head, jh, js, bh, bin]));
  console.log(name.padEnd(8), (ni / 3) + ' tris', nv + ' verts', fs.statSync(file).size + ' bytes');
}

// Mid-distance tree: every n-th leaf card enlarged around its centre, plus a 6-sided tapered trunk (bark half of the atlas).
function lod1(m, every, grow) {
  const o = { P: [], N: [], U: [], L: [], S: [], I: [] }, { c, lo } = m.crown;
  let q = 0;
  for (let t = 0; t < m.I.length; t += 6) { // leaf cards are 4 vertices, two triangles
    const tri = m.I.slice(t, t + 6), vs = [...new Set(tri)];
    if (vs.length !== 4 || !m.L[vs[0]]) continue;
    if (q++ % every) continue;
    const mid = [0, 1, 2].map((k) => vs.reduce((s, v) => s + m.P[3 * v + k], 0) / 4), base = o.P.length / 3;
    for (const v of vs) {
      for (let k = 0; k < 3; k++) o.P.push(mid[k] + (m.P[3 * v + k] - mid[k]) * grow);
      o.N.push(m.N[3 * v], m.N[3 * v + 1], m.N[3 * v + 2]); o.U.push(m.U[2 * v], m.U[2 * v + 1]); o.L.push(1); o.S.push(m.S[v]);
    }
    for (const i of tri) o.I.push(base + vs.indexOf(i));
  }
  const r0 = 0.32, r1 = 0.14, top = Math.max(lo[1] + 1.2, c[1] * 0.9), sides = 6, base = o.P.length / 3;
  for (const [y, r, v] of [[-0.2, r0 * 1.4, 1], [0.6, r0, 0.7], [top, r1, 0]]) for (let s = 0; s <= sides; s++) {
    const a = s / sides * Math.PI * 2, x = Math.cos(a), z = Math.sin(a);
    o.P.push(x * r, y, z * r); o.N.push(x, 0.2, z); o.U.push((s / sides + 8) / 16, (64 - 3 * v) / 68); o.L.push(0); o.S.push(255);
  }
  for (let ring = 0; ring < 2; ring++) for (let s = 0; s < sides; s++) {
    const a = base + ring * (sides + 1) + s, b = a + 1, c2 = a + sides + 1, d = c2 + 1;
    o.I.push(a, c2, b, b, c2, d);
  }
  return o;
}

fs.mkdirSync(path.join(out, 'tex'), { recursive: true });
const loaded = {};
for (const [name, [kit, atlas, kind]] of Object.entries(MODELS)) {
  const m = load(kit, atlas, kind);
  if (kind === 'tree') shade(m, 0.8, 0.25);
  if (kind === 'bush') shade(m, 0.9, 0.2);
  if (kind === 'fern') { shade(m, 0.6, 0.6); m.P = m.P.map((x) => x * 0.14); }
  loaded[name] = m;
  write(name, m);
}
write('tree_l1', lod1(loaded.tree_c, 8, 1.9));
write('pine_l1', lod1(loaded.pine_b, 6, 1.7));

// textures: two atlases (bark | leaves) and one image per single-material model
const man = {};
async function save(name, img) {
  const f = 'tex/' + name + '.webp';
  await sharp(img).webp({ quality: 82 }).toFile(path.join(out, f));
  man[name] = f; console.log(f, fs.statSync(path.join(out, f)).size + ' bytes');
}
for (const [name, [bark, leaf]] of Object.entries(ATLAS)) {
  const half = (n) => sharp(pngs[n]).resize(512, 512, { fit: 'fill' }).ensureAlpha().raw().toBuffer();
  const a = await half(bark), b = await half(leaf), row = Buffer.alloc(1024 * 512 * 4);
  for (let y = 0; y < 512; y++) { a.copy(row, y * 4096, y * 2048, (y + 1) * 2048); b.copy(row, y * 4096 + 2048, y * 2048, (y + 1) * 2048); }
  await save(name + '_atlas', await sharp(row, { raw: { width: 1024, height: 512, channels: 4 } }).png().toBuffer());
}
for (const n of new Set(Object.values(SINGLE))) await save(n, await sharp(pngs[n]).resize(SIZES[n], SIZES[n], { fit: 'fill' }).ensureAlpha().png().toBuffer());
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ atlas: { tree_a: 'tree_atlas', tree_b: 'tree_atlas', tree_c: 'tree_atlas', tree_l1: 'tree_atlas', pine_a: 'pine_atlas', pine_b: 'pine_atlas', pine_l1: 'pine_atlas' }, single: SINGLE, tex: man }, null, 1) + '\n');
