// One-off: pull each VRM's embedded thumbnail out as public/models/<id>.jpg (256 px). Run: node scripts/make-portraits.mjs
// The wizard shares the man's model (same thumbnail), so its portrait comes from a render instead (see the task report).
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { readGlb } from './vrm-meta.mjs';
const sharp = createRequire(import.meta.url)('../node_modules/sharp');

for (const id of process.argv.slice(2).length ? process.argv.slice(2) : ['man', 'woman', 'elf']) {
  const { json, bin } = readGlb(readFileSync(`public/models/${id}.vrm`));
  const v1 = json.extensions.VRMC_vrm?.meta?.thumbnailImage;
  const tex = v1 ?? json.extensions.VRM?.meta?.texture;
  const img = v1 != null ? json.images[tex] : json.images[json.textures[tex].source];
  const bv = json.bufferViews[img.bufferView], raw = bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
  const meta = await sharp(raw).metadata();
  const out = await sharp(raw).resize(256, 256, { fit: 'cover' }).jpeg({ quality: 82 }).toBuffer();
  writeFileSync(`public/models/${id}.jpg`, out);
  console.log(id, `${meta.width}x${meta.height}`, '->', out.length, 'bytes');
}
