// Props, dock and longship. All return a P in a local frame (y = 0 on the ground / waterline) unless noted. No DOM access.
import { CylinderGeometry, LatheGeometry, Vector2, ExtrudeGeometry, Shape } from 'three';
import { P, box, boxC, beam, addGeo, mat } from './geom.js';
import { TILE as T } from './atlas.js';
import { roof, lantern, barrel, dragonGeo, WARM, WARM2 } from './parts.js';
import { rng } from './rng.js';

const lathe = (pts, seg) => new LatheGeometry(pts.map(([r, h]) => new Vector2(r, h)), seg);

export function makeWell() {
  const p = new P(), m = p.m;
  addGeo(m, lathe([[0.7, 0], [1.15, 0], [1.2, 0.95], [0.85, 0.95], [0.7, 0.9]], 12), mat(), { tile: T.stone, us: 0.9, h: 0.95, ao: 0.6 });
  addGeo(m, new CylinderGeometry(0.85, 0.85, 0.02, 12), mat(0, 0.45, 0), { tile: T.beam, col: 0x203050 });
  for (const s of [-1, 1]) box(m, s * 1.0 - 0.09, 0, -0.09, s * 1.0 + 0.09, 2.5, 0.09, { tile: T.beam });
  box(m, -1.05, 2.1, -0.07, 1.05, 2.3, 0.07, { tile: T.beam });
  addGeo(m, new CylinderGeometry(0.06, 0.06, 2.1, 6), mat(0, 2.2, 0, 0, Math.PI / 2), { tile: T.beam });
  addGeo(m, new CylinderGeometry(0.17, 0.14, 0.26, 7), mat(0.35, 1.2, 0), { tile: T.planksV, col: 0xd0b090 });
  beam(m, [0.35, 2.15, 0], [0.35, 1.34, 0], 0.025, { tile: T.beam });
  roof(p, { len: 1.9, wid: 2.1, y: 2.45, pitch: 0.85, th: 0.1, tile: T.shingle, col: 0xd8a070, us: 1, oe: 0.3, og: 0.3, noTails: true });
  return p;
}
export function makeLanternPost() {
  const p = new P();
  box(p.m, -0.07, 0, -0.07, 0.07, 2.9, 0.07, { tile: T.beam, ao: 0.8 }); box(p.m, -0.14, 0, -0.14, 0.14, 0.3, 0.14, { tile: T.stone });
  box(p.m, -0.04, 2.5, 0, 0.04, 2.6, 0.55, { tile: T.beam }); beam(p.m, [0, 2.2, 0], [0, 2.55, 0.45], 0.04, { tile: T.beam });
  lantern(p, { x: 0, y: 2.55, z: 0.5, hook: false, lit: WARM });
  return p;
}
export function makeSignboard(idx = 0) { // freestanding sign on two posts
  const p = new P(), u0 = (idx % 4) / 4, v1 = 1 - Math.floor(idx / 4) / 3;
  for (const s of [-1, 1]) box(p.m, s * 0.7 - 0.06, 0, -0.06, s * 0.7 + 0.06, 1.8, 0.06, { tile: T.beam });
  p.s.quad([-0.65, 0.8, 0.08], [0.65, 0.8, 0.08], [0.65, 1.7, 0.08], [-0.65, 1.7, 0.08], { uv: [[u0, v1 - 1 / 3], [u0 + 0.25, v1 - 1 / 3], [u0 + 0.25, v1], [u0, v1]] });
  return p;
}
export function makeHaystack(seed = 1) { const p = new P(), r = rng(seed); addGeo(p.m, lathe([[0, 0], [0.95, 0], [1.2, 0.3], [1.05, 0.85], [0.65, 1.35], [0.2, 1.75], [0, 1.85]], 10), mat(0, 0, 0, r() * 6, 0, 0, 0.85 + r() * 0.3), { tile: T.thatch, col: 0xfff0b0, us: 1.2, h: 1.6, ao: 0.7 }); return p; }
export function makeWoodpile(seed = 1) {
  const p = new P(), r = rng(seed);
  for (let row = 0; row < 3; row++) for (let i = 0; i < 4 - row; i++) addGeo(p.m, new CylinderGeometry(0.15, 0.15, 1.5, 6), mat((i - (3 - row) / 2 + 0.5) * 0.31, 0.15 + row * 0.27, 0, r() * 0.2, Math.PI / 2), { tile: T.planksV, col: 0xe0b888, us: 0.6, h: 0.9, ao: 0.75 });
  return p;
}
export function makeRack(seed = 1) { // fish drying rack: two A-frames, rails, hung fish
  const p = new P(), r = rng(seed);
  for (const s of [-1, 1]) { beam(p.m, [s * 1.4, 0, -0.5], [s * 1.4, 2, 0], 0.1, { tile: T.beam }); beam(p.m, [s * 1.4, 0, 0.5], [s * 1.4, 2, 0], 0.1, { tile: T.beam }); }
  for (const y of [1.9, 1.35]) box(p.m, -1.55, y, -0.04, 1.55, y + 0.07, 0.04, { tile: T.beam });
  for (let row = 0; row < 2; row++) for (let i = 0; i < 7; i++) {
    const x = -1.2 + i * 0.4 + r() * 0.08, y = row ? 1.35 : 1.9, f = { col: [0.75, 0.85, 0.92], tile: T.net, us: 0.5, vs: 0.5 };
    p.m.quad([x, y - 0.5, 0], [x + 0.1, y - 0.5, 0], [x + 0.14, y - 0.2, 0], [x - 0.04, y - 0.2, 0], f); p.m.quad([x + 0.1, y - 0.5, 0], [x, y - 0.5, 0], [x - 0.04, y - 0.2, 0], [x + 0.14, y - 0.2, 0], f);
  }
  return p;
}
export function makeCrate(b, x, y, z, s = 0.6) { box(b, x - s / 2, y, z - s / 2, x + s / 2, y + s, z + s / 2, { tile: T.planksH, col: 0xe8c898, ao: 0.7, us: 0.6, vs: 0.6 }); for (const [a, c] of [[-1, 1], [1, 1]]) box(b, x + a * s / 2 - 0.03, y, z - s / 2 - 0.01, x + a * s / 2 + 0.03, y + s + 0.01, z + s / 2 + 0.01, { tile: T.beam }); }
export function makeBarrel() { const p = new P(); barrel(p.m, 0, 0, 0); return p; }
export function makeCrates() { const p = new P(); makeCrate(p.m, 0, 0, 0); makeCrate(p.m, 0.7, 0, 0.1, 0.5); makeCrate(p.m, 0.2, 0.6, 0, 0.45); return p; }
export function makeCart() {
  const p = new P();
  box(p.m, -1.0, 0.55, -0.6, 1.0, 0.7, 0.6, { tile: T.planksH, col: 0xe0c090 });
  for (const [x0, z0, x1, z1] of [[-1, -0.6, 1, -0.5], [-1, 0.5, 1, 0.6], [-1, -0.6, -0.9, 0.6], [0.9, -0.6, 1, 0.6]]) box(p.m, x0, 0.7, z0, x1, 1.1, z1, { tile: T.planksH, col: 0xe0c090, ao: 0.9 });
  for (const z of [-0.7, 0.7]) addGeo(p.m, new CylinderGeometry(0.5, 0.5, 0.09, 10), mat(0, 0.5, z, 0, 0, Math.PI / 2), { tile: T.beam });
  beam(p.m, [1.0, 0.65, -0.35], [2.4, 0.5, -0.3], 0.1, { tile: T.beam }); beam(p.m, [1.0, 0.65, 0.35], [2.4, 0.5, 0.3], 0.1, { tile: T.beam });
  addGeo(p.m, lathe([[0, 0.7], [0.5, 0.7], [0.55, 1.0], [0.3, 1.3], [0, 1.4]], 8), mat(-0.1, 0.4, 0), { tile: T.thatch, col: 0xfff0b0 });
  makeCrate(p.m, 0.55, 0.7, 0.1, 0.4);
  return p;
}
export function makeStall(color = 0) {
  const p = new P(), m = p.m, aw = [T.clothRed, T.clothBlue, T.clothOchre, T.clothRed][color % 4];
  for (const [x, z, h] of [[-1.1, -0.9, 2.5], [1.1, -0.9, 2.5], [-1.1, 0.9, 2.1], [1.1, 0.9, 2.1]]) box(m, x - 0.06, 0, z - 0.06, x + 0.06, h, z + 0.06, { tile: T.beam });
  box(m, -1.1, 0, 0.5, 1.1, 0.95, 0.9, { tile: T.planksH, col: 0xe8c898, ao: 0.6 });
  m.quad([-1.35, 2.1, 1.25], [1.35, 2.1, 1.25], [1.35, 2.55, -1.0], [-1.35, 2.55, -1.0], { tile: aw, us: 0.8, vs: 0.8 });
  m.quad([-1.35, 2.05, -1.0], [1.35, 2.05, -1.0], [1.35, 2.05, 1.25], [-1.35, 2.05, 1.25], { tile: T.planksH, col: 0x806858 });
  for (let i = 0; i < 7; i++) { const x0 = -1.35 + i * 0.386, x1 = x0 + 0.386; m.tri([x0, 2.1, 1.25], [x1, 2.1, 1.25], [(x0 + x1) / 2, 1.82, 1.25], { tile: aw, us: 0.8, vs: 0.8, uo: i * 0.5 }); m.tri([(x0 + x1) / 2, 1.82, 1.25], [x1, 2.1, 1.25], [x0, 2.1, 1.25], { tile: aw, us: 0.8, vs: 0.8 }); }
  [[-0.7, 0xd05a42], [-0.2, 0xe0a030], [0.3, 0x6aa84a], [0.8, 0xa070c0]].forEach(([x, c]) => addGeo(m, lathe([[0, 0], [0.2, 0.02], [0.25, 0.14], [0.1, 0.22], [0, 0.23]], 7), mat(x, 0.95, 0.7), { tile: T.clothOchre, col: c, us: 0.5 }));
  lantern(p, { x: 0, y: 2.0, z: 1.0, hook: false });
  return p;
}
export function makeBannerPole(color = 0) {
  const p = new P(), tile = [T.clothRed, T.clothBlue, T.clothOchre, T.clothRed][color % 4];
  box(p.m, -0.09, 0, -0.09, 0.09, 6.2, 0.09, { tile: T.beam, ao: 0.7 }); box(p.m, -0.2, 0, -0.2, 0.2, 0.35, 0.2, { tile: T.stone });
  box(p.m, -0.05, 5.55, -0.05, 1.0, 5.65, 0.05, { tile: T.beam });
  const f = { tile, us: 1, vs: 1 };
  for (const q of [[[0.05, 3.7, 0], [0.9, 3.7, 0], [0.9, 5.55, 0], [0.05, 5.55, 0]]]) { p.m.quad(q[0], q[1], q[2], q[3], f); p.m.quad(q[1], q[0], q[3], q[2], f); }
  p.m.tri([0.05, 3.7, 0], [0.475, 3.3, 0], [0.9, 3.7, 0], f); p.m.tri([0.05, 3.7, 0], [0.9, 3.7, 0], [0.475, 3.3, 0], f);
  return p;
}

// Fence along a polyline in WORLD coordinates (posts follow the ground via heightAt).
export function addFence(b, pts, closed, heightAt) {
  const seq = closed ? [...pts, pts[0]] : pts;
  for (let i = 0; i + 1 < seq.length; i++) {
    const [ax, az] = seq[i], [bx, bz] = seq[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 1.7));
    for (let k = 0; k <= n; k++) {
      const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n, y = heightAt(x, z);
      box(b, x - 0.07, y - 0.15, z - 0.07, x + 0.07, y + 1.05, z + 0.07, { tile: T.beam, ao: 0.7 });
      if (k < n) { const x2 = ax + (bx - ax) * (k + 1) / n, z2 = az + (bz - az) * (k + 1) / n, y2 = heightAt(x2, z2); for (const hh of [0.45, 0.85]) beam(b, [x, y + hh, z], [x2, y2 + hh, z2], 0.07, { tile: T.planksH, col: 0xe8d0b0 }); }
    }
  }
}

// The dock, in WORLD coordinates: deck planks along +z at x = dock.x, piles to the sea floor, rails, bollards, lanterns, cargo.
export function makeDock(dock, heightAt) {
  const p = new P(), m = p.m, { x, z0, z1, width: w, deck } = dock, hw = w / 2, r = rng(55);
  m.quad([x - hw, deck, z1], [x + hw, deck, z1], [x + hw, deck, z0], [x - hw, deck, z0], { tile: T.planksV, col: 0xf0d8b8, us: 1.2, vs: 1.2 });
  for (const s of [-1, 1]) box(m, x + s * hw - 0.12, deck - 0.3, z0, x + s * hw + 0.12, deck, z1, { tile: T.beam });
  let i = 0;
  for (let z = z0 + 0.8; z <= z1; z += 2.6, i++) {
    for (const s of [-1, 1]) {
      const px = x + s * (hw - 0.05), floor = Math.min(heightAt(px, z), 0) - 0.4;
      box(m, px - 0.15, floor, z - 0.15, px + 0.15, deck + 0.7, z + 0.15, { tile: T.planksV, col: 0xd8c0a0, ao: 0.5, us: 0.5 });
      box(m, px - 0.17, deck + 0.55, z - 0.17, px + 0.17, deck + 0.7, z + 0.17, { tile: T.beam });
      if (i % 2 === 0) { addGeo(m, new CylinderGeometry(0.19, 0.19, 0.12, 8), mat(px, deck + 0.45, z, 0, 0, 0), { tile: T.net, us: 0.4, col: 0xd8c8a0 }); } // rope coil
    }
    box(m, x - hw, deck - 0.45, z - 0.1, x + hw, deck - 0.3, z + 0.1, { tile: T.beam, ao: 0.6 });
  }
  for (const s of [-1, 1]) { beam(m, [x + s * (hw - 0.05), deck + 0.6, z0 + 0.8], [x + s * (hw - 0.05), deck + 0.6, z1 - 0.2], 0.05, { tile: T.net, col: 0xe0d0a8 }); }
  for (let z = z0 + 3.2, k = 0; z < z1 - 1; z += 5.2, k++) { const s = k % 2 ? 1 : -1; p.xf(mat(x + s * (hw - 0.1), deck, z), () => { box(m, -0.07, 0, -0.07, 0.07, 2.2, 0.07, { tile: T.beam }); lantern(p, { x: 0, y: 2.1, z: 0.0, hook: false, lit: WARM }); }); }
  barrel(m, x + hw - 0.7, deck, z0 + 1.4, 1, 0xe8d0b0); barrel(m, x + hw - 0.7, deck, z0 + 2.3, 1, 0xd8b890);
  makeCrate(m, x - hw + 0.6, deck, z1 - 2.5, 0.7); makeCrate(m, x - hw + 0.9, deck, z1 - 1.7, 0.55); makeCrate(m, x - hw + 0.6, deck + 0.7, z1 - 2.5, 0.5);
  void r;
  return p;
}

// Longship (prow toward +x, 11 m): clinker hull built from strake rings, dragon prow, mast, striped sail, shields, oars.
export function makeLongship({ seed = 400, sail = 0, L = 11 } = {}) {
  const p = new P(), m = p.m, rr = rng(seed), N = 14, K = 5;
  const beamAt = (u) => 1.55 * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), 2.6)), 0.65), sheer = (u) => 0.55 + 0.5 * u * u + 1.2 * Math.pow(Math.abs(u), 6), keel = (u) => -0.5 + 0.95 * Math.pow(Math.abs(u), 2.4);
  const P3 = (i, k, s, inset = 0) => { const u = (i / N) * 2 - 1, t = k / K, b = beamAt(u) - inset, y = keel(u) + (sheer(u) - keel(u)) * t; return [u * L / 2, y + (inset ? 0.05 : 0), s * b * (1 - Math.pow(1 - t, 2.2))]; };
  const cols = [0xd8a060, 0x9a3a2c, 0xd8a060, 0x9a3a2c, 0xd8a060];
  for (const s of [1, -1]) for (let i = 0; i < N; i++) for (let k = 0; k < K; k++) {
    const o = { tile: T.clinker, col: cols[(k + (sail ? 1 : 0)) % 5], us: 1.6, vs: 1.6, uo: i * 0.3 };
    const a = P3(i, k, s), b = P3(i + 1, k, s), c = P3(i + 1, k + 1, s), d = P3(i, k + 1, s);
    s > 0 ? m.quad(a, b, c, d, o) : m.quad(b, a, d, c, o);
    const ai = P3(i, k, s, 0.1), bi = P3(i + 1, k, s, 0.1), ci = P3(i + 1, k + 1, s, 0.1), di = P3(i, k + 1, s, 0.1), oi = { tile: T.planksH, col: 0x806040, us: 1.2, vs: 1.2 };
    s > 0 ? m.quad(bi, ai, di, ci, oi) : m.quad(ai, bi, ci, di, oi);
  }
  for (const s of [1, -1]) for (let i = 0; i < N; i++) { // gunwale cap
    const a = P3(i, K, s), b = P3(i + 1, K, s), bi = P3(i + 1, K, s, 0.1), ai = P3(i, K, s, 0.1), up = (v) => [v[0], v[1] + 0.07, v[2]];
    s > 0 ? m.quad(up(ai), up(bi), up(b), up(a), { tile: T.beam, col: 0xe8d0b0 }) : m.quad(up(b), up(a), up(ai), up(bi), { tile: T.beam, col: 0xe8d0b0 });
  }
  m.quad([-L / 2 + 1.2, -0.1, 1.0], [L / 2 - 1.2, -0.1, 1.0], [L / 2 - 1.2, -0.1, -1.0], [-L / 2 + 1.2, -0.1, -1.0], { tile: T.planksV, col: 0xe0c090, us: 1, vs: 1 });
  for (let x = -3.6; x <= 3.7; x += 1.8) box(m, x - 0.14, 0.32, -1.25, x + 0.14, 0.45, 1.25, { tile: T.planksH, col: 0xe0c090 });
  // prow: dragon head on a curved stem; stern: curled post
  addGeo(m, dragonGeo(0.5), mat(L / 2 - 0.25, 1.6, -0.035, 0, 0.75, 0, 1.25), { tile: T.beam, col: 0xf0d8b0, us: 1.2 });
  addGeo(m, new ExtrudeGeometry(dragonShape2(), { depth: 0.1, bevelEnabled: false }), mat(-L / 2 + 0.2, 1.4, -0.05, 0, 0, 0), { tile: T.beam, col: 0xe8d0b0, us: 1.2 });
  // mast, yard, rigging
  addGeo(m, new CylinderGeometry(0.1, 0.14, 7.2, 7), mat(0.3, 3.5, 0), { tile: T.beam, col: 0xf0d8b8 });
  addGeo(m, new CylinderGeometry(0.07, 0.07, 5.6, 6), mat(0.3, 6.0, 0, 0, 0, Math.PI / 2), { tile: T.beam, col: 0xf0d8b8 });
  for (const [x, y] of [[L / 2 - 0.4, 1.3], [-L / 2 + 0.4, 1.2]]) beam(m, [0.3, 7.0, 0], [x, y, 0], 0.035, { tile: T.net, col: 0xe0d0a8 });
  for (const s of [-1, 1]) for (const x of [-0.5, 1.1]) beam(m, [0.3, 6.5, 0], [x, 0.85, s * 1.35], 0.03, { tile: T.net, col: 0xe0d0a8 });
  // sail: bulging striped cloth, double sided
  const cl = [T.clothRed, T.clothBlue][sail % 2], SX = 6, SY = 4, sw = 2.7, top = 5.95, bot = 2.4, grid = [];
  for (let a = 0; a <= SX; a++) { grid.push([]); for (let b = 0; b <= SY; b++) { const u = a / SX, v = b / SY; grid[a].push([0.3 + 0.55 * Math.sin(u * 3.1416) * Math.sin(v * 2.4 + 0.3) + 0.06, bot + (top - bot) * v, (u * 2 - 1) * sw * (0.85 + 0.15 * v)]); } }
  for (let a = 0; a < SX; a++) for (let b = 0; b < SY; b++) {
    const q = [grid[a][b], grid[a + 1][b], grid[a + 1][b + 1], grid[a][b + 1]], o = { tile: cl, us: 0.9, vs: 0.9, sw: false, uo: 0 };
    m.quad(q[1], q[0], q[3], q[2], o); m.quad(q[0], q[1], q[2], q[3], o);
  }
  // shields and oars
  for (const s of [1, -1]) for (let i = 0; i < 8; i++) {
    const u = ((i + 0.5) / 8) * 1.4 - 0.7, x = u * L / 2 * 1.2, uu = x / (L / 2), b = beamAt(uu), y = sheer(uu) - 0.32;
    addGeo(m, new CylinderGeometry(0.34, 0.34, 0.06, 9), mat(x, y, s * (b * 0.98 + 0.07), 0, 0, Math.PI / 2), { tile: T.planksV, col: [0xc8402e, 0xf0d8a0, 0x3c5aa8, 0xe0a030][(i + (s > 0 ? 0 : 1)) % 4], us: 0.7 });
    if (i % 2 === 0) beam(m, [x + 0.3, y + 0.1, s * (b + 0.15)], [x + 0.9, -0.4, s * (b + 2.1)], 0.07, { tile: T.beam, col: 0xe8d0b0 });
  }
  box(m, -0.16, -0.6, -L / 2 + 0.6, 0.16, 0.2, L / 2 - 0.6, { tile: T.beam, ao: 0.6 }); void rr;
  p.xf(mat(0, 0, 0), () => lantern(p, { x: L / 2 - 1.1, y: 1.6, z: 0, hook: false, lit: WARM2 }));
  return p;
}
function dragonShape2() { // stern curl: a slim hooked post
  const sh = new Shape();
  [[0, -0.2], [0.26, -0.2], [0.26, 0.4], [0.15, 0.9], [-0.1, 1.3], [-0.45, 1.35], [-0.5, 1.2], [-0.25, 1.1], [-0.05, 0.8], [0, 0.4]].forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y)));
  return sh;
}
