import { Mesh, PlaneGeometry, ShaderMaterial, UniformsUtils, UniformsLib, DataTexture, RedFormat, LinearFilter, ClampToEdgeWrapping, Color, Vector3 } from 'three';
import { heightAt } from './island.js';

const HALF = 200, N = 256, H0 = 12; // baked field covers +-200 m; heights clamped to +-12 m

// Water plane at y = 0 (the caller snaps mesh.position to an 8 m grid, shader works in world xz).
// Depth comes from a baked 256 x 256 texture of heightAt, so no depth buffer is needed.
export function createWater(radius = 600) {
  const data = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const h = Math.max(-H0, Math.min(H0, heightAt(((i + 0.5) / N * 2 - 1) * HALF, ((j + 0.5) / N * 2 - 1) * HALF)));
    data[j * N + i] = Math.round((h + H0) / (2 * H0) * 255);
  }
  const tex = new DataTexture(data, N, N, RedFormat);
  tex.minFilter = tex.magFilter = LinearFilter;
  tex.wrapS = tex.wrapT = ClampToEdgeWrapping;
  tex.needsUpdate = true;

  const material = new ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: UniformsUtils.merge([UniformsLib.fog, {
      uHeight: { value: tex }, uTime: { value: 0 }, uLight: { value: new Color() }, uSky: { value: new Color() },
      uSunColor: { value: new Color() }, uSunDir: { value: new Vector3() },
      uDeep: { value: new Color('#157fa8') }, uShallow: { value: new Color('#5fd6c6') }, uFoam: { value: new Color('#ffffff') },
    }]),
    vertexShader: `
      #include <fog_pars_vertex>
      varying vec3 vWorld;
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.); vWorld = w.xyz;
        vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <fog_pars_fragment>
      uniform sampler2D uHeight; uniform float uTime;
      uniform vec3 uLight, uSky, uSunColor, uSunDir, uDeep, uShallow, uFoam;
      varying vec3 vWorld;
      void main(){
        float h = texture2D(uHeight, (vWorld.xz + ${HALF}.) / ${2 * HALF}.).r * ${2 * H0}. - ${H0}.;
        float depth = -h;
        if (depth < -.4) discard; // land (or a chunk not streamed in yet)
        vec2 p = vWorld.xz;
        // gentle wave normals: three crossing sines
        vec2 g = vec2(0.);
        g += vec2(.8,.6) * cos(dot(p, vec2(.8,.6)) * .5 + uTime * .9) * .05;
        g += vec2(-.5,.86) * cos(dot(p, vec2(-.5,.86)) * .9 - uTime * 1.2) * .035;
        g += vec2(.3,-.95) * cos(dot(p, vec2(.3,-.95)) * 1.7 + uTime * 1.7) * .02;
        vec3 v = cameraPosition - vWorld;
        g *= exp(-length(v) * .02); // calm with distance (no shimmering stripes at the horizon)
        vec3 n = normalize(vec3(-g.x, 1., -g.y));
        v = normalize(v);
        // depth bands: deep -> shallow, stepped with soft edges for the cartoon look
        float t = 1. - smoothstep(0., 12., depth);
        float q = t * 5., f = fract(q);
        t = (floor(q) + smoothstep(.35, .65, f)) / 5.;
        vec3 col = mix(uDeep, uShallow, t * t) * uLight;
        float fres = pow(1. - max(dot(n, v), 0.), 4.);
        col = mix(col, uSky, fres * .5);
        vec3 r = reflect(-v, n);
        col += uSunColor * smoothstep(.992, .996, dot(r, uSunDir)) * .8; // sun glint
        // foam: surging band hugging the shore + a thin trailing line
        float surge = .5 + .5 * sin(uTime * 1.1 + p.x * .05 + p.y * .04);
        float wob = .25 * sin(p.x * .6 + uTime) * sin(p.y * .5 - uTime * .7);
        float edge = .45 + .6 * surge + wob;
        float foam = 1. - smoothstep(edge - .12, edge, depth);
        foam = max(foam, (1. - smoothstep(.0, .14, abs(depth - edge - 1.1 - .5 * surge))) * .8);
        col = mix(col, uFoam * clamp(uLight * 2., 0., 1.), foam);
        float a = mix(.5, 1., smoothstep(0., 2.5, depth));
        gl_FragColor = vec4(col, max(a, foam));
        #include <fog_fragment>
      }`,
  });
  const mesh = new Mesh(new PlaneGeometry(2 * radius, 2 * radius), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  const u = material.uniforms;
  return {
    mesh,
    // sky tint and light level follow the palette so night/dusk darken the sea
    update(time, p) {
      u.uTime.value = time;
      u.uSky.value.set(p.horizon);
      u.uSunColor.value.set(p.sunColor); u.uSunDir.value.copy(p.sunDir);
      const l = u.uLight.value.set(p.ambient).multiplyScalar(0.55), k = 0.6 * Math.max(0, Math.min(1, p.sunDir.y * 2)), c = u.uSunColor.value;
      l.r += c.r * k; l.g += c.g * k; l.b += c.b * k;
    },
  };
}
