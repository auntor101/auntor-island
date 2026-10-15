// Where the player starts, the Pet button (bottom-centre, only near an animal) and tap-to-pet on the canvas.
import { Raycaster, Vector2 } from 'three';

const clear = (c, x, z, m) => {
  if (c.kind === 'circle') return Math.hypot(x - c.x, z - c.z) > c.r + m;
  const co = Math.cos(c.rot), si = Math.sin(c.rot), ax = x - c.x, az = z - c.z, lx = ax * co - az * si, lz = ax * si + az * co;
  return Math.hypot(Math.max(Math.abs(lx) - c.hw, 0), Math.max(Math.abs(lz) - c.hd, 0)) > m;
};
// First dry, open spot on rings around the market square (south side first), 1.5 m clear of every building and prop.
export function spawnPoint(village, heightAt, isWet) {
  const [cx, cz] = village.layout.center;
  for (let r = 4; r <= 14; r += 2) for (let i = 0; i < 16; i++) {
    const a = Math.PI / 2 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (Math.PI / 8), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    if (!isWet(x, z) && heightAt(x, z) > 0.5 && village.colliders.every((c) => clear(c, x, z, 1.5))) return { x, z };
  }
  return { x: cx, z: cz };
}

const CSS = `.pet{position:absolute;left:calc(50% + 8px);bottom:calc(28px + env(safe-area-inset-bottom));min-width:84px;min-height:52px;margin:0;padding:0 16px;border:3px solid #2a1f3d;border-radius:26px;background:#fff7ea;color:#2a1f3d;font:800 16px 'Nunito',system-ui,sans-serif;box-shadow:0 3px 0 #2a1f3d;touch-action:manipulation}.pet:active{background:#ff7a59}.pet[hidden]{display:none}`;
export function createPetUi(hud, canvas, camera, life, getState) {
  const style = document.createElement('style'); style.textContent = CSS;
  const b = document.createElement('button'); b.className = 'pet'; b.textContent = 'Pet'; b.hidden = true; b.type = 'button';
  hud.append(style, b);
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); life.pet(); });
  const ray = new Raycaster(), ndc = new Vector2();
  let d0 = null, on = false, t = 0;
  canvas.addEventListener('pointerdown', (e) => { d0 = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!on || !d0 || performance.now() - d0.t > 350 || Math.hypot(e.clientX - d0.x, e.clientY - d0.y) > 10) return;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = life.pick(ray.ray);
    if (hit) life.pet(hit);
  });
  return {
    show(v) { on = v; if (!v) b.hidden = true; },
    update() { if (!on) return; t = (t + 1) % 6; if (!t) b.hidden = !life.nearest(getState(), 2.5); }, // the near test runs 10 times a second
  };
}
