// Pure walking physics. heading 0 faces -z (same as camera yaw); forward = (-sin h, -cos h).
export const WALK = 2.2, RUN = 5.5, MAX_SLOPE = 1.2, MIN_Y = -0.6;
const ACCEL = 14, FRICTION = 16, TURN = 14, SLIDE = 3, STEP = 1 / 60;

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const grad = (f, x, z) => { const e = 0.25; return [(f(x + e, z) - f(x - e, z)) / (2 * e), (f(x, z + e) - f(x, z - e)) / (2 * e)]; };
// A spot is walkable unless it is deep water or (higher than where we stand and) too steep.
const ok = (f, x, z, y) => { const h = f(x, z); return h >= MIN_Y && !(h > y && Math.hypot(...grad(f, x, z)) > MAX_SLOPE); };

// Push (x,z) out of circles and rotated boxes (village colliders), radius PR. Substeps are 1/60 s, so a walker moves at most 0.1 m per step: no tunnelling.
const PR = 0.35;
function pushOut(p, cols) {
  for (const c of cols) {
    if (c.kind === 'circle') {
      let dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz); const r = c.r + PR;
      if (d >= r) continue;
      if (d < 1e-6) { dx = 1; dz = 0; d = 1; }
      p.x = c.x + (dx / d) * r; p.z = c.z + (dz / d) * r; continue;
    }
    const co = Math.cos(c.rot), si = Math.sin(c.rot), ax = p.x - c.x, az = p.z - c.z, lx = ax * co - az * si, lz = ax * si + az * co;
    const qx = Math.max(-c.hw, Math.min(c.hw, lx)), qz = Math.max(-c.hd, Math.min(c.hd, lz));
    const nx = lx - qx, nz = lz - qz, nl = Math.hypot(nx, nz);
    let ox, oz;
    if (nl >= PR) continue;
    if (nl > 1e-6) { ox = qx + (nx / nl) * PR; oz = qz + (nz / nl) * PR; } // outside: stand off the face or corner
    else if (c.hw - Math.abs(lx) < c.hd - Math.abs(lz)) { ox = Math.sign(lx || 1) * (c.hw + PR); oz = lz; } // inside: nearest face
    else { ox = lx; oz = Math.sign(lz || 1) * (c.hd + PR); }
    p.x = c.x + ox * co + oz * si; p.z = c.z - ox * si + oz * co;
  }
}

export function stepPlayer(s, input, dt, heightAt, colliders) {
  let { x, z, y, heading, speed } = s;
  const n = Math.max(1, Math.ceil(Math.min(dt, 0.25) / STEP)), h = Math.min(dt, 0.25) / n;
  const c = input.cameraYaw || 0, ix = input.x || 0, iy = input.y || 0;
  // camera-relative stick -> world direction; length capped at 1 so diagonals are not faster
  let dx = -Math.sin(c) * iy + Math.cos(c) * ix, dz = -Math.cos(c) * iy - Math.sin(c) * ix;
  const mag = Math.min(1, Math.hypot(dx, dz));
  const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
  const want = mag > 0.05 ? Math.min(1, mag / 0.6) * (input.run ? RUN : WALK) : 0, aim = Math.atan2(-dx, -dz);
  for (let i = 0; i < n; i++) {
    if (want > 0) heading = wrap(heading + wrap(aim - heading) * (1 - Math.exp(-TURN * h)));
    speed = want > speed ? Math.min(want, speed + ACCEL * h) : Math.max(want, speed - FRICTION * h);
    const mx = -Math.sin(heading) * speed * h, mz = -Math.cos(heading) * speed * h, x0 = x, z0 = z;
    if (ok(heightAt, x + mx, z + mz, y)) { x += mx; z += mz; }
    else if (ok(heightAt, x + mx, z, y)) x += mx; // slide along walls and shores
    else if (ok(heightAt, x, z + mz, y)) z += mz;
    else speed = 0;
    speed = Math.min(speed, Math.hypot(x - x0, z - z0) / h + 0.001); // blocked: lose the speed we could not use
    if (colliders && colliders.length) { const p = { x, z }; pushOut(p, colliders); if (ok(heightAt, p.x, p.z, y)) { x = p.x; z = p.z; } }
    const [gx, gz] = grad(heightAt, x, z), g = Math.hypot(gx, gz);
    if (g > MAX_SLOPE) { const sx = x - (gx / g) * SLIDE * h, sz = z - (gz / g) * SLIDE * h; if (heightAt(sx, sz) >= MIN_Y) { x = sx; z = sz; speed = 0; } }
    const ty = heightAt(x, z);
    y = Math.abs(ty - y) > 1.5 ? ty : y + (ty - y) * (1 - Math.exp(-30 * h));
  }
  return { x, z, y, heading, speed };
}
