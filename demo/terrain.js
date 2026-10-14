// Terrain harness: ?cam=lake|falls|cliff|mountain|river|aerial|village|tower, ?t=<hours>, ?snow=1, ?workers=0 (main-thread build).
// Prints "ready" in the HUD once every wanted chunk is built, with draw calls, triangles and main-thread ms per chunk.
import { Scene, PerspectiveCamera, HemisphereLight, DirectionalLight, Fog, Color, Vector3, Mesh, BufferGeometry, BufferAttribute, MeshBasicMaterial, DoubleSide } from 'three';
import { createRenderer, startLoop } from '../src/render/renderer.js';
import { heightAt, waterSurfaceAt, LANDMARKS, LAKE, RIVERS } from '../src/world/island.js';
import { ChunkManager, createTerrainMaterial } from '../src/world/terrain.js';
import { createSky } from '../src/world/sky.js';
import { skyPalette, sunDirection, moonDirection } from '../src/world/time.js';
import { createWater } from '../src/world/water.js';

const q = new URLSearchParams(location.search), hud = document.getElementById('hud');
const gl = createRenderer(document.getElementById('gl'));
const scene = new Scene();
scene.fog = new Fog('#ffffff', 80, 260);
const camera = new PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 600);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
const hemi = new HemisphereLight('#ffffff', '#ffffff', 1.5), sun = new DirectionalLight('#ffffff', 3);
scene.add(hemi, sun, sun.target);
const sky = createSky(), sea = createWater(), terrain = createTerrainMaterial();
const chunks = new ChunkManager(scene, terrain, undefined, q.get('workers') === '0' ? 0 : 2);
scene.add(sky.mesh, sea.mesh);

// Stand-in fresh water until the water agent's version lands: flat translucent lake disc and a ribbon per river.
const fresh = new MeshBasicMaterial({ color: '#3fa7c9', transparent: true, opacity: 0.72, side: DoubleSide, depthWrite: false });
{
  const pts = [], idx = [];
  for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2; pts.push(LAKE.x + 40 * Math.cos(a), LAKE.level, LAKE.z + 40 * Math.sin(a)); }
  pts.push(LAKE.x, LAKE.level, LAKE.z);
  for (let i = 0; i < 48; i++) idx.push(49, i, i + 1);
  const g = new BufferGeometry(); g.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3)); g.setIndex(idx);
  scene.add(new Mesh(g, fresh));
  for (const rv of RIVERS) {
    const p = [], ix = [];
    for (let i = 0; i < rv.pts.length - 1; i++) for (let k = 0; k < 24; k++) {
      const a = rv.pts[i], b = rv.pts[i + 1], u = k / 24, x = a[0] + (b[0] - a[0]) * u, z = a[1] + (b[1] - a[1]) * u, l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const nx = -(b[1] - a[1]) / l * 3.2, nz = (b[0] - a[0]) / l * 3.2, y = (waterSurfaceAt(x, z) ?? LAKE.level) + 0.03;
      p.push(x - nx, y, z - nz, x + nx, y, z + nz);
    }
    for (let i = 0; i < p.length / 6 - 1; i++) ix.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
    const g2 = new BufferGeometry(); g2.setAttribute('position', new BufferAttribute(new Float32Array(p), 3)); g2.setIndex(ix);
    scene.add(new Mesh(g2, fresh));
  }
}

const hours = q.has('t') ? Number(q.get('t')) : 12, snow = q.get('snow') === '1' ? 1 : 0;
const pal = { sunDir: new Vector3(), lightDir: new Vector3() }, tmp = new Color();
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
{
  const base = skyPalette(hours), sd = sunDirection(hours), md = moonDirection(hours), w = smooth(-0.15, 0.1, sd[1]);
  Object.assign(pal, base);
  pal.sunDir.fromArray(sd);
  pal.lightDir.set(md[0] + (sd[0] - md[0]) * w, md[1] + (sd[1] - md[1]) * w, md[2] + (sd[2] - md[2]) * w).normalize();
  pal.snow = snow;
  scene.fog.color.set(base.fog);
  hemi.color.set(base.ambient); hemi.groundColor.set(base.ambient).multiplyScalar(0.5).lerp(tmp.set('#8a6a48'), 0.4); hemi.intensity = 1.5;
  sun.color.set(base.sunColor); sun.intensity = 3 * base.sunIntensity; sun.position.copy(pal.lightDir).multiplyScalar(100);
  sky.update(pal); terrain.update(pal);
}

const R = LANDMARKS.roost, T = LANDMARKS.tower, g = (x, z) => heightAt(x, z);
const VIEWS = { // [camera x, y, z, target x, y, z]
  lake: [-4, g(-4, -2) + 5, -4, -5, 8, -50],
  falls: [24, 9, -44, -7, 10, -70],
  cliff: [R.x - 34, 14, R.z + 8, R.x + 6, g(R.x, R.z) - 4, R.z],
  mountain: [8, g(8, 30) + 5, 30, -22, 55, -100],
  river: [14, g(14, 2) + 3.5, 2, 24, 1, 22],
  aerial: [0, 190, 130, 0, 0, -30],
  village: [8, g(8, 6) + 8, 6, 0, 6, -40],
  tower: [T.x * 1.35, 16, T.z * 1.35, T.x, g(T.x, T.z) - 6, T.z],
};
const v = q.get('cam') ? (VIEWS[q.get('cam')] || q.get('cam').split(',').map(Number)) : VIEWS.lake;
camera.position.set(v[0], v[1], v[2]);
camera.lookAt(v[3], v[4], v[5]);

let frames = 0, t0 = performance.now();
startLoop((dt, now) => {
  const cp = camera.position;
  for (let i = 0; i < (chunks.ready ? 1 : 8); i++) chunks.update(cp); // demo only: load faster while the first frames are slow (software GL)
  sky.mesh.position.copy(cp);
  sea.mesh.position.set(Math.round(cp.x / 8) * 8, 0, Math.round(cp.z / 8) * 8);
  sea.update(now / 1000, pal);
  const alt = Math.max(0, cp.y - heightAt(cp.x, cp.z)); // same fog lift as main.js when high up
  scene.fog.near = 80 + 2 * alt; scene.fog.far = 260 + 3 * alt;
  gl.render(scene, camera, dt * 1000);
  if (++frames % 10 === 0) {
    const s = gl.stats();
    hud.textContent = `${chunks.ready && frames > 20 ? 'ready' : 'loading ' + chunks.built + '/' + chunks.wanted}\ncalls ${s.calls} tris ${s.triangles}\nmain ms/chunk ${(chunks.meshMs / Math.max(1, chunks.meshes)).toFixed(2)} (${chunks.meshes} meshes, ${chunks.pool.length ? 'workers' : 'main thread'})\nelapsed ${Math.round(performance.now() - t0)} ms`;
  }
});
