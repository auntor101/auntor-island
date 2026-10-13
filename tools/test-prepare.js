// Checks the asset tool rejects malformed input. Needs nothing from assets-src.
const assert = require('assert');
const P = require('./prepare-assets.js');
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47]), Buffer.alloc(8)]);

function model(over) {
  const bin = Buffer.concat([png, Buffer.alloc(12)]);
  const json = {
    asset: { version: '2.0' },
    materials: [{ name: 'Good_Mat', pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
    textures: [{ source: 0 }], images: [{ bufferView: 0, mimeType: 'image/png' }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: png.length }, { buffer: 0, byteOffset: png.length, byteLength: 12 }],
    accessors: [{ bufferView: 1, componentType: 5126, count: 1, type: 'VEC3' }],
    buffers: [{ byteLength: bin.length }],
  };
  return over(json) || json, { json, bin };
}

// round trip of a good model
const ok = model(() => {});
const rt = P.parseGLB(P.writeGLB(ok.json, ok.bin), 'ok');
assert.strictEqual(Object.keys(P.stripImages(rt.json, rt.bin).textures).join(), 'Good_Mat');

assert.throws(() => { const m = model(j => { j.materials[0].name = '../x'; }); P.stripImages(m.json, m.bin); }, /bad material name/);
assert.throws(() => { const m = model(j => { j.accessors[0].sparse = { count: 1 }; }); P.stripImages(m.json, m.bin); }, /sparse/);
assert.throws(() => { const m = model(j => { j.images = [{ uri: 'x.png' }]; }); P.stripImages(m.json, m.bin); }, /uri|bufferView/);
assert.throws(() => { const m = model(j => { j.bufferViews[1].byteLength = 9999; }); P.stripImages(m.json, m.bin); }, /exceeds/);
assert.throws(() => { const m = model(j => { j.accessors[0].bufferView = 0; }); P.stripImages(m.json, m.bin); }, /removed or missing/);
assert.throws(() => { const m = model(() => {}); m.bin.writeUInt8(0, 0); P.stripImages(m.json, m.bin); }, /not a PNG/);

const good = P.writeGLB(ok.json, ok.bin);
assert.throws(() => P.parseGLB(Buffer.concat([good, Buffer.alloc(4)]), 't'), /length/);
const badMagic = Buffer.from(good); badMagic.writeUInt32LE(0, 0);
assert.throws(() => P.parseGLB(badMagic, 't'), /magic/);
const badBin = Buffer.from(good); badBin.writeUInt32LE(0, 20 + badBin.readUInt32LE(12) + 4);
assert.throws(() => P.parseGLB(badBin, 't'), /BIN/);
console.log('prepare tests ok');
