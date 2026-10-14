// Pure helpers for the sfx path: voice cap, per-name rate limit, distance and pan.
export function createVoiceLimiter(max = 24) {
  const ends = [];
  return {
    tryAcquire(now, dur) {
      for (let i = ends.length - 1; i >= 0; i--) if (ends[i] <= now) ends.splice(i, 1);
      if (ends.length >= max) return false;
      ends.push(now + dur);
      return true;
    },
    get count() { return ends.length; },
  };
}
export function createRateLimiter() {
  const last = new Map();
  return { allow(name, now, gap) { const l = last.get(name); if (l !== undefined && now - l < gap) return false; last.set(name, now); return true; } };
}
// Listener at (lx,lz) facing heading h: forward = (sin h, cos h), so right = (-cos h, sin h). Flip `pan` if the game's handedness differs.
export function spatial(lx, lz, h, x, z, maxD = 60) {
  const dx = x - lx, dz = z - lz, d = Math.hypot(dx, dz);
  if (d >= maxD) return { gain: 0, pan: 0 };
  const k = 1 - d / maxD, right = dx * -Math.cos(h) + dz * Math.sin(h);
  return { gain: k * k, pan: Math.max(-1, Math.min(1, right / (d + 2))) };
}
