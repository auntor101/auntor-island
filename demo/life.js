// Life demo: ?comp=dragon|dog|cat ?t=<hours> ?bot=walk|stand|circle ?touch=1 ?seed=n ?warp=x,z ?focus=cat|dog|comp (close camera) ?stats=1
// window.__demo: { life, state, log, pet(), nearestCat() }. The status text becomes "ready" once models and terrain are in.
import { Scene, PerspectiveCamera, HemisphereLight, DirectionalLight, Fog, Color, Vector3, Group, Mesh, CapsuleGeometry, SphereGeometry, MeshStandardMaterial, Raycaster } from 'three';
import { createRenderer, startLoop } from '../src/render/renderer.js';
import { heightAt, isWet, zoneAt, LANDMARKS } from '../src/world/island.js';
import { ChunkManager, createTerrainMaterial } from '../src/world/terrain.js';
import { createSky } from '../src/world/sky.js';
import { createWater } from '../src/world/water.js';
import { skyPalette, sunDirection } from '../src/world/time.js';
import { stepPlayer } from '../src/play/player.js';
import { createCamera } from '../src/play/camera.js';
import { createLife } from '../src/life/index.js';

const q = new URLSearchParams(location.search), status = document.getElementById('status');
const gl = createRenderer(document.getElementById('gl'));
const scene = new Scene();
scene.fog = new Fog('#ffffff', 80, 260);
const camera = new PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 600);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
const hemi = new HemisphereLight('#ffffff', '#ffffff', 1.5), sun = new DirectionalLight('#ffffff', 3);
scene.add(hemi, sun, sun.target);
const sky = createSky(), water = createWater(), terrain = createTerrainMaterial(), chunks = new ChunkManager(scene, terrain);
scene.add(sky.mesh, water.mesh);

const hours = q.has('t') ? Number(q.get('t')) : 15.5, base = skyPalette(hours), sd = sunDirection(hours);
const pal = { ...base, sunDir: new Vector3(...sd), lightDir: new Vector3(...sd) };
if (sd[1] < 0) pal.lightDir.multiplyScalar(-1); // moonlight below the horizon
scene.fog.color.set(base.fog); hemi.color.set(base.ambient); hemi.groundColor.set(base.ambient).multiplyScalar(0.5).lerp(new Color('#8a6a48'), 0.4);
sun.color.set(base.sunColor); sun.intensity = 3 * base.sunIntensity; sun.position.copy(pal.lightDir).multiplyScalar(100);
sky.update(pal); terrain.update(pal);

let seed = Number(q.get('seed') || 11);
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const life = createLife(scene, { heightAt, isWet, zoneAt, rand, isTouch: q.has('touch'), onSfx: (n, o) => { log.sfx.push([n, +o.x.toFixed(1), +o.z.toFixed(1), +o.gain.toFixed(2)]); } });
if (q.has('comp')) life.setCompanion(q.get('comp'));

// stand-in player, 1.75 m
const mat = (c) => new MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.5, roughness: 0.9 });
const avatar = new Group(), body = new Mesh(new CapsuleGeometry(0.2, 0.9, 4, 12), mat('#ff7a59')), head = new Mesh(new SphereGeometry(0.16, 16, 12), mat('#fff7ea'));
body.position.y = 1; head.position.y = 1.6; avatar.add(body, head); scene.add(avatar);
const [wx, wz] = q.has('warp') ? q.get('warp').split(',').map(Number) : [LANDMARKS.spawn.x, LANDMARKS.spawn.z];
let state = { x: wx, z: wz, y: heightAt(wx, wz), heading: 0, speed: 0 };
const cam = createCamera(camera), bot = q.get('bot') || 'stand';
const log = { sfx: [], trace: [], frames: 0, maxWetAnimals: 0 };
const demo = window.__demo = { life, log, gl, get state() { return state; }, warp(x, z) { state = { x, z, y: heightAt(x, z), heading: state.heading, speed: 0 }; },
  pet: () => life.pet(), nearest: (kind) => life._views.filter((v) => v.kind === kind && v.holder.visible).sort((a, b) => Math.hypot(a.st.x - state.x, a.st.z - state.z) - Math.hypot(b.st.x - state.x, b.st.z - state.z))[0] };

let ready = false, t = 0, wp = 0;
startLoop((rawDt) => {
  const dt = 1 / 30;
  chunks.update(state);
  if (!ready && chunks.built === chunks.wanted && chunks.wanted > 0 && life.stats.animals > 0) { ready = true; status.textContent = 'ready'; }
  if (ready) {
    t += dt; wp += 1;
    const inp = { x: 0, y: 0, run: false, cameraYaw: cam.yaw };
    if (bot === 'walk') { inp.y = 1; inp.cameraYaw = Math.sin(t * 0.25) * 1.2; }
    else if (bot === 'circle') { inp.y = 1; inp.x = 0.35; inp.cameraYaw = cam.yaw; }
    state = stepPlayer(state, inp, dt, heightAt);
  }
  cam.update(state, 0, 0, dt);
  avatar.position.set(state.x, state.y, state.z); avatar.rotation.y = state.heading;
  life.update(dt, state, camera, pal);
  const f = q.get('focus');
  if (f && ready) { // close-up camera: 2.2 m from the chosen animal, a little above
    const v = f === 'comp' ? life._comp() : demo.nearest(f);
    if (v) { const p = v.holder.position; camera.position.set(p.x + 1.1, p.y + 0.9, p.z + 1.9); camera.lookAt(p.x, p.y + 0.35, p.z); }
  }
  sky.mesh.position.copy(camera.position);
  water.mesh.position.set(Math.round(state.x / 8) * 8, 0, Math.round(state.z / 8) * 8);
  water.update(performance.now() / 1000, pal);
  gl.render(scene, camera, rawDt * 1000);
  if (ready) {
    log.frames++;
    for (const a of life.animals) if (a.visible && isWet(a.x, a.z)) log.maxWetAnimals++;
    if (isWet(life.stats.comp.x, life.stats.comp.z)) log.maxWetAnimals++;
    if (log.frames % 15 === 0 && log.trace.length < 3000) log.trace.push([+t.toFixed(1), +state.x.toFixed(1), +state.z.toFixed(1), life.stats.comp.x.toFixed(1), life.stats.comp.z.toFixed(1)]);
  }
});
