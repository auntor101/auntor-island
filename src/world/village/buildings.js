// Procedural Viking buildings. Each maker returns a P (main/glow/sign geometry builders + smoke and light-pool points) in a local frame:
// x = length, z = width, floor at y = 0, front (door) toward +z, centred on the footprint. No DOM access: safe to run in tests.
import { ExtrudeGeometry, ShapeGeometry, CylinderGeometry, Shape } from 'three';
import { P, box, boxC, beam, addGeo, mat } from './geom.js';
import { TILE as T, SIGNS } from './atlas.js';
import { roof, dragons, door, win, lantern, banner, chimney, archShape, barrel, table, stool, WARM, WARM2, FIRE, NEON } from './parts.js';
import { rng } from './rng.js';

const pick = (r, a) => a[Math.floor(r() * a.length) % a.length];
const WALLS = [0xffffff, 0xf4dcc0, 0xe6d2bc, 0xf0c8b0, 0xd8dde0], ACC = [0xd05a42, 0x4a78b8, 0xe0a030, 0x3e9070, 0x9a58b8];
const ACC_TILE = [T.clothRed, T.clothBlue, T.clothOchre, T.clothBlue, T.clothBlue];
const ROOFS = { shingle: { tile: T.shingle, cols: [0xffb890, 0xb0c4d8, 0xf09078, 0xd8a070], th: 0.16, us: 1.2 }, turf: { tile: T.turf, cols: [0xffffff, 0xeaffc8, 0xd4f0a8], th: 0.42, us: 1.8 }, thatch: { tile: T.thatch, cols: [0xffffff, 0xffe8c0, 0xf0d8a8], th: 0.5, us: 1.6 } };

// Wall frame: matrix that puts a wall-frame detail at lateral offset u on the given wall.
export const wallMat = (d, wall, u = 0, y = 0) => ({ front: mat(u, y, d.wid / 2, 0), back: mat(-u, y, -d.wid / 2, Math.PI), east: mat(d.len / 2, y, -u, Math.PI / 2), west: mat(-d.len / 2, y, u, -Math.PI / 2) })[wall];
export const onWall = (p, d, wall, u, fn, y = 0) => p.xf(wallMat(d, wall, u, y), fn);

// Shell: foundation, walls (ends with gables), timber frame, roof with overhang, dragon boards, chimney. opts.walls turns walls off.
export function house(o) {
  const { len, wid, h, kind = 'shingle', seed = 1, walls = {}, fh = 0.55, drop = 0.9, wallTile = T.planksH, wallCol, edgeCol } = o;
  const r = rng(seed), R = ROOFS[kind], p = new P(), pitch = o.pitch ?? (kind === 'shingle' ? 0.78 : 0.68) + (r() - 0.5) * 0.1;
  const wc = wallCol ?? pick(r, WALLS), rc = o.roofCol ?? pick(r, R.cols), acc = o.acc ?? Math.floor(r() * ACC.length), hl = len / 2, hw = wid / 2, rise = hw * pitch;
  const on = (k) => walls[k] !== false, wt = (end) => (end && wallTile === T.planksH ? T.planksV : wallTile), us = wallTile === T.shutter ? 1.6 : 1, f = { col: wc, us, vs: us };
  const m = p.m, k = [0.5, 0.5, 1, 1];
  box(m, -hl - 0.12, -drop, -hw - 0.12, hl + 0.12, fh, hw + 0.12, { tile: T.stone, col: 0xe8e0d8, ao: 0.55, us: 1.1, vs: 1.1 });
  if (on('front')) m.quad([-hl, fh, hw], [hl, fh, hw], [hl, h, hw], [-hl, h, hw], { ...f, tile: wallTile, k, vo: fh / us });
  if (on('back')) m.quad([hl, fh, -hw], [-hl, fh, -hw], [-hl, h, -hw], [hl, h, -hw], { ...f, tile: wallTile, k, vo: fh / us });
  if (on('east')) { m.quad([hl, fh, hw], [hl, fh, -hw], [hl, h, -hw], [hl, h, hw], { ...f, tile: wt(1), k, vo: 0 }); m.tri([hl, h, hw], [hl, h, -hw], [hl, h + rise, 0], { ...f, tile: wt(1), vo: (h - fh) / us }); }
  if (on('west')) { m.quad([-hl, fh, -hw], [-hl, fh, hw], [-hl, h, hw], [-hl, h, -hw], { ...f, tile: wt(1), k }); m.tri([-hl, h, -hw], [-hl, h, hw], [-hl, h + rise, 0], { ...f, tile: wt(1), vo: (h - fh) / us }); }
  const beamc = { tile: T.beam, ao: 0.9, col: o.beamCol ?? 0xe8d8c8 };
  // timber frame: corner posts, bay posts front and back, eave plates, sill
  const bays = Math.max(2, Math.round(len / 2.9)), bw = len / bays;
  for (let i = 0; i <= bays; i++) for (const s of [1, -1]) {
    const x = -hl + i * bw, c = i === 0 || i === bays, e = c ? 0.15 : 0.12;
    if ((s > 0 && !on('front')) || (s < 0 && !on('back'))) continue;
    box(m, x - e, fh - 0.02, s > 0 ? hw - (c ? 0.15 : 0.03) : -hw - 0.08, x + e, h + 0.12, s > 0 ? hw + 0.08 : -hw + (c ? 0.15 : 0.03), beamc);
  }
  for (const s of [1, -1]) {
    if ((s > 0 && !on('front')) || (s < 0 && !on('back'))) continue;
    box(m, -hl - 0.1, h - 0.3, s > 0 ? hw - 0.02 : -hw - 0.1, hl + 0.1, h, s > 0 ? hw + 0.1 : -hw + 0.02, beamc);
    box(m, -hl - 0.05, fh - 0.02, s > 0 ? hw - 0.02 : -hw - 0.07, hl + 0.05, fh + 0.2, s > 0 ? hw + 0.07 : -hw + 0.02, beamc);
  }
  for (const ex of [-1, 1]) { // gable framing: tie beam, king post and braces
    if ((ex > 0 && !on('east')) || (ex < 0 && !on('west'))) continue;
    const x = ex * hl;
    box(m, x - 0.07 + (ex > 0 ? 0.05 : -0.05), h - 0.3, -hw - 0.1, x + 0.07 + (ex > 0 ? 0.05 : -0.05), h, hw + 0.1, beamc);
    box(m, x - 0.06 + (ex > 0 ? 0.05 : -0.05), h, -0.12, x + 0.06 + (ex > 0 ? 0.05 : -0.05), h + rise - 0.1, 0.12, beamc);
    for (const s of [-1, 1]) beam(m, [x + ex * 0.05, h, s * hw * 0.85], [x + ex * 0.05, h + rise * 0.55, s * hw * 0.2], 0.1, beamc);
  }
  const rf = roof(p, { len, wid, y: h, pitch, th: R.th, tile: R.tile, col: rc, us: R.us, oe: o.oe ?? (kind === 'thatch' ? 0.85 : 0.7), og: o.og ?? 0.55, edgeCol, ridge: kind === 'turf' ? { tile: T.turf, w: 0.3, h: 0.3, col: 0xffffff } : kind === 'thatch' ? { tile: T.thatch, w: 0.28, h: 0.3, col: 0xd8b878 } : {} });
  if (o.dragon !== false) dragons(p, rf, { len, sc: o.dsc ?? 1 });
  if (o.chimney !== false) { const cx = o.chx ?? len * 0.22, cz = -hw * 0.3, yb = rf.yr - Math.abs(cz) * pitch - R.th - 0.3; chimney(p, cx, cz, yb, rf.yr + 1.1, 0.8); }
  const dims = { len, wid, h, fh, rise, pitch, rf, acc, wc, r };
  return { p, d: dims };
}

function windowsAlong(p, d, wall, skipU, y = 1.35) {
  const len = wall === 'front' || wall === 'back' ? d.len : d.wid, bays = Math.max(2, Math.round(len / 2.9)), bw = len / bays;
  for (let i = 0; i < bays; i++) {
    const u = -len / 2 + (i + 0.5) * bw;
    if (skipU != null && Math.abs(u - skipU) < 1.6) continue;
    onWall(p, d, wall, u, () => win(p, { y, shut: ACC[d.acc], lit: d.r() > 0.3 ? WARM : WARM2 }));
  }
}
const bannerOn = (p, d, wall, u, y = d.h - 0.3) => onWall(p, d, wall, u, () => banner(p, { x: 0, y, tile: ACC_TILE[d.acc], len: 1.7, w: 0.6 }));

export function makeLonghouse({ length = 14, width = 6, height = 3, roof: kind = 'shingle', seed = 1 } = {}) {
  const { p, d } = house({ len: length, wid: width, h: height, kind, seed });
  const r = d.r, bays = Math.max(2, Math.round(length / 2.9)), bw = length / bays, doorU = -length / 2 + (Math.floor(bays / 2) - (seed % 2) + 0.5) * bw;
  onWall(p, d, 'front', doorU, () => { door(p, { h: 2.25 }); lantern(p, { x: 1.05, y: 2.45 }); });
  windowsAlong(p, d, 'front', doorU); windowsAlong(p, d, 'back', null);
  for (const w of ['east', 'west']) onWall(p, d, w, 0, () => win(p, { y: 1.3, w: 0.7, shut: ACC[d.acc], lit: WARM2, shutters: true }));
  for (const w of ['east', 'west']) onWall(p, d, w, 0, () => { // round gable light
    const g = new Shape(); g.absarc(0, 0, 0.26, 0, 6.283, false);
    addGeo(p.g, new ShapeGeometry(g, 8), mat(0, height + d.rise * 0.42, 0.03), { col: WARM2, tile: 0 });
  });
  bannerOn(p, d, 'front', length / 2 - 0.5);
  return Object.assign(p, { dims: d, footprint: { w: length, d: width } });
}

export function makeHall({ length = 24, width = 11, height = 4.3, seed = 7 } = {}) {
  const { p, d } = house({ len: length, wid: width, h: height, kind: 'shingle', seed, pitch: 0.82, dsc: 1.6, og: 0.9, oe: 0.9, wallCol: 0xf4dcc0, roofCol: 0xd8a070, acc: 0, chx: length * 0.32 });
  // porch: gabled projection with posts and a double door
  const pw = 6.4, pd = 3.6, py = 3.5;
  onWall(p, d, 'front', 0, () => {
    door(p, { w: 1.9, h: 2.9, glowH: 0.9 }); lantern(p, { x: -1.7, y: 2.9 }); lantern(p, { x: 1.7, y: 2.9 });
    for (const s of [-1, 1]) { box(p.m, s * (pw / 2) - 0.17, -0.5, pd - 0.2, s * (pw / 2) + 0.17, py, pd + 0.15, { tile: T.beam, ao: 0.8 }); beam(p.m, [s * pw / 2, py - 0.1, pd], [s * (pw / 2 - 1.1), py - 1.0, pd], 0.12, { tile: T.beam }); }
    box(p.m, -pw / 2 - 0.3, py - 0.3, pd - 0.2, pw / 2 + 0.3, py, pd + 0.15, { tile: T.beam });
    box(p.m, -pw / 2 - 0.5, -0.5, 0, pw / 2 + 0.5, 0.12, pd + 0.9, { tile: T.stone, ao: 0.8 }); // stone steps/landing
    box(p.m, -pw / 2 - 0.9, -0.5, 0.5, pw / 2 + 0.9, -0.1, pd + 1.6, { tile: T.stone, ao: 0.8 });
  });
  p.xf(wallMat(d, 'front', 0), () => p.xf(mat(0, 0, pd / 2, Math.PI / 2), () => { roof(p, { len: pd + 0.6, wid: pw + 0.8, y: py, pitch: 0.75, tile: T.shingle, col: 0xd8a070, us: 1.2, oe: 0.5, og: 0.5, th: 0.16, noTails: true }); }));
  // glowing louver turret on the ridge
  const ry = d.rf.yr;
  p.xf(mat(0, ry - 0.2, 0), () => {
    box(p.m, -1.1, 0, -1.1, 1.1, 1.3, 1.1, { tile: T.planksV, col: 0xf4dcc0, ao: 0.8 });
    for (const [wl, ry2] of [['front', 0], ['back', Math.PI]]) p.xf(mat(0, 0.35, 0, ry2), () => { for (let i = -1; i <= 1; i++) p.g.quad([i * 0.65 - 0.2, 0, 1.12], [i * 0.65 + 0.2, 0, 1.12], [i * 0.65 + 0.2, 0.6, 1.12], [i * 0.65 - 0.2, 0.6, 1.12], { col: WARM, tile: 0 }); });
    roof(p, { len: 2.2, wid: 2.2, y: 1.3, pitch: 1.0, th: 0.12, tile: T.shingle, col: 0xd8a070, us: 1, oe: 0.35, og: 0.35, noTails: true });
  });
  windowsAlong(p, d, 'front', 0, 1.8); windowsAlong(p, d, 'back', null, 1.8);
  for (const w of ['east', 'west']) onWall(p, d, w, 0, () => { win(p, { y: 1.5, w: 1.0, h: 1.3, shut: ACC[0], shutters: true }); banner(p, { x: 2.6, y: 3.6, tile: T.clothRed, len: 2.2, w: 0.8 }); });
  return Object.assign(p, { dims: d, footprint: { w: length, d: width } });
}

export function makeForge({ seed = 8 } = {}) {
  const p = new P(), m = p.m, W = 9, D = 8, hw = D / 2, hl = W / 2;
  box(m, -hl, -0.5, -hw, hl, 0.3, hw, { tile: T.stone, ao: 0.6, us: 1.2, vs: 1.2, bottom: false });
  for (const [x0, z0, x1, z1] of [[-hl, -hw, hl, -hw + 0.4], [-hl, -hw, -hl + 0.4, hw], [hl - 0.4, -hw, hl, hw]]) box(m, x0, 0.3, z0, x1, 1.5, z1, { tile: T.stone, ao: 0.6, us: 1.2, vs: 1.2 }); // low stone walls, back and both sides
  for (const [x, z] of [[-hl + 0.2, hw - 0.2], [hl - 0.2, hw - 0.2], [-hl + 0.2, -hw + 0.2], [hl - 0.2, -hw + 0.2]]) box(m, x - 0.2, 0.3, z - 0.2, x + 0.2, 3.6, z + 0.2, { tile: T.beam, ao: 0.8 });
  for (const [x0, x1] of [[-hl + 0.4, hl - 0.4]]) { box(m, x0, 1.5, -hw + 0.4, x1, 3.5, -hw + 0.55, { tile: T.planksH, col: 0xb89878, ao: 0.7 }); box(m, -hl + 0.4, 1.5, -hw + 0.4, -hl + 0.55, 3.5, hw - 0.2, { tile: T.planksV, col: 0xb89878, ao: 0.7 }); box(m, hl - 0.55, 1.5, -hw + 0.4, hl - 0.4, 3.5, hw - 0.2, { tile: T.planksV, col: 0xb89878, ao: 0.7 }); }
  // mono-pitch roof, high at the back
  const yb = 4.0, yf = 3.2, ox = 0.6, zf = hw + 0.9, zb = -hw - 0.5, th = 0.16;
  m.quad([-hl - ox, yf, zf], [hl + ox, yf, zf], [hl + ox, yb, zb], [-hl - ox, yb, zb], { tile: T.shingle, col: 0x9ab0c4, us: 1.2, vs: 1.2 });
  m.quad([-hl - ox, yb - th, zb], [hl + ox, yb - th, zb], [hl + ox, yf - th, zf], [-hl - ox, yf - th, zf], { tile: T.planksH, col: 0x806858 });
  m.quad([-hl - ox, yf - th, zf], [hl + ox, yf - th, zf], [hl + ox, yf, zf], [-hl - ox, yf, zf], { tile: T.beam });
  m.quad([hl + ox, yf - th, zf], [hl + ox, yb - th, zb], [hl + ox, yb, zb], [hl + ox, yf, zf], { tile: T.beam });
  m.quad([-hl - ox, yb - th, zb], [-hl - ox, yf - th, zf], [-hl - ox, yf, zf], [-hl - ox, yb, zb], { tile: T.beam });
  m.quad([hl + ox, yb - th, zb], [-hl - ox, yb - th, zb], [-hl - ox, yb, zb], [hl + ox, yb, zb], { tile: T.beam });
  // big furnace chimney at the back with a glowing mouth
  box(m, -1.5, 0.3, -hw + 0.5, 1.5, 2.3, -hw + 2.2, { tile: T.stone, ao: 0.7, us: 1, vs: 1 });
  box(m, -1.0, 2.3, -hw + 0.6, 1.0, 5.4, -hw + 1.9, { tile: T.stone, ao: 0.9, us: 1, vs: 1 });
  box(m, -1.15, 5.3, -hw + 0.45, 1.15, 5.55, -hw + 2.05, { tile: T.stone });
  addGeo(m, new ExtrudeGeometry(archShape(1.5, 1.2, { w: 1.1, y: 0, h: 0.95 }), { depth: 0.1, bevelEnabled: false }), mat(0, 0.9, -hw + 2.2), { tile: T.stone, col: 0x909090 });
  addGeo(p.g, new ShapeGeometry(archShape(1.1, 0.95)), mat(0, 0.9, -hw + 2.17), { tile: 1, col: FIRE });
  p.smoke.push([0, 5.9, -hw + 1.25]); p.pools.push([0, 0, -hw + 3.5, 5]);
  // anvil on a stump, bellows, quench barrel, tool rack
  addGeo(m, new CylinderGeometry(0.4, 0.45, 0.7, 9), mat(0.6, 0.3 + 0.35, 0.8), { tile: T.planksV, col: 0xc0a080 });
  box(m, 0.25, 1.0, 0.65, 0.95, 1.12, 0.95, { tile: T.beam, col: 0x9090a0 }); box(m, 0.4, 1.12, 0.72, 0.8, 1.32, 0.88, { tile: T.beam, col: 0x9090a0 }); box(m, 0.2, 1.2, 0.72, 1.35, 1.3, 0.88, { tile: T.beam, col: 0xa0a0b0 });
  box(m, -2.4, 0.3, -hw + 0.7, -1.6, 0.9, -hw + 1.5, { tile: T.planksH, col: 0xd0a880 }); box(m, -2.3, 0.9, -hw + 0.8, -1.7, 1.15, -hw + 1.4, { tile: T.shutter, col: 0x8a5a3a });
  barrel(m, 2.8, 0.3, 1.6, 1.0, 0xa0b8c8);
  for (let i = 0; i < 4; i++) beam(m, [-3.8, 1.9 + i * 0.35, -hw + 0.6], [-3.8 + 0.6 + i * 0.05, 2.35 + i * 0.35, -hw + 0.6], 0.07, { tile: T.beam, col: 0x9090a0 });
  lantern(p, { x: hl - 0.5, y: 2.6, z: hw - 0.3, hook: false }); lantern(p, { x: -hl + 0.5, y: 2.6, z: hw - 0.3, hook: false });
  box(m, -0.1, 3.0, hw + 0.2, 0.1, 3.18, hw + 0.8, { tile: T.beam }); // sign hook
  p.xf(mat(0, 3.18, hw + 0.8, Math.PI / 2), () => signBoard(p, SIGNS.indexOf('forge'), 0.8, 0.8));
  return Object.assign(p, { footprint: { w: W, d: D } });
}

// Two-sided hanging sign (atlas pictogram); drawn in the plane x = 0, hanging from y = 0 down, centred on z = 0.
export function signBoard(p, idx, w = 0.9, h = 0.9, y = 0) {
  const u0 = (idx % 4) / 4, v1 = 1 - Math.floor(idx / 4) / 3, u1 = u0 + 0.25, v0 = v1 - 1 / 3, hz = w / 2, yb = y - h;
  p.s.quad([0.03, yb, hz], [0.03, yb, -hz], [0.03, y, -hz], [0.03, y, hz], { uv: [[u0, v0], [u1, v0], [u1, v1], [u0, v1]] });
  p.s.quad([-0.03, yb, -hz], [-0.03, yb, hz], [-0.03, y, hz], [-0.03, y, -hz], { uv: [[u0, v0], [u1, v0], [u1, v1], [u0, v1]] });
  for (const [x0, x1] of [[-0.05, 0.05]]) { box(p.m, x0, yb - 0.04, -hz - 0.04, x1, y + 0.04, -hz, { tile: T.beam }); box(p.m, x0, yb - 0.04, hz, x1, y + 0.04, hz + 0.04, { tile: T.beam }); box(p.m, x0, yb - 0.04, -hz, x1, yb, hz, { tile: T.beam }); box(p.m, x0, y, -hz, x1, y + 0.04, hz, { tile: T.beam }); }
  for (const z of [-hz + 0.1, hz - 0.1]) beam(p.m, [0, y, z], [0, y + 0.45, z * 0.4], 0.025, { tile: T.beam, col: 0x808088 });
}

const SHOP = { // wall pastel, awning tile + tint, glow
  tiramisu: { wall: 0xffc4d0, awn: T.clothOchre, awnCol: 0xffffff, acc: 0xb8506a }, 'blueberry-cheesecake': { wall: 0xb4c0ff, awn: T.clothBlue, awnCol: 0xffffff, acc: 0x4a5cb8 },
  mungdi: { wall: 0xff9a7a, awn: T.clothRed, awnCol: 0xffffff, acc: 0xc83c2c, chim: 1 }, coffee: { wall: 0xe8c898, awn: T.clothOchre, awnCol: 0xd8a070, acc: 0x7a5030, chim: 1 },
  steakhouse: { wall: 0xc88070, awn: T.clothRed, awnCol: 0xc09090, acc: 0x7a2e24, chim: 1 }, seafood: { wall: 0x96d8d0, awn: T.clothBlue, awnCol: 0xc8f0ff, acc: 0x2a7a8a },
  'asian-fusion': { wall: 0xa4e0a4, awn: T.clothOchre, awnCol: 0xa0d890, acc: 0x3a8a4a, chim: 1 }, 'velvet-lounge': { wall: 0xa878c8, awn: T.clothBlue, awnCol: 0xd090e0, acc: 0x7a3aa0, neon: 1 },
};
export const shopSpec = SHOP;

export function makeShop({ venue = 'coffee', seed = 100, w = 4.4, d = 7 } = {}) {
  const S = SHOP[venue], H = 5.3, G = 3.0, inner = new P();
  const { p, d: dim } = house({ len: d, wid: w, h: H, kind: venue === 'seafood' || venue === 'steakhouse' ? 'shingle' : 'shingle', seed, wallTile: T.shutter, wallCol: S.wall, walls: { east: false }, dragon: false, chimney: false, pitch: 0.9, og: 0.9, oe: 0.45, acc: 0, roofCol: pick(rng(seed), [0xd08a6a, 0x9ab0c8, 0xc87a60]), fh: 0.45, beamCol: 0xd8c0a8 });
  Object.assign(inner, { m: p.m, g: p.g, s: p.s, smoke: p.smoke, pools: p.pools });
  const hl = d / 2, hw = w / 2, rise = hw * 0.9, J = 0.35, e = { len: d, wid: w, h: H, fh: 0.45, acc: 0, r: rng(seed) };
  if (S.chim) chimney(inner, -d * 0.2, 0, H + rise * 0.85 - 0.5, H + rise + 1.4, 0.7);
  onWall(inner, e, 'east', 0, () => {
    const m = inner.m, g = inner.g;
    // ground floor: timber frame, big shop window, arched door
    box(m, -hw - 0.1, 0, 0, hw + 0.1, G, 0.1, { tile: T.planksH, col: 0xe0c8a8, ao: 0.6 });
    for (const x of [-hw, hw]) box(m, x - 0.15, 0, -0.05, x + 0.15, G + 0.1, 0.18, { tile: T.beam, ao: 0.8 });
    g.quad([-1.65, 0.9, 0.13], [0.55, 0.9, 0.13], [0.55, 2.4, 0.13], [-1.65, 2.4, 0.13], { col: S.neon ? [1.8, 0.55, 1.2] : WARM, tile: 0 });
    for (const x of [-1.65, -0.55, 0.55]) box(m, x - 0.04, 0.85, 0.1, x + 0.04, 2.45, 0.2, { tile: T.beam });
    box(m, -1.75, 2.35, 0.1, 0.65, 2.5, 0.22, { tile: T.beam }); box(m, -1.75, 0.8, 0.1, 0.65, 0.95, 0.22, { tile: T.beam });
    box(m, -1.8, 0.0, 0.1, 0.7, 0.8, 0.3, { tile: T.planksV, col: 0xd0b090, ao: 0.7 }); // stall board
    p.xf(mat(1.45, 0, 0), () => { door(inner, { w: 0.95, h: 2.15, glowH: 0.55, col: S.neon ? 0xe0b0ff : 0xffffff }); lantern(inner, { x: 0.75, y: 2.5, hook: true }); });
    // jettied upper floor + gable face
    box(m, -hw - 0.15, G, 0, hw + 0.15, H, J, { tile: T.shutter, col: S.wall, ao: 0.8, us: 1.6, vs: 1.6 });
    box(m, -hw - 0.2, G - 0.3, 0, hw + 0.2, G, J + 0.08, { tile: T.beam, ao: 0.8 });
    for (const x of [-hw + 0.3, hw - 0.3]) beam(m, [x, G - 0.3, 0.05], [x, G - 0.05, J + 0.05], 0.14, { tile: T.beam });
    m.tri([-hw - 0.15, H, J], [hw + 0.15, H, J], [0, H + rise, J], { tile: T.shutter, col: S.wall, us: 1.6, vs: 1.6 });
    box(m, -hw - 0.2, H - 0.25, J - 0.02, hw + 0.2, H, J + 0.08, { tile: T.beam });
    box(m, -0.07, H, J, 0.07, H + rise - 0.1, J + 0.1, { tile: T.beam });
    for (const s of [-1, 1]) beam(m, [s * hw * 0.9, H + 0.1, J + 0.04], [s * hw * 0.25, H + rise * 0.6, J + 0.04], 0.1, { tile: T.beam });
    p.xf(mat(0, 0, J), () => { win(inner, { y: G + 0.7, w: 0.85, h: 1.1, shut: S.acc, lit: WARM }); });
    const gc = 0.06; g.quad([-0.22, H + rise * 0.4 - 0.2, J + gc], [0.22, H + rise * 0.4 - 0.2, J + gc], [0.22, H + rise * 0.4 + 0.2, J + gc], [-0.22, H + rise * 0.4 + 0.2, J + gc], { col: WARM2, tile: 0 });
    // striped awning over the shop window with a scalloped edge
    const ya = G - 0.05, yo = G - 0.6, zo = 1.5, fa = { tile: S.awn, col: S.awnCol, us: 0.9, vs: 0.9 };
    m.quad([-hw - 0.1, yo, zo], [hw + 0.1, yo, zo], [hw + 0.1, ya, 0.1], [-hw - 0.1, ya, 0.1], fa);
    m.quad([-hw - 0.1, ya - 0.08, 0.1], [hw + 0.1, ya - 0.08, 0.1], [hw + 0.1, yo - 0.08, zo], [-hw - 0.1, yo - 0.08, zo], { tile: T.planksH, col: 0x806858 });
    for (let i = 0; i < 9; i++) { const x0 = -hw - 0.1 + (w + 0.2) * i / 9, x1 = -hw - 0.1 + (w + 0.2) * (i + 1) / 9; m.tri([x0, yo, zo], [x1, yo, zo], [(x0 + x1) / 2, yo - 0.28, zo], { ...fa, uo: i * 0.5 }); m.tri([(x0 + x1) / 2, yo - 0.28, zo], [x1, yo, zo], [x0, yo, zo], fa); }
    for (const s of [-1, 1]) beam(m, [s * (hw + 0.05), ya, 0.1], [s * (hw + 0.05), yo, zo], 0.05, { tile: T.beam });
    // bracket sign toward the street, hanging pictogram board
    const su = hw + 0.18; box(m, su - 0.04, G + 1.8, 0.05, su + 0.04, G + 1.9, 1.4, { tile: T.beam });
    beam(m, [su, G + 1.3, 0.1], [su, G + 1.85, 1.1], 0.06, { tile: T.beam });
    inner.xf(mat(su, G + 1.8, 0.82), () => signBoard(inner, SIGNS.indexOf(venue), 0.85, 0.85));
    if (S.neon) for (const [a, b2] of [[-1.7, 0.6]]) { // neon trim around the lounge window and a star
      g.quad([a, 2.52, 0.2], [b2, 2.52, 0.2], [b2, 2.58, 0.2], [a, 2.58, 0.2], { col: NEON, tile: 0 });
      g.quad([a, 0.72, 0.2], [b2, 0.72, 0.2], [b2, 0.78, 0.2], [a, 0.78, 0.2], { col: NEON, tile: 0 });
      g.quad([-0.5, G + 0.5, J + 0.05], [0.5, G + 0.5, J + 0.05], [0.5, G + 0.56, J + 0.05], [-0.5, G + 0.56, J + 0.05], { col: [1.2, 0.5, 2.2], tile: 0 });
    }
    p.xf(mat(-0.4, 0, 0), () => { table(m, -0.8, 0, 1.0); });
  });
  for (const s of [-1, 1]) onWall(inner, e, s > 0 ? 'front' : 'back', 0, () => { win(inner, { y: 1.5, w: 0.7, h: 0.9, shut: S.acc, lit: WARM2 }); win(inner, { y: G + 0.9, w: 0.7, h: 0.9, shut: S.acc, lit: WARM2, shutters: false }); });
  const out = new P(); out.append(inner, mat(0, 0, 0, -Math.PI / 2));
  return Object.assign(out, { footprint: { w, d }, venue });
}

export function makeStable({ length = 16, width = 8, seed = 10 } = {}) {
  const { p, d } = house({ len: length, wid: width, h: 3.2, kind: 'thatch', seed, walls: { front: false }, chimney: false, dsc: 0.8, wallCol: 0xe8d0b0 });
  const m = p.m, hw = width / 2, n = Math.round(length / 4), bw = length / n;
  m.quad([-length / 2, 0.58, hw - 0.1], [length / 2, 0.58, hw - 0.1], [length / 2, 0.58, -hw + 0.1], [-length / 2, 0.58, -hw + 0.1], { tile: T.dirt, col: 0x806040 });
  box(m, -length / 2 - 0.1, 2.5, hw - 0.1, length / 2 + 0.1, 3.2, hw + 0.1, { tile: T.planksH, col: 0xe8d0b0, ao: 0.9 });
  for (let i = 0; i <= n; i++) box(m, -length / 2 + i * bw - 0.17, 0.5, hw - 0.2, -length / 2 + i * bw + 0.17, 3.25, hw + 0.15, { tile: T.beam, ao: 0.8 });
  for (let i = 0; i < n; i++) { // half doors, open tops, lit hay lofts
    const cx = -length / 2 + (i + 0.5) * bw;
    box(m, cx - bw / 2 + 0.3, 0.55, hw - 0.05, cx + 0.05, 1.7, hw + 0.07, { tile: T.door, col: 0xe8d0b0, ao: 0.9, us: 1.2, vs: 1.2 });
    box(m, cx + 0.12, 0.55, hw - 0.05, cx + bw / 2 - 0.3, 1.7, hw + 0.07, { tile: T.door, col: 0xe8d0b0, ao: 0.9, us: 1.2, vs: 1.2 });
    box(m, cx - bw / 2 + 0.4, 0.58, hw - 2.2, cx + bw / 2 - 0.4, 0.95, hw - 1.6, { tile: T.thatch, col: 0xffe8a0, ao: 1 }); // hay manger
    if (i % 2 === 0) lantern(p, { x: cx + bw / 2, y: 2.4, z: hw + 0.1 });
    box(m, cx - bw / 2 + 0.15, 0.58, -hw + 0.1, cx - bw / 2 + 0.22, 2.4, hw - 0.1, { tile: T.planksV, col: 0xd8c0a0 }); // stall divider
  }
  for (const w of ['back']) windowsAlong(p, d, w, null, 1.6);
  for (let i = 0; i < 2; i++) box(m, -length / 2 + 2 + i * (length - 4) - 0.9, 0.58, hw + 1.1, -length / 2 + 2 + i * (length - 4) + 0.9, 0.95, hw + 1.6, { tile: T.planksH, col: 0xc09870 }); // troughs
  onWall(p, d, 'east', 0, () => win(p, { y: 1.6, w: 0.9, h: 0.9, shut: ACC[2], lit: WARM2 }));
  p.xf(mat(0, 2.5, hw + 0.3, Math.PI / 2), () => signBoard(p, SIGNS.indexOf('stables'), 0.8, 0.8));
  return Object.assign(p, { dims: d, footprint: { w: length, d: width } });
}

export function makeTheatre({ seed = 9 } = {}) {
  const W = 11, D = 9, H = 5.0, inner = new P();
  const { p, d } = house({ len: D, wid: W, h: H, kind: 'shingle', seed, walls: { east: false }, wallCol: 0xe8d8f0, roofCol: 0xb8a8d8, acc: 4, pitch: 0.55, dsc: 1.2, chimney: false, beamCol: 0xf0e0c8 });
  Object.assign(inner, { m: p.m, g: p.g, s: p.s, smoke: p.smoke, pools: p.pools });
  const m = inner.m, g = inner.g, rise = W / 2 * 0.55, e = { len: D, wid: W, h: H, fh: 0.55, acc: 4, r: rng(seed) };
  onWall(inner, e, 'east', 0, () => {
    box(m, -W / 2 - 0.1, 0, 0, W / 2 + 0.1, H, 0.12, { tile: T.shutter, col: 0xe8d8f0, ao: 0.6, us: 1.6, vs: 1.6 });
    m.tri([-W / 2 - 0.1, H, 0.12], [W / 2 + 0.1, H, 0.12], [0, H + rise, 0.12], { tile: T.shutter, col: 0xe8d8f0, us: 1.6, vs: 1.6 });
    g.quad([-2.3, 0.8, 0.14], [2.3, 0.8, 0.14], [2.3, 3.1, 0.14], [-2.3, 3.1, 0.14], { col: [1.4, 0.8, 0.55], tile: 0.35 });
    addGeo(g, new ShapeGeometry(archShape(4.6, 3.6)), mat(0, 0.8, 0.14), { col: [1.4, 0.8, 0.55], tile: 0.35 });
    addGeo(m, new ExtrudeGeometry(archShape(5.7, 4.4, { w: 4.6, y: 0, h: 3.6 }), { depth: 0.3, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1, curveSegments: 6 }), mat(0, 0.8, 0.1), { tile: T.beam, col: 0xe8c880, us: 1.2 });
    const cl = { tile: T.clothRed, col: 0xffffff, us: 1, vs: 1.4 };
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { // curtain folds: angled strips either side of the opening
      const x0 = s * (2.3 - i * 0.18), x1 = s * (2.3 - (i + 1) * 0.18), z0 = 0.18 + (i % 2) * 0.08, z1 = 0.18 + ((i + 1) % 2) * 0.08;
      s > 0 ? m.quad([x0, 0.85, z0], [x1, 0.85, z1], [x1, 3.6, z1], [x0, 3.6, z0], cl) : m.quad([x1, 0.85, z1], [x0, 0.85, z0], [x0, 3.6, z0], [x1, 3.6, z1], cl);
    }
    for (let i = 0; i < 8; i++) { const x0 = -2.4 + i * 0.6, x1 = x0 + 0.6; m.quad([x0, 3.2, 0.3], [x1, 3.2, 0.3], [x1, 3.7, 0.28], [x0, 3.7, 0.28], cl); m.tri([x0, 3.2, 0.3], [x1, 3.2, 0.3], [(x0 + x1) / 2, 2.9, 0.3], cl); } // valance
    box(m, -4.2, 0, 0.12, 4.2, 0.8, 2.6, { tile: T.planksH, col: 0xe0b890, ao: 0.6 }); // stage platform
    box(m, -1.8, 0, 2.6, 1.8, 0.27, 3.4, { tile: T.stone, ao: 0.6 }); box(m, -1.8, 0.27, 2.6, 1.8, 0.54, 3.0, { tile: T.stone, ao: 0.8 });
    box(m, -4.2, 0.8, 0.12, 4.2, 1.1, 2.6, { tile: T.beam, ao: 1 }); // front lip
    lantern(inner, { x: -3.6, y: 2.2, z: 0.2, hook: false }); lantern(inner, { x: 3.6, y: 2.2, z: 0.2, hook: false });
    inner.xf(mat(0, 0, 0, 0), () => { const idx = SIGNS.indexOf('theatre'), u0 = (idx % 4) / 4, v1 = 1 - Math.floor(idx / 4) / 3; inner.s.quad([-1.0, H + 0.4, 0.2], [1.0, H + 0.4, 0.2], [1.0, H + 2.4, 0.2], [-1.0, H + 2.4, 0.2], { uv: [[u0, v1 - 1 / 3], [u0 + 0.25, v1 - 1 / 3], [u0 + 0.25, v1], [u0, v1]] }); });
    banner(inner, { x: -W / 2 + 0.3, y: 4.3, tile: T.clothBlue, len: 2.4, w: 0.8 }); banner(inner, { x: W / 2 - 1.1, y: 4.3, tile: T.clothBlue, len: 2.4, w: 0.8 });
  });
  for (const wl of ['front', 'back']) windowsAlong(inner, e, wl, null, 1.8);
  const out = new P(); out.append(inner, mat(0, 0, 0, -Math.PI / 2));
  return Object.assign(out, { footprint: { w: W, d: D } });
}

export function makeBoathouse({ seed = 300 } = {}) {
  const W = 7, D = 12, H = 3.8, inner = new P();
  const { p, d } = house({ len: D, wid: W, h: H, kind: 'turf', seed, walls: { east: false }, wallCol: 0xe0d0c0, acc: 1, pitch: 0.85, dsc: 0.9, chimney: false });
  Object.assign(inner, { m: p.m, g: p.g, s: p.s, smoke: p.smoke, pools: p.pools });
  const m = inner.m, e = { len: D, wid: W, h: H, fh: 0.55, acc: 1, r: rng(seed) }, rise = W / 2 * 0.85;
  onWall(inner, e, 'east', 0, () => {
    box(m, -W / 2 - 0.1, 0, 0, W / 2 + 0.1, H, 0.12, { tile: T.planksV, col: 0xd8c4a8, ao: 0.6 });
    m.tri([-W / 2 - 0.1, H, 0.12], [W / 2 + 0.1, H, 0.12], [0, H + rise, 0.12], { tile: T.planksV, col: 0xd8c4a8 });
    for (const s of [-1, 1]) { box(m, s * 0.95 - 0.92, 0.1, 0.1, s * 0.95 + 0.92, 3.0, 0.2, { tile: T.door, col: 0xd8c8b8, ao: 0.9, us: 1.8, vs: 1.8 }); beam(m, [s * 0.95 - 0.9, 0.2, 0.22], [s * 0.95 + 0.9, 2.9, 0.22], 0.12, { tile: T.beam }); beam(m, [s * 0.95 + 0.9, 0.2, 0.22], [s * 0.95 - 0.9, 2.9, 0.22], 0.12, { tile: T.beam }); }
    box(m, -2.0, 0, 0.1, -1.85, 3.15, 0.26, { tile: T.beam }); box(m, 1.85, 0, 0.1, 2.0, 3.15, 0.26, { tile: T.beam }); box(m, -2.0, 3.0, 0.1, 2.0, 3.2, 0.26, { tile: T.beam });
    win(inner, { y: H + 0.5, w: 0.7, h: 0.8, shut: ACC[1], lit: WARM2 });
    lantern(inner, { x: -2.6, y: 2.6 }); lantern(inner, { x: 2.6, y: 2.6 });
    beam(m, [0, H + rise * 0.8, 0.1], [0, H + rise * 0.8 + 0.1, 1.4], 0.1, { tile: T.beam }); // hoist beam
    box(m, -W / 2 - 0.3, 0, 0.2, W / 2 + 0.3, 0.12, 3.5, { tile: T.planksH, col: 0xc0a080, ao: 0.6 }); // ramp boards
  });
  for (const wl of ['front', 'back']) windowsAlong(inner, e, wl, null, 1.5);
  const out = new P(); out.append(inner, mat(0, 0, 0, -Math.PI / 2));
  return Object.assign(out, { footprint: { w: W, d: D } });
}
export { table, stool, barrel };
