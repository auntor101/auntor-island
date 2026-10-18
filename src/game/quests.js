// Runs the quests in the world: talks (via the npcs hook), arrivals, collectables, timers, compass, HUD, companion remarks, saving.
// createQuests({ scene, hud, npcs, landmarks, village, life, audio, map: () => map|null, heightAt, isWet, env: () => ({ state, hours }) }) -> { update(dt), api }
import { InstancedMesh, OctahedronGeometry, CylinderGeometry, MeshBasicMaterial, Matrix4, Color, Vector3, Quaternion } from 'three';
import { QUESTS, CARD, COMP } from '../story/questdata.js';
import { newState, load, save, startQuest, progress, currentObjective, compassTarget, offers, itemSpots, isDusk, isNight, needOf, isOpen } from '../story/quests.js';
import { fill } from '../story/dialogue.js';
import { createQuestUi } from '../ui/quests.js';

const KIND = { firefly: '#fff27a', lantern: '#ff9a3c', ladle: '#ff6a3d', blanket: '#ff8fb0', crystal: '#7fe0ff' };
const ARRIVE_R = 14, TIME_R = 7, PICK_R = 1.7, RING_NEAR = 3.5;
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function createQuests({ scene, hud, npcs, landmarks, village, life, audio, map, heightAt, isWet, env }) {
  let s = load(localStorage), name = 'Traveler', inside = new Set(), spotsFor = '', spots = [], rings = new Set(), stayT = 0, cpT = 0, bubT = 0, busy = false, lastTarget = '', t = 0, lastDusk = null;
  const ui = createQuestUi(hud, { onReset() { s = newState(); save(s, localStorage); spotsFor = ''; refresh(); } });
  const info = Object.fromEntries(landmarks.info.map((i) => [i.id, i]));

  const where = (id) => { const n = npcs.npcs.find((q) => q.def.id === id); return n ? { x: n.x, z: n.z } : info[id] || village.anchors[id] || null; };
  const comp = (when) => { const k = env().comp ?? life.getCompanion?.(); if (COMP[k]) ui.bubble(pick(COMP[k][when])); };
  const stepOf = () => currentObjective(s);

  // collectables: one instanced gem plus one light column per item, seeded positions, only the ones still missing
  const MAX = 8, gemGeo = new OctahedronGeometry(0.4, 0), colGeo = new CylinderGeometry(0.1, 0.1, 6, 6, 1, true).translate(0, 3.5, 0);
  const gems = new InstancedMesh(gemGeo, new MeshBasicMaterial({ toneMapped: false }), MAX), cols = new InstancedMesh(colGeo, new MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false, fog: false }), MAX);
  for (const m of [gems, cols]) { m.frustumCulled = false; m.count = 0; scene.add(m); }
  const M = new Matrix4(), Q = new Quaternion(), V = new Vector3(), S1 = new Vector3(), C = new Color();

  function refresh() {
    const o = stepOf();
    ui.setTracker(o && { text: o.text + (o.need > 1 ? ` ${o.n}/${o.need}` : '') + (o.step.when && !isDusk(env().hours) ? ' (after sunset)' : ''), sub: o.quest.title }, s.stars);
    const rows = QUESTS.map((q) => ({ text: q.title + (s.cur?.id === q.id ? '' : s.done.includes(q.id) ? '' : isOpen(s, q) ? ` (ask ${npcs.npcs.find((n) => n.def.id === q.giver)?.def.name})` : ` (${q.needs} stars)`), state: s.done.includes(q.id) ? 'done' : s.cur?.id === q.id ? 'now' : isOpen(s, q) ? 'open' : 'locked' }));
    ui.setList(rows, s.done.includes('globe') ? { text: 'Show secret word', fn: () => ui.card(CARD) } : null);
    lastDusk = isDusk(env().hours); aim();
  }
  function aim() {
    const ct = compassTarget(s, where, env().state), key = ct ? ct.x + ',' + ct.z : '';
    if (key !== lastTarget) { lastTarget = key; map()?.setTarget(ct ? ct.x : null, ct?.z, ct?.label); }
  }

  function emit(ev) {
    const before = stepOf(), r = progress(s, ev);
    if (!r.advanced) return r;
    s = r.state; save(s, localStorage); refresh();
    if (r.completed) {
      const q = QUESTS.find((x) => x.id === r.completed);
      ui.toast(q.title, q.reward.title ? `Title: ${q.reward.title}` : q.reward.stars ? `+${q.reward.stars} star${q.reward.stars > 1 ? 's' : ''}` : '');
      audio.sfx('star'); comp('done'); spotsFor = '';
    } else if (r.stepDone) { audio.sfx('note-pop'); comp('step'); }
    r.before = before; return r;
  }

  // ---- the npcs hook: return true when we spoke
  const wordsFor = (say, id) => (say == null ? [] : typeof say === 'string' ? [say] : Array.isArray(say) ? say : [].concat(say[id] ?? say['*'] ?? []));
  const sayAll = async (dlg, who, lines) => { for (const l of lines) if ((await dlg.say(who, fill(l, name), null)) < 0) return false; return true; };
  async function onTalk(id, dlg, who, nm) {
    name = nm || name; const o = stepOf();
    if (o?.step.type === 'talk') {
      const r = emit({ t: 'talked', id });
      if (r.advanced) {
        const lines = wordsFor(o.step.say, id);
        if (lines.length) { await sayAll(dlg, who, lines); if (o.step.card) ui.card(CARD); return true; }
        return false;
      }
    } else emit({ t: 'talked', id });
    if (!s.cur) {
      const q = offers(s, id)[0];
      if (!q) return false;
      if (!(await sayAll(dlg, who, q.offer.slice(0, -1)))) return true;
      const k = await dlg.say(who, fill(q.offer.at(-1), name), ['I am in', 'Not now']);
      if (k === 0) { s = startQuest(s, q.id); save(s, localStorage); refresh(); await dlg.say(who, q.accept, null); comp('start'); }
      return true;
    }
    if (QUESTS.find((q) => q.id === s.cur.id).giver === id) { await dlg.say(who, QUESTS.find((q) => q.id === s.cur.id).hint, null); return true; }
    return false;
  }
  const mark = (id) => {
    const o = stepOf();
    if (o) return o.step.type === 'talk' && (Array.isArray(o.step.target) ? o.step.target.includes(id) && !o.seen.includes(id) : o.step.target === id);
    return offers(s, id).length > 0;
  };
  Object.assign(npcs.hooks, { talk: onTalk, mark });

  // an answer step asks its question when you reach the place
  async function ask(place, q) {
    busy = true; const who = { name: 'Tom\'s notes', color: '#9fd4ea' };
    for (;;) {
      const k = await npcs.ui.say(who, q.q, q.opts);
      if (k < 0) break;
      if (k === q.right) { await npcs.ui.say(who, 'Correct. Scribbling that down.', null, { auto: 1200 }); npcs.ui.close(); emit({ t: 'answered', id: place }); break; }
      await npcs.ui.say(who, 'Not quite. Try again.', null, { auto: 900 });
    }
    busy = false;
  }
  async function arrive(place) {
    const o = stepOf();
    if (!o) return;
    if (o.step.type === 'answer' && o.step.qs?.[place] && !o.seen.includes(place)) return ask(place, o.step.qs[place]);
    const r = emit({ t: 'arrived', id: place });
    if (r.advanced && o.step.type === 'goto' && o.step.target === place && o.step.arrive) { busy = true; await sayAll(npcs.ui, { name: 'You', color: '#d4c4f5' }, o.step.arrive); npcs.ui.close(); busy = false; }
  }

  function placeItems(o) {
    const key = o?.quest.id + ':' + s.cur?.step;
    if (key === spotsFor) return; spotsFor = key; spots = [];
    gems.count = cols.count = 0;
    if (o?.step.type !== 'collect') return;
    spots = itemSpots(o.step, where, heightAt, isWet, o.quest.id.length * 7 + s.cur.step, (x, z) => !village.keepOut(x, z, 1)).slice(o.n); // those already picked up stay picked up
    const col = new Color(KIND[o.step.target] || '#ffffff');
    spots.forEach((p, i) => { gems.setColorAt(i, col); cols.setColorAt(i, col); });
    gems.count = cols.count = spots.length;
    if (gems.instanceColor) { gems.instanceColor.needsUpdate = true; cols.instanceColor.needsUpdate = true; }
  }

  function update(dt) {
    const e = env(), st = e.state; t += dt;
    if (!st) return;
    const o = stepOf(), night = isNight(e.hours);
    placeItems(o);
    // collectables bob and glow; dusk-only ones stay hidden until the light fades
    const show = o?.step.type === 'collect' && (!o.step.when || isDusk(e.hours));
    gems.visible = cols.visible = show;
    if (show) {
      for (let i = 0; i < spots.length; i++) {
        const p = spots[i], y = heightAt(p.x, p.z) + 0.9 + Math.sin(t * 2 + i) * 0.15;
        gems.setMatrixAt(i, M.compose(V.set(p.x, y, p.z), Q.setFromAxisAngle(V.set(0, 1, 0), t * 1.5 + i), S1.setScalar(1)));
        V.set(p.x, y - 0.9, p.z); cols.setMatrixAt(i, M.compose(V, Q.identity(), S1.setScalar(1)));
      }
      gems.instanceMatrix.needsUpdate = cols.instanceMatrix.needsUpdate = true;
      for (let i = spots.length - 1; i >= 0; i--) if (Math.hypot(spots[i].x - st.x, spots[i].z - st.z) < PICK_R) {
        spots.splice(i, 1);
        audio.sfx('note-pop'); emit({ t: 'collected', id: o.step.target });
        placeKeep(spots.slice(), o); break;
      }
    }
    if (busy) return;
    // arrivals (edge triggered) at landmarks
    for (const i of landmarks.info) {
      const d = Math.hypot(i.x - st.x, i.z - st.z), was = inside.has(i.id);
      if (d < ARRIVE_R && !was) { inside.add(i.id); arrive(i.id); if (t - bubT > 45 && !stepOf()) { bubT = t; comp('land'); } }
      else if (d > ARRIVE_R + 6 && was) inside.delete(i.id);
    }
    // time spent in a place (springs, arena at night), counted in whole seconds
    const c = stepOf();
    if (c?.step.type === 'time' && info[c.step.target] && Math.hypot(info[c.step.target].x - st.x, info[c.step.target].z - st.z) < TIME_R + (c.step.target === 'arena' ? 3 : 0)) {
      if ((stayT += dt) >= 1) { emit({ t: 'stayed', id: c.step.target, secs: stayT, night }); stayT = 0; }
    } else stayT = 0;
    if (c?.step.type === 'wait-night' && night) emit({ t: 'night' });
    if (c?.step.type === 'ring-course') landmarks.rings.forEach((r, i) => { if (!rings.has(i) && Math.hypot(r.x - st.x, r.z - st.z) < RING_NEAR) { rings.add(i); emit({ t: 'rings', n: 1 }); } }); // on foot for now; flying will report ringsPassed
    else rings.clear();
    if ((cpT -= dt) <= 0) { cpT = 0.5; if (isDusk(e.hours) !== lastDusk) refresh(); else aim(); }
  }
  // after a pickup the remaining items keep their slots
  function placeKeep(keep, o) {
    const col = new Color(KIND[o.step.target] || '#ffffff');
    keep.forEach((p, i) => { gems.setColorAt(i, col); cols.setColorAt(i, col); });
    gems.count = cols.count = keep.length; spots = keep;
    if (gems.instanceColor) { gems.instanceColor.needsUpdate = cols.instanceColor.needsUpdate = true; }
  }

  // petting counts toward the Colonel's inspection
  const pet0 = life.pet; life.pet = (...a) => { const r = pet0.apply(life, a); if (r) emit({ t: 'petted', n: 1 }); return r; };

  setTimeout(refresh, 0); // main.js declares state and the clock after this runs
  const api = { get state() { return s; }, get spots() { return spots; }, emit, start: (id) => { s = startQuest(s, id); save(s, localStorage); spotsFor = ''; refresh(); }, card: () => ui.card(CARD), ui, set: (n) => { s = n; refresh(); } };
  return { update, api };
}
