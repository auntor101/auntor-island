// Pure time-of-day maths: sun/moon directions and the sky palette. Hours wrap at 24; east is +x, north is -z.
const TILT = 0.35; // keeps the sun path off the exact east-west line
const dir = (a) => { const x = Math.cos(a), y = Math.sin(a), n = Math.hypot(x, y, TILT); return [x / n, y / n, TILT / n]; };
export const sunDirection = (h) => dir((h - 6) / 24 * 2 * Math.PI);
export const moonDirection = (h) => sunDirection(h).map((v) => -v);

// [hour, zenith, horizon, sunColor (moonlight at night), sunIntensity, ambient, fog, stars, moon]
const NIGHT = ['#0b1236', '#27386f', '#9db4ff', 0.55, '#6580c8', '#27386f', 1, 1];
const KEYS = [
  [0, ...NIGHT],
  [4.8, '#161f55', '#55508f', '#a9b8ff', 0.5, '#7080c4', '#3f4a86', 0.9, 1],
  [5.8, '#5a62c4', '#ff8a78', '#ff9a40', 0.85, '#b4a0d0', '#ee9a88', 0.05, 0.2],       // sunrise: pink and gold
  [7.5, '#2a82e0', '#ffd6a0', '#ffe0a8', 1, '#a9bdf0', '#f5d4b0', 0, 0],
  [12, '#1a86e6', '#f8d8b4', '#fff1d6', 1, '#b4c8f4', '#f1d3b4', 0, 0],
  [16.5, '#1c8ae8', '#ffcf9e', '#ffd9a0', 1, '#a9bdf0', '#f5cfaa', 0, 0],
  [18, '#3a2e90', '#ff6a4c', '#ffc48c', 0.75, '#b0a4d8', '#e8907a', 0.05, 0.3],       // sunset: orange-magenta
  [19.2, '#1c2064', '#8a3a78', '#a06ac0', 0.5, '#6a74c0', '#6c4686', 0.6, 1],
  [21, ...NIGHT],
  [24, ...NIGHT],
];
const rgb = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const hex = (v) => '#' + v.map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);

export function skyPalette(hours) {
  const h = ((hours % 24) + 24) % 24;
  let i = 0;
  while (KEYS[i + 1][0] <= h) i++;
  const a = KEYS[i], b = KEYS[i + 1], u = (h - a[0]) / (b[0] - a[0]), t = u * u * (3 - 2 * u);
  const c = (k) => hex(mix(rgb(a[k]), rgb(b[k]), t)), n = (k) => a[k] + (b[k] - a[k]) * t;
  return { zenith: c(1), horizon: c(2), sunColor: c(3), sunIntensity: n(4), ambient: c(5), fog: c(6), stars: n(7), moon: n(8) };
}
