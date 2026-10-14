import { Vector4 } from 'three';

// Ring buffer of at most 8 ripples (x, z, birth time, strength) shared by every water shader as one uniform array.
export function createRipples(max = 8) {
  const list = Array.from({ length: max }, () => new Vector4(0, 0, -99, 0));
  let next = 0, now = 0;
  return {
    uniform: { value: list },
    setTime(t) { now = t; },
    add(x, z, strength = 1) { list[next].set(x, z, now, strength); next = (next + 1) % max; },
  };
}

// GLSL: returns (gradient.x, gradient.z, cel ring mask) at world xz p. Needs uTime and uRip[8]. Fixed 8 iterations, no branching on data.
export const RIPPLE_GLSL = `
uniform vec4 uRip[8];
vec3 ripples(vec2 p){
  vec3 r = vec3(0.);
  for (int i = 0; i < 8; i++) {
    vec4 q = uRip[i]; float age = uTime - q.z, life = 1. - age / 2.6;
    if (q.w <= 0. || age < 0. || life <= 0.) continue;
    vec2 dv = p - q.xy; float d = length(dv) + 1e-3, w = .16 + age * .08;
    float x1 = (d - age * 1.5 - .1) / w, x2 = (d - age * .9 - .05) / (w * 1.3);
    float e1 = exp(-x1 * x1), e2 = exp(-x2 * x2) * .6;
    r.xy += dv / d * (-2. * x1 * e1 / w - 2. * x2 * e2 / w) * .05 * life * q.w;
    r.z += max(smoothstep(.55, .7, e1), smoothstep(.55, .7, e2 / .6) * .7) * life * q.w;
  }
  return r;
}`;
