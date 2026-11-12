// Festival banner and the shared splash game button (shown within RANGE metres of the square while a festival is on).
import { start, tap, tick, newRound, best, saveBest, ROUND_SECS } from '../game/festivals.js';

export const RANGE = 24;
const CSS = `.fest{position:absolute;left:50%;bottom:calc(156px + env(safe-area-inset-bottom));transform:translateX(-50%);min-width:150px;min-height:54px;padding:0 18px;white-space:nowrap;border:3px solid #2a1f3d;border-radius:27px;background:#c9b6ff;color:#2a1f3d;font:800 16px 'Nunito',system-ui,sans-serif;box-shadow:0 3px 0 #2a1f3d;touch-action:manipulation}.fest:active{background:#ff7a59}.fest[hidden]{display:none}`;

export function createFestivalUi(hud, store, { center, onTap, onToast }) {
  const style = document.createElement('style'); style.textContent = CSS;
  const btn = document.createElement('button'); btn.className = 'fest'; btn.type = 'button'; btn.hidden = true;
  hud.append(style, btn);
  let fest = null, round = newRound(), near = false, shown = '';
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!fest) return;
    if (!round.on) round = start(round); // first tap starts the round and counts
    round = tap(round); onTap?.();
  });
  const label = () => round.on ? fest.verb + '! ' + round.score + '  (' + Math.ceil(ROUND_SECS - round.t) + 's)' : fest.name + ': ' + fest.verb;
  return {
    set(f) { if (f !== fest) { fest = f; round = newRound(); if (f) onToast?.('Today: ' + f.name, f.blurb); } },
    update(dt, p, busy) {
      near = !!fest && !busy && Math.hypot(p.x - center[0], p.z - center[1]) < RANGE;
      const was = round; round = tick(round, dt);
      if (!was.done && round.done) { const nb = saveBest(store, round.score); onToast?.('Time! ' + round.score + (nb ? ' (new best!)' : ' (best ' + best(store) + ')'), fest ? fest.name : ''); }
      btn.hidden = !near;
      if (near) { const l = label(); if (l !== shown) { btn.textContent = l; shown = l; } }
    },
  };
}
