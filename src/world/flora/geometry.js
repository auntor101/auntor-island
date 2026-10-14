// Procedural flora geometry: grass clumps, flowers, reeds, far-away tree blobs, driftwood, shells.
// Foliage uvs use the shader's encoding: u = (u + 8) / 16, v = (v + 64) / 68 (models are stored the same way).
import { BufferGeometry, BufferAttribute, IcosahedronGeometry } from 'three';

const enc = (u, v) => [(u + 8) / 16, (v + 64) / 68];
function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

class Builder {
  constructor() { this.P = []; this.N = []; this.U = []; this.C = []; this.I = []; }
  v(p, n, uv, c = [0, 1, 1, 1]) { this.P.push(...p); this.N.push(...n); this.U.push(...uv); this.C.push(...c); return this.P.length / 3 - 1; }
  tri(a, b, c) { this.I.push(a, b, c); }
  quad(a, b, c, d) { this.I.push(a, b, c, c, b, d); }
  build() {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.P), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.N), 3));
    g.setAttribute('uv', new BufferAttribute(new Float32Array(this.U), 2));
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.C), 4));
    g.setIndex(new BufferAttribute(new Uint16Array(this.I), 1));
    return g;
  }
}
const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };

// A clump of tapered, curved blades (4 segments rows, tip is one vertex). uv = (across, height 0..1). 9 blades = 63 verts, 45 tris.
export function grassClump({ blades = 9, height = [0.42, 0.8], width = 0.07, radius = 0.28, lean = 0.28, seed = 3, head = 0 } = {}) {
  const b = new Builder(), r = rng(seed);
  for (let k = 0; k < blades; k++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * radius, cx = Math.cos(a) * d, cz = Math.sin(a) * d;
    const yawB = r() * Math.PI, h = height[0] + (height[1] - height[0]) * r(), w = width * (0.75 + 0.5 * r());
    const dx = Math.cos(yawB), dz = Math.sin(yawB), la = (r() - 0.3) * lean * 2, ld = a + (r() - 0.5);
    const lx = Math.cos(ld), lz = Math.sin(ld), isHead = head && k < head;
    const rows = [0, 0.34, 0.68].map((t) => {
      const bend = la * t * t * h, ww = w * (1 - 0.55 * t), y = h * t, ox = cx + lx * bend, oz = cz + lz * bend;
      const n = norm([lx * la, 1, lz * la]);
      return [b.v([ox - dx * ww, y, oz - dz * ww], n, [0, t], [isHead ? 0 : 0, 1, 1, 1]), b.v([ox + dx * ww, y, oz + dz * ww], n, [1, t], [0, 1, 1, 1])];
    });
    const bend = la * h, tip = b.v([cx + lx * bend, h, cz + lz * bend], norm([lx * la, 1, lz * la]), [0.5, 1]);
    b.quad(rows[0][0], rows[0][1], rows[1][0], rows[1][1]); b.quad(rows[1][0], rows[1][1], rows[2][0], rows[2][1]); b.tri(rows[2][0], rows[2][1], tip);
  }
  return b.build();
}

// Reed: a few tall blades plus two brown cattail heads (colour.r = 1 marks the head).
export function reedClump(seed = 11) {
  const g = grassClump({ blades: 6, height: [1.1, 1.8], width: 0.04, radius: 0.2, lean: 0.14, seed });
  const b = new Builder(), r = rng(seed + 5);
  for (let k = 0; k < 2; k++) {
    const a = r() * 6.28, cx = Math.cos(a) * 0.12, cz = Math.sin(a) * 0.12, y0 = 1.0 + 0.3 * r(), len = 0.34, rad = 0.035;
    const ring = (y, rr) => [0, 1, 2, 3].map((i) => b.v([cx + Math.cos(i * 1.571) * rr, y, cz + Math.sin(i * 1.571) * rr], [Math.cos(i * 1.571), 0.2, Math.sin(i * 1.571)], [0.5, y0 / 1.8], [1, 1, 1, 1]));
    const r0 = ring(y0, rad * 0.5), r1 = ring(y0 + len * 0.5, rad), r2 = ring(y0 + len, rad * 0.4);
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; b.quad(r0[i], r0[j], r1[i], r1[j]); b.quad(r1[i], r1[j], r2[i], r2[j]); }
  }
  // merge the two geometries
  const base = g.attributes.position.count, out = new Builder();
  out.P = [...g.attributes.position.array, ...b.P]; out.N = [...g.attributes.normal.array, ...b.N]; out.U = [...g.attributes.uv.array, ...b.U]; out.C = [...g.attributes.color.array, ...b.C];
  out.I = [...g.index.array, ...b.I.map((i) => i + base)];
  return out.build();
}

// Flower: crossed stem, two leaves, five quad petals and a centre. colour.r = part id (0 stem, .33 leaf, .66 petal, 1 centre); uv.y = height 0..1.
export function flower(seed = 5) {
  const b = new Builder(), r = rng(seed), H = 0.34;
  for (const a of [0, 1.571]) { // stem: two crossed thin quads
    const dx = Math.cos(a) * 0.012, dz = Math.sin(a) * 0.012;
    const s0 = [b.v([-dx, 0, -dz], [0, 1, 0], [0, 0], [0, 1, 1, 1]), b.v([dx, 0, dz], [0, 1, 0], [1, 0], [0, 1, 1, 1])], s1 = [b.v([-dx * 0.7, H, -dz * 0.7], [0, 1, 0], [0, 1], [0, 1, 1, 1]), b.v([dx * 0.7, H, dz * 0.7], [0, 1, 0], [1, 1], [0, 1, 1, 1])];
    b.quad(s0[0], s0[1], s1[0], s1[1]);
  }
  for (const side of [1, -1]) { // two leaves
    const a = side * 1.2, lx = Math.cos(a), lz = Math.sin(a), y = 0.07;
    const l = [b.v([0, y, 0], [0, 1, 0], [0, y / H], [0.33, 1, 1, 1]), b.v([lx * 0.07 - lz * 0.02, y + 0.07, lz * 0.07 + lx * 0.02], [0, 1, 0], [1, 0.4], [0.33, 1, 1, 1]), b.v([lx * 0.07 + lz * 0.02, y + 0.07, lz * 0.07 - lx * 0.02], [0, 1, 0], [0.5, 0.4], [0.33, 1, 1, 1]), b.v([lx * 0.13, y + 0.1, lz * 0.13], [0, 1, 0], [1, 0.5], [0.33, 1, 1, 1])];
    b.quad(l[0], l[1], l[2], l[3]);
  }
  const tilt = 0.35, cy = H, cc = b.v([0, cy + 0.01, 0], [0, 1, 0], [0, 1], [1, 1, 1, 1]);
  const cr = []; for (let i = 0; i < 5; i++) cr.push(b.v([Math.cos(i * 1.2566) * 0.02, cy + 0.012, Math.sin(i * 1.2566) * 0.02], [0, 1, 0], [0, 1], [1, 1, 1, 1]));
  for (let i = 0; i < 5; i++) b.tri(cc, cr[i], cr[(i + 1) % 5]);
  for (let i = 0; i < 5; i++) { // petals: kite from the centre, drooping a little at the tip
    const a = i * 1.2566 + r() * 0.1, c1 = a - 0.5, c2 = a + 0.5, n = [0, 1, 0.3];
    const p0 = b.v([0, cy, 0], n, [0, 1], [0.66, 1, 1, 1]), p1 = b.v([Math.cos(c1) * 0.06, cy + 0.01, Math.sin(c1) * 0.06], n, [0.5, 1], [0.66, 1, 1, 1]), p2 = b.v([Math.cos(c2) * 0.06, cy + 0.01, Math.sin(c2) * 0.06], n, [0.5, 1], [0.66, 1, 1, 1]), p3 = b.v([Math.cos(a) * 0.115, cy + 0.01 - tilt * 0.06, Math.sin(a) * 0.115], n, [1, 1], [0.66, 1, 1, 1]);
    b.quad(p0, p1, p2, p3);
  }
  return b.build();
}

// ---- far tree stand-ins: lumpy blobs from low icospheres, radial normals, uv inside an opaque leaf patch ----
const LEAF_UV = enc(0.52, 0.3), BARK_UV = enc(0.5, 0.5);
function blob(b, cx, cy, cz, rx, ry, rz, seed, leafUv = LEAF_UV, shade = 0.9) {
  const ico = new IcosahedronGeometry(1, 0), p = ico.attributes.position, r = rng(seed), jit = {};
  for (let i = 0; i < p.count; i++) {
    const key = p.getX(i).toFixed(2) + p.getY(i).toFixed(2) + p.getZ(i).toFixed(2); // same lump for shared corners
    if (!(key in jit)) jit[key] = 0.86 + 0.28 * r();
    const j = jit[key], x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    b.v([cx + x * rx * j, cy + y * ry * j, cz + z * rz * j], norm([x, y * 1.1 + 0.2, z]), leafUv, [1, shade * (0.7 + 0.3 * (y * 0.5 + 0.5)), 0, 1]);
    if (i % 3 === 2) b.tri(b.P.length / 3 - 3, b.P.length / 3 - 2, b.P.length / 3 - 1);
  }
}
function prism(b, sides, y0, y1, r0, r1, cx = 0, cz = 0, uvb = BARK_UV) {
  const ring = (y, r) => { const o = []; for (let s = 0; s < sides; s++) { const a = s / sides * 6.2832; o.push(b.v([cx + Math.cos(a) * r, y, cz + Math.sin(a) * r], norm([Math.cos(a), 0.15, Math.sin(a)]), uvb, [0, 1, 1, 1])); } return o; };
  const a = ring(y0, r0), c = ring(y1, r1);
  for (let s = 0; s < sides; s++) { const t = (s + 1) % sides; b.quad(a[s], a[t], c[s], c[t]); }
}
function crown(b) {
  blob(b, 0, 6.1, 0, 3.4, 2.9, 3.4, 1); blob(b, 1.9, 4.9, 0.9, 2.3, 2, 2.3, 2); blob(b, -1.8, 5.3, -1.1, 2.4, 2.1, 2.4, 3); blob(b, 0.2, 8.0, -0.2, 2.0, 1.7, 2.0, 4, LEAF_UV, 1);
}
export function treeFar() { // about 90 triangles
  const b = new Builder();
  prism(b, 4, -0.2, 4.2, 0.42, 0.22);
  crown(b);
  return b.build();
}
// Mid-distance tree: the loaded card crown (a few enlarged leaf cards plus trunk) with the lumpy blobs behind it for mass.
export function withCrown(cards) {
  const b = new Builder(), p = cards.attributes.position, n = cards.attributes.normal, u = cards.attributes.uv, c = cards.attributes.color;
  for (let i = 0; i < p.count; i++) b.v([p.getX(i), p.getY(i), p.getZ(i)], [n.getX(i), n.getY(i), n.getZ(i)], [u.getX(i), u.getY(i)], [c.getX(i), c.getY(i), c.getZ(i), 1]);
  for (const i of cards.index.array) b.I.push(i);
  const before = b.P.length / 3; crown(b);
  void before;
  return b.build();
}
const PINE_UV = enc(0.5, 0.5);
function cone(b, y, h, r, sides = 6) {
  const base = [], tip = b.v([0, y + h, 0], [0, 1, 0], PINE_UV, [1, 1, 0, 1]);
  for (let s = 0; s < sides; s++) { const a = s / sides * 6.2832; base.push(b.v([Math.cos(a) * r, y, Math.sin(a) * r], norm([Math.cos(a), 0.6, Math.sin(a)]), PINE_UV, [1, 0.6, 0, 1])); }
  for (let s = 0; s < sides; s++) b.tri(base[s], base[(s + 1) % sides], tip);
}
export function pineFar() { const b = new Builder(); prism(b, 4, -0.2, 2, 0.3, 0.2); cone(b, 1.6, 3.6, 2.7); cone(b, 3.8, 3.4, 2.0); cone(b, 6, 3.4, 1.3); return b.build(); } // ~22 tris
export function deadFar() {
  const b = new Builder();
  prism(b, 5, -0.2, 7, 0.4, 0.1);
  for (const [dx, dz, y] of [[1, 0.3, 4.2], [-0.8, 0.6, 5], [0.2, -1, 5.8]]) { // three thin branches: tapered 3-sided sticks leaning outwards
    const ring = (o, yy, rr) => [0, 1, 2].map((k) => b.v([o * dx * 1.7 + Math.cos(k * 2.09) * rr, yy + o * 1.5, o * dz * 1.7 + Math.sin(k * 2.09) * rr], [Math.cos(k * 2.09), 0.3, Math.sin(k * 2.09)], BARK_UV, [0, 1, 1, 1]));
    const a = ring(0, y, 0.09), c = ring(1, y, 0.02);
    for (let k = 0; k < 3; k++) b.quad(a[k], a[(k + 1) % 3], c[k], c[(k + 1) % 3]);
  }
  return b.build();
}

// Beach props use plain vertex colours (shader mode VCOL).
export function driftwood() {
  const b = new Builder(), sides = 6, rows = [[0, 0.2], [0.8, 0.23], [1.7, 0.2], [2.6, 0.15]], rings = [];
  for (const [x, r] of rows) { const o = []; for (let s = 0; s < sides; s++) { const a = s / sides * 6.2832; o.push(b.v([x - 1.3, 0.15 + Math.sin(x * 1.2) * 0.07 + Math.sin(a) * r, Math.cos(a) * r], norm([0.1, Math.sin(a), Math.cos(a)]), [0, 0], s % 2 ? [0.52, 0.45, 0.38, 1] : [0.42, 0.36, 0.3, 1])); } rings.push(o); }
  for (let i = 0; i < 3; i++) for (let s = 0; s < sides; s++) { const t = (s + 1) % sides; b.quad(rings[i][s], rings[i][t], rings[i + 1][s], rings[i + 1][t]); }
  return b.build();
}
export function shell() { // flat fan of ridges
  const b = new Builder(), c = b.v([0, 0.03, 0], [0, 1, 0], [0, 0], [1, 0.93, 0.88, 1]), ring = [];
  for (let i = 0; i <= 6; i++) { const a = -1 + i / 3; ring.push(b.v([Math.sin(a) * 0.12, 0.012 + (i % 2) * 0.012, Math.cos(a) * 0.12 - 0.04], [0, 1, 0.3], [0, 0], i % 2 ? [1, 0.78, 0.72, 1] : [0.98, 0.9, 0.85, 1])); }
  for (let i = 0; i < 6; i++) b.tri(c, ring[i], ring[i + 1]);
  return b.build();
}
