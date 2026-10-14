import { Points, BufferGeometry, BufferAttribute, ShaderMaterial, Color } from 'three';

const BOX = [48, 24, 48];

// 4000 soft flakes wrapped around the camera in the vertex shader (no per-frame JS loop).
export function createSnow(camera, count = 4000) {
  const seed = new Float32Array(count * 4);
  for (let i = 0; i < seed.length; i++) seed[i] = Math.random();
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('seed', new BufferAttribute(seed, 4));
  const material = new ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 }, uCam: { value: camera.position }, uPx: { value: 1 }, uAmt: { value: 0 }, uColor: { value: new Color('#ffffff') } },
    vertexShader: `
      attribute vec4 seed; uniform float uTime, uPx; uniform vec3 uCam; varying float vA;
      const vec3 BOX = vec3(${BOX.map((v) => v + '.').join(',')});
      void main(){
        vec3 q = seed.xyz * BOX;
        q.y -= uTime * (1.1 + seed.w * 1.3);
        q.x += uTime * .8 + sin(uTime * .7 + seed.w * 40.) * .8; // gentle wind plus sway
        q.z += cos(uTime * .5 + seed.x * 30.) * .6;
        q = mod(q - uCam, BOX) - BOX * .5;
        vec4 mv = viewMatrix * vec4(uCam + q, 1.);
        gl_Position = projectionMatrix * mv;
        float z = -mv.z;
        gl_PointSize = clamp((.05 + .05 * seed.w) * 900. * uPx / max(z, .5), 1.5 * uPx, 9. * uPx);
        vA = smoothstep(.8, 2.5, z) * (1. - smoothstep(14., 24., z)) * (.45 + .35 * seed.w);
      }`,
    fragmentShader: `
      uniform float uAmt; uniform vec3 uColor; varying float vA;
      void main(){ float d = length(gl_PointCoord - .5); gl_FragColor = vec4(uColor, smoothstep(.5, .1, d) * vA * uAmt); }`,
  });
  const points = new Points(geo, material);
  points.frustumCulled = false;
  points.renderOrder = 2;
  points.visible = false;
  let enabled = false;
  return {
    points,
    setEnabled(on) { enabled = !!on; },
    get enabled() { return enabled; },
    // amount 0..1 fades flakes in and out; colour follows the light level
    update(time, amount = enabled ? 1 : 0, px = 1, color) {
      const u = material.uniforms;
      u.uTime.value = time; u.uAmt.value = amount; u.uPx.value = px;
      if (color) u.uColor.value.set(color);
      points.visible = amount > 0.01;
    },
  };
}
