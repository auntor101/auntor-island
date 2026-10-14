// Pure music logic: scales, moods, seeded note choice. No WebAudio here (unit-tested).
export const MAJOR_PENT = [0, 2, 4, 7, 9];
export const MINOR_PENT = [0, 3, 5, 7, 10];
export const MOODS = ['sunrise', 'day', 'sunset', 'night', 'snow'];

// chords are semitone offsets from padRoot; melody walks the scale from root over two octaves
export const MOOD = {
  sunrise: { scale: MAJOR_PENT, root: 67, padRoot: 55, chords: [[0, 7, 11, 14], [-3, 4, 7, 11], [-5, 2, 7, 12]], beat: 1.7, density: 0.6, voice: 'pluck', pad: 0.9, cutoff: 900, chordLen: 8 },
  day: { scale: MAJOR_PENT, root: 60, padRoot: 48, chords: [[0, 7, 11, 16], [-3, 4, 9, 12], [-7, 0, 5, 9], [-5, 2, 7, 11]], beat: 0.8, density: 0.7, voice: 'pluck', pad: 1, cutoff: 1400, chordLen: 7 },
  sunset: { scale: MAJOR_PENT, root: 65, padRoot: 53, chords: [[0, 7, 12, 16], [-5, 2, 7, 12], [-3, 4, 9, 14]], beat: 2.0, density: 0.55, voice: 'pluck', pad: 1, cutoff: 800, chordLen: 9 },
  night: { scale: MINOR_PENT, root: 69, padRoot: 45, chords: [[0, 7, 10, 14], [-4, 3, 7, 10], [-2, 5, 10, 14]], beat: 3.4, density: 0.4, voice: 'bell', pad: 0.8, cutoff: 600, chordLen: 11 },
  snow: { scale: MAJOR_PENT, root: 72, padRoot: 50, chords: [[0, 7, 14, 19], [-2, 5, 12, 17], [-5, 2, 9, 14]], beat: 2.8, density: 0.4, voice: 'glass', pad: 0.55, cutoff: 500, chordLen: 10 },
};

const wrap = (h) => ((h % 24) + 24) % 24;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const moodFor = (hours, snow) => {
  if (snow) return 'snow';
  const h = wrap(hours);
  return h < 4.5 || h >= 20.5 ? 'night' : h < 8 ? 'sunrise' : h < 17 ? 'day' : 'sunset';
};
// 0 at night .. 1 in full day (smooth ramps at dawn 5-7 and dusk 18.5-20.5)
export const daylight = (hours) => {
  const h = wrap(hours), a = clamp01((h - 5) / 2), b = clamp01((20.5 - h) / 2);
  return a * a * (3 - 2 * a) * (b * b * (3 - 2 * b));
};
export const intensity = (speed) => clamp01((speed || 0) / 12);

export function makeRng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// random walk over scale indices 0..(2*len-1): mostly steps of 1, sometimes a skip, sometimes a repeat
export function nextDegree(rng, prev, len) {
  const r = rng(), step = r < 0.15 ? 0 : r < 0.55 ? 1 : r < 0.8 ? -1 : r < 0.9 ? 2 : -2;
  let n = prev + step;
  if (n < 0 || n >= len * 2) n = prev - step;
  return Math.max(0, Math.min(len * 2 - 1, n));
}
export const degreeToMidi = (scale, root, idx) => root + 12 * Math.floor(idx / scale.length) + scale[idx % scale.length];
export const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
// seconds until the next melody note; varied rhythm, quicker with intensity
export function nextGap(rng, mood, inten = 0) {
  const k = [0.5, 1, 1, 1.5, 2, 3][(rng() * 6) | 0];
  return (MOOD[mood].beat * k * (0.85 + rng() * 0.3)) / (1 + 0.6 * inten);
}
