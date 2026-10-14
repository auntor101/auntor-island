import { Scene, PerspectiveCamera, HemisphereLight, DirectionalLight, Fog, Color, Vector3 } from 'three';
import { createRenderer, startLoop } from './render/renderer.js';
import { heightAt } from './world/island.js';
import { ChunkManager, createTerrainMaterial } from './world/terrain.js';
import { createSky } from './world/sky.js';
import { skyPalette, sunDirection, moonDirection } from './world/time.js';
import { createStars } from './world/stars.js';
import { createMoon } from './world/moon.js';
import { createSnow } from './world/snow.js';
import { createHud, loadPrefs, TIMES } from './ui/hud.js';
import { createWater } from './world/water.js';

const gl = createRenderer(document.getElementById('gl'));
const scene = new Scene();
scene.fog = new Fog('#ffffff', 80, 260);
const camera = new PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 600);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

const hemi = new HemisphereLight('#ffffff', '#ffffff', 1.5);
const sun = new DirectionalLight('#ffffff', 3);
scene.add(hemi, sun, sun.target);
const sky = createSky(), water = createWater(), terrain = createTerrainMaterial(), chunks = new ChunkManager(scene, terrain);
const stars = createStars(), moon = createMoon(), snow = createSnow(camera);
scene.add(sky.mesh, stars.points, moon.group, water.mesh, snow.points);

// One palette drives sky, fog, lights, terrain and water. It is rebuilt every frame from the hour and the snow amount.
const pal = { sunDir: new Vector3(), lightDir: new Vector3() }, WHITE = new Color('#ffffff'), tmp = new Color(), fogC = new Color(), horC = new Color(), zenC = new Color(), grey = new Color('#a8b4c8'), SNOWFOG = new Color('#e4edfb');
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
let fogNear = 80, fogFar = 260;
function applyPalette(hours, snowK) {
  const base = skyPalette(hours), sd = sunDirection(hours), md = moonDirection(hours), w = smooth(-0.15, 0.1, sd[1]), day = smooth(-0.1, 0.25, sd[1]);
  Object.assign(pal, base);
  pal.sunDir.fromArray(sd);
  pal.lightDir.set(md[0] + (sd[0] - md[0]) * w, md[1] + (sd[1] - md[1]) * w, md[2] + (sd[2] - md[2]) * w).normalize(); // moonlight takes over below the horizon
  pal.snow = snowK;
  // snow weather: whiter, greyer, closer fog; the horizon follows the fog so the two always blend
  fogC.set(base.fog).lerp(tmp.copy(SNOWFOG).multiplyScalar(0.2 + 0.8 * day), 0.35 * snowK);
  horC.set(base.horizon).lerp(fogC, snowK);
  zenC.set(base.zenith).lerp(tmp.copy(grey).multiplyScalar(0.15 + 0.85 * day), 0.3 * snowK);
  pal.fog = fogC; pal.horizon = horC; pal.zenith = zenC;
  fogNear = 80 * (1 - 0.4 * snowK); fogFar = 260 * (1 - 0.35 * snowK);
  scene.fog.color.copy(fogC);
  hemi.color.set(base.ambient);
  hemi.groundColor.set(base.ambient).multiplyScalar(0.5).lerp(tmp.set('#8a6a48'), 0.4);
  hemi.intensity = 1.5;
  sun.color.set(base.sunColor); sun.intensity = 3 * base.sunIntensity;
  sun.position.copy(pal.lightDir).multiplyScalar(100);
  sky.update(pal);
  terrain.update(pal);
  return { day, base };
}

// Time of day: Auto is a full day in 6 real minutes; a fixed choice (or ?t=<hours>) pauses it. ?snow=0|1, ?phase=0..1 (moon) for repeatable shots.
const params = new URLSearchParams(location.search);
const prefs = loadPrefs();
if (params.has('snow')) prefs.snow = params.get('snow') === '1';
const fixedT = params.has('t') ? Number(params.get('t')) : null;
let totalHours = 15.5, mode = prefs.mode, snowK = 0, snowOn = prefs.snow;
const phaseOf = () => params.has('phase') ? Number(params.get('phase')) : (0.5 + Math.floor((totalHours + 12) / 24) / 8) % 1; // one step per in-game day
const hud = document.getElementById('hud');
createHud(hud, prefs, { onMode: (m) => { mode = m; }, onSnow: (on) => { snowOn = on; } });

// Free-fly debug camera (Task 5 replaces it). WASD + shift, space/C up/down, mouse drag to look;
// touch: left half drags to move, right half drags to look. ?cam=spawn|village|aerial|topdown|beach|sunset|volcano|peak (or x,y,z,yawDeg,pitchDeg) for repeatable views.
const VIEWS = { // x,y,z,yawDeg,pitchDeg (yaw 0 looks north, -z)
  spawn: [8, heightAt(8, 60) + 12, 60, 0, 3], village: [8, heightAt(8, 6) + 8, 6, 0, -6], aerial: [0, 180, 70, 0, -60], topdown: [0, 200, 0, 0, -90],
  beach: [-60, 14, 80, -150, -8], sunset: [-60, 14, 80, 127, 6], volcano: [50, 55, 45, -52, -18], peak: [-10, 125, -30, 0, -14],
};
const q = new URLSearchParams(location.search).get('cam');
let [x, y, z, yaw, pitch] = VIEWS[q] || (q ? q.split(',').map(Number) : VIEWS.spawn);
yaw = yaw * Math.PI / 180; pitch = pitch * Math.PI / 180;
const keys = new Set(), touches = new Map();
addEventListener('keydown', (e) => keys.add(e.code));
addEventListener('keyup', (e) => keys.delete(e.code));
const cv = document.getElementById('gl');
cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); touches.set(e.pointerId, { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, move: e.pointerType === 'touch' && e.clientX < innerWidth / 2 }); });
cv.addEventListener('pointermove', (e) => {
  const t = touches.get(e.pointerId);
  if (!t) return;
  if (!t.move) { yaw -= (e.clientX - t.x) * 0.005; pitch = Math.max(-1.5, Math.min(1.5, pitch - (e.clientY - t.y) * 0.005)); }
  t.x = e.clientX; t.y = e.clientY;
});
const end = (e) => touches.delete(e.pointerId);
cv.addEventListener('pointerup', end);
cv.addEventListener('pointercancel', end);

const panel = document.createElement('pre');
const btn = document.createElement('button');
btn.textContent = 'stats';
btn.onclick = () => { panel.hidden = !panel.hidden; };
hud.append(btn, panel);

let acc = 0;
startLoop((dt, now, rawMs) => {
  let f = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0), r = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  for (const t of touches.values()) if (t.move) { f += Math.max(-1, Math.min(1, (t.y0 - t.y) / 50)); r += Math.max(-1, Math.min(1, (t.x - t.x0) / 50)); }
  const v = (keys.has('ShiftLeft') ? 60 : 20) * dt, cy = Math.cos(pitch);
  x += (-Math.sin(yaw) * cy * f + Math.cos(yaw) * r) * v;
  y += (Math.sin(pitch) * f + (keys.has('Space') ? 1 : 0) - (keys.has('KeyC') ? 1 : 0)) * v;
  z += (-Math.cos(yaw) * cy * f - Math.sin(yaw) * r) * v;
  camera.position.set(x, Math.max(y, heightAt(x, z) + 2), z);
  camera.rotation.set(pitch, yaw, 0, 'YXZ');

  if (fixedT != null) totalHours = fixedT;
  else if (mode === 'auto') totalHours += dt * 24 / 360;
  else totalHours = Math.floor(totalHours / 24) * 24 + TIMES[mode];
  snowK += ((snowOn ? 1 : 0) - snowK) * Math.min(1, dt * 1.2);
  const { day, base } = applyPalette(totalHours, snowK);
  const px = gl.stats().pixelRatio;
  const alt = Math.max(0, camera.position.y - heightAt(x, z)); // lift the fog when flying high so the island stays visible
  scene.fog.near = fogNear + 2 * alt; scene.fog.far = fogFar + 3 * alt;
  stars.points.position.copy(camera.position); moon.group.position.copy(camera.position);
  stars.update(now / 1000, base.stars * (1 - 0.6 * snowK), px);
  moon.update(totalHours, phaseOf(), base.moon * (1 - 0.5 * snowK));
  snow.update(now / 1000, snowK, px, tmp.set('#8fa4d8').lerp(WHITE, day));
  chunks.update(camera.position);
  sky.mesh.position.copy(camera.position);
  water.mesh.position.set(Math.round(x / 8) * 8, 0, Math.round(z / 8) * 8);
  water.update(now / 1000, pal);

  gl.render(scene, camera, rawMs);
  acc += dt;
  if (acc > 0.25 && !panel.hidden) {
    acc = 0;
    const s = gl.stats();
    panel.textContent = `fps ${s.fps}\ncalls (all passes) ${s.calls}\ntris (all passes) ${s.triangles}\npr ${s.pixelRatio.toFixed(2)}\nchunks ${chunks.built}/${chunks.wanted}`;
  }
});
