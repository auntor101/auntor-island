// Pure ground-vehicle physics (cart, trike, motorbike). heading 0 faces -z. Hitting something hard crashes; hitting it gently just stops.
export const KINDS = {
  cart: { max: 8, accel: 3, turn: 1.4, brake: 8, name: 'Colonel\'s cart' },
  trike: { max: 11, accel: 4.5, turn: 1.8, brake: 9, name: 'Rattle trike' },
  bike: { max: 16, accel: 6, turn: 2.1, brake: 10, name: 'Thunder bike' },
};
export const CRASH_SPEED = 5, MAX_SLOPE = 1.2, MIN_Y = -0.6, R = 0.9;
const grad = (f, x, z) => { const e = 0.3; return Math.hypot((f(x + e, z) - f(x - e, z)) / (2 * e), (f(x, z + e) - f(x, z - e)) / (2 * e)); };

// Distance-to-obstacle test against village colliders (circles and rotated boxes), vehicle radius R.
export function hits(cols, x, z) {
  for (const c of cols || []) {
    if (c.kind === 'circle') { if (Math.hypot(x - c.x, z - c.z) < c.r + R) return true; continue; }
    const co = Math.cos(c.rot), si = Math.sin(c.rot), ax = x - c.x, az = z - c.z, lx = ax * co - az * si, lz = ax * si + az * co;
    if (Math.hypot(Math.max(Math.abs(lx) - c.hw, 0), Math.max(Math.abs(lz) - c.hd, 0)) < R) return true;
  }
  return false;
}

// s: {x,z,y,heading,speed,status:'driving'|'crashed',cause?}. input: x steers, y throttle (+) or brake/reverse (-).
export function stepVehicle(s, input, dt, heightAt, cols, kind = 'cart') {
  if (s.status !== 'driving') return s;
  const k = KINDS[kind] || KINDS.cart;
  dt = Math.min(dt, 0.1);
  const ix = Math.max(-1, Math.min(1, input.x || 0)), iy = Math.max(-1, Math.min(1, input.y || 0));
  let speed = s.speed;
  if (iy > 0.05) speed = Math.min(k.max * iy, speed + k.accel * dt); // hold the stick part-way for a slower cruise
  else if (iy < -0.05) speed = Math.max(-k.max * 0.3, speed - k.brake * dt);
  else speed = speed > 0 ? Math.max(0, speed - 2 * dt) : Math.min(0, speed + 2 * dt); // coast down
  if (iy > 0.05 && speed > k.max * iy) speed = Math.max(k.max * iy, speed - k.brake * dt);
  const heading = s.heading - ix * k.turn * dt * Math.min(1, Math.abs(speed) / 3) * (speed < 0 ? -1 : 1);
  const x = s.x - Math.sin(heading) * speed * dt, z = s.z - Math.cos(heading) * speed * dt;
  const h = heightAt(x, z), out = { x, z, y: h, heading, speed, status: 'driving' };
  const bad = h < MIN_Y ? 'sea' : h > s.y + 0.8 || (h > s.y && grad(heightAt, x, z) > MAX_SLOPE) ? 'cliff' : hits(cols, x, z) ? 'cart' : null;
  if (bad) {
    if (Math.abs(speed) >= CRASH_SPEED) { out.status = 'crashed'; out.cause = bad; } // slapstick: no blood
    else { out.x = s.x; out.z = s.z; out.y = s.y; out.speed = 0; } // a gentle bump: stop and stay
  }
  return out;
}
