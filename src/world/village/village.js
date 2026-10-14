// createVillage: turns the pure layout into merged meshes (a few draw calls), with night lights, chimney smoke, ship bobbing and distance culling.
import { Group, Mesh, InstancedMesh, IcosahedronGeometry, Matrix4, Vector3, Quaternion } from 'three';
import { planVillage, toWorld, VENUES } from './layout.js';
import { getMaterials } from './atlas.js';
import { B, P, mat, box, beam } from './geom.js';
import { makeLonghouse, makeHall, makeForge, makeShop, makeStable, makeTheatre, makeBoathouse } from './buildings.js';
import { makeWell, makeLanternPost, makeHaystack, makeWoodpile, makeRack, makeCart, makeStall, makeBannerPole, makeBarrel, makeCrates, makeDock, makeLongship, addFence } from './props.js';
import { addRoad, addDisc } from './road.js';
import { WARM } from './parts.js';
import { TILE as T } from './atlas.js';

const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

export function createVillage(scene, { heightAt, isWet, zoneAt }) {
  const L = planVillage({ heightAt, isWet, zoneAt }), M = getMaterials(), group = new Group(), C = L.center;
  group.name = 'village';
  const clusters = {}; // name -> { p: P, trans: B, centre, radius, meshes }
  const cl = (n) => (clusters[n] ||= { p: new P(), trans: new B(), pts: [] });
  const clusterOf = (x, z, type) => {
    if (z > 80) return 'harbour';
    if (x < C[0] - 11 && Math.abs(z - C[1]) < 14) return 'feast';
    return type === 'longhouse' || Math.hypot(x - C[0], z - C[1]) > 33 ? 'homes' : 'core';
  };
  const ground = (f) => { // mid height across the footprint
    let lo = 1e9, hi = -1e9;
    for (let i = 0; i <= 2; i++) for (let j = 0; j <= 2; j++) { const h = heightAt(...toWorld(f, (i / 2 - 0.5) * f.w, (j / 2 - 0.5) * f.d)); lo = Math.min(lo, h); hi = Math.max(hi, h); }
    return (lo + hi) / 2 + 0.25;
  };
  // Baked soft blob shadow draped on the terrain (5x5 grid), plus warm light pools for lanterns.
  const blob = (tr, cx, cz, hw, hd, rot) => {
    const n = 5, g = (i, j) => { const lx = (i / n - 0.5) * 2 * hw, lz = (j / n - 0.5) * 2 * hd, c = Math.cos(rot), s = Math.sin(rot), x = cx + lx * c + lz * s, z = cz - lx * s + lz * c; return [x, heightAt(x, z) + 0.07, z]; };
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) tr.quad(g(i, j + 1), g(i + 1, j + 1), g(i + 1, j), g(i, j), { col: 0x000000, tile: 0, uv: [[i / n, (j + 1) / n], [(i + 1) / n, (j + 1) / n], [(i + 1) / n, j / n], [i / n, j / n]] });
  };
  const pool = (tr, x, z, r) => {
    const n = 3, g = (i, j) => { const px = x + (i / n - 0.5) * 2 * r, pz = z + (j / n - 0.5) * 2 * r; return [px, heightAt(px, pz) + 0.09, pz]; };
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) tr.quad(g(i, j + 1), g(i + 1, j + 1), g(i + 1, j), g(i, j), { col: [1.0, 0.62, 0.28], tile: 1, uv: [[i / n, (j + 1) / n], [(i + 1) / n, (j + 1) / n], [(i + 1) / n, j / n], [i / n, j / n]] });
  };
  const put = (name, p, x, y, z, rot = 0) => { // merge a local P into a cluster at a world pose
    const c = cl(name), m = mat(x, y, z, rot);
    c.p.append(p, m); c.pts.push([x, z]);
    p.pools.forEach((q) => { const w = new Vector3(q[0], q[1], q[2]).applyMatrix4(m); pool(c.trans, w.x, w.z, q[3]); });
  };

  // ---- buildings
  const maker = {
    hall: () => makeHall(), forge: () => makeForge(), theatre: () => makeTheatre(), stables: () => makeStable(),
    longhouse: (f) => makeLonghouse({ length: f.w, width: f.d, roof: f.roof, seed: f.seed }), shop: (f) => makeShop({ venue: f.venue, seed: f.seed }), boathouse: (f) => makeBoathouse({ seed: f.seed }),
  };
  const stats = { byType: {} };
  for (const f of L.buildings) {
    const p = maker[f.type](f), y = ground(f), name = clusterOf(f.x, f.z, f.type);
    put(name, p, f.x, y, f.z, f.rot);
    blob(cl(name).trans, f.x, f.z, f.w / 2 + 2.2, f.d / 2 + 2.2, f.rot);
    stats.byType[f.type] = p.tris;
  }
  // ---- props
  const PM = { well: () => makeWell(), banner: (q) => makeBannerPole(q.color), stall: (q) => makeStall(q.color), cart: () => makeCart(), barrel: () => makeBarrel(), crate: () => makeCrates(), haystack: (q) => makeHaystack(Math.floor(q.x * 7 + q.z)), woodpile: (q) => makeWoodpile(Math.floor(q.x)), rack: (q) => makeRack(Math.floor(q.z)) };
  for (const q of L.props) { const p = PM[q.type](q); put(clusterOf(q.x, q.z, q.type), p, q.x, heightAt(q.x, q.z), q.z, q.rot); if (q.type === 'haystack' || q.type === 'well') blob(cl(clusterOf(q.x, q.z)).trans, q.x, q.z, 2, 2, 0); }
  const post = makeLanternPost();
  L.posts.forEach(([x, z], i) => put(clusterOf(x, z, 'post'), post, x, heightAt(x, z), z, i * 1.7));
  for (const f of L.fences) addFence(cl(clusterOf(f.pts[0][0], f.pts[0][1], 'fence')).p.m, f.pts, f.closed, heightAt);
  // lantern strings across the Feast Quarter street
  for (const s of L.strings) {
    const c = cl('feast'), y0 = Math.max(heightAt(s.a[0], s.a[1]), heightAt(s.b[0], s.b[1])) + s.y;
    const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([s.a[0] + (s.b[0] - s.a[0]) * t, y0 - 0.55 * Math.sin(t * Math.PI), s.a[1] + (s.b[1] - s.a[1]) * t]); }
    for (let i = 0; i < 10; i++) beam(c.p.m, pts[i], pts[i + 1], 0.035, { tile: T.beam, col: 0xc0b090 });
    for (let i = 1; i < 10; i += 2) { const q = pts[i], col = i % 4 === 1 ? WARM : [2.0, 0.5, 0.9]; box(c.p.g, q[0] - 0.1, q[1] - 0.26, q[2] - 0.1, q[0] + 0.1, q[1] - 0.06, q[2] + 0.1, { col, tile: 0 }); box(c.p.m, q[0] - 0.11, q[1] - 0.06, q[2] - 0.11, q[0] + 0.11, q[1] - 0.02, q[2] + 0.11, { tile: T.beam }); }
    pool(c.trans, (s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2, 4);
  }
  // ---- harbour: dock (world coordinates), pool of light at the head
  const dockP = makeDock(L.dock, heightAt);
  cl('harbour').p.append(dockP, new Matrix4()); cl('harbour').pts.push([L.dock.x, (L.dock.z0 + L.dock.z1) / 2]);
  dockP.pools.forEach((q) => pool(cl('harbour').trans, q[0], q[2], q[3]));
  // ---- roads: one mesh of cobble/dirt/stone-edge ribbons plus the square
  const rb = new B();
  addDisc(rb, C[0], C[1], L.square.r, heightAt);
  for (const r of L.roads) addRoad(rb, r.pts, r.width, heightAt, { kind: r.kind });

  // ---- meshes
  const meshes = [];
  const mk = (geo, material, parent, order = 0) => { const m = new Mesh(geo, material); m.renderOrder = order; m.frustumCulled = true; parent.add(m); meshes.push(m); return m; };
  const roadMesh = mk(rb.geometry(), M.main, group);
  for (const [name, c] of Object.entries(clusters)) {
    const g = new Group(); g.name = 'village-' + name; group.add(g); c.group = g;
    if (c.p.m.count) mk(c.p.m.geometry(), M.main, g);
    if (c.p.g.count) mk(c.p.g.geometry('aOn'), M.glow, g);
    if (c.p.s.count) mk(c.p.s.geometry(), M.sign, g);
    if (c.trans.count) mk(c.trans.geometry('aOn'), M.trans, g, 2);
    let sx = 0, sz = 0; c.pts.forEach((q) => { sx += q[0]; sz += q[1]; });
    c.cx = sx / c.pts.length; c.cz = sz / c.pts.length; c.r = Math.max(...c.pts.map((q) => Math.hypot(q[0] - c.cx, q[1] - c.cz))) + 30;
    c.p.smoke.forEach((s) => (c.smoke = (c.smoke || [])).push(s));
  }
  // ships: one small group each so they can bob
  const ships = L.ships.map((s) => {
    const p = makeLongship({ seed: s.seed, sail: s.sail }), g = new Group();
    mk(p.m.geometry(), M.main, g); if (p.g.count) mk(p.g.geometry('aOn'), M.glow, g);
    g.position.set(s.x, 0, s.z); g.rotation.y = s.rot; group.add(g);
    return { g, s, ph: s.seed * 0.7 };
  });
  // chimney smoke: one instanced puff mesh
  const emit = Object.values(clusters).flatMap((c) => c.smoke || []), PUFFS = 5;
  const smoke = new InstancedMesh(new IcosahedronGeometry(1, 0), M.smoke, Math.max(1, emit.length * PUFFS));
  smoke.frustumCulled = false; smoke.count = emit.length * PUFFS; group.add(smoke); meshes.push(smoke);
  scene.add(group);

  const _m = new Matrix4(), _q = new Quaternion(), _p = new Vector3(), _s = new Vector3();
  let time = 0;
  function update(dt, palette, cam) {
    time += dt;
    const night = smooth(0.03, 0.3, palette?.stars ?? 0);
    M.night.value = night; M.sign.emissiveIntensity = 0.75 * night;
    for (const c of Object.values(clusters)) c.group.visible = !cam || Math.hypot(cam.x - c.cx, cam.z - c.cz) < c.r + 230;
    ships.forEach((o) => { o.g.position.y = Math.sin(time * 0.9 + o.ph) * 0.09 - 0.05; o.g.rotation.z = Math.sin(time * 0.7 + o.ph) * 0.025; o.g.rotation.x = Math.sin(time * 0.55 + o.ph * 2) * 0.018; });
    emit.forEach((e, i) => {
      const near = !cam || Math.hypot(cam.x - e[0], cam.z - e[2]) < 140;
      for (let k = 0; k < PUFFS; k++) {
        const t = ((time * 0.22 + k / PUFFS + i * 0.37) % 1), sc = near ? Math.sin(Math.min(t * 1.15, 1) * Math.PI) * (0.25 + 0.7 * t) : 0;
        _p.set(e[0] + t * 2.2 + Math.sin(t * 6 + i) * 0.2, e[1] + t * 4.2, e[2] + t * 0.8); _s.setScalar(Math.max(sc, 0.0001));
        smoke.setMatrixAt(i * PUFFS + k, _m.compose(_p, _q, _s));
      }
    });
    smoke.instanceMatrix.needsUpdate = true;
  }
  function dispose() {
    scene.remove(group);
    meshes.forEach((m) => m.geometry.dispose());
  }
  const anchors = Object.fromEntries(Object.entries(L.anchors).map(([k, v]) => [k, { x: v[0], z: v[1] }]));
  return { group, update, roads: L.roads, colliders: L.colliders, anchors, bridgeSpots: L.bridgeSpots, keepOut: L.keepOut, layout: L, dispose, stats, roadMesh, VENUES };
}
