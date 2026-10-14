// Procedural texture atlas (512 px, 4x4 tiles of 128 px, painted at startup, no image files) and the village materials.
import { CanvasTexture, SRGBColorSpace, LinearMipmapLinearFilter, MeshToonMaterial, MeshBasicMaterial } from 'three';
import { toonRamp } from '../common/toon.js';
import { rng } from './rng.js';

export const TILE = { planksH: 0, planksV: 1, beam: 2, stone: 3, shingle: 4, turf: 5, thatch: 6, cobble: 7, dirt: 8, clothRed: 9, clothBlue: 10, clothOchre: 11, door: 12, shutter: 13, net: 14, clinker: 15 };
export const SIGNS = ['tiramisu', 'blueberry-cheesecake', 'mungdi', 'coffee', 'steakhouse', 'seafood', 'asian-fusion', 'velvet-lounge', 'theatre', 'forge', 'stables', 'hall'];
const S = 128, TAU = 6.283;
const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
// Draw at the tile and its 8 wrapped neighbours so every tile repeats without a seam.
const W = (g, fn) => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { g.save(); g.translate(dx, dy); fn(); g.restore(); } };
const speckle = (g, r, n, l0, l1, a = 0.25) => { for (let i = 0; i < n; i++) { g.fillStyle = hsl(30, 10, l0 + r() * (l1 - l0), a); g.fillRect(Math.floor(r() * S), Math.floor(r() * S), 1 + (r() > 0.7), 1); } };
const wave = (g, y, a, k, ph) => { g.beginPath(); for (let x = 0; x <= S; x += 8) { const yy = y + a * Math.sin(x / S * TAU * k + ph); x ? g.lineTo(x, yy) : g.moveTo(x, yy); } g.stroke(); };

function planks(g, r, h, s, l, n = 8) {
  const bh = S / n;
  for (let i = 0; i < n; i++) {
    const y = i * bh, L = l + (r() - 0.5) * 12;
    g.fillStyle = hsl(h + (r() - 0.5) * 6, s, L); g.fillRect(0, y, S, bh);
    const k = 1 + Math.floor(r() * 3), ph = r() * 6;
    for (let j = 0; j < 5; j++) { g.strokeStyle = hsl(h, s, L + (r() > 0.5 ? -12 : 8), 0.28); g.lineWidth = 1; wave(g, y + 2 + j * (bh - 3) / 5 + r() * 1.5, 0.6 + r() * 1.2, k, ph); }
    const joint = r() * S, knot = r() < 0.55 ? [r() * S, y + bh * (0.3 + r() * 0.4), 2 + r() * 2.5] : null;
    W(g, () => {
      g.fillStyle = hsl(h, s, 14, 0.7); g.fillRect(joint, y + 1, 2, bh - 1);
      if (knot) { g.strokeStyle = hsl(h, s, 18, 0.8); g.lineWidth = 1.6; g.beginPath(); g.ellipse(knot[0], knot[1], knot[2] * 1.6, knot[2], 0, 0, TAU); g.stroke(); g.fillStyle = hsl(h, s, 24, 0.9); g.beginPath(); g.ellipse(knot[0], knot[1], knot[2] * 0.7, knot[2] * 0.5, 0, 0, TAU); g.fill(); }
    });
    g.fillStyle = hsl(h, s, 12, 0.85); g.fillRect(0, y, S, 2);
    g.fillStyle = hsl(h, s, L + 14, 0.5); g.fillRect(0, y + 2, S, 1);
  }
}
const rot = (g, fn) => { g.save(); g.translate(S, 0); g.rotate(Math.PI / 2); fn(); g.restore(); };
function cloth(g, r, a, b) {
  for (let x = 0; x < S; x += 16) { g.fillStyle = (x / 16) % 2 ? b : a; g.fillRect(x, 0, 16, S); }
  for (let y = 0; y < S; y += 3) { g.fillStyle = hsl(0, 0, 0, 0.06); g.fillRect(0, y, S, 1); }
  for (let x = 0; x < S; x += 32) { g.fillStyle = hsl(0, 0, 0, 0.09); g.fillRect(x, 0, 3, S); }
}
const ell = (g, x, y, rx, ry, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); };

const PAINT = [
  (g, r) => planks(g, r, 28, 42, 56),
  (g, r) => rot(g, () => planks(g, r, 28, 42, 54, 8)),
  (g, r) => { // dark beam
    g.fillStyle = hsl(24, 30, 30); g.fillRect(0, 0, S, S);
    for (let i = 0; i < 26; i++) { g.strokeStyle = hsl(24, 30, r() > 0.5 ? 18 : 40, 0.35); wave(g, r() * S, r() * 1.5, 1 + Math.floor(r() * 2), r() * 6); }
    g.fillStyle = hsl(24, 30, 50, 0.35); g.fillRect(0, 0, S, 4); g.fillStyle = hsl(24, 30, 10, 0.4); g.fillRect(0, S - 6, S, 6);
  },
  (g, r) => { // ashlar stone courses
    g.fillStyle = hsl(30, 12, 22); g.fillRect(0, 0, S, S);
    [0, 42, 86].forEach((y, row) => {
      const h = [42, 44, 42][row]; let x = r() * 20 - 20;
      while (x < S) {
        const w = 22 + r() * 24, L = 52 + (r() - 0.5) * 18, xx = x;
        W(g, () => { g.fillStyle = hsl(32, 8, L); g.beginPath(); g.roundRect(xx + 1.5, y + 1.5, w - 3, h - 3, 4); g.fill(); g.fillStyle = hsl(40, 10, L + 14, 0.7); g.fillRect(xx + 4, y + 2, w - 9, 2); g.fillStyle = hsl(30, 12, 18, 0.35); g.fillRect(xx + 3, y + h - 7, w - 6, 4); });
        x += w;
      }
    });
    speckle(g, r, 260, 20, 80);
  },
  (g, r) => { // shingles
    g.fillStyle = hsl(20, 30, 22); g.fillRect(0, 0, S, S);
    for (let row = 0; row < 8; row++) for (let i = 0; i < 8; i++) {
      const x = i * 16 + (row % 2) * 8, y = row * 16, L = 52 + (r() - 0.5) * 16;
      W(g, () => {
        g.fillStyle = hsl(20, 30, L); g.beginPath(); g.moveTo(x + 0.5, y); g.lineTo(x + 15.5, y); g.lineTo(x + 15.5, y + 18); g.quadraticCurveTo(x + 8, y + 24, x + 0.5, y + 18); g.fill();
        g.strokeStyle = hsl(20, 35, 14, 0.9); g.lineWidth = 1.4; g.beginPath(); g.moveTo(x + 0.5, y + 18); g.quadraticCurveTo(x + 8, y + 24, x + 15.5, y + 18); g.stroke();
        g.fillStyle = hsl(30, 40, L + 16, 0.5); g.fillRect(x + 2, y + 2, 10, 2);
      });
    }
  },
  (g, r) => { // turf
    g.fillStyle = hsl(96, 42, 36); g.fillRect(0, 0, S, S);
    for (let i = 0; i < 14; i++) { const x = r() * S, y = r() * S, rr = 8 + r() * 16, c = r() > 0.5 ? hsl(100, 45, 30, 0.45) : hsl(88, 50, 44, 0.4); W(g, () => ell(g, x, y, rr, rr * 0.7, c)); }
    g.fillStyle = hsl(30, 40, 20, 0.6); g.fillRect(0, 0, S, 2); g.fillRect(0, 64, S, 2); g.fillRect(0, 0, 2, 64); g.fillRect(64, 64, 2, 64);
    for (let i = 0; i < 360; i++) { const x = r() * S, y = r() * S, hh = 90 + r() * 25, L = 45 + r() * 22, a = (r() - 0.5) * 0.8, l = 4 + r() * 6; W(g, () => { g.strokeStyle = hsl(hh, 55, L, 0.85); g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * l, y - Math.cos(a) * l); g.stroke(); }); }
    for (let i = 0; i < 7; i++) { const x = r() * S, y = r() * S, c = r() > 0.5 ? '#fff6c8' : '#ffd24a'; W(g, () => ell(g, x, y, 1.6, 1.6, c)); }
  },
  (g, r) => { // thatch
    g.fillStyle = hsl(40, 45, 46); g.fillRect(0, 0, S, S);
    for (let i = 0; i < 520; i++) { const x = r() * S, y = r() * S, l = 14 + r() * 26, sl = (r() - 0.5) * 0.25, c = hsl(34 + r() * 14, 45 + r() * 15, 30 + r() * 38, 0.75), lw = 1 + r(); W(g, () => { g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); g.moveTo(x, y); g.lineTo(x + sl * l, y + l); g.stroke(); }); }
    [0, 43, 86].forEach((y) => { g.fillStyle = hsl(30, 40, 20, 0.6); g.fillRect(0, y, S, 3); for (let x = 0; x < S; x += 8) { g.fillStyle = hsl(36, 40, 62, 0.7); g.fillRect(x, y + 3, 2, 2); } });
  },
  (g, r) => { // cobbles
    g.fillStyle = hsl(30, 10, 20); g.fillRect(0, 0, S, S);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
      const cx = (i + 0.5 + (j % 2) * 0.5) * S / 6 + (r() - 0.5) * 3, cy = (j + 0.5) * S / 6 + (r() - 0.5) * 3, rx = 8.5 + r() * 2, L = 50 + (r() - 0.5) * 22, hh = 28 + r() * 14;
      W(g, () => { ell(g, cx, cy, rx, rx * 0.82, hsl(hh, 10, L)); ell(g, cx - 2, cy - 2.5, rx * 0.55, rx * 0.35, hsl(hh, 14, L + 16, 0.7)); g.strokeStyle = hsl(30, 10, 14, 0.7); g.lineWidth = 1.2; g.beginPath(); g.ellipse(cx, cy, rx, rx * 0.82, 0, 0, TAU); g.stroke(); });
    }
  },
  (g, r) => { // dirt
    g.fillStyle = hsl(30, 34, 44); g.fillRect(0, 0, S, S);
    for (let i = 0; i < 12; i++) { const x = r() * S, y = r() * S, rr = 10 + r() * 20, c = hsl(28, 30, 38 + r() * 12, 0.4); W(g, () => ell(g, x, y, rr, rr * 0.6, c)); }
    speckle(g, r, 900, 20, 70, 0.4);
    for (let i = 0; i < 14; i++) { const x = r() * S, y = r() * S, rr = 1.5 + r() * 2.5, c = hsl(32, 10, 55 + r() * 15); W(g, () => ell(g, x, y, rr, rr * 0.7, c)); }
  },
  (g, r) => cloth(g, r, hsl(42, 70, 90), hsl(6, 62, 46)),
  (g, r) => cloth(g, r, hsl(42, 70, 90), hsl(214, 52, 42)),
  (g, r) => cloth(g, r, hsl(45, 40, 92), hsl(38, 78, 56)),
  (g, r) => { // iron-banded door
    rot(g, () => planks(g, r, 26, 40, 46, 7));
    [18, 62, 106].forEach((y) => { g.fillStyle = hsl(220, 10, 18); g.fillRect(0, y, S, 9); g.fillStyle = hsl(220, 10, 36, 0.8); g.fillRect(0, y, S, 2); for (let x = 10; x < S; x += 22) ell(g, x, y + 5, 2, 2, hsl(220, 12, 50)); });
  },
  (g, r) => { // shutter: neutral planks (tinted by vertex colour) with a Z brace
    g.fillStyle = hsl(40, 6, 70); g.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x += 32) { g.fillStyle = hsl(40, 6, 30, 0.7); g.fillRect(x, 0, 2, S); g.fillStyle = hsl(40, 8, 86, 0.6); g.fillRect(x + 2, 0, 2, S); }
    g.fillStyle = hsl(40, 6, 58); g.fillRect(0, 14, S, 14); g.fillRect(0, 100, S, 14);
    g.beginPath(); g.moveTo(0, 100); g.lineTo(0, 114); g.lineTo(S, 28); g.lineTo(S, 14); g.fill(); g.strokeStyle = hsl(40, 6, 24, 0.7); g.lineWidth = 1.5; g.stroke();
    speckle(g, r, 200, 30, 90, 0.2);
  },
  (g) => { // fishing net
    g.fillStyle = hsl(36, 22, 30); g.fillRect(0, 0, S, S);
    g.strokeStyle = hsl(40, 38, 62); g.lineWidth = 2;
    for (let k = -8; k <= 16; k++) { g.beginPath(); g.moveTo(k * 16, 0); g.lineTo(k * 16 + S, S); g.stroke(); g.beginPath(); g.moveTo(k * 16, S); g.lineTo(k * 16 + S, 0); g.stroke(); }
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) ell(g, i * 16 + (j % 2) * 8, j * 16 + 8, 2.2, 2.2, hsl(36, 30, 50));
  },
  (g, r) => { // clinker strakes
    for (let i = 0; i < 4; i++) {
      const y = i * 32; g.fillStyle = hsl(30, 12, 62 + (r() - 0.5) * 8); g.fillRect(0, y, S, 32);
      g.fillStyle = hsl(30, 12, 80, 0.8); g.fillRect(0, y, S, 4); g.fillStyle = hsl(30, 14, 14, 0.8); g.fillRect(0, y + 28, S, 4);
      for (let x = 0; x < S; x += 8) { g.fillStyle = hsl(30, 12, 28); g.fillRect(x + 3, y + 8, 2, 2); }
    }
    speckle(g, r, 200, 30, 90, 0.2);
  },
];

// Sign pictograms: simple painted shapes, drawn in a 128 px board.
const path = (g, pts, c) => { g.fillStyle = c; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); };
const line = (g, pts, c, w) => { g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); };
const steam = (g, xs, y) => xs.forEach((x) => { g.strokeStyle = '#f0e8d6'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 6, y - 10, x, y - 22); g.stroke(); });
const PICT = [
  (g) => { ['#f4e4c4', '#6b3e26', '#f4e4c4', '#4a2a18'].forEach((c, i) => { g.fillStyle = c; g.fillRect(26, 76 - i * 14, 76, 13); }); g.fillStyle = '#7a4a2c'; g.fillRect(26, 70 - 3 * 14, 76, 4); ell(g, 94, 40, 5, 5, '#f4e4c4'); },
  (g) => { path(g, [[24, 84], [104, 84], [90, 40], [34, 40]], '#f7ecd0'); g.fillStyle = '#ecd7a0'; g.fillRect(24, 76, 80, 8); path(g, [[34, 40], [90, 40], [88, 52], [36, 52]], '#3c4fa8'); [[48, 38], [64, 34], [80, 39], [56, 47], [74, 48]].forEach(([x, y]) => { ell(g, x, y, 6, 6, '#2b3a8c'); g.fillStyle = '#8f9fe0'; g.fillRect(x - 2, y - 3, 2, 2); }); },
  (g) => { steam(g, [44, 62, 80], 56); g.fillStyle = '#f2ead6'; g.beginPath(); g.moveTo(20, 60); g.quadraticCurveTo(64, 116, 108, 60); g.closePath(); g.fill(); g.fillStyle = '#c8402e'; g.fillRect(20, 58, 88, 5); line(g, [[84, 18], [104, 56]], '#5a3a20', 3); line(g, [[94, 16], [112, 52]], '#5a3a20', 3); },
  (g) => { steam(g, [50, 64, 78], 58); path(g, [[34, 60], [94, 60], [88, 98], [64, 104], [40, 98]], '#f7f0e0'); g.strokeStyle = '#f7f0e0'; g.lineWidth = 6; g.beginPath(); g.arc(96, 76, 12, -1.4, 1.4); g.stroke(); g.fillStyle = '#6b3e26'; g.fillRect(36, 62, 56, 6); },
  (g) => { g.fillStyle = '#b8402e'; g.beginPath(); g.moveTo(22, 70); g.quadraticCurveTo(24, 38, 62, 38); g.quadraticCurveTo(106, 40, 108, 66); g.quadraticCurveTo(106, 96, 66, 92); g.quadraticCurveTo(26, 96, 22, 70); g.fill(); g.strokeStyle = '#6d1e14'; g.lineWidth = 3; g.stroke(); ell(g, 80, 66, 9, 9, '#f2e6cc'); for (let i = 0; i < 3; i++) line(g, [[34 + i * 10, 52], [42 + i * 10, 80]], '#3a1810', 3); },
  (g) => { g.fillStyle = '#6fb6d8'; g.beginPath(); g.moveTo(20, 64); g.quadraticCurveTo(54, 30, 90, 62); g.quadraticCurveTo(54, 98, 20, 64); g.fill(); path(g, [[88, 62], [112, 40], [108, 64], [112, 88]], '#6fb6d8'); ell(g, 40, 58, 5, 5, '#f2f8ff'); ell(g, 41, 58, 2.4, 2.4, '#12304a'); g.strokeStyle = '#3f86ad'; g.lineWidth = 2; g.beginPath(); g.arc(60, 64, 16, -1, 1); g.stroke(); },
  (g) => { g.fillStyle = '#f2ead6'; g.beginPath(); g.moveTo(22, 62); g.quadraticCurveTo(64, 108, 106, 62); g.closePath(); g.fill(); g.fillStyle = '#e8734a'; g.beginPath(); g.arc(50, 58, 12, Math.PI, 0); g.fill(); g.fillStyle = '#6fa84a'; g.beginPath(); g.arc(78, 58, 11, Math.PI, 0); g.fill(); line(g, [[60, 20], [96, 66]], '#8a5a30', 4); line(g, [[74, 18], [106, 56]], '#8a5a30', 4); },
  (g) => { const pts = []; for (let i = 0; i < 10; i++) { const a = -1.5708 + i * 0.6283, rr = i % 2 ? 20 : 44; pts.push([64 + Math.cos(a) * rr, 68 + Math.sin(a) * rr]); } path(g, pts, '#ffd56a'); g.strokeStyle = '#ff8ac0'; g.lineWidth = 3; g.stroke(); },
  (g) => { ell(g, 64, 66, 36, 40, '#f2e6cc'); ell(g, 50, 58, 8, 5, '#3a2038'); ell(g, 78, 58, 8, 5, '#3a2038'); g.strokeStyle = '#3a2038'; g.lineWidth = 4; g.beginPath(); g.arc(64, 78, 14, 0.2, 2.9); g.stroke(); },
  (g) => { g.fillStyle = '#3a3a48'; g.fillRect(34, 56, 64, 14); g.fillRect(48, 70, 36, 24); g.fillRect(40, 94, 52, 8); path(g, [[34, 56], [14, 62], [34, 68]], '#3a3a48'); g.fillStyle = '#c8cad6'; g.fillRect(36, 57, 60, 3); line(g, [[92, 26], [112, 46]], '#d8a050', 6); },
  (g) => { g.strokeStyle = '#d8dce6'; g.lineWidth = 8; g.beginPath(); g.arc(64, 70, 28, 0.35, Math.PI - 0.35, true); g.stroke(); [[42, 82], [86, 82], [38, 66], [90, 66]].forEach(([x, y]) => ell(g, x, y, 3, 3, '#12141c')); },
  (g) => { ell(g, 64, 66, 38, 38, '#c8402e'); ell(g, 64, 66, 24, 24, '#f2e6cc'); ell(g, 64, 66, 12, 12, '#c8402e'); ell(g, 64, 66, 4, 4, '#6b3e26'); },
];
const LABEL = ['TIRAMISU', 'CHEESECAKE', 'MUNGDI', 'COFFEE', 'STEAK', 'SEAFOOD', 'FUSION', 'VELVET', 'SAGA', 'FORGE', 'STABLES', 'HALL'];
const BG = ['#6b4a34', '#32406e', '#7a2e24', '#4a3424', '#5a2a22', '#24506a', '#2e5a44', '#4a1e5a', '#3a2a5a', '#2a2a34', '#4a3a24', '#5a3a1e'];

let cache;
export function getMaterials() {
  if (cache) return cache;
  const night = { value: 0 };
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const ac = mk(512, 512), ag = ac.getContext('2d'), tc = mk(S, S);
  PAINT.forEach((paint, i) => { const g = tc.getContext('2d'); g.clearRect(0, 0, S, S); paint(g, rng(1000 + i * 77)); ag.drawImage(tc, (i % 4) * S, Math.floor(i / 4) * S); });
  const atlas = new CanvasTexture(ac);
  atlas.colorSpace = SRGBColorSpace; atlas.minFilter = LinearMipmapLinearFilter; atlas.anisotropy = 4;
  const main = new MeshToonMaterial({ map: atlas, vertexColors: true, gradientMap: toonRamp() });
  main.onBeforeCompile = (sh) => { // per-vertex tile index + fract() so one atlas tile repeats over any surface
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aTile;\nvarying float vTile;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvTile = aTile;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vTile;').replace('#include <map_fragment>', `
      float tn = floor(vTile + 0.5); vec2 tcell = vec2(mod(tn, 4.0), 3.0 - floor(tn / 4.0));
      vec4 sampledDiffuseColor = textureGrad(map, (tcell + fract(vMapUv) * 0.92 + 0.04) * 0.25, dFdx(vMapUv) * 0.23, dFdy(vMapUv) * 0.23);
      diffuseColor *= sampledDiffuseColor;`);
  };
  main.customProgramCacheKey = () => 'village-main';
  // signs: separate 4x3 board atlas, plain UVs, faintly self-lit at night
  const sc = mk(512, 384), sg = sc.getContext('2d');
  SIGNS.forEach((_, i) => {
    sg.save(); sg.translate((i % 4) * S, Math.floor(i / 4) * S);
    sg.fillStyle = BG[i]; sg.fillRect(0, 0, S, S); sg.strokeStyle = '#e8c27a'; sg.lineWidth = 5; sg.strokeRect(4, 4, S - 8, S - 8);
    sg.strokeStyle = 'rgba(0,0,0,.25)'; sg.lineWidth = 2; sg.strokeRect(9, 9, S - 18, S - 18);
    PICT[i](sg);
    sg.fillStyle = '#f7e9c8'; sg.font = '800 15px system-ui, sans-serif'; sg.textAlign = 'center'; sg.fillText(LABEL[i], 64, 118);
    sg.restore();
  });
  const stex = new CanvasTexture(sc);
  stex.colorSpace = SRGBColorSpace; stex.anisotropy = 4;
  const sign = new MeshToonMaterial({ map: stex, gradientMap: toonRamp(), emissive: '#ffffff', emissiveMap: stex, emissiveIntensity: 0 });
  // glow: windows, lanterns, furnace. Dark glass by day, warm light at night (uNight) or always (aOn).
  const glow = new MeshBasicMaterial({ vertexColors: true });
  const nightHook = (sh, body) => {
    sh.uniforms.uNight = night;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aOn;\nvarying float vOn;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOn = aOn;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uNight;\nvarying float vOn;').replace('#include <color_fragment>', body);
  };
  glow.onBeforeCompile = (sh) => nightHook(sh, 'diffuseColor.rgb = mix(vec3(0.12, 0.17, 0.25), vColor.rgb, max(uNight, vOn));');
  glow.customProgramCacheKey = () => 'village-glow';
  // translucent: blob shadows (aOn 0) and warm light pools (aOn 1, night only)
  const bc = mk(64, 64), bg = bc.getContext('2d'), rg = bg.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.55, 'rgba(255,255,255,.55)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  bg.fillStyle = rg; bg.fillRect(0, 0, 64, 64);
  const trans = new MeshBasicMaterial({ map: new CanvasTexture(bc), vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  trans.onBeforeCompile = (sh) => nightHook(sh, '#include <color_fragment>\ndiffuseColor.a *= vOn > 0.5 ? uNight * 0.55 : 0.5 - 0.2 * uNight;');
  trans.customProgramCacheKey = () => 'village-trans';
  const smoke = new MeshBasicMaterial({ color: '#e6e2ee', transparent: true, opacity: 0.55, depthWrite: false });
  return (cache = { main, glow, sign, trans, smoke, night });
}
