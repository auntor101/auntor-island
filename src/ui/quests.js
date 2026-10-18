// Quest HUD (paper style): star counter and tracker chip under the compass (tap to open the list), the "Quest complete" toast with a CSS star burst,
// a short companion bubble, and the secret-word card. Everything is set with textContent.
const CSS = `.qz{position:absolute;left:calc(env(safe-area-inset-left) + 8px);top:calc(env(safe-area-inset-top) + 178px);width:min(224px,calc(100vw - 120px));display:flex;flex-direction:column;gap:5px;align-items:flex-start;pointer-events:none;font:800 13px/1.25 'Nunito',system-ui,sans-serif;color:#2a1f3d}
.qz>*{pointer-events:auto}.qz[hidden],.qz [hidden]{display:none}
#hud .qz button{margin:0;font:inherit;color:inherit;touch-action:manipulation}
.qz-stars{padding:2px 10px;border:2px solid #2a1f3d;border-radius:14px;background:#ffd45a;box-shadow:0 2px 0 #2a1f3d}
#hud .qz .qz-chip{min-height:44px;width:100%;box-sizing:border-box;padding:4px 10px;border:2px solid #2a1f3d;border-radius:16px;background:#fff7ea;text-align:left;box-shadow:0 2px 0 #2a1f3d}
.qz-chip small{display:block;font-weight:700;opacity:.7}
.qz-list{width:100%;box-sizing:border-box;max-height:42vh;overflow:auto;padding:6px 8px;border:2px solid #2a1f3d;border-radius:14px;background:#fff7ea;box-shadow:0 2px 0 #2a1f3d}
.qz-list div{padding:3px 0;border-bottom:1px dashed #2a1f3d33}.qz-list .done{opacity:.55;text-decoration:line-through}.qz-list .now{color:#c8402a}.qz-list .locked{opacity:.5}
#hud .qz .qz-btn{min-height:36px;margin-top:6px;padding:0 12px;border:2px solid #2a1f3d;border-radius:14px;background:#ff7a59}
.qz-toast{position:absolute;left:50%;top:34%;transform:translate(-50%,0);padding:12px 22px;border:3px solid #2a1f3d;border-radius:22px;background:#fff7ea;box-shadow:0 4px 0 #2a1f3d;text-align:center;font:800 18px/1.25 'Fraunces',Georgia,serif;color:#2a1f3d;pointer-events:none;opacity:0;max-width:86vw}
.qz-toast small{display:block;font:700 14px 'Nunito',sans-serif}
.qz-toast.on{animation:qzt 3.2s ease both}@keyframes qzt{0%{opacity:0;transform:translate(-50%,16px) scale(.8)}12%{opacity:1;transform:translate(-50%,0) scale(1.05)}20%{transform:translate(-50%,0) scale(1)}85%{opacity:1}100%{opacity:0;transform:translate(-50%,-10px)}}
.qz-toast i{position:absolute;left:50%;top:50%;color:#ffb81f;font-style:normal;font-size:20px;opacity:0}
.qz-toast.on i{animation:qzb 1.2s ease-out both}@keyframes qzb{0%{opacity:1;transform:translate(-50%,-50%) rotate(0) scale(.4)}100%{opacity:0;transform:translate(calc(-50% + var(--x)),calc(-50% + var(--y))) rotate(220deg) scale(1.2)}}
.qz-bub{position:absolute;left:50%;bottom:calc(92px + env(safe-area-inset-bottom));transform:translateX(-50%);max-width:min(300px,calc(100vw - 40px));padding:6px 12px;border:2px solid #2a1f3d;border-radius:14px;background:#fff7ea;font:700 14px/1.3 'Nunito',sans-serif;color:#2a1f3d;text-align:center;pointer-events:none;opacity:0;transition:opacity .3s}
.qz-bub.on{opacity:1}
.qz-card{position:fixed;inset:0;z-index:8;display:flex;align-items:center;justify-content:center;background:rgba(42,31,61,.7)}.qz-card[hidden]{display:none}
.qz-card>div{width:min(340px,calc(100vw - 32px));box-sizing:border-box;padding:22px 20px;border:4px solid #2a1f3d;border-radius:26px;background:#fff7ea;text-align:center;box-shadow:0 6px 0 #2a1f3d;color:#2a1f3d;font:700 16px/1.4 'Nunito',sans-serif}
.qz-card h2{margin:0 0 6px;font:800 22px 'Fraunces',Georgia,serif}.qz-card b{display:block;margin:8px 0 12px;font:800 44px 'Fraunces',Georgia,serif;letter-spacing:.2em;color:#ff7a59;text-shadow:0 3px 0 #2a1f3d}
.qz-card p{margin:4px 0}.qz-card small{display:block;margin-top:12px;font:700 12px 'Nunito',sans-serif;opacity:.75}
@media (max-height:480px){.qz{top:calc(env(safe-area-inset-top) + 170px);width:min(200px,calc(100vw - 120px))}.qz-list{max-height:30vh}}`;

export function createQuestUi(host, { onReset }) {
  const el = (cls, tag = 'div', text = '', parent = null) => { const e = document.createElement(tag); e.className = cls; if (text) e.textContent = text; if (parent) parent.append(e); return e; };
  const style = document.createElement('style'); style.textContent = CSS;
  const root = el('qz'), stars = el('qz-stars', 'div', '', root), chip = el('qz-chip', 'button', '', root), list = el('qz-list', 'div', '', root);
  const toastEl = el('qz-toast'), bub = el('qz-bub'), card = el('qz-card');
  chip.type = 'button'; chip.setAttribute('aria-expanded', 'false'); list.hidden = true; card.hidden = true;
  host.append(style, root, toastEl, bub);
  document.body.append(card);
  chip.addEventListener('click', () => { list.hidden = !list.hidden; chip.setAttribute('aria-expanded', String(!list.hidden)); });
  let bt = 0, tt = 0, armed = 0;

  return {
    // o: { text, sub } | null; n stars
    setTracker(o, n) {
      stars.textContent = '★ ' + n; chip.textContent = '';
      el('', 'span', o ? o.text : 'No quest. Look for a "!"', chip); if (o?.sub) el('', 'small', o.sub, chip);
    },
    // rows: [{ text, state: 'done'|'now'|'open'|'locked' }]; resetting is a two-tap button
    setList(rows, extra) {
      list.textContent = '';
      for (const r of rows) el(r.state, 'div', (r.state === 'done' ? '✓ ' : r.state === 'now' ? '▶ ' : '') + r.text, list);
      if (extra) { const b = el('qz-btn', 'button', extra.text, list); b.type = 'button'; b.addEventListener('click', extra.fn); }
      const r = el('qz-btn', 'button', 'Reset progress', list); r.type = 'button';
      r.addEventListener('click', () => { if (armed) { clearTimeout(armed); armed = 0; onReset(); } else { r.textContent = 'Tap again to reset'; armed = setTimeout(() => { armed = 0; r.textContent = 'Reset progress'; }, 3000); } });
    },
    toast(title, sub) {
      toastEl.textContent = ''; el('', 'div', 'Quest complete', toastEl); el('', 'small', title, toastEl); if (sub) el('', 'small', sub, toastEl);
      for (let i = 0; i < 10; i++) { const s = el('', 'i', '★', toastEl), a = i / 10 * 6.283; s.style.setProperty('--x', Math.round(Math.cos(a) * 110) + 'px'); s.style.setProperty('--y', Math.round(Math.sin(a) * 70) + 'px'); }
      toastEl.classList.remove('on'); void toastEl.offsetWidth; toastEl.classList.add('on');
      clearTimeout(tt); tt = setTimeout(() => toastEl.classList.remove('on'), 3300);
    },
    bubble(text) { bub.textContent = text; bub.classList.add('on'); clearTimeout(bt); bt = setTimeout(() => bub.classList.remove('on'), 3800); },
    card(c) {
      card.textContent = ''; const box = el('', 'div', '', card);
      el('', 'h2', c.title, box); el('', 'b', c.word, box); for (const l of c.lines) el('', 'p', l, box);
      const b = el('qz-btn', 'button', 'Close', box); b.type = 'button'; b.style.cssText = 'margin-top:14px;min-height:44px;padding:0 22px;border:3px solid #2a1f3d;border-radius:22px;background:#ff7a59;font:800 16px Nunito,sans-serif;color:#2a1f3d';
      b.addEventListener('click', () => { card.hidden = true; });
      el('', 'small', c.note + ' ' + c.handle, box); card.hidden = false;
    },
    show(on) { root.hidden = !on; },
  };
}
