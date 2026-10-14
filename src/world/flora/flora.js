// Biome flora: trees, bushes, ferns, rocks, flowers, 3D grass, reeds, beach props and falling petals.
// Placement is pure (placement.js); this file streams 32 m chunks, pools instances per species and LOD (one draw call each)
// and drives the shaders. createFlora(scene, { heightAt, zoneAt, isWet, getSeason? }) -> { update, setKeepOut, setSnow, flush, dispose, stats, ready }.
import {
  Mesh, InstancedBufferGeometry, InstancedInterleavedBuffer, InterleavedBufferAttribute, DynamicDrawUsage, Points, BufferGeometry, BufferAttribute,
  Frustum, Matrix4, PerspectiveCamera, Box3, Vector3, TextureLoader, SRGBColorSpace, ClampToEdgeWrapping,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { woods, LANDMARKS } from '../island.js';
import { chunksAround, chunkKey, CHUNK } from '../chunks.js';
import { chunkField, placeChunk, seasonAt, STRIDE } from './placement.js';
import { TIER_RANGE } from './species.js';
import { createUniforms, foliageMaterial, grassMaterial, flowerMaterial, petalMaterial } from './materials.js';
import { grassClump, reedClump, flower, treeFar, pineFar, deadFar, driftwood, shell } from './geometry.js';

// distance bands per species: first band whose range covers the instance wins; `thin` = [from, keep fraction, scale boost] for far trees
const LODS = {
  tree: [{ d: 20, pools: ['tree_a', 'tree_b', 'tree_c'] }, { d: 82, pools: ['tree_l1'] }, { d: 232, pools: ['tree_l2'], thin: [125, 0.6, 1.22] }],
  pine: [{ d: 26, pools: ['pine_a', 'pine_b'] }, { d: 85, pools: ['pine_l1'] }, { d: 232, pools: ['pine_l2'], thin: [125, 0.6, 1.2] }],
  dead: [{ d: 55, pools: ['dead'] }, { d: 232, pools: ['dead_l2'] }],
  bush: [{ d: 32, pools: ['bush'] }], rock: [{ d: 120, pools: ['rock_a', 'rock_b', 'rock_c'] }],
  fern: [{ d: 34, pools: ['fern'] }], mushroom: [{ d: 30, pools: ['mushroom'] }],
  grass: [{ d: 35, pools: ['grass'] }], tall: [{ d: 36, pools: ['tall'] }], reed: [{ d: 38, pools: ['reed'] }], flower: [{ d: 34, pools: ['flower'] }],
  driftwood: [{ d: 70, pools: ['driftwood'] }], shell: [{ d: 30, pools: ['shell'] }],
};
const CAP = { tree_a: 90, tree_b: 90, tree_c: 90, tree_l1: 700, tree_l2: 1500, pine_a: 80, pine_b: 80, pine_l1: 500, pine_l2: 700, dead: 60, dead_l2: 150, bush: 450, rock_a: 150, rock_b: 150, rock_c: 150, fern: 700, mushroom: 150, grass: 9000, tall: 3500, reed: 2500, flower: 5000, driftwood: 40, shell: 300 };

class Pool {
  constructor(scene, geo, mat, cap) {
    this.cap = cap; this.n = 0; this.tris = geo.index.count / 3; this.scene = scene;
    const g = new InstancedBufferGeometry();
    g.index = geo.index;
    for (const k in geo.attributes) g.setAttribute(k, geo.attributes[k]);
    this.buf = new InstancedInterleavedBuffer(new Float32Array(cap * STRIDE), STRIDE, 1);
    this.buf.setUsage(DynamicDrawUsage);
    g.setAttribute('iA', new InterleavedBufferAttribute(this.buf, 4, 0)); g.setAttribute('iB', new InterleavedBufferAttribute(this.buf, 4, 4));
    g.instanceCount = 0;
    this.geo = g; this.base = geo;
    this.mesh = new Mesh(g, mat); this.mesh.frustumCulled = false; this.mesh.visible = false;
    scene.add(this.mesh);
  }
  add(src, o, mul) {
    if (this.n >= this.cap) return;
    const a = this.buf.array, k = this.n++ * STRIDE;
    for (let i = 0; i < STRIDE; i++) a[k + i] = src[o + i];
    a[k + 4] *= mul;
  }
  flush() {
    this.geo.instanceCount = this.n; this.mesh.visible = this.n > 0;
    this.buf.clearUpdateRanges(); this.buf.addUpdateRange(0, this.n * STRIDE); this.buf.needsUpdate = true;
  }
  dispose() { this.scene.remove(this.mesh); this.geo.dispose(); this.base.dispose(); }
}

const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const FORCE = { auto: -1, summer: 0, autumn: 1, spring: 2 };

export function createFlora(scene, { heightAt, zoneAt, isWet, getSeason, assetBase, stepsPerFrame = 2, budgetMs = 5 } = {}) {
  const base = assetBase ?? ((import.meta.env?.BASE_URL ?? '/') + 'world/flora/');
  const env = { heightAt, zoneAt, isWet, woods, landmarks: LANDMARKS, keepOut: null };
  const U = createUniforms();
  const chunks = new Map(), pools = {}, mats = {}, disposables = [];
  let snowTarget = 0, snowK = 0, dirty = true, lastScan = [1e9, 1e9], pending = true, builds = 0, buildMs = 0, buildMax = 0, cam = { x: 0, y: 0, z: 0 };
  const lastC = { x: 1e9, y: 0, z: 1e9, fx: 0, fy: 0, fz: 0 };
  let ready = false;

  // ---- procedural pools exist at once; model pools appear when their files have loaded
  mats.grass = grassMaterial(U); mats.tall = grassMaterial(U, { mul: [1.12, 1.06, 0.9], sway: 1.25 }); mats.reed = grassMaterial(U, { mul: [0.78, 0.9, 0.8], sway: 0.7 });
  mats.flower = flowerMaterial(U);
  const addPool = (name, geo, mat) => { pools[name] = new Pool(scene, geo, mat, CAP[name]); };
  addPool('grass', grassClump({ blades: 7, height: [0.3, 0.62], width: 0.055, radius: 0.26, seed: 3 }), mats.grass);
  addPool('tall', grassClump({ blades: 6, height: [0.7, 1.2], width: 0.04, radius: 0.32, lean: 0.4, seed: 8 }), mats.tall);
  addPool('reed', reedClump(), mats.reed);
  addPool('flower', flower(), mats.flower);
  mats.vcol = foliageMaterial(U, { map: null, vcol: true, sway: 0 });
  addPool('driftwood', driftwood(), mats.vcol); addPool('shell', shell(), mats.vcol);

  const petalCount = 160, pg = new BufferGeometry(), seeds = new Float32Array(petalCount * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random(); // visual only, not placement
  pg.setAttribute('position', new BufferAttribute(new Float32Array(petalCount * 3), 3)); pg.setAttribute('seed', new BufferAttribute(seeds, 4));
  const petalMat = petalMaterial(U, 55 * Math.min(2, (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1)));
  const petals = new Points(pg, petalMat); petals.frustumCulled = false; petals.renderOrder = 3; petals.visible = false; scene.add(petals);

  const loader = new GLTFLoader(), tl = new TextureLoader();
  const tex = (name) => new Promise((res) => tl.load(base + 'tex/' + name + '.webp', (t) => { t.flipY = false; t.colorSpace = SRGBColorSpace; t.anisotropy = 4; t.wrapS = t.wrapT = ClampToEdgeWrapping; res(t); }, undefined, () => { console.warn('flora: missing texture', name); res(null); }));
  const model = (name) => loader.loadAsync(base + name + '.glb').then((g) => { let geo; g.scene.traverse((o) => { if (o.isMesh && !geo) geo = o.geometry; }); return geo; }).catch((e) => { console.warn('flora: missing model', name, e?.message); return null; });
  const readyP = (async () => {
    const man = await fetch(base + 'manifest.json').then((r) => r.json()).catch(() => null);
    if (!man) return;
    const T = {}; await Promise.all(Object.keys(man.tex).map(async (k) => { T[k] = await tex(k); if (T[k]) disposables.push(T[k]); }));
    const mk = (key, opts) => { if (!mats[key] && T[opts.map]) mats[key] = foliageMaterial(U, { ...opts, map: T[opts.map] }); return mats[key]; };
    const jobs = [];
    const job = async (name, file, key, opts) => { const g = await model(file); const m = mk(key, opts); if (g && m) addPool(name, g, m); };
    const treeOpt = { map: 'tree_atlas', atlas: true, recolor: true }, pineOpt = { map: 'pine_atlas', atlas: true, sway: 0.6 };
    for (const v of ['tree_a', 'tree_b', 'tree_c']) jobs.push(job(v, v, 'tree', treeOpt));
    jobs.push(job('tree_l1', 'tree_l1', 'tree', treeOpt));
    jobs.push(job('pine_a', 'pine_a', 'pine', pineOpt), job('pine_b', 'pine_b', 'pine', pineOpt), job('pine_l1', 'pine_l1', 'pine', pineOpt));
    jobs.push(job('dead', 'dead', 'dead', { map: 'Bark_DeadTree', sway: 0 }), job('bush', 'bush', 'bush', { map: 'Leaves_TwistedTree', recolor: true, sway: 0.5 }), job('fern', 'fern', 'fern', { map: 'Leaves', recolor: true, sway: 0.3 }));
    jobs.push(job('mushroom', 'shroom', 'shroom', { map: 'Mushrooms', sway: 0 }));
    for (const r of ['rock_a', 'rock_b', 'rock_c']) jobs.push(job(r, r, 'rock', { map: 'Rocks', rock: true, sway: 0 }));
    await Promise.all(jobs);
    if (mk('tree', treeOpt)) addPool('tree_l2', treeFar(), mats.tree); // far stand-ins reuse the loaded atlas
    if (mk('pine', pineOpt)) addPool('pine_l2', pineFar(), mats.pine);
    if (mk('dead', { map: 'Bark_DeadTree', sway: 0 })) addPool('dead_l2', deadFar(), mats.dead);
    ready = true; dirty = true;
  })();

  // ---- streaming
  const entryFor = (cx, cz) => { const k = chunkKey(cx, cz); let e = chunks.get(k); if (!e) chunks.set(k, e = { cx, cz, field: null, tiers: [null, null, null], lists: [], box: null, d: 0 }); return e; };
  function step(e, tier) { // one unit of work: the lattice, or one tier of species
    const t0 = performance.now();
    if (!e.field) {
      e.field = chunkField(e.cx, e.cz, env);
      let lo = 1e9, hi = -1e9; for (const h of e.field.h) { if (h < lo) lo = h; if (h > hi) hi = h; }
      e.box = [e.cx * CHUNK, lo - 3, e.cz * CHUNK, (e.cx + 1) * CHUNK, hi + 22, (e.cz + 1) * CHUNK];
    } else {
      e.tiers[tier] = placeChunk(e.field, env, tier);
      e.lists = [];
      for (const t of e.tiers) if (t) for (const id in t) if (t[id].n) e.lists.push([id, LODS[id], t[id].data, t[id].n]);
      dirty = true;
    }
    const ms = performance.now() - t0; builds++; buildMs += ms; buildMax = Math.max(buildMax, ms);
  }
  function stream(budget, steps) {
    const want = chunksAround(cam.x, cam.z, TIER_RANGE[0] + 6);
    const keep = new Set(chunksAround(cam.x, cam.z, TIER_RANGE[0] + 40).map((c) => chunkKey(c.cx, c.cz)));
    for (const k of chunks.keys()) if (!keep.has(k)) { chunks.delete(k); dirty = true; }
    const t0 = performance.now(); let n = 0; pending = false;
    for (const { cx, cz } of want) {
      const e = entryFor(cx, cz), d = Math.hypot((cx + 0.5) * CHUNK - cam.x, (cz + 0.5) * CHUNK - cam.z);
      for (let t = 1; t < 3; t++) if (e.tiers[t] && d > TIER_RANGE[t] + 22 + 28) { e.tiers[t] = null; e.lists = []; for (const tt of e.tiers) if (tt) for (const id in tt) if (tt[id].n) e.lists.push([id, LODS[id], tt[id].data, tt[id].n]); dirty = true; }
      for (let t = 0; t < 3; t++) {
        if (t > 0 && d > TIER_RANGE[t] + 22) continue;
        if (e.tiers[t]) continue;
        pending = true;
        if (n >= steps || (n > 0 && performance.now() - t0 > budget)) continue;
        step(e, t); n++;
        if (!e.tiers[t]) step(e, t), n++; // the first call built the lattice, the second builds the tier
      }
    }
  }

  // ---- composing the pools from the chunk data (frustum culled per chunk, LOD per instance)
  const fr = new Frustum(), pm = new Matrix4(), cc = new PerspectiveCamera();
  let order = [];
  const nearest = [];
  function compose(camera) {
    let useFrustum = false;
    if (camera) {
      camera.updateMatrixWorld();
      cc.copy(camera, false); cc.fov = camera.fov + 20; cc.updateProjectionMatrix(); cc.matrixWorld.copy(camera.matrixWorld); cc.matrixWorldInverse.copy(cc.matrixWorld).invert();
      fr.setFromProjectionMatrix(pm.multiplyMatrices(cc.projectionMatrix, cc.matrixWorldInverse)); useFrustum = true;
    }
    order.length = 0; for (const e of chunks.values()) if (e.lists.length) { e.d = (e.cx * CHUNK + 16 - cam.x) ** 2 + (e.cz * CHUNK + 16 - cam.z) ** 2; order.push(e); }
    order.sort((a, b) => a.d - b.d);
    for (const k in pools) pools[k].n = 0;
    for (const e of order) {
      if (useFrustum && e.d > 14 * 14) { // chunks right under the camera are always kept
        const b = e.box; tmpBox.min.set(b[0] - 3, b[1], b[2] - 3); tmpBox.max.set(b[3] + 3, b[4], b[5] + 3);
        if (!fr.intersectsBox(tmpBox)) continue;
      }
      for (const [id, lods, data, n] of e.lists) {
        for (let i = 0; i < n; i++) {
          const o = i * STRIDE, dx = data[o] - cam.x, dz = data[o + 2] - cam.z, d2 = dx * dx + dz * dz;
          let li = 0; while (li < lods.length && d2 >= lods[li].d * lods[li].d) li++;
          if (li === lods.length) continue;
          let mul = 1;
          for (; li < lods.length; li++) {
            const L = lods[li];
            if (L.thin && d2 > L.thin[0] * L.thin[0]) { if (data[o + 5] > L.thin[1]) { li = lods.length; break; } mul = L.thin[2]; }
            const p = pools[L.pools[data[o + 7] % L.pools.length | 0]] || pools[L.pools[0]];
            if (p) { p.add(data, o, mul); break; }
          }
        }
      }
    }
    for (const k in pools) pools[k].flush();
    dirty = false; lastC.x = cam.x; lastC.z = cam.z;
  }
  const tmpBox = new Box3(), tmpV = new Vector3();

  return {
      ready: readyP,
      get uniforms() { return U; },
      update(cameraPos, playerPos, dt, pal, camera) {
        cam = cameraPos;
        U.uTime.value += dt;
        if (pal) {
          const L = pal.lightDir || pal.sunDir; U.uLightDir.value.copy(L);
          U.uSun.value.set(pal.sunColor).multiplyScalar(pal.sunIntensity ?? 1); U.uAmb.value.set(pal.ambient);
          U.uNight.value = 1 - smooth(-0.1, 0.25, (pal.sunDir || L).y);
          if (typeof pal.snow === 'number') snowTarget = pal.snow;
        }
        snowK += (snowTarget - snowK) * Math.min(1, dt * 1.5); U.uSnow.value = snowK;
        U.uForce.value = FORCE[getSeason ? getSeason() : 'auto'] ?? -1;
        if (playerPos) U.uPlayer.value.set(playerPos.x, playerPos.y, playerPos.z, 1.5); else U.uPlayer.value.set(0, -999, 0, 0.001);

        if (pending || Math.hypot(cam.x - lastScan[0], cam.z - lastScan[1]) > 4) { stream(budgetMs, stepsPerFrame); lastScan = [cam.x, cam.z]; }
        if (camera) camera.getWorldDirection(tmpV);
        const moved = Math.hypot(cam.x - lastC.x, cam.z - lastC.z) > 1.6;
        const turned = camera ? tmpV.x * lastC.fx + tmpV.y * lastC.fy + tmpV.z * lastC.fz < 0.9962 : false;
        if (dirty || moved || turned) { compose(camera); if (camera) { lastC.fx = tmpV.x; lastC.fy = tmpV.y; lastC.fz = tmpV.z; } }

        // falling petals (grove, spring belt) and leaves (autumn belt) round the camera
        const dg = Math.hypot(cam.x - LANDMARKS.grove.x, cam.z - LANDMARKS.grove.z), g = 1 - smooth(18, 55, dg);
        const season = U.uForce.value >= 0 ? U.uForce.value : seasonAt(cam.x, cam.z, 0.5, ''), belt = season === 1 ? 0.4 : season === 2 ? 0.3 : 0;
        const amount = Math.max(g * 0.9, belt) * (1 - snowK), pu = petalMat.uniforms;
        pu.uAmount.value = amount; petals.visible = amount > 0.01;
        if (g > 0.5 || season === 2) { pu.uColA.value.set('#ffc2dc'); pu.uColB.value.set('#ffffff'); } else { pu.uColA.value.set('#e8861e'); pu.uColB.value.set('#ffcf4a'); }
      },
      setKeepOut(fn) { env.keepOut = fn || null; chunks.clear(); dirty = true; pending = true; },
      setSnow(on) { snowTarget = on ? 1 : 0; },
      // Build everything in range at once (loading screens, demos, tests). Not for use per frame.
      flush(cameraPos) { cam = cameraPos; let guard = 0; do { stream(1e9, 1e9); } while (pending && guard++ < 20); },
      stats() {
        let instances = 0, calls = 0, triangles = 0; const per = {};
        for (const k in pools) { const p = pools[k]; if (p.n) { instances += p.n; calls++; triangles += p.n * p.tris; per[k] = p.n; } }
        if (petals.visible) calls++;
        return { instances, drawCalls: calls, triangles, chunks: chunks.size, pending, ready, builds, buildMsAvg: builds ? buildMs / builds : 0, buildMsMax: buildMax, pools: per };
      },
      dispose() {
        for (const k in pools) pools[k].dispose();
        scene.remove(petals); pg.dispose(); petalMat.dispose();
        for (const k in mats) mats[k].dispose();
        for (const t of disposables) t.dispose();
        chunks.clear();
      },
  };
}
