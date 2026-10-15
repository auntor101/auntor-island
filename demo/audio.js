import { createAudio, createAudioButton, SFX_NAMES } from '../src/audio/index.js';

const audio = createAudio();
const c = { hours: 12, snow: false, speed: 0, zone: 'meadow', shore: 0, water: 0, falls: 0, altitude: 0, nearFire: 0, nearForge: 0, onGround: true, inWater: false };
const $ = (id) => document.getElementById(id);
createAudioButton($('mute'), audio);
$('unlock').onclick = () => audio.unlock();

const box = $('ctx');
const slider = (k, min, max, step) => {
  const l = document.createElement('label');
  l.innerHTML = `<span>${k}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${c[k]}"><b></b>`;
  const i = l.querySelector('input'), o = l.querySelector('b');
  i.oninput = () => { c[k] = +i.value; o.textContent = i.value; };
  o.textContent = c[k]; box.appendChild(l);
};
const check = (k) => {
  const l = document.createElement('label');
  l.innerHTML = `<span>${k}</span><input type="checkbox">`;
  l.querySelector('input').checked = !!c[k];
  l.querySelector('input').onchange = (e) => { c[k] = e.target.checked; }; box.appendChild(l);
};
slider('hours', 0, 24, 0.1); slider('speed', 0, 15, 0.5); slider('shore', 0, 1, 0.05); slider('water', 0, 1, 0.05);
slider('falls', 0, 1, 0.05); slider('altitude', 0, 80, 1); slider('nearFire', 0, 1, 0.1); slider('nearForge', 0, 1, 1);
check('snow'); check('onGround'); check('inWater');
const z = document.createElement('label');
z.innerHTML = '<span>zone</span><select><option>meadow</option><option>village</option><option>mountain</option><option>beach</option></select>';
z.querySelector('select').onchange = (e) => { c.zone = e.target.value; }; box.appendChild(z);

for (const n of SFX_NAMES) {
  const b = document.createElement('button');
  b.textContent = n; b.onclick = () => audio.sfx(n); $('sfx').appendChild(b);
}

let prev = performance.now();
const tick = () => {
  const now = performance.now(), dt = Math.min(0.1, (now - prev) / 1000); prev = now;
  audio.update(dt, c);
  $('status').textContent = audio.ctx ? `ctx ${audio.ctx.state} ready` : 'locked ready';
};
setInterval(tick, 1000 / 60);

// Probe for tools/audio-check.mjs: analyser on the limiter output, update cost, live source count.
let tap = null, buf = null;
window.__audio = audio; window.__c = c;
window.__probe = {
  async level(ms = 1500) {
    if (!tap) { tap = audio.ctx.createAnalyser(); tap.fftSize = 2048; audio.out.connect(tap); buf = new Float32Array(2048); }
    let sum = 0, n = 0, peak = 0; const end = performance.now() + ms;
    while (performance.now() < end) {
      tap.getFloatTimeDomainData(buf);
      for (const v of buf) { sum += v * v; n++; const a = Math.abs(v); if (a > peak) peak = a; }
      await new Promise((r) => setTimeout(r, 30));
    }
    return { rmsDb: 20 * Math.log10(Math.sqrt(sum / n) + 1e-9), peakDb: 20 * Math.log10(peak + 1e-9) };
  },
  cost(calls = 1000) { const t = performance.now(); for (let i = 0; i < calls; i++) audio.update(1 / 60, c); return (performance.now() - t) / calls; },
};
// count live source nodes (started, not yet ended) to prove nothing leaks
let live = 0;
const proto = window.AudioScheduledSourceNode.prototype, start = proto.start;
proto.start = function (...a) { live++; this.addEventListener('ended', () => live--, { once: true }); return start.apply(this, a); };
window.__probe.live = () => live;
