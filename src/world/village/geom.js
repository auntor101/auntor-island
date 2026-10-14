// Tiny merged-geometry builder: indexed quads/tris with vertex colours, an atlas tile (or glow flag) per vertex, flat normals.
import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute, Color, Matrix4, Matrix3, Euler, Quaternion, Vector3 } from 'three';

const _c = new Color(), _q = new Quaternion(), _e = new Euler(), _v = new Vector3(), _s = new Vector3();
export const rgb = (c) => { if (Array.isArray(c)) return c; _c.set(c); return [_c.r, _c.g, _c.b]; };
// translation + yaw (ry) + roll (rz) + pitch (rx) + uniform scale
export const mat = (x = 0, y = 0, z = 0, ry = 0, rz = 0, rx = 0, s = 1) => new Matrix4().compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.set(s, s, s));
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

export class B {
  constructor() { this.p = []; this.n = []; this.c = []; this.u = []; this.t = []; this.i = []; }
  get count() { return this.p.length / 3; }
  // Quad a,b,c,d counter-clockwise seen from outside. o: tile, col, k (per-vertex shade), us/vs (metres per tile repeat), uo/vo, sw (swap u,v), uv (explicit)
  quad(a, b, c, d, o = {}) {
    const n = norm(cross(sub(c, a), sub(d, b))), e1 = norm(sub(b, a)), e2 = cross(n, e1), us = o.us || 1, vs = o.vs || 1, col = rgb(o.col ?? 0xffffff), k = o.k || [1, 1, 1, 1], base = this.count;
    [a, b, c, d].forEach((p, j) => {
      const q = sub(p, a); let u = dot(q, e1) / us + (o.uo || 0), v = dot(q, e2) / vs + (o.vo || 0);
      if (o.sw) [u, v] = [v, u];
      if (o.uv) [u, v] = o.uv[j];
      this.p.push(p[0], p[1], p[2]); this.n.push(n[0], n[1], n[2]);
      this.c.push(col[0] * k[j], col[1] * k[j], col[2] * k[j]); this.u.push(u, v); this.t.push(o.tile ?? 0);
    });
    this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  tri(a, b, c, o = {}) {
    const n = norm(cross(sub(b, a), sub(c, a))), e1 = norm(sub(b, a)), e2 = cross(n, e1), us = o.us || 1, vs = o.vs || 1, col = rgb(o.col ?? 0xffffff), k = o.k || [1, 1, 1], base = this.count;
    [a, b, c].forEach((p, j) => {
      const q = sub(p, a);
      this.p.push(p[0], p[1], p[2]); this.n.push(n[0], n[1], n[2]); this.c.push(col[0] * k[j], col[1] * k[j], col[2] * k[j]);
      this.u.push(dot(q, e1) / us + (o.uo || 0), dot(q, e2) / vs + (o.vo || 0)); this.t.push(o.tile ?? 0);
    });
    this.i.push(base, base + 1, base + 2);
  }
  mark() { return this.count; }
  apply(m, from = 0) {
    const nm = new Matrix3().getNormalMatrix(m);
    for (let i = from; i < this.count; i++) {
      _v.set(this.p[i * 3], this.p[i * 3 + 1], this.p[i * 3 + 2]).applyMatrix4(m); this.p[i * 3] = _v.x; this.p[i * 3 + 1] = _v.y; this.p[i * 3 + 2] = _v.z;
      _v.set(this.n[i * 3], this.n[i * 3 + 1], this.n[i * 3 + 2]).applyMatrix3(nm).normalize(); this.n[i * 3] = _v.x; this.n[i * 3 + 1] = _v.y; this.n[i * 3 + 2] = _v.z;
    }
  }
  append(o, m) {
    const base = this.count, from = base;
    for (let i = 0; i < o.p.length; i++) { this.p.push(o.p[i]); this.n.push(o.n[i]); this.c.push(o.c[i]); }
    o.u.forEach((v) => this.u.push(v)); o.t.forEach((v) => this.t.push(v)); o.i.forEach((v) => this.i.push(v + base));
    if (m) this.apply(m, from);
  }
  geometry(tileName = 'aTile') {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new Float32BufferAttribute(this.c, 3)); g.setAttribute('uv', new Float32BufferAttribute(this.u, 2));
    g.setAttribute(tileName, new Float32BufferAttribute(this.t, 1)); g.setIndex(new Uint32BufferAttribute(this.i, 1));
    g.computeBoundingSphere();
    return g;
  }
}

// A building or prop in progress: main (atlas toon), glow (windows/lanterns), sign boards, plus points for smoke and light pools.
export class P {
  constructor() { this.m = new B(); this.g = new B(); this.s = new B(); this.smoke = []; this.pools = []; }
  get tris() { return (this.m.i.length + this.g.i.length + this.s.i.length) / 3; }
  // run fn, then transform everything it added by matrix m
  xf(m, fn) {
    const a = [this.m.count, this.g.count, this.s.count], ns = this.smoke.length, np = this.pools.length;
    fn();
    this.m.apply(m, a[0]); this.g.apply(m, a[1]); this.s.apply(m, a[2]);
    for (let i = ns; i < this.smoke.length; i++) this.smoke[i] = _v.set(...this.smoke[i]).applyMatrix4(m).toArray();
    for (let i = np; i < this.pools.length; i++) { const p = this.pools[i], q = _v.set(p[0], p[1], p[2]).applyMatrix4(m); this.pools[i] = [q.x, q.y, q.z, p[3]]; }
  }
  append(o, m) {
    this.m.append(o.m, m); this.g.append(o.g, m); this.s.append(o.s, m);
    o.smoke.forEach((p) => this.smoke.push(_v.set(...p).applyMatrix4(m).toArray()));
    o.pools.forEach((p) => { const q = _v.set(p[0], p[1], p[2]).applyMatrix4(m); this.pools.push([q.x, q.y, q.z, p[3]]); });
  }
}

// Axis-aligned box, sides + top (+ optional bottom). o: tile, top (tile), col, ao (bottom shade), us, vs, sw
export function box(b, x0, y0, z0, x1, y1, z1, o = {}) {
  const t = o.tile ?? 0, ao = o.ao ?? 0.7, k = [ao, ao, 1, 1], f = { ...o, tile: t, k };
  b.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], f);
  b.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], f);
  b.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], f);
  b.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], f);
  b.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], { ...o, tile: o.top ?? t, k: [1, 1, 1, 1] });
  if (o.bottom) b.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], { ...o, tile: o.top ?? t, k: [ao, ao, ao, ao] });
}
export const boxC = (b, cx, y0, cz, sx, sy, sz, o) => box(b, cx - sx / 2, y0, cz - sz / 2, cx + sx / 2, y0 + sy, cz + sz / 2, o);
// A box rotated about the vertical axis through (cx, cz)
export function boxR(b, cx, y0, cz, sx, sy, sz, ry, o) { const m = b.mark(); box(b, -sx / 2, y0, -sz / 2, sx / 2, y0 + sy, sz / 2, o); b.apply(mat(cx, 0, cz, ry), m); }
// Box between two points (a beam or pole of square section w)
export function beam(b, a, c, w, o) {
  const d = sub(c, a), L = Math.hypot(...d), m = b.mark(); box(b, -w / 2, 0, -w / 2, w / 2, L, w / 2, o);
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(...d).normalize());
  b.apply(new Matrix4().compose(new Vector3(...a), q, new Vector3(1, 1, 1)), m);
}

// Append any three.js geometry. Triplanar-ish UVs from the dominant normal axis; shade by height with o.y0/o.h (ground darkening).
export function addGeo(b, geo, m, o = {}) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, nm = new Matrix3().getNormalMatrix(m), col = rgb(o.col ?? 0xffffff), us = o.us || 1, org = o.org || [0, 0, 0];
  const base = b.count, v = new Vector3(), n = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(m); n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z), P = [v.x - org[0], v.y - org[1], v.z - org[2]];
    const [u, w] = ax > ay && ax > az ? [P[2], P[1]] : ay > az ? [P[0], P[2]] : [P[0], P[1]];
    const k = o.h ? (o.ao ?? 0.7) + (1 - (o.ao ?? 0.7)) * Math.max(0, Math.min(1, (v.y - (o.y0 || 0)) / o.h)) : 1;
    b.p.push(v.x, v.y, v.z); b.n.push(n.x, n.y, n.z); b.c.push(col[0] * k, col[1] * k, col[2] * k); b.u.push(u / us, w / (o.vs || us)); b.t.push(o.tile ?? 0);
  }
  if (geo.index) for (let i = 0; i < geo.index.count; i++) b.i.push(base + geo.index.getX(i)); else for (let i = 0; i < pos.count; i++) b.i.push(base + i);
}
