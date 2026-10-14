// Cats: ten breed looks of one animated model, wandering the island. Fails soft: without the model there are simply no cats.
(function (root) {
  'use strict';
  const BREEDS = [
    { name: 'Tabby', body: '#b98550', accent: '#f2e6d3', scale: 1 },
    { name: 'Black Cat', body: '#34303a', accent: '#34303a', scale: 1 },
    { name: 'Russian Blue', body: '#8d9bb0', accent: '#a9b6c8', scale: 1 },
    { name: 'Siamese', body: '#ecdcc3', accent: '#6a4b3c', scale: 1 },
    { name: 'Ginger', body: '#e08a3c', accent: '#f6d9b0', scale: 1 },
    { name: 'Calico', body: '#f4eee6', accent: '#d9833a', scale: 1 },
    { name: 'Tuxedo', body: '#312e39', accent: '#f4f1ec', scale: 1 },
    { name: 'Maine Coon', body: '#9a7a58', accent: '#d8c4a0', scale: 1.25 },
    { name: 'Persian', body: '#f1ebe0', accent: '#e4d9c6', scale: 1.1 },
    { name: 'Bengal', body: '#d3a04a', accent: '#f0dcae', scale: 1.05 },
  ];
  const SPEED = 0.9;

  function makeState(x, z, rand) {
    return { x, z, heading: 0, tx: x, tz: z, mode: 'idle', timer: 1 + rand() * 4 };
  }

  function pickTarget(c, rand, ok) {
    for (let i = 0; i < 8; i++) {
      const a = rand() * Math.PI * 2, d = 2 + rand() * 5;
      const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
      if (ok(x, z)) { c.tx = x; c.tz = z; return true; }
    }
    return false;
  }

  function stepCat(c, dt, rand, ok) {
    if (c.mode === 'idle') {
      c.timer -= dt;
      if (c.timer <= 0) {
        if (pickTarget(c, rand, ok)) c.mode = 'walk';
        else c.timer = 2 + rand() * 4;
      }
      return;
    }
    const dx = c.tx - c.x, dz = c.tz - c.z, d = Math.hypot(dx, dz);
    if (d < 0.2) { c.mode = 'idle'; c.timer = 2 + rand() * 5; return; }
    const step = Math.min(d, SPEED * dt), nx = c.x + dx / d * step, nz = c.z + dz / d * step;
    if (!ok(nx, nz)) { c.mode = 'idle'; c.timer = 1 + rand() * 3; return; }
    c.heading = Math.atan2(dx, dz);
    c.x = nx; c.z = nz;
  }

  const api = { BREEDS, makeState, stepCat };
  const LI = root.LI = root.LI || {};
  LI.cats = Object.assign(LI.cats || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
