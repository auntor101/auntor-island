// Pure chunk maths and geometry (no three import, so it loads under node and in the terrain worker).
import { heightAt, zoneAt, woods, LANDMARKS, SEA_STACKS, freshLevelAt } from './island.js';

export const CHUNK = 32;
export const VIEW_RADIUS = 220; // flagship default, metres

export const chunkKey = (cx, cz) => `${cx},${cz}`;
export const chunkOf = (x, z) => ({ cx: Math.floor(x / CHUNK), cz: Math.floor(z / CHUNK) });

// Chunks whose centre lies within radius of (x, z), nearest first.
export function chunksAround(x, z, radius) {
  const a = chunkOf(x - radius, z - radius), b = chunkOf(x + radius, z + radius), out = [];
  for (let cx = a.cx; cx <= b.cx; cx++) {
    for (let cz = a.cz; cz <= b.cz; cz++) {
      const d = Math.hypot((cx + 0.5) * CHUNK - x, (cz + 0.5) * CHUNK - z);
      if (d <= radius) out.push({ cx, cz, d });
    }
  }
  return out.sort((p, q) => p.d - q.d).map(({ cx, cz }) => ({ cx, cz }));
}

export const lodFor = (d) => (d <= 80 ? 0 : d <= 160 ? 1 : 2);

const STEP = [1, 2, 4]; // metres between vertices per lod; each grid is a subset of the finer one
const GROVE = { x: -72, z: -30 };
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

// Per-vertex zone WEIGHTS (the fragment shader does the actual painting, so borders stay crisp).
// wa = fresh water level (or h + 6 when none near), rock, sand, snow; wb = ember, path, forest, black sand; au = curvature (+ = gully), grove.
// Grass is implicit: 1 - the largest other weight.
function weigh(x, z, h, curv, wa, wb, au, k) {
  const zone = zoneAt(x, z), r = Math.hypot(x, z), lo = Math.sin(x * 0.09 + 2 * Math.sin(z * 0.05 + 1)) * Math.sin(z * 0.1 + 2 * Math.sin(x * 0.06));
  const vil = 1 - smooth(30, 40, r);
  let rock = 0, sand = 0, snow = 0, ember = 0, black = 0, grove = 0;
  let path = smooth(-0.2, 0.5, lo) * 0.8 * vil, forest = smooth(-0.2, 0.9, woods(x, z)) * (1 - vil);
  const low = (t) => { path *= t; forest *= t; }; // fade lowland detail where sand takes over
  switch (zone) {
    case 'sea': case 'lake': case 'river': sand = 1; low(0); break;
    case 'beach': {
      const t = smooth(0.3, 1, h), bl = 1 - smooth(25, 55, Math.hypot(x - LANDMARKS.beach.x, z - LANDMARKS.beach.z));
      sand = (1 - t) * (1 - bl); black = (1 - t) * bl; low(t); break;
    }
    case 'cove': { const t = smooth(1.5, 3, h); sand = 1 - t; low(t); break; }
    case 'grove': grove = 1 - smooth(14, 24, Math.hypot(x - GROVE.x, z - GROVE.z)); forest = forest * (1 - grove) + 0.35 * grove; break;
    case 'roost': rock = smooth(8, 18, h); break;
    case 'tower': rock = 0.55 * (1 - smooth(8, 16, Math.hypot(x - LANDMARKS.tower.x, z - LANDMARKS.tower.z))); break;
    case 'glacier': snow = 1; break;
  }
  if (zone !== 'glacier') { rock = Math.max(rock, smooth(25, 55, h)); snow = Math.max(snow, smooth(50, 80, h) * 0.9); }
  rock *= 1 - snow;
  { const hi = Math.max(smooth(30, 50, h), snow, rock); forest *= 1 - hi; path *= 1 - hi; }
  if (zone !== 'sea') ember = 1 - smooth(32, 46, Math.hypot(x - 98, z - 8));
  const nv = 1 - ember; rock *= nv; sand *= nv; black *= nv; path *= nv; forest *= nv;
  for (const s of SEA_STACKS) { // sea stacks read as rock whatever the zone says
    const q = (x - s.x) ** 2 + (z - s.z) ** 2;
    if (q < 100) { rock = Math.max(rock, 2 * smooth(100, 36, q)); break; }
  }
  const fl = freshLevelAt(x, z); wa[k] = fl === null ? h + 6 : fl; wa[k + 1] = rock; wa[k + 2] = sand; wa[k + 3] = snow;
  wb[k] = ember; wb[k + 1] = path; wb[k + 2] = forest; wb[k + 3] = black;
  au[k / 2] = curv; au[k / 2 + 1] = grove;
}


// Pure chunk geometry (runs in a worker or on the main thread). Seams between lods are hidden with skirts: a downward
// strip around the border (depth 1 + 2 * step) that copies the edge vertex data. Returns null when the whole chunk is
// deep under the sea (the opaque water hides it), which saves draw calls. Arrays are fresh, so they can be transferred.
export function buildChunkData(cx, cz, lod) {
  const step = STEP[lod], n = CHUNK / step, V = n + 1, ox = cx * CHUNK, oz = cz * CHUNK;
  // heights on a grid padded by one step (lod 0 takes its normals from it)
  const P = n + 3, hs = new Float32Array(P * P);
  let hmax = -Infinity;
  for (let j = 0; j < P; j++) for (let i = 0; i < P; i++) hmax = Math.max(hmax, hs[j * P + i] = heightAt(ox + (i - 1) * step, oz + (j - 1) * step));
  if (hmax < -4) return null;
  const skirt = 1 + 2 * step, nv = V * V + 4 * V;
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), wa = new Float32Array(nv * 4), wb = new Float32Array(nv * 4), au = new Float32Array(nv * 2);
  for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) {
    const k = j * V + i, hp = (j + 1) * P + i + 1, h = hs[hp];
    // normals and curvature use fixed baselines (1 m, 3 m), so a vertex shared by two lods gets identical data
    const wx = ox + i * step, wz = oz + j * step;
    const nx = step === 1 ? hs[hp - 1] - hs[hp + 1] : heightAt(wx - 1, wz) - heightAt(wx + 1, wz);
    const nz = step === 1 ? hs[hp - P] - hs[hp + P] : heightAt(wx, wz - 1) - heightAt(wx, wz + 1), ny = 2, l = Math.hypot(nx, ny, nz);
    pos[k * 3] = i * step; pos[k * 3 + 1] = h; pos[k * 3 + 2] = j * step;
    nor[k * 3] = nx / l; nor[k * 3 + 1] = ny / l; nor[k * 3 + 2] = nz / l;
    const lap = (heightAt(wx - 3, wz) + heightAt(wx + 3, wz) + heightAt(wx, wz - 3) + heightAt(wx, wz + 3)) / 4 - h;
    weigh(wx, wz, h, Math.max(-1, Math.min(1, lap / 1.5)), wa, wb, au, k * 4);
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
      const t = e[m];
      pos.set([pos[t * 3], pos[t * 3 + 1] - skirt, pos[t * 3 + 2]], s * 3);
      nor.set(nor.subarray(t * 3, t * 3 + 3), s * 3);
      wa.set(wa.subarray(t * 4, t * 4 + 4), s * 4);
      wb.set(wb.subarray(t * 4, t * 4 + 4), s * 4);
      au.set(au.subarray(t * 2, t * 2 + 2), s * 2);
      if (m < V - 1) idx.push(e[m], e[m + 1], s, e[m + 1], s + 1, s);
    }
  }
  return { pos, nor, wa, wb, au, idx: Uint16Array.from(idx) };
}
