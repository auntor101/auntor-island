import { Points, BufferGeometry, BufferAttribute, ShaderMaterial, AdditiveBlending, Vector3 } from 'three';

export const BAND_NORMAL = new Vector3(0.6, 0.66, 0.55).normalize(); // pole of the milky-way great circle

// ~9000 point stars (most are faint) on a sphere: magnitude skewed to faint, 30% squeezed into a milky-way band, twinkle in the shader.
export function createStars(count = 9000) {
  let s = 987654321;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7;
  const pos = new Float32Array(count * 3), att = new Float32Array(count * 4), v = new Vector3();
  for (let i = 0; i < count; i++) {
    const band = i < count * 0.3;
    do { v.set(gauss(), gauss(), gauss()); } while (v.lengthSq() < 1e-4);
    v.normalize();
    if (band) v.addScaledVector(BAND_NORMAL, -v.dot(BAND_NORMAL) + gauss() * 0.1).normalize();
    v.multiplyScalar(380).toArray(pos, i * 3);
    const m = Math.pow(rnd(), band ? 3.5 : 4.5); // 0 faint .. 1 bright
    att.set([m, rnd() * 6.283, rnd(), 0.5 + rnd() * 2.5], i * 4); // magnitude, twinkle phase, colour temperature, twinkle speed
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('att', new BufferAttribute(att, 4));
  const material = new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false,
    uniforms: { uTime: { value: 0 }, uVis: { value: 1 }, uPx: { value: 1 } },
    vertexShader: `
      attribute vec4 att; uniform float uTime, uVis, uPx; varying vec3 vCol;
      void main(){
        float tw = 1. + (.12 + .25 * (1. - att.x)) * sin(uTime * att.w + att.y) + .1 * sin(uTime * att.w * 2.7 + att.y * 3.);
        vec3 warm = vec3(1., .82, .62), cool = vec3(.68, .8, 1.);
        vCol = mix(cool, warm, att.z) * (.7 + 1.8 * att.x) * tw * uVis;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
        gl_PointSize = (1.5 + 2.6 * att.x) * uPx;
      }`,
    fragmentShader: `
      varying vec3 vCol;
      void main(){ float d = length(gl_PointCoord - .5); gl_FragColor = vec4(vCol * smoothstep(.5, .12, d), 1.); }`,
  });
  const points = new Points(geo, material);
  points.frustumCulled = false;
  points.renderOrder = -9;
  return {
    points,
    update(time, visibility, px = 1) {
      const u = material.uniforms;
      u.uTime.value = time; u.uVis.value = visibility; u.uPx.value = px; points.visible = visibility > 0.01;
    },
  };
}
