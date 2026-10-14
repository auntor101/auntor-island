// Start card: four character cards, a name field, a Start button and the island loading bar. Names only ever go in via textContent / .value.
import { sanitizeName } from '../profile.js';

const LABELS = { man: 'Man', woman: 'Woman', elf: 'Elf', wizard: 'Wizard' };
const BASE = import.meta.env?.BASE_URL ?? '/';

export function createSelect(host, profile, onStart) {
  const el = (tag, cls, text, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; if (parent) parent.append(e); return e; };
  const root = el('div', 'sel', '', host), card = el('div', 'sel-card', '', root);
  el('h1', 'sel-title', 'Auntor Island', card);
  el('p', 'sel-sub', 'Choose your hero', card);
  const grid = el('div', 'sel-grid', '', card), cards = {};
  let choice = profile.char;
  const pick = (id) => { choice = id; for (const k in cards) { cards[k].classList.toggle('on', k === id); cards[k].setAttribute('aria-pressed', String(k === id)); } };
  for (const id of Object.keys(LABELS)) {
    const b = el('button', 'sel-char', '', grid), img = el('img', '', '', b);
    img.src = `${BASE}models/${id}.jpg`; img.alt = ''; img.width = img.height = 128; img.draggable = false;
    el('span', '', LABELS[id], b);
    b.onclick = () => pick(id);
    cards[id] = b;
  }
  const row = el('div', 'sel-row', '', card);
  const input = el('input', 'sel-name', '', row);
  input.maxLength = 12; input.placeholder = 'Your name'; input.autocomplete = 'off'; input.enterKeyHint = 'go'; input.setAttribute('aria-label', 'Your name');
  if (profile.name !== 'Traveler') input.value = profile.name;
  const go = el('button', 'sel-go', 'Start', row);
  const bar = el('div', 'sel-bar', '', card), fill = el('div', '', '', bar), msg = el('div', 'sel-msg', 'Raising the island...', card);
  pick(choice);
  const start = () => onStart({ char: choice, name: sanitizeName(input.value) });
  go.onclick = start;
  input.onkeydown = (e) => { if (e.key === 'Enter') start(); };
  return {
    progress(built, wanted) { const k = wanted ? built / wanted : 0; fill.style.width = `${Math.round(k * 100)}%`; if (wanted && built === wanted) msg.textContent = 'Island ready'; },
    busy(on, text) { go.disabled = on; go.textContent = text || 'Start'; },
    hide() { root.hidden = true; },
  };
}
