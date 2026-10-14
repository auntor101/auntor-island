// Real touch events through the select screen and the stick: node tools/touch-check.mjs [url]. Needs the dev server running.
import { createRequire } from 'node:module';
const puppeteer = createRequire(import.meta.url)('../../node_modules/puppeteer');
const url = process.argv[2] || 'http://localhost:5391/';
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('.sel-char');
  const center = async (sel, n = 0) => { const r = await page.evaluate((s, i) => { const b = document.querySelectorAll(s)[i].getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2, b.width, b.height]; }, sel, n); return r; };
  for (const [i, who] of ['man', 'woman', 'elf', 'wizard'].entries()) { const [x, y, w, h] = await center('.sel-char', i); console.log(who, 'card', Math.round(w) + 'x' + Math.round(h)); }
  let [x, y] = await center('.sel-char', 2); await page.touchscreen.tap(x, y);
  [x, y] = await center('.sel-name'); await page.touchscreen.tap(x, y); await page.keyboard.type('Zed<b>Longname1234');
  console.log('pressed', await page.evaluate(() => [...document.querySelectorAll('.sel-char')].map((b) => b.getAttribute('aria-pressed')).join()), 'name field', await page.evaluate(() => document.querySelector('.sel-name').value));
  const [gx, gy, gw, gh] = await center('.sel-go'); console.log('start', Math.round(gw) + 'x' + Math.round(gh));
  const t0 = Date.now(); await page.touchscreen.tap(gx, gy);
  await page.waitForFunction(() => /Welcome to Auntor Island/.test(document.body.innerText), { timeout: 120000 });
  console.log('welcome after', Date.now() - t0, 'ms:', await page.evaluate(() => document.querySelector('.note').textContent), '| card hidden', await page.evaluate(() => document.querySelector('.sel').hidden));
  console.log('stored', await page.evaluate(() => localStorage.getItem('isle.profile')), 'loadMs', await page.evaluate(() => window.__game.loadMs));
  const s0 = await page.evaluate(() => ({ ...window.__game.state }));
  // drag the stick up (forward) with the left thumb, normal push of 40 px
  await page.touchscreen.touchStart(100, 600); await page.touchscreen.touchMove(100, 560);
  await new Promise((r) => setTimeout(r, 12000));
  const run = await page.evaluate(() => document.querySelector('.ctl .base').classList.contains('run'));
  const s1 = await page.evaluate(() => ({ ...window.__game.state }));
  await page.touchscreen.touchMove(100, 520); await new Promise((r) => setTimeout(r, 1500));
  const run2 = await page.evaluate(() => document.querySelector('.ctl .base').classList.contains('run'));
  await page.touchscreen.touchEnd();
  console.log('moved', Math.hypot(s1.x - s0.x, s1.z - s0.z).toFixed(2), 'm, speed', s1.speed.toFixed(2), 'run at 40px push:', run, '| run at 80px push (past the 56px ring):', run2);
  console.log('errors', errs.length ? errs : 'none');
} finally { await browser.close(); }
