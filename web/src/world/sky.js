import { Mesh, SphereGeometry, ShaderMaterial, BackSide, Color, Vector3 } from 'three';

// Palette shape shared by sky, water, fog and lights (Task 4 will animate it):
// { zenith, horizon, sunColor, sunDir (Vector3, unit), fog, ambient }  colours are hex strings.
export const LATE_AFTERNOON = {
  zenith: '#1c8ae8', horizon: '#ffcf9e', sunColor: '#ffd9a0', sunDir: new Vector3(-0.62, 0.3, 0.45).normalize(),
  fog: '#f5cfaa', ambient: '#a9bdf0',
};

// Painted dome: gradient, sun disc + glow, cel-edged cloud bands. Follows the camera; no depth.
export function createSky() {
  const material = new ShaderMaterial({
    side: BackSide, depthWrite: false, depthTest: false, fog: false,
    uniforms: { zenith: { value: new Color() }, horizon: { value: new Color() }, sunColor: { value: new Color() }, sunDir: { value: new Vector3() } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `
      uniform vec3 zenith, horizon, sunColor, sunDir; varying vec3 vDir;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
      void main(){
        vec3 d = normalize(vDir);
        float y = max(d.y, 0.);
        vec3 col = mix(horizon, mix(zenith, vec3(.8, .9, 1.), .3), smoothstep(0., .22, y)); // narrow warm band, then blue (no peach+blue mud)
        col = mix(col, zenith, smoothstep(.15, .9, y));
        float s = max(dot(d, sunDir), 0.);
        col += sunColor * (pow(s, 5.) * 0.25 + pow(s, 40.) * 0.5);                        // soft halo
        col = mix(col, sunColor * 3., smoothstep(0.9993, 0.99945, s));                    // sharp disc
        // cel clouds: hard-ish edge, light top / blue-grey underside (two tones), thin soft rim
        vec2 p = d.xz / (d.y + 0.12) * vec2(0.5, 1.4);
        vec2 toSun = normalize(sunDir.xz + 1e-4) * vec2(0.5, 1.4) * 0.07;
        float f = noise(p * 1.3) * 0.6 + noise(p * 2.9 + 7.) * 0.4;
        float f2 = noise((p + toSun) * 1.3) * 0.6 + noise((p + toSun) * 2.9 + 7.) * 0.4;
        float c = smoothstep(0.535, 0.545, f) * smoothstep(0.03, 0.2, d.y);
        vec3 lit = mix(horizon * 1.1, vec3(1.), 0.85) * 1.2;
        lit = mix(lit, sunColor * 1.2, pow(s, 3.) * 0.6);
        vec3 shade = mix(zenith, vec3(.62, .68, .86), .65) * 0.95;
        vec3 cloud = mix(shade, lit, smoothstep(-0.005, 0.005, f - f2 + 0.012));   // lit where the sun-side edge is thinner
        cloud = mix(cloud, lit, smoothstep(0.62, 0.68, f) * 0.5);                  // thick cores catch light
        col = mix(col, cloud, c);
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
    },
  };
}
