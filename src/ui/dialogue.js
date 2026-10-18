// Bottom dialogue box (paper style, ported from the old game's say()): name tag, typewriter text, large touch choices.
// say(who, text, choices?, { auto }) resolves with the chosen index (0 for a plain tap), or -1 when the box is closed from outside.
// Everything is set with textContent. Sits above the Run / Pet row so it never covers them.
const CSS = `.dlg{position:absolute;left:50%;bottom:calc(96px + env(safe-area-inset-bottom));transform:translate(-50%,12px);width:min(560px,calc(100% - 20px));box-sizing:border-box;padding:18px 14px 12px;border:3px solid #2a1f3d;border-radius:20px;background:#fff7ea;color:#2a1f3d;box-shadow:4px 4px 0 #2a1f3d;opacity:0;transition:opacity .2s,transform .2s;pointer-events:auto;touch-action:manipulation;-webkit-user-select:none;user-select:none}
.dlg.on{opacity:1;transform:translate(-50%,0)}.dlg[hidden]{display:none}
.dlg-name{position:absolute;left:14px;top:-17px;max-width:70%;padding:3px 14px;border:3px solid #2a1f3d;border-radius:16px;background:var(--tag,#ff7a59);font:700 italic 17px 'Fraunces',serif;color:#2a1f3d;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dlg-name:empty{display:none}
.dlg-text{margin:0;min-height:3.1em;max-height:30vh;overflow:auto;font:700 17px/1.4 'Nunito',system-ui,sans-serif}
.dlg-opts{display:flex;flex-direction:column;gap:8px;margin-top:10px}.dlg-opts:empty{display:none}
.dlg-opts button{min-height:48px;margin:0;padding:6px 14px;border:3px solid #2a1f3d;border-radius:16px;background:#fff;color:#2a1f3d;font:800 16px/1.2 'Nunito',system-ui,sans-serif;text-align:left;box-shadow:0 3px 0 #2a1f3d;touch-action:manipulation}
.dlg-opts button:active{background:#ff7a59}.dlg-more{position:absolute;right:14px;bottom:6px;font:800 14px 'Nunito',sans-serif;color:#ff7a59;animation:dlgb .8s infinite alternate}
@keyframes dlgb{to{transform:translateY(3px)}}
@media (max-height:480px){.dlg{bottom:calc(84px + env(safe-area-inset-bottom));padding:16px 12px 8px}.dlg-text{font-size:15px;min-height:2.6em;max-height:26vh}.dlg-opts{flex-direction:row;flex-wrap:wrap}.dlg-opts button{flex:1 1 40%;min-height:44px;font-size:15px}}`;

export function createDialogue(host, { onBlip = () => {} } = {}) {
  const style = document.createElement('style'); style.textContent = CSS;
  const el = (cls, tag = 'div', parent) => { const e = document.createElement(tag); e.className = cls; if (parent) parent.append(e); return e; };
  const box = el('dlg'), nameEl = el('dlg-name', 'div', box), textEl = el('dlg-text', 'p', box), optsEl = el('dlg-opts', 'div', box), more = el('dlg-more', 'span', box);
  more.textContent = '▼'; more.hidden = true;
  box.hidden = true; box.setAttribute('role', 'dialog'); box.setAttribute('aria-live', 'polite');
  host.append(style, box);
  let cur = null, hideT = 0;

  const settle = (v) => { const c = cur; if (!c) return; cur = null; clearTimeout(c.tm); clearTimeout(c.auto); c.res(v); };
  function finish() {
    const c = cur; if (!c || !c.typing) return;
    c.typing = false; clearTimeout(c.tm); textEl.textContent = c.text; more.hidden = !!c.choices;
    if (c.choices) c.choices.forEach((label, i) => {
      const b = el('', 'button', optsEl); b.type = 'button'; b.textContent = label;
      b.addEventListener('click', (e) => { e.stopPropagation(); onBlip(0.5); settle(i); });
    });
    if (c.autoMs) c.auto = setTimeout(() => settle(0), c.autoMs);
  }
  box.addEventListener('click', () => { if (!cur) return; if (cur.typing) finish(); else if (!cur.choices) { onBlip(0.5); settle(0); } });

  function say(who, text, choices, { auto = 0 } = {}) {
    settle(-1); clearTimeout(hideT);
    return new Promise((res) => {
      const c = cur = { res, text: String(text), choices: choices?.length ? choices.map(String) : null, typing: true, i: 0, autoMs: auto };
      nameEl.textContent = who?.name || ''; nameEl.style.setProperty('--tag', who?.color || '#ff7a59');
      textEl.textContent = ''; optsEl.textContent = ''; more.hidden = true;
      box.hidden = false; requestAnimationFrame(() => box.classList.add('on'));
      const step = () => {
        if (cur !== c) return;
        c.i += 2; textEl.textContent = c.text.slice(0, c.i);
        if (c.i % 6 === 0) onBlip(0.2);
        if (c.i < c.text.length) c.tm = setTimeout(step, 22); else finish();
      };
      step();
    });
  }
  function close() {
    settle(-1); box.classList.remove('on');
    hideT = setTimeout(() => { if (!cur) box.hidden = true; }, 220);
  }
  return { say, close, get open() { return !!cur || (!box.hidden && box.classList.contains('on')); }, box };
}
