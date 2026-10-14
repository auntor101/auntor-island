// Pure helpers: read the JSON chunk of a GLB/VRM buffer and its VRM licence metadata (parse only, nothing executed).
export function readGlb(buf) {
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB');
  let off = 12, json = null, bin = null;
  while (off < buf.length) {
    const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4), body = buf.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(body.toString('utf8'));
    else if (type === 0x004e4942) bin = body;
    off += 8 + len;
  }
  if (!json) throw new Error('GLB has no JSON chunk');
  return { json, bin };
}

export function vrmMeta(buf) {
  const ext = readGlb(buf).json.extensions || {};
  if (ext.VRMC_vrm) return { ...ext.VRMC_vrm.meta, version: 1 };
  if (ext.VRM) return { ...ext.VRM.meta, version: 0 };
  throw new Error('no VRM extension');
}

// VRM0: CC0 only. VRM1: everyone may use, modify and redistribute.
export function licenceOk(m) {
  if (m.version === 0) return m.licenseName === 'CC0';
  return m.avatarPermission === 'everyone' && (m.modification === 'allowModification' || m.modification === 'allowModificationRedistribution') && m.allowRedistribution === true;
}

export const licenceLabel = (m) => m.version === 0
  ? `VRM0 licenseName=${m.licenseName}`
  : `VRM1 avatarPermission=${m.avatarPermission} modification=${m.modification} redistribution=${m.allowRedistribution} credit=${m.creditNotation || '-'} url=${m.licenseUrl || '-'}`;
