import { BufferGeometry, BufferAttribute, Mesh, Color, DataTexture, RedFormat, NearestFilter, MeshToonMaterial } from 'three';
import { heightAt, zoneAt, woods, LANDMARKS, SEA_STACKS } from './island.js';
const GROVE = { x: -72, z: -30 };
import { CHUNK, VIEW_RADIUS, chunkKey, chunksAround, lodFor } from './chunks.js';

const STEP = [1, 2, 4]; // metres between vertices per lod; each grid is a subset of the finer one
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash = (x, z) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };

// Ground colours (sRGB hex -> linear Color). Vertex colours only, no textures.
const C = Object.fromEntries(Object.entries({
  grass: '#8cc84b', grass2: '#6fb34a', forest: '#3f8a43', forest2: '#2f7a46', grove: '#4fbf7a', path: '#d3a867',
  sand: '#f0d9a2', wet: '#c9b27c', black: '#3b3640', rock: '#948c8a', rock2: '#6f6a78', snow: '#f6f9ff', ice: '#b7d3ee',
  ember: '#4a2e30', ember2: '#6b3b2e', lava: '#ff6a24', tower: '#a9b36f',
}).map(([k, v]) => [k, new Color(v)]));
const out = new Color();
const mix = (a, b, t) => out.copy(a).lerp(b, t); // always returns the shared `out`

// Lowland ground: meadow -> forest floor by the same noise the zones use (continuous, no zone-edge saw-teeth),
// with the village path showing through inside r < 35.
const grd = new Color(), lg = new Color(), low = new Color();
function lowland(x, z, lo) {
  const r = Math.hypot(x, z), v = 1 - smooth(30, 40, r);
  mix(C.grass, C.grass2, 0.5 + 0.5 * lo);
  lg.copy(out).lerp(mix(C.forest, C.forest2, 0.5 + 0.5 * lo), smooth(-0.2, 0.9, woods(x, z)) * (1 - v));
  return low.copy(mix(lg, C.path, smooth(-0.2, 0.5, lo) * 0.8 * v));
}

// Vertex colour for a world point into rgb[i..i+2]. ny = surface normal y.
function paint(x, z, h, ny, rgb, i) {
  const zone = zoneAt(x, z), n = hash(x, z), lo = Math.sin(x * 0.09 + 2 * Math.sin(z * 0.05 + 1)) * Math.sin(z * 0.1 + 2 * Math.sin(x * 0.06)); // warped, so no checkerboard
  switch (zone) {
    case 'sea': mix(C.wet, C.sand, smooth(-3, 0, h)); break;
    case 'beach': {
      mix(C.sand, C.black, 1 - smooth(25, 55, Math.hypot(x - LANDMARKS.beach.x, z - LANDMARKS.beach.z)));
      grd.copy(out); mix(grd, lowland(x, z, lo), smooth(0.3, 1, h)); break;
    }
    case 'cove': mix(C.sand, C.grass, smooth(1.5, 3, h)); break;
    case 'grove': mix(C.grove, C.forest2, 0.35 + 0.35 * lo); grd.copy(out); mix(grd, lowland(x, z, lo), smooth(14, 24, Math.hypot(x - GROVE.x, z - GROVE.z))); break;
    case 'roost': grd.copy(lowland(x, z, lo)); mix(grd, C.rock, smooth(8, 18, h)); break;
    case 'tower': mix(C.tower, C.rock, 0.3 + 0.3 * lo); grd.copy(out); mix(grd, lowland(x, z, lo), smooth(8, 16, Math.hypot(x - LANDMARKS.tower.x, z - LANDMARKS.tower.z))); break;
    case 'glacier': mix(C.snow, C.ice, 0.25 * (0.5 + 0.5 * lo)); break;
    default: out.copy(lowland(x, z, lo)); // meadow, forest, village
  }
  // high ground is rock then snow whatever the zone (zone discs would leave a hard line on the mountain)
  if (zone !== 'glacier') { grd.copy(out); mix(grd, C.rock, smooth(25, 55, h)); grd.copy(out); mix(grd, C.snow, smooth(58, 86, h) * 0.85); }
  // volcano: ember rock fading out over 32-46 m, glowing lava in the crater
  const vd = Math.hypot(x - 98, z - 8), vo = zone === 'sea' ? 0 : 1 - smooth(32, 46, vd);
  if (vo > 0) { grd.copy(out); lg.copy(mix(C.ember, C.ember2, 0.5 + 0.5 * lo)); mix(grd, lg, vo); if (vd < 11) mix(out, C.lava, smooth(11, 6, vd) * 0.9); }
  // sea stacks read as rock whatever the zone says
  for (const s of SEA_STACKS) {
    const q = (x - s.x) ** 2 + (z - s.z) ** 2;
    if (q < 100) { mix(out, C.rock2, smooth(100, 36, q)); break; }
  }
  // steep ground is rock (the glacier keeps snow on gentle slopes only)
  mix(out, zone === 'glacier' ? C.rock2 : C.rock, smooth(0.9, 0.7, ny) * (zone === 'sea' ? 0.5 : 1) * (1 - vo));
  const g = (1 + 0.09 * Math.sin(h * 0.9 + lo * 2) * (zone === 'mountain' || zone === 'roost' ? 1 : 0.4)) * (1 + 0.07 * lo) + 0.06 * (n - 0.5);
  rgb[i] = out.r * g; rgb[i + 1] = out.g * g; rgb[i + 2] = out.b * g;
}

// Chunk mesh. Seams between lods are hidden with skirts: a downward strip around the border
// (depth 1 + 2 * step) that copies the edge vertex colour and normal. Returns null when the whole
// chunk is deep under the sea (the opaque water hides it), which saves draw calls.
export function buildChunkMesh(cx, cz, lod, material) {
  const step = STEP[lod], n = CHUNK / step, V = n + 1, ox = cx * CHUNK, oz = cz * CHUNK;
  // heights on a grid padded by one step (lod 0 takes its normals from it)
  const P = n + 3, hs = new Float32Array(P * P);
  let hmax = -Infinity;
  for (let j = 0; j < P; j++) for (let i = 0; i < P; i++) hmax = Math.max(hmax, hs[j * P + i] = heightAt(ox + (i - 1) * step, oz + (j - 1) * step));
  if (hmax < -4) return null;
  const skirt = 1 + 2 * step, nv = V * V + 4 * V;
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
  for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) {
    const k = j * V + i, hp = (j + 1) * P + i + 1, h = hs[hp];
    // normals always use a 1 m baseline, so a vertex shared by two lods gets the same normal (no lighting line at seams)
    const wx = ox + i * step, wz = oz + j * step;
    const nx = step === 1 ? hs[hp - 1] - hs[hp + 1] : heightAt(wx - 1, wz) - heightAt(wx + 1, wz);
    const nz = step === 1 ? hs[hp - P] - hs[hp + P] : heightAt(wx, wz - 1) - heightAt(wx, wz + 1), ny = 2, l = Math.hypot(nx, ny, nz);
    pos.set([i * step, h, j * step], k * 3);
    nor.set([nx / l, ny / l, nz / l], k * 3);
    paint(ox + i * step, oz + j * step, h, ny / l, col, k * 3);
  }
  const idx = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = j * V + i, b = a + V, c = a + 1, d = b + 1;
    idx.push(a, b, c, c, b, d);
  }
  // skirt edges ordered so each strip faces outward: north +x, east +z, south -x, west -z
  const edges = [
    Array.from({ length: V }, (_, i) => i),
    Array.from({ length: V }, (_, j) => j * V + n),
    Array.from({ length: V }, (_, i) => n * V + n - i),
    Array.from({ length: V }, (_, j) => (n - j) * V),
  ];
  let s = V * V;
  for (const e of edges) {
    for (let m = 0; m < V; m++, s++) {
      const t = e[m] * 3;
      pos.set([pos[t], pos[t + 1] - skirt, pos[t + 2]], s * 3);
      nor.set(nor.subarray(t, t + 3), s * 3);
      col.set(col.subarray(t, t + 3), s * 3);
      if (m < V - 1) idx.push(e[m], e[m + 1], s, e[m + 1], s + 1, s);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('normal', new BufferAttribute(nor, 3));
  g.setAttribute('color', new BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  const mesh = new Mesh(g, material);
  mesh.position.set(ox, 0, oz);
  return mesh;
}

// One material for every chunk: 4-step toon ramp + vertex colours; fog comes from scene.fog.
export function createTerrainMaterial() {
  const ramp = new DataTexture(new Uint8Array([95, 150, 210, 255]), 4, 1, RedFormat);
  ramp.minFilter = ramp.magFilter = NearestFilter;
  ramp.needsUpdate = true;
  return new MeshToonMaterial({ vertexColors: true, gradientMap: ramp });
}

// Streams chunks around the camera: at most 2 builds per frame, nearest first.
export class ChunkManager {
  constructor(scene, material, radius = VIEW_RADIUS) {
    Object.assign(this, { scene, material, radius, map: new Map(), built: 0, wanted: 0 });
  }
  update(cam) {
    const want = chunksAround(cam.x, cam.z, this.radius), keep = new Set(chunksAround(cam.x, cam.z, this.radius + 24).map((c) => chunkKey(c.cx, c.cz)));
    for (const [k, e] of this.map) if (!keep.has(k)) { this.#drop(e); this.map.delete(k); }
    let budget = 2, built = 0;
    for (const { cx, cz } of want) {
      const k = chunkKey(cx, cz), e = this.map.get(k), d = Math.hypot((cx + 0.5) * CHUNK - cam.x, (cz + 0.5) * CHUNK - cam.z);
      // keep the current lod while within 8 m of a band edge (no flip-flopping)
      if (e && lodFor(d - 8) <= e.lod && e.lod <= lodFor(d + 8)) { built++; continue; }
      if (budget === 0) continue;
      budget--;
      const lod = lodFor(d), mesh = buildChunkMesh(cx, cz, lod, this.material);
      if (e) this.#drop(e);
      if (mesh) this.scene.add(mesh);
      this.map.set(k, { mesh, lod });
      built++;
    }
    this.built = built;
    this.wanted = want.length;
  }
  #drop(e) { if (e.mesh) { this.scene.remove(e.mesh); e.mesh.geometry.dispose(); } }
  dispose() { for (const e of this.map.values()) this.#drop(e); this.map.clear(); }
}
