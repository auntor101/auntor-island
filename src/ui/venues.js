// Eat button near a Feast Quarter shop, the menu card with Food Passport ticks, and the active-buff chip. All text via textContent.
import { MENUS, BUFFS, eat, load, venueNear, give, tick, speedMul } from '../game/venues.js';

const CSS = `.eat{position:absolute;left:calc(50% + 8px);bottom:calc(92px + env(safe-area-inset-bottom));min-width:84px;min-height:52px;margin:0;padding:0 16px;border:3px solid #2a1f3d;border-radius:26px;background:#ffb3a0;color:#2a1f3d;font:800 16px 'Nunito',system-ui,sans-serif;box-shadow:0 3px 0 #2a1f3d;touch-action:manipulation}.eat:active{background:#ff7a59}.eat[hidden]{display:none}
.menu{position:fixed;inset:0;z-index:25;display:flex;align-items:center;justify-content:center;background:rgba(42,31,61,.45);padding:env(safe-area-inset-top) 16px env(safe-area-inset-bottom)}.menu[hidden]{display:none}
.menu .card{width:100%;max-width:340px;box-sizing:border-box;padding:16px;border:3px solid #2a1f3d;border-radius:20px;background:#fff7ea;color:#2a1f3d;box-shadow:0 5px 0 #2a1f3d;font:600 15px 'Nunito',system-ui,sans-serif}
.menu h2{margin:0;font:800 22px 'Fraunces',Georgia,serif}.menu .sub{margin:2px 0 10px;font-size:13px;opacity:.8}.menu .dish{display:flex;justify-content:space-between;align-items:center;gap:8px;width:100%;min-height:48px;margin:6px 0;padding:6px 12px;border:3px solid #2a1f3d;border-radius:14px;background:#fff;color:#2a1f3d;font:700 15px 'Nunito',system-ui,sans-serif;text-align:left;touch-action:manipulation}.menu .dish small{display:block;font-weight:600;opacity:.75}.menu .dish:active{background:#ffd36b}
.menu .close{display:block;margin:10px auto 0;min-height:44px;padding:0 22px;border:3px solid #2a1f3d;border-radius:22px;background:#ff7a59;color:#2a1f3d;font:800 15px 'Nunito',system-ui,sans-serif}
.chip-buff{position:absolute;left:50%;top:calc(32px + env(safe-area-inset-top));transform:translateX(-50%);padding:2px 12px;border:2px solid #2a1f3d;border-radius:14px;background:#ffd36b;color:#2a1f3d;font:800 12px 'Nunito',system-ui,sans-serif;white-space:nowrap}.chip-buff[hidden]{display:none}`;

export function createVenues(hud, store, { anchors, onEat }) {
  const style = document.createElement('style'); style.textContent = CSS;
  const btn = document.createElement('button'); btn.className = 'eat'; btn.type = 'button'; btn.hidden = true;
  const chip = document.createElement('div'); chip.className = 'chip-buff'; chip.hidden = true;
  const menu = document.createElement('div'); menu.className = 'menu'; menu.hidden = true; menu.setAttribute('role', 'dialog');
  const card = document.createElement('div'); card.className = 'card'; menu.append(card);
  hud.append(style, btn, chip); document.body.append(menu);
  let buffs = {}, venue = null, shown = null, t = 0;

  function open(v) {
    const m = MENUS[v], got = load(store), tried = Object.keys(got).length;
    card.replaceChildren();
    const h = document.createElement('h2'), sub = document.createElement('div'); sub.className = 'sub';
    h.textContent = m.name; sub.textContent = 'Food Passport: ' + tried + ' of ' + Object.values(MENUS).reduce((n, x) => n + x.items.length, 0) + ' dishes tried';
    card.append(h, sub);
    for (const [id, name, buff] of m.items) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'dish';
      const l = document.createElement('span'), tick_ = document.createElement('span'), small = document.createElement('small');
      l.textContent = name; small.textContent = BUFFS[buff].label + ' (' + BUFFS[buff].secs + ' s)'; l.append(small);
      tick_.textContent = got[id] ? 'tried' : 'new!';
      b.append(l, tick_);
      b.addEventListener('click', () => { const r = eat(store, id); if (!r) return; buffs = give(buffs, r.item.buff); menu.hidden = true; onEat?.(r); });
      card.append(b);
    }
    const c = document.createElement('button'); c.type = 'button'; c.className = 'close'; c.textContent = 'Not now'; c.addEventListener('click', () => { menu.hidden = true; });
    card.append(c); menu.hidden = false;
  }
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); if (venue) open(venue); });

  return {
    get open() { return !menu.hidden; },
    get speedMul() { return speedMul(buffs); },
    get steady() { return !!buffs.steady; },
    // Call each frame; `busy` hides everything while riding, driving or on the death card.
    update(dt, p, busy) {
      buffs = tick(buffs, dt);
      if ((t += dt) > 0.15) { // the proximity test runs about 7 times a second
        t = 0; venue = busy ? null : venueNear(anchors, p); btn.hidden = !venue || !menu.hidden;
        if (venue && venue !== shown) { btn.textContent = 'Eat'; shown = venue; }
        const k = Object.keys(buffs)[0], txt = k ? BUFFS[k].label + ' ' + Math.ceil(buffs[k]) + 's' : '';
        chip.hidden = !k; if (k) chip.textContent = txt;
      }
      if (busy && !menu.hidden) menu.hidden = true;
    },
  };
}
