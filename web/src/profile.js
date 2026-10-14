// Player profile: character choice and name. Pure data, no DOM. Name rules ported from the old game's js/profile.js.
const KEY = 'isle.profile', MAXLEN = 12, FALLBACK = 'Traveler';
export const CHARS = ['man', 'woman', 'elf', 'wizard'];
// shortcut: tiny whole-word blocklist that misses creative spellings, extend it if abuse shows up
const BLOCK = ['fuck', 'fucking', 'fucker', 'fuckface', 'shit', 'shitty', 'cunt', 'nigg', 'nigga', 'nigger', 'rape', 'rapist', 'nazi'];

function blocked(s) {
  const words = s.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  if (words.some((w) => BLOCK.includes(w))) return true;
  return words.length >= 3 && words.every((w) => w.length === 1) && BLOCK.includes(words.join('')); // "F u c k"
}

export function sanitizeName(raw) {
  let s = typeof raw === 'string' ? raw : '';
  s = s.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029\u202a-\u202e\u2060-\u2069\ufeff<>]/g, '').replace(/\s+/g, ' ').trim();
  s = Array.from(s).slice(0, MAXLEN).join('').trim();
  return !s || blocked(s) ? FALLBACK : s;
}

export function normalize(p) {
  p = p && typeof p === 'object' ? p : {};
  return { char: CHARS.includes(p.char) ? p.char : 'man', name: sanitizeName(p.name) };
}
export function load(storage) {
  try { return normalize(JSON.parse(storage.getItem(KEY))); } catch { return normalize(null); }
}
export function save(storage, p) {
  try { storage.setItem(KEY, JSON.stringify(normalize(p))); } catch { /* storage blocked or full: the game still works */ }
}
