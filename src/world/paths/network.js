// Pure trail network: a deterministic graph of places joined by grid A* routes over the real terrain.
// No three.js, no DOM. buildPaths(layout) -> { pois, poi, edges, pieces, bridges, groundAt, onTrail, nearRoad, stats }.
import { heightAt as H0, isWet as W0, waterSurfaceAt as S0, LANDMARKS, LAKE } from '../island.js';
import { planSites } from '../landmarks/sites.js';

export const CELL = 3, HALF = 168, NC = (2 * HALF) / CELL, MAX_SLOPE = 0.5, BRIDGE_W = 2.4, STEP = 1.5;
const hyp = Math.hypot;

// The dragon-island landmarks are placed by landmarks/sites.js (planSites); each gets a trail place at its entry point.
const SITE_NAMES = { academy: 'Academy', arena: 'Arena', hatchery: 'Hatchery', springs: 'Hot Springs', tower: 'Wizard Tower', grove: 'Elven Grove', embers: 'Cinder Field', icecave: 'Ice Cave' };
// Trail topology: every place joins the village hub or a neighbour, with a few loops.
export const EDGES = [
  ['village', 'hall'], ['village', 'dock'], ['village', 'beach'], ['beach', 'cove'], ['village', 'academy'], ['academy', 'rings'], ['academy', 'arena'], ['arena', 'hatchery'],
  ['hatchery', 'grove'], ['grove', 'roost'], ['village', 'springs'], ['springs', 'cove'], ['village', 'volcano'], ['volcano', 'embers'], ['volcano', 'tower'], ['village', 'mountain'], ['mountain', 'icecave'], ['grove', 'mountain'],
];

class Heap { // binary min-heap of (key, node)
  constructor() { this.k = []; this.v = []; }
  get size() { return this.v.length; }
  push(key, val) {
    const { k, v } = this; let i = v.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  }
  pop() {
    const { k, v } = this, top = v[0], lk = k.pop(), lv = v.pop(), n = v.length;
    if (n) { let i = 0; for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && k[c + 1] < k[c]) c++; if (k[c] >= lk) break; k[i] = k[c]; v[i] = v[c]; i = c; } k[i] = lk; v[i] = lv; }
    return top;
  }
}

export function buildPaths(L, env = {}) {
  const t0 = performance.now(), heightAt = env.heightAt || H0, isWet = env.isWet || W0, surf = env.waterSurfaceAt || S0;
  const cx = (i) => -HALF + (i + 0.5) * CELL, ci = (v) => Math.min(NC - 1, Math.max(0, Math.floor((v + HALF) / CELL)));
  // ---- grid: height, state (0 dry, 1 river = bridgeable, 2 blocked), road discount
  const Hh = new Float32Array(NC * NC), S = new Uint8Array(NC * NC), R = new Uint8Array(NC * NC);
  const inLake = (x, z) => hyp(x - LAKE.x, z - LAKE.z) < LAKE.r + 9;
  for (let j = 0; j < NC; j++) for (let i = 0; i < NC; i++) {
    const x = cx(i), z = cx(j), h = heightAt(x, z), n = j * NC + i;
    Hh[n] = h;
    if (h < 0.35) S[n] = 2; // sea and shore
    else if (isWet(x, z)) S[n] = inLake(x, z) || (surf(x, z) ?? 0) < 0.5 ? 2 : 1;
  }
  const LM = planSites({ heightAt, isWet }, L.keepOut, L.center);
  for (const c of [...L.colliders, ...LM.colliders]) { // buildings, big props and landmarks block (padded)
    const pad = 1.8, ext = (c.kind === 'circle' ? c.r : hyp(c.hw, c.hd)) + pad;
    for (let j = ci(c.z - ext); j <= ci(c.z + ext); j++) for (let i = ci(c.x - ext); i <= ci(c.x + ext); i++) {
      const x = cx(i), z = cx(j);
      let hit;
      if (c.kind === 'circle') hit = hyp(x - c.x, z - c.z) < c.r + pad;
      else { const co = Math.cos(c.rot), si = Math.sin(c.rot), ax = x - c.x, az = z - c.z, lx = ax * co - az * si, lz = ax * si + az * co; hit = Math.abs(lx) < c.hw + pad && Math.abs(lz) < c.hd + pad; }
      if (hit && S[j * NC + i] === 0) S[j * NC + i] = 2;
    }
  }
  const [vcx, vcz] = L.center, sqR = L.square.r;
  const stamp = (x, z, rad) => { for (let j = ci(z - rad - CELL); j <= ci(z + rad + CELL); j++) for (let i = ci(x - rad - CELL); i <= ci(x + rad + CELL); i++) if (hyp(cx(i) - x, cx(j) - z) <= rad + CELL * 0.4) { const n = j * NC + i; R[n] = 1; if (S[n] === 2 && Hh[n] > 0.35 && !isWet(cx(i), cx(j))) S[n] = 0; } };
  stamp(vcx, vcz, sqR + 1);
  for (const r of L.roads) for (let k = 0; k + 1 < r.pts.length; k++) {
    const [ax, az] = r.pts[k], [bx, bz] = r.pts[k + 1], n = Math.max(1, Math.ceil(hyp(bx - ax, bz - az) / 1.5));
    for (let q = 0; q <= n; q++) stamp(ax + (bx - ax) * q / n, az + (bz - az) * q / n, r.width / 2);
  }
  const nearRoad = (x, z) => R[ci(z) * NC + ci(x)] === 1;

  // ---- places: nudge each to the nearest walkable, gentle cell
  const flat = (n) => { const i = n % NC, j = (n / NC) | 0; if (S[n] !== 0 || i < 1 || j < 1 || i > NC - 2 || j > NC - 2) return false; return Math.abs(Hh[n + 1] - Hh[n - 1]) < 2 * CELL * 0.3 && Math.abs(Hh[n + NC] - Hh[n - NC]) < 2 * CELL * 0.3; };
  const snap = (x, z) => {
    const ox = ci(x), oz = ci(z);
    for (let r = 0; r < 14; r++) {
      let best = -1, bd = 1e9;
      for (let j = oz - r; j <= oz + r; j++) for (let i = ox - r; i <= ox + r; i++) {
        if (i < 0 || j < 0 || i >= NC || j >= NC || Math.max(Math.abs(i - ox), Math.abs(j - oz)) !== r) continue;
        const n = j * NC + i, d = hyp(cx(i) - x, cx(j) - z);
        if (flat(n) && d < bd) { bd = d; best = n; }
      }
      if (best >= 0) return best;
    }
    throw new Error('paths: no walkable cell near ' + x + ',' + z);
  };
  const foot = (p, maxH) => { // walk from a peak toward the village until the ground is low and dry
    const dx = vcx - p.x, dz = vcz - p.z, d = hyp(dx, dz);
    for (let s = 0; s < d; s += 2) { const x = p.x + dx / d * s, z = p.z + dz / d * s; if (heightAt(x, z) <= maxH && !isWet(x, z)) return { x, z }; }
    return { x: vcx, z: vcz };
  };
  const mt = foot(LANDMARKS.mountain, 26), vo = foot(LANDMARKS.volcano, 24), A = Object.fromEntries(Object.entries(L.anchors).map(([k, v]) => [k, Array.isArray(v) ? { x: v[0], z: v[1] } : v])); // layout anchors are [x, z], the village object's {x, z}
  const defs = [
    { id: 'village', name: 'Village', x: vcx, z: vcz }, { id: 'dock', name: 'Harbour', x: A.harbourDock.x, z: A.harbourDock.z }, { id: 'hall', name: 'Great Hall', x: A.greatHall.x, z: A.greatHall.z },
    { id: 'beach', name: 'Beach', ...LANDMARKS.beach }, { id: 'cove', name: 'Cove', x: LANDMARKS.cove.x - 14, z: LANDMARKS.cove.z - 6 }, { id: 'roost', name: 'Dragon Roost', ...LANDMARKS.roost }, { id: 'mountain', name: 'Mountain', ...mt }, { id: 'volcano', name: 'Volcano', ...vo }, { id: 'rings', name: 'Race Rings', x: LM.rings[0].x, z: LM.rings[0].z },
    ...LM.sites.map((q) => ({ id: q.id, name: SITE_NAMES[q.id], x: q.ex, z: q.ez })),
  ];
  const pois = defs.map((d) => { const n = snap(d.x, d.z); return { id: d.id, name: d.name, x: cx(n % NC), z: cx((n / NC) | 0), node: n, h: Hh[n] }; });
  const poi = Object.fromEntries(pois.map((p) => [p.id, p]));

  // ---- A*
  const g = new Float32Array(NC * NC), par = new Int32Array(NC * NC), T = new Uint8Array(NC * NC); // T: cell already on a trail
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  function route(a, b) {
    g.fill(1e9); par.fill(-1);
    const gx = b % NC, gz = (b / NC) | 0, heap = new Heap();
    g[a] = 0; heap.push(0, a);
    while (heap.size) {
      const n = heap.pop();
      if (n === b) break;
      const i = n % NC, j = (n / NC) | 0, gn = g[n];
      for (const [di, dj] of DIRS) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= NC || nj >= NC) continue;
        const m = nj * NC + ni;
        if (S[m] === 2) continue;
        if (di && dj && (S[j * NC + ni] === 2 || S[nj * NC + i] === 2)) continue;
        const d = (di && dj ? 1.4142 : 1) * CELL, wet = S[m] === 1 || S[n] === 1;
        const slope = wet ? 0 : Math.abs(Hh[m] - Hh[n]) / d;
        if (slope > MAX_SLOPE * 0.82) continue; // headroom: cells are 3 m apart, real ground can step between them
        const f = R[m] ? 0.35 : T[m] ? 0.55 : 1, c = gn + d * f * (1 + 4 * (slope / MAX_SLOPE) ** 2) * (wet ? 5 : 1) + (S[m] === 1 ? 6 : 0);
        if (c < g[m]) { g[m] = c; par[m] = n; heap.push(c + hyp(ni - gx, nj - gz) * CELL * 0.4, m); }
      }
    }
    if (par[b] < 0 && a !== b) return null;
    const cells = []; for (let n = b; n >= 0; n = par[n]) cells.push(n);
    return cells.reverse();
  }

  // ---- smoothing (Chaikin, never cutting a corner into water) and even resampling
  const wetNear = (x, z, cells) => { for (const n of cells) if (S[n] === 1 && hyp(cx(n % NC) - x, cx((n / NC) | 0) - z) < CELL * 2) return true; return false; };
  function smooth(pts, cells) {
    for (let it = 0; it < 2; it++) {
      const o = [pts[0]];
      for (let k = 0; k + 1 < pts.length; k++) {
        const p = pts[k], q = pts[k + 1];
        for (const [a, b] of [[0.75, 0.25], [0.25, 0.75]]) { const x = p[0] * a + q[0] * b, z = p[1] * a + q[1] * b; o.push(isWet(x, z) && !wetNear(x, z, cells) ? (a > b ? p : q) : [x, z]); }
      }
      o.push(pts[pts.length - 1]); pts = o;
    }
    const out = [pts[0]]; let acc = 0;
    for (let k = 0; k + 1 < pts.length; k++) {
      const [ax, az] = pts[k], [bx, bz] = pts[k + 1], l = hyp(bx - ax, bz - az);
      let s = STEP - acc;
      while (s <= l) { out.push([ax + (bx - ax) * s / l, az + (bz - az) * s / l]); s += STEP; }
      acc = l - (s - STEP);
    }
    const e = pts[pts.length - 1], last = out[out.length - 1];
    if (hyp(e[0] - last[0], e[1] - last[1]) > 0.3) out.push(e); else out[out.length - 1] = e;
    return out;
  }

  const edges = [], pieces = [], bridges = [];
  for (const [fa, fb] of EDGES) {
    const a = poi[fa], b = poi[fb], cells = route(a.node, b.node);
    if (!cells) { edges.push({ from: fa, to: fb, ok: false, cells: [] }); continue; }
    edges.push({ from: fa, to: fb, ok: true, cells });
    // split into runs of cells not yet on a trail (plus one used cell either side for continuity)
    let run = [];
    const flush = () => { if (run.length >= 2) pieces.push({ edge: fa + '-' + fb, from: fa, to: fb, cells: run.slice() }); run = []; };
    for (let k = 0; k < cells.length; k++) {
      if (T[cells[k]] !== 1) { if (!run.length && k > 0) run.push(cells[k - 1]); run.push(cells[k]); }
      else if (run.length) { run.push(cells[k]); flush(); }
    }
    flush();
    for (const n of cells) T[n] = 1;
  }
  for (const p of pieces) {
    const raw = p.cells.map((n) => [cx(n % NC), cx((n / NC) | 0)]);
    for (const q of pois) { if (q.node === p.cells[0]) raw[0] = [q.x, q.z]; if (q.node === p.cells[p.cells.length - 1]) raw[raw.length - 1] = [q.x, q.z]; }
    p.pts = raw.length > 2 ? smooth(raw, p.cells) : raw;
    p.len = 0; for (let k = 0; k + 1 < p.pts.length; k++) p.len += hyp(p.pts[k + 1][0] - p.pts[k][0], p.pts[k + 1][1] - p.pts[k][1]);
    // bridges: each run of wet samples plus one dry sample either side
    const br = new Array(p.pts.length).fill(false);
    p.pts.forEach((q, k) => { if (isWet(q[0], q[1])) for (let d = -1; d <= 1; d++) if (k + d >= 0 && k + d < br.length) br[k + d] = true; });
    for (let k = 0; k + 3 < br.length; k++) if (br[k] && !br[k + 1] && !br[k + 2] && br[k + 3]) br[k + 1] = br[k + 2] = true;
    p.br = br;
    for (let k = 0; k < br.length;) {
      if (!br[k]) { k++; continue; }
      let e = k; while (e + 1 < br.length && br[e + 1]) e++;
      const a = p.pts[k], b = p.pts[e], dx = b[0] - a[0], dz = b[1] - a[1], len = hyp(dx, dz);
      if (len > 1) bridges.push({ piece: p.edge, ax: a[0], az: a[1], bx: b[0], bz: b[1], x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, len, dx: dx / len, dz: dz / len, yaw: Math.atan2(dx, dz), w: BRIDGE_W, y: Math.max(heightAt(a[0], a[1]), heightAt(b[0], b[1])) + 0.12 });
      k = e + 1;
    }
  }

  // ---- queries
  const groundAt = (x, z) => { // deck height when standing on a bridge, else null
    for (const b of bridges) { const ux = x - b.ax, uz = z - b.az, t = ux * b.dx + uz * b.dz, s = Math.abs(ux * b.dz - uz * b.dx); if (t >= -0.3 && t <= b.len + 0.3 && s < b.w / 2) return b.y; }
    return null;
  };
  const buckets = new Map(), B = 6, key = (i, j) => i * 4096 + j;
  for (const p of pieces) p.pts.forEach(([x, z], k) => { if (p.br[k]) return; const kk = key(Math.floor(x / B), Math.floor(z / B)); (buckets.get(kk) || buckets.set(kk, []).get(kk)).push(x, z); });
  const onTrail = (x, z, r = 0) => { // within a trail's width (+ r)? keeps flora off the paths
    const lim = 2.2 + r, I = Math.floor(x / B), J = Math.floor(z / B);
    for (let i = I - 1; i <= I + 1; i++) for (let j = J - 1; j <= J + 1; j++) { const a = buckets.get(key(i, j)); if (a) for (let k = 0; k < a.length; k += 2) if (hyp(a[k] - x, a[k + 1] - z) < lim) return true; }
    return false;
  };
  const stats = { buildMs: performance.now() - t0, cells: NC * NC, length: pieces.reduce((s, p) => s + p.len, 0), pieces: pieces.length, bridges: bridges.length };
  return { pois, poi, edges, pieces, bridges, groundAt, onTrail, nearRoad, stats };
}
