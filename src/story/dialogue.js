// Pure dialogue logic: conversation graphs, a small saved story state, and banter picking. No DOM, no three.
// Graph node: { id, who, text, choices?: [{ text, next, set? }], next?, once?, set? }. {name} in text is replaced by the player name.
const KEY = 'isle.story.v1', RE_ID = /^[\w.:-]{1,40}$/, KEEP = 4;

export const fill = (text, name, pet) => String(text).replace(/\{name\}/g, () => name || 'Traveler').replace(/\{pet\}/g, () => pet || 'friend');

// Whatever came out of storage is untrusted: keep only well-formed flags, met ids and counts.
export function sanitizeState(raw) {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const flags = {}, visits = {};
  for (const [k, v] of Object.entries(o.flags && typeof o.flags === 'object' ? o.flags : {}).slice(0, 300)) {
    if (RE_ID.test(k) && (typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && v.length <= 40))) flags[k] = v;
  }
  for (const [k, v] of Object.entries(o.visits && typeof o.visits === 'object' ? o.visits : {}).slice(0, 100)) {
    if (RE_ID.test(k) && Number.isInteger(v) && v > 0 && v < 1e6) visits[k] = v;
  }
  const met = Array.isArray(o.met) ? [...new Set(o.met.filter((m) => typeof m === 'string' && RE_ID.test(m)))].slice(0, 100) : [];
  return { flags, met, visits };
}

export function createStore(storage = null, key = KEY) {
  let s = sanitizeState(null);
  try { if (storage) s = sanitizeState(JSON.parse(storage.getItem(key))); } catch { /* blocked or corrupt storage: start fresh */ }
  const recent = {}; // npc id -> last banter line ids, not saved
  const save = () => { try { storage?.setItem(key, JSON.stringify(s)); } catch { /* storage full or blocked: the game still works */ } };
  return {
    state: s, recent, save,
    flag: (k) => s.flags[k],
    set(k, v) { if (RE_ID.test(k)) { s.flags[k] = v; save(); } },
    met: (id) => s.met.includes(id),
    visits: (id) => s.visits[id] || 0,
    // one more conversation with this person; returns the new count
    visit(id) { if (!RE_ID.test(id)) return 0; if (!s.met.includes(id)) s.met.push(id); s.visits[id] = (s.visits[id] || 0) + 1; save(); return s.visits[id]; },
  };
}

// Walks a graph one node at a time. node: the current node (text already filled), choose(i) moves on, done when the graph ends.
export function createConversation(graph, startId, store, name) {
  const byId = new Map(graph.map((n) => [n.id, n]));
  const c = { node: null, done: false };
  const go = (id) => {
    let n = byId.get(id), guard = 0;
    while (n && n.once && store.flag('seen:' + n.id) && guard++ < 20) n = byId.get(n.next); // a seen once-node is skipped
    if (!n) { c.node = null; c.done = true; return c; }
    if (n.once) store.set('seen:' + n.id, true);
    if (n.set) for (const [k, v] of Object.entries(n.set)) store.set(k, v);
    c.node = { ...n, text: fill(n.text, name), choices: n.choices?.map((ch) => ({ ...ch, text: fill(ch.text, name) })) };
    return c;
  };
  c.choose = (i = 0) => {
    const n = c.node;
    if (!n) return c;
    const ch = n.choices?.[i];
    if (n.choices && !ch) return c; // a bad index changes nothing
    if (ch?.set) for (const [k, v] of Object.entries(ch.set)) store.set(k, v);
    return go(ch ? ch.next : n.next);
  };
  return go(startId);
}

// Banter line: { t, c: category, w?: weight, h?: [from, to] hours (wraps midnight), snow?: true|false, near?: landmark id, comp?: 'dragon'|'dog'|'cat', min?: times met at least, max?: at most }.
// ctx: { hours, snow (0..1), near (landmark id or null), name, comp, met (times met) }.
export function lineWeight(l, ctx) {
  let w = l.w ?? 1;
  if (l.c === 'comp' && !ctx.comp) return 0; // companion lines need a companion
  if (l.h) { const [a, b] = l.h, h = ((ctx.hours % 24) + 24) % 24; if (!(a <= b ? h >= a && h < b : h >= a || h < b)) return 0; w *= 3; }
  if (l.snow != null) { if ((ctx.snow > 0.3) !== l.snow) return 0; if (l.snow) w *= 4; }
  if (l.near != null) { if (ctx.near !== l.near) return 0; w *= 6; }
  if (l.comp != null) { if (ctx.comp !== l.comp) return 0; w *= 3; }
  if (l.min != null && (ctx.met || 0) < l.min) return 0;
  if (l.max != null && (ctx.met || 0) > l.max) return 0;
  if (l.c === 'greet') w *= ctx.met > 1 ? 1 : 0.4; // name greetings get stale
  return w;
}

// Returns { id, text, c } or null; never one of the last 4 lines for that npc (unless the pool is that small).
export function pickBanter(npcId, pool, ctx, store, rand = Math.random) {
  const hist = store.recent[npcId] || (store.recent[npcId] = []);
  const all = pool.map((l, i) => [i, lineWeight(l, ctx)]).filter(([, w]) => w > 0);
  let cands = all.filter(([i]) => !hist.includes(i));
  if (!cands.length) cands = all;
  if (!cands.length) return null;
  let r = rand() * cands.reduce((a, [, w]) => a + w, 0), pick = cands[cands.length - 1][0];
  for (const [i, w] of cands) { r -= w; if (r < 0) { pick = i; break; } }
  hist.push(pick); if (hist.length > KEEP) hist.shift();
  return { id: pick, text: fill(pool[pick].t, ctx.name, ctx.comp), c: pool[pick].c };
}
