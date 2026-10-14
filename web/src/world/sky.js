import { Mesh, SphereGeometry, ShaderMaterial, BackSide, Color, Vector3 } from 'three';
import { BAND_NORMAL } from './stars.js';

// Palette (time.js, extended in main.js): { zenith, horizon, sunColor, sunDir (Vector3), stars, ... }; colours are hex strings or Colors.

// Painted dome: gradient, sun disc + glow, cel-edged cloud bands. Follows the camera; no depth.
export function createSky() {
  const material = new ShaderMaterial({
    side: BackSide, depthWrite: false, depthTest: false, fog: false,
    uniforms: { zenith: { value: new Color() }, horizon: { value: new Color() }, sunColor: { value: new Color() }, sunDir: { value: new Vector3() }, uDay: { value: 1 }, uStars: { value: 0 }, uBand: { value: BAND_NORMAL } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `
      uniform vec3 zenith, horizon, sunColor, sunDir, uBand; uniform float uDay, uStars; varying vec3 vDir;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
      void main(){
        vec3 d = normalize(vDir);
        float y = max(d.y, 0.);
        vec3 col = mix(horizon, mix(zenith, vec3(.8, .9, 1.), .3 * uDay), smoothstep(0., .22, y)); // narrow warm band, then blue (no peach+blue mud)
        col = mix(col, zenith, smoothstep(.15, .9, y));
        float s = max(dot(d, sunDir), 0.), up = smoothstep(-.02, .03, d.y), low = 1. - smoothstep(.05, .4, sunDir.y); // low = sunrise / sunset weight
        col += sunColor * (pow(s, 5.) * 0.25 + pow(s, 40.) * 0.5) * up;                   // soft halo
        col += sunColor * pow(s, 2.) * (1. - smoothstep(0., .4, y)) * low * smoothstep(-.2, 0., sunDir.y) * .7; // warm glow hugging the horizon on the sun side
        float edge = mix(0.9985, 0.9993, 1. - low);                                       // the low sun is larger
        col = mix(col, mix(sunColor * 1.5, vec3(1., .95, .8) * 3.5, 1. - low), smoothstep(edge, edge + 0.0002, s) * up); // sharp disc
        if (uStars > .01) { // faint milky-way haze, only where the night is dark
          float b = dot(d, uBand), hz = exp(-b * b * 45.) * (noise(d.xz * 5. + d.y * 3.) * .7 + noise(d.zy * 11.) * .3);
          col += vec3(.5, .55, .85) * hz * hz * uStars * .4 * up;
        }
        // cel clouds: hard-ish edge, light top / blue-grey underside (two tones), thin soft rim
        vec2 p = d.xz / (d.y + 0.12) * vec2(0.5, 1.4);
        vec2 toSun = normalize(sunDir.xz + 1e-4) * vec2(0.5, 1.4) * 0.07;
        float f = noise(p * 1.3) * 0.6 + noise(p * 2.9 + 7.) * 0.4;
        float f2 = noise((p + toSun) * 1.3) * 0.6 + noise((p + toSun) * 2.9 + 7.) * 0.4;
        float c = smoothstep(0.535, 0.545, f) * smoothstep(0.03, 0.2, d.y);
        vec3 lit = mix(horizon * 1.25, vec3(1.), 0.85 * uDay) * (0.55 + 0.65 * uDay);
        lit = mix(lit, sunColor * 1.2, pow(s, 3.) * 0.6);
        vec3 shade = mix(mix(zenith, horizon, .4) * .85, mix(zenith, vec3(.62, .68, .86), .65) * .95, uDay);
        vec3 cloud = mix(shade, lit, smoothstep(-0.005, 0.005, f - f2 + 0.012));   // lit where the sun-side edge is thinner
        cloud = mix(cloud, lit, smoothstep(0.62, 0.68, f) * 0.5);                  // thick cores catch light
        col = mix(col, cloud, c * mix(.55, 1., uDay)); // night clouds are thin, the stars still show
        gl_FragColor = vec4(col, 1.);
      }`,
  });
  const mesh = new Mesh(new SphereGeometry(400, 32, 16), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  const u = material.uniforms;
  return {
    mesh,
    update(p) {
      u.zenith.value.set(p.zenith); u.horizon.value.set(p.horizon); u.sunColor.value.set(p.sunColor); u.sunDir.value.copy(p.sunDir);
      u.uDay.value = Math.min(1, Math.max(0, (p.sunDir.y + 0.1) / 0.35)); u.uStars.value = p.stars;
    },
  };
}
