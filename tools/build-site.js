// Kept so the existing Cloudflare build command (node tools/build-site.js) still works: it builds the app with Vite into dist/.
import { spawnSync } from 'node:child_process';
const r = spawnSync('npx', ['vite', 'build'], { stdio: 'inherit', shell: true });
process.exit(r.status ?? 1);
