// Flora demo. ?cam=meadow|forest|grove|beach|mountain|volcano|lake|aerial|autumn|spring  ?t=<hours>  ?snow=1  ?season=auto|autumn|spring|summer  ?pose=x,y,z,yawDeg,pitchDeg
// Writes "ready" and the flora stats to #hud once every chunk in range is built. Free camera: WASD/arrows + drag.
import { Scene, PerspectiveCamera, HemisphereLight, DirectionalLight, Fog, Color, Vector3 } from 'three';
import { createRenderer, startLoop } from '../src/render/renderer.js';
import { heightAt, zoneAt, isWet } from '../src/world/island.js';
import { ChunkManager, createTerrainMaterial } from '../src/world/terrain.js';
import { createSky } from '../src/world/sky.js';
import { createWater } from '../src/world/water.js';
import { skyPalette, sunDirection, moonDirection } from '../src/world/time.js';
import { createStars } from '../src/world/stars.js';
import { createMoon } from '../src/world/moon.js';
import { createSnow } from '../src/world/snow.js';
import { createFlora } from '../src/world/flora/flora.js';

const q = new URLSearchParams(location.search), hud = document.getElementById('hud');
const gl = createRenderer(document.getElementById('gl'));
const scene = new Scene();
scene.fog = new Fog('#ffffff', 80, 260);
const camera = new PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 600);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
const hemi = new HemisphereLight('#ffffff', '#ffffff', 1.5), sun = new DirectionalLight('#ffffff', 3);
scene.add(hemi, sun, sun.target);
const sky = createSky(), water = createWater(), terrain = createTerrainMaterial(), chunks = new ChunkManager(scene, terrain), stars = createStars(), moon = createMoon(), snow = createSnow(camera);
scene.add(sky.mesh, stars.points, moon.group, water.mesh, snow.points);
const flora = createFlora(scene, { heightAt, zoneAt, isWet, getSeason: () => q.get('season') || 'auto' });

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const pal = { sunDir: new Vector3(), lightDir: new Vector3() }, tmp = new Color(), fogC = new Color(), WHITE = new Color('#ffffff'), snowOn = q.get('snow') === '1';
let snowK = snowOn ? 1 : 0;
function palette(hours) { // the same maths as main.js applyPalette
  const base = skyPalette(hours), sd = sunDirection(hours), md = moonDirection(hours), w = smooth(-0.15, 0.1, sd[1]), day = smooth(-0.1, 0.25, sd[1]);
  Object.assign(pal, base);
  pal.sunDir.fromArray(sd);
  pal.lightDir.set(md[0] + (sd[0] - md[0]) * w, md[1] + (sd[1] - md[1]) * w, md[2] + (sd[2] - md[2]) * w).normalize();
  pal.snow = snowK;
  fogC.set(base.fog).lerp(tmp.set('#e4edfb').multiplyScalar(0.2 + 0.8 * day), 0.35 * snowK);
  pal.fog = fogC; pal.horizon = new Color(base.horizon).lerp(fogC, snowK);
  scene.fog.color.copy(fogC);
  hemi.color.set(base.ambient); hemi.groundColor.set(base.ambient).multiplyScalar(0.5).lerp(tmp.set('#8a6a48'), 0.4);
  sun.color.set(base.sunColor); sun.intensity = 3 * base.sunIntensity; sun.position.copy(pal.lightDir).multiplyScalar(100);
  sky.update(pal); terrain.update(pal);
  return { day, base };
}

// yaw 0 looks north (-z); AT(x, z, metres above the ground, yawDeg, pitchDeg)
const AT = (x, z, up, yaw, pitch) => [x, heightAt(x, z) + up, z, yaw, pitch];
const VIEWS = {
  meadow: AT(-62, 66, 1.5, 25, -14), meadowclose: AT(-58, 60, 0.7, 30, -22), forest: AT(-62, 90, 2.4, 160, -6), grove: AT(-62, -26, 2.2, 90, -5), groveclose: AT(-72, -34, 1.0, 70, -14),
  beach: AT(-80, 104, 2.4, -150, -6), mountain: AT(-128, 18, 5, 70, 4), volcano: AT(60, 4, 6, -78, 0), lake: AT(0, 92, 2, 180, -4),
  aerial: [0, 190, 120, 0, -52], autumn: AT(-110, 20, 3, 95, -3), spring: AT(70, -85, 3, 180, -4), village: AT(8, 20, 2, 0, -3),
};
const cam = q.get('pose') ? q.get('pose').split(',').map(Number) : VIEWS[q.get('cam') || 'meadow'];
let [x, y, z, yaw, pitch] = cam; yaw = yaw * Math.PI / 180; pitch = pitch * Math.PI / 180;
const keys = new Set(); let drag = null;
addEventListener('keydown', (e) => keys.add(e.code)); addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('pointerdown', (e) => { drag = [e.clientX, e.clientY]; });
addEventListener('pointerup', () => { drag = null; });
addEventListener('pointermove', (e) => { if (!drag) return; yaw -= (e.clientX - drag[0]) * 0.005; pitch = Math.max(-1.5, Math.min(1.5, pitch - (e.clientY - drag[1]) * 0.005)); drag = [e.clientX, e.clientY]; });

const hours = q.has('t') ? Number(q.get('t')) : 12.5;
let frames = 0, done = false;
const player = new Vector3(); // stand-in player 2 m in front of the camera: walk into the grass to see it bend away
startLoop((dt, now, rawMs) => {
  const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0), r = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0), v = (keys.has('ShiftLeft') ? 40 : 8) * dt, cy = Math.cos(pitch);
  x += (-Math.sin(yaw) * cy * f + Math.cos(yaw) * r) * v; z += (-Math.cos(yaw) * cy * f - Math.sin(yaw) * r) * v; y += ((keys.has('Space') ? 1 : 0) - (keys.has('KeyC') ? 1 : 0)) * v;
  camera.position.set(x, Math.max(y, heightAt(x, z) + 0.6), z); camera.rotation.set(pitch, yaw, 0, 'YXZ');
  const cp = camera.position, px = cp.x - Math.sin(yaw) * 2.2, pz = cp.z - Math.cos(yaw) * 2.2;
  player.set(px, heightAt(px, pz), pz);
  snowK += ((snowOn ? 1 : 0) - snowK) * Math.min(1, dt * 1.2);
  const { day, base } = palette(hours);
  scene.fog.near = 80 * (1 - 0.4 * snowK); scene.fog.far = 260 * (1 - 0.35 * snowK);
  stars.points.position.copy(cp); moon.group.position.copy(cp);
  stars.update(now / 1000, base.stars, 1); moon.update(hours, 0.5, base.moon);
  snow.update(now / 1000, snowK, 1, tmp.set('#8fa4d8').lerp(WHITE, day));
  chunks.update(cp); sky.mesh.position.copy(cp); water.mesh.position.set(Math.round(cp.x / 8) * 8, 0, Math.round(cp.z / 8) * 8); water.update(now / 1000, pal);
  if (!frames++) { flora.flush(cp); for (let i = 0; i < 120; i++) chunks.update(cp); } // build every chunk in range up front so a screenshot sees the finished island
  flora.update(cp, q.has('noplayer') ? null : player, dt, pal, camera);
  gl.render(scene, camera, rawMs);
  const s = flora.stats(), c = gl.stats();
  if (!done && s.ready && chunks.built === chunks.wanted && !s.pending && frames > 3) done = true;
  hud.textContent = (done ? 'ready\n' : 'loading\n') + `flora: ${s.instances} inst, ${s.drawCalls} draws, ${(s.triangles / 1000).toFixed(0)}k tris\nscene: ${c.calls} draws, ${(c.triangles / 1000).toFixed(0)}k tris (all passes)\nbuild avg ${s.buildMsAvg.toFixed(1)} max ${s.buildMsMax.toFixed(1)} ms
${Object.entries(s.pools).map(([k, n]) => k + " " + n).join(", ")}`;
  window.__flora = s; window.__gl = c;
});
