// Noise-based ambience layers (started only while audible) plus random one-shot events (birds, crickets, owl, fire, forge).
import { daylight } from './music.js';
import { makeHelpers } from './synth.js';

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

export function createAmbience(ac, out, white, brown) {
  const h = makeHelpers(ac, out, white);
  const layers = [];
  function layer(buf, chain) {
    const g = ac.createGain(); g.gain.value = 0; g.connect(out);
    const fl = chain.map(([t, f, q]) => { const b = ac.createBiquadFilter(); b.type = t; b.frequency.value = f; b.Q.value = q; return b; });
    fl.forEach((b, i) => b.connect(fl[i + 1] || g));
    let src = null, idle = 0;
    const L = {
      f: fl[0],
      set(level, dt, tc = 0.8) {
        const now = ac.currentTime;
        if (level > 0.003) {
          idle = 0;
          if (!src) { src = ac.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(fl[0]); src.start(0, Math.random() * 3); }
        } else if (src && (idle += dt) > 5) { src.stop(); src.disconnect(); src = null; } // silent for 5 s: free the source
        g.gain.setTargetAtTime(level, now, tc);
      },
      dispose() { if (src) src.stop(); g.disconnect(); },
    };
    layers.push(L);
    return L;
  }
  const sea = layer(brown, [['lowpass', 500, 0.7]]);
  const water = layer(white, [['bandpass', 800, 1.2]]);
  const falls = layer(white, [['highpass', 180, 0.7], ['lowpass', 3200, 0.7]]);
  const wind = layer(brown, [['bandpass', 450, 0.9]]);
  const hush = layer(white, [['highpass', 5000, 0.7], ['lowpass', 9000, 0.7]]);
  const fire = layer(brown, [['lowpass', 220, 0.7]]);
  const murmur = layer(brown, [['bandpass', 520, 1.6]]);
  let sp = Math.random() * 6, clock = 0, forgeAt = 0;

  const birdGroup = (v) => { // 2-5 quick glides at a random pitch, a "phrase"
    const base = 2400 + Math.random() * 1800, n = 2 + ((Math.random() * 4) | 0), gap = 0.07 + Math.random() * 0.06;
    for (let i = 0; i < n; i++) { const f = base * (0.9 + Math.random() * 0.3); h.tone('sine', Math.random() < 0.5 ? [f, f * 1.35] : [f * 1.3, f], i * gap, 0.06, v, 0.008); }
  };
  const cricket = (v) => { const f = 4200 + Math.random() * 500; for (let i = 0; i < 4; i++) h.tone('sine', f, i * 0.06, 0.04, v, 0.006); };
  const owl = (v) => { h.tone('sine', [400, 360], 0, 0.35, v, 0.05); h.tone('sine', [340, 300], 0.5, 0.6, v, 0.06); };

  return {
    update(dt, c) {
      clock += dt;
      const day = daylight(c.hours ?? 12), night = 1 - day, snow = c.snow ? 1 : 0, alt = clamp01((c.altitude || 0) / 70);
      const hr = (((c.hours ?? 12) % 24) + 24) % 24, mid = hr > 9 && hr < 16 ? 1 : 0.5;
      const shore = clamp01(c.shore || 0), fireN = +c.nearFire || 0, village = c.zone === 'village' ? 1 : 0, now = ac.currentTime;
      sp += dt * (0.1 + 0.04 * Math.sin(clock * 0.31));
      const swell = 0.55 + 0.3 * Math.sin(sp * 6.283) + 0.15 * Math.sin(sp * 15.1);
      sea.set((0.03 + 0.3 * shore * shore) * swell * (1 - 0.7 * alt), dt, 0.6);
      sea.f.frequency.setTargetAtTime(350 + 900 * swell * (0.4 + shore), now, 0.5);
      water.set(0.16 * clamp01(c.water || 0), dt);
      water.f.frequency.setTargetAtTime(650 + 500 * Math.random(), now, 0.1);
      falls.set(0.3 * clamp01(c.falls || 0), dt);
      const gust = 0.5 + 0.5 * Math.sin(clock * 0.37) * Math.sin(clock * 0.11 + 1);
      wind.set((0.02 + 0.13 * alt + (c.zone === 'mountain' ? 0.06 : 0) + (c.onGround === false ? 0.06 : 0) + 0.004 * (c.speed || 0)) * (0.6 + 0.6 * gust) * (c.inWater ? 0.5 : 1), dt, 1);
      wind.f.frequency.setTargetAtTime(300 + 400 * gust + 600 * alt, now, 0.8);
      hush.set(0.035 * snow, dt, 1.5);
      fire.set(0.07 * clamp01(fireN), dt, 0.5);
      murmur.set(village * 0.07 * (0.6 + 0.4 * Math.sin(clock * 7.3) * Math.sin(clock * 2.9)), dt, 0.15);
      // one-shot events (this runs 10 times a second)
      const R = Math.random;
      if (fireN > 0 && R() < 0.5 * fireN) h.noise('highpass', 2000 + R() * 3000, 1, 0, 0.02 + R() * 0.03, 0.12 * fireN, 0.001);
      if (c.nearForge && clock > forgeAt) { forgeAt = clock + 1.5 + R() * 2.5; const f = 1800 + R() * 400; h.tone('sine', f, 0, 0.5, 0.1, 0.002); h.tone('sine', f * 2.76, 0, 0.15, 0.04, 0.002); }
      if (!snow && day > 0.2) { const k = day * mid * (1 - 0.6 * shore) * (1 - alt); if (R() < 0.012 * k) birdGroup(0.05 * k); }
      if (!snow && night > 0.5 && R() < 0.03 * night) cricket(0.03);
      if (!snow && night > 0.6 && R() < 0.0015) owl(0.07);
    },
    dispose() { layers.forEach((l) => l.dispose()); },
  };
}
