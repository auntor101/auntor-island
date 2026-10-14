// Walk demo: ?at=village|beach|cove|tower|roost|grove  ?yaw=<deg>  ?bot=forward:5,left:2,run:3  (bot uses a fixed 1/30 s step)
import { Scene, PerspectiveCamera, HemisphereLight, DirectionalLight, Fog, Color, Group, Mesh, CapsuleGeometry, SphereGeometry, MeshStandardMaterial } from 'three';
import { createRenderer, startLoop } from '../src/render/renderer.js';
import { heightAt, LANDMARKS } from '../src/world/island.js';
import { ChunkManager, createTerrainMaterial } from '../src/world/terrain.js';
import { createSky, LATE_AFTERNOON } from '../src/world/sky.js';
import { createWater } from '../src/world/water.js';
import { stepPlayer } from '../src/play/player.js';
import { createControls } from '../src/play/controls.js';
import { createCamera } from '../src/play/camera.js';

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('gl'), hud = document.getElementById('hud'), status = document.getElementById('status');
const gl = createRenderer(canvas);
const scene = new Scene();
scene.fog = new Fog('#ffffff', 80, 260);
const camera = new PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 600);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

const hemi = new HemisphereLight('#ffffff', '#ffffff', 1.5), sun = new DirectionalLight('#ffffff', 3);
scene.add(hemi, sun, sun.target);
const sky = createSky(), water = createWater(), terrain = createTerrainMaterial(), chunks = new ChunkManager(scene, terrain);
scene.add(sky.mesh, water.mesh);
const p = LATE_AFTERNOON;
scene.fog.color.set(p.fog); hemi.color.set(p.ambient);
hemi.groundColor.set(p.ambient).multiplyScalar(0.5).lerp(new Color('#8a6a48'), 0.4);
sun.color.set(p.sunColor); sun.position.copy(p.sunDir).multiplyScalar(100);
sky.update(p); terrain.update(p);

// Stand-in avatar, 1.75 m, paper palette. Faces -z at heading 0.
const mat = (c) => new MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.55, roughness: 0.9 }); // emissive keeps the paper colours readable under the sunset light
const [cream, ink, coral] = [mat('#fff7ea'), mat('#2a1f3d'), mat('#ff7a59')];
const part = (g, m, x, y, z, pivot) => { const mesh = new Mesh(g, m); mesh.position.set(0, y, 0); const o = new Group(); o.position.set(x, pivot, z); o.add(mesh); return o; };
const avatar = new Group();
const legL = part(new CapsuleGeometry(0.09, 0.62, 4, 8), ink, -0.1, -0.4, 0, 0.8), legR = part(new CapsuleGeometry(0.09, 0.62, 4, 8), ink, 0.1, -0.4, 0, 0.8);
const armL = part(new CapsuleGeometry(0.07, 0.4, 4, 8), cream, -0.27, -0.28, 0, 1.45), armR = part(new CapsuleGeometry(0.07, 0.4, 4, 8), cream, 0.27, -0.28, 0, 1.45);
const torso = new Mesh(new CapsuleGeometry(0.2, 0.35, 4, 12), coral), head = new Mesh(new SphereGeometry(0.15, 16, 12), cream), hair = new Mesh(new SphereGeometry(0.16, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), ink);
torso.position.y = 1.15; head.position.y = 1.62; hair.position.set(0, 1.64, 0.02);
const eyes = [-0.05, 0.05].map((x) => { const e = new Mesh(new SphereGeometry(0.02, 8, 6), ink); e.position.set(x, 1.63, -0.14); return e; });
avatar.add(legL, legR, armL, armR, torso, head, hair, ...eyes);
scene.add(avatar);

// start position
const at = LANDMARKS[q.get('at')] || LANDMARKS.spawn;
let state = { x: at.x, z: at.z, y: heightAt(at.x, at.z), heading: (Number(q.get('yaw')) || 0) * Math.PI / 180, speed: 0 };
const controls = createControls(canvas, hud), cam = createCamera(camera);
const walk = window.__walk = { state, minClearance: Infinity, camera: cam, trace: [], bot: null, done: false };

// bot: "forward:5,left:2,run:3" as [dir, seconds] queue; "run" = forward + run
const DIRS = { forward: [0, 1], back: [0, -1], left: [-1, 0], right: [1, 0], run: [0, 1], idle: [0, 0] };
let queue = [], botT = 0;
walk.startBot = (spec) => { queue = spec.split(',').map((s) => { const [d, t] = s.split(':'); return { d, t: Number(t) }; }); botT = 0; walk.done = false; walk.trace.length = 0; };
walk.warp = (x, z, yawDeg) => { state = { x, z, y: heightAt(x, z), heading: yawDeg * Math.PI / 180, speed: 0 }; cam.yaw = state.heading; };
const botInput = (dt) => {
  while (queue.length && botT >= queue[0].t) { botT -= queue[0].t; queue.shift(); }
  if (!queue.length) { walk.done = true; return null; }
  botT += dt;
  const [x, y] = DIRS[queue[0].d];
  return { x, y, run: queue[0].d === 'run', lookDX: 0, lookDY: 0 };
};

const FIXED = q.has('bot') ? 1 / 30 : 0;
let ready = false, phase = 0, frame = 0;
if (q.has('bot')) walk.startBot(q.get('bot'));
startLoop((rawDt) => {
  const dt = FIXED || rawDt;
  chunks.update(state);
  if (!ready && chunks.built === chunks.wanted && chunks.wanted > 0) { ready = true; status.textContent = 'ready'; if (q.has('bot')) walk.startBot(q.get('bot')); }
  const c = controls.read();
  const bot = ready ? botInput(dt) : null;
  const input = bot || (q.has('bot') ? { x: 0, y: 0, run: false, lookDX: 0, lookDY: 0 } : c);
  if (q.has('bot')) input.lookDX = input.lookDY = 0;
  state = stepPlayer(state, { x: input.x, y: input.y, run: input.run, cameraYaw: cam.yaw }, dt, heightAt);
  cam.update(state, input.lookDX, input.lookDY, dt);

  phase += state.speed * dt * 2.2;
  const k = Math.min(1, state.speed / 5.5), sw = Math.sin(phase) * (0.35 + 0.65 * k) * Math.min(1, state.speed / 1.5);
  legL.rotation.x = sw; legR.rotation.x = -sw; armL.rotation.x = -sw * 0.9; armR.rotation.x = sw * 0.9;
  avatar.position.set(state.x, state.y + Math.abs(Math.cos(phase)) * 0.04 * Math.min(1, state.speed / 1.5), state.z);
  avatar.rotation.y = state.heading;

  sky.mesh.position.copy(camera.position);
  water.mesh.position.set(Math.round(state.x / 8) * 8, 0, Math.round(state.z / 8) * 8);
  water.update(performance.now() / 1000, p);
  gl.render(scene, camera, rawDt * 1000);

  if (ready) {
    walk.state = state;
    const cl = camera.position.y - Math.max(heightAt(camera.position.x, camera.position.z), 0);
    walk.minClearance = Math.min(walk.minClearance, cl); walk.frame = ++frame;
    if (walk.trace.length < 4000) walk.trace.push([+state.x.toFixed(2), +state.z.toFixed(2), +state.y.toFixed(2), +state.speed.toFixed(2), +cl.toFixed(2)]);
  }
});
