// Dragon riding glue: the Fly button (shown beside a dragon companion), takeoff assist, and the per-frame flight step.
import { stepFlight, CRUISE, MAX_STAMINA } from '../play/flight.js';

export const RIDER_Y = 0.9, TAKEOFF_S = 1.5, NEAR = 5;
const CSS = `#hud .fly{position:absolute;left:calc(50% - 92px);bottom:calc(28px + env(safe-area-inset-bottom));min-width:84px;min-height:52px;margin:0;padding:0 16px;border:3px solid #2a1f3d;border-radius:26px;background:#ffd36b;color:#2a1f3d;font:800 16px 'Nunito',system-ui,sans-serif;box-shadow:0 3px 0 #2a1f3d;touch-action:manipulation}#hud .fly:active{background:#ff7a59}#hud .fly[hidden]{display:none}
.stam{position:absolute;left:50%;top:calc(14px + env(safe-area-inset-top));width:120px;height:10px;margin-left:-60px;border:2px solid #2a1f3d;border-radius:6px;background:#fff7ea;overflow:hidden}.stam i{display:block;height:100%;background:#ff7a59}.stam[hidden]{display:none}`;

export function createRide(hud, { life, heightAt, onSfx }) {
  const style = document.createElement('style'); style.textContent = CSS;
  const btn = document.createElement('button'); btn.className = 'fly'; btn.type = 'button'; btn.textContent = 'Fly'; btn.hidden = true;
  const bar = document.createElement('div'), fill = document.createElement('i'); bar.className = 'stam'; bar.hidden = true; bar.append(fill);
  hud.append(style, btn, bar);
  let f = null, t = 0, want = false, hint = null; // f: flight state while mounted
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); want = true; });

  const api = {
    get flying() { return !!f && f.status === 'flying'; },
    get pose() { return f; },
    // Button visibility: only with a dragon companion standing within NEAR metres. Returns true when the player asked to mount.
    near(p) {
      const c = life.getCompanion() === 'dragon' && life._comp?.();
      const ok = !!c && !f && Math.hypot(c.holder.position.x - p.x, c.holder.position.z - p.z) < NEAR;
      btn.hidden = !ok; if (!ok) want = false;
      return ok && want;
    },
    mount(p) {
      want = false; btn.hidden = true; t = 0;
      f = { x: p.x, z: p.z, y: heightAt(p.x, p.z) + 2, heading: p.heading, speed: CRUISE * 0.6, bank: 0, stamina: MAX_STAMINA, status: 'flying' };
      life.setRide(f); bar.hidden = false; onSfx?.('dragon-flap');
      return f;
    },
    // One frame of flight. c = controls.read() (x turns, y climbs, run boosts). Returns the pose; check pose.status.
    step(dt, c, steady) {
      t += dt;
      const was = f.status, y = t < TAKEOFF_S ? Math.max(c.y, 0.6) : c.y; // takeoff assist: climb for the first moments
      f = stepFlight(f, { x: c.x, y, boost: c.run, steady }, dt, heightAt);
      life.setRide(f); fill.style.width = Math.round((f.stamina / MAX_STAMINA) * 100) + '%';
      if (was === 'flying' && f.status !== 'flying') bar.hidden = true;
      return f;
    },
    // Back to walking. Returns the walking state at the touchdown spot.
    dismount() {
      const p = f; f = null; life.setRide(null); bar.hidden = true;
      return p && { x: p.x, z: p.z, y: heightAt(p.x, p.z), heading: p.heading, speed: 0 };
    },
    hint,
  };
  return api;
}
