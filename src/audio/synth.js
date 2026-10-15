// Tiny WebAudio voice helpers. Times are seconds from h.t0 (set h.t0 = 0 for absolute times).
// Frequency args may be a number or an array (exponential glide through the values across the duration).
export function makeHelpers(ac, out, noiseBuf, pitch = 1) {
  const h = { ac, out, p: pitch, t0: ac.currentTime, r: Math.random };
  const arr = (f) => (Array.isArray(f) ? f : [f]);
  const glide = (prm, f, T, d) => {
    const v = arr(f); prm.setValueAtTime(v[0] * h.p, T);
    for (let i = 1; i < v.length; i++) prm.exponentialRampToValueAtTime(v[i] * h.p, T + (d * i) / (v.length - 1));
  };
  const env = (g, T, d, v, a) => { g.gain.setValueAtTime(0.0001, T); g.gain.linearRampToValueAtTime(v, T + a); g.gain.exponentialRampToValueAtTime(0.0001, T + d); };
  h.tone = (type, f, t, d, v, a = 0.005, to = out) => {
    const T = h.t0 + t, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; glide(o.frequency, f, T, d); env(g, T, d, v, a);
    o.connect(g); g.connect(to); o.start(T); o.stop(T + d + 0.03); return g;
  };
  h.noise = (ft, f, q, t, d, v, a = 0.003, to = out) => {
    const T = h.t0 + t, s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; s.loop = true; fl.type = ft; fl.Q.value = q; glide(fl.frequency, f, T, d); env(g, T, d, v, a);
    s.connect(fl); fl.connect(g); g.connect(to); s.start(T, Math.random() * 1.5); s.stop(T + d + 0.03); return g;
  };
  // animal-ish voice: sawtooth through a sweeping band-pass "formant"
  h.vox = (f, form, t, d, v, a = 0.03, to = out) => {
    const T = h.t0 + t, o = ac.createOscillator(), bp = ac.createBiquadFilter(), g = ac.createGain();
    o.type = 'sawtooth'; glide(o.frequency, f, T, d); bp.type = 'bandpass'; bp.Q.value = 5; glide(bp.frequency, form, T, d); env(g, T, d, v, a);
    o.connect(bp); bp.connect(g); g.connect(to); o.start(T); o.stop(T + d + 0.03); return g;
  };
  // low rumble whose loudness pulses at `rate` Hz (purr)
  h.pulse = (f, rate, t, d, v) => {
    const g = h.noise('lowpass', f, 0.7, t, d, v, 0.1), T = h.t0 + t, l = ac.createOscillator(), k = ac.createGain();
    l.frequency.value = rate; k.gain.value = v * 0.7; l.connect(k); k.connect(g.gain); l.start(T); l.stop(T + d + 0.03);
  };
  return h;
}
