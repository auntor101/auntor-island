import { BufferGeometry, Float32BufferAttribute, InstancedBufferAttribute, InstancedMesh, ShaderMaterial, DynamicDrawUsage, DoubleSide } from 'three';

// Pure timing: 0 = birds home (day), 1 = all gone. They leave 17.5 to 18.7 (sunset) and come back 5.8 to 6.6 (sunrise).
export const BIRDS_LEAVE = 17.5, BIRDS_GONE = 18.7, BIRDS_BACK = 5.8, BIRDS_HOME = 6.6;
export function birdsAway(hours) {
  const h = ((hours % 24) + 24) % 24;
  if (h >= BIRDS_GONE || h < BIRDS_BACK) return 1;
  if (h < BIRDS_HOME) return 1 - (h - BIRDS_BACK) / (BIRDS_HOME - BIRDS_BACK);
  if (h < BIRDS_LEAVE) return 0;
  return (h - BIRDS_LEAVE) / (BIRDS_GONE - BIRDS_LEAVE);
}

const N = 36, SCARE_R = 7;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// A flock of simple silhouettes: one InstancedMesh, one draw call. Wings flap in the vertex shader (aPh = phase, flap amount, wing spread).
// opts.nearTree(x, z) -> true when a tree is close, used to pick perches; falls back to any dry land.
export function createBirds(scene, { heightAt, isWet, center = { x: 0, z: 0 }, nearTree = () => true, rand = Math.random } = {}) {
  const g = new BufferGeometry(); // forward is +z; wings are the vertices with |x| > 0.1
  g.setAttribute('position', new Float32BufferAttribute([
    0, 0, 0.3, -0.08, 0, -0.18, 0.08, 0, -0.18,
    -0.08, 0, 0.12, -0.08, 0, -0.12, -0.6, 0, -0.18,
    0.08, 0, 0.12, 0.6, 0, -0.18, 0.08, 0, -0.12,
  ], 3));
  const mat = new ShaderMaterial({
    side: DoubleSide, fog: false, uniforms: { uT: { value: 0 } },
    vertexShader: `uniform float uT; attribute vec3 aPh;
      void main(){ vec3 p = position; float w = step(.1, abs(p.x));
        p.x *= mix(1., aPh.z, w); p.y += w * abs(p.x) * sin(uT * 13. + aPh.x) * aPh.y * 1.1;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.); }`,
    fragmentShader: 'void main(){ gl_FragColor = vec4(.16, .12, .24, 1.); }',
  });
  const mesh = new InstancedMesh(g, mat, N);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  const ph = new InstancedBufferAttribute(new Float32Array(N * 3), 3); ph.setUsage(DynamicDrawUsage);
  g.setAttribute('aPh', ph);
  mesh.frustumCulled = false; mesh.visible = false;
  scene?.add?.(mesh);

  const B = [];
  const home = (b) => { // dry land near trees within 70 m of the village
    let hx = center.x, hz = center.z;
    for (let k = 0; k < 40; k++) {
      const a = rand() * 6.283, r = 10 + rand() * 60, x = center.x + Math.cos(a) * r, z = center.z + Math.sin(a) * r;
      hx = x; hz = z;
      if (!isWet(x, z) && heightAt(x, z) > 1 && nearTree(x, z)) break;
    }
    const out = Math.hypot(hx, hz) > 5 ? Math.atan2(hx, hz) : rand() * 6.283;
    b.hx = hx; b.hy = heightAt(hx, hz) + 5.5; b.hz = hz; b.dir = out + (rand() - 0.5) * 1.0;
  };
  for (let i = 0; i < N; i++) { const b = { a: rand() * 6.283, rad: 2 + rand() * 4, spd: (0.4 + rand() * 0.4) * (rand() < 0.5 ? -1 : 1), circ: rand() < 0.45, st: rand(), ph: rand() * 6.283, sc: 0, s: 1.3 + rand() * 0.5, x: 0, y: 0, z: 0 }; home(b); B.push(b); }

  const m = mesh.instanceMatrix.array, pa = ph.array;
  let t = 0;
  return {
    mesh, count: N,
    rehome() { for (const b of B) home(b); }, // call once the trees have streamed in
    update(dt, hours, player) {
      const away = birdsAway(hours);
      mesh.visible = away < 1;
      if (!mesh.visible) return;
      t += dt; mat.uniforms.uT.value = t;
      const back = ((hours % 24) + 24) % 24 < 12;
      for (let i = 0; i < N; i++) {
        const b = B[i];
        let x, y, z, yaw, flap, spread;
        if (b.circ) {
          const a = b.a + t * b.spd; x = b.hx + Math.cos(a) * b.rad; z = b.hz + Math.sin(a) * b.rad; y = b.hy + 2 + Math.sin(t * 0.7 + b.ph);
          yaw = Math.atan2(-Math.sin(a) * Math.sign(b.spd), Math.cos(a) * Math.sign(b.spd)); flap = 1; spread = 1;
        } else { x = b.hx; y = b.hy + Math.sin(t * 2 + b.ph) * 0.03; z = b.hz; yaw = b.a; flap = 0; spread = 0.3; }
        const q = Math.min(1, Math.max(0, (away - b.st * 0.4) / 0.6)), e = q * q;
        if (q > 0) { // gone to sea along b.dir (or arriving from it)
          const sx = Math.sin(b.dir), sz = Math.cos(b.dir), d = 4 + e * 420;
          x += sx * d; z += sz * d; y += q * 70;
          yaw += wrap(b.dir + (back ? Math.PI : 0) - yaw) * Math.min(1, q * 12); flap = 1; spread = 1;
        }
        if (player) { // scatter when the player runs close
          const dx = b.x - player.x, dz = b.z - player.z, d = Math.hypot(dx, dz);
          b.sc = Math.min(1, Math.max(0, b.sc + dt * (d < SCARE_R ? 4 : -0.4)));
          if (b.sc > 0) { const k = b.sc * b.sc * 25 / (d || 1); x += dx * k; z += dz * k; y += b.sc * 9; flap = 1; spread = 1; if (d > 0.01 && b.sc > 0.3) yaw = Math.atan2(dx, dz); }
        }
        b.x = x; b.y = y; b.z = z;
        const c = Math.cos(yaw) * b.s, s = Math.sin(yaw) * b.s, o = i * 16;
        m[o] = c; m[o + 1] = 0; m[o + 2] = -s; m[o + 3] = 0; m[o + 4] = 0; m[o + 5] = b.s; m[o + 6] = 0; m[o + 7] = 0;
        m[o + 8] = s; m[o + 9] = 0; m[o + 10] = c; m[o + 11] = 0; m[o + 12] = x; m[o + 13] = y; m[o + 14] = z; m[o + 15] = 1;
        pa[i * 3] = b.ph; pa[i * 3 + 1] = flap; pa[i * 3 + 2] = spread;
      }
      mesh.instanceMatrix.needsUpdate = true; ph.needsUpdate = true;
    },
    dispose() { scene?.remove?.(mesh); g.dispose(); mat.dispose(); },
  };
}
