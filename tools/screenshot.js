// Renders the game in headless Chrome and saves screenshots to tools/shots/.
// Usage: npm install && npm run shots
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const root = path.join(__dirname, '..'), out = path.join(__dirname, 'shots');
fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(0);
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await puppeteer.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const [name, vp] of [['desktop', { width: 1280, height: 760 }], ['phone', { width: 390, height: 780, isMobile: true, hasTouch: true }]]) {
    const page = await browser.newPage(); await page.setViewport(vp);
    page.on('pageerror', e => console.log(`[${name}] page error:`, e.message));
    await page.goto(url, { waitUntil: 'load' }); await page.evaluate(() => { window.__maxDt = 0.6; }); await wait(3000);
    await page.screenshot({ path: path.join(out, `${name}-1-title.png`) });
    await page.click('#go'); await wait(4000);
    await page.evaluate(() => { const L = __lumen; L.S.lens = true; L.S.pip = 'met'; L.P.pos.x = 11.4; L.P.pos.z = -9.6; }); await wait(3000);
    await page.screenshot({ path: path.join(out, `${name}-2-globe.png`) });
    await page.evaluate(() => { window.__maxDt = 0.05; __lumen.enterGlobe(); }); await wait(8000);
    await page.screenshot({ path: path.join(out, `${name}-3-zoom.png`) });
    await page.evaluate(() => { window.__maxDt = 0.6; }); await wait(6000);
    await page.screenshot({ path: path.join(out, `${name}-4-inside.png`) });
    await page.close(); console.log('saved', name);
  }
  await browser.close(); server.close();
})().catch(e => { console.error(e); server.close(); process.exit(1); });
