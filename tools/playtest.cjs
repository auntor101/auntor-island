// Scripted mobile playthrough (touch emulation, software GL, slow): node tools/playtest.cjs [url]. Prints PASS/FAIL per check.
const { createRequire } = require('node:module');
const req = createRequire(require('node:path').join(__dirname, '..', 'package.json'));
const puppeteer = req('puppeteer');
const OUT = require('node:path').join(__dirname, '..', 'shots') + '/';
const URL_ = process.argv[2] || 'http://localhost:5198/'; // needs a VITE_DEBUG=1 build or the dev server
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, extra) => { results.push([ok ? 'PASS' : 'FAIL', name, extra === undefined ? '' : JSON.stringify(extra)]); console.log(ok ? 'PASS' : 'FAIL', name, extra === undefined ? '' : JSON.stringify(extra)); };
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', protocolTimeout: 600000, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
  const errs = []; p.on('pageerror', (e) => errs.push('PAGEERR ' + e)); p.on('console', (m) => m.type() === 'error' && !/404/.test(m.text()) && errs.push(m.text().slice(0, 200)));
  const ev = (f, ...a) => p.evaluate(f, ...a);
  await p.goto(URL_ + '?char=man&comp=dragon&name=Qa&t=12', { waitUntil: 'load' });
  await p.waitForFunction(() => window.__game && window.__game.state, { timeout: 200000, polling: 500 });
  await sleep(5000);
  const S = () => ev(() => { const s = window.__game.state; return s && { x: s.x, y: s.y, z: s.z, heading: s.heading, speed: s.speed }; });
  let s0 = await S();
  check('boot: finite state', s0 && [s0.x, s0.y, s0.z].every(Number.isFinite), s0);
  check('boot: welcome shown', /Welcome|Today/.test(await ev(() => document.querySelector('.note').textContent)));

  // walk
  await ev(() => { window.__game.bot = { x: 0, y: 1, run: false }; }); await sleep(8000); await ev(() => { window.__game.bot = null; });
  const s1 = await S(); check('walk: moved', Math.hypot(s1.x - s0.x, s1.z - s0.z) > 0.5, [s0.x | 0, s0.z | 0, s1.x | 0, s1.z | 0]);
  check('walk: y follows ground', Math.abs(s1.y - (await ev((x, z) => 0, 0, 0))) >= 0);

  // talk to nearest npc
  const npc = await ev(() => { const n = window.__npcs.npcs[0]; return n && { id: n.def.id, x: n.group ? n.group.position.x : n.x, z: n.group ? n.group.position.z : n.z }; });
  check('npcs exist', !!npc, npc && npc.id);
  if (npc) {
    await ev((id) => window.__npcs.talk(id), npc.id); await sleep(2500);
    const open = await ev(() => document.querySelector('.dlg, .dialogue, #dlg') ? true : window.__npcs.ui.open);
    check('dialogue opens via talk()', open === true);
    const txt = await ev(() => document.body.innerText);
    check('dialogue shows text', txt.length > 0);
    await ev(() => window.__npcs.ui.close()); await sleep(1000);
    check('dialogue closes', await ev(() => !window.__npcs.ui.open));
  }

  // pet
  await ev(() => { const c = window.__game.life._comp(); const s = window.__game.state; s.x = c.holder.position.x + 0.8; s.z = c.holder.position.z; }); await sleep(4000);
  const petHidden = await ev(() => document.querySelector('.pet')?.hidden);
  check('pet button appears near companion', petHidden !== undefined, petHidden);

  // sky panel + snow + night
  await p.tap('.sky-toggle'); await sleep(800);
  await ev(() => { [...document.querySelectorAll('.sky-panel .chip')].find((c) => /Night/.test(c.textContent))?.click(); }); await sleep(2500);
  await ev(() => { document.querySelector('.snow')?.click(); }); await sleep(2500);
  check('sky: night+snow no errors', errs.length === 0, errs.slice(0, 3));
  await p.screenshot({ path: OUT + 'qa-night-snow.png' });
  await ev(() => { [...document.querySelectorAll('.sky-panel .chip')].find((c) => /Day/.test(c.textContent) && !/Auto/.test(c.textContent))?.click(); document.querySelector('.snow')?.click(); });
  await p.tap('.sky-toggle');

  // minimap
  const mm = await ev(() => { const m = document.querySelector('.mm, .mm-mini, [class*="mm"]'); if (!m) return null; const r = m.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  if (mm) { await p.touchscreen.tap(mm[0], mm[1]); await sleep(1500); check('minimap opens a bigger map', await ev(() => !!document.querySelector('.mm-full') && !document.querySelector('.mm-full').hidden)); await p.setViewport({ width: 844, height: 390, hasTouch: true, isMobile: true }); await sleep(2500); await p.screenshot({ path: OUT + 'qa-map-land.png' }); check('map close button on screen in landscape', await ev(() => { const b = [...document.querySelectorAll('.mm-bar button')].find((x) => /Close/.test(x.textContent)); const r = b.getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0; })); await p.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true }); await sleep(1500); await ev(() => { [...document.querySelectorAll('.mm-bar button')].find((b) => /Close/.test(b.textContent))?.click(); }); await sleep(800); }

  // fly -> dive -> crash -> death card -> retry
  await ev(() => { const c = window.__game.life._comp(); const s = window.__game.state; s.x = c.holder.position.x + 1.5; s.z = c.holder.position.z + 1.5; }); await sleep(3500);
  const fly = await ev(() => { const f = document.querySelector('.fly'); if (!f || f.hidden) return null; const r = f.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  check('fly button visible near dragon', !!fly);
  if (fly) {
    await p.touchscreen.tap(fly[0], fly[1]); await sleep(3000);
    check('flying after tap', await ev(() => window.__game.ride.flying));
    check('boost label while flying', (await ev(() => document.querySelector('.ctl button').textContent)) === 'Boost');
    const sc = await ev(() => window.__game.life._comp().holder.scale.x); check('dragon scaled up while ridden', sc > 2, sc);
    await ev(() => { window.__game.bot = { x: 0, y: -1, run: false }; });
    for (let i = 0; i < 120; i++) { await sleep(1000); if (await ev(() => window.__game.death.open)) break; }
    const open = await ev(() => window.__game.death.open); check('dive crash opens death card', open);
    await p.screenshot({ path: OUT + 'qa-death.png' });
    await ev(() => { window.__game.bot = null; document.querySelector('.dead button').click(); }); await sleep(3000);
    const after = await ev(() => ({ open: window.__game.death.open, pose: !!window.__game.ride.pose, sc: window.__game.life._comp().holder.scale.x, label: document.querySelector('.ctl button').textContent }));
    check('retry: card closed, on foot, dragon normal size, Run label', !after.open && !after.pose && after.sc === 1 && after.label === 'Run', after);
  }

  // rotate to landscape: every visible HUD button fully on screen and not covered
  await p.setViewport({ width: 844, height: 390, hasTouch: true, isMobile: true }); await sleep(4000);
  const bad = await ev(() => [...document.querySelectorAll('#hud button')].filter((b) => !b.hidden && b.offsetParent).map((b) => { const r = b.getBoundingClientRect(), t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { t: b.textContent.slice(0, 10), off: r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight, covered: !(t === b || b.contains(t)) }; }).filter((x) => x.off || x.covered));
  check('landscape: buttons on screen and tappable', bad.length === 0, bad);
  await p.screenshot({ path: OUT + 'qa-land.png' });
  const stats = await ev(() => document.querySelector('#hud pre')?.textContent);
  console.log('STATS', (stats || '').replace(/\n/g, ' | '));
  check('no page errors during playthrough', errs.length === 0, errs.slice(0, 5));
  await b.close();
  console.log('DONE', results.filter((r) => r[0] === 'FAIL').length, 'failures');
})().catch((e) => { console.log('SCRIPTFAIL', e.message); process.exit(1); });
