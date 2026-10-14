// Life: cats, dogs and a companion (baby dragon, dog or cat). Pure behaviour is in animal.js; this file loads the models and draws them.
// Every load fails soft: a missing model means no animals of that kind, never a crash.
import { Group, InstancedMesh, PlaneGeometry, MeshBasicMaterial, CanvasTexture, Sprite, SpriteMaterial, AnimationMixer, LoopOnce, Box3, Vector3, Quaternion, Matrix4, Sphere, BufferAttribute, DynamicDrawUsage } from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { toonMat } from '../world/common/toon.js';
import { LANDMARKS } from '../world/island.js';
import { CATS, DOGS, DRAGONS, capBright, makeAnimal, stepAnimal, petAnimal, makeCompanion, stepCompanion } from './animal.js';

const BASE = import.meta.env?.BASE_URL ?? '/';
const KEY = 'auntor.life';
const FAR = 40, MIXER_DIST = 26, HOME = 70, CAT_LEN = 0.85, DOG_LEN = 0.95, DRAGON_K = 0.8 / 390, DRAGON_REST = 0.42; // FBX units are cm-ish; the dragon is 390 units nose to tail
const FACE = -Math.PI / 2; // the cat and dog models face +x, our heading faces +z
const UP = new Vector3(0, 1, 0), FWD = new Vector3(0, 0, 1);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const turn = (cur, goal, k) => cur + wrap(goal - cur) * Math.min(1, k);

// ---- saved state (companion choice, dragon colourway, pets per breed) ----
function readSave() {
  const s = { comp: 'dragon', dragon: 0, pets: {} };
  try {
    const j = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (['dragon', 'dog', 'cat'].includes(j.comp)) s.comp = j.comp;
    if (Number.isInteger(j.dragon) && j.dragon >= 0 && j.dragon < DRAGONS.length) s.dragon = j.dragon;
    if (j.pets && typeof j.pets === 'object') for (const b of [...CATS, ...DOGS, ...DRAGONS]) { const n = j.pets[b.name]; if (Number.isInteger(n) && n > 0 && n < 1e6) s.pets[b.name] = n; }
  } catch { /* no storage: nothing persists */ }
  return s;
}
const writeSave = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ } };

// ---- model preparation (ported from the old game: one draw call per material instead of ~72) ----
// Assumes non-interleaved attributes, no morph targets and non-indexed geometry (true for FBXLoader output).
function regroup(geo, nMats) {
  if (geo.index || geo.groups.length <= nMats) return;
  const old = geo.groups.slice().sort((a, b) => a.start - b.start), mats = [];
  old.forEach((g) => (mats[g.materialIndex] ||= []).push(g));
  for (const name of Object.keys(geo.attributes)) {
    const at = geo.attributes[name], n = at.itemSize, src = at.array, out = new src.constructor(src.length);
    let w = 0;
    mats.forEach((list) => list?.forEach((g) => { const a = g.start * n, b = (g.start + g.count) * n; out.set(src.subarray(a, b), w); w += b - a; }));
    geo.setAttribute(name, new BufferAttribute(out, n, at.normalized));
  }
  geo.clearGroups();
  let start = 0;
  mats.forEach((list, mi) => { if (!list) return; const count = list.reduce((t, g) => t + g.count, 0); geo.addGroup(start, count, mi); start += count; });
}
async function loadModel(name) {
  try {
    const src = await new FBXLoader().loadAsync(`${BASE}world/animals/${name}.fbx`);
    src.traverse((m) => { if (m.isMesh) regroup(m.geometry, Array.isArray(m.material) ? m.material.length : 1); });
    src.updateMatrixWorld(true);
    const size = new Box3().setFromObject(src).getSize(new Vector3());
    src.userData.size = Math.max(size.x, size.z, 1e-4);
    return src;
  } catch (e) { console.warn('life: model failed:', name, e?.message); return null; }
}

const matCache = new Map(); // one set of materials per breed, shared by every animal of that breed
function coatOf(kind, breed) {
  const key = kind + breed.name;
  if (!matCache.has(key)) {
    const c = (h) => capBright(h), pick = (n) => {
      n = (n || '').toLowerCase();
      if (kind === 'dragon') return c(n.includes('wing') ? breed.wing : n.includes('belly') ? breed.belly : n.includes('claw') ? '#efe3c8' : n.includes('eye') ? '#1b1220' : breed.body);
      return c(n.includes('white') ? breed.accent : n.includes('pink') ? '#e9a3a8' : breed.body);
    };
    matCache.set(key, (name) => toonMat(pick(name)));
    matCache.get(key).cache = {};
  }
  const f = matCache.get(key);
  return (m) => (f.cache[m.name] ||= f(m.name));
}

// ---- emote sprites: heart, note, zzz, exclamation, spark (drawn once on canvases) ----
const EMOTES = { heart: ['♥', '#ff6f8f'], note: ['♪', '#7a5ab0'], zzz: ['z', '#5a8fc8'], bang: ['!', '#ff7a59'], spark: ['✦', '#ffb23a'] };
function emoteMaterials() {
  const out = {};
  for (const [k, [ch, col]] of Object.entries(EMOTES)) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    g.font = '800 46px system-ui, "Segoe UI Symbol", "Apple Symbols", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = 9; g.strokeStyle = '#fff7ea'; g.strokeText(ch, 32, 34); g.fillStyle = col; g.fillText(ch, 32, 34);
    const t = new CanvasTexture(cv);
    out[k] = new SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false });
  }
  return out;
}
function blobTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(0,0,0,.5)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new CanvasTexture(cv);
}

const tmpQ = new Quaternion(), tmpM = new Matrix4(), tmpV = new Vector3();
const twist = (b, axis, ang) => { if (b) b.quaternion.premultiply(tmpQ.setFromAxisAngle(axis, ang)); }; // rotate a bone about an axis given in its parent's space
const parentAxis = (bone, world) => new Vector3().copy(world).applyQuaternion(bone.parent.getWorldQuaternion(new Quaternion()).invert()); // the world axis expressed in the bone's parent space (bind pose)

export function createLife(scene, { heightAt, isWet, zoneAt, onSfx = () => {}, isTouch = false, rand = Math.random } = {}) {
  const save = readSave();
  const root = new Group(); root.name = 'life';
  scene?.add?.(root);
  const models = {}; // Cat, Dog, Dragon (parsed FBX templates)
  let shadows = null, disposed = false, loaded = false;
  const views = [];   // population: {kind, breed, st, holder, obj, mixer, ...}
  const comps = {};   // companion views by kind, built on demand
  let compKind = save.comp, comp = makeCompanion(0, 0), compPlaced = false, clock = 0, night = false, forceNight = null, lastTap = -9, attackT = 0;
  const emotes = []; // active emotes: {sprite, owner, t, life, rise}
  const pool = [];
  let sprites = null;

  // walkable: dry, above the shoreline, not too steep, not up the mountain
  const ok = (x, z) => {
    if (isWet(x, z)) return false;
    const h = heightAt(x, z);
    if (h < 0.2 || Math.hypot(x - LANDMARKS.village.x, z - LANDMARKS.village.z) > HOME) return false;
    if (Math.hypot(heightAt(x + 0.5, z) - h, heightAt(x, z + 0.5) - h) / 0.5 > 1.1) return false;
    const zn = zoneAt(x, z);
    return zn !== 'sea' && zn !== 'glacier' && zn !== 'volcano' && zn !== 'mountain';
  };

  function dress(obj, kind, breed) {
    const mat = coatOf(kind, breed);
    obj.traverse((o) => {
      if (!o.isMesh) return;
      o.material = Array.isArray(o.material) ? o.material.map(mat) : mat(o.material);
      o.frustumCulled = false; // skinned bounds are unreliable; distance culling below handles the cost
    });
  }

  // One animal or companion body: clone, recolour, mixer with idle/walk (or flying/attack for the dragon), bones for head look and tail.
  function makeView(kind, breed) {
    const src = models[kind === 'dragon' ? 'Dragon' : kind === 'cat' ? 'Cat' : 'Dog'];
    if (!src) return null;
    const obj = SkeletonUtils.clone(src), holder = new Group();
    dress(obj, kind, breed);
    const k = kind === 'dragon' ? DRAGON_K : (kind === 'cat' ? CAT_LEN : DOG_LEN) / src.userData.size * breed.scale;
    obj.scale.setScalar(k);
    obj.updateMatrixWorld(true);
    holder.add(obj);
    const bones = {}; obj.traverse((o) => { if (o.isBone) bones[o.name] = o; });
    const v = { kind, breed, holder, obj, k, bones, mixer: new AnimationMixer(obj), look: 0, sleepK: 0, wag: 0, bounce: 0, sit: 0, hover: 0, tilt: 0, att: 0, yaw: rand() * 6.28 };
    const clip = (n) => src.animations.find((a) => a.name.toLowerCase().includes(n));
    if (kind === 'dragon') {
      v.fly = v.mixer.clipAction(clip('flying')); v.fly.play(); v.fly.time = DRAGON_REST; v.fly.timeScale = 0;
      v.attack = v.mixer.clipAction(clip('attack') || clip('hit')); v.attack.setLoop(LoopOnce, 1); v.attack.clampWhenFinished = true;
      v.faceAdd = 0;
      v.headB = [bones.Neck, bones.Head]; v.tailB = [bones.Tail2, bones.Tail3, bones.Tail4];
    } else {
      v.idle = v.mixer.clipAction(clip('idle')); v.walk = v.mixer.clipAction(clip('walk'));
      v.idle.play(); v.walk.play(); v.walk.weight = 0; v.idle.time = rand() * 1.6;
      v.faceAdd = FACE;
      v.headB = [bones.Bone003]; v.tailB = [bones.Bone005, bones.Bone006, bones.Bone007];
    }
    v.headB = v.headB.filter(Boolean); v.tailB = v.tailB.filter(Boolean);
    v.headAx = v.headB.map((b) => parentAxis(b, UP)); v.tailAx = v.tailB.map((b) => parentAxis(b, UP));
    if (kind === 'dragon') { // wing fold axes: wings swing about the body's forward axis
      v.wings = ['ShoulderL', 'ShoulderR'].map((n) => bones[n]).filter(Boolean);
      v.wingAx = v.wings.map((b) => parentAxis(b, FWD));
    }
    v.mixer.update(0);
    root.add(holder);
    holder.visible = false;
    return v;
  }

  // ---- emotes ----
  function emote(owner, type, life = 1.4) {
    if (!sprites) return;
    const s = pool.pop() || (() => { const sp = new Sprite(sprites.heart); root.add(sp); return sp; })();
    s.material = sprites[type]; s.visible = true;
    emotes.push({ sprite: s, owner, t: 0, life });
  }
  function updateEmotes(dt) {
    for (let i = emotes.length - 1; i >= 0; i--) {
      const e = emotes[i], o = e.owner;
      e.t += dt;
      const u = e.t / e.life, pop = u < 0.15 ? u / 0.15 : u > 0.7 ? (1 - u) / 0.3 : 1, size = 0.42 * (0.4 + 0.6 * Math.min(1, pop)) * Math.max(0, Math.min(1.15, pop * 1.3));
      if (u >= 1 || !o.holder.visible) { e.sprite.visible = false; pool.push(e.sprite); emotes[i] = emotes[emotes.length - 1]; emotes.pop(); continue; }
      e.sprite.position.set(o.holder.position.x, o.holder.position.y + o.top + 0.3 + u * 0.35, o.holder.position.z);
      e.sprite.scale.setScalar(Math.max(size, 0.001));
    }
  }

  // ---- placing ----
  const place = (x, z, v, y) => v.holder.position.set(x, y ?? heightAt(x, z), z);
  function spawnPopulation() {
    const nCats = isTouch ? 6 : 12, nDogs = isTouch ? 3 : 6;
    const shuffled = (l) => { const o = l.slice(); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; };
    const cats = shuffled(CATS), dogs = shuffled(DOGS), cx = LANDMARKS.village.x, cz = LANDMARKS.village.z;
    const make = (kind, breed) => {
      let x = 0, z = 0, t = 0;
      do { const a = rand() * 6.283, d = 4 + rand() * 24; x = cx + Math.cos(a) * d; z = cz + Math.sin(a) * d; t++; } while (!ok(x, z) && t < 60);
      if (!ok(x, z)) return;
      const v = makeView(kind, breed);
      if (!v) return;
      v.st = makeAnimal(kind, x, z, rand); v.top = (kind === 'cat' ? 0.45 : 0.7) * breed.scale; v.id = views.length;
      views.push(v);
    };
    if (models.Cat) for (let i = 0; i < nCats; i++) make('cat', cats[i % cats.length]);
    if (models.Dog) for (let i = 0; i < nDogs; i++) make('dog', dogs[i % dogs.length]);
  }

  function getComp(kind) {
    if (!comps[kind]) {
      const breed = kind === 'dragon' ? DRAGONS[save.dragon] : kind === 'dog' ? { ...DOGS[0], scale: 1.05 } : { ...CATS[4], scale: 1 };
      const v = makeView(kind, breed);
      if (v) { v.top = kind === 'dragon' ? 0.95 : kind === 'dog' ? 0.8 : 0.5; v.isComp = true; }
      comps[kind] = v || false;
    }
    return comps[kind] || null;
  }

  // ---- load ----
  const ready = (async () => {
    const [cat, dog, dragon] = await Promise.all(['Cat', 'Dog', 'Dragon'].map((n) => loadModel(n)));
    if (disposed) return;
    if (cat) models.Cat = cat; if (dog) models.Dog = dog; if (dragon) models.Dragon = dragon;
    try { sprites = emoteMaterials(); } catch { sprites = null; } // no DOM: no popups
    try {
      const n = 24, geo = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
      shadows = new InstancedMesh(geo, new MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), n);
      shadows.instanceMatrix.setUsage(DynamicDrawUsage); shadows.frustumCulled = false; shadows.count = 0; root.add(shadows);
    } catch { shadows = null; }
    spawnPopulation();
    loaded = true;
  })();

  // ---- per-frame ----
  const ctx = { px: 0, pz: 0, night: false };
  let shadowN = 0;
  const addShadow = (x, y, z, s) => { if (!shadows || shadowN >= shadows.instanceMatrix.count) return; tmpM.makeScale(s, 1, s).setPosition(x, y + 0.04, z); shadows.setMatrixAt(shadowN++, tmpM); };

  function blend(v, dt, speed, walkRef) {
    const w = Math.min(1, speed / 0.3), cur = v.walk.weight;
    v.walk.weight = cur + (w - cur) * Math.min(1, dt * 7); v.idle.weight = 1 - v.walk.weight;
    v.walk.timeScale = speed > 0.1 ? Math.min(2.4, Math.max(0.6, speed / walkRef)) : 1;
    v.idle.timeScale = 1 - 0.8 * v.sleepK;
  }
  // head look + tail sway after the mixer has written the pose
  function bonesPose(v, dt, look, wag, wagRate) {
    v.look += (look - v.look) * Math.min(1, dt * 8);
    for (let i = 0; i < v.headB.length; i++) twist(v.headB[i], v.headAx[i], Math.max(-0.9, Math.min(0.9, v.look)) / v.headB.length);
    v.wag += (wag - v.wag) * Math.min(1, dt * 6);
    if (v.wag > 0.01) for (let i = 0; i < v.tailB.length; i++) twist(v.tailB[i], v.tailAx[i], Math.sin(clock * wagRate + i * 0.7) * 0.5 * v.wag);
  }

  function drawAnimal(v, dt) {
    const s = v.st, h = v.holder;
    v.sleepK += ((s.mode === 'sleep' ? 1 : 0) - v.sleepK) * Math.min(1, dt * 2.5);
    const dogSit = v.kind === 'dog' && s.mode === 'greet';
    v.sit += ((dogSit ? 1 : 0) - v.sit) * Math.min(1, dt * 5);
    blend(v, dt, s.speed, v.kind === 'cat' ? 0.9 : 1.1);
    v.mixer.update(dt);
    const happy = s.mode === 'greet' || s.mode === 'follow' || s.mode === 'notice';
    bonesPose(v, dt, s.look, v.kind === 'dog' ? (dogSit ? 1 : happy ? 0.6 : 0) : (s.mode === 'notice' || s.mode === 'greet' ? 0.5 : 0), v.kind === 'dog' ? 14 : 3);
    v.yaw = turn(v.yaw, s.heading, dt * 8);
    const y = heightAt(s.x, s.z);
    h.position.set(s.x, y, s.z);
    h.rotation.y = v.yaw + v.faceAdd;
    // asleep: loaf low and wide, breathing; sitting dog: hindquarters down, chest up
    const breathe = 1 + Math.sin(clock * 2 + v.id) * 0.02 * v.sleepK;
    v.obj.scale.set(v.k * (1 + 0.08 * v.sleepK), v.k * (1 - 0.45 * v.sleepK) * breathe, v.k * (1 + 0.08 * v.sleepK));
    v.obj.rotation.z = 0.5 * v.sit;
    v.obj.position.y = 0.06 * v.sit - 0.02 * v.sleepK;
    addShadow(s.x, y, s.z, (v.kind === 'cat' ? 0.9 : 1.2) * v.breed.scale);
  }

  function drawCompanion(v, dt, p, camPos) {
    const c = comp, h = v.holder;
    const y = heightAt(c.x, c.z);
    if (c.moving) v.faceCam = 0;
    // idle: face the player's way and glance around; a tap turns it to the camera
    let goal = c.heading;
    if (!c.moving) goal = Math.atan2(p.x - c.x, p.z - c.z) + c.look * 0.4;
    if (v.faceCam > 0) { v.faceCam -= dt; goal = Math.atan2(camPos.x - c.x, camPos.z - c.z); }
    v.yaw = turn(v.yaw, goal, dt * (c.moving ? 9 : 5));
    v.bounce = Math.max(0, v.bounce - dt * 1.6);
    const hop = Math.sin(Math.min(1, v.bounce) * Math.PI) * 0.18 * (v.bounce > 0 ? 1 : 0);
    if (v.kind === 'dragon') {
      const tgt = c.moving || v.bounce > 0.3 ? 1 : 0;
      v.hover += (tgt - v.hover) * Math.min(1, dt * (tgt ? 3 : 2.2));
      const flap = v.hover > 0.04;
      v.fly.timeScale = flap ? 0.6 + 1.1 * v.hover : 0;
      if (!flap && Math.abs(v.fly.time - DRAGON_REST) > 0.01) v.fly.time += (DRAGON_REST - v.fly.time) * 0.2 + Math.sign(DRAGON_REST - v.fly.time) * 0.0005;
      attackT = Math.max(0, attackT - dt);
      v.att += ((attackT > 0 ? 1 : 0) - v.att) * Math.min(1, dt * 12);
      v.attack.weight = v.att; v.fly.weight = 1 - v.att;
      v.mixer.update(dt);
      // fold the wings when settled
      for (let i = 0; i < v.wings.length; i++) twist(v.wings[i], v.wingAx[i], (i ? -1 : 1) * 0.5 * (1 - v.hover));
      bonesPose(v, dt, c.moving ? 0 : c.look, 0.3 + (c.moving ? 0.4 : 0.6 * (1 + Math.sin(clock * 5) * 0.3)), 5);
      v.tilt += ((c.moving ? Math.min(0.4, c.speed * 0.07) : 0) - v.tilt) * Math.min(1, dt * 4);
      const bob = v.hover * (0.85 + Math.sin(clock * 3.1) * 0.16 + Math.sin(clock * 1.7) * 0.05);
      h.position.set(c.x, y + bob * 0.9 + hop, c.z);
      v.obj.rotation.x = v.tilt;
      addShadow(c.x, y, c.z, 0.9 * (1 - 0.35 * v.hover));
    } else {
      blend(v, dt, c.speed, v.kind === 'cat' ? 0.9 : 1.1);
      v.mixer.update(dt);
      bonesPose(v, dt, c.moving ? 0 : c.look, v.kind === 'dog' ? (c.moving ? 0.8 : 1) : 0.3, v.kind === 'dog' ? 14 : 3);
      h.position.set(c.x, y + hop, c.z);
      addShadow(c.x, y, c.z, (v.kind === 'cat' ? 0.9 : 1.2) * v.breed.scale);
    }
    h.rotation.y = v.yaw + v.faceAdd;
  }

  function sfx(name, x, z, camPos) { onSfx(name, { x, z, gain: Math.max(0.05, 1 - Math.hypot(x - camPos.x, z - camPos.z) / 30) }); }

  function update(dt, p, camera, palette) {
    if (disposed || !p || !camera) return;
    dt = Math.min(dt, 0.05); clock += dt;
    const cp = camera.position;
    night = forceNight ?? ((palette?.stars ?? 0) > 0.5);
    ctx.px = p.x; ctx.pz = p.z; ctx.night = night;
    shadowN = 0;
    for (const v of views) {
      const s = v.st, d = Math.hypot(s.x - cp.x, s.z - cp.z), vis = d < FAR;
      if (v.holder.visible !== vis) v.holder.visible = vis;
      if (!vis) continue; // frozen while far
      stepAnimal(s, dt, rand, ok, ctx);
      if (s.ev === 'notice') { emote(v, 'bang', 1.0); if (v.kind === 'dog' && rand() < 0.3) sfx('whine', s.x, s.z, cp); }
      else if (s.ev === 'meow' || s.ev === 'bark') { sfx(s.ev, s.x, s.z, cp); emote(v, 'note', 1.6); if (s.ev === 'bark' && rand() < 0.5) sfx('pant', s.x, s.z, cp); }
      if (night && v.sleepK > 0.6 && d < 14 && (v.zT = (v.zT || 0) - dt) < 0) { v.zT = 2.8 + rand(); emote(v, 'zzz', 2.2); }
      if (d < MIXER_DIST || v.sleepK > 0) { drawAnimal(v, dt); v.posed = true; } else { v.holder.position.set(s.x, heightAt(s.x, s.z), s.z); addShadow(s.x, v.holder.position.y, s.z, 1); }
    }
    const cv = loaded ? getComp(compKind) : null;
    for (const k in comps) if (comps[k]) comps[k].holder.visible = comps[k] === cv;
    if (cv) {
      if (!compPlaced) { comp.x = p.x + 1.5; comp.z = p.z + 2; compPlaced = true; }
      stepCompanion(comp, dt, p, ok, rand);
      if (comp.teleported) cv.yaw = Math.atan2(p.x - comp.x, p.z - comp.z);
      if (cv.kind === 'dragon') { // chirp on settling, flap sound on take-off
        const mv = comp.moving;
        if (mv !== cv.wasMoving) { if (mv) sfx('dragon-flap', comp.x, comp.z, cp); else if (cv.wasMoving) { sfx('dragon-chirp', comp.x, comp.z, cp); emote(cv, 'note', 1.4); } cv.wasMoving = mv; }
      }
      drawCompanion(cv, dt, p, cp);
    }
    updateEmotes(dt);
    if (shadows) { shadows.count = shadowN; shadows.instanceMatrix.needsUpdate = true; }
  }

  // ---- taps, petting ----
  const sphere = new Sphere();
  function pick(ray) {
    let best = null, bd = 1e9;
    const test = (v, cx, cy, cz, r) => { sphere.center.set(cx, cy, cz); sphere.radius = r; if (v.holder.visible && ray.intersectSphere(sphere, tmpV)) { const d = tmpV.distanceTo(ray.origin); if (d < bd) { bd = d; best = v; } } };
    for (const v of views) test(v, v.st.x, v.holder.position.y + 0.35, v.st.z, 0.45 + 0.35 * v.breed.scale); // generous: a fingertip is fat
    const cv = comps[compKind];
    if (cv) test(cv, comp.x, cv.holder.position.y + 0.4, comp.z, 0.8);
    return best;
  }
  function nearest(p, maxD = 3) {
    let best = null, bd = maxD;
    for (const v of views) { const d = Math.hypot(v.st.x - p.x, v.st.z - p.z); if (v.holder.visible && d < bd) { bd = d; best = v; } }
    const cv = comps[compKind];
    if (cv && Math.hypot(comp.x - p.x, comp.z - p.z) < bd) best = cv;
    return best;
  }
  let lastPlayer = { x: 0, z: 0 };
  function pet(target) {
    const v = target || nearest(lastPlayer);
    if (!v || !v.holder.visible) return null;
    const camPos = { x: v.holder.position.x, z: v.holder.position.z };
    emote(v, 'heart', 1.8);
    onSfx('pet', { x: camPos.x, z: camPos.z, gain: 1 });
    if (v.isComp) {
      v.bounce = 1; v.faceCam = 2.5;
      onSfx(v.kind === 'dragon' ? 'dragon-chirp' : v.kind === 'cat' ? 'purr' : 'bark', { x: camPos.x, z: camPos.z, gain: 1 });
      if (v.kind === 'dragon' && clock - lastTap < 0.9 && models.Dragon) { // double tap: a tiny spark
        attackT = 0.9; v.attack.reset().play(); emote(v, 'spark', 1.2);
      }
      lastTap = clock;
    } else onSfx(petAnimal(v.st), { x: camPos.x, z: camPos.z, gain: 1 });
    save.pets[v.breed.name] = (save.pets[v.breed.name] || 0) + 1;
    writeSave(save);
    return v;
  }
  function befriended() {
    const list = [...CATS, ...DOGS, ...DRAGONS].filter((b) => save.pets[b.name]).map((b) => ({ name: b.name, kind: b.kind || 'dragon', count: save.pets[b.name] }));
    return { total: list.reduce((t, b) => t + b.count, 0), breeds: list };
  }
  function setCompanion(kind) {
    if (!['dragon', 'dog', 'cat'].includes(kind) || kind === compKind) return;
    const prev = comps[compKind];
    compKind = kind; save.comp = kind; writeSave(save);
    if (prev) prev.holder.visible = false;
    compPlaced = false; comp = makeCompanion(comp.x, comp.z); comp.teleported = false;
    // the new companion appears beside the player on the next update
  }

  const api = {
    update(dt, p, camera, palette) { lastPlayer = p || lastPlayer; update(dt, p, camera, palette); },
    setCompanion, getCompanion: () => compKind, pet, pick, nearest: (p) => nearest(p || lastPlayer), befriended,
    setNightMode(on) { forceNight = on == null ? null : !!on; },
    setDragonColour(i) { if (Number.isInteger(i) && i >= 0 && i < DRAGONS.length) { save.dragon = i; writeSave(save); if (comps.dragon) { root.remove(comps.dragon.holder); comps.dragon = undefined; } } },
    ready, dispose() { disposed = true; scene?.remove?.(root); for (const c of matCache.values()) Object.values(c.cache || {}).forEach((m) => m.dispose()); matCache.clear(); },
    // debugging and demo
    get stats() { return { animals: views.length, visible: views.filter((v) => v.holder.visible).length, night, comp: { x: comp.x, z: comp.z, moving: comp.moving, speed: comp.speed } }; },
    get animals() { return views.map((v) => ({ kind: v.kind, breed: v.breed.name, x: v.st.x, z: v.st.z, mode: v.st.mode, visible: v.holder.visible, sleepK: v.sleepK })); },
    get _views() { return views; }, _comp: () => comps[compKind],
  };
  return api;
}
