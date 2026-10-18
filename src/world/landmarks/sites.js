// Pure landmark placement: where each dragon-island landmark stands, its colliders, flora keep-out and the race-ring course.
// No three.js, no DOM. planSites(island, avoid, vc) -> { sites, byId, colliders, keepOut, rings, info }.
import { LANDMARKS } from '../island.js';

const hyp = Math.hypot, PI = Math.PI;
export const LANDMARK_INFO = [ // x, z are filled in by planSites (info)
  { id: 'academy', name: 'Dragon Academy', blurb: 'Rookies learn to fly here, and to land, which takes longer.' },
  { id: 'arena', name: 'Stormcrest Arena', blurb: 'An oval of stone where friendly flight races shake the benches.' },
  { id: 'hatchery', name: 'The Hatchery', blurb: 'Warm eggs glow in the nest; please do not knock on them.' },
  { id: 'springs', name: 'Steamwell Springs', blurb: 'Three steaming pools and a tiny bathhouse, the best sore-wing cure on the island.' },
  { id: 'embers', name: 'Cinder Field', blurb: 'Glowing rocks and little vents breathe sparks up toward the volcano.' },
  { id: 'icecave', name: 'Frostglass Cave', blurb: 'A blue-lit tunnel in the ice where the crystals hum when you walk past.' },
  { id: 'tower', name: 'Wizard Tower', blurb: 'A twisting stone spire with a light at the top that never quite sleeps.' },
  { id: 'grove', name: 'Elven Grove', blurb: 'Three pale giants hang lanterns over a quiet altar while petals drift down.' },
  { id: 'rings', name: 'Dragon Race Course', blurb: 'Eight glowing hoops over the meadow: fly through them all in order.' },
];

// Shared footprint numbers (the meshes read the same ones). Local frame: +z faces the village, x is to the right.
export const ARENA = { a: 10, b: 13, segs: 24, thick: 4.2, gateHalf: 2.2 }; // semi-axes along local x and z; the gates are at +-z
export const POOLS = [[-5, -2, 2.6], [5, -2, 2.6], [0, 2.8, 2.3]]; // x, z, rim radius
export const TREES = [60, 180, 300].map((d) => [Math.sin(d * PI / 180) * 6, Math.cos(d * PI / 180) * 6]);
export const ACADEMY = { yard: 8, hallZ: -13, hallW: 15, hallD: 5.6 };
export const EGGS = [[-1.1, 3.1], [0.3, 4.3], [1.4, 3.0], [-0.2, 2.5], [0.9, 3.9], [-1.4, 4.0]];

// footprint radius r, flatness tolerance (m of height range), search radius, trail entry in the local frame
const SPECS = {
  grove: { r: 11, tol: 9, entry: [0, 9.5] },
  academy: { r: 16, tol: 2.8, search: 60, entry: [0, 5] },
  hatchery: { r: 9, tol: 2.4, search: 30, entry: [0, 9] },
  arena: { r: 15, tol: 3.2, search: 45, entry: [0, 17.5] },
  springs: { r: 12, tol: 2.6, search: 24, entry: [0, 8.5] },
  tower: { r: 7, tol: 3.2, search: 24, entry: [0, 8.5] },
  embers: { r: 8, tol: 8, search: 26, entry: [0, 7], minH: 10, maxH: 32 },
  icecave: { r: 5, tol: 7, search: 30, entry: [0, 6.5], minH: 14, maxH: 75, gentle: 1, dw: 0.8 },
};

const toW = (s, lx, lz) => [s.x + lx * Math.cos(s.rot) + lz * Math.sin(s.rot), s.z - lx * Math.sin(s.rot) + lz * Math.cos(s.rot)];
export const EMBER_ROCKS = [[-5, -3, 1.4], [4, -5, 1.6], [6, 2, 1.2], [-3, 5, 1.3], [0, -7, 1.5], [-7, 1, 1.1]];

// The arena wall as chords of the ellipse: midpoint, length, box yaw, and whether the segment is a gate gap.
export function arenaWalls() {
  const { a, b, segs, gateHalf } = ARENA;
  return Array.from({ length: segs }, (_, i) => {
    const t0 = i / segs * 2 * PI, t1 = (i + 1) / segs * 2 * PI, x0 = Math.sin(t0) * a, z0 = Math.cos(t0) * b, x1 = Math.sin(t1) * a, z1 = Math.cos(t1) * b, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    return { t0, t1, mx, mz, len: hyp(x1 - x0, z1 - z0), rot: Math.atan2(-(z1 - z0), x1 - x0), gate: Math.abs(mx) < gateHalf + 1 && Math.abs(mz) > b * 0.9 };
  });
}

// Colliders in the landmark's local frame (same shapes as village.colliders).
export function localColliders(id) {
  const c = [], circ = (x, z, r, type) => c.push({ kind: 'circle', x, z, r, type }), box = (x, z, hw, hd, rot, type) => c.push({ kind: 'box', x, z, hw, hd, rot, type });
  if (id === 'academy') {
    const A = ACADEMY; box(0, A.hallZ, A.hallW / 2, A.hallD / 2, 0, 'hall');
    for (let i = 0; i < 6; i++) { const t = (i + 0.5) / 6 * 2 * PI + 0.5; circ(Math.sin(t) * (A.yard + 0.6), Math.cos(t) * (A.yard + 0.6), 0.3, 'pole'); }
  } else if (id === 'arena') {
    const { a, b, thick, gateHalf } = ARENA;
    for (const w of arenaWalls()) if (!w.gate) box(w.mx, w.mz, w.len / 2 + 0.1, thick / 2, w.rot, 'wall');
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) circ(sx * (gateHalf + 0.5), sz * (b + 0.4), 0.8, 'gate');
  } else if (id === 'hatchery') {
    circ(0, -3, 4.2, 'dome'); circ(0, 3.5, 1.9, 'nest');
    for (let i = 0; i < 14; i++) { const t = i / 14 * 2 * PI; if (Math.cos(t) > 0.8) continue; circ(Math.sin(t) * 5, 3.5 + Math.cos(t) * 5, 0.3, 'fence'); }
  } else if (id === 'springs') {
    POOLS.forEach(([x, z, r]) => circ(x, z, r + 0.3, 'pool')); box(0, -10, 3, 2.3, 0, 'hut');
  } else if (id === 'tower') circ(0, 0, 5.3, 'tower');
  else if (id === 'grove') { TREES.forEach(([x, z]) => circ(x, z, 1.7, 'tree')); box(0, 0, 1.3, 0.8, 0, 'altar'); }
  else if (id === 'icecave') { box(-2.6, -1, 1.5, 3.2, 0, 'ice'); box(2.6, -1, 1.5, 3.2, 0, 'ice'); box(0, -4.6, 3.5, 1, 0, 'ice'); circ(-5, 2, 1.8, 'ice'); circ(5, 2, 1.8, 'ice'); }
  else if (id === 'embers') EMBER_ROCKS.forEach(([x, z, r]) => circ(x, z, r, 'rock'));
  return c;
}

// Best dry, gentle, free spot for a footprint near (tx, tz): flatter and closer wins.
function fit(I, avoid, placed, tx, tz, spec) {
  const { heightAt: H, isWet: Wt } = I, // already memoised on a 1.5 m lattice by plan()
  R = spec.r, s = spec.search || 0;
  let best = null;
  for (let dx = -s; dx <= s; dx += 4.5) for (let dz = -s; dz <= s; dz += 4.5) {
    const x = tx + dx, z = tz + dz, d = hyp(dx, dz);
    if (d > s + 0.1 || (spec.minH && H(x, z) < spec.minH) || (spec.maxH && H(x, z) > spec.maxH) || (spec.gentle && (Math.abs(H(x + 3, z) - H(x - 3, z)) > 1.7 || Math.abs(H(x, z + 3) - H(x, z - 3)) > 1.7)) || placed.some((p) => hyp(p.x - x, p.z - z) < p.r + R + 2)) continue;
    let lo = 1e9, hi = -1e9, bad = false;
    for (let a = 0; a < 8 && !bad; a++) for (const f of [0, 0.5, 1]) {
      const px = x + Math.cos(a * PI / 4) * R * f, pz = z + Math.sin(a * PI / 4) * R * f, h = H(px, pz);
      if (Wt(px, pz) || h < 0.8) { bad = true; break; }
      lo = Math.min(lo, h); hi = Math.max(hi, h);
      if (hi - lo > spec.tol) { bad = true; break; }
    }
    if (bad || hi - lo > spec.tol) continue;
    const sc = (hi - lo) * 0.7 + d * (spec.dw || 0.15);
    if ((!best || sc < best.sc) && !avoid(x, z, R * 0.7)) best = { sc, x, z };
  }
  return best;
}

const memo = new WeakMap(); // paths and the landmark meshes ask with the same village keepOut: plan once
export function planSites(I, avoid = () => false, vc = [-7, 12]) {
  if (memo.has(avoid)) return memo.get(avoid);
  const out = plan(I, avoid, vc);
  memo.set(avoid, out);
  return out;
}
function plan(I0, avoid, vc) {
  const hc = new Map(), wc = new Map(), q = (x) => Math.round(x / 1.5); // the search samples the same lattice points again and again: cache them
  const I = { ...I0, heightAt: (x, z) => { const k = q(x) * 100003 + q(z); let v = hc.get(k); if (v === undefined) hc.set(k, v = I0.heightAt(q(x) * 1.5, q(z) * 1.5)); return v; }, isWet: (x, z) => { const k = q(x) * 100003 + q(z); let v = wc.get(k); if (v === undefined) wc.set(k, v = I0.isWet(q(x) * 1.5, q(z) * 1.5)); return v; } };
  const M = LANDMARKS.mountain, V = LANDMARKS.volcano, toward = (p, k) => { const d = hyp(vc[0] - p.x, vc[1] - p.z); return { x: p.x + (vc[0] - p.x) / d * k, z: p.z + (vc[1] - p.z) / d * k }; };
  const T = { grove: LANDMARKS.grove, academy: { x: -35, z: -2 }, arena: { x: -74, z: -19 }, hatchery: { x: -62, z: -32 }, springs: { x: -45, z: 80 }, tower: LANDMARKS.tower, embers: toward(V, 38), icecave: { x: M.x - 48, z: M.z + 24 } };
  const sites = [];
  for (const id of ['grove', 'arena', 'hatchery', 'academy', 'springs', 'tower', 'embers', 'icecave']) {
    const sp = SPECS[id], t = T[id], f = fit(I, avoid, sites, t.x, t.z, sp) || fit(I, avoid, sites, t.x, t.z, { ...sp, search: (sp.search || 6) + 24, tol: sp.tol * 1.6 });
    if (!f) throw new Error('landmarks: no site for ' + id);
    sites.push({ id, x: f.x, z: f.z, r: sp.r, rot: Math.atan2(vc[0] - f.x, vc[1] - f.z) }); // every landmark faces the village
  }
  for (const s of sites) {
    [s.ex, s.ez] = toW(s, ...SPECS[s.id].entry);
    s.colliders = localColliders(s.id).map((c) => { const [x, z] = toW(s, c.x, c.z); return c.kind === 'box' ? { ...c, x, z, rot: c.rot + s.rot } : { ...c, x, z }; });
  }
  const byId = Object.fromEntries(sites.map((s) => [s.id, s])), ac = byId.academy;
  const keepOut = (x, z, r = 0) => sites.some((s) => hyp(x - s.x, z - s.z) < s.r + 1.5 + r);
  let rings = null; // the loop nearest the academy/village midpoint whose rings clear every roof and landmark
  const mid = { x: (ac.x + vc[0]) / 2, z: (ac.z + vc[1]) / 2 }, cands = [];
  for (let dx = -90; dx <= 90; dx += 6) for (let dz = -90; dz <= 90; dz += 6) cands.push([dx, dz]);
  cands.sort((p, q) => hyp(...p) - hyp(...q));
  for (const [dx, dz] of cands) {
    const r = raceCourse(I.heightAt, { x: mid.x + dx, z: mid.z + dz });
    if (r.every((q) => !avoid(q.x, q.z, 5) && !keepOut(q.x, q.z, 4) && !I.isWet(q.x, q.z) && I.heightAt(q.x, q.z) > 2.5)) { rings = r; break; }
  }
  if (!rings) throw new Error('landmarks: no room for the race rings');
  const rc = { x: rings.reduce((a, q) => a + q.x, 0) / rings.length, z: rings.reduce((a, q) => a + q.z, 0) / rings.length };
  const info = LANDMARK_INFO.map((o) => { const s = byId[o.id] || rc; return { ...o, x: Math.round(s.x), z: Math.round(s.z) }; });
  return { sites, byId, colliders: sites.flatMap((s) => s.colliders), keepOut, rings, info };
}

// Eight rings in a gently wavy loop: { x, y, z, nx, nz }, (nx, nz) = flight direction through the ring, radius RING_R.
export const RING_R = 3.2;
export function raceCourse(H, c, n = 8, rad = 18) {
  const pts = Array.from({ length: n }, (_, i) => { const t = i / n * 2 * PI; return { x: c.x + Math.cos(t) * rad * 1.15, z: c.z + Math.sin(t) * rad * 0.8 }; });
  return pts.map((p, i) => {
    const q = pts[(i + 1) % n], d = hyp(q.x - p.x, q.z - p.z);
    return { x: p.x, z: p.z, y: Math.max(H(p.x, p.z), H(p.x + 4, p.z), H(p.x - 4, p.z), H(p.x, p.z + 4), H(p.x, p.z - 4)) + 5.5 + 1.8 * Math.sin(i * 1.7), nx: (q.x - p.x) / d, nz: (q.z - p.z) / d };
  });
}

// Which rings did a move from a to b (each {x, y, z}) fly through? Indices of rings whose plane the segment crosses within radius r.
export function ringsPassed(a, b, rings, r = RING_R) {
  const out = [];
  rings.forEach((q, i) => {
    const da = (a.x - q.x) * q.nx + (a.z - q.z) * q.nz, db = (b.x - q.x) * q.nx + (b.z - q.z) * q.nz;
    if (da * db >= 0) return; // same side (or touching): no crossing
    const t = da / (da - db);
    if (hyp(a.x + (b.x - a.x) * t - q.x, a.y + (b.y - a.y) * t - q.y, a.z + (b.z - a.z) * t - q.z) <= r) out.push(i);
  });
  return out;
}
