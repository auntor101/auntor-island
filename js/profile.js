// Player profile: pure data and validation. No DOM, no THREE. Loaded before game.js.
(function (root) {
  'use strict';
  const KEY = 'lumen-isle-profile-v1';
  const MAXLEN = 12, FALLBACK = 'Traveler';
  const SKINS = ['#f5c7a3', '#e0a77d', '#b9805a', '#7a4f36'];
  const LOOKS = {
    m: [
      { label: 'Sunset', shirt: '#ff7a59', pants: '#3d5a80', hair: '#3b2a2a', scarf: '#ffc94d' },
      { label: 'Ocean', shirt: '#3f8fd2', pants: '#2b2d42', hair: '#1f1a1a', scarf: '#f1e4cf' },
      { label: 'Forest', shirt: '#5b9a6a', pants: '#5a4038', hair: '#6b4a2e', scarf: '#ff7a59' },
    ],
    f: [
      { label: 'Blossom', shirt: '#f08fb0', pants: '#3d5a80', hair: '#2a1f3d', scarf: '#fff7ea' },
      { label: 'Lavender', shirt: '#8e7dd6', pants: '#2b2d42', hair: '#3b2a2a', scarf: '#ffc94d' },
      { label: 'Sunrise', shirt: '#ff9a4d', pants: '#5a4038', hair: '#8a3b2a', scarf: '#ffffff' },
    ],
  };
  // shortcut: tiny blocklist that misses creative spellings, extend it if abuse shows up in analytics
  const BLOCK = ['fuck', 'shit', 'cunt', 'nigg', 'rape', 'nazi'];

  function sanitizeName(raw) {
    let s = typeof raw === 'string' ? raw : '';
    s = s.replace(/[\u0000-\u001f\u007f-\u009f<>]/g, '').replace(/\s+/g, ' ').trim();
    s = Array.from(s).slice(0, MAXLEN).join('').trim();
    const flat = s.toLowerCase().replace(/[^a-z]/g, '');
    if (!s || BLOCK.some(b => flat.includes(b))) return FALLBACK;
    return s;
  }
  const idx = (v, n) => (Number.isInteger(v) && v >= 0 && v < n ? v : 0);
  function normalize(p) {
    p = p && typeof p === 'object' ? p : {};
    const gender = p.gender === 'f' ? 'f' : 'm';
    return { gender, name: sanitizeName(p.name), look: idx(p.look, LOOKS[gender].length), skin: idx(p.skin, SKINS.length) };
  }
  function load(storage) {
    try { return normalize(JSON.parse(storage.getItem(KEY))); } catch (e) { return normalize(null); }
  }
  function save(storage, p) {
    try { storage.setItem(KEY, JSON.stringify(normalize(p))); } catch (e) { /* storage blocked or full: the game still works */ }
  }
  function playerOpts(p) {
    const l = LOOKS[p.gender][p.look];
    return { skin: SKINS[p.skin], shirt: l.shirt, sleeve: l.shirt, pants: l.pants, hair: l.hair, scarf: l.scarf, style: 'player', shoes: '#f1e4cf', gender: p.gender };
  }

  const api = { sanitizeName, normalize, load, save, playerOpts, LOOKS, SKINS };
  root.LIProfile = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
