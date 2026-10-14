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

  // ---- runtime (needs THREE; only runs in the browser) ----
  const live = [];                     // {state, obj, mixer, idle, walk, breed, met}
  const FACE = -Math.PI / 2;           // radians added to heading; the model faces +x, the game heading faces +z
  const BODY_LEN = 0.85;               // world length of a scale-1 cat
  const NEAR_NOTE = 2.5, ACTIVE_DIST = 30;

  // Scale a hex colour so its brightest channel is at most max (bloom threshold is 0.9).
  function capBright(hex, max) {
    max = max || 0.85;
    const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255), top = Math.max(c[0], c[1], c[2]);
    const k = top > max ? max / top : 1;
    return '#' + c.map(v => ('0' + Math.round(v * k * 255).toString(16)).slice(-2)).join('');
  }

  function coat(obj, breed) {
    const GRAD = root.LI.gfx.GRAD;
    const body = capBright(breed.body), accent = capBright(breed.accent);
    obj.traverse(o => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const out = mats.map(m => {
        const n = (m.name || '').toLowerCase();
        const color = n.includes('white') ? accent : n.includes('pink') ? '#e9a3a8' : body;
        return new THREE.MeshToonMaterial({ color, gradientMap: GRAD, skinning: !!o.isSkinnedMesh });
      });
      o.material = Array.isArray(o.material) ? out : out[0];
      o.frustumCulled = false;
    });
  }

  // Assumes non-interleaved attributes, no morph targets and non-indexed geometry (true for FBXLoader output).
  // The FBX interleaves its 3 materials in ~72 tiny groups (one draw call each); reorder triangles so each material is one group.
  function regroup(geo) {
    if (geo.index || geo.groups.length <= 3) return;
    const old = geo.groups.slice().sort((a, b) => a.start - b.start), mats = [];
    old.forEach(g => (mats[g.materialIndex] = mats[g.materialIndex] || []).push(g));
    for (const name of Object.keys(geo.attributes)) {
      const at = geo.attributes[name], n = at.itemSize, src = at.array, out = new src.constructor(src.length);
      let w = 0;
      mats.forEach(list => list && list.forEach(g => { const a = g.start * n, b = (g.start + g.count) * n; out.set(src.subarray(a, b), w); w += b - a; }));
      geo.setAttribute(name, new THREE.BufferAttribute(out, n, at.normalized));
    }
    geo.clearGroups();
    let start = 0;
    mats.forEach((list, mi) => { if (!list) return; const count = list.reduce((t, g) => t + g.count, 0); geo.addGroup(start, count, mi); start += count; });
  }

  async function spawn(o) {
    const A = root.LI.assets;
    if (live.length > 0) return live.length;
    try {
      if (!A || !A.fbx || !root.LI.gfx) return 0;
      const src = await A.fbx('animals', 'Cat');
      if (!src || !THREE.SkeletonUtils) return 0;
      const clip = n => src.animations.find(a => a.name.toLowerCase().includes(n));
      const idle = clip('idle'), walk = clip('walk');
      if (!idle || !walk) return 0;
      src.traverse(m => { if (m.isMesh) regroup(m.geometry); });
      const box = new THREE.Box3().setFromObject(src);
      const size = box.getSize(new THREE.Vector3());
      const k = BODY_LEN / Math.max(size.x, size.z, 0.0001);
      const rand = root.LI.gfx.rand;
      const group = new THREE.Group();
      const made = [];
      const order = BREEDS.slice();
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      for (let i = 0; i < o.count; i++) {
        const breed = order[i % order.length];
        let x = 0, z = 0, tries = 0;
        do { const a = rand() * Math.PI * 2, d = 3 + rand() * 12; x = o.near[0] + Math.cos(a) * d; z = o.near[1] + Math.sin(a) * d; tries++; } while (!o.ok(x, z) && tries < 40);
        if (!o.ok(x, z)) continue;
        const obj = THREE.SkeletonUtils.clone(src);
        coat(obj, breed);
        const holder = new THREE.Group();
        obj.scale.setScalar(k * breed.scale);
        holder.add(obj);
        const mixer = new THREE.AnimationMixer(obj);
        const aIdle = mixer.clipAction(idle), aWalk = mixer.clipAction(walk);
        aIdle.play(); aWalk.play(); aWalk.weight = 0;
        made.push({ state: makeState(x, z, rand), holder, obj, mixer, aIdle, aWalk, breed, met: false });
        group.add(holder);
      }
      if (!made.length) return 0;
      o.scene.add(group);
      made.forEach(c => { live.push(c); c.o = o; c.holder.position.set(c.state.x, o.h(c.state.x, c.state.z), c.state.z); });
      return made.length;
    } catch (e) {
      console.warn('cats failed:', e && e.message);
      return 0;
    }
  }

  function update(dt, cam, player) {
    if (!live.length) return;
    const g = root.LI.gfx;
    for (const c of live) {
      const o = c.o, s = c.state;
      const near = Math.hypot(c.holder.position.x - cam.x, c.holder.position.z - cam.z) < ACTIVE_DIST;
      c.holder.visible = near;
      if (near) {
        stepCat(s, dt, g.rand, o.ok);
        const target = s.mode === 'walk' ? 1 : 0;
        c.aWalk.weight += (target - c.aWalk.weight) * Math.min(1, dt * 6);
        c.aIdle.weight = 1 - c.aWalk.weight;
        c.mixer.update(dt);
        c.holder.position.set(s.x, o.h(s.x, s.z), s.z);
        let d = s.heading + FACE - c.holder.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
        c.holder.rotation.y += d * Math.min(1, dt * 8);
      }
      if (!c.met && Math.hypot(s.x - player.x, s.z - player.z) < NEAR_NOTE && g.canNote && g.canNote()) { c.met = true; g.note('A ' + c.breed.name + '!'); }
    }
  }

  const api = { BREEDS, makeState, stepCat, capBright, spawn, update };
  const LI = root.LI = root.LI || {};
  LI.cats = Object.assign(LI.cats || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
