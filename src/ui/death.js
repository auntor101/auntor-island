// Slapstick death card. All text is set with textContent. onRetry() runs when the player taps Try again.
import { CAUSES, TITLE, ASK, load, record, total } from '../game/deaths.js';

const CSS = `.dead{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(42,31,61,.55);z-index:30;padding:env(safe-area-inset-top) 16px env(safe-area-inset-bottom)}.dead[hidden]{display:none}
.dead .card{max-width:340px;width:100%;box-sizing:border-box;padding:20px;border:3px solid #2a1f3d;border-radius:20px;background:#fff7ea;color:#2a1f3d;box-shadow:0 5px 0 #2a1f3d;font:600 15px 'Nunito',system-ui,sans-serif;text-align:center}
.dead h2{margin:0 0 6px;font:800 24px 'Fraunces',Georgia,serif}.dead p{margin:0 0 12px}.dead ul{list-style:none;margin:0 0 14px;padding:0;font-size:13px;text-align:left}.dead li{display:flex;justify-content:space-between;gap:8px;padding:2px 0;border-bottom:1px dashed #2a1f3d55}
.dead button{min-height:52px;padding:0 24px;border:3px solid #2a1f3d;border-radius:26px;background:#ff7a59;color:#2a1f3d;font:800 17px 'Nunito',system-ui,sans-serif;box-shadow:0 3px 0 #2a1f3d;touch-action:manipulation}`;

export function createDeathCard(host, store, onRetry) {
  const style = document.createElement('style'); style.textContent = CSS;
  const root = document.createElement('div'); root.className = 'dead'; root.hidden = true;
  root.setAttribute('role', 'alertdialog'); root.setAttribute('aria-label', TITLE);
  const card = document.createElement('div'); card.className = 'card';
  const h = document.createElement('h2'), why = document.createElement('p'), ask = document.createElement('p'), list = document.createElement('ul'), btn = document.createElement('button');
  h.textContent = TITLE; ask.textContent = ASK; btn.textContent = 'Try again'; btn.type = 'button';
  card.append(h, why, list, ask, btn); root.append(card); host.append(style, root);
  btn.addEventListener('click', () => { root.hidden = true; onRetry(); });
  return {
    get open() { return !root.hidden; },
    show(cause) {
      const log = record(store, cause);
      why.textContent = CAUSES[cause] || CAUSES.ground;
      list.replaceChildren();
      const head = document.createElement('li'); head.textContent = 'Ways I Died (' + total(log) + ')'; head.style.fontWeight = '800'; list.append(head);
      for (const k in CAUSES) {
        const li = document.createElement('li'), a = document.createElement('span'), b = document.createElement('span');
        a.textContent = k[0].toUpperCase() + k.slice(1); b.textContent = String(log[k] || 0); li.append(a, b); list.append(li);
      }
      root.hidden = false; btn.focus();
    },
    load: () => load(store),
  };
}
