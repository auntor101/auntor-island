// Downloads the roster source VRMs with gh into ../assets-src/vrm (git-ignored). Untrusted: parsed only, refused unless licenceOk.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { vrmMeta, licenceOk, licenceLabel } from './vrm-meta.mjs';

const OUT = new URL('../../assets-src/vrm/', import.meta.url);
const V = 'vroid/beta/';
const FILES = [
  ['madjin/vrm-samples', V + 'Sakurada_Fumiriya.vrm'], ['madjin/vrm-samples', V + 'Sendagaya_Shino.vrm'],
  ['madjin/vrm-samples', V + 'Vita.vrm'], ['madjin/vrm-samples', V + 'Vivi.vrm'], ['madjin/vrm-samples', V + 'Victoria_Rubin.vrm'],
  ['pixiv/three-vrm', 'packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm'],
];
mkdirSync(OUT, { recursive: true });
let bad = 0;
for (const [repo, path] of FILES) {
  const buf = execFileSync('gh', ['api', `repos/${repo}/contents/${path}`, '-H', 'Accept: application/vnd.github.raw'], { maxBuffer: 1 << 29 });
  const m = vrmMeta(buf), ok = licenceOk(m);
  console.log(`${ok ? 'OK     ' : 'REFUSED'} ${basename(path)} (${(buf.length / 1e6).toFixed(1)} MB) ${licenceLabel(m)} title=${m.title || m.name || '-'} author=${m.author || m.authors || '-'}`);
  if (ok) writeFileSync(new URL(basename(path), OUT), buf); else bad++;
}
process.exit(bad ? 1 : 0);
