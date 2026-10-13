// Character-select panel on the start screen. UI only: reads the form and hands a profile to game.js.
(function () {
  'use strict';
  if (!window.LI || !LI.applyProfile || !window.LIProfile) return;
  const $ = id => document.getElementById(id);
  const P = LIProfile;
  const cur = Object.assign({}, LI.profile);
  const genderBtns = document.querySelectorAll('#pick [data-g]');
  const nameIn = $('pname'), looksEl = $('looks'), skinsEl = $('skins');

  function swatch(color, on, label, onclick) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'sw' + (on ? ' on' : ''); b.style.background = color;
    b.setAttribute('aria-label', label); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.addEventListener('click', onclick);
    return b;
  }
  function render() {
    genderBtns.forEach(b => {
      const on = b.dataset.g === cur.gender;
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    looksEl.textContent = ''; skinsEl.textContent = '';
    P.LOOKS[cur.gender].forEach((l, i) => looksEl.appendChild(swatch(l.shirt, i === cur.look, l.label + ' outfit', () => { cur.look = i; render(); })));
    P.SKINS.forEach((c, i) => skinsEl.appendChild(swatch(c, i === cur.skin, 'Skin tone ' + (i + 1), () => { cur.skin = i; render(); })));
  }
  genderBtns.forEach(b => b.addEventListener('click', () => { cur.gender = b.dataset.g; cur.look = 0; render(); }));
  nameIn.value = cur.name === 'Traveler' ? '' : cur.name;
  render();

  LI.beforeStart = () => {
    cur.name = nameIn.value;
    LI.applyProfile(cur);
    P.save(LI.store(), LI.profile);
  };
})();
