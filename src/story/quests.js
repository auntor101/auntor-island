// Pure quest engine: data-driven quests, one active at a time, a small saved state. No DOM, no three.
// quest: { id, title, giver (npc id), needs?: stars, reward: { stars, title? }, steps: [{ type, target, count?, text, ... }] }
// step types -> event that advances them: talk<-talked, goto<-arrived, collect<-collected, ring-course<-rings, answer<-answered, pet<-petted, wait-night<-night, time<-stayed.
// An array target (or 'any' for talk) means "each of these once, any order"; the need defaults to the array length.
// events: { t: 'talked'|'arrived'|'collected'|'answered'|'stayed'|'rings'|'petted'|'night', id?, n?, secs?, night? }
import { QUESTS } from './questdata.js';

export const KEY = 'isle.quests.v1', TYPES = { talk: 'talked', goto: 'arrived', collect: 'collected', 'ring-course': 'rings', answer: 'answered', pet: 'petted', 'wait-night': 'night', time: 'stayed' };
const RE_ID = /^[\w.:-]{1,40}$/;

export const newState = () => ({ done: [], stars: 0, cur: null });
export const needOf = (s) => (s.count ?? (Array.isArray(s.target) ? s.target.length : 1));
const find = (quests, id) => quests.find((q) => q.id === id);

// Whatever came out of storage is untrusted: keep only known ids, sane numbers.
export function sanitizeState(raw, quests = QUESTS) {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}, s = newState();
  s.done = [...new Set(Array.isArray(o.done) ? o.done.filter((d) => typeof d === 'string' && find(quests, d)) : [])];
  s.stars = Math.min(999, s.done.reduce((a, d) => a + find(quests, d).reward.stars, 0)); // stars are derived, never trusted
  const c = o.cur, q = c && typeof c.id === 'string' && find(quests, c.id);
  if (q && !s.done.includes(q.id) && Number.isInteger(c.step) && c.step >= 0 && c.step < q.steps.length) {
    s.cur = { id: q.id, step: c.step, n: Number.isFinite(c.n) ? Math.max(0, Math.min(1e4, c.n)) : 0, seen: Array.isArray(c.seen) ? c.seen.filter((x) => typeof x === 'string' && RE_ID.test(x)).slice(0, 20) : [] };
  }
  return s;
}
export function load(storage = globalThis.localStorage, quests = QUESTS) {
  try { return sanitizeState(JSON.parse(storage.getItem(KEY)), quests); } catch { return newState(); }
}
export function save(state, storage = globalThis.localStorage) {
  try { storage.setItem(KEY, JSON.stringify(state)); } catch { /* blocked or full: the game still works */ }
}

export const isOpen = (state, q) => !state.done.includes(q.id) && state.stars >= (q.needs || 0) && (!q.after || state.done.includes(q.after));
// Quests this person could hand out right now (none while another quest is running).
export const offers = (state, giver, quests = QUESTS) => state.cur ? [] : quests.filter((q) => q.giver === giver && isOpen(state, q));

export function startQuest(state, id, quests = QUESTS) {
  const q = find(quests, id);
  if (!q || state.cur || !isOpen(state, q)) return state;
  return { ...state, cur: { id, step: 0, n: 0, seen: [] } };
}

export function abandon(state) { return { ...state, cur: null }; }

// -> { state, advanced, stepDone, completed (quest id or null) }
export function progress(state, ev, quests = QUESTS) {
  const none = { state, advanced: false, stepDone: false, completed: null }, c = state.cur, q = c && find(quests, c.id), s = q && q.steps[c.step];
  if (!s || TYPES[s.type] !== ev.t) return none;
  let { n, seen } = c;
  if (s.type === 'time') {
    if ((s.night && !ev.night) || (s.target && ev.id !== s.target)) return none;
    n += Math.max(0, ev.secs || 0);
  } else if (s.type === 'ring-course' || s.type === 'pet') n += Math.max(0, ev.n ?? 1);
  else if (s.type === 'wait-night') n += 1;
  else {
    const list = Array.isArray(s.target), any = s.target === 'any';
    if (any ? ev.id === q.giver : list ? !s.target.includes(ev.id) : s.target && ev.id !== s.target) return none;
    if ((list || any) && seen.includes(ev.id)) return none;
    if (list || any) seen = [...seen, ev.id];
    n += 1;
  }
  const next = { ...c, n, seen };
  if (n < needOf(s)) return { state: { ...state, cur: next }, advanced: true, stepDone: false, completed: null };
  if (c.step + 1 < q.steps.length) return { state: { ...state, cur: { id: q.id, step: c.step + 1, n: 0, seen: [] } }, advanced: true, stepDone: true, completed: null };
  return { state: { done: [...state.done, q.id], stars: state.stars + q.reward.stars, cur: null }, advanced: true, stepDone: true, completed: q.id };
}

// -> { quest, step, n, need, text } for the tracker chip, or null.
export function currentObjective(state, quests = QUESTS) {
  const c = state.cur, q = c && find(quests, c.id), s = q && q.steps[c.step];
  return s ? { quest: q, step: s, n: Math.floor(c.n), need: needOf(s), text: s.text, seen: c.seen } : null;
}

// Where the compass points. where(id) -> {x,z}|null for npcs, landmarks and village anchors; from: player {x,z} (nearest of several).
export function compassTarget(state, where, from, quests = QUESTS) {
  const o = currentObjective(state, quests);
  if (!o) return null;
  const s = o.step, ids = Array.isArray(s.target) ? s.target.filter((t) => !o.seen.includes(t)) : [s.target];
  let best = null, bd = 1e9;
  for (const id of ids) {
    const p = id && where(id); if (!p) continue;
    const d = from ? Math.hypot(p.x - from.x, p.z - from.z) : 0;
    if (d < bd) { bd = d; best = { x: p.x, z: p.z, label: o.text }; }
  }
  if (!best && (s.at || s.line)) { const p = where(s.at || s.line[0]); if (p) best = { x: p.x, z: p.z, label: o.text }; }
  if (!best && s.type === 'ring-course') { const p = where('rings'); if (p) best = { x: p.x, z: p.z, label: o.text }; }
  return best;
}

// Where collectables of a step sit: count dry spots, seeded so a reload puts them in the same places. at: place id, r metres round it, or line: [a, b] evenly spaced.
export function itemSpots(step, where, heightAt, isWet, seed = 1) {
  const n = needOf(step), out = [];
  let r = seed * 9301 + 49297;
  const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  if (step.line) {
    const a = where(step.line[0]), b = where(step.line[1]);
    if (!a || !b) return out;
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; out.push(dry(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, heightAt, isWet)); }
    return out;
  }
  const c = where(step.at);
  if (!c) return out;
  for (let i = 0; i < n; i++) {
    let p = null;
    for (let k = 0; k < 30 && !p; k++) { const a = rnd() * 6.283, d = 3 + rnd() * (step.r || 8), x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d; if (!isWet(x, z) && heightAt(x, z) > 0.4) p = { x, z }; }
    out.push(p || dry(c.x, c.z, heightAt, isWet));
  }
  return out;
}
const dry = (x, z, heightAt, isWet) => { for (let d = 0; d < 30; d += 1.5) for (let a = 0; a < 6.3; a += 0.8) { const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d; if (!isWet(px, pz) && heightAt(px, pz) > 0.4) return { x: px, z: pz }; } return { x, z }; };

export const isDusk = (h) => { h = ((h % 24) + 24) % 24; return h >= 17 || h < 5; }; // fireflies and lanterns come out from late afternoon until deep night
export const isNight = (h) => { h = ((h % 24) + 24) % 24; return h >= 20 || h < 5; };
