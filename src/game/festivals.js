// Festival Fields: one festival per in-game day, cycling through the list. Names and looks are the isle's own; the mood is warm and kind.
// Each entry: colours (hex) for the drifting confetti, motion ('fall' | 'rise' | 'drift'), and the verb for the shared splash game.
export const FESTIVALS = [
  { id: 'colour', name: 'Colour Day', blurb: 'Throw bright powder at friends, and only friends who laughed first.', colors: ['#ff4d8d', '#ffd23f', '#3ec1d3', '#7bd957', '#a66cff'], motion: 'fall', verb: 'Toss colour' },
  { id: 'lantern', name: 'Lantern Night', blurb: 'Paper lanterns rise over the harbour. Make a wish for someone else.', colors: ['#ffb347', '#ff7a59', '#ffe08a'], motion: 'rise', verb: 'Launch lantern' },
  { id: 'bazaar', name: 'Moon Bazaar', blurb: 'Stalls, spices and string lights until the stars come out.', colors: ['#ffd36b', '#9be3b0', '#ffb3a0', '#c9b6ff'], motion: 'drift', verb: 'Toss coin' },
  { id: 'newyear', name: 'New Year Fair', blurb: 'Fresh starts, painted faces and a very long parade.', colors: ['#e63946', '#fff7ea', '#2a9d8f', '#f4a261'], motion: 'fall', verb: 'Cheer' },
  { id: 'splash', name: 'Splash Days', blurb: 'Buckets, bowls and good-natured soakings. Towels at the gate.', colors: ['#7fd8ff', '#bdeeff', '#ffffff'], motion: 'fall', verb: 'Splash' },
  { id: 'blossom', name: 'Blossom Picnic', blurb: 'Pink petals, a blanket and nowhere to be.', colors: ['#ffc2d6', '#ffe0ea', '#ffffff'], motion: 'fall', verb: 'Catch petal' },
  { id: 'winter', name: 'Winter Market', blurb: 'Hot cocoa, wool hats and very small snowmen.', colors: ['#ffffff', '#d6ecff', '#fff3c4'], motion: 'fall', verb: 'Throw snowball' },
];
export const ROUND_SECS = 20, KEY = 'isle.splash';

// Which festival is on? hours = total in-game hours (24 per day). override = id from ?fest=. Returns null for an unknown override.
export function current(hours, override) {
  if (override) return FESTIVALS.find((f) => f.id === override) || null;
  return FESTIVALS[((Math.floor(hours / 24) % FESTIVALS.length) + FESTIVALS.length) % FESTIVALS.length];
}

// Shared splash game: tap the button as often as you can in ROUND_SECS. Pure state; time is advanced by tick().
export const newRound = () => ({ t: 0, score: 0, on: false, done: false });
export const start = (r) => ({ ...newRound(), on: true });
export const tap = (r) => (r.on ? { ...r, score: r.score + 1 } : r);
export const tick = (r, dt) => (r.on ? (r.t + dt >= ROUND_SECS ? { ...r, t: ROUND_SECS, on: false, done: true } : { ...r, t: r.t + dt }) : r);

export function best(store) { try { const n = Number(store.getItem(KEY)); return Number.isInteger(n) && n > 0 && n < 1e6 ? n : 0; } catch { return 0; } }
export function saveBest(store, score) { const b = best(store); if (score > b) { try { store.setItem(KEY, String(score)); } catch { /* blocked */ } return true; } return false; }
