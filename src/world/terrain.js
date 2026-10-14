import { BufferGeometry, BufferAttribute, Mesh, Color, DataTexture, RGBAFormat, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, ShaderMaterial, UniformsUtils, UniformsLib, Vector3 } from 'three';
import { heightAt, zoneAt, woods, LANDMARKS, SEA_STACKS } from './island.js';
import { CHUNK, VIEW_RADIUS, chunkKey, chunksAround, lodFor } from './chunks.js';

const STEP = [1, 2, 4]; // metres between vertices per lod; each grid is a subset of the finer one
const GROVE = { x: -72, z: -30 };
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

// Per-vertex zone WEIGHTS (the fragment shader does the actual painting, so borders stay crisp).
// wa = unused, rock, sand, snow; wb = ember, path, forest, black sand; au = curvature (+ = gully), grove.
// Grass is implicit: 1 - the largest other weight.
function weigh(x, z, h, curv, wa, wb, au, k) {
  const zone = zoneAt(x, z), r = Math.hypot(x, z), lo = Math.sin(x * 0.09 + 2 * Math.sin(z * 0.05 + 1)) * Math.sin(z * 0.1 + 2 * Math.sin(x * 0.06));
  const vil = 1 - smooth(30, 40, r);
  let rock = 0, sand = 0, snow = 0, ember = 0, black = 0, grove = 0;
  let path = smooth(-0.2, 0.5, lo) * 0.8 * vil, forest = smooth(-0.2, 0.9, woods(x, z)) * (1 - vil);
  const low = (t) => { path *= t; forest *= t; }; // fade lowland detail where sand takes over
  switch (zone) {
    case 'sea': sand = 1; low(0); break;
    case 'beach': {
      const t = smooth(0.3, 1, h), bl = 1 - smooth(25, 55, Math.hypot(x - LANDMARKS.beach.x, z - LANDMARKS.beach.z));
      sand = (1 - t) * (1 - bl); black = (1 - t) * bl; low(t); break;
    }
    case 'cove': { const t = smooth(1.5, 3, h); sand = 1 - t; low(t); break; }
    case 'grove': grove = 1 - smooth(14, 24, Math.hypot(x - GROVE.x, z - GROVE.z)); forest = forest * (1 - grove) + 0.35 * grove; break;
    case 'roost': rock = smooth(8, 18, h); break;
    case 'tower': rock = 0.55 * (1 - smooth(8, 16, Math.hypot(x - LANDMARKS.tower.x, z - LANDMARKS.tower.z))); break;
    case 'glacier': snow = 1; break;
  }
  if (zone !== 'glacier') { rock = Math.max(rock, smooth(25, 55, h)); snow = Math.max(snow, smooth(50, 80, h) * 0.9); }
  rock *= 1 - snow;
  { const hi = Math.max(smooth(30, 50, h), snow, rock); forest *= 1 - hi; path *= 1 - hi; }
  if (zone !== 'sea') ember = 1 - smooth(32, 46, Math.hypot(x - 98, z - 8));
  const nv = 1 - ember; rock *= nv; sand *= nv; black *= nv; path *= nv; forest *= nv;
  for (const s of SEA_STACKS) { // sea stacks read as rock whatever the zone says
    const q = (x - s.x) ** 2 + (z - s.z) ** 2;
    if (q < 100) { rock = Math.max(rock, 2 * smooth(100, 36, q)); break; }
  }
  wa[k] = 0; wa[k + 1] = rock; wa[k + 2] = sand; wa[k + 3] = snow;
  wb[k] = ember; wb[k + 1] = path; wb[k + 2] = forest; wb[k + 3] = black;
  au[k / 2] = curv; au[k / 2 + 1] = grove;
}

// Chunk mesh. Seams between lods are hidden with skirts: a downward strip around the border
// (depth 1 + 2 * step) that copies the edge vertex data. Returns null when the whole
// chunk is deep under the sea (the opaque water hides it), which saves draw calls.
export function buildChunkMesh(cx, cz, lod, material) {
  const step = STEP[lod], n = CHUNK / step, V = n + 1, ox = cx * CHUNK, oz = cz * CHUNK;
  // heights on a grid padded by one step (lod 0 takes its normals from it)
  const P = n + 3, hs = new Float32Array(P * P);
  let hmax = -Infinity;
  for (let j = 0; j < P; j++) for (let i = 0; i < P; i++) hmax = Math.max(hmax, hs[j * P + i] = heightAt(ox + (i - 1) * step, oz + (j - 1) * step));
  if (hmax < -4) return null;
  const skirt = 1 + 2 * step, nv = V * V + 4 * V;
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), wa = new Float32Array(nv * 4), wb = new Float32Array(nv * 4), au = new Float32Array(nv * 2);
  for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) {
    const k = j * V + i, hp = (j + 1) * P + i + 1, h = hs[hp];
    // normals and curvature use fixed baselines (1 m, 3 m), so a vertex shared by two lods gets identical data
    const wx = ox + i * step, wz = oz + j * step;
    const nx = step === 1 ? hs[hp - 1] - hs[hp + 1] : heightAt(wx - 1, wz) - heightAt(wx + 1, wz);
    const nz = step === 1 ? hs[hp - P] - hs[hp + P] : heightAt(wx, wz - 1) - heightAt(wx, wz + 1), ny = 2, l = Math.hypot(nx, ny, nz);
    pos.set([i * step, h, j * step], k * 3);
    nor.set([nx / l, ny / l, nz / l], k * 3);
    const lap = (heightAt(wx - 3, wz) + heightAt(wx + 3, wz) + heightAt(wx, wz - 3) + heightAt(wx, wz + 3)) / 4 - h;
    weigh(wx, wz, h, Math.max(-1, Math.min(1, lap / 1.5)), wa, wb, au, k * 4);
  }
  const idx = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = j * V + i, b = a + V, c = a + 1, d = b + 1;
    idx.push(a, b, c, c, b, d);
  }
  // skirt edges ordered so each strip faces outward: north +x, east +z, south -x, west -z
  const edges = [
    Array.from({ length: V }, (_, i) => i),
    Array.from({ length: V }, (_, j) => j * V + n),
    Array.from({ length: V }, (_, i) => n * V + n - i),
    Array.from({ length: V }, (_, j) => (n - j) * V),
  ];
  let s = V * V;
  for (const e of edges) {
    for (let m = 0; m < V; m++, s++) {
      const t = e[m];
      pos.set([pos[t * 3], pos[t * 3 + 1] - skirt, pos[t * 3 + 2]], s * 3);
      nor.set(nor.subarray(t * 3, t * 3 + 3), s * 3);
      wa.set(wa.subarray(t * 4, t * 4 + 4), s * 4);
      wb.set(wb.subarray(t * 4, t * 4 + 4), s * 4);
      au.set(au.subarray(t * 2, t * 2 + 2), s * 2);
      if (m < V - 1) idx.push(e[m], e[m + 1], s, e[m + 1], s + 1, s);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('normal', new BufferAttribute(nor, 3));
  g.setAttribute('wa', new BufferAttribute(wa, 4));
  g.setAttribute('wb', new BufferAttribute(wb, 4));
  g.setAttribute('aux', new BufferAttribute(au, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  const mesh = new Mesh(g, material);
  mesh.position.set(ox, 0, oz);
  return mesh;
}

// One 128 px RGBA random tile (4 independent channels) is the only texture: every pattern below is
// thresholded bilinear noise from it, no image files.
function noiseTile() {
  const N = 128, d = new Uint8Array(N * N * 4);
  let s = 12345;
  for (let i = 0; i < d.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = s >>> 24; }
  const t = new DataTexture(d, N, N, RGBAFormat);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.minFilter = LinearMipmapLinearFilter; t.magFilter = LinearFilter;
  t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

// Fragment cost: no loops; grass about 10 texture reads, rock about 9 more, each layer skipped when its weight is ~0.
const FRAG = `
#include <fog_pars_fragment>
uniform sampler2D uNoise; uniform vec3 uSunDir, uSunColor, uAmbient, uGround; uniform float uSnow;
varying vec4 vA, vB; varying vec2 vAux; varying vec3 vN, vW;
vec3 S(vec3 c){ return pow(c, vec3(2.2)); }                       // sRGB-written colours -> linear
vec4 T(vec2 p, float f){ return texture2D(uNoise, p * f / 128.); } // f = features per metre
void main(){
  vec3 N = normalize(vN); vec2 p = vW.xz; float h = vW.y;
  float dist = length(cameraPosition - vW), det = 1. - smoothstep(30., 110., dist);
  vec4 big = T(p, .05), mid = T(p, .4), fine = T(p, 1.9);
  float eN = (mid.r - .5) * .3 + (fine.g - .5) * .05; // wobble for hand-painted borders
  // weights: grass implicit; slope rock per pixel; ragged snow line with streaks in gullies
  float steep = smoothstep(.9, .72, N.y + (mid.b - .5) * .1) * (1. - vB.x);
  float rock = max(vA.y, steep), sand = vA.z, ember = vB.x, path = vB.y, forest = vB.z, blk = vB.w;
  float snow = vA.w + eN * 1.4 + max(vAux.x, 0.) * .4 * smoothstep(30., 60., h) - steep * .35;
  snow = max(snow, 0.) * step(.02, vA.w + max(vAux.x, 0.) * smoothstep(30., 60., h));
  rock *= 1. - smoothstep(.3, .6, snow);
  float gr = max(0., 1. - max(max(max(rock, sand), max(snow, ember)), max(max(path, forest), blk))) * (1. - smoothstep(35., 60., h)); // no grass tufts on the high mountain
  vec4 w1 = pow(max(vec4(gr, rock, sand, snow) + vec4(0., eN, eN, 0.), 0.), vec4(12.));
  vec4 w2 = pow(max(vec4(ember, path, forest, blk) + eN, 0.), vec4(12.));
  float tot = dot(w1, vec4(1.)) + dot(w2, vec4(1.)) + 1e-9;
  w1 /= tot; w2 /= tot; // normalised first, so skipping a near-zero layer cannot darken the pixel
  vec3 col = vec3(0.), emis = vec3(0.);
  if (w1.x > .01) { // grass: tone patches, stroke stipple with light tips, flower speckle
    vec3 g = mix(S(vec3(.38,.72,.27)), S(vec3(.52,.80,.30)), smoothstep(.42,.5,big.r));
    g = mix(g, S(vec3(.72,.76,.34)), smoothstep(.66,.7,big.g) * .7);
    g = mix(g, S(vec3(.25,.76,.50)), vAux.y);
    vec4 st = texture2D(uNoise, vec2(p.x * 6., p.y * 2.2) / 128.);
    g = mix(g, g * 1.35 + .03, smoothstep(.6,.64,st.b) * det);
    g = mix(g, g * .7, smoothstep(.3,.26,T(p, 5.).r) * det);
    float fl = smoothstep(.93,.95,T(p, 4.3).a) * det;
    g = mix(g, mix(vec3(1.,.95,.9), mix(vec3(1.,.85,.25), vec3(1.,.55,.7), step(.5, fine.b)), step(.35, mid.g)), fl);
    col += w1.x * g;
  }
  if (w2.z > .01) { // forest floor: dark green with dapples
    vec3 f = mix(S(vec3(.16,.42,.22)), S(vec3(.24,.52,.26)), smoothstep(.4,.6,mid.g));
    f = mix(f, f * .6, smoothstep(.42,.38,T(p, 2.1).g) * det);
    f = mix(f, f * 1.4, smoothstep(.72,.76,T(p, 4.).b) * det);
    col += w2.z * f;
  }
  if (w2.y > .01) { // village path: packed earth with pebbles
    vec3 pa = S(vec3(.80,.62,.38));
    pa = mix(pa, pa * .8, smoothstep(.7,.74,T(p, 5.).g) * det);
    pa = mix(pa, pa * 1.15, smoothstep(.75,.78,T(p, 3.).r));
    col += w2.y * pa;
  }
  if (w1.z + w2.w > .01) { // sand + black sand: ripple lines, glitter, wet near the waterline
    float rip = sin(dot(p, vec2(.6,.8)) * 5.5 + big.b * 40. + mid.r * 3.) * .5 + .5;
    float lines = smoothstep(.86,.9,rip) * det;
    vec3 sd = mix(S(vec3(.94,.85,.62)), S(vec3(.80,.69,.46)), smoothstep(.5,-.6,h));
    sd = mix(sd, sd * .86, lines);
    vec3 bk = mix(S(vec3(.20,.18,.24)), S(vec3(.12,.11,.15)), lines);
    bk = mix(bk, S(vec3(.5,.45,.6)), smoothstep(.9,.92,T(p, 8.).a) * det);
    col += w1.z * sd + w2.w * bk;
  }
  if (w1.y + w2.x > .01) { // rock + ember rock: triplanar cracks, chiselled facets, height strata
    vec3 tw = pow(abs(N), vec3(5.)); tw /= tw.x + tw.y + tw.z;
    vec4 a = T(vec2(vW.z, h), .3), b = T(vec2(vW.x, h), .3), c = T(vW.xz, .3);
    float crk = a.r * tw.x + b.r * tw.z + c.r * tw.y, fac = a.g * tw.x + b.g * tw.z + c.g * tw.y;
    float line = 1. - smoothstep(0., .035, abs(crk - .5));
    float tone = floor(fac * 4.) / 4.;
    float band = sin(h * 1.3 + big.r * 12. + mid.g * 3.) + .5 * sin(h * 3.1 + big.g * 7.);
    float gul = clamp(vAux.x, 0., 1.), rid = clamp(-vAux.x, 0., 1.);
    vec3 rc = mix(S(vec3(.58,.50,.52)), S(vec3(.70,.59,.49)), smoothstep(-.7,.7,band));
    rc *= (.7 + .5 * tone) * (1. - .4 * gul) * (1. + .25 * rid) * (1. - .5 * line * mix(.4, 1., det));
    vec3 ec = mix(S(vec3(.26,.17,.20)), S(vec3(.40,.24,.24)), smoothstep(-.2,.2,band));
    ec *= (.8 + .35 * tone) * (1. - .4 * line);
    col += w1.y * rc + w2.x * ec;
    emis += w2.x * line * smoothstep(44., 14., length(p - vec2(98., 8.))) * S(vec3(1., .4, .1)) * 1.4; // glowing veins
  }
  if (w1.w > .01) { // snow: white with cool violet-blue shade tones
    float sh = smoothstep(.95, .55, N.y) * .7 + smoothstep(.45,.4,T(p, 1.2).g) * .15;
    col += w1.w * mix(S(vec3(.97,.98,1.)), S(vec3(.66,.74,.95)), sh);
  }
  if (uSnow > .01) { // ground snow cover: up-facing, above the waterline, ragged edge
    float cov = uSnow * smoothstep(.62, .85, N.y + eN * .5) * smoothstep(.2, 1.1, h + mid.g * .5) * (1. - blk * .6) * (1. - w2.x);
    vec3 sn = mix(S(vec3(.98,.99,1.)), S(vec3(.70,.79,.97)), smoothstep(.95, .75, N.y) * .8 + smoothstep(.5, .75, big.r) * .5 + smoothstep(.55, .62, mid.b) * .25); // drifts and shade pools
    sn = mix(sn, sn * 1.25 + .05, smoothstep(.9, .93, T(p, 7.).a) * det);                                           // sparkle
    col = mix(col, sn, cov);
  }
  // cel lighting: 4 steps, cool tinted shade, warm sun (colour choices are ACES-aware)
  float nd = dot(N, uSunDir);
  float band4 = (smoothstep(-.14,-.1,nd) + smoothstep(.1,.14,nd) + smoothstep(.4,.44,nd)) / 3.;
  vec3 amb = mix(uGround, uAmbient, N.y * .5 + .5);
  col *= amb * .7 + uSunColor * (.8 * band4);
  // lava in the crater, emissive
  float d = length(p - vec2(98., 8.));
  vec3 lv = mix(S(vec3(1.,.28,.05)), S(vec3(1.,.8,.25)), smoothstep(.4,.7,T(p, .6).g)) * 1.6;
  lv = mix(S(vec3(.25,.07,.05)), lv, smoothstep(.38,.5,T(p, .9).r));
  col = mix(col + emis, lv, smoothstep(11., 8.5, d));
  // warmer near, cooler and bluer far (then the fog takes over)
  col *= mix(vec3(1.05,1.,.93), vec3(.86,.93,1.1), smoothstep(20., 200., dist));
  gl_FragColor = vec4(col, 1.);
  #include <fog_fragment>
}`;

// One material for every chunk. update(palette) feeds sun and ambient; fog comes from scene.fog.
export function createTerrainMaterial() {
  const m = new ShaderMaterial({
    fog: true,
    uniforms: UniformsUtils.merge([UniformsLib.fog, {
      uNoise: { value: noiseTile() }, uSunDir: { value: new Vector3(0, 1, 0) }, uSunColor: { value: new Color() },
      uAmbient: { value: new Color() }, uGround: { value: new Color() }, uSnow: { value: 0 },
    }]),
    vertexShader: `
      #include <fog_pars_vertex>
      attribute vec4 wa, wb; attribute vec2 aux;
      varying vec4 vA, vB; varying vec2 vAux; varying vec3 vN, vW;
      void main(){
        vA = wa; vB = wb; vAux = aux; vN = normal;
        vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz;
        vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: FRAG,
  });
  const u = m.uniforms;
  m.update = (p) => {
    u.uSunDir.value.copy(p.lightDir || p.sunDir); u.uSunColor.value.set(p.sunColor).multiplyScalar(p.sunIntensity ?? 1); u.uSnow.value = p.snow || 0; u.uAmbient.value.set(p.ambient);
    u.uGround.value.set(p.ambient).multiplyScalar(0.55).lerp(new Color('#8a6a48'), 0.35);
  };
  return m;
}

// Streams chunks around the camera: at most 2 builds per frame, nearest first.
export class ChunkManager {
  constructor(scene, material, radius = VIEW_RADIUS) {
    Object.assign(this, { scene, material, radius, map: new Map(), built: 0, wanted: 0 });
  }
  update(cam) {
    const want = chunksAround(cam.x, cam.z, this.radius), keep = new Set(chunksAround(cam.x, cam.z, this.radius + 24).map((c) => chunkKey(c.cx, c.cz)));
    for (const [k, e] of this.map) if (!keep.has(k)) { this.#drop(e); this.map.delete(k); }
    let budget = 2, built = 0;
    for (const { cx, cz } of want) {
      const k = chunkKey(cx, cz), e = this.map.get(k), d = Math.hypot((cx + 0.5) * CHUNK - cam.x, (cz + 0.5) * CHUNK - cam.z);
      // keep the current lod while within 8 m of a band edge (no flip-flopping)
      if (e && lodFor(d - 8) <= e.lod && e.lod <= lodFor(d + 8)) { built++; continue; }
      if (budget === 0) continue;
      budget--;
      const lod = lodFor(d), mesh = buildChunkMesh(cx, cz, lod, this.material);
      if (e) this.#drop(e);
      if (mesh) this.scene.add(mesh);
      this.map.set(k, { mesh, lod });
      built++;
    }
    this.built = built;
    this.wanted = want.length;
  }
  #drop(e) { if (e.mesh) { this.scene.remove(e.mesh); e.mesh.geometry.dispose(); } }
  dispose() { for (const e of this.map.values()) this.#drop(e); this.map.clear(); }
}
