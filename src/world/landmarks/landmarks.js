// createLandmarks: the dragon-island landmarks as merged toon meshes (2 to 3 draw calls each) with night glow, plus the instanced race rings,
// steam, embers and petals. It adds its colliders to village.colliders and its footprints to village.keepOut, so main.js needs no more wiring.
import { Group, Mesh, InstancedMesh, MeshBasicMaterial, DoubleSide, Matrix4, Quaternion, Vector3, Euler, Color, TorusGeometry, IcosahedronGeometry, OctahedronGeometry, CircleGeometry } from 'three';
import { toonMat } from '../common/toon.js';
import { Mesher } from './geo.js';
import { planSites, RING_R, POOLS, TREES, LANDMARK_INFO } from './sites.js';
import * as shapes from './shapes.js';

export { LANDMARK_INFO, ringsPassed } from './sites.js';
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

export function createLandmarks(scene, { heightAt, isWet, zoneAt, village }) {
  const P = planSites({ heightAt, isWet, zoneAt }, village.layout.keepOut, village.layout.center), group = new Group();
  group.name = 'landmarks';
  village.colliders.push(...P.colliders);
  const vk = village.keepOut; village.keepOut = (x, z, r = 0) => vk(x, z, r) || P.keepOut(x, z, r);

  const solidMat = toonMat(0xffffff, { vertexColors: true, flatShading: true, side: DoubleSide });
  const glowMat = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }), eggMat = new MeshBasicMaterial({ vertexColors: true });
  const stats = { calls: 0, tris: 0, perSite: {} }, nodes = [];
  const add = (geo, mat, parent) => { const mesh = new Mesh(geo, mat); parent.add(mesh); stats.calls++; return mesh; };
  for (const s of P.sites) {
    const m = new Mesher((lx, lz) => heightAt(s.x + lx * Math.cos(s.rot) + lz * Math.sin(s.rot), s.z - lx * Math.sin(s.rot) + lz * Math.cos(s.rot)));
    shapes[s.id](m);
    const out = m.finish(), g = new Group();
    g.position.set(s.x, 0, s.z); g.rotation.y = s.rot; g.name = 'landmark-' + s.id;
    if (out.solid) add(out.solid, solidMat, g);
    if (out.glow) add(out.glow, glowMat, g);
    if (out.egg) add(out.egg, eggMat, g);
    group.add(g); nodes.push({ g, s }); stats.tris += out.tris; stats.perSite[s.id] = out.tris;
  }

  // ---- race rings: one instanced torus, tinted along the course
  const ringMat = new MeshBasicMaterial({ color: 0xffffff }), rg = new TorusGeometry(RING_R, 0.24, 6, 22);
  const rings = new InstancedMesh(rg, ringMat, P.rings.length), mx = new Matrix4(), q = new Quaternion(), e = new Euler(), v = new Vector3(), one = new Vector3(1, 1, 1), col = new Color();
  P.rings.forEach((r, i) => {
    rings.setMatrixAt(i, mx.compose(v.set(r.x, r.y, r.z), q.setFromEuler(e.set(0, Math.atan2(r.nx, r.nz), 0)), one));
    rings.setColorAt(i, col.setHSL(0.08 + i * 0.075, 0.9, 0.55).multiplyScalar(1.3));
  });
  rings.frustumCulled = false; group.add(rings); stats.calls++; stats.tris += rg.index.count / 3 * P.rings.length;

  // ---- drifting bits: steam (springs), embers (cinder field), petals (grove). Each is one instanced mesh, animated only when the camera is near.
  const W = (s, lx, lz) => [s.x + lx * Math.cos(s.rot) + lz * Math.sin(s.rot), s.z - lx * Math.sin(s.rot) + lz * Math.cos(s.rot)];
  const sp = P.byId, parts = [];
  const mk = (geo, mat, n, s, fn) => {
    const mesh = new InstancedMesh(geo, mat, n); mesh.frustumCulled = false; mesh.visible = false; group.add(mesh);
    stats.calls++; stats.tris += (geo.index ? geo.index.count : geo.attributes.position.count) / 3 * n;
    parts.push({ mesh, n, s, fn });
  };
  const steamMat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.38, depthWrite: false }), emberMat = new MeshBasicMaterial({ color: new Color(3, 1.1, 0.25) }), petalMat = new MeshBasicMaterial({ color: 0xffc9d8, side: DoubleSide });
  mk(new IcosahedronGeometry(1, 0), steamMat, POOLS.length * 8, sp.springs, (i, t, o) => {
    const [px, pz, r] = POOLS[i >> 3], k = i & 7, ph = (t * 0.2 + k / 8) % 1, a = k * 2.4, [x, z] = W(sp.springs, px + Math.sin(a) * r * 0.5 + ph * 0.8, pz + Math.cos(a) * r * 0.5);
    o.p.set(x, heightAt(x, z) + 0.8 + ph * 4.2, z); o.s = Math.sin(ph * Math.PI) * (0.35 + 0.9 * ph);
  });
  mk(new OctahedronGeometry(1, 0), emberMat, 36, sp.embers, (i, t, o) => {
    const ph = (t * (0.12 + (i % 5) * 0.02) + i * 0.173) % 1, a = i * 2.39, d = 1 + (i % 7), [x, z] = W(sp.embers, Math.sin(a) * d + Math.sin(t + i) * 0.5 * ph, Math.cos(a) * d);
    o.p.set(x, heightAt(x, z) + 0.6 + ph * 7, z); o.s = Math.sin(ph * Math.PI) * 0.09;
  });
  mk(new CircleGeometry(1, 5), petalMat, 64, sp.grove, (i, t, o) => {
    const ph = (t * 0.05 + i * 0.137) % 1, a = i * 2.39 + t * 0.15, d = 2 + (i % 11), [x, z] = W(sp.grove, Math.sin(a) * d + Math.sin(t * 0.7 + i) * 0.8, Math.cos(a) * d);
    o.p.set(x, heightAt(x, z) + 15 - ph * 15, z); o.s = 0.13; o.rot = t * 1.3 + i;
  });

  scene.add(group);
  const o = { p: new Vector3(), s: 1, rot: 0 }, sc = new Vector3();
  let time = 0;
  function update(dt, pal, cam) {
    time += dt;
    const night = smooth(0.03, 0.3, pal?.stars ?? 0);
    glowMat.color.setScalar(0.5 + 1.2 * night);
    eggMat.color.setScalar((0.55 + 0.95 * night) * (0.9 + 0.12 * Math.sin(time * 2.1)));
    ringMat.color.setScalar(0.85 + 0.9 * night);
    for (const n of nodes) n.g.visible = !cam || Math.hypot(cam.x - n.s.x, cam.z - n.s.z) < 300;
    for (const p of parts) {
      const near = !!cam && Math.hypot(cam.x - p.s.x, cam.z - p.s.z) < 90;
      p.mesh.visible = near;
      if (!near) continue;
      for (let i = 0; i < p.n; i++) { o.rot = 0; p.fn(i, time, o); p.mesh.setMatrixAt(i, mx.compose(o.p, q.setFromEuler(e.set(o.rot ? 1.3 : 0, o.rot, 0)), sc.setScalar(Math.max(o.s, 0.0001)))); }
      p.mesh.instanceMatrix.needsUpdate = true;
    }
  }
  function dispose() { scene.remove(group); group.traverse((n) => n.geometry?.dispose()); }
  return { group, update, dispose, sites: P.sites, rings: P.rings, info: P.info, colliders: P.colliders, keepOut: P.keepOut, stats };
}
