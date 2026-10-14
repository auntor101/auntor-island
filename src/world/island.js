// Pure island shape. Metres; +x east, -z north; y = 0 is the sea surface.
const PI = Math.PI;
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
// Gaussian bump on the angle (wrapped).
const ang = (t, c, s) => { const d = Math.atan2(Math.sin(t - c), Math.cos(t - c)); return Math.exp(-d * d / (2 * s * s)); };
// Cheap deterministic wobble in [-1, 1] (no tables, so the worker and the tests agree).
const wob = (x, z) => Math.sin(x * 0.21 + 2 * Math.sin(z * 0.17)) * Math.sin(z * 0.23 + 2 * Math.sin(x * 0.19));

// ---- Water contract (shared by terrain, water, flora, village, life, paths) ----
export const LAKE = { x: -5, z: -42, r: 24, level: 4 }; // a lake in the heart of the island, between the village and the mountain
export const RIVERS = [
  // glacier meltwater: mountain flank, down the falls, into the lake's north shore
  { name: 'meltwater', width: 4, pts: [[-12, -92], [-9, -80], [-7, -70], [-6, -64]] },
  // outflow: lake south shore, past the village's east side, to the cove on the south coast
  { name: 'outflow', width: 4, pts: [[-3, -20], [6, -4], [20, 12], [26, 40], [24, 70], [18, 100]] },
];
export const FALLS = [{ x: -7, z: -70, drop: 12 }]; // the waterfall where the meltwater drops into the lake

const T_TOWER = -0.75, T_WEST = PI, T_COVE = PI / 2;
const MOUNTAIN = { x: -10, z: -108 }, VOLCANO = { x: 98, z: 8 };

export function coastRadius(t) {
  const r = 150 * (1 + 0.11 * (0.5 * Math.sin(2 * t + 1) + 0.3 * Math.sin(3 * t + 2) + 0.2 * Math.sin(5 * t)));
  return r + 6 * ang(t, T_TOWER, 0.18) - 38 * ang(t, T_COVE, 0.12);
}

const hills = (x, z) => 3 * Math.sin(x * 0.04 + 1.3) * Math.cos(z * 0.05 + 0.7) + 1.5 * Math.sin((x + z) * 0.09 + 2);
export const woods = (x, z) => Math.sin(x * 0.07) * Math.sin(z * 0.06 + 2) + 0.5 * Math.sin((x - z) * 0.11);

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

// Land plus coast, before fresh water and ledges. The west and tower coasts rise over a wider strip so ledges fit.
function baseHeight(x, z) {
  const r = Math.hypot(x, z), t = Math.atan2(z, x), R = coastRadius(t);
  const d = R - r;
  if (d <= 0) return -12 * (1 - Math.exp(d / (35 - 31 * ang(t, T_WEST, 0.4) - 12 * ang(t, T_TOWER, 0.25)))); // plunges into the sea
  const w = 35 - 11 * ang(t, T_WEST, 0.4) - 21 * ang(t, T_TOWER, 0.3);
  return inland(x, z, r, t, R) * (0.6 * smooth(0, w, d) + 0.4 * Math.min(1, d / w));
}

// ---- Lake: irregular shoreline (mean radius LAKE.r), shallow wadeable rim, deep middle, headwall on the north ----
const lakeR = (t) => LAKE.r * (1 + 0.12 * Math.sin(2 * t + 0.7) + 0.08 * Math.sin(3 * t + 2.1) + 0.05 * Math.sin(5 * t + 4));
const LAKE_DEPTH = 3.6; // bed at the centre is level - 3.6 = 0.4, so it never counts as sea
const WALL = 13;

// Shelf round the lake; on the north the mountain is cut back to a headwall (slope ~1.1) with a sheer cliff by the falls.
function lakeBank(x, z, h) {
  const dx = x - LAKE.x, dz = z - LAKE.z, d = Math.hypot(dx, dz);
  if (d > 90) return h;
  const out = d - lakeR(Math.atan2(dz, dx)), n = smooth(-0.1, 0.6, -dz / (d || 1));
  if (out < -3) return h;
  const T = LAKE.level + 0.35 + Math.max(0, out) * (0.1 + 1.1 * n);
  const g = h + (T - h) * (1 - smooth(3 + 11 * n, 26 + 24 * n, out));
  const wall = 1 - smooth(10, 24, Math.abs(x - FALLS[0].x));
  return Math.max(g, LAKE.level + WALL * wall * n * smooth(0, 3.5, out) * (1 - smooth(14, 30, out)));
}

// ---- Rivers ----
const geo = RIVERS.map((rv) => {
  const seg = [], cum = [0];
  for (let i = 0; i < rv.pts.length - 1; i++) { seg.push(Math.hypot(rv.pts[i + 1][0] - rv.pts[i][0], rv.pts[i + 1][1] - rv.pts[i][1])); cum.push(cum[i] + seg[i]); }
  const xs = rv.pts.map((p) => p[0]), zs = rv.pts.map((p) => p[1]);
  return { pts: rv.pts, hw: rv.width / 2, seg, cum, len: cum[cum.length - 1], box: [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)] };
});
let RS = 0; // arc length of the nearest point, set by nearest()
function nearest(g, x, z) {
  let best = Infinity;
  for (let i = 0; i < g.pts.length - 1; i++) {
    const a = g.pts[i], b = g.pts[i + 1], ex = b[0] - a[0], ez = b[1] - a[1];
    const u = Math.min(1, Math.max(0, ((x - a[0]) * ex + (z - a[1]) * ez) / (ex * ex + ez * ez)));
    const q = Math.hypot(x - a[0] - u * ex, z - a[1] - u * ez);
    if (q < best) { best = q; RS = g.cum[i] + u * g.seg[i]; }
  }
  return best;
}
const MELT = geo[0], OUT = geo[1];
const S_LIP = (() => { nearest(MELT, FALLS[0].x, FALLS[0].z); return RS; })();
const FACE = 3.2, LIP = LAKE.level + FALLS[0].drop;
const POOL_BED = LAKE.level - 2.2;
const FORD = [[10, 4], [OUT.len * 0.55, 5]]; // a shallow riffle per river: the bed rises to 0.25 m under the surface
const ford = (i, s) => 0.75 * Math.exp(-(((s - FORD[i][0]) / FORD[i][1]) ** 2));

// Outflow water level, sampled every 3 m: follows the ground down (0.45 under it), never rises, eases to the sea.
let outLv = null;
function outLevels() {
  const n = Math.ceil(OUT.len / 3), lv = [];
  let m = LAKE.level - 0.25;
  for (let i = 0; i <= n; i++) {
    const s = Math.min(OUT.len, i * 3);
    let k = 0; while (k < OUT.seg.length - 1 && OUT.cum[k + 1] < s) k++;
    const u = (s - OUT.cum[k]) / OUT.seg[k], a = OUT.pts[k], b = OUT.pts[k + 1];
    m = Math.min(m, ground(mix(a[0], b[0], u), mix(a[1], b[1], u)) - 0.45);
    lv.push(m);
  }
  for (let p = 0; p < 4; p++) {
    for (let i = 1; i < n; i++) lv[i] = (lv[i - 1] + 2 * lv[i] + lv[i + 1]) / 4;
    for (let i = 1; i <= n; i++) lv[i] = Math.min(lv[i], lv[i - 1]);
  }
  const t0 = Math.floor(n * 0.7);
  for (let i = t0; i <= n; i++) lv[i] = Math.min(lv[i], mix(lv[t0], 0.05, (i - t0) / (n - t0)));
  return lv;
}
let BED = 0, LVL = 0; // bed and water level of river i at arc length s
function profile(i, s) {
  if (i === 0) {
    if (s <= S_LIP) { LVL = LIP + 0.3 * (S_LIP - s); BED = LVL - 1 + ford(0, s); return; }
    BED = mix(LIP - 1, POOL_BED, smooth(S_LIP, S_LIP + FACE, s)); LVL = Math.max(BED + 1, LAKE.level); return; // falling sheet, then the pool
  }
  outLv ||= outLevels();
  const f = Math.min(outLv.length - 1.001, s / 3), k = Math.floor(f);
  LVL = mix(outLv[k], outLv[k + 1], f - k); BED = LVL - 1 + ford(1, s) + 0.6 * (1 - smooth(2, 12, s)); // shallow at the lake outlet
}
const near = (g, x, z, m) => x > g.box[0] - m && x < g.box[1] + m && z > g.box[2] - m && z < g.box[3] + m;
function carve(h, x, z) {
  for (let i = 0; i < 2; i++) {
    const g = geo[i];
    if (!near(g, x, z, 30)) continue;
    const d = nearest(g, x, z);
    if (i === 0 && RS > S_LIP + FACE) continue; // the pool belongs to the lake
    profile(i, RS);
    const bed = BED, L = LVL, hw = g.hw;
    const bw = i === 0 ? Math.min(14, 2.5 + 0.35 * Math.max(0, h - bed)) : 6.5; // gorge walls vs soft village banks
    if (d > hw + 1.2 + bw) continue;
    if (d <= hw) h = bed;
    else if (d <= hw + 1.2) h = mix(bed, L + 0.1, smooth(0, 1.2, d - hw));
    else { const t = smooth(0, bw, d - hw - 1.2); h = mix(L + 0.1, h + Math.max(0, L + 0.35 - h) * (1 - t), t); } // banks: levee up to 0.35 m over the water, fading out
  }
  return h;
}

// ---- Ledges: flat treads 2 to 4 m wide about every 5 m of height, wobbled so they are not contour lines ----
function cliffs(x, z) {
  const r = Math.hypot(x, z), t = Math.atan2(z, x), d = coastRadius(t) - r;
  let c = ang(t, T_WEST, 0.45) * (1 - smooth(22, 30, d)) + ang(t, T_TOWER, 0.4) * (1 - smooth(14, 22, d));
  const dx = x - LAKE.x, dz = z - LAKE.z, dl = Math.hypot(dx, dz);
  if (dl < 90) c += 1.5 * smooth(-0.1, 0.5, -dz / (dl || 1)) * (1 - smooth(8, 40, dl - lakeR(Math.atan2(dz, dx)))) * (1 - smooth(10, 30, Math.abs(x - FALLS[0].x)));
  if (z < -55 && z > -125 && Math.abs(x + 10) < 50) c += 1 - smooth(4, 26, nearest(MELT, x, z)); // gorge walls
  return Math.min(1, c);
}
function ledges(x, z, h) {
  if (h < 1) return h;
  const c = cliffs(x, z);
  if (c < 0.02) return h;
  const P = 5 + 0.9 * Math.sin(0.045 * x + 0.031 * z + 1), n = 1.6 * wob(x * 0.5, z * 0.5), t = (h + n) / P, i = Math.floor(t);
  return h + (P * (i + smooth(0.55, 1, t - i)) - n - h) * c;
}

const ground = (x, z) => ledges(x, z, lakeBank(x, z, baseHeight(x, z)));

let stacks = [];
function shaped(x, z) {
  let h = ground(x, z);
  const dx = x - LAKE.x, dz = z - LAKE.z, u = Math.hypot(dx, dz) / lakeR(Math.atan2(dz, dx));
  if (u < 1) h = Math.min(h, LAKE.level - LAKE_DEPTH * smooth(1, 0, u));
  return carve(h, x, z);
}
export function heightAt(x, z) {
  let h = shaped(x, z);
  for (const s of stacks) {
    const dx = x - s.x, dz = z - s.z, q = dx * dx + dz * dz;
    if (q < 144) h += s.a * Math.exp(-q / 18);
  }
  return h;
}

const at = (t, inset) => { const r = coastRadius(t) - inset; return { x: r * Math.cos(t), z: r * Math.sin(t) }; };
export const LANDMARKS = {
  village: { x: 0, z: 0 },
  spawn: { x: 8, z: 6 },
  mountain: { x: -40, z: -98 }, // was (-10,-78): the meltwater gorge now runs through that spot
  volcano: VOLCANO,
  roost: at(T_WEST + 0.05, 18), // on the cliff top, inland of the first ledges
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

// Height of the water surface covering (x, z): 0 for the sea, LAKE.level for the lake, the river's own level
// for rivers (a falling sheet at the falls); null on dry land. isWet is the quick yes/no.
let kind = 'sea';
function water(x, z, h) {
  const dx = x - LAKE.x, dz = z - LAKE.z;
  if (dx * dx + dz * dz < 1600 && Math.hypot(dx, dz) < lakeR(Math.atan2(dz, dx)) && h < LAKE.level) { kind = 'lake'; return LAKE.level; }
  for (let i = 0; i < 2; i++) {
    const g = geo[i];
    if (!near(g, x, z, 5) || nearest(g, x, z) > g.hw + 1.4) continue;
    profile(i, RS);
    if (h < LVL) { kind = 'river'; return LVL; }
  }
  if (h < 0) { kind = 'sea'; return 0; }
  return null;
}
export const waterSurfaceAt = (x, z) => water(x, z, heightAt(x, z));
export const isWet = (x, z) => waterSurfaceAt(x, z) !== null;

const inDisc = (x, z, p, rad) => (x - p.x) ** 2 + (z - p.z) ** 2 < rad * rad;
export function zoneAt(x, z) {
  const h = heightAt(x, z);
  if (water(x, z, h) !== null) return kind;
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
