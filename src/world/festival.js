// Festival confetti over the village square: one Points draw call, 240 particles moved on the CPU (no allocation per frame).
import { Points, BufferGeometry, BufferAttribute, PointsMaterial, Color } from 'three';

const N = 240, W = 36, H = 9;

export function createFestival(scene, [cx, cz], heightAt) {
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), seed = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) { seed[i * 2] = Math.random(); seed[i * 2 + 1] = Math.random(); pos[i * 3] = (Math.random() - 0.5) * W; pos[i * 3 + 1] = Math.random() * H; pos[i * 3 + 2] = (Math.random() - 0.5) * W; }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3)); geo.setAttribute('color', new BufferAttribute(col, 3));
  const mat = new PointsMaterial({ size: 0.6, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, sizeAttenuation: true });
  const points = new Points(geo, mat); points.frustumCulled = false; points.visible = false; points.renderOrder = 2;
  scene.add(points);
  const base = heightAt(cx, cz), c = new Color();
  let fest = null, kick = 0, t = 0;
  return {
    points,
    set(f) { // new festival (or null = none): recolour, show or hide
      fest = f; points.visible = !!f;
      if (f) for (let i = 0; i < N; i++) { c.set(f.colors[i % f.colors.length]); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      geo.attributes.color.needsUpdate = true;
    },
    burst() { kick = 1; }, // a tap in the splash game: the confetti flurries for a second
    update(dt) {
      if (!fest) return;
      t += dt; kick = Math.max(0, kick - dt);
      const v = fest.motion === 'rise' ? 0.9 : fest.motion === 'fall' ? -1.1 : 0.05, f = 1 + kick * 3;
      for (let i = 0; i < N; i++) {
        const k = i * 3, a = seed[i * 2], b = seed[i * 2 + 1];
        pos[k + 1] += (v * (0.6 + a) * f) * dt;
        pos[k] += Math.sin(t * 0.7 + b * 20) * 0.5 * f * dt + (fest.motion === 'drift' ? Math.cos(t * 0.3 + a * 9) * 0.6 * dt : 0);
        pos[k + 2] += Math.cos(t * 0.6 + a * 20) * 0.5 * f * dt;
        if (pos[k + 1] > H) pos[k + 1] -= H; else if (pos[k + 1] < 0) pos[k + 1] += H;
        if (pos[k] > W / 2) pos[k] -= W; else if (pos[k] < -W / 2) pos[k] += W;
        if (pos[k + 2] > W / 2) pos[k + 2] -= W; else if (pos[k + 2] < -W / 2) pos[k + 2] += W;
      }
      geo.attributes.position.needsUpdate = true;
      points.position.set(cx, base + 0.5, cz);
    },
  };
}
