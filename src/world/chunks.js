// Pure chunk maths (no three import so it loads under node).
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
