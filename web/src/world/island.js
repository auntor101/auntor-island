// Pure island shape. Metres; +x east, -z north; y = 0 is the sea surface.
const PI = Math.PI;
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
// Gaussian bump on the angle (wrapped).
const ang = (t, c, s) => { const d = Math.atan2(Math.sin(t - c), Math.cos(t - c)); return Math.exp(-d * d / (2 * s * s)); };

const T_TOWER = -0.75, T_WEST = PI, T_COVE = PI / 2;
const MOUNTAIN = { x: -10, z: -108 }, VOLCANO = { x: 98, z: 8 };

export function coastRadius(t) {
  const r = 150 * (1 + 0.11 * (0.5 * Math.sin(2 * t + 1) + 0.3 * Math.sin(3 * t + 2) + 0.2 * Math.sin(5 * t)));
  return r + 6 * ang(t, T_TOWER, 0.18) - 38 * ang(t, T_COVE, 0.12);
}

const hills = (x, z) => 3 * Math.sin(x * 0.04 + 1.3) * Math.cos(z * 0.05 + 0.7) + 1.5 * Math.sin((x + z) * 0.09 + 2);
const woods = (x, z) => Math.sin(x * 0.07) * Math.sin(z * 0.06 + 2) + 0.5 * Math.sin((x - z) * 0.11);

const GROVE = { x: -72, z: -30 }, T_BEACH = 2.4;

// Land height before the coast mask; features first, then flat areas override them.
function inland(x, z, r, t, R) {
  let H = 5 + hills(x, z);
  let dx = x - MOUNTAIN.x, dz = z - MOUNTAIN.z;
  H += 100 * Math.exp(-(dx * dx + dz * dz) / (2 * 38 * 38));
  dx = x - VOLCANO.x; dz = z - VOLCANO.z;
  const q = dx * dx + dz * dz;
  H += 70 * Math.exp(-q / (38 * 38)) - 24 * Math.exp(-q / 100);
  H += 26 * ang(t, T_WEST, 0.55) * smooth(R * 0.55, R, r);
  H += 18 * ang(t, T_TOWER, 0.25) * smooth(R * 0.5, R, r);
  H = mix(H, 3, 1 - smooth(22, 70, r));
  dx = x - GROVE.x; dz = z - GROVE.z;
  H = mix(H, 6, 1 - smooth(18, 42, Math.hypot(dx, dz)));
  return mix(H, 2.5, ang(t, T_BEACH, 0.28) * smooth(R * 0.55, R, r));
}

let stacks = [];
export function heightAt(x, z) {
  let h = baseHeight(x, z);
  for (const s of stacks) {
    const dx = x - s.x, dz = z - s.z, q = dx * dx + dz * dz;
    if (q < 144) h += s.a * Math.exp(-q / 18);
  }
  return h;
}

function baseHeight(x, z) {
  const r = Math.hypot(x, z), t = Math.atan2(z, x), R = coastRadius(t);
  const d = R - r;
  // shore width: gentle everywhere, short on the west cliffs and the tower headland
  const w = 35 - 31 * ang(t, T_WEST, 0.4) - 12 * ang(t, T_TOWER, 0.25);
  if (d <= 0) return -12 * (1 - Math.exp(d / w));
  return inland(x, z, r, t, R) * smooth(0, w, d);
}

const at = (t, inset) => { const r = coastRadius(t) - inset; return { x: r * Math.cos(t), z: r * Math.sin(t) }; };
export const LANDMARKS = {
  village: { x: 0, z: 0 },
  spawn: { x: 8, z: 6 },
  mountain: { x: -10, z: -78 },
  volcano: VOLCANO,
  roost: at(T_WEST + 0.05, 7),
  beach: at(T_BEACH, 10),
  tower: at(T_TOWER, 16),
  grove: GROVE,
  cove: at(T_COVE, 7),
};

// Offshore rocks: angle, metres beyond the coast, height.
export const SEA_STACKS = [[0.35, 22, 14], [1.0, 24, 10], [2.0, 22, 22], [2.9, 22, 12], [3.9, 20, 26], [4.9, 24, 9], [5.7, 22, 18]].map(([t, out, h]) => {
  const p = at(t, -out);
  return { x: p.x, z: p.z, h };
});
stacks = SEA_STACKS.map((s) => ({ x: s.x, z: s.z, a: s.h - baseHeight(s.x, s.z) }));

const inDisc = (x, z, p, rad) => (x - p.x) ** 2 + (z - p.z) ** 2 < rad * rad;
export function zoneAt(x, z) {
  const h = heightAt(x, z);
  if (h <= 0) return 'sea';
  if (inDisc(x, z, LANDMARKS.cove, 16) && h < 3) return 'cove';
  if (inDisc(x, z, LANDMARKS.tower, 16)) return 'tower';
  if (h > 88 && inDisc(x, z, MOUNTAIN, 60)) return 'glacier';
  if (inDisc(x, z, VOLCANO, 30)) return 'volcano';
  if (inDisc(x, z, MOUNTAIN, 55) && h > 30) return 'mountain';
  const r = Math.hypot(x, z), t = Math.atan2(z, x);
  if (h > 14 && ang(t, T_WEST, 0.3) > 0.6 && r > coastRadius(t) * 0.6) return 'roost';
  if (inDisc(x, z, GROVE, 24)) return 'grove';
  if (r < 35) return 'village';
  if (h < 1) return 'beach';
  return woods(x, z) > 0.3 ? 'forest' : 'meadow';
}
