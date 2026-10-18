// Pure animal logic (no three): breeds, colour cap, the stepAnimal state machine and the companion steering.
// Headings here use atan2(dx, dz): heading 0 faces +z. The player's own heading is different (0 faces -z), see companionTarget.
export const CATS = [
  { name: 'Tabby', body: '#b98550', accent: '#f2e6d3', scale: 1 },
  { name: 'Black Cat', body: '#34303a', accent: '#34303a', scale: 1 },
  { name: 'Russian Blue', body: '#8d9bb0', accent: '#a9b6c8', scale: 1 },
  { name: 'Siamese', body: '#ecdcc3', accent: '#6a4b3c', scale: 1 },
  { name: 'Ginger', body: '#e08a3c', accent: '#f6d9b0', scale: 1 },
  { name: 'Calico', body: '#f4eee6', accent: '#d9833a', scale: 1 },
  { name: 'Tuxedo', body: '#312e39', accent: '#f4f1ec', scale: 1 },
  { name: 'Maine Coon', body: '#9a7a58', accent: '#d8c4a0', scale: 1.25 },
  { name: 'Persian', body: '#f1ebe0', accent: '#e4d9c6', scale: 1.1 },
  { name: 'Bengal', body: '#d3a04a', accent: '#f0dcae', scale: 1.05 },
].map((b) => ({ ...b, kind: 'cat' }));
// The dog model has one material, so a dog is one colour; size is the other variable.
export const DOGS = [
  { name: 'Golden', body: '#d8a24e', scale: 1.15 },
  { name: 'Husky', body: '#8e97a6', scale: 1.15 },
  { name: 'Black Lab', body: '#33303a', scale: 1.2 },
  { name: 'Corgi', body: '#d98e4a', scale: 0.8 },
  { name: 'Dalmatian', body: '#e8e4dc', scale: 1.15 },
  { name: 'Brown Shepherd', body: '#8a5a38', scale: 1.3 },
  { name: 'Cream Poodle', body: '#efe1c6', scale: 0.85 },
].map((b) => ({ ...b, accent: b.body, kind: 'dog' }));
// The baby dragon's own species, four colourways.
export const DRAGONS = [
  { name: 'Emberling', body: '#c8553d', belly: '#f0b86a', wing: '#e0784a' },
  { name: 'Frostling', body: '#5a8fc8', belly: '#cfe6f4', wing: '#8cc0e8' },
  { name: 'Mossling', body: '#5f9a5a', belly: '#e0d49a', wing: '#8cc070' },
  { name: 'Duskling', body: '#7a5ab0', belly: '#d9b4e6', wing: '#a888d8' },
];

// Scale a hex colour so its brightest channel is at most max (the bloom threshold is 0.85).
export function capBright(hex, max = 0.85) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255), top = Math.max(...c), k = top > max ? max / top : 1;
  return '#' + c.map((v) => Math.round(v * k * 255).toString(16).padStart(2, '0')).join('');
}

export const NOTICE_DIST = 10, MEET_DIST = 1.2, FOLLOW_TIME = 8;
const SPEED = { cat: [0.9, 1.7], dog: [1.1, 2.3] }; // wander, approach
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function makeAnimal(kind, x, z, rand) {
  return { kind, x, z, heading: rand() * 6.28, tx: x, tz: z, mode: 'idle', timer: 1 + rand() * 4, cool: 0, speed: 0, ev: '', look: 0 };
}

function pickTarget(a, rand, ok) {
  for (let i = 0; i < 8; i++) {
    const t = rand() * Math.PI * 2, d = 2 + rand() * 5, x = a.x + Math.cos(t) * d, z = a.z + Math.sin(t) * d;
    if (ok(x, z)) { a.tx = x; a.tz = z; return true; }
  }
  return false;
}

// Walk toward (tx, tz) at speed v, refusing any step onto a spot !ok. Returns the remaining distance, or -1 when blocked.
function walkTo(a, tx, tz, v, dt, ok) {
  const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz);
  if (d < 1e-4) return 0;
  const step = Math.min(d, v * dt), nx = a.x + dx / d * step, nz = a.z + dz / d * step;
  if (!ok(nx, nz)) return -1;
  a.heading = Math.atan2(dx, dz); a.x = nx; a.z = nz; a.speed = v;
  return d - step;
}

// One tick. ctx = { px, pz, night } (player position). a.ev gets a one-shot event: 'notice' | 'meow' | 'bark' | 'wake'
// (the caller reads it). Modes: idle walk notice approach greet follow sleep. a.look = head turn toward the player (radians).
export function stepAnimal(a, dt, rand, ok, ctx) {
  a.ev = ''; a.speed = 0; a.look = 0; a.cool = Math.max(0, a.cool - dt); a.timer -= dt;
  if (ctx.night) { a.mode = 'sleep'; return; }
  if (a.mode === 'sleep') { a.mode = 'idle'; a.timer = 1 + rand() * 3; a.ev = 'wake'; return; }
  const [wv, av] = SPEED[a.kind], dx = ctx.px - a.x, dz = ctx.pz - a.z, d = Math.hypot(dx, dz), toP = wrap(Math.atan2(dx, dz) - a.heading);
  switch (a.mode) {
    case 'idle':
      if (d < NOTICE_DIST && a.cool <= 0) { a.mode = 'notice'; a.timer = 0.9; a.ev = 'notice'; break; }
      if (a.timer <= 0) { if (pickTarget(a, rand, ok)) a.mode = 'walk'; else a.timer = 2 + rand() * 4; }
      break;
    case 'walk': {
      if (d < NOTICE_DIST && a.cool <= 0) { a.mode = 'notice'; a.timer = 0.9; a.ev = 'notice'; break; }
      const left = walkTo(a, a.tx, a.tz, wv, dt, ok);
      if (left < 0.2) { a.mode = 'idle'; a.timer = left < 0 ? 1 + rand() * 3 : 2 + rand() * 5; }
      break;
    }
    case 'notice': // stop, head turns to you, ears up; then come over (7 in 10) or lose interest
      a.look = toP;
      if (d > NOTICE_DIST + 4) { a.mode = 'idle'; a.cool = 6; break; }
      if (a.timer <= 0) { if (rand() < 0.7) a.mode = 'approach'; else { a.mode = 'idle'; a.cool = 15; a.timer = 2; } }
      break;
    case 'approach': {
      if (d > NOTICE_DIST + 6) { a.mode = 'idle'; a.cool = 10; break; }
      if (d <= MEET_DIST) { a.mode = 'greet'; a.timer = 4.5; a.orb = Math.atan2(-dz, -dx); a.ev = a.kind === 'cat' ? 'meow' : 'bark'; break; }
      const k = MEET_DIST * 0.9 / d; // aim just short of the player
      if (walkTo(a, ctx.px - dx * k, ctx.pz - dz * k, av, dt, ok) < 0) { a.mode = 'idle'; a.cool = 8; a.timer = 2; }
      break;
    }
    case 'greet': // cats circle and rub (the renderer weaves round you); dogs sit and wag
      a.look = toP;
      if (d > MEET_DIST * 3) { a.mode = 'approach'; break; }
      if (a.kind === 'cat') { a.orb += 1.4 * dt; walkTo(a, ctx.px + Math.cos(a.orb) * 0.9, ctx.pz + Math.sin(a.orb) * 0.9, 1.3, dt, ok); }
      if (a.timer <= 0) { a.mode = 'idle'; a.cool = 25; a.timer = 2; }
      break;
    case 'follow':
      if (a.timer <= 0 || d > 25) { a.mode = 'idle'; a.cool = 12; a.timer = 2; break; }
      if (d > 1.8) { const k = 1.5 / d; walkTo(a, ctx.px - dx * k, ctx.pz - dz * k, d > 5 ? av * 1.4 : av, dt, ok); } else a.look = toP;
      break;
  }
}

// The player petted this animal. Sleepers stay asleep; everyone else follows you for a while. Returns the sound name.
export function petAnimal(a) {
  if (a.mode !== 'sleep') { a.mode = 'follow'; a.timer = FOLLOW_TIME; a.cool = 0; }
  return a.kind === 'cat' ? 'purr' : 'bark';
}

// ---- Companion steering ----
// Player heading 0 faces -z: forward = (-sin h, -cos h). The companion wants a spot 2.4 m behind and 0.9 m to one side.
export const COMP = { behind: 1.5, side: 1.7, teleport: 25, maxSpeed: 7.5 };
// Writes the best free spot into out ({x, z}); falls back to nearer spots, then to the player's own.
export function companionTarget(p, side, ok, out) {
  const fx = -Math.sin(p.heading), fz = -Math.cos(p.heading), rx = -fz, rz = fx; // right-hand side of the player
  for (const [b, s] of [[COMP.behind, COMP.side * side], [COMP.behind, -COMP.side * side], [2.2, 0], [0.6, 1.4 * side], [0, 0]]) {
    const x = p.x - fx * b + rx * s, z = p.z - fz * b + rz * s;
    if (ok(x, z)) { out.x = x; out.z = z; return out; }
  }
  out.x = p.x; out.z = p.z; return out;
}

export function makeCompanion(x, z) { return { x, z, heading: 0, speed: 0, moving: false, idleT: 0, look: 0, lookT: 2, side: 1, tx: x, tz: z, teleported: false }; }

const TURNS = [0, 0.7, -0.7, 1.4, -1.4];
// c: companion state; p: player {x,z,heading,speed}. Arrival slow-down, sidestep when the straight step is blocked, teleport beside you when far.
export function stepCompanion(c, dt, p, ok, rand) {
  c.teleported = false;
  const dp = Math.hypot(p.x - c.x, p.z - c.z);
  companionTarget(p, c.side, ok, c.target || (c.target = { x: 0, z: 0 }));
  if (dp > COMP.teleport) { c.x = c.target.x; c.z = c.target.z; c.speed = 0; c.teleported = true; return; }
  const dx = c.target.x - c.x, dz = c.target.z - c.z, d = Math.hypot(dx, dz);
  // matched to the player: walking pace near you, a burst when behind; slows to a stop over the last 1.2 m
  const want = d < 0.25 ? 0 : Math.min(COMP.maxSpeed, Math.max(p.speed * 1.1, 0.6) + Math.max(0, d - 2.5) * 1.2, d * 5 + 0.3);
  c.speed += (want - c.speed) * Math.min(1, dt * 8);
  if (c.speed > 0.15) {
    const base = Math.atan2(dx, dz);
    for (const t of TURNS) { // sidestep: first heading offset whose next step is free
      const h = base + t, nx = c.x + Math.sin(h) * c.speed * dt, nz = c.z + Math.cos(h) * c.speed * dt;
      if (ok(nx, nz)) { c.heading += wrap(h - c.heading) * Math.min(1, dt * 10); c.x = nx; c.z = nz; c.moving = true; c.idleT = 0; return; }
    }
    c.speed = 0;
  }
  c.moving = false; c.idleT += dt;
  c.lookT -= dt; // idle: glance around now and then
  if (c.lookT <= 0) { c.look = (rand() - 0.5) * 2.2; c.lookT = 1.5 + rand() * 2.5; }
}

// ---- Soft separation ----
// Pairwise push-apart for bodies { x, z, r } (animals, the companion, the player). Each pair closer than a.r + b.r moves apart by half the overlap each,
// except fixed bodies (b.fixed) which never move. Cheap O(n^2): fine for about 20. okMove(x, z) vetoes a push onto a bad spot. No allocation.
export function separate(list, n, okMove, strength = 0.5) {
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = list[i], b = list[j];
    let dx = b.x - a.x, dz = b.z - a.z;
    const d2 = dx * dx + dz * dz, R = a.r + b.r;
    if (d2 >= R * R) continue;
    let d = Math.sqrt(d2);
    if (d < 1e-4) { dx = Math.cos(i * 2.4 + j); dz = Math.sin(i * 2.4 + j); d = 0; } // exactly stacked: pick a stable direction
    const push = (R - d) * strength, ux = dx / (d || 1) * push, uz = dz / (d || 1) * push, wa = a.fixed ? 0 : b.fixed ? 1 : 0.5, wb = a.fixed ? 1 : b.fixed ? 0 : 0.5;
    if (wa && okMove(a.x - ux * wa * 2, a.z - uz * wa * 2)) { a.x -= ux * wa * 2; a.z -= uz * wa * 2; }
    if (wb && okMove(b.x + ux * wb * 2, b.z + uz * wb * 2)) { b.x += ux * wb * 2; b.z += uz * wb * 2; }
  }
}
