import { Mesh, Group, BufferGeometry, BufferAttribute, ShaderMaterial, UniformsUtils, UniformsLib, DataTexture, RedFormat, HalfFloatType, UnsignedByteType, DataUtils, LinearFilter, ClampToEdgeWrapping, RepeatWrapping, Color, Vector3, CatmullRomCurve3 } from 'three';
import { heightAt, waterSurfaceAt, LAKE, RIVERS, FALLS } from './island.js';
import { createRipples, RIPPLE_GLSL } from './ripples.js';
import { createWaterfall, fallInfo, NOISE_GLSL } from './waterfall.js';

const HALF = 224, N = 320, H0 = -16, H1 = 6; // sea-floor field: +-224 m, 1.4 m texels, heights clamped to [-16, 6]
const clamp01 = (v) => Math.min(1, Math.max(0, v));

// Concentric rings, spacing grows 7.5% per ring: fine near the camera, coarse at 650 m. ~10k triangles.
export function buildSea(segs = 112, far = 650) {
  const rings = Math.ceil(Math.log(1 + far * 0.075 / 2) / Math.log(1.075)), pos = [], idx = [];
  for (let k = 0; k <= rings; k++) {
    const r = 2 * (Math.pow(1.075, k) - 1) / 0.075;
    for (let s = 0; s < segs; s++) pos.push(Math.cos(s / segs * 6.2832) * r, 0, Math.sin(s / segs * 6.2832) * r);
  }
  for (let k = 0; k < rings; k++) for (let s = 0; s < segs; s++) {
    const a = k * segs + s, b = k * segs + (s + 1) % segs, c = a + segs, d = b + segs;
    idx.push(a, b, c, b, d, c);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3)); g.setIndex(idx);
  return g;
}

// Lake: a disc of vertices around the centre; aDepth = level - bed where the lake really is, <= 0 elsewhere (the shader discards it).
export function buildLake(lake, hAt, surfaceAt, rings = 36, segs = 96) {
  const R = lake.r * 1.4, pos = [], dep = [], idx = [];
  for (let k = 0; k <= rings; k++) for (let s = 0; s < segs; s++) {
    const r = R * k / rings, x = lake.x + Math.cos(s / segs * 6.2832) * r, z = lake.z + Math.sin(s / segs * 6.2832) * r, gap = lake.level - hAt(x, z), sf = surfaceAt(x, z);
    pos.push(x, lake.level, z); dep.push(sf !== null && Math.abs(sf - lake.level) < 0.05 ? gap : Math.min(gap, -0.02));
  }
  for (let k = 0; k < rings; k++) for (let s = 0; s < segs; s++) {
    const a = k * segs + s, b = k * segs + (s + 1) % segs, c = a + segs, d = b + segs;
    idx.push(a, b, c, b, d, c);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3)); g.setAttribute('aDepth', new BufferAttribute(new Float32Array(dep), 1)); g.setIndex(idx);
  return g;
}

// Rivers: a ribbon per polyline, draped at the river's own surface (never rising downstream), widened so the banks clip it.
export function buildRibbons(rivers, hAt, surfaceAt, step = 1.5, cols = 6, widen = 1.9) {
  const pos = [], dep = [], flow = [], dir = [], slope = [], idx = [];
  for (const r of rivers) {
    const curve = new CatmullRomCurve3(r.pts.map(([x, z]) => new Vector3(x, 0, z)), false, 'centripetal'), len = curve.getLength(), n = Math.max(2, Math.ceil(len / step));
    const pts = curve.getSpacedPoints(n), ys = pts.map((q) => surfaceAt(q.x, q.z) ?? hAt(q.x, q.z) + 0.3);
    for (let i = 1; i <= n; i++) ys[i] = Math.min(ys[i], ys[i - 1]);
    const sl = ys.map((y, i) => Math.max((ys[Math.max(i - 1, 0)] - y) / (len / n), (y - ys[Math.min(i + 1, n)]) / (len / n)));
    const base = pos.length / 3, hw = r.width / 2 * widen;
    for (let i = 0; i <= n; i++) {
      const t = curve.getTangentAt(i / n), p = pts[i];
      for (let j = 0; j <= cols; j++) {
        const off = (j / cols * 2 - 1) * hw, x = p.x - t.z * off, z = p.z + t.x * off;
        pos.push(x, ys[i], z); dep.push(ys[i] - hAt(x, z)); flow.push(off, i * len / n); dir.push(t.x, t.z); slope.push(sl[i]);
      }
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < cols; j++) {
      const a = base + i * (cols + 1) + j, b = a + 1, c = a + cols + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new BufferGeometry(), f = (a, k) => new BufferAttribute(new Float32Array(a), k);
  g.setAttribute('position', f(pos, 3)); g.setAttribute('aDepth', f(dep, 1)); g.setAttribute('aFlow', f(flow, 2)); g.setAttribute('aDir', f(dir, 2)); g.setAttribute('aSlope', f(slope, 1)); g.setIndex(idx);
  return g;
}

// Highest elevation (as tan) seen from (cx, cz, eye) in each of n compass directions, for the analytic mountain reflection.
export function buildSkyline(hAt, cx, cz, eye, n = 128) {
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const a = (i / n - 0.5) * 6.2832, c = Math.cos(a), s = Math.sin(a);
    let m = -0.1;
    for (let d = 20; d <= 300; d += 8) m = Math.max(m, (hAt(cx + c * d, cz + s * d) - eye) / d);
    out[i] = Math.round(clamp01((m + 0.1) / 1.3) * 255);
  }
  return out;
}

const COMMON = `
const float HALF = ${HALF}.;
const float TAU = 6.28318;`;

const VERT = `
#include <fog_pars_vertex>
${COMMON}
uniform float uTime;
varying vec3 vWorld, vN; varying float vWave;
#ifdef SEA
uniform sampler2D uHeight;
void gw(vec2 p, vec2 D, float L, float A, float Q, float damp, inout vec3 o, inout vec3 g){
  float k = TAU / L, th = k * dot(D, p) - sqrt(9.8 * k) * .75 * uTime, s = sin(th), c = cos(th);
  A *= damp;
  o += vec3(Q * A * D.x * c, A * s, Q * A * D.y * c);
  g += vec3(D.x * k * A * c, Q * k * A * s, D.y * k * A * c);
}
#else
attribute float aDepth, aSlope; attribute vec2 aFlow, aDir;
varying float vDepth, vSlope; varying vec2 vFlow, vDir;
#endif
void main(){
  vec4 w = modelMatrix * vec4(position, 1.);
  #ifdef SEA
    float h = texture2D(uHeight, (w.xz + HALF) / (2. * HALF)).r, damp = smoothstep(.2, 6., -h);
    vec3 o = vec3(0.), g = vec3(0.);
    gw(w.xz, normalize(vec2(.8, .6)), 46., .42, .8, damp, o, g);
    gw(w.xz, normalize(vec2(-.4, .9)), 23., .18, .7, damp, o, g);
    gw(w.xz, normalize(vec2(.9, -.4)), 11., .07, .6, damp, o, g);
    gw(w.xz, normalize(vec2(.15, 1.)), 5.2, .03, .5, damp, o, g);
    w.xyz += o; w.y += .08 + (1. - damp) * .06 * sin(uTime * .9 + w.x * .05 + w.z * .04); // shallows breathe: the thin wet film on the beach
    vN = normalize(vec3(-g.x, max(1. - g.y, .2), -g.z)); vWave = clamp(o.y / .6, -1., 1.);
  #else
    vDepth = aDepth; vSlope = aSlope; vFlow = aFlow; vDir = aDir; vN = vec3(0., 1., 0.); vWave = 0.;
  #endif
  vWorld = w.xyz;
  vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = `
#include <fog_pars_fragment>
${COMMON}
uniform float uTime, uDay, uStars, uSnow; uniform vec3 uLight, uFoam, uLCol, uSunRaw, uSunDir, uLDir, uZenith, uHorizon, uShallow, uMid, uDeep, uFall;
uniform sampler2D uHeight, uSky;
varying vec3 vWorld, vN; varying float vWave;
#ifndef SEA
varying float vDepth, vSlope; varying vec2 vFlow, vDir;
#endif
${NOISE_GLSL}
${RIPPLE_GLSL}
// the same painted sky as sky.js, analytic, for reflections and for the horizon fade
vec3 skyAt(vec3 d){
  float y = max(d.y, 0.);
  vec3 col = mix(uHorizon, mix(uZenith, vec3(.8, .9, 1.), .3 * uDay), smoothstep(0., .22, y));
  col = mix(col, uZenith, smoothstep(.15, .9, y));
  float s = max(dot(d, uSunDir), 0.), low = 1. - smoothstep(.05, .4, uSunDir.y);
  col += uSunRaw * (pow(s, 5.) * .25 + pow(s, 40.) * .5);
  col += uSunRaw * pow(s, 2.) * (1. - smoothstep(0., .4, y)) * low * smoothstep(-.2, 0., uSunDir.y) * .7;
  return col;
}
vec3 bands(float d, float far){
  float t = clamp(d / far, 0., 1.), q = t * 5., f = fract(q);
  t = (floor(q) + smoothstep(.3, .7, f)) / 5.;
  return mix(mix(uShallow, uMid, smoothstep(0., .35, t)), uDeep, smoothstep(.25, 1., t));
}
void main(){
  vec3 V = cameraPosition - vWorld; float dist = length(V); V /= dist;
  vec2 p = vWorld.xz; float t = uTime, d, alpha = 1., foam = 0., glint = 1., caus = 0.;
  vec3 n = vN, body, rp = ripples(p);
  #if defined(SEA)
    d = vWorld.y - texture2D(uHeight, (p + HALF) / (2. * HALF)).r;
    if (d < 0.) discard;
    vec2 g = vec2(.8, .6) * cos(dot(p, vec2(.8, .6)) * 1.1 + t * 1.6) * .05 + vec2(-.5, .86) * cos(dot(p, vec2(-.5, .86)) * 1.9 - t * 2.1) * .035;
    n = normalize(n + vec3(-g.x, 0., -g.y) * exp(-dist * .025) + vec3(-rp.x, 0., -rp.y));
    body = bands(d, 16.);
    alpha = mix(.45, 1., smoothstep(0., 2.2, d));
    // shore foam: three surges per cycle, crisp cel line, a lacy wash behind it, then a slower drag back
    float dw = d + (noise(p * .35 + vec2(t * .05, 0.)) - .5) * .9, lace = step(.42, noise(p * 1.5 + t * .1));
    for (int i = 0; i < 3; i++) {
      float ph = fract(t * .085 + float(i) * .33 + noise(p * .025 + float(i)) * .4);
      float s = ph < .62 ? sin(ph / .62 * 1.5708) : 1. - .55 * smoothstep(.62, 1., ph), fd = mix(3.4, .12, s);
      float life = smoothstep(0., .08, ph) * (1. - smoothstep(.82, 1., ph));
      float front = 1. - smoothstep(0., .05, abs(dw - fd) - .1), wash = step(dw, fd) * step(fd - .55, dw) * lace * .9;
      foam = max(foam, max(front, wash) * life);
    }
    foam = max(foam, 1. - smoothstep(.05, .12, dw));
    foam = max(foam, step(.9, vWave + noise(p * .9 + t * .25) * .35) * smoothstep(3., 10., d) * (1. - smoothstep(120., 260., dist))); // white caps
    float wet = 1. - smoothstep(0., .2, d);                                                  // beach film: dark wet sand under the swash
    body = mix(body, vec3(.12, .08, .06), wet * .8); alpha = mix(alpha, .55, wet);
    caus = 1. - smoothstep(0., 3.5, d);
  #elif defined(LAKE)
    d = vDepth; if (d < 0.) discard;
    vec2 q = p * 1.1 + vec2(t * .06, t * .04);
    float a0 = noise(q * 2.), gx = (noise(q * 2. + vec2(.15, 0.)) - a0) / .15, gz = (noise(q * 2. + vec2(0., .15)) - a0) / .15;
    n = normalize(vec3(-gx * .03 - sin(p.x * .9 + t * .7) * .012 - rp.x, 1., -gz * .03 - cos(p.y * 1.1 - t * .6) * .012 - rp.y));
    body = bands(d, 5.); glint = .6;
    alpha = mix(.3, .97, smoothstep(0., 2., d));
    foam = (1. - smoothstep(.05, .5, d + noise(p * .8 + t * .1) * .35)) * .6;                 // soft foam line where it meets the bank
    float fd = distance(p, uFall.xy), churn = noise(p * 1.6 + vec2(0., t * 1.5));
    foam = max(foam, step(.35, 1. - smoothstep(uFall.z * .55, uFall.z, fd + churn * 1.3)) * (.65 + .35 * step(.5, churn)) * step(.5, uFall.z));
    float wet = 1. - smoothstep(0., .15, d); body = mix(body, vec3(.1, .09, .06), wet * .6);
    caus = 1. - smoothstep(0., 2.5, d);
  #else
    d = vDepth; if (d < 0. || vSlope > 1.) discard;
    float sp = 1.1 + 5. * clamp(vSlope, 0., 1.);                                              // faster where steep
    vec2 q = vec2(vFlow.x * 1.4, vFlow.y * .5 - t * sp * .5);
    float a0 = noise(q), gu = (noise(q + vec2(.1, 0.)) - a0) / .1, gv = (noise(q + vec2(0., .1)) - a0) / .1;
    n = normalize(vec3(0., 1., 0.) - .05 * (gu * vec3(-vDir.y, 0., vDir.x) + gv * vec3(vDir.x, 0., vDir.y)) - vec3(rp.x, 0., rp.y));
    body = bands(d, 1.5); glint = .5;
    alpha = mix(.4, .95, smoothstep(0., 1., d));
    float rapid = smoothstep(.1, .3, vSlope) * step(.45, noise(q * vec2(1.8, 1.1)));
    float rock = (1. - smoothstep(.12, .5, d)) * step(.62, noise(vec2(vFlow.x * .9, vFlow.y * .7)));
    foam = max(max(rapid, rock * (.6 + .4 * step(.5, a0))), 1. - smoothstep(0., .14, d));
    float wet = 1. - smoothstep(0., .12, d); body = mix(body, vec3(.1, .09, .06), wet * .5);
    caus = 1. - smoothstep(0., 1.5, d);
  #endif
  n = normalize(mix(n, vec3(0., 1., 0.), smoothstep(60., 300., dist)));                        // far water calms: no shimmer at the horizon
  vec3 R = reflect(-V, n); R.y = abs(R.y);
  vec3 refl = skyAt(R);
  #ifndef SEA
    float tanE = texture2D(uSky, vec2(atan(R.z, R.x) / TAU + .5, .5)).r * 1.3 - .1, tr = R.y / max(length(R.xz), 1e-3);
    vec3 rockC = mix(uHorizon, vec3(.1, .17, .3), .55) * (.35 + .65 * uDay);
    rockC = mix(rockC, mix(vec3(1.), uHorizon, .25) * (.4 + .6 * uDay), (1. - smoothstep(0., .12, tanE - tr)) * .85);
    refl = mix(refl, rockC, 1. - smoothstep(tanE - .01, tanE + .01, tr));
  #endif
  refl += step(.992, hash(floor(R.xz / (R.y + .2) * 70.))) * uStars * (.6 + .4 * sin(t * 3. + R.x * 40.)) * vec3(.8, .9, 1.) * .8;   // stars in the water at night
  float nv = max(dot(n, V), 0.), F = .06 + .94 * pow(1. - nv, 4.);
  vec3 col = mix(body * uLight, refl, F * .85);
  col += caus * (1. - smoothstep(.1, .6, abs(noise(p * 1.2 + t * .25) - noise(p * 1.2 - t * .2 + 5.)) * 6.)) * uLCol * .3;
  float sr = max(dot(R, uLDir), 0.), spark = step(.55, noise(p * 2.2 + t * vec2(.8, .5)));
  col += uLCol * glint * (smoothstep(.9985, .9992, sr) * 1.6 + spark * smoothstep(.97, .985, sr) * 1.2 + pow(sr, 12.) * .2);   // discrete cel sparkle bands plus a soft sun path
  col = mix(col, uFoam, foam);
  col = mix(col, vec3(dot(col, vec3(.33))) * vec3(.85, .95, 1.1), uSnow * .35);
  #ifdef USE_FOG
    float fg = smoothstep(fogNear, fogFar, vFogDepth);
  #else
    float fg = 0.;
  #endif
  col = mix(col, skyAt(normalize(vec3(-V.x, 0., -V.z))), fg);                                  // fade into the sky's own horizon colour, not the terrain fog
  gl_FragColor = vec4(col, max(max(alpha, foam), fg));
}`;

// opts: heightAt, surfaceAt, lake, rivers, falls (all default to island.js, so the real terrain just works).
export function createWater(opts = {}) {
  const hAt = opts.heightAt || heightAt, surfaceAt = opts.surfaceAt || waterSurfaceAt, lake = opts.lake || LAKE, rivers = opts.rivers || RIVERS, falls = opts.falls || FALLS;

  const hd = new Uint16Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) hd[j * N + i] = DataUtils.toHalfFloat(Math.max(H0, Math.min(H1, hAt(((i + 0.5) / N * 2 - 1) * HALF, ((j + 0.5) / N * 2 - 1) * HALF))));
  const heightTex = new DataTexture(hd, N, N, RedFormat, HalfFloatType);
  heightTex.minFilter = heightTex.magFilter = LinearFilter; heightTex.wrapS = heightTex.wrapT = ClampToEdgeWrapping; heightTex.needsUpdate = true;
  const skyTex = new DataTexture(buildSkyline(hAt, lake.x, lake.z, lake.level), 128, 1, RedFormat, UnsignedByteType);
  skyTex.minFilter = skyTex.magFilter = LinearFilter; skyTex.wrapS = RepeatWrapping; skyTex.wrapT = ClampToEdgeWrapping; skyTex.needsUpdate = true;

  const rip = createRipples();
  const fi = falls.length ? fallInfo(falls[0], rivers, lake) : null;
  const S = {
    uTime: { value: 0 }, uDay: { value: 1 }, uStars: { value: 0 }, uSnow: { value: 0 },
    uLight: { value: new Color() }, uFoam: { value: new Color() }, uLCol: { value: new Color() }, uSunRaw: { value: new Color() },
    uSunDir: { value: new Vector3(0, 1, 0) }, uLDir: { value: new Vector3(0, 1, 0) }, uZenith: { value: new Color() }, uHorizon: { value: new Color() },
    uRip: rip.uniform, uSky: { value: skyTex }, uHeight: { value: heightTex },
  };
  const mat = (kind, colors) => new ShaderMaterial({
    transparent: true, depthWrite: false, fog: true, defines: { [kind]: 1 }, vertexShader: VERT, fragmentShader: FRAG,
    uniforms: Object.assign(UniformsUtils.merge([UniformsLib.fog]), S, { uFall: { value: new Vector3() } }, Object.fromEntries(['uShallow', 'uMid', 'uDeep'].map((k, i) => [k, { value: new Color(colors[i]) }]))),
  });
  const seaMat = mat('SEA', ['#5fe3cf', '#1fa3c8', '#0a2f6b']), lakeMat = mat('LAKE', ['#59d6b0', '#1f9aa0', '#0b4a66']), riverMat = mat('RIVER', ['#7fe0c0', '#38b0b8', '#1a7f9c']);
  if (fi) lakeMat.uniforms.uFall.value.set(fi.px, fi.pz, 5);

  const sea = new Mesh(buildSea(), seaMat); sea.frustumCulled = false; sea.renderOrder = 1;
  const lakeMesh = new Mesh(buildLake(lake, hAt, surfaceAt), lakeMat); lakeMesh.renderOrder = 1;
  const riverMesh = new Mesh(buildRibbons(rivers, hAt, surfaceAt), riverMat); riverMesh.renderOrder = 1;
  const fall = fi ? createWaterfall(S, fi) : null;
  const group = new Group();
  group.add(sea, lakeMesh, riverMesh);
  if (fall) group.add(fall.group);
  const tris = [sea, lakeMesh, riverMesh].reduce((a, m) => a + m.geometry.index.count / 3, 0) + (fall ? 48 * 2 + 40 * 2 : 0);

  const tmp = new Color();
  return {
    mesh: group, group, info: { drawCalls: fall ? 5 : 3, triangles: tris },
    // p = the shared palette (zenith, horizon, sunColor, sunIntensity, sunDir, lightDir, ambient, stars, snow); cam = camera or position
    update(p, time, cam) {
      S.uTime.value = time; rip.setTime(time);
      S.uZenith.value.set(p.zenith); S.uHorizon.value.set(p.horizon); S.uSunRaw.value.set(p.sunColor);
      S.uSunDir.value.copy(p.sunDir); const L = p.lightDir || p.sunDir; S.uLDir.value.copy(L);
      S.uLCol.value.set(p.sunColor).multiplyScalar(p.sunIntensity ?? 1);
      S.uDay.value = clamp01((p.sunDir.y + 0.1) / 0.35); S.uStars.value = p.stars || 0; S.uSnow.value = p.snow || 0;
      const l = S.uLight.value.set(p.ambient).multiplyScalar(0.55), k = 0.6 * clamp01(L.y * 2), c = S.uLCol.value;
      l.r += c.r * k + 0.03; l.g += c.g * k + 0.03; l.b += c.b * k + 0.05;
      const f = S.uFoam.value.copy(tmp.copy(l).multiplyScalar(1.7).addScalar(0.15));
      f.r = Math.min(1, f.r); f.g = Math.min(1, f.g); f.b = Math.min(1, f.b);
      if (cam) { const q = cam.position || cam; sea.position.set(Math.round(q.x / 4) * 4, 0, Math.round(q.z / 4) * 4); }
      if (fall) fall.update(time);
    },
    ripple(x, z, strength = 1) { rip.add(x, z, strength); },
    dispose() {
      for (const m of [sea, lakeMesh, riverMesh]) { m.geometry.dispose(); m.material.dispose(); }
      heightTex.dispose(); skyTex.dispose(); if (fall) fall.dispose();
    },
  };
}
