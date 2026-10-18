// Meshes for the trail network: 3 draw calls in total.
//  1. one merged ribbon (soft-edged dirt or stone, draped on the terrain)
//  2. one merged "props" mesh: plank bridges, signposts with a canvas-atlas label texture, lantern posts
//  3. one merged glow mesh: lantern lamps (emissive, brightened at night, no real lights)
import { BufferGeometry, Float32BufferAttribute, Mesh, Group, CanvasTexture, DoubleSide, SRGBColorSpace, LinearMipmapLinearFilter } from 'three';
import { toonMat } from '../common/toon.js';
import { buildPaths, NC, CELL, HALF } from './network.js';

const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

class MB { // tiny mesh builder: flat-shaded quads, vertex colour (rgba) and atlas uv
  constructor() { this.p = []; this.n = []; this.c = []; this.u = []; this.i = []; }
  quad(a, b, c, d, nrm, col, uv) { // corners left-bottom, right-bottom, right-top, left-top as seen from outside
    const o = this.p.length / 3;
    for (const q of [a, b, c, d]) { this.p.push(q[0], q[1], q[2]); this.n.push(nrm[0], nrm[1], nrm[2]); this.c.push(col[0], col[1], col[2], col[3] ?? 1); }
    this.u.push(uv[0], uv[3], uv[2], uv[3], uv[2], uv[1], uv[0], uv[1]);
    this.i.push(o, o + 1, o + 2, o, o + 2, o + 3);
  }
  tri(a, b, c, nrm, col, uv) {
    const o = this.p.length / 3;
    for (const q of [a, b, c]) { this.p.push(q[0], q[1], q[2]); this.n.push(nrm[0], nrm[1], nrm[2]); this.c.push(col[0], col[1], col[2], 1); this.u.push(uv[0], uv[1]); }
    this.i.push(o, o + 1, o + 2);
  }
  // box centred on (cx, cz), bottom at y0, local axes rotated by yaw about y (local +z = (sin yaw, cos yaw)). front = uv for the +z face, rest = uv for others.
  box(cx, y0, cz, sx, sy, sz, yaw, col, rest, front = rest, top = rest) {
    const s = Math.sin(yaw), k = Math.cos(yaw), hx = sx / 2, hz = sz / 2, y1 = y0 + sy;
    const W = (lx, y, lz) => [cx + lx * k + lz * s, y, cz - lx * s + lz * k], N = (lx, ly, lz) => [lx * k + lz * s, ly, -lx * s + lz * k];
    this.quad(W(-hx, y0, hz), W(hx, y0, hz), W(hx, y1, hz), W(-hx, y1, hz), N(0, 0, 1), col, front);
    this.quad(W(hx, y0, -hz), W(-hx, y0, -hz), W(-hx, y1, -hz), W(hx, y1, -hz), N(0, 0, -1), col, rest);
    this.quad(W(hx, y0, hz), W(hx, y0, -hz), W(hx, y1, -hz), W(hx, y1, hz), N(1, 0, 0), col, rest);
    this.quad(W(-hx, y0, -hz), W(-hx, y0, hz), W(-hx, y1, hz), W(-hx, y1, -hz), N(-1, 0, 0), col, rest);
    this.quad(W(-hx, y1, hz), W(hx, y1, hz), W(hx, y1, -hz), W(-hx, y1, -hz), N(0, 1, 0), col, top);
    return { W, N };
  }
  geometry() {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new Float32BufferAttribute(this.c, 4));
    g.setAttribute('uv', new Float32BufferAttribute(this.u, 2));
    g.setIndex(this.i);
    return g;
  }
  get tris() { return this.i.length / 3; }
}

// ---- label atlas: cell 0 is plain wood grain, then one cell per place name (2 columns of 256x64)
const CW = 256, CH = 64, COLS = 2;
function makeAtlas(names) {
  const rows = Math.ceil((names.length + 1) / COLS), c = document.createElement('canvas');
  c.width = CW * COLS; c.height = CH * rows;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = 'rgba(120,90,60,.18)'; g.lineWidth = 1;
  for (let y = 4; y < c.height; y += 7) { g.beginPath(); g.moveTo(0, y + hash(y, 1) * 3); g.lineTo(c.width, y + hash(y, 2) * 3); g.stroke(); }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 34px Georgia, "Times New Roman", serif';
  const uv = [[0.005, 0.995, 0.015, 0.985]]; // uv rect = [u0, vTop, u1, vBottom]; the plain cell is a speck of the grain
  names.forEach((nm, k) => {
    const cell = k + 1, x = (cell % COLS) * CW, y = Math.floor(cell / COLS) * CH;
    g.fillStyle = '#fff'; g.fillRect(x, y, CW, CH);
    g.fillStyle = 'rgba(70,40,15,.35)'; g.fillRect(x, y, CW, 4); g.fillRect(x, y + CH - 4, CW, 4);
    g.fillStyle = '#2a1808'; g.fillText(nm, x + CW / 2, y + CH / 2 + 2, CW - 20);
    uv.push([x / c.width, 1 - y / c.height, (x + CW) / c.width, 1 - (y + CH) / c.height]);
  });
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace; tex.anisotropy = 4; tex.minFilter = LinearMipmapLinearFilter; tex.generateMipmaps = true;
  return { tex, uv };
}

const WOOD = [0.48, 0.32, 0.19, 1], PLANK = [0.66, 0.47, 0.28, 1], BOARD = [0.93, 0.76, 0.46, 1], DIRT = [0.74, 0.55, 0.34], STONE = [0.6, 0.58, 0.56];
const ROCKY = new Set(['mountain', 'glacier', 'volcano', 'roost', 'tower']);

export function createPaths(scene, L, env) {
  const { heightAt, zoneAt } = env, net = buildPaths(L, env), group = new Group();
  group.name = 'paths';
  const hyp = Math.hypot, V = L.colliders;
  const blocked = (x, z, pad) => V.some((c) => {
    if (c.kind === 'circle') return hyp(x - c.x, z - c.z) < c.r + pad;
    const co = Math.cos(c.rot), si = Math.sin(c.rot), ax = x - c.x, az = z - c.z;
    return Math.abs(ax * co - az * si) < c.hw + pad && Math.abs(ax * si + az * co) < c.hd + pad;
  });
  const free = (x, z, pad = 0.9) => !env.isWet(x, z) && !blocked(x, z, pad) && !net.groundAt(x, z);

  // ---- 1. ribbon
  const rb = new MB(), ROWS = [[-1, 0, 0.78], [-0.55, 1, 1], [0.55, 1, 1], [1, 0, 0.78]]; // [offset across, alpha, shade]
  for (const p of net.pieces) {
    let run = [];
    const flush = () => {
      if (run.length >= 2) {
        const rows = run.map((q, k) => {
          const a = run[Math.max(0, k - 1)], b = run[Math.min(run.length - 1, k + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = hyp(dx, dz) || 1, sx = dz / l, sz = -dx / l;
          const hw = 1.25 * (0.88 + 0.24 * hash(q[0] * 0.3, q[1] * 0.3)), zone = zoneAt(q[0], q[1]), base = ROCKY.has(zone) || heightAt(q[0], q[1]) > 40 ? STONE : DIRT, v = 0.93 + 0.14 * hash(q[0] * 0.7, q[1] * 0.7);
          return ROWS.map(([o, al, sh]) => { const x = q[0] + sx * o * hw, z = q[1] + sz * o * hw; return { p: [x, heightAt(x, z) + 0.13, z], c: [base[0] * v * sh, base[1] * v * sh, base[2] * v * sh, al] }; });
        });
        for (let k = 0; k + 1 < rows.length; k++) for (let j = 0; j < 3; j++) {
          const a = rows[k][j], b = rows[k + 1][j], c = rows[k + 1][j + 1], d = rows[k][j + 1], o = rb.p.length / 3;
          for (const q of [a, b, c, d]) { rb.p.push(...q.p); rb.n.push(0, 1, 0); rb.c.push(...q.c); rb.u.push(0, 0); }
          rb.i.push(o, o + 1, o + 2, o, o + 2, o + 3);
        }
      }
      run = [];
    };
    p.pts.forEach((q, k) => { if (p.br[k] || net.nearRoad(q[0], q[1])) flush(); else run.push(q); });
    flush();
  }
  const ribbonMat = toonMat(0xffffff, { vertexColors: true, transparent: true, depthWrite: false, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const ribbon = new Mesh(rb.geometry(), ribbonMat);
  ribbon.renderOrder = 1; ribbon.frustumCulled = false; group.add(ribbon);

  // ---- 2. props: bridges, signposts, lantern posts. 3. lamps
  const names = net.pois.map((q) => q.name), atlas = makeAtlas(names), cellOf = Object.fromEntries(net.pois.map((q, k) => [q.id, atlas.uv[k + 1]])), plain = atlas.uv[0];
  const pb = new MB(), gb = new MB(), jit = (c, a, b) => { const v = 0.92 + 0.16 * hash(a, b); return [c[0] * v, c[1] * v, c[2] * v, 1]; };

  for (const b of net.bridges) { // plank bridge: deck planks, two side beams, rails
    const { x, z, len, yaw, w, y } = b, s = Math.sin(yaw), k = Math.cos(yaw);
    const planks = Math.floor(len / 0.5);
    for (let i = 0; i < planks; i++) { const t = (i + 0.5) * len / planks; pb.box(b.ax + b.dx * t, y - 0.1, b.az + b.dz * t, w, 0.1, len / planks - 0.05, yaw, jit(PLANK, i, x), plain); }
    for (const sgn of [-1, 1]) {
      const lx = sgn * (w / 2 - 0.1), px = x + lx * k, pz = z - lx * s;
      pb.box(px, y - 0.4, pz, 0.2, 0.3, len, yaw, WOOD, plain);
      for (let t = 0; t <= len + 0.01; t += len / Math.max(1, Math.round(len / 1.6))) pb.box(b.ax + b.dx * t + lx * k, y, b.az + b.dz * t - lx * s, 0.13, 0.95, 0.13, yaw, WOOD, plain);
      pb.box(px, y + 0.82, pz, 0.12, 0.12, len, yaw, jit(WOOD, sgn, x), plain);
    }
    for (const t of [0.4, len - 0.4]) for (const sgn of [-1, 1]) pb.box(b.ax + b.dx * t + sgn * (w / 2 - 0.1) * k, y - 2.2, b.az + b.dz * t - sgn * (w / 2 - 0.1) * s, 0.22, 2.1, 0.22, yaw, WOOD, plain);
  }

  const sy = (x, z) => heightAt(x, z);
  const bearing = new Map(); // per place: outgoing directions to neighbours
  for (const e of net.edges) {
    if (!e.ok) continue;
    const dir = (from, cells) => { const a = net.poi[from], n = cells[Math.min(cells.length - 1, 3)], dx = (-HALF + ((n % NC) + 0.5) * CELL) - a.x, dz = (-HALF + (((n / NC) | 0) + 0.5) * CELL) - a.z, l = hyp(dx, dz) || 1; return [dx / l, dz / l]; };
    const add = (from, to, cells) => (bearing.get(from) || bearing.set(from, []).get(from)).push({ to, d: dir(from, cells) });
    add(e.from, e.to, e.cells); add(e.to, e.from, e.cells.slice().reverse());
  }
  const post = (x, z, list, ownId, faceX, faceZ) => { // one signpost with a board per outgoing trail and the place name on top
    const y = sy(x, z), tall = 2.2 + list.length * 0.4;
    pb.box(x, y - 0.1, z, 0.2, tall + 0.1, 0.2, 0, WOOD, plain);
    pb.box(x, y + tall, z, 0.28, 0.1, 0.28, 0, WOOD, plain);
    list.forEach((o, k) => {
      const yaw = Math.atan2(-o.d[1], o.d[0]), by = y + tall - 1.05 - k * 0.42, len = 1.5, h = 0.34, cxm = x + o.d[0] * (len / 2 + 0.1), czm = z + o.d[1] * (len / 2 + 0.1);
      const bm = pb.box(cxm, by, czm, len, h, 0.06, yaw, jit(BOARD, k, x), plain, cellOf[o.to]);
      const hx = len / 2, hz = 0.03, tipL = 0.3, ym = by + h / 2, col = jit(BOARD, k + 3, z);
      pb.tri(bm.W(hx, by, hz), bm.W(hx + tipL, ym, hz), bm.W(hx, by + h, hz), bm.N(0, 0, 1), col, [plain[0], plain[1]]);
      pb.tri(bm.W(hx, by, -hz), bm.W(hx, by + h, -hz), bm.W(hx + tipL, ym, -hz), bm.N(0, 0, -1), col, [plain[0], plain[1]]);
    });
    // name plate on top, turned toward the first trail
    const fx = faceX - x, fz = faceZ - z, yaw = Math.atan2(fx, fz), top = y + tall - 0.28;
    pb.box(x + Math.sin(yaw) * 0.14, top, z + Math.cos(yaw) * 0.14, 1.5, 0.4, 0.06, yaw, jit(BOARD, 9, x + z), plain, cellOf[ownId]);
  };
  const signs = [];
  for (const q of net.pois) {
    const list = (bearing.get(q.id) || []).slice().sort((a, b) => Math.atan2(a.d[1], a.d[0]) - Math.atan2(b.d[1], b.d[0]));
    if (!list.length) continue;
    // stand the post 2 m to the side of the first trail so the front of the boards faces it; search outward for free ground
    const d0 = list[0].d, nx = -d0[1], nz = d0[0];
    let px = q.x, pz = q.z, found = false;
    for (const r of [2, 2.8, 3.6, 4.6, 6, 8]) { for (let a = 0; a < 8 && !found; a++) { const an = Math.atan2(nz, nx) + Math.PI + a * 0.785, x = q.x + Math.cos(an) * r, z = q.z + Math.sin(an) * r; if (free(x, z)) { px = x; pz = z; found = true; } } if (found) break; }
    post(px, pz, list, q.id, q.x, q.z);
    signs.push({ id: q.id, x: px, z: pz });
  }

  // lanterns: along the village roads and every trail
  const lanterns = [];
  const lampAt = (x, z) => {
    const y = sy(x, z);
    pb.box(x, y - 0.1, z, 0.12, 2.2, 0.12, 0, WOOD, plain);
    pb.box(x, y + 2.05, z, 0.42, 0.06, 0.42, 0, WOOD, plain);
    pb.box(x, y + 2.52, z, 0.5, 0.08, 0.5, 0, WOOD, plain);
    gb.box(x, y + 2.11, z, 0.3, 0.41, 0.3, 0, [1, 0.8, 0.45, 1], plain);
    lanterns.push([x, z]);
  };
  const along = (pts, every, side, skip) => {
    let d = every * 0.5, flip = 1;
    for (let k = 0; k + 1 < pts.length; k++) {
      const [ax, az] = pts[k], [bx, bz] = pts[k + 1], l = hyp(bx - ax, bz - az);
      while (d < l) {
        const t = d / l, x = ax + (bx - ax) * t, z = az + (bz - az) * t, nx = -(bz - az) / l, nz = (bx - ax) / l;
        const lx = x + nx * side * flip, lz = z + nz * side * flip;
        if (!(skip && skip(k, lx, lz)) && free(lx, lz, 1.2) && lanterns.every((q) => hyp(q[0] - lx, q[1] - lz) > 5)) lampAt(lx, lz);
        flip = -flip; d += every;
      }
      d -= l;
    }
  };
  for (const r of L.roads) if (r.name !== 'ring') along(r.pts, 15, r.width / 2 + 0.7);
  for (const p of net.pieces) along(p.pts, 22, 1.9, (k) => p.br[k] || p.br[Math.min(p.br.length - 1, k + 1)]);

  const propsMat = toonMat(0xffffff, { vertexColors: true, map: atlas.tex });
  const props = new Mesh(pb.geometry(), propsMat);
  props.frustumCulled = false; group.add(props);
  const lampMat = toonMat(0xffd27a, { emissive: 0xffa640, emissiveIntensity: 0.15, vertexColors: true });
  const lamps = new Mesh(gb.geometry(), lampMat);
  lamps.frustumCulled = false; group.add(lamps);
  scene.add(group);

  const keepOut = (x, z, r = 0) => net.onTrail(x, z, r) || net.bridges.some((b) => hyp(x - b.x, z - b.z) < b.len / 2 + 3 + r);
  const stats = { ...net.stats, calls: 3, tris: rb.tris + pb.tris + gb.tris, ribbonTris: rb.tris, propTris: pb.tris, lampTris: gb.tris, lanterns: lanterns.length, signs: signs.length };
  function update(pal) {
    const night = smooth(0.03, 0.3, pal?.stars ?? 0);
    lampMat.emissiveIntensity = 0.15 + 1.6 * night;
  }
  function dispose() { scene.remove(group); [ribbon, props, lamps].forEach((m) => { m.geometry.dispose(); m.material.dispose(); }); atlas.tex.dispose(); }
  return { net, group, update, keepOut, groundAt: net.groundAt, stats, signs, lanterns, dispose };
}
