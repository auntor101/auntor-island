#!/usr/bin/env node
// Headless screenshot tool (Edge/Chrome, software GL). Usage:
//   node tools/shoot.mjs <url> <out.png> [--size 390x844|1280x720] [--touch] [--wait <regex on #hud text>] [--delay <ms>] [--eval "<js to run before the shot>"]
// Prints console errors and the HUD text. Needs a built or dev server already running at <url>.
// Browser: set BROWSER=<path> or it tries Edge then Chrome in the default Windows locations.
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const require = createRequire(import.meta.url);
// puppeteer lives in the repo-root node_modules; git worktrees (sibling folders) fall back to the main checkout.
const puppeteer = ['../../node_modules/puppeteer', '../../../lumen-isle/node_modules/puppeteer'].map((p) => { try { return require(p); } catch { return null; } }).find(Boolean);
if (!puppeteer) { console.error('puppeteer not found in ../../node_modules or ../../../lumen-isle/node_modules'); process.exit(2); }

const [url, out, ...rest] = process.argv.slice(2);
if (!url || !out) { console.error('usage: node tools/shoot.mjs <url> <out.png> [--size WxH] [--touch] [--wait regex] [--delay ms] [--eval js]'); process.exit(2); }
const opt = (n, d) => { const i = rest.indexOf('--' + n); return i >= 0 ? rest[i + 1] : d; };
const [w, h] = opt('size', '390x844').split('x').map(Number);
const touch = rest.includes('--touch');
const waitRe = new RegExp(opt('wait', 'chunks (\\d+)/\\1'));
const delay = Number(opt('delay', 1500));
const exe = process.env.BROWSER || [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find(existsSync);
if (!exe) { console.error('No Edge or Chrome found; set BROWSER'); process.exit(2); }

const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  // open the stats panel if it exists so the numbers are in the shot
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /stats/i.test(x.textContent)); const p = document.querySelector('#stats, .stats, #hud pre'); if (b && !(p && p.offsetParent)) b.click(); }).catch(() => {});
  await page.waitForFunction((src) => new RegExp(src).test(document.body.innerText), { timeout: 180000, polling: 500 }, waitRe.source).catch(() => console.error('warning: wait pattern never matched, shooting anyway'));
  const ev = opt('eval', '');
  if (ev) await page.evaluate(ev);
  await new Promise((r) => setTimeout(r, delay));
  await page.screenshot({ path: out });
  const hud = await page.evaluate(() => (document.querySelector('#hud')?.innerText || '').trim());
  console.log('shot', out, w + 'x' + h, touch ? 'touch' : 'mouse');
  console.log('HUD:', hud.replace(/\n/g, ' | '));
  console.log('console errors:', errors.length ? errors.join(' || ') : 'none');
} finally { await browser.close(); }
