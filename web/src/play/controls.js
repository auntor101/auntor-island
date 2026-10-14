// Touch joystick (left half, appears under the thumb), drag-to-look (right half / mouse), WASD + arrows + Shift.
// read() -> { x, y, run, lookDX, lookDY }: stick in [-1, 1] (y up = forward); look in pixels since the last read.
const R = 56; // stick radius in px (112 px ring)
const CSS = `
.ctl{position:fixed;inset:0;pointer-events:none;touch-action:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}
.ctl .base{position:fixed;left:0;top:0;width:${R * 2}px;height:${R * 2}px;margin:-${R}px 0 0 -${R}px;border-radius:50%;border:3px solid #2a1f3d;background:rgba(255,247,234,.45);display:none}
.ctl .knob{position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;border:3px solid #2a1f3d;background:#fff7ea}
.ctl .base.run .knob{background:#ff7a59}
.ctl button{position:absolute;right:calc(20px + env(safe-area-inset-right));bottom:calc(28px + env(safe-area-inset-bottom));width:60px;height:60px;border-radius:50%;border:3px solid #2a1f3d;background:#fff7ea;color:#2a1f3d;font:800 13px system-ui,sans-serif;pointer-events:auto;touch-action:none}
.ctl button.on{background:#ff7a59}`;
const KEYS = { KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1], KeyD: [1, 0], ArrowRight: [1, 0], KeyA: [-1, 0], ArrowLeft: [-1, 0] };

export function createControls(canvas, root) {
  const style = document.createElement('style'); style.textContent = CSS;
  const ctl = document.createElement('div'); ctl.className = 'ctl';
  const base = document.createElement('div'); base.className = 'base';
  const knob = document.createElement('div'); knob.className = 'knob';
  const runBtn = document.createElement('button'); runBtn.textContent = 'Run';
  base.append(knob); ctl.append(base, runBtn); root.append(style, ctl);
  canvas.style.touchAction = 'none';

  const keys = new Set();
  let stick = null, look = null, sx = 0, sy = 0, ox = 0, oy = 0, btnRun = false, lookDX = 0, lookDY = 0, edge = false;

  const onDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
    if (e.pointerType === 'touch' && e.clientX < innerWidth / 2 && !stick) {
      const cs = getComputedStyle(ctl), m = 12;
      const cx = Math.min(Math.max(e.clientX, R + m + parseFloat(cs.paddingLeft)), innerWidth / 2 - R);
      const cy = Math.min(Math.max(e.clientY, R + m + parseFloat(cs.paddingTop)), innerHeight - R - m - parseFloat(cs.paddingBottom));
      stick = { id: e.pointerId, cx, cy }; ox = oy = 0; edge = false;
      base.style.transform = `translate(${cx}px,${cy}px)`; base.style.display = 'block'; knob.style.transform = '';
    } else if (!look) look = { id: e.pointerId, x: e.clientX, y: e.clientY };
    else return;
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onMove = (e) => {
    if (stick && e.pointerId === stick.id) {
      let dx = e.clientX - stick.cx, dy = e.clientY - stick.cy; const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      ox = dx / R; oy = -dy / R;
      edge = d > R * (edge ? 0.95 : 1.1); // run only when the thumb is pushed past the ring (hysteresis); a full normal push stays a walk
      knob.style.transform = `translate(${dx}px,${dy}px)`; base.classList.toggle('run', edge);
    } else if (look && e.pointerId === look.id) {
      lookDX += e.clientX - look.x; lookDY += e.clientY - look.y; look.x = e.clientX; look.y = e.clientY;
    }
  };
  const onUp = (e) => {
    if (stick && e.pointerId === stick.id) { stick = null; ox = oy = 0; edge = false; base.style.display = 'none'; base.classList.remove('run'); }
    if (look && e.pointerId === look.id) look = null;
  };
  const kd = (e) => { if (KEYS[e.code] || e.code.startsWith('Shift')) { keys.add(e.code); e.preventDefault(); } };
  const ku = (e) => keys.delete(e.code);
  const clear = () => keys.clear();
  const noop = (e) => e.preventDefault();
  const toggle = (e) => { e.preventDefault(); btnRun = !btnRun; runBtn.classList.toggle('on', btnRun); };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('contextmenu', noop);
  canvas.addEventListener('touchmove', noop, { passive: false }); // no scroll / pinch zoom
  runBtn.addEventListener('pointerdown', toggle);
  addEventListener('gesturestart', noop);
  addEventListener('keydown', kd); addEventListener('keyup', ku); addEventListener('blur', clear);

  return {
    read() {
      let kx = 0, ky = 0;
      for (const k of keys) if (KEYS[k]) { kx += KEYS[k][0]; ky += KEYS[k][1]; }
      const x = Math.max(-1, Math.min(1, ox + kx)), y = Math.max(-1, Math.min(1, oy + ky));
      const out = { x, y, run: edge || btnRun || keys.has('ShiftLeft') || keys.has('ShiftRight'), lookDX, lookDY };
      lookDX = lookDY = 0;
      return out;
    },
    dispose() {
      canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('contextmenu', noop); canvas.removeEventListener('touchmove', noop);
      removeEventListener('gesturestart', noop); removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('blur', clear);
      style.remove(); ctl.remove();
    },
  };
}
