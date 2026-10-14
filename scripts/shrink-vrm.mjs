// Generic VRM/GLB texture shrinker: node scripts/shrink-vrm.mjs <in.vrm> <out.vrm>
// Resizes embedded images (1024 px for face/hair/body/clothes colour maps, 512 px for the rest), JPEG when opaque, PNG when alpha.
// Only the BIN chunk's image bytes and the glTF bufferView/image records change; the VRM extension JSON is copied untouched.
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { readGlb } from './vrm-meta.mjs';

const require = createRequire(import.meta.url);
const sharp = ['../node_modules/sharp', '../../lumen-isle/node_modules/sharp'].map((p) => { try { return require(p); } catch { return null; } }).find(Boolean);
if (!sharp) throw new Error('sharp not found in ../../node_modules or ../../../lumen-isle/node_modules');

const BIG = /^(?!.*(eye|mouth|brow|lash|line)).*(face|hair|body|skin|tops|cloth|dress|skirt|coat)/i;

export const triangles = (json) => json.meshes.flatMap((m) => m.primitives).reduce((n, p) => n + (p.indices != null ? json.accessors[p.indices].count : json.accessors[p.attributes.POSITION].count) / 3, 0);

// image index -> cap in px, from the materials that use it as a colour map (VRM0 and VRM1 layouts)
function caps(json) {
  const cap = new Map(), tex = (t) => json.textures[t]?.source;
  const use = (t, name, main) => { const i = tex(t); if (i == null) return; cap.set(i, Math.max(cap.get(i) || 0, main && BIG.test(name) ? 1024 : 512)); };
  for (const mp of json.extensions?.VRM?.materialProperties || []) for (const [k, t] of Object.entries(mp.textureProperties || {})) use(t, mp.name, k === '_MainTex' || k === '_ShadeTexture');
  for (const m of json.materials || []) {
    use(m.pbrMetallicRoughness?.baseColorTexture?.index, m.name || '', true);
    const mt = m.extensions?.VRMC_materials_mtoon;
    use(mt?.shadeMultiplyTexture?.index, m.name || '', true);
    for (const t of [m.normalTexture, m.emissiveTexture, mt?.matcapTexture, mt?.shadingShiftTexture, mt?.outlineWidthMultiplyTexture, mt?.uvAnimationMaskTexture]) use(t?.index, m.name || '', false);
  }
  return cap;
}


// Dense float VEC3 morph-target accessors -> sparse (lossless: only vertices with a non-zero delta are stored).
function sparseMorphs(json, views) {
  // shortcut: morph NORMAL deltas are dropped (toon shading, invisible), the accessors become zero-filled
  for (const p of json.meshes.flatMap((m) => m.primitives)) for (const t of p.targets || []) if (t.NORMAL != null) { delete json.accessors[t.NORMAL].bufferView; delete json.accessors[t.NORMAL].byteOffset; delete t.NORMAL; }
  const morph = new Set(json.meshes.flatMap((m) => m.primitives.flatMap((p) => (p.targets || []).flatMap((t) => Object.values(t)))));
  for (const p of json.meshes.flatMap((m) => m.primitives)) for (const a of Object.values(p.attributes)) morph.delete(a);
  for (const ai of morph) {
    const a = json.accessors[ai], v = views[a.bufferView];
    if (a.sparse || a.componentType !== 5126 || a.type !== 'VEC3' || v.bv.byteStride) continue;
    const f = new Float32Array(v.data.buffer.slice(v.data.byteOffset + (a.byteOffset || 0), v.data.byteOffset + (a.byteOffset || 0) + a.count * 12));
    const idx = []; for (let i = 0; i < a.count; i++) if (f[i * 3] || f[i * 3 + 1] || f[i * 3 + 2]) idx.push(i);
    if (idx.length * 16 > a.count * 12 * 0.7 || !idx.length) continue;
    const ib = Buffer.alloc(idx.length * 2), vb = Buffer.alloc(idx.length * 12);
    idx.forEach((i, k) => { ib.writeUInt16LE(i, k * 2); vb.set(Buffer.from(f.buffer, i * 12, 12), k * 12); });
    views.push({ bv: { buffer: 0 }, data: ib }, { bv: { buffer: 0 }, data: vb });
    a.sparse = { count: idx.length, indices: { bufferView: views.length - 2, componentType: 5123 }, values: { bufferView: views.length - 1 } };
    delete a.bufferView; delete a.byteOffset;
  }
}

export async function shrink(inFile, outFile) {
  const src = readFileSync(inFile), { json, bin } = readGlb(src);
  const before = { bytes: src.length, tris: triangles(json), images: json.images.length };
  if (!bin || json.buffers.length !== 1 || json.buffers[0].uri) { copyFileSync(inFile, outFile); return { ...before, after: before.bytes, note: 'copied as is: not a single embedded buffer' }; }
  const cap = caps(json), thumb = new Set([json.extensions?.VRM?.meta?.texture].filter((x) => x >= 0).map((t) => json.textures[t]?.source));
  const imgView = new Map(json.images.map((im, i) => [im.bufferView, i]));
  const views = [];
  for (const [vi, bv] of json.bufferViews.entries()) {
    let data = bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
    const ii = imgView.get(vi);
    if (ii != null) {
      const img = sharp(data), meta = await img.metadata(), limit = thumb.has(ii) ? 512 : cap.get(ii) || 512;
      if (Math.max(meta.width, meta.height) > 16) {
        const r = img.resize({ width: limit, height: limit, fit: 'inside', withoutEnlargement: true });
        const opaque = !meta.hasAlpha || (await sharp(data).stats()).isOpaque;
        const out = opaque ? await r.flatten({ background: '#fff' }).jpeg({ quality: 88, mozjpeg: true }).toBuffer() : await r.png({ palette: true, quality: 90, compressionLevel: 9 }).toBuffer();
        if (out.length < data.length) { data = out; json.images[ii].mimeType = opaque ? 'image/jpeg' : 'image/png'; }
      }
    }
    views.push({ bv, data, keep: ii != null });
  }
  sparseMorphs(json, views);
  // drop bufferViews nothing references any more (the dense morph data), renumber the rest
  const used = new Set(json.images.map((i) => i.bufferView));
  for (const a of json.accessors) { used.add(a.bufferView); used.add(a.sparse?.indices.bufferView); used.add(a.sparse?.values.bufferView); }
  const remap = new Map(), kept = views.filter((v, i) => used.has(i) && remap.set(i, remap.size));
  for (const a of json.accessors) { if (a.bufferView != null) a.bufferView = remap.get(a.bufferView); if (a.sparse) for (const k of ['indices', 'values']) a.sparse[k].bufferView = remap.get(a.sparse[k].bufferView); }
  for (const i of json.images) i.bufferView = remap.get(i.bufferView);
  const parts = []; let off = 0;
  json.bufferViews = kept.map(({ bv, data }) => { off = Math.ceil(off / 4) * 4; parts.push([off, data]); const n = { ...bv, byteOffset: off, byteLength: data.length }; off += data.length; return n; });
  const total = Math.ceil(off / 4) * 4, nb = Buffer.alloc(total);
  for (const [o, d] of parts) nb.set(d, o);
  json.buffers[0].byteLength = total;
  const js = Buffer.from(JSON.stringify(json)), jp = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const hdr = Buffer.alloc(12), ch = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
  hdr.writeUInt32LE(0x46546c67, 0); hdr.writeUInt32LE(2, 4); hdr.writeUInt32LE(12 + 8 + jp.length + 8 + total, 8);
  const outBuf = Buffer.concat([hdr, ch(jp.length, 0x4e4f534a), jp, ch(total, 0x004e4942), nb]);
  writeFileSync(outFile, outBuf);
  return { ...before, after: outBuf.length };
}

if (import.meta.url === new URL(process.argv[1], 'file:///').href || process.argv[1]?.endsWith('shrink-vrm.mjs')) {
  const [i, o] = process.argv.slice(2);
  if (!i || !o) { console.error('usage: node scripts/shrink-vrm.mjs <in.vrm> <out.vrm>'); process.exit(2); }
  const r = await shrink(i, o);
  console.log(`${i} -> ${o}: ${(r.bytes / 1e6).toFixed(2)} MB -> ${(r.after / 1e6).toFixed(2)} MB, ${r.tris} tris, ${r.images} textures${r.note ? ', ' + r.note : ''}`);
}
