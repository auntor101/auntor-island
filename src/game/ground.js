// What the player stands on, for footstep sounds. Cheap enough to call once per step.
const dseg = (px, pz, a, b) => {
  const dx = b[0] - a[0], dz = b[1] - a[1], l = dx * dx + dz * dz, t = l ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / l)) : 0;
  return Math.hypot(px - a[0] - t * dx, pz - a[1] - t * dz);
};
export function groundType(x, z, zone, snow, village) {
  if (snow > 0.5) return 'snow';
  const d = village.layout.dock;
  if (d && Math.abs(x - d.x) < d.width / 2 + 0.3 && z > Math.min(d.z0, d.z1) && z < Math.max(d.z0, d.z1) && zone !== 'sea') return 'wood';
  if (zone === 'village') {
    const c = village.layout.center;
    if (Math.hypot(x - c[0], z - c[1]) < 9) return 'stone';
    for (const r of village.roads) { const p = r.pts; for (let i = 1; i < p.length; i++) if (dseg(x, z, p[i - 1], p[i]) < r.width / 2) return r.kind === 'cobble' ? 'stone' : 'dirt'; }
  }
  if (zone === 'beach' || zone === 'cove') return 'sand';
  if (zone === 'mountain' || zone === 'glacier' || zone === 'volcano' || zone === 'roost' || zone === 'tower') return 'stone';
  return 'grass';
}
