import { Scene, PerspectiveCamera, HemisphereLight, DirectionalLight, Fog, Color } from 'three';
import { createRenderer, startLoop } from './render/renderer.js';
import { heightAt } from './world/island.js';
import { ChunkManager, createTerrainMaterial } from './world/terrain.js';
import { createSky, LATE_AFTERNOON } from './world/sky.js';
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
scene.add(sky.mesh, water.mesh);

// One palette drives sky, fog, lights and water (Task 4 swaps it over the day).
function applyPalette(p) {
  scene.fog.color.set(p.fog);
  hemi.color.set(p.ambient);
  hemi.groundColor.set(p.ambient).multiplyScalar(0.5).lerp(new Color('#8a6a48'), 0.4);
  sun.color.set(p.sunColor);
  sun.position.copy(p.sunDir).multiplyScalar(100);
  sky.update(p);
  terrain.update(p);
}
applyPalette(LATE_AFTERNOON);

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

const hud = document.getElementById('hud');
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

  const alt = Math.max(0, camera.position.y - heightAt(x, z)); // lift the fog when flying high so the island stays visible
  scene.fog.near = 80 + 2 * alt; scene.fog.far = 260 + 3 * alt;
  chunks.update(camera.position);
  sky.mesh.position.copy(camera.position);
  water.mesh.position.set(Math.round(x / 8) * 8, 0, Math.round(z / 8) * 8);
  water.update(now / 1000, LATE_AFTERNOON);

  gl.render(scene, camera, rawMs);
  acc += dt;
  if (acc > 0.25 && !panel.hidden) {
    acc = 0;
    const s = gl.stats();
    panel.textContent = `fps ${s.fps}\ncalls (all passes) ${s.calls}\ntris (all passes) ${s.triangles}\npr ${s.pixelRatio.toFixed(2)}\nchunks ${chunks.built}/${chunks.wanted}`;
  }
});
