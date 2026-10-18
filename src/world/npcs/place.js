// Pure placement: where each NPC stands (a free, dry spot near its target) and which way it faces.
import { toWorld } from '../village/layout.js';
import { clear } from '../../game/companion-ui.js';

export const NPC_R = 0.45; // collider radius

export function planNpcs(defs, village, heightAt, isWet) {
  const L = village.layout, [cx, cz] = L.center, out = [];
  const freeAt = (x, z) => !isWet(x, z) && heightAt(x, z) > 0.4 && village.colliders.every((c) => clear(c, x, z, NPC_R + 0.5)) && out.every((o) => Math.hypot(o.x - x, o.z - z) > 1.4);
  const nudge = (x, z) => { // spiral out from the target to the first free spot
    for (let r = 0; r <= 5; r += 0.6) for (let k = 0, n = r ? Math.round(r * 6) : 1; k < n; k++) {
      const a = (k / n) * 6.283, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (freeAt(px, pz)) return [px, pz];
    }
    return [x, z];
  };
  for (const d of defs) {
    const s = d.spot; let x, z, yaw = null;
    if (s.at === 'square') { const a = s.a * Math.PI / 180; x = cx + Math.cos(a) * s.r; z = cz + Math.sin(a) * s.r; }
    else if (s.at === 'venue' || s.at === 'theatre') {
      const f = L.buildings.find((b) => (s.at === 'venue' ? b.venue === s.v : b.type === 'theatre'));
      if (!f) throw new Error('npc spot missing: ' + (s.v || s.at));
      [x, z] = toWorld(f, s.lx || 0, f.d / 2 + (s.at === 'venue' ? 1.1 : 2.4)); yaw = f.rot; // the shop front faces +local z
    } else { const a = village.anchors[s.k]; x = a.x + (s.dx || 0); z = a.z + (s.dz || 0); }
    [x, z] = nudge(x, z);
    out.push({ def: d, x, z, y: heightAt(x, z), yaw: yaw ?? Math.atan2(cx - x, cz - z) });
  }
  return out;
}
