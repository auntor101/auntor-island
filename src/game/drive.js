// Garage glue: the Drive / Hop off button and the per-frame drive step for the parked rides.
import { stepVehicle, KINDS } from '../play/vehicle.js';

export const SEAT_Y = 0.55, NEAR = 3;
const CSS = `.drive{position:absolute;left:calc(50% - 92px);bottom:calc(92px + env(safe-area-inset-bottom));min-width:96px;min-height:52px;margin:0;padding:0 16px;border:3px solid #2a1f3d;border-radius:26px;background:#9be3b0;color:#2a1f3d;font:800 16px 'Nunito',system-ui,sans-serif;box-shadow:0 3px 0 #2a1f3d;touch-action:manipulation}.drive:active{background:#ff7a59}.drive[hidden]{display:none}`;

export function createDrive(hud, { vehicles, heightAt, colliders }) {
  const style = document.createElement('style'); style.textContent = CSS;
  const btn = document.createElement('button'); btn.className = 'drive'; btn.type = 'button'; btn.hidden = true;
  hud.append(style, btn);
  let cur = null, s = null, want = false;
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); want = true; });
  return {
    get pose() { return s; },
    get vehicle() { return cur; },
    // Updates the button. Returns 'mount' or 'dismount' when the player tapped it and it is allowed, else null.
    near(p, busy) {
      if (s) { const ok = s.status === 'driving' && Math.abs(s.speed) < 1; btn.hidden = !ok; btn.textContent = 'Hop off'; const w = ok && want; want = false; return w ? 'dismount' : null; }
      const v = busy ? null : vehicles.find((q) => Math.hypot(q.mesh.position.x - p.x, q.mesh.position.z - p.z) < NEAR);
      btn.hidden = !v; if (v) btn.textContent = 'Drive ' + KINDS[v.kind].name.split(' ').pop();
      const w = !!v && want; want = false; cur = v || null;
      return w ? 'mount' : null;
    },
    mount(p) {
      btn.hidden = true;
      s = { x: cur.mesh.position.x, z: cur.mesh.position.z, y: heightAt(cur.mesh.position.x, cur.mesh.position.z), heading: cur.mesh.rotation.y, speed: 0, status: 'driving' };
      return s;
    },
    step(dt, c) {
      s = stepVehicle(s, c, dt, heightAt, colliders, cur.kind);
      cur.place(s.x, s.z, s.heading);
      return s;
    },
    // Step off to the side. Returns the walking state.
    dismount() {
      const p = s; s = null; btn.hidden = true;
      return p && { x: p.x + Math.cos(p.heading) * 1.6, z: p.z - Math.sin(p.heading) * 1.6, y: heightAt(p.x, p.z), heading: p.heading, speed: 0 };
    },
    reset() { s = null; btn.hidden = true; for (const v of vehicles) v.park(); },
  };
}
