// Headless quest-flow test: runs the game script in Node with a stubbed DOM and renderer,
// then plays Mira -> fireflies -> Pip -> Tobi riddles -> globe -> fox -> ring and checks state.
// Usage: npm install && npm test   (add "touch" to simulate a phone: node tools/test-flow.js touch)
const vm = require('vm'), fs = require('fs'), path = require('path');
const THREE = require('three');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
// UI-only files need a real DOM, which the headless stub does not provide.
const UI_ONLY = ['js/charselect.js'];
const files = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map(m => m[1]).filter(f => !UI_ONLY.includes(f));

let maxObjects = 0;
class FakeRenderer {
  constructor() { this.domElement = {}; }
  setPixelRatio() {} setSize() {} setRenderTarget() {} clear() {}
  render(scene) { let n = 0; scene.traverseVisible(o => { if (o.isMesh || o.isPoints || o.isSprite) n++; }); maxObjects = Math.max(maxObjects, n); }
  getDrawingBufferSize(v) { return v.set(800, 600); } getPixelRatio() { return 1; } getSize(v) { return v.set(800, 600); }
}
THREE.WebGLRenderer = FakeRenderer;

const els = {};
function el(id) {
  const e = { id, children: [], style: { setProperty() {} }, _cls: new Set(), textContent: '', innerHTML: '', hidden: false, _l: {},
    classList: { add: c => e._cls.add(c), remove: c => e._cls.delete(c), toggle: (c, on) => { ((on === undefined) ? !e._cls.has(c) : on) ? e._cls.add(c) : e._cls.delete(c); }, contains: c => e._cls.has(c) },
    appendChild(c) { e.children.push(c); return c; }, addEventListener(t, f) { e._l[t] = f; }, setAttribute() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; }, clientWidth: 800, clientHeight: 600, offsetWidth: 0, setPointerCapture() {} };
  return e;
}
const ctx2d = new Proxy({}, { get: (t, k) => String(k).startsWith('create') ? () => ({ addColorStop() {} }) : () => {} });
const errors = [];
const ctx = { THREE, performance, setTimeout, clearTimeout, setInterval, Math,
  console: { log: (...a) => console.log(...a), error: (...a) => { errors.push(a.join(' ')); console.log('ERROR', ...a); } },
  document: { getElementById: id => els[id] || (els[id] = el(id)), createElement: t => t === 'canvas' ? { width: 0, height: 0, getContext: () => ctx2d } : el(), createTextNode: t => ({ t }) },
  requestAnimationFrame: () => 1, innerWidth: 800, innerHeight: 600, devicePixelRatio: 1,
  matchMedia: () => ({ matches: process.argv[2] === 'touch' }), addEventListener() {} };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of files) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });

const L = ctx.__lumen; let now = 1000;
const step = n => { for (let i = 0; i < n; i++) { now += 16.7; L.step(now); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const WANT = ['A piano', 'Footsteps', 'Look into the globe', 'Go back', "Of course, I'll find them", 'I need a lens', 'Yes, I am'];
const choose = st => { for (const w of WANT) { const i = st.choices.indexOf(w); if (i >= 0) return i; } return 0; };
async function drive() { for (let k = 0; k < 500; k++) { await sleep(4); const st = L.dlg; if (!st) { if (L.mode !== 'talk') return; continue; }
  if (st.typing) { L.advance(); continue; } if (st.choices) L.pick(choose(st)); else L.advance(); } }
const tp = (x, z) => { L.P.pos.x = x; L.P.pos.z = z; };
function expect(cond, msg) { if (!cond) { console.log('FAIL:', msg); process.exit(1); } console.log('ok  ', msg); }

(async () => {
  step(30);
  L.applyProfile({ gender: 'f', name: 'Sam', look: 1, skin: 2 });
  expect(L.LI.profile.name === 'Sam' && L.LI.profile.gender === 'f', 'a girl profile can be applied');
  expect(L.P.c.root.parent === L.HUB.scene, 'the rebuilt player is still in the world');
  L.say({ name: 'T' }, 'Hi {name}'); L.advance();
  expect(els.dText.textContent === 'Hi Sam', '{name} is replaced in dialogue');
  L.pick(0);
  els.go._l.click(); step(200);
  expect(L.mode === 'play', 'start button drops the player into the world');
  tp(-6.4, 0.6); step(10); let p = L.talk(L.NPC.mira); await drive(); await p;
  expect(L.S.mira === 'active', 'Mira gives the firefly quest');
  for (const f of L.HUB.fireflies) { tp(f.g.position.x, f.g.position.z); step(3); }
  expect(L.S.fire === 5, 'all five fireflies can be caught');
  tp(-6.4, 0.6); step(5); p = L.talk(L.NPC.mira); await drive(); await p;
  expect(L.S.mira === 'done' && L.S.stars === 1, 'Mira rewards a star');
  tp(11, -10.4); step(5); p = L.talk(L.NPC.pip); await drive(); await p;
  expect(L.S.pip === 'met', 'Pip points to Tobi');
  tp(-17.5, 11.5); step(5); p = L.talk(L.NPC.tobi); await drive(); await p;
  expect(L.S.lens && L.S.stars === 2, 'Tobi riddles give the lens and a star');
  tp(11, -10.4); step(30); p = L.talk(L.NPC.pip); await drive(); await p; step(260);
  expect(L.world === 'inner' && L.mode === 'play', 'zooming into the globe reaches the inner world');
  tp(-0.8, -1.0); step(10); p = L.talk(L.NPC.fox); await drive(); await p;
  expect(L.S.fox === 'done' && L.S.stars === 3, 'Kit reveals the secret and gives the third star');
  tp(-7.5, 6.5); step(10); L.INNER.inter.find(i => i.name === 'ring').act(); await drive(); await sleep(500); step(200); await sleep(100);
  expect(L.world === 'hub' && L.mode === 'play', 'the ring of light returns to the island');
  expect(errors.length === 0, 'no script errors');
  console.log('max objects in one scene render:', maxObjects);
  process.exit(0);
})().catch(e => { console.log('FAIL', e.stack); process.exit(1); });
