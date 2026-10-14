// Sound effect table: name -> [min seconds between plays, max duration, synth(h)]. h comes from synth.js.
const P = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.7, 1318.5]; // C major pentatonic, bright
const fs = (fn) => [0.07, 0.25, (h) => fn(h, 0.85 + h.r() * 0.3)];
const bell = (h, f, t, v, d = 0.9) => { h.tone('sine', f, t, d, v, 0.004); h.tone('sine', f * 2.76, t, d * 0.4, v * 0.25, 0.004); };
const crunch = (h, t) => h.noise('bandpass', 2500 * (0.8 + h.r() * 0.4), 2, t, 0.05, 0.3);

export const SFX = {
  'footstep-grass': fs((h, j) => { h.noise('bandpass', [1800 * j, 1200 * j], 0.8, 0, 0.1, 0.22, 0.01); h.noise('lowpass', 350 * j, 1, 0, 0.07, 0.25); }),
  'footstep-dirt': fs((h, j) => { h.noise('lowpass', 900 * j, 1, 0, 0.09, 0.3); h.tone('sine', [110 * j, 55], 0, 0.08, 0.25); }),
  'footstep-sand': fs((h, j) => h.noise('bandpass', [3000 * j, 2000 * j], 0.5, 0, 0.15, 0.2, 0.025)),
  'footstep-stone': fs((h, j) => { h.tone('triangle', [1800 * j, 1100], 0, 0.04, 0.12); h.noise('bandpass', 2500 * j, 2, 0, 0.05, 0.25); h.tone('sine', [140, 70], 0, 0.07, 0.2); }),
  'footstep-wood': fs((h, j) => { h.tone('triangle', [230 * j, 150], 0, 0.09, 0.3); h.noise('bandpass', 900 * j, 3, 0, 0.05, 0.2); }),
  'footstep-snow': fs((h, j) => { h.noise('bandpass', [2200 * j, 1300 * j], 1, 0, 0.13, 0.2, 0.02); h.noise('highpass', 5000, 0.5, 0.03, 0.06, 0.06); }),
  'footstep-water': fs((h, j) => { h.noise('bandpass', [500 * j, 1000 * j], 1, 0, 0.18, 0.25, 0.01); h.tone('sine', [600 * j, 1300], 0.03, 0.06, 0.08); }),
  jump: [0.1, 0.25, (h) => { h.tone('triangle', [260, 560], 0, 0.16, 0.2); h.noise('bandpass', [800, 2200], 1, 0, 0.12, 0.12, 0.02); }],
  land: [0.1, 0.25, (h) => { h.tone('sine', [150, 50], 0, 0.16, 0.45); h.noise('lowpass', 700, 1, 0, 0.12, 0.3); }],
  splash: [0.12, 0.8, (h) => { h.noise('bandpass', [1000, 3200, 1800], 0.7, 0, 0.5, 0.4, 0.02); for (let i = 0; i < 4; i++) { const f = 500 + h.r() * 700; h.tone('sine', [f, f * 2], 0.05 + i * 0.07 + h.r() * 0.05, 0.07, 0.1); } }],
  'ui-tap': [0.04, 0.1, (h) => h.tone('sine', [900, 700], 0, 0.06, 0.2)],
  'ui-open': [0.1, 0.3, (h) => { h.tone('sine', 520, 0, 0.12, 0.2); h.tone('sine', 780, 0.07, 0.2, 0.2); }],
  'ui-close': [0.1, 0.3, (h) => { h.tone('sine', 780, 0, 0.12, 0.2); h.tone('sine', 520, 0.07, 0.2, 0.2); }],
  select: [0.08, 0.3, (h) => { h.tone('triangle', 660, 0, 0.12, 0.22); h.tone('triangle', 990, 0.06, 0.18, 0.2); }],
  confirm: [0.1, 0.6, (h) => [0, 4, 7].forEach((s, i) => h.tone('triangle', 523.25 * 2 ** (s / 12), i * 0.08, 0.35, 0.2))],
  'note-pop': [0.2, 0.4, (h) => { h.tone('sine', [1200, 1800], 0, 0.1, 0.22); bell(h, 2400, 0.08, 0.14, 0.3); }],
  star: [0.15, 1.2, (h) => { for (let i = 0; i < 5; i++) bell(h, P[(2 + i + (h.r() * 2 | 0)) % 8] * 2, i * 0.07, 0.14, 0.9); }],
  fanfare: [0.5, 1.5, (h) => { [0, 4, 7, 12, 16].forEach((s, i) => { const f = 523.25 * 2 ** (s / 12), t = i * 0.12; h.tone('triangle', f, t, i === 4 ? 0.9 : 0.4, 0.2); h.tone('sine', f * 2, t, i === 4 ? 0.9 : 0.4, 0.08); }); }],
  meow: [0.3, 0.7, (h) => { const j = 0.9 + h.r() * 0.25; h.vox([500 * j, 850 * j, 620 * j, 430 * j], [900, 1900, 1100], 0, 0.55, 0.22, 0.06); }],
  purr: [0.6, 1.4, (h) => { h.pulse(260, 24, 0, 1.3, 0.35); h.tone('sawtooth', 60, 0, 1.3, 0.04, 0.2); }],
  bark: [0.25, 0.6, (h) => { const n = h.r() < 0.4 ? 2 : 1; for (let i = 0; i < n; i++) { const t = i * 0.2; h.vox([420, 250], [700, 1200], t, 0.15, 0.32, 0.01); h.noise('bandpass', 1500, 1.5, t, 0.07, 0.15); } }],
  whine: [0.5, 1.1, (h) => h.vox([450, 820, 680, 520], [600, 1000, 800], 0, 0.9, 0.16, 0.12)],
  pant: [0.5, 0.8, (h) => { for (let i = 0; i < 3; i++) h.noise('bandpass', 3000, 1, i * 0.22, 0.14, 0.14, 0.04); }],
  pet: [0.3, 0.6, (h) => { h.noise('bandpass', 1500, 0.8, 0, 0.3, 0.12, 0.08); h.tone('sine', [520, 660], 0.05, 0.3, 0.07, 0.05); }],
  'dragon-chirp': [0.3, 0.5, (h) => { h.tone('triangle', [900, 2200, 1500, 2600], 0, 0.35, 0.18, 0.02); h.tone('sine', [450, 1100, 750, 1300], 0, 0.35, 0.12, 0.02); }],
  'dragon-flap': [0.25, 0.5, (h) => { h.noise('lowpass', [500, 150], 0.7, 0, 0.35, 0.35, 0.05); h.tone('sine', [90, 45], 0, 0.25, 0.3, 0.03); }],
  'dragon-whoosh': [0.4, 1.0, (h) => h.noise('bandpass', [300, 2000, 600], 1, 0, 0.95, 0.28, 0.3)],
  'fire-breath': [0.5, 1.4, (h) => { h.noise('bandpass', [500, 1500, 700], 0.7, 0, 1.3, 0.35, 0.2); h.noise('lowpass', 300, 0.7, 0, 1.3, 0.3, 0.1); h.noise('highpass', 3000, 0.5, 0.1, 1.1, 0.06, 0.2); }],
  crash: [0.2, 1.1, (h) => { h.noise('lowpass', [3500, 300], 0.8, 0, 0.9, 0.5, 0.002); h.tone('sine', [120, 40], 0, 0.5, 0.45); for (let i = 0; i < 3; i++) h.tone('square', 600 + h.r() * 900, 0.03 + i * 0.05, 0.25, 0.04); }],
  death: [1, 1.5, (h) => { [523.25, 466.16, 392, 329.63, 261.63].forEach((f, i) => h.tone('triangle', f, i * 0.14, 0.3, 0.22)); h.tone('sawtooth', [240, 60], 0.75, 0.6, 0.15, 0.02); }],
  respawn: [0.5, 1.0, (h) => { h.tone('sine', [300, 900], 0, 0.3, 0.12, 0.05); [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(h, f, 0.25 + i * 0.08, 0.14, 0.6)); }],
  eat: [0.2, 0.5, (h) => { for (let i = 0; i < 3; i++) { crunch(h, i * 0.1); h.tone('sine', [200, 100], i * 0.1, 0.05, 0.12); } }],
  bonk: [0.2, 0.6, (h) => { h.tone('sine', [700, 180], 0, 0.22, 0.4); h.noise('bandpass', 1200, 2, 0, 0.04, 0.3); h.tone('triangle', [200, 520, 250, 440], 0.12, 0.4, 0.18, 0.02); }],
  door: [0.3, 1.0, (h) => { h.vox([180, 270, 200], [500, 900, 600], 0, 0.5, 0.12, 0.05); h.tone('sine', [110, 60], 0.5, 0.2, 0.4); h.noise('lowpass', 500, 1, 0.5, 0.12, 0.3); }],
  lantern: [0.3, 0.9, (h) => { bell(h, 1500, 0, 0.14, 0.6); bell(h, 1900, 0.09, 0.1, 0.5); h.noise('lowpass', 800, 0.8, 0.05, 0.25, 0.07, 0.08); }],
};
export const SFX_NAMES = Object.keys(SFX);
