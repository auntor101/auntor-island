// The eight landmark designs, built into a Mesher in each site's local frame (+z faces the village, y is world height).
// All original designs. Glow parts use o.to = 'glow' (night lights) or 'egg' (the pulsing hatchery eggs).
import { ARENA, POOLS, TREES, ACADEMY, EGGS, EMBER_ROCKS, arenaWalls } from './sites.js';

const PI = Math.PI, TAU = PI * 2, hyp = Math.hypot;
const STONE = 0xb9b0a1, STONE2 = 0x8d867c, SLATE = 0x4b5d7a, WOOD = 0x8b5a3c, WOOD2 = 0x5e3b28, SAND = 0xd9c28f, CORAL = 0xff7a59, TEAL = 0x3fb8af, GOLD = 0xf2c14e, PURPLE = 0x6b4fa0, MOSS = 0x7fa862;
const ICE = 0xcdeeff, ICE2 = 0x8fd0f5, WARM = [2.4, 1.3, 0.5], AMBER = [3, 2, 0.4], BLUE = [0.5, 1.4, 2.6], BANNER = [CORAL, TEAL, GOLD, 0x9d6bd6, 0xe05a7a, 0x5aa0e0];
const GL = { to: 'glow' };
const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function academy(m) {
  const A = ACADEMY, H = m.H, y0 = H(0, 0);
  m.drape(0, 0, 0, A.yard, SAND, 28, 3, 0.07);
  m.drape(0, 0, A.yard - 1.5, A.yard, STONE, 28, 1, 0.1);
  m.drape(0, 0, 2.4, 3.2, TEAL, 20, 1, 0.1);
  for (let i = 0; i < 6; i++) { // banner poles round the yard
    const t = (i + 0.5) / 6 * TAU + 0.5, x = Math.sin(t) * (A.yard + 0.6), z = Math.cos(t) * (A.yard + 0.6), top = H(x, z) + 5.6;
    m.pier(x, z, 0.13, top, WOOD2, 5);
    m.ball(0.22, 0, x, top + 0.2, z, GOLD);
    m.box(1.7, 2.3, 0.07, x + Math.cos(t) * 0.95, top - 1.5, z - Math.sin(t) * 0.95, BANNER[i], { ry: t });
    m.box(0.3, 0.4, 0.3, x, top - 0.1, z, WARM, GL);
  }
  // long hall with a dragon-head gable
  const hz = A.hallZ, W = A.hallW, D = A.hallD, yb = Math.max(H(-W / 2, hz - D / 2), H(W / 2, hz - D / 2), H(-W / 2, hz + D / 2), H(W / 2, hz + D / 2)) + 0.3;
  m.foot(0, hz, W, D, yb + 1, STONE2);
  m.box(W - 0.5, 3.2, D - 0.5, 0, yb + 2.6, hz, 0xd8c3a0);
  for (let i = -2; i <= 2; i++) { m.box(0.35, 3.2, 0.35, i * 3.5, yb + 2.6, hz + D / 2 - 0.15, WOOD2); m.box(0.35, 3.2, 0.35, i * 3.5, yb + 2.6, hz - D / 2 + 0.15, WOOD2); }
  m.prism(W + 1.4, D + 1.8, 2.6, 0, yb + 4.2, hz, SLATE);
  m.box(W + 1.5, 0.22, 0.4, 0, yb + 6.8, hz, 0x2f3b52);
  for (let i = -3; i <= 3; i++) m.cone(0.22, 0.7, 4, i * 2, yb + 7.1, hz, 0xe9dcc0); // ridge spikes
  m.box(2.2, 2.6, 0.14, 0, yb + 2.3, hz + D / 2 + 0.02, 0x3a2418); // door
  for (const x of [-6, -4, 4, 6]) m.box(0.9, 1.1, 0.12, x, yb + 2.6, hz + D / 2 + 0.03, WARM, GL);
  for (const x of [-4.5, 0, 4.5]) m.box(0.9, 1.1, 0.12, x, yb + 2.6, hz - D / 2 - 0.03, WARM, GL);
  const hy = yb + 6.0, hf = hz + D / 2; // the head: a skull, snout and jaw jutting out over the door, horns swept back
  const HC = 0x3b6b5f, HORN = 0xf2e6c8;
  m.box(1.6, 1.8, 2.0, 0, hy - 0.2, hf - 0.4, HC, { rx: 0.4 });
  m.box(1.9, 1.5, 2.2, 0, hy + 0.55, hf + 0.7, HC);
  m.box(1.2, 0.9, 2.0, 0, hy + 0.3, hf + 2.3, HC, { rx: 0.08 });
  m.box(1.05, 0.4, 1.9, 0, hy - 0.55, hf + 2.2, 0x2c5249, { rx: -0.12 });
  for (const s of [-1, 1]) {
    m.cone(0.3, 2.3, 5, s * 0.8, hy + 1.8, hf - 0.2, HORN, { rx: -0.8, rz: -s * 0.25 });
    m.cone(0.16, 1.2, 4, s * 0.95, hy + 1.45, hf + 0.5, HORN, { rx: -0.5, rz: -s * 0.7 });
    m.box(0.3, 0.26, 0.2, s * 0.72, hy + 0.9, hf + 1.8, AMBER, GL); // eyes
    m.box(0.12, 0.12, 0.12, s * 0.3, hy + 0.55, hf + 3.3, [3, 0.9, 0.2], GL); // nostrils
    for (let k = 0; k < 3; k++) m.cone(0.08, 0.3, 3, s * 0.4, hy - 0.2, hf + 1.4 + k * 0.5, HORN, { rx: PI }); // teeth
  }
}

export function arena(m) {
  const { a, b, thick } = ARENA, H = m.H, yc = H(0, 0);
  m.drape(0, 0, 0, 1, SAND, 28, 4, 0.07, a - 1.8, b - 1.8);
  m.drape(0, 0, 0.62, 0.75, 0xc9a35c, 28, 1, 0.1, a - 1.8, b - 1.8);
  const ring = (off, th, hgt, col, skipGate) => { // ellipse of tangent blocks
    for (const w of arenaWalls()) {
      if (skipGate && w.gate) continue;
      const mx = (w.t0 + w.t1) / 2, x = Math.sin(mx) * (a + off) , z = Math.cos(mx) * (b + off), top = Math.max(yc + hgt, H(x, z) + hgt * 0.7);
      m.foot(x, z, w.len + 0.25, th, top, col, w.rot);
    }
  };
  ring(1.2, 1.7, 3.2, STONE, true); ring(-0.1, 1.4, 2.0, 0xa89f8f, true); ring(-1.3, 1.2, 1.0, 0x978e80, true);
  for (const sz of [-1, 1]) {
    const z = sz * (b + 0.4), top = Math.max(H(-3, z), H(3, z), yc) + 4.8;
    for (const sx of [-1, 1]) { m.pier(sx * (ARENA.gateHalf + 0.5), z, 0.8, top, STONE, 8); const bx = sx * (ARENA.gateHalf + 0.5); m.cyl(0.55, 0.35, 0.4, 8, bx, top + 0.2, z, STONE2); m.cone(0.32, 0.8, 5, bx, top + 0.8, z, WARM, GL); }
    m.box(ARENA.gateHalf * 2 + 2.4, 1.1, 1.8, 0, top + 0.1, z, STONE);
    m.box(ARENA.gateHalf * 2 + 0.6, 1.9, 0.1, 0, top - 1.2, z, CORAL);
    m.cone(0.5, 1.1, 4, 0, top + 1.2, z, GOLD);
  }
  for (const i of [0.5, 3.5, 6.5, 9.5, 12.5, 15.5, 18.5, 21.5]) { // pennant poles on the rim
    const t = i / 24 * TAU, x = Math.sin(t) * (a + 1.6), z = Math.cos(t) * (b + 1.6), top = H(x, z) + 5.6;
    if (Math.abs(x) < ARENA.gateHalf + 3 && Math.abs(z) > b * 0.8) continue;
    m.pier(x, z, 0.1, top, WOOD2, 5); m.box(1.3, 0.8, 0.06, x + Math.cos(t) * 0.6, top - 0.5, z - Math.sin(t) * 0.6, BANNER[i % 6 | 0], { ry: t });
  }
}

export function hatchery(m) {
  const H = m.H, y0 = H(0, -3);
  m.drape(0, 3.5, 0, 6.2, 0xc7b78f, 20, 2, 0.06);
  m.pier(0, -3, 4.5, y0 + 0.6, STONE2, 12);
  m.dome(4.2, 12, 0, y0 + 0.5, -3, STONE, { sy: 0.7 });
  m.torus(4.3, 0.22, 4, 14, 0, y0 + 0.9, -3, STONE2, { rx: PI / 2 });
  m.torus(3.0, 0.16, 4, 12, 0, y0 + 2.2, -3, STONE2, { rx: PI / 2 });
  for (let i = 0; i < 6; i++) { const t = i / 6 * TAU; m.cone(0.3, 1.5, 4, Math.sin(t) * 1.7, y0 + 3.5, -3 + Math.cos(t) * 1.7, 0xe9dcc0, { rx: Math.cos(t) * 0.35, rz: -Math.sin(t) * 0.35 }); }
  m.cone(0.4, 1.8, 4, 0, y0 + 3.7, -3, 0xe9dcc0);
  m.box(0.34, 2.8, 0.45, -1.2, y0 + 1.4, 1.1, STONE); m.box(0.34, 2.8, 0.45, 1.2, y0 + 1.4, 1.1, STONE); m.box(2.9, 0.5, 0.55, 0, y0 + 2.9, 1.0, STONE);
  m.box(2.1, 2.5, 0.5, 0, y0 + 1.3, 0.85, 0x2b2030); m.box(1.5, 1.9, 0.12, 0, y0 + 1.2, 1.12, WARM, GL);
  for (let i = 0; i < 6; i++) { const t = (i + 0.5) / 6 * TAU + 0.4; m.box(0.2, 0.55, 0.1, Math.sin(t) * 3.3, y0 + 1.6 + (i % 2) * 0.4, -3 + Math.cos(t) * 3.3 - 0.1, BLUE, { ...GL, ry: t }); } // runes
  // nest + fence
  const ny = H(0, 3.5);
  m.torus(1.55, 0.34, 5, 14, 0, ny + 0.35, 3.5, WOOD, { rx: PI / 2 });
  m.cyl(1.4, 1.5, 0.3, 12, 0, ny + 0.15, 3.5, 0xd9b36b);
  for (let i = 0; i < 14; i++) {
    const t = i / 14 * TAU, x = Math.sin(t) * 5, z = 3.5 + Math.cos(t) * 5;
    if (Math.cos(t) > 0.8) { if (Math.abs(Math.sin(t)) > 0.4) m.box(0.3, 0.4, 0.3, x, H(x, z) + 1.5, z, WARM, GL); continue; }
    m.pier(x, z, 0.12, H(x, z) + 1.25, WOOD2, 5); m.cone(0.16, 0.3, 4, x, H(x, z) + 1.4, z, WOOD);
    const t2 = (i + 1) / 14 * TAU, x2 = Math.sin(t2) * 5, z2 = 3.5 + Math.cos(t2) * 5;
    if (Math.cos(t2) > 0.8) continue;
    for (const hh of [0.5, 0.95]) m.box(hyp(x2 - x, z2 - z), 0.1, 0.1, (x + x2) / 2, (H(x, z) + H(x2, z2)) / 2 + hh, (z + z2) / 2, WOOD, { ry: Math.atan2(-(z2 - z), x2 - x) });
  }
  const EC = [[2.2, 0.9, 0.5], [0.4, 1.9, 1.7], [1.6, 1.5, 2.6], [2.8, 2.0, 0.6], [1.0, 2.2, 1.2], [0.6, 1.5, 2.6]];
  EGGS.forEach(([x, z], i) => m.ball(0.34, 1, x, ny + 0.85, z + 0.2, EC[i % 6], { sy: 1.35, to: 'egg' }));
}

export function springs(m) {
  const H = m.H;
  m.drape(0, -1, 0, 11, 0xbfb59c, 24, 3, 0.06);
  m.drape(0, -1, 9.8, 11, STONE, 24, 1, 0.09);
  POOLS.forEach(([px, pz, r]) => {
    const top = Math.max(H(px, pz), H(px + r, pz), H(px - r, pz), H(px, pz + r), H(px, pz - r)) + 0.55, n = 12;
    for (let i = 0; i < n; i++) {
      const t = i / n * TAU, x = px + Math.sin(t) * r, z = pz + Math.cos(t) * r;
      m.foot(x, z, TAU * r / n * 1.05, 0.95, top + (i % 3) * 0.06, i % 2 ? STONE : 0xa39a8b, t + PI / 2);
    }
    m.cyl(r - 0.35, r - 0.35, 0.1, 14, px, top - 0.12, pz, [0.35, 1.05, 1.15], GL); // the water: a soft turquoise glow
  });
  // bathhouse hut
  const hz = -10, yb = Math.max(H(-3, hz), H(3, hz), H(-3, hz - 2.3), H(3, hz + 2.3)) + 0.3;
  m.foot(0, hz, 6.2, 4.8, yb + 0.5, STONE2);
  m.box(5.6, 2.8, 4.2, 0, yb + 1.9, hz, WOOD);
  for (const x of [-2.7, 0, 2.7]) m.box(0.28, 2.8, 4.3, x, yb + 1.9, hz, WOOD2);
  m.prism(6.8, 6.2, 2.2, 0, yb + 3.3, hz, 0xa04a3a);
  m.box(0.7, 1.6, 0.7, 2.0, yb + 5.0, hz - 1.2, STONE2);
  m.box(1.5, 2.1, 0.12, 0, yb + 1.6, hz + 2.14, 0x3a2418);
  m.box(1.6, 0.9, 0.06, 0, yb + 3.0, hz + 2.2, CORAL); // door cloth
  m.box(0.9, 0.9, 0.12, -2.0, yb + 2.2, hz + 2.15, WARM, GL); m.box(0.9, 0.9, 0.12, 2.0, yb + 2.2, hz + 2.15, WARM, GL);
  m.box(0.34, 0.5, 0.34, 1.2, yb + 3.0, hz + 2.6, WARM, GL);
}

export function embers(m) {
  const H = m.H;
  m.drape(0, 0, 0, 9, 0x3b3238, 22, 3, 0.07);
  m.drape(0, 0, 0, 5.5, 0x2c242c, 18, 2, 0.1);
  [[3, 3.5, 1.3], [-4.5, 2, 1.0], [0.5, -4, 1.5], [5, -1.5, 0.8]].forEach(([x, z, r], i) => m.drape(x, z, 0, r, [2.4, 0.75, 0.15], 10, 1, 0.13 + i * 0.01, 1, 1, 'glow')); // lava pools
  EMBER_ROCKS.forEach(([x, z, r], i) => {
    m.ball(r, 0, x, H(x, z) + r * 0.45, z, i % 2 ? 0x3a3039 : 0x4b3c3c, { sy: 0.8, ry: i });
    m.ball(r * 0.45, 0, x + r * 0.35, H(x, z) + r * 0.55, z + r * 0.3, [2.6, 0.8, 0.15], { sy: 0.7, to: 'glow' });
  });
  for (let i = 0; i < 16; i++) { // small glowing and dark stones
    const t = rnd(i) * TAU, d = 1 + rnd(i + 40) * 7.5, x = Math.sin(t) * d, z = Math.cos(t) * d, r = 0.2 + rnd(i + 9) * 0.3;
    if (EMBER_ROCKS.some(([ex, ez, er]) => hyp(ex - x, ez - z) < er + r + 0.3)) continue;
    m.ball(r, 0, x, H(x, z) + r * 0.4, z, i % 3 ? [2.2, 0.65, 0.12] : 0x3b3238, { sy: 0.7, ry: i, to: i % 3 ? 'glow' : undefined });
  }
  [[-2, -1.5], [2.5, -2.5], [-1, 3.5], [3.8, 2.0], [-4, -4.5]].forEach(([x, z], i) => { // vents: dark cones with a glowing mouth
    const y = H(x, z);
    m.cone(0.9 - i * 0.05, 1.2 + (i % 2) * 0.4, 7, x, y + 0.5, z, 0x2f2830);
    m.cyl(0.38, 0.38, 0.1, 7, x, y + 1.12 + (i % 2) * 0.4, z, [2.8, 1.1, 0.2], GL);
  });
}

export function icecave(m) {
  const H = m.H, y0 = H(0, 2);
  m.drape(0, 0, 0, 7, 0xeef6ff, 20, 3, 0.07);
  m.drape(0, -1.5, 0, 2.5, 0xdff0fb, 12, 1, 0.1);
  // the mound: faceted lumps of ice round a tunnel 3.2 m wide
  [[-3.6, -1.6, 3.2, 0], [3.6, -1.6, 3.2, 1], [0, -2.0, 3.8, 2, 5.2], [-1.8, -5.0, 3.4, 3], [2.0, -4.8, 3.2, 4], [0, -6.0, 3.6, 5, 2.0], [-4.8, 1.4, 1.9, 6], [4.8, 1.4, 1.9, 7]].forEach(([x, z, r, i, dy = 1.2]) => {
    m.ball(r, 1, x, y0 + dy, z, i % 2 ? ICE : ICE2, { sy: 1.15, ry: i * 0.7 });
  });
  for (let k = 0; k < 7; k++) { // arch of ice blocks on posts
    const t = PI * (k + 0.5) / 7, x = Math.cos(t) * 2.0, y = y0 + 1.7 + Math.sin(t) * 1.75;
    m.box(1.15, 0.8, 1.7, x, y, 2.0, k % 2 ? 0xe6f6ff : ICE, { rz: t + PI / 2 });
  }
  m.box(0.8, 1.9, 1.7, -2.0, y0 + 0.8, 2.0, ICE); m.box(0.8, 1.9, 1.7, 2.0, y0 + 0.8, 2.0, ICE);
  m.box(3.4, 3.2, 0.3, 0, y0 + 1.6, -4.6, 0x1c2a44); // dark back wall
  const crystal = (x, z, h, tilt, ry, i, big) => m.cone(big ? 0.34 : 0.2, h, 5, x, H(x, z) + h * 0.45, z, BLUE.map((c) => c * (0.8 + 0.4 * (i % 3) / 2)), { rx: tilt, rz: ry, to: 'glow' });
  for (let i = 0; i < 9; i++) crystal(-1.4 + (i % 2) * 2.8 + (rnd(i) - 0.5) * 0.4, -3.5 + i * 0.5 + rnd(i + 3) * 0.3, 0.8 + rnd(i + 5) * 0.9, 0.2 * (i % 2 ? -1 : 1), 0.35 * (i % 2 ? 1 : -1), i, false);
  crystal(0, -4.0, 2.2, 0, 0, 1, true); crystal(-0.7, -3.8, 1.5, 0.15, 0.2, 2, true);
  for (let i = 0; i < 8; i++) { const t = i / 8 * TAU, x = Math.sin(t) * 5.4, z = 1.5 + Math.cos(t) * 3.5; if (z > 2.5 && Math.abs(x) < 2.8) continue; crystal(x, z, 0.7 + rnd(i + 11) * 1.1, 0.3, 0.3, i, false); }
  m.box(2.6, 0.12, 4.5, 0, y0 + 3.15, -0.4, [0.4, 0.9, 1.7], GL);
}

export function tower(m) {
  const H = m.H, y0 = Math.max(H(0, 0), H(4, 0), H(-4, 0), H(0, 4), H(0, -4)) + 0.2;
  m.pier(0, 0, 4.6, y0 + 0.8, STONE2, 10);
  m.cyl(4.0, 4.3, 0.5, 10, 0, y0 + 0.9, 0, STONE);
  const N = 12, SEC = 2.3;
  const R = (i) => 3.0 - 0.07 * i - 0.5 * Math.sin(i / N * PI);
  for (let i = 0; i < N; i++) {
    const y = y0 + 1.15 + i * SEC;
    m.cyl(R(i + 1), R(i), SEC, 8, 0, y + SEC / 2, 0, i % 2 ? 0xada3b8 : 0xc4bcc8, { ry: i * 0.2 });
    if (i % 2 === 1) { const t = i * 0.2 + 0.4 + i; m.box(0.55, 1.0, 0.12, Math.sin(t) * (R(i) * 0.93 + 0.02), y + SEC / 2, Math.cos(t) * (R(i) * 0.93 + 0.02), WARM, { ...GL, ry: t }); }
  }
  const top = y0 + 1.15 + N * SEC;
  m.cyl(3.4, 2.4, 0.5, 8, 0, top + 0.25, 0, STONE2); // balcony
  for (let i = 0; i < 8; i++) { const t = i / 8 * TAU + 0.2; m.box(0.7, 0.7, 0.7, Math.sin(t) * 3.2, top + 0.85, Math.cos(t) * 3.2, STONE, { ry: t }); }
  m.cyl(1.8, 2.0, 2.4, 8, 0, top + 1.7, 0, 0xc4bcc8);
  for (let i = 0; i < 4; i++) { const t = i * PI / 2 + 0.4; m.box(0.7, 1.0, 0.12, Math.sin(t) * 1.9, top + 1.8, Math.cos(t) * 1.9, WARM, { ...GL, ry: t }); }
  m.cone(2.5, 4.4, 8, 0, top + 4.6, 0, PURPLE);
  m.cone(0.2, 1.6, 5, 0, top + 7.4, 0, GOLD);
  m.ball(0.85, 1, 0, top + 8.7, 0, [1.6, 2.2, 3.2], GL);
  m.torus(1.5, 0.07, 4, 18, 0, top + 8.7, 0, [1.4, 2.0, 3.0], { ...GL, rx: PI / 2 + 0.3 });
  // outside stairs winding round the shaft
  const steps = 42;
  for (let k = 0; k < steps; k++) {
    const t = 0.3 + k * 0.19, y = y0 + 1.2 + k * 0.27, x = Math.sin(t) * 4.0, z = Math.cos(t) * 4.0;
    m.box(1.7, 0.22, 1.05, x, y, z, 0xb6aa9a, { ry: t });
    if (k % 3 === 0) m.pier(x, z, 0.14, y - 0.1, WOOD2, 4);
    if (k % 2 === 0) m.box(0.08, 0.7, 0.08, Math.sin(t) * 4.8, y + 0.45, Math.cos(t) * 4.8, WOOD2);
  }
  m.box(0.9, 1.7, 0.2, Math.sin(0.3 + (steps - 1) * 0.19) * 2.75, y0 + 1.2 + steps * 0.27 + 0.8, Math.cos(0.3 + (steps - 1) * 0.19) * 2.75, WARM, { ...GL, ry: 0.3 + (steps - 1) * 0.19 });
}

export function grove(m) {
  const H = m.H, MINT = [0xbfe8c8, 0xd6f0cf, 0xa9ddc0], BLUSH = [0xf4c6d6, 0xf8d9e0];
  m.drape(0, 0, 0, 10, 0x8fb872, 24, 3, 0.06);
  m.drape(0, 0, 2.2, 3.0, 0xd4cfc0, 16, 1, 0.09);
  TREES.forEach(([tx, tz], ti) => {
    const y = H(tx, tz), h = 14.5 + ti;
    m.pier(tx, tz, 1.5, y + 0.3, 0xe3dac5, 8);
    m.cyl(0.75, 1.5, h, 8, tx, y + h / 2, tz, 0xece4d2, { rx: -tz * 0.006, rz: tx * 0.006 });
    for (let k = 0; k < 4; k++) { const t = k / 4 * TAU + ti, r = 1.9; m.cone(0.55, 2.6, 4, tx + Math.sin(t) * r, y + 0.8, tz + Math.cos(t) * r, 0xe3dac5, { rx: Math.cos(t) * 0.7, rz: -Math.sin(t) * 0.7 }); } // roots
    for (let k = 0; k < 6; k++) { // canopy: stacked flat lumps of pastel leaf
      const t = k * 1.9 + ti, r = k ? 2.6 : 0, cx = tx + Math.sin(t) * r, cz = tz + Math.cos(t) * r;
      m.ball(3.4 + (k % 3) * 0.5, 1, cx, y + h - 1 + (k % 3) * 1.1, cz, k % 3 === 2 ? BLUSH[ti % 2] : MINT[k % 3], { sy: 0.7, ry: k });
    }
    for (let k = 0; k < 8; k++) { // hanging lanterns
      const t = k / 8 * TAU + ti, r = 2.2 + (k % 3) * 1.1, lx = tx + Math.sin(t) * r, lz = tz + Math.cos(t) * r, len = 1.2 + (k % 3) * 0.9, ly = y + 10.6 - (k % 2) * 0.6;
      m.box(0.03, len, 0.03, lx, ly - len / 2, lz, 0x6b5a48);
      m.box(0.36, 0.5, 0.36, lx, ly - len - 0.25, lz, WARM, GL);
      m.cone(0.3, 0.2, 4, lx, ly - len + 0.1, lz, GOLD);
    }
  });
  const ay = H(0, 0); // altar
  m.foot(0, 0, 2.8, 1.8, ay + 0.35, STONE);
  m.box(2.2, 0.35, 1.3, 0, ay + 0.55, 0, 0xd4cfc0);
  m.box(1.2, 0.9, 0.55, 0, ay + 1.15, 0, 0xe6e0d0);
  m.ball(0.28, 1, 0, ay + 2.0, 0, [1.8, 2.4, 2.8], GL);
  for (const sx of [-1, 1]) { m.pier(sx * 1.5, 0.6, 0.1, ay + 1.1, STONE2, 5); m.box(0.2, 0.26, 0.2, sx * 1.5, ay + 1.3, 0.6, WARM, GL); }
  for (let i = 0; i < 8; i++) { const t = i / 8 * TAU + 0.2; m.ball(0.45 + rnd(i) * 0.25, 0, Math.sin(t) * 8.3, H(Math.sin(t) * 8.3, Math.cos(t) * 8.3) + 0.2, Math.cos(t) * 8.3, 0xdcd6c6, { sy: 0.7, ry: i }); }
}
