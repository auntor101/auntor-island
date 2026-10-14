// Village demo: ?cam=square|street|harbour|hall|forge|aerial|lane|stable|theatre or x,y,z,tx,ty,tz   ?t=<hours> (18.5 dusk, 22 night)   Shows "ready" when set up.
import { Scene, PerspectiveCamera, HemisphereLight, DirectionalLight, Fog, Color, Vector3 } from 'three';
import { createRenderer, startLoop } from '../src/render/renderer.js';
import { heightAt, zoneAt, isWet } from '../src/world/island.js';
import { ChunkManager, createTerrainMaterial } from '../src/world/terrain.js';
import { createSky } from '../src/world/sky.js';
import { createWater } from '../src/world/water.js';
import { createStars } from '../src/world/stars.js';
import { createMoon } from '../src/world/moon.js';
import { skyPalette, sunDirection, moonDirection } from '../src/world/time.js';
import { createVillage } from '../src/world/village/village.js';
import { toWorld, distToRect } from '../src/world/village/layout.js';

const q = new URLSearchParams(location.search), hours = Number(q.get('t') ?? 15.5), view = q.get('cam') || 'square';
const canvas = document.getElementById('gl'), status = document.getElementById('status');
const gl = createRenderer(canvas), scene = new Scene();
scene.fog = new Fog('#ffffff', 80, 300);
const camera = new PerspectiveCamera(q.has('fov') ? Number(q.get('fov')) : 60, innerWidth / innerHeight, 0.1, 700);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
const hemi = new HemisphereLight('#ffffff', '#ffffff', 1.5), sun = new DirectionalLight('#ffffff', 3);
scene.add(hemi, sun, sun.target);
const sky = createSky(), water = createWater(), terrain = createTerrainMaterial(), chunks = new ChunkManager(scene, terrain), stars = createStars(), moon = createMoon();
scene.add(sky.mesh, water.mesh, stars.points, moon.group);
const village = createVillage(scene, { heightAt, isWet, zoneAt });
window.__village = village;

// palette, as in main.js (no snow)
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const pal = { sunDir: new Vector3(), lightDir: new Vector3() }, tmp = new Color();
{
  const base = skyPalette(hours), sd = sunDirection(hours), md = moonDirection(hours), w = smooth(-0.15, 0.1, sd[1]);
  Object.assign(pal, base); pal.sunDir.fromArray(sd); pal.snow = 0;
  pal.lightDir.set(md[0] + (sd[0] - md[0]) * w, md[1] + (sd[1] - md[1]) * w, md[2] + (sd[2] - md[2]) * w).normalize();
  scene.fog.color.set(base.fog); hemi.color.set(base.ambient); hemi.groundColor.set(base.ambient).multiplyScalar(0.5).lerp(tmp.set('#8a6a48'), 0.4);
  sun.color.set(base.sunColor); sun.intensity = 3 * base.sunIntensity; sun.position.copy(pal.lightDir).multiplyScalar(100);
  sky.update(pal); terrain.update(pal);
}

const A = village.anchors, L = village.layout, C = L.center, gy = (x, z) => heightAt(x, z);
const B = (t) => L.buildings.find((b) => b.type === t), homes = L.buildings.filter((b) => b.type === 'longhouse');
const frontOf = (f, d, h = 2.6) => { const [x, z] = toWorld(f, 0, f.d / 2 + d); return [x, gy(x, z) + h, z]; };
const at = (f, y = 3) => [f.x, gy(f.x, f.z) + y, f.z];
const VIEWS = {
  square: () => { for (let k = 0; k < 16; k++) { const a = 0.6 + k * 0.39, x = C[0] + Math.cos(a) * 17, z = C[1] + Math.sin(a) * 17; if (L.buildings.every((b) => distToRect(b, x, z) > 4) || k === 15) return [[x, gy(x, z) + 3.6, z], [C[0], gy(C[0], C[1]) + 2.2, C[1]]]; } },
  street: () => [[C[0] - 8.5, gy(C[0] - 8.5, C[1]) + 2.4, C[1] + 0.5], [C[0] - 34, gy(C[0] - 34, C[1]) + 3, C[1] - 0.5]],
  harbour: () => [[L.dock.x + 17, 5.5, L.dock.z0 - 4], [L.dock.x - 3, 1.8, L.dock.z1 - 6]],
  hall: () => [frontOf(B('hall'), 15, 2.8), at(B('hall'), 3.4)],
  forge: () => [frontOf(B('forge'), 11, 2.4), at(B('forge'), 2.2)],
  stable: () => [frontOf(B('stables'), 12, 2.8), at(B('stables'), 1.8)],
  theatre: () => [frontOf(B('theatre'), 14, 2.6), at(B('theatre'), 3.2)],
  aerial: () => [[C[0] + 20, 105, C[1] + 85], [C[0] - 10, 0, C[1] - 4]],
  lane: () => { const h = homes[0]; return [frontOf(h, 16, 2.4), at(h, 2.5)]; },
  harboraerial: () => [[L.dock.x + 30, 38, L.dock.z0 - 40], [L.dock.x, 0, L.dock.z0 + 10]],
};
let cp, tg;
if (VIEWS[view]) [cp, tg] = VIEWS[view](); else { const n = view.split(',').map(Number); cp = n.slice(0, 3); tg = n.slice(3, 6); }
camera.position.set(...cp); camera.lookAt(...tg);

let frames = 0;
const hud = document.getElementById('hud'), panel = document.createElement('pre');
panel.style.cssText = 'position:absolute;left:8px;bottom:8px;margin:0;padding:4px 8px;background:#fff7eacc;border-radius:8px;font:700 11px system-ui';
hud.append(panel);
startLoop((dt, now, raw) => {
  village.update(dt, pal, camera.position);
  chunks.update(camera.position);
  sky.mesh.position.copy(camera.position); stars.points.position.copy(camera.position); moon.group.position.copy(camera.position);
  stars.update(now / 1000, pal.stars, gl.stats().pixelRatio); moon.update(hours, 0.5, pal.moon);
  water.mesh.position.set(Math.round(camera.position.x / 8) * 8, 0, Math.round(camera.position.z / 8) * 8); water.update(now / 1000, pal);
  gl.render(scene, camera, raw);
  if (++frames % 15 === 0) {
    let calls = 0, tris = 0;
    village.group.traverse((o) => { if (o.isMesh && o.visible && o.parent.visible) { calls++; tris += o.isInstancedMesh ? o.count * 20 : o.geometry.index.count / 3; } });
    const s = gl.stats();
    panel.textContent = `village calls ${calls} tris ${tris} | scene calls ${s.calls} tris ${s.triangles} | chunks ${chunks.built}/${chunks.wanted}`;
    if (frames > 20 && chunks.built === chunks.wanted) status.textContent = 'ready';
  }
});
