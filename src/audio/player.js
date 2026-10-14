// Generative music: slow pad chords plus a random-walk melody, scheduled just ahead of the audio clock.
import { MOOD, moodFor, intensity, makeRng, nextDegree, degreeToMidi, midiToHz, nextGap } from './music.js';
import { makeHelpers } from './synth.js';

export function createMusic(ac, out, noiseBuf) {
  const rng = makeRng((Math.random() * 1e9) | 0);
  const bus = ac.createGain(); bus.connect(out);
  // soft echo for space
  const dl = ac.createDelay(1.5), fb = ac.createGain(), lp = ac.createBiquadFilter(), wet = ac.createGain();
  dl.delayTime.value = 0.43; fb.gain.value = 0.35; lp.type = 'lowpass'; lp.frequency.value = 1800; wet.gain.value = 0.4;
  bus.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(out);
  const padLp = ac.createBiquadFilter(), padG = ac.createGain();
  padLp.type = 'lowpass'; padLp.frequency.value = 800; padG.gain.value = 0; padLp.connect(padG); padG.connect(out);
  const mel = makeHelpers(ac, bus, noiseBuf), pad = makeHelpers(ac, padLp, noiseBuf);
  mel.t0 = pad.t0 = 0; // absolute times
  let mood = null, deg = 4, chord = 0, nextPad = 0, nextNote = 0;

  function note(P, t, inten) {
    const m = degreeToMidi(P.scale, P.root, deg), f = midiToHz(m), v = 0.1 * (1 + 0.3 * inten) * (0.8 + rng() * 0.4);
    if (P.voice === 'pluck') { mel.tone('triangle', f, t, 1.3, v, 0.006); mel.tone('sine', f * 2, t, 0.5, v * 0.3, 0.004); }
    else if (P.voice === 'bell') { mel.tone('sine', f * 2, t, 3.5, v * 0.7, 0.006); mel.tone('sine', f * 2 * 2.76, t, 1.2, v * 0.15, 0.004); }
    else { mel.tone('sine', f * 2, t, 2.6, v * 0.55, 0.004); mel.tone('sine', f * 4, t, 1.4, v * 0.18, 0.004); } // glassy
  }
  function chordOn(P, t) {
    const c = P.chords[chord++ % P.chords.length], len = P.chordLen * 1.3;
    for (const s of c) { const f = midiToHz(P.padRoot + s); pad.tone('sine', f, t, len, 0.07, P.chordLen * 0.3); pad.tone('triangle', f * 1.004, t, len, 0.03, P.chordLen * 0.3); }
  }
  return {
    get mood() { return mood; },
    update(c) {
      const now = ac.currentTime, m = moodFor(c.hours, c.snow), P = MOOD[m], inten = intensity(c.speed);
      if (m !== mood) { // crossfade: new pad chord fades in while the old one rings out
        mood = m; nextPad = now + 0.2; nextNote = now + 1.5;
        padG.gain.setTargetAtTime(P.pad * 0.5, now, 1.5);
        deg = Math.min(deg, P.scale.length * 2 - 1);
      }
      padLp.frequency.setTargetAtTime(P.cutoff * (1 + 0.6 * inten), now, 1);
      bus.gain.setTargetAtTime(1 + 0.25 * inten, now, 1);
      if (now >= nextPad - 0.1) { chordOn(P, Math.max(now, nextPad)); nextPad = Math.max(now, nextPad) + P.chordLen * (0.9 + rng() * 0.3); }
      if (nextNote < now - 1) nextNote = now; // resumed after a suspend
      while (nextNote < now + 0.25) {
        if (rng() < P.density) { deg = nextDegree(rng, deg, P.scale.length); note(P, Math.max(now, nextNote), inten); }
        nextNote += nextGap(rng, m, inten);
      }
    },
    dispose() { bus.disconnect(); padG.disconnect(); },
  };
}
