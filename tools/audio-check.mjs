#!/usr/bin/env node
// Numeric audio check against demo/audio.html (serve with `npx vite --port N` first): node tools/audio-check.mjs http://localhost:N/demo/audio.html [shot.png]
// Clicks to unlock, measures RMS/peak at each mood and for sample sfx, update() cost, and live source count over 60 s.
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const require = createRequire(import.meta.url);
const puppeteer = ['../node_modules/puppeteer', '../../lumen-isle/node_modules/puppeteer'].map((p) => { try { return require(p); } catch { return null; } }).find(Boolean);
const [url, shot] = process.argv.slice(2);
const exe = process.env.BROWSER || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--no-sandbox'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url, { waitUntil: 'load' });
  console.log('before click ctx:', await page.evaluate(() => String(window.__audio.ctx)));
  await page.click('#unlock');
  await sleep(500);
  console.log('after click state:', await page.evaluate(() => window.__audio.ctx.state));
  const set = (o) => page.evaluate((o) => Object.assign(window.__c, o), o);
  const lvl = (ms) => page.evaluate((ms) => window.__probe.level(ms), ms);
  const f = (r) => `rms ${r.rmsDb.toFixed(1)} dBFS, peak ${r.peakDb.toFixed(1)} dBFS`;
  let worst = -99;
  for (const [name, o] of [['sunrise', { hours: 6, snow: false }], ['day', { hours: 12 }], ['sunset', { hours: 18.5 }], ['night', { hours: 23 }], ['snow', { snow: true }], ['day+speed', { hours: 12, snow: false, speed: 14 }]]) {
    await set(o); await sleep(6000); const r = await lvl(3000); worst = Math.max(worst, r.peakDb); console.log('music', name.padEnd(10), f(r));
  }
  await set({ speed: 0, hours: 12, shore: 1, water: 1, falls: 1, altitude: 40, nearFire: 1, nearForge: 1, zone: 'village' });
  await sleep(3000); const busy = await lvl(3000); worst = Math.max(worst, busy.peakDb); console.log('all ambience + music', f(busy));
  await set({ shore: 0, water: 0, falls: 0, altitude: 0, nearFire: 0, nearForge: 0 });
  for (const n of ['footstep-grass', 'jump', 'splash', 'meow', 'bark', 'dragon-chirp', 'fire-breath', 'crash', 'death', 'fanfare']) {
    const p = lvl(1500); await sleep(100); await page.evaluate((n) => window.__audio.sfx(n), n); const r = await p; worst = Math.max(worst, r.peakDb); console.log('sfx', n.padEnd(15), f(r));
  }
  // stress: every sfx at once, many times
  const pk = lvl(2000); await page.evaluate(() => { for (let k = 0; k < 4; k++) for (const b of document.querySelectorAll('#sfx button')) b.click(); }); const st = await pk; console.log('stress (all sfx x4)', f(st));
  await set({ hours: 12, speed: 0 });
  console.log('update cost ms/call:', (await page.evaluate(() => window.__probe.cost(1000))).toFixed(4));
  const live = [];
  for (let s = 0; s < 3; s++) { await sleep(20000); live.push(await page.evaluate(() => window.__probe.live())); }
  console.log('live source nodes at +20/40/60 s:', live.join(', '));
  console.log('worst peak dBFS:', worst.toFixed(1), '| console errors:', errors.length ? errors.join(' || ') : 'none');
  if (shot) await page.screenshot({ path: shot, fullPage: true });
} finally { await browser.close(); }
