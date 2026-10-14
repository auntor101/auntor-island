#!/usr/bin/env node
// Builds dist/: only what visitors need (page, scripts, vendor, assets), never sources, docs, tests or node_modules.
// Adds a Content-Security-Policy meta tag to dist/index.html (static hosts like GitHub Pages cannot set headers).
// Usage: node tools/build-site.js [outDir]   (default: dist)
const fs = require('fs'), path = require('path');

const root = path.join(__dirname, '..');
const out = path.resolve(process.argv[2] || path.join(root, 'dist'));

const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self' blob:",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

function copyDir(src, dst, keep) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d, keep);
    else if (!keep || keep(s)) fs.copyFileSync(s, d);
  }
}

function build() {
  if (out === root || out === path.dirname(root)) throw new Error('refusing to build into ' + out);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const meta = '<meta http-equiv="Content-Security-Policy" content="' + CSP + '">';
  if (!/<meta charset="utf-8">/i.test(html)) throw new Error('index.html has no charset meta to insert the CSP after');
  html = html.replace(/(<meta charset="utf-8">)/i, '$1\n' + meta);
  fs.writeFileSync(path.join(out, 'index.html'), html);

  copyDir(path.join(root, 'js'), path.join(out, 'js'));
  copyDir(path.join(root, 'vendor'), path.join(out, 'vendor'));
  copyDir(path.join(root, 'assets'), path.join(out, 'assets'));
  fs.writeFileSync(path.join(out, '.nojekyll'), '');
  fs.copyFileSync(path.join(root, 'site', '_headers'), path.join(out, '_headers'));
  return out;
}

if (require.main === module) {
  const o = build();
  let n = 0, bytes = 0;
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else { n++; bytes += fs.statSync(p).size; } } })(o);
  console.log('built ' + o + ': ' + n + ' files, ' + (bytes / 1024 / 1024).toFixed(2) + ' MB');
} else {
  module.exports = { build, CSP };
}
