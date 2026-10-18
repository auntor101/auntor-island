// Tiny merged-geometry builder for the landmarks: three primitives posed and vertex-coloured, merged into 3 buckets
// (toon solids, glow, eggs) per landmark. Local frame: the mesh is later placed at the site and rotated by its yaw.
import { BoxGeometry, CylinderGeometry, ConeGeometry, IcosahedronGeometry, SphereGeometry, TorusGeometry, BufferGeometry, Float32BufferAttribute, Matrix4, Euler, Quaternion, Vector3, Color } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _m = new Matrix4(), _e = new Euler(), _q = new Quaternion(), _v = new Vector3(), _s = new Vector3(), _c = new Color();
const rgb = (c) => { if (Array.isArray(c)) return c; _c.set(c); return [_c.r, _c.g, _c.b]; };

export class Mesher {
  constructor(H) { this.H = H; this.bucket = { solid: [], glow: [], egg: [] }; }
  // geo: fresh three geometry. o: ry/rx/rz pose, sx/sy/sz scale, to: 'glow'|'egg' (default solid)
  put(geo, x, y, z, col, o = {}) {
    geo.applyMatrix4(_m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ')), _s.set(o.sx || 1, o.sy || 1, o.sz || 1)));
    const g = geo.index ? geo.toNonIndexed() : geo, p = g.attributes.position, c = rgb(col), out = new Float32Array(p.count * 3);
    g.deleteAttribute('uv');
    let lo = 1e9, hi = -1e9;
    for (let i = 0; i < p.count; i++) { lo = Math.min(lo, p.getY(i)); hi = Math.max(hi, p.getY(i)); }
    for (let i = 0; i < p.count; i++) {
      const k = o.to === 'glow' || o.to === 'egg' ? 1 : 0.8 + 0.2 * (p.getY(i) - lo) / Math.max(hi - lo, 0.01); // soft painted gradient: darker at the foot
      out[i * 3] = c[0] * k; out[i * 3 + 1] = c[1] * k; out[i * 3 + 2] = c[2] * k;
    }
    g.setAttribute('color', new Float32BufferAttribute(out, 3));
    this.bucket[o.to || 'solid'].push(g);
  }
  box(w, h, d, x, y, z, col, o) { this.put(new BoxGeometry(w, h, d), x, y, z, col, o); }
  cyl(rt, rb, h, seg, x, y, z, col, o) { this.put(new CylinderGeometry(rt, rb, h, seg), x, y, z, col, o); }
  cone(r, h, seg, x, y, z, col, o) { this.put(new ConeGeometry(r, h, seg), x, y, z, col, o); }
  ball(r, det, x, y, z, col, o) { this.put(new IcosahedronGeometry(r, det), x, y, z, col, o); }
  dome(r, seg, x, y, z, col, o) { this.put(new SphereGeometry(r, seg, Math.ceil(seg / 2), 0, Math.PI * 2, 0, Math.PI / 2), x, y, z, col, o); }
  torus(R, t, rs, ts, x, y, z, col, o) { this.put(new TorusGeometry(R, t, rs, ts), x, y, z, col, o); }
  // gable roof: ridge along local x, length len, width w, rise h, base at y
  prism(len, w, h, x, y, z, col, o) {
    const a = [-len / 2, 0, -w / 2], b = [-len / 2, 0, w / 2], c = [-len / 2, h, 0], d = [len / 2, 0, -w / 2], e = [len / 2, 0, w / 2], f = [len / 2, h, 0];
    const g = new BufferGeometry(), t = [a, c, b, d, e, f, a, d, f, a, f, c, b, c, f, b, f, e, a, b, e, a, e, d];
    g.setAttribute('position', new Float32BufferAttribute(t.flat(), 3)); g.computeVertexNormals();
    this.put(g, x, y, z, col, o);
  }
  minH(x, z, r) { let lo = this.H(x, z); for (let a = 0; a < 6; a++) lo = Math.min(lo, this.H(x + Math.cos(a * 1.047) * r, z + Math.sin(a * 1.047) * r)); return lo; }
  // a column from below the terrain up to yTop (sinks into slopes)
  pier(x, z, r, yTop, col, seg = 6, o) { const lo = this.minH(x, z, r) - 0.4; this.cyl(r, r, yTop - lo, seg, x, (yTop + lo) / 2, z, col, o); }
  // a block from below the terrain up to yTop, w x d wide, yaw ry
  foot(x, z, w, d, yTop, col, ry = 0) {
    const c = Math.cos(ry), s = Math.sin(ry); let lo = 1e9;
    for (const [i, j] of [[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) lo = Math.min(lo, this.H(x + (i * w / 2) * c + (j * d / 2) * s, z - (i * w / 2) * s + (j * d / 2) * c));
    lo -= 0.4; this.box(w, yTop - lo, d, x, (yTop + lo) / 2, z, col, { ry });
  }
  // flat-coloured ring/disc following the terrain (sx, sz stretch it into an ellipse), r0..r1 in `n` radial bands
  drape(cx, cz, r0, r1, col, seg, n, yoff, sx = 1, sz = 1, to) {
    const P = [], pt = (i, j) => { const t = i / seg * 2 * Math.PI, r = r0 + (r1 - r0) * j / n, x = cx + Math.sin(t) * r * sx, z = cz + Math.cos(t) * r * sz; return [x, this.H(x, z) + yoff, z]; };
    for (let j = 0; j < n; j++) for (let i = 0; i < seg; i++) {
      const a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j + 1), d = pt(i, j + 1);
      for (const t of (r0 === 0 && j === 0) ? [[a, c, d]] : [[a, c, b], [a, d, c]]) { // wind every facet so it faces up
        const up = (t[1][2] - t[0][2]) * (t[2][0] - t[0][0]) - (t[1][0] - t[0][0]) * (t[2][2] - t[0][2]);
        P.push(t[0], up > 0 ? t[1] : t[2], up > 0 ? t[2] : t[1]);
      }
    }
    const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(P.flat(), 3)); g.computeVertexNormals();
    this.put(g, 0, 0, 0, col, { to });
  }
  // merge each bucket; tris counts toon + glow + egg
  finish() {
    const out = { tris: 0 };
    for (const k of ['solid', 'glow', 'egg']) {
      const list = this.bucket[k];
      out[k] = list.length ? mergeGeometries(list) : null;
      if (out[k]) { out[k].computeBoundingSphere(); out.tris += out[k].attributes.position.count / 3; }
    }
    return out;
  }
}
