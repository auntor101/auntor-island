const assert = require('assert'), fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'auntor-dist-'));
execFileSync(process.execPath, [path.join(__dirname, 'build-site.js'), out], { stdio: 'pipe' });

const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
assert.ok(/http-equiv="Content-Security-Policy"/.test(html), 'CSP meta is present');
assert.ok(html.indexOf('Content-Security-Policy') < html.indexOf('<script'), 'CSP comes before any script');

// every local script and the models the game loads must be in the build
for (const m of html.matchAll(/<script src="([^"]+)"><\/script>/g)) assert.ok(fs.existsSync(path.join(out, m[1])), m[1] + ' is in the build');
for (const f of ['assets/nature/manifest.json', 'assets/nature/CommonTree_3.glb', 'assets/animals/Cat.fbx', 'assets/CREDITS.md', '.nojekyll', '_headers']) assert.ok(fs.existsSync(path.join(out, f)), f + ' is in the build');

// nothing private or heavy may ship
for (const f of ['node_modules', 'docs', 'tools', 'assets-src', '.superpowers', 'CLAUDE.md', 'package.json', 'concepts', '.git']) assert.ok(!fs.existsSync(path.join(out, f)), f + ' must not be in the build');

// no local script is loaded inline or from another origin
assert.ok(!/<script(?![^>]*src=)[^>]*>/.test(html), 'no inline scripts (the CSP forbids them)');

let bytes = 0;
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p) : (bytes += fs.statSync(p).size); } })(out);
assert.ok(bytes < 5 * 1024 * 1024, 'build is under 5 MB (' + bytes + ')');
fs.rmSync(out, { recursive: true, force: true });
console.log('build tests ok, ' + (bytes / 1024 / 1024).toFixed(2) + ' MB');
