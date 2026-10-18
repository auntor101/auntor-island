// Minimap (round, top-left), compass arrow to the current target, full-screen map with fast travel to visited places.
// createMap(host, { net, heightAt, zoneAt, isWet, onTravel }) -> { update(state, yaw), setTarget(x, z, label), visited }
import { HALF } from '../world/paths/network.js';

const KEY = 'isle.paths.visited.v1', NEAR = 12, BASE = 168, SPAN = 2 * HALF;
const ZONE = { village: [196, 170, 120], beach: [232, 214, 160], cove: [226, 208, 156], volcano: [112, 84, 78], mountain: [150, 150, 158], glacier: [226, 236, 246], roost: [150, 138, 120], forest: [92, 142, 82], grove: [96, 164, 104], meadow: [130, 178, 98], tower: [150, 140, 170] };
const ICON = { village: '#ff7a59', dock: '#4aa3d9', hall: '#ff7a59', beach: '#f2c14e', cove: '#f2c14e', roost: '#c0544a', grove: '#3f9d5a', mountain: '#8c8c9c', volcano: '#d9482b', tower: '#8a5ad9', academy: '#3c6fd6', arena: '#d6563c', hatchery: '#e7a23a', springs: '#4cc2c2' };

export function loadVisited(ids, storage = globalThis.localStorage) { // validated: only known ids survive
  try { const a = JSON.parse(storage.getItem(KEY) || '[]'); return new Set(Array.isArray(a) ? a.filter((s) => typeof s === 'string' && ids.includes(s)) : []); } catch { return new Set(); }
}
const saveVisited = (set) => { try { localStorage.setItem(KEY, JSON.stringify([...set])); } catch { /* private mode: visits just don't persist */ } };

const CSS = `
.mm{position:absolute;left:calc(env(safe-area-inset-left) + 8px);top:calc(env(safe-area-inset-top) + 8px);display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none}
#hud .mm .mm-map{display:block;width:96px;height:96px;margin:0;padding:0;border:3px solid #2a1f3d;border-radius:50%;background:#bfe3f2;overflow:hidden;pointer-events:auto;touch-action:manipulation;box-shadow:0 2px 0 #2a1f3d}
#hud .mm .mm-map canvas{display:block;width:100%;height:100%}
#hud .mm .mm-compass{position:relative;width:44px;height:44px;margin:0;padding:0;border:2px solid #2a1f3d;border-radius:50%;background:#fff7ea;pointer-events:auto;touch-action:manipulation}
.mm .mm-compass svg{position:absolute;left:6px;top:6px;width:28px;height:28px}
.mm .mm-dist{position:absolute;left:50%;top:100%;transform:translateX(-50%);margin-top:1px;font:800 11px 'Nunito',system-ui,sans-serif;color:#2a1f3d;white-space:nowrap;text-shadow:0 0 3px #fff7ea,0 0 3px #fff7ea}
.mm-full{position:fixed;inset:0;z-index:6;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:max(10px,env(safe-area-inset-top)) 10px max(10px,env(safe-area-inset-bottom));background:rgba(42,31,61,.55);pointer-events:auto;touch-action:manipulation}
.mm-full[hidden]{display:none}
.mm-full canvas{border:3px solid #2a1f3d;border-radius:18px;background:#bfe3f2;max-width:100%;touch-action:manipulation}
.mm-bar{display:flex;align-items:center;gap:10px;min-height:52px;padding:6px 8px 6px 16px;border:3px solid #2a1f3d;border-radius:26px;background:#fff7ea;color:#2a1f3d;font:800 16px 'Nunito',system-ui,sans-serif}
#hud .mm-full button, .mm-full .mm-bar button{min-height:44px;margin:0;padding:0 16px;border:3px solid #2a1f3d;border-radius:22px;background:#ff7a59;color:#2a1f3d;font:800 15px 'Nunito',system-ui,sans-serif}
.mm-full .mm-bar button[hidden]{display:none}
#hud .note{top:calc(env(safe-area-inset-top) + 120px)}
.mm-fade{position:fixed;inset:0;z-index:7;background:#fff7ea;opacity:0;pointer-events:none;transition:opacity .25s}
.mm-fade.on{opacity:1}`;

export function createMap(host, { net, heightAt, zoneAt, isWet, onTravel }) {
  const el = (tag, cls, parent, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; if (parent) parent.append(e); return e; };
  const st = el('style', '', document.head); st.textContent = CSS;
  const ids = net.pois.map((p) => p.id), visited = loadVisited(ids);
  let target = null; // { x, z, label } set by quests; null -> nearest unvisited landmark

  // ---- base terrain image, painted in slices so a phone never stalls on it
  const base = document.createElement('canvas'); base.width = base.height = BASE;
  const bg = base.getContext('2d'), img = bg.createImageData(BASE, BASE), px = SPAN / BASE;
  let row = 0, baseDone = false, dirty = true;
  const rowsPer = 14;
  function paintRows() {
    const end = Math.min(BASE, row + rowsPer);
    for (; row < end; row++) for (let i = 0; i < BASE; i++) {
      const x = -HALF + (i + 0.5) * px, z = -HALF + (row + 0.5) * px, h = heightAt(x, z), o = (row * BASE + i) * 4;
      let c;
      if (h < 0.1 || isWet(x, z)) { const d = Math.min(1, Math.max(0, -h / 14)); c = h < 0.1 ? [92 - 40 * d, 170 - 60 * d, 214 - 40 * d] : [96, 178, 224]; }
      else {
        c = ZONE[zoneAt(x, z)] || ZONE.meadow;
        const s = 0.82 + 0.18 * Math.min(1, h / 60), e = (heightAt(x + 4, z + 4) - h) * 0.03; // light from the north-west
        c = c.map((v) => Math.max(0, Math.min(255, v * (s - e))));
      }
      img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
    }
    bg.putImageData(img, 0, 0); dirty = true;
    if (row < BASE) setTimeout(paintRows, 0); else baseDone = true;
  }
  setTimeout(paintRows, 50);

  // ---- drawing (world -> canvas)
  function drawMap(g, S, { labels = false, sel = null } = {}) {
    const k = S / SPAN, X = (x) => (x + HALF) * k, Z = (z) => (z + HALF) * k;
    g.imageSmoothingEnabled = true; g.drawImage(base, 0, 0, S, S);
    g.lineCap = g.lineJoin = 'round';
    for (const [w, col] of [[labels ? 6 : 3.4, 'rgba(60,35,15,.55)'], [labels ? 3.4 : 1.8, '#f3d9a4']]) {
      g.lineWidth = w; g.strokeStyle = col; g.beginPath();
      for (const p of net.pieces) p.pts.forEach(([x, z], i) => { if (i % 2 === 0 || i === p.pts.length - 1) (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))); });
      g.stroke();
    }
    g.font = '800 ' + Math.round(S / 30) + 'px Nunito, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'bottom';
    for (const p of net.pois) {
      const r = labels ? 9 : 3.2, seen = visited.has(p.id), cx = X(p.x), cz = Z(p.z);
      g.beginPath(); g.arc(cx, cz, r + (sel === p.id ? 4 : 0), 0, 6.283); g.fillStyle = seen ? ICON[p.id] : '#c9c1b6'; g.fill();
      g.lineWidth = labels ? 3 : 1.2; g.strokeStyle = '#2a1f3d'; g.stroke();
      if (labels) {
        g.lineWidth = 4; g.strokeStyle = '#fff7ea'; g.strokeText(p.name, cx, cz - r - 3); g.fillStyle = '#2a1f3d'; g.fillText(p.name, cx, cz - r - 3);
      }
    }
    if (target) { g.beginPath(); g.arc(X(target.x), Z(target.z), labels ? 8 : 3.5, 0, 6.283); g.strokeStyle = '#ff7a59'; g.lineWidth = labels ? 4 : 2; g.stroke(); }
  }
  function arrow(g, S, x, z, yaw, size) { // player: coral arrow pointing where the camera looks (north up)
    const k = S / SPAN; g.save(); g.translate((x + HALF) * k, (z + HALF) * k); g.rotate(-yaw);
    g.beginPath(); g.moveTo(0, -size); g.lineTo(size * 0.7, size * 0.8); g.lineTo(0, size * 0.35); g.lineTo(-size * 0.7, size * 0.8); g.closePath();
    g.fillStyle = '#ff7a59'; g.fill(); g.lineWidth = 1.8; g.strokeStyle = '#2a1f3d'; g.stroke(); g.restore();
  }

  // ---- minimap + compass
  const root = el('div', 'mm', host), mini = el('button', 'mm-map', root);
  mini.type = 'button'; mini.setAttribute('aria-label', 'Open map');
  const mc = el('canvas', '', mini); mc.width = mc.height = 192; const mg = mc.getContext('2d');
  const comp = el('button', 'mm-compass', root); comp.type = 'button'; comp.setAttribute('aria-label', 'Direction to target');
  comp.innerHTML = '<svg viewBox="0 0 28 28"><path d="M14 2 L24 25 L14 19 L4 25 Z" fill="#ff7a59" stroke="#2a1f3d" stroke-width="2" stroke-linejoin="round"/></svg>';
  const needle = comp.firstChild, dist = el('div', 'mm-dist', comp);

  // ---- full map
  const full = el('div', 'mm-full', host); full.hidden = true;
  const fc = el('canvas', '', full), fg = fc.getContext('2d'), bar = el('div', 'mm-bar', full), msg = el('span', '', bar, 'Tap a place');
  const go = el('button', '', bar, 'Travel here'); go.hidden = true; go.type = 'button';
  const close = el('button', '', bar, 'Close'); close.type = 'button'; close.style.background = '#fff7ea';
  const fade = el('div', 'mm-fade', document.body);
  let sel = null, last = { x: 0, z: 0, yaw: 0 };
  const size = () => Math.floor(Math.min(innerWidth - 20, innerHeight - 110, 760));
  function drawFull() {
    const S = size(), dpr = Math.min(2, devicePixelRatio || 1);
    fc.width = fc.height = Math.round(S * dpr); fc.style.width = fc.style.height = S + 'px';
    drawMap(fg, fc.width, { labels: true, sel }); arrow(fg, fc.width, last.x, last.z, last.yaw, 11 * dpr);
  }
  const openFull = (on) => { full.hidden = !on; if (on) { sel = null; go.hidden = true; msg.textContent = 'Tap a place'; drawFull(); } };
  mini.onclick = () => openFull(true);
  close.onclick = () => openFull(false);
  fc.onclick = (e) => { // pick the nearest icon within 28 px, else close
    const r = fc.getBoundingClientRect(), mx = e.clientX - r.left, mz = e.clientY - r.top, k = r.width / SPAN;
    let best = null, bd = 28;
    for (const p of net.pois) { const d = Math.hypot((p.x + HALF) * k - mx, (p.z + HALF) * k - mz); if (d < bd) { bd = d; best = p; } }
    if (!best) { openFull(false); return; }
    sel = best.id; const seen = visited.has(best.id);
    msg.textContent = seen ? best.name : best.name + ' (not visited yet)'; go.hidden = !seen; drawFull();
  };
  go.onclick = () => {
    const p = net.poi[sel]; if (!p || !visited.has(sel)) return;
    fade.classList.add('on');
    setTimeout(() => { onTravel(p.x, p.z); openFull(false); setTimeout(() => fade.classList.remove('on'), 120); }, 280);
  };

  // ---- per-frame
  let lx = 1e9, lz = 1e9, ly = 1e9, ct = 0;
  function nearest(x, z) { let b = null, bd = 1e9; for (const p of net.pois) if (!visited.has(p.id)) { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; b = p; } } return b; }
  function update(s, yaw) {
    last = { x: s.x, z: s.z, yaw };
    for (const p of net.pois) if (!visited.has(p.id) && Math.hypot(p.x - s.x, p.z - s.z) < NEAR) { visited.add(p.id); saveVisited(visited); dirty = true; }
    ct += 1;
    const t = target || nearest(s.x, s.z), dx = t ? t.x - s.x : 0, dz = t ? t.z - s.z : 0;
    needle.style.transform = `rotate(${t ? Math.atan2(dx, -dz) + yaw : 0}rad)`;
    if (ct % 15 === 0) dist.textContent = t ? Math.round(Math.hypot(dx, dz)) + ' m' : '';
    comp.hidden = !t;
    if (dirty || Math.abs(s.x - lx) + Math.abs(s.z - lz) > 0.4 || Math.abs(yaw - ly) > 0.03) {
      lx = s.x; lz = s.z; ly = yaw;
      if (dirty) { dirty = false; mini.dataset.rev = String((+mini.dataset.rev || 0) + 1); }
      mg.clearRect(0, 0, 192, 192);
      drawMap(mg, 192); arrow(mg, 192, s.x, s.z, yaw, 9);
    }
  }
  return { update, visited, setTarget(x, z, label) { target = x == null ? null : { x, z, label: String(label || '') }; dirty = true; }, get ready() { return baseDone; } };
}
