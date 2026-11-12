import { Vector3 } from 'three';
import { heightAt } from '../world/island.js';

const DIST = 5.2, HEAD = 1.6, SHOULDER = 0.6, LOOK = 0.005, GROUND_GAP = 0.6, FOV_KICK = 6;
const damp = (cur, goal, k, dt) => cur + (goal - cur) * (1 - Math.exp(-k * dt)); // frame-rate independent smoothing

// Third-person follow camera. yaw 0 looks toward -z; drag right turns right, drag down looks down (camera rises).
export function createCamera(camera) {
  const fov0 = camera.fov, focus = new Vector3(), vel = new Vector3(), target = new Vector3();
  let yaw = 0, pitch = 0.3, dist = DIST, ready = false, sw = 0, yaw0 = null, sp0 = null; // sw: how far the framing has eased toward the speaker (0..1)

  return {
    get yaw() { return yaw; },
    get pitch() { return pitch; }, set pitch(v) { pitch = v; }, set yaw(v) { yaw = v; },
    speaker: null, // { x, z } of whoever is talking; the view eases toward them and back
    update(p, lookDX, lookDY, dt) {
      const sk = this.speaker;
      if (sk) { sp0 = sk; if (yaw0 == null) yaw0 = yaw; } else if (sw < 0.01) { sw = 0; yaw0 = null; }
      sw = damp(sw, sk ? 1 : 0, 3, dt);
      if (yaw0 != null) { // turn the view toward the speaker (and back to where it was)
        const g = sk ? Math.atan2(p.x - sk.x, p.z - sk.z) : yaw0, d = Math.atan2(Math.sin(g - yaw), Math.cos(g - yaw));
        yaw += d * Math.min(1, dt * 2.5) * (sk ? 0.5 : 1);
      }
      yaw -= lookDX * LOOK;
      pitch = Math.max(0.05, Math.min(1.25, pitch + lookDY * LOOK));
      target.set(p.x, p.y + HEAD, p.z);
      if (!ready || focus.distanceTo(target) > 8) { // first frame or teleport: snap
        if (!ready) yaw = p.heading;
        focus.copy(target); vel.set(0, 0, 0); dist = DIST; ready = true;
      } else { // critically damped spring (omega 14 rad/s), y a little softer so steps do not bob the view
        for (const a of ['x', 'y', 'z']) {
          const ww = a === 'y' ? 10 : 14, xx = ww * dt, ee = 1 / (1 + xx + 0.48 * xx * xx + 0.235 * xx ** 3);
          const d = focus[a] - target[a], t = (vel[a] + ww * d) * dt;
          vel[a] = (vel[a] - ww * t) * ee; focus[a] = target[a] + (d + t) * ee;
        }
      }
      const sy = Math.sin(yaw), cy = Math.cos(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const rx = cy, rz = -sy, sh = SHOULDER * Math.min(1, camera.aspect); // right; shoulder offset shrinks on narrow portrait screens
      // march from the focus out to the wanted distance; stop before the ground gets in the way
      let want = DIST, hit = want;
      for (let i = 1; i <= 10; i++) {
        const t = (i / 10) * want, x = focus.x + sy * cp * t + rx * sh, z = focus.z + cy * cp * t + rz * sh;
        if (focus.y + sp * t < Math.max(heightAt(x, z), 0) + GROUND_GAP) { hit = Math.max(1.2, ((i - 1) / 10) * want); break; }
      }
      dist = hit < dist ? hit : damp(dist, hit, 4, dt); // pull in at once, ease back out
      const px = focus.x + sy * cp * dist + rx * sh, pz = focus.z + cy * cp * dist + rz * sh;
      const py = Math.max(focus.y + sp * dist, Math.max(heightAt(px, pz), 0) + GROUND_GAP);
      camera.position.set(px, py, pz);
      const f = sw * 0.3, tx = sp0 ? (sp0.x - focus.x) * f : 0, tz = sp0 ? (sp0.z - focus.z) * f : 0; // look a third of the way to the speaker
      camera.lookAt(focus.x + rx * sh + tx, focus.y, focus.z + rz * sh + tz);
      const fov = fov0 + FOV_KICK * Math.min(1, p.speed / 5.5);
      if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = damp(camera.fov, fov, 6, dt); camera.updateProjectionMatrix(); }
    },
  };
}
