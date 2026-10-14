// Water demo on a local test terrain (island.js base + lake basin, river channels, cliff under the falls, same constants as the contract).
// ?cam=sea|lake|falls|river|shore|aerial  ?t=<hours>  ?ripple=1  ?snow=1  ?freeze=1. window.__water = { time, auto, ripples(), measure() }.
import { BufferAttribute, Scene, PerspectiveCamera, HemisphereLight, DirectionalLight, Fog, Color, Vector3, Mesh, PlaneGeometry, MeshLambertMaterial } from 'three';
import { createRenderer, startLoop } from '../src/render/renderer.js';
import { heightAt, LAKE, RIVERS, FALLS } from '../src/world/island.js';
import { createSky } from '../src/world/sky.js';
import { skyPalette, sunDirection, moonDirection } from '../src/world/time.js';
import { createStars } from '../src/world/stars.js';
import { createMoon } from '../src/world/moon.js';
import { createWater } from '../src/world/water.js';

const q = new URLSearchParams(location.search), hud = document.getElementById('hud');
const sm = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---- test terrain -------------------------------------------------------------------------------------------------
const PLATEAU = LAKE.level + FALLS[0].drop + 1.2, hw = (r) => r.width / 2 * 1.2;
const lakeD = (x, z) => Math.hypot(x - LAKE.x, (z - LAKE.z) * (z < LAKE.z ? 0.72 : 1)); // stretched north so the lake reaches the cliff foot
function riverAt(r, i, x, z) { // nearest distance to river i and the water level there
  let best = 1e9, S = 0, acc = 0;
  const lens = r.pts.slice(1).map((p, k) => Math.hypot(p[0] - r.pts[k][0], p[1] - r.pts[k][1])), total = lens.reduce((a, b) => a + b, 0);
  for (let k = 0; k + 1 < r.pts.length; k++) {
    const [ax, az] = r.pts[k], [bx, bz] = r.pts[k + 1], vx = bx - ax, vz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz))), d = Math.hypot(ax + vx * t - x, az + vz * t - z);
    if (d < best) { best = d; const f = (acc + lens[k] * t) / total; S = i === 0 ? (z < -70 ? PLATEAU - 1.2 : LAKE.level) : LAKE.level - 3.7 * f; }
    acc += lens[k];
  }
  return { d: best, S };
}
function carve(h, x, z) {
  if (z > -71.5 && z < -67) return h; // leave the cliff face alone
  RIVERS.forEach((r, i) => {
    const { d, S } = riverAt(r, i, x, z), w = hw(r), cut = 1 - sm(w + 1, w + 8, d);
    if (cut <= 0) return;
    h += ((d < w ? S - 1.1 * (1 - (d / w) ** 2) : S + (d - w) * 0.3) - h) * cut;
  });
  return h;
}
function testH(x, z) {
  let h = heightAt(x, z);
  const W = 1 - sm(70, 100, Math.hypot(x + 5, z + 55));
  if (W > 0) {
    const low = 6.5 + Math.sin(x * 0.08) * Math.cos(z * 0.07);
    let T = low + (PLATEAU - low) * sm(-69, -70.5, z);
    const d = lakeD(x, z), w = 1 - sm(LAKE.r, LAKE.r + 9, d), bed = d < LAKE.r ? LAKE.level - 3.5 * (1 - (d / LAKE.r) ** 2) : LAKE.level + (d - LAKE.r) * 0.3;
    T += (bed - T) * w * (1 - sm(-71.5, -73, z));
    h += (T - h) * W;
  }
  return carve(h, x, z);
}
function surfaceAt(x, z) {
  const h = testH(x, z);
  if (h < 0) return 0;
  if (lakeD(x, z) < LAKE.r && h < LAKE.level) return LAKE.level;
  for (let i = 0; i < RIVERS.length; i++) { const { d, S } = riverAt(RIVERS[i], i, x, z); if (d < RIVERS[i].width && h < S) return S; }
  return null;
}

// ---- scene --------------------------------------------------------------------------------------------------------
const gl = createRenderer(document.getElementById('gl')), scene = new Scene();
scene.fog = new Fog('#ffffff', 80, 260);
const camera = new PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 600);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
const hemi = new HemisphereLight('#ffffff', '#ffffff', 1.5), sun = new DirectionalLight('#ffffff', 3);
scene.add(hemi, sun, sun.target);
const sky = createSky(), stars = createStars(), moon = createMoon();

const E = 200, n = Math.round(2 * E / 1.6), tg = new PlaneGeometry(2 * E, 2 * E, n, n);
tg.rotateX(-Math.PI / 2);
const tp = tg.attributes.position, col = new Float32Array(tp.count * 3), c = new Color();
for (let i = 0; i < tp.count; i++) tp.setY(i, testH(tp.getX(i), tp.getZ(i)));
for (let i = 0; i < tp.count; i++) {
  const x = tp.getX(i), z = tp.getZ(i), h = tp.getY(i), sl = Math.hypot(testH(x + 1, z) - h, testH(x, z + 1) - h);
  if (sl > 0.9 || h > 45) c.set(h > 75 ? '#f4f7ff' : '#8d8a96'); else if (h < 1.3) c.set('#e8d2a2'); else if (lakeD(x, z) < LAKE.r + 2 && h < LAKE.level + 0.6) c.set('#c9c08a'); else c.set(h > 14 ? '#7c9a52' : '#78b05a');
  col.set([c.r, c.g, c.b], i * 3);
}
tg.setAttribute('color', new BufferAttribute(col, 3));
tg.computeVertexNormals();
const land = new Mesh(tg, new MeshLambertMaterial({ vertexColors: true }));
const water = createWater({ heightAt: testH, surfaceAt });
scene.add(sky.mesh, stars.points, moon.group, land, water.mesh);

// ---- palette (same recipe as main.js) -----------------------------------------------------------------------------
const pal = { sunDir: new Vector3(), lightDir: new Vector3() };
const hours = q.has('t') ? Number(q.get('t')) : 13, snow = q.get('snow') === '1' ? 1 : 0;
{
  const base = skyPalette(hours), sd = sunDirection(hours), md = moonDirection(hours), w = sm(-0.15, 0.1, sd[1]);
  Object.assign(pal, base); pal.sunDir.fromArray(sd);
  pal.lightDir.set(md[0] + (sd[0] - md[0]) * w, md[1] + (sd[1] - md[1]) * w, md[2] + (sd[2] - md[2]) * w).normalize();
  pal.snow = snow; scene.fog.color.set(base.fog);
  hemi.color.set(base.ambient); hemi.groundColor.set(base.ambient).multiplyScalar(0.5).lerp(new Color('#8a6a48'), 0.4); hemi.intensity = 1.5;
  sun.color.set(base.sunColor); sun.intensity = 3 * base.sunIntensity; sun.position.copy(pal.lightDir).multiplyScalar(100);
  sky.update(pal);
  moon.update(hours, 0.5, base.moon);
}

// ---- cameras: x, y, z, yaw (0 looks north/-z, 90 west), pitch; r = where ?ripple=1 drops rings ------------------------
let coast = [0, 0];
for (let r = 60; r < 260; r += 1) { const x = -Math.cos(0.74) * r, z = Math.sin(0.74) * r; if (testH(x, z) < 0.3) { coast = [x, z]; break; } }
const VIEWS = {
  sea: { p: [0, 5, 140, 90, -3], r: [-20, 130] },
  shore: { p: [coast[0] + 5, testH(coast[0] + 5, coast[1] + 3) + 1.6, coast[1] + 3, 40, -9], r: [coast[0] - 3, coast[1] - 3] },
  lake: { p: [-5, 6.5, -10, 0, -3], r: [-5, -30] },
  aerial: { p: [-5, 95, 40, 0, -52], r: [-5, -42] },
  falls: { p: [-8, 9, -52, 0, 4], r: [-7, -58] },
  river: { p: [10, 4.6, 6, -125, -14], r: [15, 6] },
};
const view = VIEWS[q.get('cam')] || VIEWS.lake, [px, py, pz, yaw, pitch] = view.p;
camera.position.set(px, py, pz);
camera.rotation.order = 'YXZ'; camera.rotation.set(pitch * Math.PI / 180, yaw * Math.PI / 180, 0);

const W = window.__water = {
  time: 4, auto: !q.has("freeze"), water, land, camera, gl,
  ripples() { water.update(pal, W.time, camera.position); water.ripple(view.r[0], view.r[1], 1); water.ripple(view.r[0] + 3, view.r[1] + 2, 0.7); water.ripple(view.r[0] - 2, view.r[1] + 4, 0.9); },
  measure() { // calls and triangles of the water alone = frame with water minus frame without
    water.mesh.visible = true; gl.render(scene, camera, 16); const a = gl.stats();
    water.mesh.visible = false; gl.render(scene, camera, 16); const b = gl.stats();
    water.mesh.visible = true;
    return { calls: a.calls - b.calls, triangles: a.triangles - b.triangles, allCalls: a.calls, allTris: a.triangles };
  },
};
let frames = 0;
if (q.get('ripple') === '1') setTimeout(() => W.ripples(), 600);
startLoop((dt, now, raw) => {
  if (W.auto) W.time += dt;
  stars.points.position.copy(camera.position); moon.group.position.copy(camera.position); sky.mesh.position.copy(camera.position);
  stars.update(W.time, pal.stars, 1);
  water.update(pal, W.time, camera.position);
  gl.render(scene, camera, raw);
  if (++frames === 3) { const m = W.measure(); hud.textContent = `ready\nwater calls ${m.calls} tris ${m.triangles}\nall calls ${m.allCalls} tris ${m.allTris}`; }
});
