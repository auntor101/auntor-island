// Pure village layout: positions, footprints, roads, props, harbour. No three.js, no DOM. Deterministic.
// Building frame: x = length, z = width, the door/front faces local +z. rot is yaw: local (lx,lz) -> world (lx cos + lz sin, -lx sin + lz cos).
import { LAKE as LAKE0, RIVERS as RIVERS0, LANDMARKS } from '../island.js';
import { rng } from './rng.js';

export const VENUES = ['tiramisu', 'blueberry-cheesecake', 'mungdi', 'coffee', 'steakhouse', 'seafood', 'asian-fusion', 'velvet-lounge'];
const NORTH_ROW = ['coffee', 'tiramisu', 'blueberry-cheesecake', 'steakhouse']; // door faces +z
const SOUTH_ROW = ['mungdi', 'seafood', 'asian-fusion', 'velvet-lounge']; // door faces -z
export const MAX_SLOPE = 0.15, WATER_MARGIN = 3, SQUARE_R = 9;

const hyp = Math.hypot;
export const toLocal = (f, x, z) => { const c = Math.cos(f.rot), s = Math.sin(f.rot), dx = x - f.x, dz = z - f.z; return [dx * c - dz * s, dx * s + dz * c]; };
export const toWorld = (f, lx, lz) => { const c = Math.cos(f.rot), s = Math.sin(f.rot); return [f.x + lx * c + lz * s, f.z - lx * s + lz * c]; };
export const distToRect = (f, x, z) => { const [lx, lz] = toLocal(f, x, z); return hyp(Math.max(Math.abs(lx) - f.w / 2, 0), Math.max(Math.abs(lz) - f.d / 2, 0)); };
const inRect = (f, x, z) => { const [lx, lz] = toLocal(f, x, z); return Math.abs(lx) <= f.w / 2 && Math.abs(lz) <= f.d / 2; };
const edgePts = (f) => { const o = []; for (let i = 0; i <= 8; i++) for (const [a, b] of [[i / 4 - 1, -1], [i / 4 - 1, 1], [-1, i / 4 - 1], [1, i / 4 - 1]]) o.push(toWorld(f, a * f.w / 2, b * f.d / 2)); o.push([f.x, f.z]); return o; };
// Distance between two footprints (negative when they overlap); sampled, good to a few cm for these sizes.
export function rectGap(a, b) {
  let m = Infinity;
  for (const p of edgePts(a)) m = Math.min(m, inRect(b, p[0], p[1]) ? -1 : distToRect(b, p[0], p[1]));
  for (const p of edgePts(b)) m = Math.min(m, inRect(a, p[0], p[1]) ? -1 : distToRect(a, p[0], p[1]));
  return m;
}
// Steepest gradient between neighbouring samples on a 2 m grid across the footprint.
export function footSlope(f, heightAt) {
  const nx = Math.max(2, Math.ceil(f.w / 2) + 1), nz = Math.max(2, Math.ceil(f.d / 2) + 1), h = [];
  for (let i = 0; i < nx; i++) { h.push([]); for (let j = 0; j < nz; j++) h[i].push(heightAt(...toWorld(f, (i / (nx - 1) - 0.5) * f.w, (j / (nz - 1) - 0.5) * f.d))); }
  const sx = f.w / (nx - 1), sz = f.d / (nz - 1);
  let m = 0;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    if (i + 1 < nx) m = Math.max(m, Math.abs(h[i][j] - h[i + 1][j]) / sx);
    if (j + 1 < nz) m = Math.max(m, Math.abs(h[i][j] - h[i][j + 1]) / sz);
  }
  return m;
}
const segDist = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1))); return hyp(px - ax - t * dx, pz - az - t * dz); };

const why = (m) => { if (globalThis.__vdbg) console.log('plan fail:', m); return null; };
export function planVillage({ heightAt, isWet }, water = { LAKE: LAKE0, RIVERS: RIVERS0 }) {
  const { LAKE, RIVERS } = water;
  // Water test shared by everything: the sea or fresh water from the terrain, plus the contract's lake and river shapes (so we are safe before and after the terrain work lands).
  const wetAt = (x, z) => {
    if (isWet(x, z) || heightAt(x, z) < 0.3) return true;
    if (hyp(x - LAKE.x, z - LAKE.z) < LAKE.r) return true;
    for (const r of RIVERS) for (let i = 0; i + 1 < r.pts.length; i++) if (segDist(x, z, r.pts[i][0], r.pts[i][1], r.pts[i + 1][0], r.pts[i + 1][1]) < r.width / 2) return true;
    return false;
  };
  const wetNear = (x, z, m) => { if (wetAt(x, z)) return true; for (let i = 0; i < 8; i++) if (wetAt(x + Math.cos(i * 0.785) * m, z + Math.sin(i * 0.785) * m)) return true; return false; };
  const rectWetFree = (f) => { // nothing wet within 3 m of the footprint
    const W = f.w + 2 * WATER_MARGIN, D = f.d + 2 * WATER_MARGIN, nx = Math.ceil(W / 2.5), nz = Math.ceil(D / 2.5);
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) if (wetAt(...toWorld(f, (i / nx - 0.5) * W, (j / nz - 0.5) * D))) return false;
    return true;
  };

  const feet = [], roadPts = [], props = [], R = rng(20261014);
  const gapOK = (f, pad) => feet.every((o) => rectGap(f, o) >= pad);
  const roadClear = (f) => roadPts.every((q) => distToRect(f, q[0], q[1]) > q[2] / 2 + 0.4);
  let sqC = [1e9, 1e9];
  const valid = (f, pad = 3) => heightAt(f.x, f.z) > 1 && distToRect(f, sqC[0], sqC[1]) > SQUARE_R + 1.5 && footSlope(f, heightAt) < MAX_SLOPE && rectWetFree(f) && gapOK(f, pad) && roadClear(f);
  const faceTo = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
  // Nearest valid spot to a target (spiral); orientation fixed or facing a point.
  function place(spec, tx, tz, maxR, face, pad) {
    for (let rad = 0; rad <= maxR; rad += 2) {
      const n = rad ? Math.round(6.283 * rad / 2.5) : 1;
      for (let k = 0; k < n; k++) {
        const a = k / n * 6.283 + rad * 0.37, x = tx + Math.cos(a) * rad, z = tz + Math.sin(a) * rad;
        const f = { ...spec, x, z, rot: face ? faceTo(x, z, face[0], face[1]) : spec.rot };
        if (valid(f, pad)) { feet.push(f); return f; }
      }
    }
    return null;
  }
  const front = (f, dist = 1.8) => toWorld(f, 0, f.d / 2 + dist);

  function plan(C) {
    feet.length = 0; roadPts.length = 0; props.length = 0;
    const sq = { x: C[0], z: C[1], r: SQUARE_R }; sqC = C;
    // the square: flat, dry, and clear of water by 3 m
    if (footSlope({ x: sq.x, z: sq.z, rot: 0, w: 2 * SQUARE_R, d: 2 * SQUARE_R }, heightAt) > 0.2 || !rectWetFree({ x: sq.x, z: sq.z, rot: 0, w: 2 * SQUARE_R, d: 2 * SQUARE_R })) return why('square');
    const near = (a, b) => [a[0] + b[0], a[1] + b[1]];
    const key = (type, spec, off, maxR, pad) => place({ type, ...spec }, ...near(C, off), maxR, C, pad);
    // main roads first so buildings keep off them: the Feast Quarter street, the harbour road, a ring lane
    const roads = [];
    const addRoad = (name, kind, width, pts) => { roads.push({ name, kind, width, pts }); };
    const dens = (pts, step = 2) => { const o = []; for (let i = 0; i + 1 < pts.length; i++) { const a = pts[i], b = pts[i + 1], n = Math.max(1, Math.ceil(hyp(b[0] - a[0], b[1] - a[1]) / step)); for (let k = 0; k < n; k++) o.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); } o.push(pts[pts.length - 1]); return o; };
    const curve = (a, b, bend) => { const L = hyp(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / L, nz = (b[0] - a[0]) / L, o = []; for (let i = 0; i <= 8; i++) { const t = i / 8, w = bend * Math.sin(t * Math.PI); o.push([a[0] + (b[0] - a[0]) * t + nx * w, a[1] + (b[1] - a[1]) * t + nz * w]); } return o; };
    const reg = (r) => dens(r.pts).forEach((p) => roadPts.push([p[0], p[1], r.width]));

    // Feast Quarter shops (fixed grid on both sides of a street running west from the square)
    const shops = [];
    for (const [row, names, side] of [[0, NORTH_ROW, -1], [1, SOUTH_ROW, 1]]) names.forEach((v, i) => {
      const f = { type: 'shop', venue: v, w: 4.4, d: 7, x: C[0] - 14.6 - i * 5.0, z: C[1] + side * 7.3, rot: row ? Math.PI : 0, seed: 100 + shops.length };
      shops.push(f);
    });
    for (const f of shops) if (f.venue && !(heightAt(f.x, f.z) > 1 && footSlope(f, heightAt) < MAX_SLOPE && rectWetFree(f))) return why('shop ' + f.venue + ' h=' + heightAt(f.x, f.z).toFixed(1) + ' sl=' + footSlope(f, heightAt).toFixed(2) + ' wetfree=' + rectWetFree(f) + ' at ' + f.x.toFixed(0) + ',' + f.z.toFixed(0));
    shops.forEach((f) => feet.push(f));
    addRoad('street', 'cobble', 6.4, [[C[0] - SQUARE_R + 1, C[1]], [C[0] - 40, C[1]]]);
    reg(roads[0]);
    // harbour dock (found by walking south from the cove until the ground drops to the water)
    const cove = LANDMARKS.cove;
    let dz0 = cove.z - 14; while (dz0 < cove.z + 40 && heightAt(cove.x, dz0) > 1.3) dz0 += 0.5;
    let dz1 = dz0 + 8; while (dz1 < dz0 + 36 && heightAt(cove.x, dz1) > -1.6) dz1 += 0.5;
    dz1 += 5;
    const dock = { x: cove.x, z0: dz0, z1: dz1, width: 3.2, deck: 1.1 };
    const hr = [[C[0] + 2, C[1] + SQUARE_R]]; for (let t = 1; t <= 5; t++) hr.push([C[0] + (dock.x - C[0]) * t / 6 + 5 * Math.sin(t * 1.3), C[1] + (dz0 - C[1]) * t / 6]);
    hr.push([dock.x, dz0 + 1]);
    addRoad('harbour road', 'dirt', 4, hr); reg(roads[1]);

    const hall = key('hall', { w: 24, d: 11, seed: 7 }, [0, -24], 32, 3);
    const forge = key('forge', { w: 9, d: 8, seed: 8 }, [22, -12], 22, 3);
    const theatre = key('theatre', { w: 11, d: 9, seed: 9 }, [-24, -24], 24, 3);
    const stables = key('stables', { w: 16, d: 8, seed: 10 }, [24, 22], 24, 3);
    if (!hall || !forge || !theatre || !stables) return why('key ' + [!!hall, !!forge, !!theatre, !!stables]);
    // spokes from the square edge to each key building's door, and a broken ring lane
    for (const [name, f] of [['hall', hall], ['forge', forge], ['theatre', theatre], ['stables', stables]]) {
      const d = hyp(f.x - C[0], f.z - C[1]), e = [C[0] + (f.x - C[0]) / d * (SQUARE_R - 1), C[1] + (f.z - C[1]) / d * (SQUARE_R - 1)];
      addRoad(name + ' lane', 'dirt', 3.4, curve(e, front(f, 1.2), 2.2)); reg(roads[roads.length - 1]);
    }
    const ringR = 22;
    for (let k = 0; k < 24; k++) { // ring lane in short arcs; arcs hitting buildings are clipped later
      const a0 = k / 24 * 6.283, a1 = (k + 1.05) / 24 * 6.283, pts = [];
      for (let i = 0; i <= 3; i++) { const a = a0 + (a1 - a0) * i / 3, r = ringR + 1.6 * Math.sin(a * 3); pts.push([C[0] + Math.cos(a) * r, C[1] + Math.sin(a) * r]); }
      roads.push({ name: 'ring', kind: 'dirt', width: 3, pts });
    }
    roads.filter((r) => r.name === 'ring').forEach(reg);

    // longhouses: loose ring outside the lane, doors toward the square
    const homes = [], ROOFS = ['turf', 'shingle', 'thatch'];
    for (let k = 0; k < 40 && homes.length < 13; k++) {
      const a = k / 40 * 6.283 * 2.9 + (R() - 0.5) * 0.25, rad = 26 + R() * 26, len = 10 + Math.floor(R() * 6), wid = 5.4 + R() * 1.6;
      const f = place({ type: 'longhouse', w: len, d: wid, seed: 200 + k, roof: ROOFS[k % 3] }, C[0] + Math.cos(a) * rad, C[1] + Math.sin(a) * rad, 12, C, 2.5);
      if (f) homes.push(f);
    }
    if (homes.length < 10) return why('homes ' + homes.length);
    // boathouses and dock props at the cove
    const boats = [];
    for (const sx of [-1, 1]) { const b = place({ type: 'boathouse', w: 7, d: 12, seed: 300 + sx }, dock.x + sx * 15, dz0 - 6, 12, [dock.x, dz1], 3); if (b) boats.push(b); }
    // stubs from each longhouse door to the nearest lane
    for (const h of homes) {
      const a = front(h, 0.8); let best = null, bd = 1e9;
      for (const q of roadPts) { const d = hyp(q[0] - a[0], q[1] - a[1]); if (d < bd) { bd = d; best = q; } }
      if (best && bd < 22) addRoad('stub', 'dirt', 1.8, curve(a, [best[0], best[1]], 0.8));
    }
    // ships: two hulls (11 m, prow toward +z) berthed either side of the dock end in deep water
    const ships = [];
    const deep = (x, z) => heightAt(x, z) < -0.6;
    for (const sx of [-1, 1]) for (let dx = 4.5; dx <= 11 && !ships.some((s) => s.side === sx); dx += 1) for (let zz = dz1 - 12; zz <= dz1 + 6 && !ships.some((s) => s.side === sx); zz += 1.5) {
      const x = dock.x + sx * dx, ok = [-6.5, -3, 0, 3, 6.5].every((o) => [-2, 0, 2].every((w) => deep(x + w, zz + o)));
      if (ok) ships.push({ x, z: zz, rot: -Math.PI / 2 + sx * 0.06, side: sx, sail: ships.length, seed: 400 + ships.length });
    }

    // ---- clip roads: drop stretches inside footprints or the square's crossing, split at water and note bridge spots
    const bridgeSpots = [], out = [];
    const blocked = (p) => feet.some((f) => distToRect(f, p[0], p[1]) < 1.2);
    for (const r of roads) {
      const pts = dens(r.pts, 2); let run = [], wet = null;
      const flush = () => { if (run.length >= 2) out.push({ name: r.name, kind: r.kind, width: r.width, pts: run }); run = []; };
      pts.forEach((p, i) => {
        const w = wetAt(p[0], p[1]), b = !w && blocked(p);
        if (w) { if (!wet) { wet = { from: pts[i - 1], first: i }; } flush(); return; }
        if (wet) { if (wet.from && !blocked(wet.from)) { const m = pts[(wet.first + i - 1) >> 1]; bridgeSpots.push({ road: r.name, x: m[0], z: m[1], from: wet.from, to: p, width: r.width, length: hyp(p[0] - wet.from[0], p[1] - wet.from[1]) }); } wet = null; }
        if (b) { flush(); return; }
        run.push(p);
      });
      flush();
    }
    // ---- props
    const free = (x, z, r, wetM = 1.5) => heightAt(x, z) > 0.8 && !wetNear(x, z, wetM + r) && feet.every((f) => distToRect(f, x, z) > r + 0.8) && hyp(x - C[0], z - C[1]) > (SQUARE_R + r > 0 ? 0 : 0);
    const roadFree = (x, z, r) => out.every((rd) => rd.pts.every((q, i) => i + 1 >= rd.pts.length || segDist(x, z, q[0], q[1], rd.pts[i + 1][0], rd.pts[i + 1][1]) > rd.width / 2 + r));
    const add = (type, x, z, r, extra = {}) => { props.push({ type, x, z, rot: extra.rot ?? R() * 6.283, r, ...extra }); };
    const around = (type, f, n, r, spread, extra) => { // props near a building, doors side kept clear
      for (let k = 0, got = 0; k < 30 && got < n; k++) {
        const [x, z] = toWorld(f, (R() - 0.5) * (f.w + spread), (R() < 0.5 ? -1 : 1) * (f.d / 2 + 1.2 + R() * spread));
        if (free(x, z, r) && roadFree(x, z, r + 0.3)) { add(type, x, z, r, extra); got++; }
      }
    };
    add('well', C[0], C[1], 1.4, { rot: 0 });
    for (let k = 0; k < 4; k++) { const a = 0.785 + k * 1.571; add('banner', C[0] + Math.cos(a) * 7.4, C[1] + Math.sin(a) * 7.4, 0.3, { rot: a, color: k }); }
    for (let k = 0; k < 4; k++) { const a = 0.2 + k * 1.571 + 0.55, x = C[0] + Math.cos(a) * 6, z = C[1] + Math.sin(a) * 6; add('stall', x, z, 1.6, { rot: faceTo(x, z, C[0], C[1]), color: k }); }
    const sp = LANDMARKS.spawn; let cart = null;
    for (let rad = 3; rad < 14 && !cart; rad += 1.5) for (let k = 0; k < 8 && !cart; k++) { const x = sp.x + Math.cos(k * 0.785) * rad, z = sp.z + Math.sin(k * 0.785) * rad; if (free(x, z, 1.6, 3) && hyp(x - C[0], z - C[1]) > SQUARE_R + 1.5) cart = [x, z]; }
    if (cart) add('cart', cart[0], cart[1], 1.6, { rot: 0.5 });
    shops.forEach((f) => { const [x, z] = toWorld(f, f.w / 2 + 0.2, f.d / 2 + 0.5); add('barrel', x, z, 0.5); });
    homes.forEach((h, i) => { around('haystack', h, i % 3 === 0 ? 1 : 0, 1.6, 4); around('woodpile', h, i % 2, 1.2, 3); if (i % 3 === 1) around('rack', h, 1, 1.4, 3); around('barrel', h, 1, 0.5, 2); });
    around('barrel', forge, 3, 0.5, 3); around('crate', forge, 2, 0.6, 3); around('woodpile', forge, 1, 1.2, 3);
    around('haystack', stables, 3, 1.6, 4); around('crate', stables, 2, 0.6, 3);
    for (const b of boats) { around('rack', b, 2, 1.4, 5); around('barrel', b, 3, 0.5, 3); around('crate', b, 2, 0.6, 3); }
    for (let k = 0; k < 4; k++) { const x = dock.x + (k % 2 ? 4 : -4.5), z = dz0 - 2 - k * 2.5; if (free(x, z, 0.6, 1.5)) add(k % 2 ? 'crate' : 'barrel', x, z, 0.55); }
    for (let k = 0, got = 0; k < 40 && got < 3; k++) { const x = dock.x + (R() - 0.5) * 24, z = dz0 - 8 - R() * 8; if (free(x, z, 1.4, 3) && roadFree(x, z, 1.6)) { add('rack', x, z, 1.4); got++; } }
    for (let k = 0, got = 0; k < 50 && got < 5; k++) { const a = R() * 6.283, d = 14 + R() * 12, x = C[0] + Math.cos(a) * d, z = C[1] + Math.sin(a) * d; if (free(x, z, 1.4) && roadFree(x, z, 1.8)) { add(k % 2 ? 'woodpile' : 'crate', x, z, 1.2); got++; } }
    // fences: two stable pens, plus garden corners at some longhouses
    const fences = [];
    for (const sx of [-1, 1]) { const c = toWorld(stables, sx * 4.5, -stables.d / 2 - 4.5); fences.push({ closed: true, pts: [[-3.8, -3.8], [3.8, -3.8], [3.8, 3.8], [-3.8, 3.8]].map(([a, b]) => [c[0] + a * Math.cos(stables.rot) + b * Math.sin(stables.rot), c[1] - a * Math.sin(stables.rot) + b * Math.cos(stables.rot)]) }); }
    homes.forEach((h, i) => { if (i % 3 === 0) fences.push({ closed: false, pts: [toWorld(h, -h.w / 2 - 1.5, -h.d / 2 - 5), toWorld(h, -h.w / 2 - 1.5, h.d / 2 + 2.5), toWorld(h, -h.w / 2 + 5, h.d / 2 + 2.5)] }); });
    const okFence = fences.filter((fn) => fn.pts.every((p) => free(p[0], p[1], 0.2, 1.5) || feet.every((f) => distToRect(f, p[0], p[1]) > 0.3) && !wetNear(p[0], p[1], 1.5)));
    // lantern posts along the lanes
    const posts = []; let acc = 0;
    for (const rd of out.filter((r) => r.name !== 'stub')) for (let i = 0; i + 1 < rd.pts.length; i++) {
      const a = rd.pts[i], b = rd.pts[i + 1], L = hyp(b[0] - a[0], b[1] - a[1]); acc += L;
      if (acc > (rd.name === 'street' ? 9 : 15)) { acc = 0; const nx = -(b[1] - a[1]) / L, nz = (b[0] - a[0]) / L, s = posts.length % 2 ? 1 : -1, x = b[0] + nx * s * (rd.width / 2 + 0.5), z = b[1] + nz * s * (rd.width / 2 + 0.5); if (free(x, z, 0.3, 1.5)) posts.push([x, z]); }
    }
    const strings = [0, 1, 2].map((k) => ({ a: [C[0] - 18 - k * 5.4 + 0.1, C[1] - 3.3], b: [C[0] - 18 - k * 5.4 + 0.1, C[1] + 3.3], y: 4.6 }));

    // ---- exports
    const colliders = feet.map((f) => ({ kind: 'box', x: f.x, z: f.z, hw: f.w / 2, hd: f.d / 2, rot: f.rot, type: f.type }));
    props.forEach((p) => { if (['well', 'haystack', 'woodpile', 'cart', 'stall', 'banner'].includes(p.type)) colliders.push({ kind: 'circle', x: p.x, z: p.z, r: p.r * 0.8, type: p.type }); });
    const anchors = {
      greatHall: front(hall, 2.5), forge: front(forge, 2), market: [C[0], C[1]], theatre: front(theatre, 2), stables: front(stables, 2),
      harbourDock: [dock.x, dz0 + 1], spawnCart: cart || [sp.x, sp.z], feastStreet: [C[0] - 24, C[1]],
    };
    shops.forEach((f) => { anchors[f.venue] = front(f, 1.5); });
    return { center: C, square: sq, buildings: feet.slice(), roads: out, bridgeSpots, props, fences: okFence, posts, strings, dock, ships, colliders, anchors };
  }

  const tries = []; for (let x = -34; x <= 12; x += 3) for (let z = -6; z <= 40; z += 3) tries.push([x, z]);
  tries.sort((a, b) => hyp(a[0] + 6, a[1] - 8) - hyp(b[0] + 6, b[1] - 8));
  let result = null;
  for (const C of tries) { result = plan(C); if (result) break; }
  if (!result) throw new Error('village: no valid centre');
  const v = result;
  const keepOut = (x, z, r = 0) => {
    if (hyp(x - v.center[0], z - v.center[1]) < SQUARE_R + 2 + r) return true;
    for (const f of v.buildings) if (distToRect(f, x, z) < r + 2.5) return true;
    for (const rd of v.roads) for (let i = 0; i + 1 < rd.pts.length; i++) if (segDist(x, z, rd.pts[i][0], rd.pts[i][1], rd.pts[i + 1][0], rd.pts[i + 1][1]) < rd.width / 2 + 1 + r) return true;
    for (const p of v.props) if (hyp(x - p.x, z - p.z) < p.r + 0.8 + r) return true;
    const d = v.dock; if (Math.abs(x - d.x) < 6 + r && z > d.z0 - 6 - r && z < d.z1 + 14) return true;
    return false;
  };
  return { ...v, keepOut };
}
