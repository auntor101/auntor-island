// The island's people: placement, models (3 VRM loads shared by 19 people), distant stand-ins, name tags, '!' markers, Talk button, tap to talk.
// Budget: one instanced stand-in mesh + one marker Points + at most FULL_MAX full models and TAGS_MAX tags drawn at a time.
import { CanvasTexture, Color, Group, InstancedMesh, Matrix4, MeshLambertMaterial, Points, PointsMaterial, BufferGeometry, Float32BufferAttribute, Quaternion, Raycaster, Sphere, Sprite, SpriteMaterial, Vector2, Vector3, Euler } from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { loadCharacter, ROSTER } from '../../play/roster.js';
import { LANDMARKS } from '../island.js';
import { load as loadProfile, sanitizeName } from '../../profile.js';
import { createDialogue } from '../../ui/dialogue.js';
import { createStore, createConversation, pickBanter } from '../../story/dialogue.js';
import { CAST, SHARED, NEAR_IDS } from '../../story/cast.js';
import { DEFS, BASES } from './defs.js';
import { planNpcs, NPC_R } from './place.js';
import { makeProps, propMaterial, standInGeometry } from './props.js';

const FULL_MAX = 2, FULL_R = 14, DETAIL_R = 8, STAND_R = 48, TAGS_MAX = 3, TAG_R = 10, LOOK_R = 8, TALK_R = 2.5, TAP_R = 6, LEAVE_R = 7;
const FACE = /FaceBrow|FaceMouth|EyeIris|EyeHighlight|EyeWhite|FaceEyelash|FaceEyeline|EyeExtra/; // eye and mouth parts: hidden beyond DETAIL_R
const KINDS = [[/HAIR/, 'hair'], [/Tops_/, 'top'], [/Bottoms_/, 'bottom'], [/Shoes_/, 'shoe'], [/AccessoryNeck/, 'top']];
const COMP_SFX = { dragon: 'dragon-chirp', dog: 'bark', cat: 'purr' };
const CSS = `.talk{position:absolute;right:calc(50% + 8px);bottom:calc(28px + env(safe-area-inset-bottom));min-width:84px;min-height:52px;margin:0;padding:0 16px;border:3px solid #2a1f3d;border-radius:26px;background:#ff7a59;color:#2a1f3d;font:800 16px 'Nunito',system-ui,sans-serif;box-shadow:0 3px 0 #2a1f3d;touch-action:manipulation}.talk:active{background:#fff7ea}.talk[hidden]{display:none}`;

// Recolour a cloned model: hair, top, bottom and shoes get their own material copies in the NPC's colours (flat for hair and top).
function tint(root, look) {
  const parts = { face: [], outline: [] };
  root.traverse((o) => {
    if (!o.isMesh) return;
    const list = [].concat(o.material), out = list.map((m) => {
      const c = m.clone(), k = KINDS.find(([re]) => re.test(m.name)), col = k && look[k[1]];
      if (c.isOutline) parts.outline.push(c); else if (FACE.test(m.name)) parts.face.push(c);
      if (!k) return c;
      c.color?.set(col); c.shadeColorFactor?.set(col).multiplyScalar(0.62);
      if (k[1] === 'hair' || k[1] === 'top') { c.map = null; c.shadeMultiplyTexture = null; }
      return c;
    });
    o.material = Array.isArray(o.material) ? out : out[0];
  });
  return parts;
}

function makeTag(name, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d'); g.fillStyle = '#fff7ea'; g.strokeStyle = '#2a1f3d'; g.lineWidth = 5;
  g.beginPath(); g.roundRect(4, 6, 248, 52, 24); g.fill(); g.stroke();
  g.fillStyle = color; g.beginPath(); g.arc(30, 32, 10, 0, 7); g.fill(); g.stroke();
  let px = 28; g.font = `700 ${px}px Fraunces, Georgia, serif`;
  while (g.measureText(name).width > 180 && px > 14) g.font = `700 ${--px}px Fraunces, Georgia, serif`;
  g.fillStyle = '#2a1f3d'; g.textBaseline = 'middle'; g.fillText(name, 52, 34);
  const s = new Sprite(new SpriteMaterial({ map: new CanvasTexture(c), transparent: true, depthWrite: false, fog: false, toneMapped: false }));
  s.scale.set(1.5, 0.375, 1); s.renderOrder = 5;
  return s;
}

function makeMarkerTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); g.fillStyle = '#ff7a59'; g.strokeStyle = '#2a1f3d'; g.lineWidth = 5;
  g.beginPath(); g.arc(32, 32, 26, 0, 7); g.fill(); g.stroke();
  g.fillStyle = '#2a1f3d'; g.font = '800 40px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 32, 35);
  return new CanvasTexture(c);
}

export function createNpcs(scene, village, { heightAt, isWet, camera, audio, env }) {
  const plan = planNpcs(DEFS, village, heightAt, isWet);
  const npcs = plan.map((p) => ({ ...p, h: p.def.h, group: null, yawNow: p.yaw, phase: Math.random() * 6, dist: 1e9, full: false, tag: null }));
  for (const n of npcs) village.colliders.push({ kind: 'circle', x: n.x, z: n.z, r: NPC_R, type: 'npc' });
  const k0 = village.keepOut; // trees, bushes and animals stay a metre clear of people
  village.keepOut = (x, z, r = 0) => k0(x, z, r) || npcs.some((n) => Math.hypot(n.x - x, n.z - z) < 1.2 + r);

  // distant stand-ins: every person is one instance of one mesh (top colour per instance)
  const stand = new InstancedMesh(standInGeometry(), new MeshLambertMaterial({ vertexColors: true }), npcs.length);
  stand.frustumCulled = false; stand.count = npcs.length;
  npcs.forEach((n, i) => stand.setColorAt(i, new Color(n.def.look.top)));
  scene.add(stand);

  // '!' markers: one Points object for everyone with news
  const mk = new Points(new BufferGeometry().setAttribute('position', new Float32BufferAttribute(new Float32Array(npcs.length * 3), 3)),
    new PointsMaterial({ map: makeMarkerTexture(), size: 30, sizeAttenuation: false, toneMapped: false, fog: false, transparent: true, alphaTest: 0.3, depthWrite: false }));
  mk.frustumCulled = false; mk.renderOrder = 6; scene.add(mk);

  const store = createStore(localStorage), hudEl = document.getElementById('hud'), cv = document.getElementById('gl');
  const ui = createDialogue(hudEl), style = document.createElement('style'); style.textContent = CSS;
  const btn = document.createElement('button'); btn.className = 'talk'; btn.type = 'button'; btn.textContent = 'Talk'; btn.hidden = true;
  hudEl.append(style, btn);

  const M = new Matrix4(), Q = new Quaternion(), V = new Vector3(), S = new Vector3(), E = new Euler();
  let t = 0, selT = 0, started = false, near = null, talking = null, lines = 0, loadMs = 0;

  async function loadModels() {
    const t0 = performance.now();
    for (const base of BASES) {
      let tpl; try { tpl = await loadCharacter(base); } catch (e) { console.error('npc base failed', base, e); continue; }
      for (const n of npcs.filter((q) => q.def.base === base)) {
        const g = new Group(), body = clone(tpl.root), k = n.def.h / ROSTER[base].height;
        body.scale.set(k * (n.def.w || 1), k, k * (n.def.w || 1)); n.parts = tint(body, n.def.look);
        g.add(body); const pr = makeProps(n.def); if (pr) g.add(pr);
        g.position.set(n.x, n.y, n.z); g.rotation.y = n.yawNow; g.visible = false; n.group = g; n.body = body; scene.add(g);
      }
      tpl.root.removeFromParent();
    }
    loadMs = Math.round(performance.now() - t0);
  }

  const nameNow = () => { const q = new URLSearchParams(location.search).get('name'); return q ? sanitizeName(q) : loadProfile(localStorage).name; };
  const nearLandmark = (p) => { for (const [k, v] of Object.entries(LANDMARKS)) if (NEAR_IDS[k] && Math.hypot(v.x - p.x, v.z - p.z) < 60) return NEAR_IDS[k]; return null; };

  async function talk(n) {
    if (talking || !env().state) return;
    talking = n; const e = env(), id = n.def.id, who = { name: n.def.name, color: n.def.tag }, c = CAST[id] || {};
    const first = !store.met(id), met = store.visit(id);
    try {
      if (first && c.first) {
        const cv2 = createConversation(c.first, 'start', store, nameNow());
        while (!cv2.done) { const k = await ui.say(who, cv2.node.text, cv2.node.choices?.map((x) => x.text)); if (k < 0) break; cv2.choose(k); }
      } else {
        const ctx = { hours: e.hours, snow: e.snow, near: nearLandmark(e.state), name: nameNow(), comp: e.comp, met };
        const l = pickBanter(id, [...(c.banter || []), ...SHARED], ctx, store);
        if (l) await ui.say(who, l.text, null);
      }
    } finally {
      if (talking === n) { ui.close(); talking = null; }
    }
    if (++lines % 3 === 0 && COMP_SFX[e.comp]) setTimeout(() => audio.sfx(COMP_SFX[e.comp], { x: e.state.x, z: e.state.z, gain: 0.8 }), 500);
  }

  btn.addEventListener('pointerdown', (ev) => { ev.preventDefault(); if (near) talk(near); });
  const ray = new Raycaster(), ndc = new Vector2(), sph = new Sphere(), hit = new Vector3();
  let d0 = null;
  cv.addEventListener('pointerdown', (ev) => { d0 = { x: ev.clientX, y: ev.clientY, t: performance.now() }; });
  cv.addEventListener('pointerup', (ev) => {
    const st = env().state;
    if (!st || !d0 || talking || performance.now() - d0.t > 350 || Math.hypot(ev.clientX - d0.x, ev.clientY - d0.y) > 10) return;
    ndc.set((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
    let best = null, bd = 1e9;
    for (const n of npcs) {
      if (Math.hypot(n.x - st.x, n.z - st.z) > TAP_R) continue;
      sph.center.set(n.x, n.y + n.h * 0.5, n.z); sph.radius = Math.max(0.7, n.h * 0.42);
      if (ray.ray.intersectSphere(sph, hit)) { const d = hit.distanceTo(ray.ray.origin); if (d < bd) { bd = d; best = n; } }
    }
    if (best) talk(best);
  });

  function select(px, pz) {
    for (const n of npcs) n.dist = Math.hypot(n.x - px, n.z - pz);
    const order = npcs.filter((n) => n.group && n.dist < FULL_R).sort((a, b) => a.dist - b.dist).slice(0, FULL_MAX);
    npcs.forEach((n, i) => {
      n.full = order.includes(n);
      if (n.group) {
        n.group.visible = n.full;
        const detail = n.dist < DETAIL_R; // face parts near, outline only when this is the only full model
        for (const m of n.parts.face) m.visible = detail;
        for (const m of n.parts.outline) m.visible = order.length < 2;
      }
      const on = !n.full && n.dist < STAND_R;
      V.set(n.x, n.y, n.z); E.set(0, n.yawNow, 0); Q.setFromEuler(E); S.set(on ? n.def.h / 1.75 * (n.def.w || 1) : 0, on ? n.def.h / 1.75 : 0, on ? n.def.h / 1.75 * (n.def.w || 1) : 0);
      stand.setMatrixAt(i, M.compose(V, Q, S));
    });
    stand.instanceMatrix.needsUpdate = true;
    const tagged = npcs.filter((n) => n.dist < TAG_R).sort((a, b) => a.dist - b.dist).slice(0, TAGS_MAX);
    for (const n of npcs) {
      const on = tagged.includes(n);
      if (on && !n.tag) { n.tag = makeTag(n.def.name, n.def.tag); scene.add(n.tag); }
      if (n.tag) { n.tag.visible = on; n.tag.position.set(n.x, n.y + n.h + 0.5, n.z); const w = Math.min(1.5, Math.max(0.6, n.dist * 0.2)); n.tag.scale.set(w, w / 4, 1); }
    }
  }

  function update(dt) {
    const e = env(), st = e.state; t += dt;
    if (st && !started) { started = true; setTimeout(loadModels, 400); }
    const p = st || camera.position;
    if ((selT -= dt) <= 0) { selT = 0.15; select(p.x, p.z); }
    // idle sway, face the player when close (the yaw moves the group, the stand-in follows on the next select)
    for (const n of npcs) {
      if (!n.full) continue;
      const want = st && n.dist < LOOK_R ? Math.atan2(st.x - n.x, st.z - n.z) : n.yaw;
      let d = want - n.yawNow; d = Math.atan2(Math.sin(d), Math.cos(d)); n.yawNow += d * Math.min(1, dt * 3);
      n.group.rotation.y = n.yawNow; n.body.rotation.z = Math.sin(t * 1.3 + n.phase) * 0.012; n.body.rotation.x = Math.sin(t * 0.9 + n.phase) * 0.008;
    }
    // '!' markers over people you have not met yet
    const pos = mk.geometry.attributes.position;
    npcs.forEach((n, i) => { const on = !store.met(n.def.id) && n.dist < 40 && talking !== n; pos.setXYZ(i, n.x, on ? n.y + n.h + 0.95 + Math.sin(t * 3 + n.phase) * 0.08 : -999, n.z); });
    pos.needsUpdate = true;
    if (!st) return;
    // Talk button: the nearest person within 2.5 m, unless a wild animal (Pet) is closer
    let nb = null, bd = TALK_R;
    for (const n of npcs) if (n.dist < bd) { bd = n.dist; nb = n; }
    const an = nb && e.life?.nearest(st, Math.min(bd, 1.6)); if (an && an !== e.life._comp()) nb = null; // a wild animal nearer than the person gets the Pet button; your own companion never blocks Talk
    near = nb; btn.hidden = !nb || ui.open;
    if (talking && talking.dist > LEAVE_R) ui.close();
  }

  const api = { update, npcs, stand, markers: mk, store, ui, talk: (id) => talk(npcs.find((n) => n.def.id === id)), get loadMs() { return loadMs; }, get full() { return npcs.filter((n) => n.full).length; } };
  globalThis.__npcs = api;
  return api;
}
