// Collapsible sky panel (paper style): Time chips and a Snow toggle. State persists in localStorage (try/catch: private mode, blocked storage).
const KEY = 'isle.sky';
export const TIMES = { auto: null, dawn: 6.1, day: 12, sunset: 17.8, night: 0 }; // fixed choices pause the cycle

export function loadPrefs() {
  try { return { mode: 'auto', snow: false, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { mode: 'auto', snow: false }; }
}
const save = (p) => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage unavailable: choices just don't persist */ } };

export function createHud(host, prefs, { onMode, onSnow }) {
  const el = (tag, cls, text, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; if (parent) parent.append(e); return e; };
  const root = el('div', 'sky', '', host);
  const toggle = el('button', 'sky-toggle', 'Sky', root);
  toggle.setAttribute('aria-expanded', 'false');
  const panel = el('div', 'sky-panel', '', root);
  panel.hidden = true;
  toggle.onclick = () => { panel.hidden = !panel.hidden; toggle.setAttribute('aria-expanded', String(!panel.hidden)); };

  el('div', 'sky-h', 'Time', panel);
  const row = el('div', 'sky-row', '', panel), chips = {};
  const setMode = (m) => { prefs.mode = m; for (const k in chips) chips[k].classList.toggle('on', k === m); save(prefs); onMode(m); };
  for (const k of Object.keys(TIMES)) { chips[k] = el('button', 'chip', k[0].toUpperCase() + k.slice(1), row); chips[k].onclick = () => setMode(k); }
  el('div', 'sky-h', 'Weather', panel);
  const snow = el('button', 'chip snow', 'Snow', panel);
  const setSnow = (on) => { prefs.snow = on; snow.classList.toggle('on', on); snow.setAttribute('aria-pressed', String(on)); save(prefs); onSnow(on); };
  snow.onclick = () => setSnow(!prefs.snow);
  setMode(prefs.mode in TIMES ? prefs.mode : 'auto');
  setSnow(!!prefs.snow);
  return { setMode, setSnow, root };
}
