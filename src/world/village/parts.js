// Building pieces. Wall-frame helpers (door, window, lantern, banner...) draw on a wall at z = 0 facing +z with the floor at y = 0.
import { Shape, ExtrudeGeometry, ShapeGeometry, CylinderGeometry, LatheGeometry, Vector2, Matrix4, Vector3, Path } from 'three';
import { box, boxC, beam, addGeo, mat, P } from './geom.js';
import { TILE as T } from './atlas.js';

export const WARM = [1.9, 1.15, 0.5], WARM2 = [1.6, 0.9, 0.42], FIRE = [2.6, 1.0, 0.25], NEON = [2.2, 0.35, 1.5];
const EX = { bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1, curveSegments: 4 };

export function archShape(w, h, hole) {
  const s = new Shape(), r = w / 2;
  s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, h - r); s.absarc(0, h - r, r, 0, Math.PI, false); s.lineTo(-r, 0);
  if (hole) { const p = new Path(), q = hole.w / 2; p.moveTo(-q, hole.y); p.lineTo(-q, hole.y + hole.h - q); p.absarc(0, hole.y + hole.h - q, q, Math.PI, 0, true); p.lineTo(q, hole.y); p.lineTo(-q, hole.y); s.holes.push(p); }
  return s;
}
// A carved dragon-head board: strip of length Lb along +x ending in a horned, long-snouted head (original stylised design).
function dragonShape(Lb) {
  const s = new Shape(), h = [[-0.1, -0.1], [Lb, -0.1], [Lb + 0.25, -0.04], [Lb + 0.55, 0], [Lb + 0.8, 0.02], [Lb + 0.95, 0.08], [Lb + 1, 0.15], [Lb + 0.93, 0.22], [Lb + 0.72, 0.25], [Lb + 0.5, 0.34], [Lb + 0.34, 0.66], [Lb + 0.3, 0.34], [Lb + 0.08, 0.54], [Lb + 0.05, 0.22], [Lb, 0.1], [-0.1, 0.1]];
  h.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  const eye = new Path(); eye.absarc(Lb + 0.55, 0.16, 0.04, 0, 6.283, false); s.holes.push(eye);
  return s;
}
export const dragonGeo = (Lb) => new ExtrudeGeometry(dragonShape(Lb), { ...EX, depth: 0.07 });

// ---- roof (ridge along x, centred at the origin). Slopes, thickness, overhang, fascia, underside, ridge cap.
export function roof(p, o) {
  const { len, wid, y, pitch = 0.7, oe = 0.7, og = 0.55, th = 0.16, tile = T.shingle, col = 0xffffff, us = 1.2, edge = T.beam } = o;
  const hx = len / 2 + og, hz = wid / 2 + oe, rise = wid / 2 * pitch, ye = y - oe * pitch, yr = y + rise, b = p.m, dark = 0xb09080;
  const half = () => {
    b.quad([-hx, ye, hz], [hx, ye, hz], [hx, yr, 0], [-hx, yr, 0], { tile, col, us, vs: us, uo: o.uo || 0 });
    b.quad([-hx, yr - th, 0], [hx, yr - th, 0], [hx, ye - th, hz], [-hx, ye - th, hz], { tile: T.planksH, col: 0x806858 });
    b.quad([-hx, ye - th, hz], [hx, ye - th, hz], [hx, ye, hz], [-hx, ye, hz], { tile: edge, col: o.edgeCol ?? 0xe0d0c0, vs: 0.4 });
    b.quad([hx, ye - th, hz], [hx, yr - th, 0], [hx, yr, 0], [hx, ye, hz], { tile: edge, col: o.edgeCol ?? 0xe0d0c0, vs: 0.4 });
    b.quad([-hx, yr - th, 0], [-hx, ye - th, hz], [-hx, ye, hz], [-hx, yr, 0], { tile: edge, col: o.edgeCol ?? 0xe0d0c0, vs: 0.4 });
    // rafter tails under the eave
    if (!o.noTails) for (let x = -len / 2 + 0.5; x <= len / 2 - 0.4; x += 1.15) box(b, x - 0.06, ye - th - 0.15, wid / 2 - 0.05, x + 0.06, ye - th, hz - 0.06, { tile: T.beam, ao: 0.8 });
  };
  half(); p.xf(mat(0, 0, 0, Math.PI), half);
  // ridge cap
  const rc = o.ridge || {};
  box(b, -hx - 0.1, yr - 0.08, -(rc.w || 0.17), hx + 0.1, yr + (rc.h || 0.2), rc.w || 0.17, { tile: rc.tile ?? T.beam, col: rc.col ?? 0xe0d0c0, ao: 0.9 });
  return { yr, ye, hx, hz, rise };
}
// Crossed dragon barge boards on both gables (the Viking horns), in the ridge-along-x frame.
export function dragons(p, r, o) {
  const { len, y, pitch, sc = 1, col = 0xf0e0d0 } = o, ang = Math.atan2(r.rise, r.hz - 0.5), Lb = Math.hypot(r.hz, r.rise) * 1.02;
  const c = Math.cos(ang), s = Math.sin(ang), geo = dragonGeo(Lb);
  for (const ex of [-1, 1]) for (const sz of [-1, 1]) {
    // basis: shape-x along the slope up to the ridge, shape-y out of the slope, shape-z along the gable axis
    const m = new Matrix4().makeBasis(new Vector3(0, s, -c * sz), new Vector3(0, c, s * sz), new Vector3(ex, 0, 0)).setPosition(ex * (len / 2 + 0.56 + 0.04), r.ye - 0.05, sz * r.hz);
    if (ex < 0) m.premultiply(new Matrix4()); // the extrusion runs +x for both ends; the board is symmetric enough to read from either side
    addGeo(p.m, geo, m, { tile: T.beam, col, us: 1.2, vs: 1.2 });
  }
  // pole finials at the ridge ends
  for (const ex of [-1, 1]) box(p.m, ex * (len / 2 + 0.55) - 0.07, r.yr - 0.1, -0.07, ex * (len / 2 + 0.55) + 0.07, r.yr + 0.7 * sc, 0.07, { tile: T.beam, col, ao: 0.9 });
}

// ---- wall-frame details
export function door(p, o = {}) {
  const { w = 1.1, h = 2.2, col = 0xffffff, lit = WARM, glowH = 0.5 } = o;
  addGeo(p.m, new ExtrudeGeometry(archShape(w + 0.5, h + 0.28, { w, y: 0, h }), { ...EX, depth: 0.16 }), mat(), { tile: T.beam, col, us: 1.2 });
  addGeo(p.m, new ExtrudeGeometry(archShape(w, h), { ...EX, depth: 0.05 }), mat(0, 0, -0.04), { tile: T.door, col: o.leaf ?? 0xffffff, us: w, vs: h, org: [-w / 2, 0, 0] });
  const fan = new ShapeGeometry(archShape(w * 0.46, glowH)); // lit arched fanlight in the leaf
  addGeo(p.g, fan, mat(0, h * 0.5, 0.032), { tile: 0, col: lit });
  box(p.m, -w / 2 - 0.45, -0.1, 0, w / 2 + 0.45, 0.16, 0.7, { tile: T.stone, ao: 0.7 }); // step
  box(p.m, -w * 0.33 - 0.03, h * 0.5 - 0.02, 0.06, -w * 0.33 + 0.03, h * 0.5 + 0.02, 0.1, { tile: T.beam }); // handle
}
export function win(p, o = {}) {
  const { w = 0.75, h = 0.95, y = 1.3, shut = 0xc8503c, lit = WARM, trim = 0xe0d0c0, shutters = true } = o;
  const hw = w / 2, t = 0.09;
  p.g.quad([-hw, y, 0.02], [hw, y, 0.02], [hw, y + h, 0.02], [-hw, y + h, 0.02], { col: lit, tile: o.on ?? 0 });
  for (const [x0, y0, x1, y1] of [[-hw - t, y - t, hw + t, y], [-hw - t, y + h, hw + t, y + h + t], [-hw - t, y, -hw, y + h], [hw, y, hw + t, y + h]]) box(p.m, x0, y0, 0, x1, y1, 0.09, { tile: T.beam, col: trim, ao: 1 });
  box(p.m, -0.02, y, 0.01, 0.02, y + h, 0.06, { tile: T.beam }); box(p.m, -hw, y + h * 0.5 - 0.02, 0.01, hw, y + h * 0.5 + 0.02, 0.06, { tile: T.beam });
  box(p.m, -hw - 0.13, y - 0.1, 0, hw + 0.13, y - t + 0.01, 0.2, { tile: T.stone, ao: 1 });
  if (shutters) for (const s of [-1, 1]) {
    const x0 = s < 0 ? -hw - 0.42 : hw, x1 = x0 + 0.42;
    box(p.m, x0, y - 0.05, 0, x1, y + h + 0.05, 0.05, { tile: T.shutter, col: shut, ao: 1, us: 0.9, vs: 1.1 });
  }
}
export function lantern(p, o = {}) {
  const { x = 0, y = 2.4, z = 0, hook = true, lit = WARM2 } = o;
  if (hook) { box(p.m, x - 0.03, y + 0.18, z, x + 0.03, y + 0.24, z + 0.5, { tile: T.beam }); box(p.m, x - 0.02, y + 0.1, z + 0.46, x + 0.02, y + 0.24, z + 0.5, { tile: T.beam }); }
  const zc = hook ? z + 0.46 : z;
  box(p.m, x - 0.1, y - 0.14, zc - 0.1, x + 0.1, y - 0.1, zc + 0.1, { tile: T.beam, ao: 1 }); box(p.m, x - 0.11, y + 0.08, zc - 0.11, x + 0.11, y + 0.12, zc + 0.11, { tile: T.beam, ao: 1 });
  box(p.g, x - 0.075, y - 0.1, zc - 0.075, x + 0.075, y + 0.08, zc + 0.075, { col: lit, tile: 0 });
  p.pools.push([x, 0, zc + 0.6, 3.4]);
}
export function banner(p, o = {}) { // hanging cloth on a bracket pole, double sided, swallow-tail
  const { x = 0, y = 3, w = 0.55, len = 1.5, tile = T.clothRed, col = 0xffffff } = o, z = 0.62, yb = y - len, f = { tile, col, us: 1, vs: 1 };
  box(p.m, x - 0.02, y, 0, x + 0.04, y + 0.06, z + 0.04, { tile: T.beam });
  box(p.m, x - 0.04, y - 0.02, z - 0.04, x + w + 0.04, y + 0.04, z + 0.04, { tile: T.beam });
  const quads = [[[x, yb + 0.3, z], [x + w, yb + 0.3, z], [x + w, y - 0.02, z], [x, y - 0.02, z]]];
  const tris = [[[x, yb + 0.3, z], [x, yb, z], [x + w / 2, yb + 0.3, z]], [[x + w / 2, yb + 0.3, z], [x + w, yb, z], [x + w, yb + 0.3, z]]];
  for (const q of quads) { p.m.quad(q[0], q[1], q[2], q[3], f); p.m.quad(q[1], q[0], q[3], q[2], f); }
  for (const t of tris) { p.m.tri(t[0], t[1], t[2], f); p.m.tri(t[0], t[2], t[1], f); }
}

// ---- stone chimney with a smoke point
export function chimney(p, x, z, yBase, yTop, w = 0.8) {
  box(p.m, x - w / 2, yBase, z - w / 2, x + w / 2, yTop, z + w / 2, { tile: T.stone, ao: 0.8, us: 0.9, vs: 0.9 });
  box(p.m, x - w / 2 - 0.1, yTop - 0.02, z - w / 2 - 0.1, x + w / 2 + 0.1, yTop + 0.14, z + w / 2 + 0.1, { tile: T.stone, ao: 1 });
  p.smoke.push([x, yTop + 0.3, z]);
}

// ---- small lathe/cylinder props shared by buildings and the village
let barrelGeo;
export function barrel(b, x, y, z, s = 1, col = 0xe8d0b0) {
  barrelGeo ||= new LatheGeometry([[0.0, 0], [0.3, 0], [0.37, 0.12], [0.42, 0.4], [0.37, 0.68], [0.3, 0.8], [0.0, 0.8]].map(([r, h]) => new Vector2(r, h)), 9);
  addGeo(b, barrelGeo, mat(x, y, z, 0, 0, 0, s), { tile: T.planksV, col, us: 0.8, h: 0.8 * s, y0: y, ao: 0.7 });
  for (const hy of [0.16, 0.62]) { const r = hy < 0.3 ? 0.4 : 0.4; addGeo(b, new CylinderGeometry(r * s + 0.01, r * s + 0.01, 0.045 * s, 9, 1, true), mat(x, y + hy * s, z), { tile: T.beam, col: 0x808088 }); }
}
export const stool = (b, x, y, z, col = 0xe0c8a8) => { addGeo(b, new CylinderGeometry(0.17, 0.2, 0.46, 7), mat(x, y + 0.23, z), { tile: T.planksV, col, us: 0.5 }); addGeo(b, new CylinderGeometry(0.22, 0.22, 0.06, 8), mat(x, y + 0.48, z), { tile: T.planksH, col, us: 0.5 }); };
export function table(b, x, y, z, col = 0xf0d8b8) {
  addGeo(b, new CylinderGeometry(0.5, 0.5, 0.06, 10), mat(x, y + 0.75, z), { tile: T.planksH, col, us: 1 });
  addGeo(b, new CylinderGeometry(0.07, 0.12, 0.74, 6), mat(x, y + 0.37, z), { tile: T.beam });
  for (let k = 0; k < 3; k++) { const a = k * 2.1 + x; stool(b, x + Math.cos(a) * 0.85, y, z + Math.sin(a) * 0.85); }
}
export { box, boxC, beam, addGeo, mat, P };
