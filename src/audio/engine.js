// Audio engine: one AudioContext, a master gain + compressor, music / ambience / sfx buses. All generated, no files.
// Everything is a no-op until unlock() is called from a user gesture (iOS), or if AudioContext does not exist.
import { createMusic } from './player.js';
import { createAmbience } from './ambience.js';
import { makeHelpers } from './synth.js';
import { SFX } from './sfx.js';
import { createVoiceLimiter, createRateLimiter, spatial } from './limits.js';

const KEY = 'auntor-muted';
const MAX_VOICES = 24;

function noiseBuffer(ac, seconds, brown) {
  const n = Math.floor(ac.sampleRate * seconds), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
  }
  return b;
}

export function createAudio() {
  const AC = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
  let muted = false;
  try { muted = localStorage.getItem(KEY) === '1'; } catch { /* private mode */ }
  let ac = null, master, comp, sfxBus, white, music, amb, acc = 0, last = {}, running = false;
  const L = { x: 0, z: 0, h: 0 };
  const voices = createVoiceLimiter(MAX_VOICES), rates = createRateLimiter();
  const level = () => (muted ? 0 : 0.85);

  const onVis = () => {
    if (!ac) return;
    if (document.hidden) ac.suspend().catch(() => {});
    else if (ac.state !== 'running') ac.resume().catch(() => {});
  };

  function build() {
    ac = new AC();
    master = ac.createGain(); master.gain.value = level();
    comp = ac.createDynamicsCompressor(); // gentle limiter so stacked sounds never clip
    comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.25;
    master.connect(comp); comp.connect(ac.destination);
    const bus = (v) => { const g = ac.createGain(); g.gain.value = v; g.connect(master); return g; };
    white = noiseBuffer(ac, 2, false);
    const brown = noiseBuffer(ac, 4, true);
    sfxBus = bus(0.9);
    music = createMusic(ac, bus(0.5), white);
    amb = createAmbience(ac, bus(0.6), white, brown);
    document.addEventListener('visibilitychange', onVis);
  }

  const api = {
    unlock() {
      if (!AC) return;
      if (!ac) { try { build(); } catch { ac = null; return; } }
      if (ac.state !== 'running') ac.resume().catch(() => {});
      if (!running) { // iOS: a silent one-sample buffer in the gesture finishes the unlock
        try { const s = ac.createBufferSource(); s.buffer = ac.createBuffer(1, 1, 22050); s.connect(ac.destination); s.start(0); running = true; } catch { /* ignore */ }
      }
    },
    isUnlocked: () => !!ac,
    setMuted(m) {
      muted = !!m;
      try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch { /* ignore */ }
      if (ac) master.gain.setTargetAtTime(level(), ac.currentTime, 0.05);
    },
    isMuted: () => muted,
    setListener(x, z, heading) { L.x = x; L.z = z; L.h = heading || 0; },
    update(dt, c) {
      if (!ac || muted || ac.state !== 'running') return;
      last = c || last;
      music.update(last);
      acc += dt;
      if (acc >= 0.1) { amb.update(Math.min(acc, 0.5), last); acc = 0; }
    },
    sfx(name, o = {}) {
      if (!ac || muted || ac.state !== 'running') return;
      const e = SFX[name];
      if (!e) return;
      const now = ac.currentTime;
      let gain = o.gain ?? 1, pan = 0;
      if (o.x !== undefined && o.z !== undefined) {
        const s = spatial(L.x, L.z, L.h, o.x, o.z);
        if (s.gain < 0.01) return;
        gain *= s.gain; pan = s.pan;
      }
      if (!rates.allow(name, now, e[0]) || !voices.tryAcquire(now, e[1])) return;
      const g = ac.createGain(); g.gain.value = gain;
      if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(sfxBus); } else g.connect(sfxBus);
      e[2](makeHelpers(ac, g, white, o.pitch || 1));
    },
    get ctx() { return ac; },
    get out() { return comp; },
    dispose() {
      document.removeEventListener('visibilitychange', onVis);
      if (!ac) return;
      try { music.dispose(); amb.dispose(); ac.close(); } catch { /* ignore */ }
      ac = null;
    },
  };
  return api;
}
