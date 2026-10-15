// Pure, deterministic placement of plants for one 32 m chunk. No three import.
// A coarse 2 m lattice (height, zone, distance to water, slope) is sampled once per chunk (chunkField);
// every species then picks jittered-grid candidates (global cells, so chunk borders agree) and filters them.
import { CHUNK } from '../chunks.js';
import { SPECIES, SPECIES_BY_ID, MAX_PER_CHUNK } from './species.js';

export const STRIDE = 8; // x, y, z, rotY, scale, seed, extra1 (season id / colour), extra2 (variant)
const STEP = 2, M = 3, N = CHUNK / STEP + 1 + 2 * M; // lattice nodes cover the chunk plus M nodes of margin (so neighbours of border candidates are judged alike)
const TAU = Math.PI * 2;
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

export function hash(ix, iz, salt) {
  let h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iz | 0, 0x165667b1) ^ Math.imul((salt | 0) + 1, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function vnoise(x, z, salt) { // smooth value noise, 0..1
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz, salt), b = hash(ix + 1, iz, salt), c = hash(ix, iz + 1, salt), d = hash(ix + 1, iz + 1, salt);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

// Season belt by angle round the island (summer east/south, autumn west, spring north-east); dithered edges so belts blend in patches.
// 0 summer, 1 autumn, 2 spring, 3 grove blossom.
export function seasonAt(x, z, u, zone) {
  if (zone === 'grove') return 3;
  if (x * x + z * z < 900) return 0;
  const a = (Math.atan2(z, x) + TAU + (u - 0.5) * 0.55) % TAU;
  return a < 2.1 ? 0 : a < 4.2 ? 1 : 2;
}

const ZN = ['sea']; // zone name <-> small int (new zones from the terrain agent are added on first sight)
const zid = (n) => { let i = ZN.indexOf(n); if (i < 0) i = ZN.push(n) - 1; return i; };

export function chunkField(cx, cz, env) {
  const x0 = cx * CHUNK, z0 = cz * CHUNK, h = new Float32Array(N * N), zone = new Uint8Array(N * N), wet = new Uint8Array(N * N), wetD = new Uint8Array(N * N).fill(3), slope = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = x0 + (i - M) * STEP, z = z0 + (j - M) * STEP, k = j * N + i;
    h[k] = env.heightAt(x, z);
    const w = env.isWet(x, z);
    wet[k] = w ? 1 : 0;
    zone[k] = w ? 0 : zid(env.zoneAt(x, z));
    if (w) wetD[k] = 0;
  }
  for (let pass = 1; pass <= 2; pass++) {
    const prev = wetD.slice();
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i;
      if (prev[k] !== 3) continue;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ii = i + di, jj = j + dj;
        if (ii >= 0 && jj >= 0 && ii < N && jj < N && prev[jj * N + ii] === pass - 1) wetD[k] = pass;
      }
    }
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const e = (a, b) => h[Math.min(N - 1, Math.max(0, b)) * N + Math.min(N - 1, Math.max(0, a))];
    slope[j * N + i] = Math.hypot(e(i + 1, j) - e(i - 1, j), e(i, j + 1) - e(i, j - 1)) / (2 * STEP);
  }
  return { cx, cz, x0, z0, h, zone, wet, wetD, slope };
}

const node = (f, x, z) => {
  const i = Math.min(N - 1, Math.max(0, Math.round((x - f.x0) / STEP) + M)), j = Math.min(N - 1, Math.max(0, Math.round((z - f.z0) / STEP) + M));
  return j * N + i;
};
function heightBilinear(f, x, z) {
  const fx = (x - f.x0) / STEP + M, fz = (z - f.z0) / STEP + M, i = Math.min(N - 2, Math.max(0, Math.floor(fx))), j = Math.min(N - 2, Math.max(0, Math.floor(fz)));
  const tx = Math.min(1, Math.max(0, fx - i)), tz = Math.min(1, Math.max(0, fz - j)), a = f.h[j * N + i], b = f.h[j * N + i + 1], c = f.h[(j + 1) * N + i], d = f.h[(j + 1) * N + i + 1];
  if (Math.max(a, b, c, d) - Math.min(a, b, c, d) > 0.2) return NaN; // too bumpy for a bilinear patch: the caller asks heightAt
  return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
}

// One candidate of species s in global cell (ix, iz): the point, or null when the lattice says no.
function candidate(s, ix, iz, f, env) {
  const salt = s.index * 8, u = hash(ix, iz, salt), v = hash(ix, iz, salt + 1);
  const x = (ix + 0.5 + (u - 0.5) * s.jit) * s.cell, z = (iz + 0.5 + (v - 0.5) * s.jit) * s.cell;
  const k = node(f, x, z), zone = ZN[f.zone[k]], p0 = s.zones[zone];
  if (!p0 || f.wet[k]) return null;
  const h = f.h[k];
  if (f.slope[k] > s.slope || (s.hMax && h > s.hMax)) return null;
  const wd = f.wetD[k];
  if (wd < s.water || (s.nearWater && wd > s.nearWater)) return null;
  let p = p0;
  if (s.wood && zone === 'forest') p *= Math.min(1.1, Math.max(0.5, 0.7 + 0.5 * env.woods(x, z)));
  if (s.alt) p *= 1 - smooth(s.alt[0], s.alt[1], h);
  if (s.patch) p *= 0.45 + 0.9 * vnoise(x / 5, z / 5, salt + 3);
  if (s.drift) p *= smooth(0.5, 0.62, vnoise(x / 10, z / 10, salt + 3));
  if (s.clump) p *= 0.3 + 0.7 * smooth(0.3, 0.5, vnoise(x / 5, z / 5, salt + 3));
  if (hash(ix, iz, salt + 2) >= p) return null;
  return { x, z, zone, h, u: hash(ix, iz, salt + 4), k };
}

const ring = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export function placeChunk(f, env, tier) {
  const out = {}, x1 = f.x0 + CHUNK, z1 = f.z0 + CHUNK, L = env.landmarks;
  for (const s of SPECIES) {
    if (s.tier !== tier) continue;
    const buf = new Float32Array(MAX_PER_CHUNK * STRIDE);
    let n = 0;
    const ix0 = Math.floor(f.x0 / s.cell), ix1 = Math.floor(x1 / s.cell), iz0 = Math.floor(f.z0 / s.cell), iz1 = Math.floor(z1 / s.cell);
    for (let iz = iz0; iz <= iz1 && n < MAX_PER_CHUNK; iz++) for (let ix = ix0; ix <= ix1 && n < MAX_PER_CHUNK; ix++) {
      const c = candidate(s, ix, iz, f, env);
      if (!c || c.x < f.x0 || c.x >= x1 || c.z < f.z0 || c.z >= z1) continue;
      if (s.solid) {
        if (Math.hypot(c.x - L.spawn.x, c.z - L.spawn.z) < 7 || (s.id !== 'rock' && Math.hypot(c.x - L.village.x, c.z - L.village.z) < 13)) continue;
      }
      if (env.keepOut && env.keepOut(c.x, c.z, s.r)) continue; // village footprints, roads, props, docks (registered by the village)
      let blocked = false;
      for (const aid of s.avoid || []) { // bigger plants first: stay clear of every candidate of the species in `avoid`
        const a = SPECIES_BY_ID[aid], R = a.r + s.r, m = Math.ceil(R / a.cell) + 1, cx = Math.floor(c.x / a.cell), cz = Math.floor(c.z / a.cell);
        for (let dz = -m; dz <= m && !blocked; dz++) for (let dx = -m; dx <= m; dx++) {
          const o = candidate(a, cx + dx, cz + dz, f, env);
          if (o && (o.x - c.x) ** 2 + (o.z - c.z) ** 2 < R * R) { blocked = true; break; }
        }
        if (blocked) break;
      }
      if (blocked) continue;
      // exact water check for anything near the shore (lattice only knows 2 m nodes)
      const m = s.water >= 2 ? 2.4 : s.nearWater ? 0 : 0.5;
      if (f.wetD[c.k] < 3 || !s.noY) {
        if (env.isWet(c.x, c.z)) continue;
        if (m > 0 && ring.some(([a, b]) => env.isWet(c.x + a * m, c.z + b * m))) continue;
      }
      const o = n * STRIDE, sc = s.scale[0] + (s.scale[1] - s.scale[0]) * hash(ix, iz, s.index * 8 + 5);
      buf[o] = c.x; buf[o + 1] = (s.noY ? heightBilinear(f, c.x, c.z) : NaN); buf[o + 2] = c.z;
      if (Number.isNaN(buf[o + 1])) buf[o + 1] = env.heightAt(c.x, c.z);
      buf[o + 3] = hash(ix, iz, s.index * 8 + 6) * TAU;
      buf[o + 4] = s.alt ? sc * (1 - 0.35 * smooth(s.alt[0] + 12, s.alt[1], c.h)) : sc;
      buf[o + 5] = c.u;
      if (s.id === 'flower') { // a drift is one or two colours: a coarse noise picks the main colour, a few flowers take the second
        const m1 = Math.floor(vnoise(c.x / 14, c.z / 14, 91) * 6), m2 = (m1 + 1 + Math.floor(vnoise(c.x / 14, c.z / 14, 92) * 4)) % 6;
        buf[o + 6] = c.zone === 'grove' ? 6 : (c.u < 0.22 ? m2 : m1);
      } else if (s.id === 'rock') buf[o + 6] = c.zone === 'volcano' ? 1 : 0;
      else buf[o + 6] = seasonAt(c.x, c.z, c.u, c.zone);
      buf[o + 7] = s.variants ? Math.min(s.variants - 1, Math.floor(hash(ix, iz, s.index * 8 + 7) * s.variants)) : 0;
      n++;
    }
    out[s.id] = { n, data: buf.slice(0, n * STRIDE) };
  }
  return out;
}

// Convenience for tests: everything for one chunk (all tiers).
export function placeAll(cx, cz, env) {
  const f = chunkField(cx, cz, env), r = {};
  for (let t = 0; t < 3; t++) Object.assign(r, placeChunk(f, env, t));
  return r;
}
