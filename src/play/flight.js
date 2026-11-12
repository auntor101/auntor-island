// Pure dragon-flight physics. heading 0 faces -z (same as player.js); stick x turns, stick y climbs (+) or dives (-).
export const CRUISE = 14, BOOST = 24, MAX_STAMINA = 1, CEILING = 120, MIN_Y = -0.6;
const TURN = 1.2, CLIMB = 8, SAFE_SINK = 4, ACCEL = 12, DECEL = 6, DRAIN = 0.5, REFILL = 0.4, CLEAR = 0.3;

// s: {x,z,y,heading,speed,bank,stamina,status:'flying'|'landed'|'crashed'}. Returns a new state; finished flights are returned unchanged.
export function stepFlight(s, input, dt, heightAt) {
  if (s.status !== 'flying') return s;
  dt = Math.min(dt, 0.25);
  const ix = Math.max(-1, Math.min(1, input.x || 0)), iy = Math.max(-1, Math.min(1, input.y || 0));
  const boosting = !!input.boost && s.stamina > 0;
  const want = boosting ? BOOST : CRUISE;
  const speed = want > s.speed ? Math.min(want, s.speed + ACCEL * dt) : Math.max(want, s.speed - DECEL * dt);
  const stamina = Math.max(0, Math.min(MAX_STAMINA, s.stamina + (input.boost ? -DRAIN : REFILL) * dt));
  const heading = s.heading - ix * TURN * dt, bank = s.bank + (ix * 0.6 - s.bank) * (1 - Math.exp(-6 * dt));
  const x = s.x - Math.sin(heading) * speed * dt, z = s.z - Math.cos(heading) * speed * dt;
  const vy = iy * CLIMB, y = Math.min(CEILING, s.y + vy * dt);
  const out = { x, z, y, heading, speed, bank, stamina, status: 'flying' };
  const h = heightAt(x, z);
  if (h > s.y + 0.5) out.status = 'crashed'; // ran into a slope, cliff or tree line
  else if (y <= Math.max(h, 0) + CLEAR) out.status = h < MIN_Y || -vy > SAFE_SINK ? 'crashed' : 'landed'; // water is never a landing
  return out;
}
