// Dev helper: open the game, wait, run JS expressions and print their results; optional screenshot. node tools/probe-npcs.mjs <url> "<js>" [--shot out.png] [--size 390x844] [--touch] [--delay ms] [--js2 "<js after delay>"]
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const require = createRequire(import.meta.url);
const puppeteer = ['../node_modules/puppeteer', '../../lumen-isle/node_modules/puppeteer'].map((p) => { try { return require(p); } catch { return null; } }).find(Boolean);
const [url, js, ...rest] = process.argv.slice(2);
const opt = (n, d) => { const i = rest.indexOf('--' + n); return i >= 0 ? rest[i + 1] : d; };
const [w, h] = opt('size', '390x844').split('x').map(Number), touch = rest.includes('--touch');
const exe = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const b = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
try {
  const p = await b.newPage(); await p.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
  const errs = []; p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(url, { waitUntil: 'load', timeout: 60000 });
  await p.waitForFunction(() => /Welcome to Auntor Island/.test(document.body.innerText), { timeout: 60000, polling: 500 }).catch(() => console.log('no welcome'));
  if (js) console.log(JSON.stringify(await p.evaluate(js)));
  await new Promise((r) => setTimeout(r, Number(opt('delay', 8000))));
  const j2 = opt('js2', ''); if (j2) console.log(JSON.stringify(await p.evaluate(j2)));
  const shot = opt('shot', ''); if (shot) await p.screenshot({ path: shot });
  console.log('errors:', errs.length ? errs.join(' || ') : 'none');
} finally { await b.close(); }
