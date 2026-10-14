import { defineConfig } from 'vite';
// base './' lets the same build run at a site root (Cloudflare, GitHub Pages) or in a sub-folder.
export default defineConfig({ base: './', build: { chunkSizeWarningLimit: 1500 } });
