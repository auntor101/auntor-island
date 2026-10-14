import { BufferGeometry, BufferAttribute, Mesh, Color, DataTexture, RGBAFormat, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, ShaderMaterial, UniformsUtils, UniformsLib, Vector3 } from 'three';
import { CHUNK, VIEW_RADIUS, chunkKey, chunksAround, lodFor, buildChunkData } from './chunks.js';

const toMesh = (d, cx, cz, material) => {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(d.pos, 3));
  g.setAttribute('normal', new BufferAttribute(d.nor, 3));
  g.setAttribute('wa', new BufferAttribute(d.wa, 4));
  g.setAttribute('wb', new BufferAttribute(d.wb, 4));
  g.setAttribute('aux', new BufferAttribute(d.au, 2));
  g.setIndex(new BufferAttribute(d.idx, 1));
  g.computeBoundingSphere();
  const mesh = new Mesh(g, material);
  mesh.position.set(cx * CHUNK, 0, cz * CHUNK);
  return mesh;
};
// Sync build (tests, and the fallback when workers are unavailable).
export function buildChunkMesh(cx, cz, lod, material) {
  const d = buildChunkData(cx, cz, lod);
  return d && toMesh(d, cx, cz, material);
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
  float rock = smoothstep(.34, .5, max(vA.y, steep) + (mid.r - .5) * .5 + (fine.r - .5) * .16), sand = vA.z, ember = vB.x, path = vB.y, forest = vB.z, blk = vB.w;
  float snow = vA.w + (mid.r - .5) * 1.1 + (big.g - .5) * .7 + max(vAux.x, 0.) * .75 * smoothstep(30., 60., h) - steep * .35;
  snow = max(snow, 0.) * step(.02, vA.w + max(vAux.x, 0.) * smoothstep(30., 60., h));
  rock *= 1. - smoothstep(.3, .6, snow);
  forest *= 1. - rock; path *= 1. - rock; // no forest floor veil over rock
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
  float rockW = w1.y + w2.x;
  if (rockW > .01) { // rock: warped strata of varied tone, chiselled cracks, crevices, light mossy ledge tops, scree, ink-dark ridges
    vec3 tw = pow(abs(N), vec3(5.)); tw /= tw.x + tw.y + tw.z;
    vec4 a = T(vec2(vW.z, h), .3), b = T(vec2(vW.x, h), .3), c = T(vW.xz, .3);
    float crk = a.r * tw.x + b.r * tw.z + c.r * tw.y, fac = a.g * tw.x + b.g * tw.z + c.g * tw.y, wv = a.b * tw.x + b.b * tw.z + c.b * tw.y;
    float line = 1. - smoothstep(0., .035, abs(crk - .5));
    float tone = floor(fac * 4.) / 4.;
    float sy = h * .4 + (big.r - .5) * 3.2 + (wv - .5) * 2.4 + (mid.g - .5) * .9;       // strata coordinate, warped so bands wander and pinch
    sy += .4 * sin(sy * 1.9 + wv * 5.);
    float bi = floor(sy), bf = fract(sy);
    float bh = fract(sin(bi * 12.9898) * 43758.5453), bh2 = fract(sin(bi * 78.233 + 4.1) * 24634.6345);
    float seam = 1. - smoothstep(0., .09, bf);
    float gul = clamp(vAux.x, 0., 1.), rid = clamp(-vAux.x, 0., 1.);
    float flat_ = smoothstep(.8, .92, N.y), scree = smoothstep(.6, .78, N.y) * (1. - flat_);
    vec3 rc = mix(S(vec3(.50,.46,.44)), S(vec3(.68,.60,.49)), bh);                       // warm basalt to sandstone
    rc = mix(rc, S(vec3(.42,.45,.49)), step(.8, bh2) * .7);
    rc = mix(rc, S(vec3(.66,.43,.30)), step(.86, fract(bh * 7.3 + bh2 * 3.1)) * .65);   // rusty iron band                              // the odd cold slate band
    rc *= (.86 + .26 * bh2) * (.8 + .35 * tone);
    rc *= 1. - .45 * seam * (1. - flat_) - .35 * line * mix(.4, 1., det) - .4 * gul;     // seams, chiselled cracks, crevices
    rc *= 1. - .5 * smoothstep(.45, 1., rid) * (1. - flat_);                             // ink-dark convex ridges
    rc = mix(rc, rc * (.7 + .6 * T(p, 6.).g), scree * det);                              // pebbly scree below the cliffs
    vec3 moss = mix(S(vec3(.34,.60,.24)), S(vec3(.50,.74,.28)), mid.b);
    rc = mix(rc * 1.12, moss, flat_ * smoothstep(.4, .55, mid.b + big.b * .3) * (1. - smoothstep(40., 70., h)) * .9);
    vec3 ec = mix(S(vec3(.26,.17,.20)), S(vec3(.40,.24,.24)), smoothstep(.3,.7,bh));
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
  float rel = h - vA.x;
  if (rel < .8) {
    float flatK = smoothstep(.45, .75, N.y), under = smoothstep(.05, -.15, rel) * flatK, wet = smoothstep(.8, .1, rel) * (1. - under) * flatK; // steep faces stay rock (the falls are drawn by the water)
    vec3 bed = mix(S(vec3(.84,.77,.58)), S(vec3(.26,.48,.52)), smoothstep(-.2, -2.6, rel)); // sunlit sand to deep teal
    bed = mix(bed, bed * 1.3, smoothstep(.74, .78, T(p, 3.).b) * (1. - smoothstep(-.2, -1.2, rel)));   // pale pebbles
    col = mix(col * mix(1., .58, wet), bed, under);
  }
  // cel lighting: 4 steps, cool tinted shade, warm sun (colour choices are ACES-aware)
  float nd = dot(N, uSunDir);
  float band4 = (smoothstep(-.14,-.1,nd) + smoothstep(.1,.14,nd) + smoothstep(.4,.44,nd)) / 3.;
  vec3 amb = mix(uGround, uAmbient, N.y * .5 + .5);
  col *= amb * .7 + uSunColor * (.8 * band4);
  col *= mix(vec3(1.), vec3(.88, .93, 1.08), (1. - band4) * clamp(rockW + w1.w, 0., 1.)); // cold blue shadow on rock and snow
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

// Streams chunks around the camera. Geometry is built in 2 workers (falls back to the main thread if they cannot start);
// the main thread only wraps the arrays and uploads, at most 2 meshes per frame, nearest first.
// ready = every wanted chunk is built at its lod; progress = built / wanted; meshMs / meshes = main-thread cost per chunk so far
// (mesh wrap + upload with workers, the whole build without); mainMs = all of update().
export class ChunkManager {
  constructor(scene, material, radius = VIEW_RADIUS, workers = 2) {
    Object.assign(this, { scene, material, radius, map: new Map(), built: 0, wanted: 0, ready: false, progress: 0, mainMs: 0, meshMs: 0, meshes: 0, inbox: [], pool: [], seq: 0 });
    try {
      if (workers > 0 && typeof Worker !== 'undefined') for (let i = 0; i < workers; i++) {
        const w = new Worker(new URL('./terrain-worker.js', import.meta.url), { type: 'module' });
        w.busy = 0;
        w.onmessage = (e) => { w.busy--; this.inbox.push(e.data); };
        w.onerror = () => this.#fallback();
        this.pool.push(w);
      }
    } catch { this.#fallback(); }
  }
  #fallback() { // workers unusable: drop them; pending requests are re-issued on the main thread
    for (const w of this.pool) w.terminate();
    this.pool = [];
    for (const e of this.map.values()) e.pend = null;
  }
  update(cam) {
    const t0 = performance.now();
    const want = chunksAround(cam.x, cam.z, this.radius), keep = new Set(chunksAround(cam.x, cam.z, this.radius + 24).map((c) => chunkKey(c.cx, c.cz)));
    for (const [k, e] of this.map) if (!keep.has(k)) { this.#drop(e); this.map.delete(k); }
    // finished worker jobs: at most 2 uploads per frame
    for (let n = 0; n < 2 && this.inbox.length; n++) {
      const { id, d } = this.inbox.shift(), e = this.map.get(id.k);
      if (!e || e.pend !== id.n) continue; // dropped or superseded while in flight
      const m0 = performance.now();
      this.#put(e, id.cx, id.cz, id.lod, d && toMesh(d, id.cx, id.cz, this.material));
      this.meshMs += performance.now() - m0;
    }
    let budget = 2, built = 0;
    for (const { cx, cz } of want) {
      const k = chunkKey(cx, cz);
      let e = this.map.get(k);
      const d = Math.hypot((cx + 0.5) * CHUNK - cam.x, (cz + 0.5) * CHUNK - cam.z), lod = lodFor(d);
      // keep the current lod while within 8 m of a band edge (no flip-flopping)
      if (e && e.lod !== undefined && lodFor(d - 8) <= e.lod && e.lod <= lodFor(d + 8)) { built++; continue; }
      if (!e) this.map.set(k, e = { mesh: null, lod: undefined, pend: null });
      if (this.pool.length) {
        if (e.pend && e.lodWant === lod) continue;
        const w = this.pool.reduce((p, q) => (q.busy < p.busy ? q : p));
        if (w.busy >= 3) continue;
        e.pend = ++this.seq; e.lodWant = lod; w.busy++;
        w.postMessage({ id: { k, n: e.pend, cx, cz, lod }, cx, cz, lod });
      } else if (budget > 0) {
        budget--;
        const m0 = performance.now();
        this.#put(e, cx, cz, lod, buildChunkMesh(cx, cz, lod, this.material));
        this.meshMs += performance.now() - m0;
        built++;
      }
    }
    this.built = built;
    this.wanted = want.length;
    this.progress = built / Math.max(1, want.length);
    this.ready = built === want.length;
    this.mainMs += performance.now() - t0;
  }
  #put(e, cx, cz, lod, mesh) {
    if (e.mesh) this.#drop(e);
    if (mesh) this.scene.add(mesh);
    Object.assign(e, { mesh, lod, pend: null });
    this.meshes++;
  }
  #drop(e) { if (e.mesh) { this.scene.remove(e.mesh); e.mesh.geometry.dispose(); e.mesh = null; } }
  dispose() { for (const e of this.map.values()) this.#drop(e); this.map.clear(); for (const w of this.pool) w.terminate(); this.pool = []; }
}
