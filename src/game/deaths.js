// "Ways I Died": the slapstick death log. Pure; storage is passed in and every read is validated.
export const CAUSES = {
  sea: 'Tried to befriend the sea. The sea won.',
  cliff: 'Argued with a cliff. The cliff did not blink.',
  ground: 'Landed with great enthusiasm and no plan.',
  fire: 'Hugged something warm. It was lava.',
  cart: 'Drove the Colonel\'s cart. The cart had opinions.',
};
export const KEY = 'isle.deaths';
export const TITLE = 'You died successfully.', ASK = 'Wanna try again?';

export function load(store) {
  const out = {};
  try {
    const j = JSON.parse(store.getItem(KEY) || '{}');
    for (const k in CAUSES) { const n = j[k]; if (Number.isInteger(n) && n > 0 && n < 1e6) out[k] = n; }
  } catch { /* unavailable or corrupt: start a fresh log */ }
  return out;
}

// Adds one death. Unknown causes count as 'ground'. Returns the new log.
export function record(store, cause) {
  const log = load(store), k = cause in CAUSES ? cause : 'ground';
  log[k] = (log[k] || 0) + 1;
  try { store.setItem(KEY, JSON.stringify(log)); } catch { /* storage full or blocked: the death still happened */ }
  return log;
}

// A crash inside the volcano crater is always the lava, whatever the vehicle hit.
export const refine = (cause, x, z, volcano, r = 12) => (Math.hypot(x - volcano.x, z - volcano.z) < r ? 'fire' : cause);
export const total = (log) => Object.values(log).reduce((a, b) => a + b, 0);
