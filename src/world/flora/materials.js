// Shaders for the flora. One shared uniform set (light, season, wind, player) drives every material.
// Instances come from one interleaved buffer per pool: iA = (x, y, z, rotY), iB = (scale, seed, extra1, extra2).
import { ShaderMaterial, UniformsLib, Color, Vector3, Vector4, DoubleSide, AdditiveBlending } from 'three';

export function createUniforms() {
  return {
    uTime: { value: 0 }, uLightDir: { value: new Vector3(0, 1, 0) }, uSun: { value: new Color() }, uAmb: { value: new Color() },
    uSnow: { value: 0 }, uForce: { value: -1 }, uNight: { value: 0 }, uPlayer: { value: new Vector4(0, -999, 0, 1.4) }, uRange: { value: 35 }, uWind: { value: 1 },
  };
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const glsl = (h) => 'pow(vec3(' + hex(h).map((v) => v.toFixed(3)).join(',') + '),vec3(2.2))'; // sRGB -> linear, built-ins only so it can sit in a const
// [shadow, mid, light] x two variants per season: summer, autumn, spring blossom, grove blossom
const LEAF = [
  ['#2a7a3c', '#47a83e', '#a8dc52', '#2a6e48', '#56b452', '#cde870'],
  ['#a04a20', '#ec8c22', '#ffd650', '#822a28', '#d24a30', '#f89440'],
  ['#ec9cc0', '#f8b6d0', '#ffe8f2', '#eeaccb', '#fbcade', '#fff4f8'],
  ['#f2a8c8', '#fcc8de', '#ffffff', '#ecb0d0', '#f9d4e8', '#fff8fe'],
];
const GRASS = [['#1f6026', '#8cd24c'], ['#3f5a1c', '#c4b444'], ['#2b7c36', '#bce86e'], ['#2a7c4c', '#a8f0b0']];
const FLOWER = ['#fff4dc', '#ffd23a', '#ff7fb0', '#a284ff', '#ff6a44', '#62a8ff', '#8affe4'];
const arr = (list) => 'vec3[' + list.length + '](' + list.map(glsl).join(',') + ')';

const COMMON = `
vec3 S(vec3 c){ return pow(c, vec3(2.2)); }
vec3 yaw(vec3 v, float a){ float c = cos(a), s = sin(a); return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z); }
float cel(float nd){ return (smoothstep(-.14, -.1, nd) + smoothstep(.1, .14, nd) + smoothstep(.4, .44, nd)) / 3.; }
`;
const FRAG_UNI = `uniform vec3 uLightDir, uSun, uAmb; uniform float uSnow, uForce, uNight, uTime;`;
const trample = `
  vec2 pd = wp.xz - uPlayer.xz; float pl = length(pd);
  float push = (1. - smoothstep(.15, uPlayer.w, pl));`;

// ---------- trees, bushes, ferns, rocks, mushrooms, dead wood: textured geometry from the models ----------
export function foliageMaterial(shared, { map, atlas = false, recolor = false, rock = false, vcol = false, sway = 1 }) {
  const defines = {};
  if (atlas) defines.ATLAS = 1;
  if (recolor) defines.RECOLOR = 1;
  if (rock) defines.ROCK = 1;
  if (vcol) defines.VCOL = 1;
  return new ShaderMaterial({
    fog: true, side: DoubleSide, vertexColors: true, defines,
    uniforms: { ...UniformsLib.fog, ...shared, map: { value: map }, uSway: { value: sway } },
    vertexShader: `
      #include <fog_pars_vertex>
      attribute vec4 iA, iB; uniform float uTime, uSway;
      varying vec2 vUv; varying vec3 vN, vW; varying vec4 vC; varying float vSeed, vSea;
      ${COMMON}
      void main(){
        vec3 p = position * iB.x;
        float lift = clamp(position.y / 9., 0., 1.);
        float w = sin(uTime * 1.2 + iA.x * .21 + iA.z * .17 + iB.y * 6.28) * .5 + sin(uTime * .53 + iA.x * .07) * .5;
        p.x += w * .12 * lift * lift * iB.x * uSway;
        p += vec3(sin(uTime * 2.1 + position.y * 3. + iB.y * 9.), 0., cos(uTime * 1.7 + position.x * 3.)) * .035 * iB.x * color.r * uSway; // leaf flutter
        vec3 wp = yaw(p, iA.w) + iA.xyz;
        vN = yaw(normal, iA.w); vUv = uv; vC = color; vSeed = iB.y; vSea = iB.z; vW = wp;
        vec4 mvPosition = viewMatrix * vec4(wp, 1.);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <fog_pars_fragment>
      uniform sampler2D map; ${FRAG_UNI}
      varying vec2 vUv; varying vec3 vN, vW; varying vec4 vC; varying float vSeed, vSea;
      ${COMMON}
      const vec3 LEAF[24] = vec3[24](${LEAF.flat().map(glsl).join(',')});
      vec3 ramp(int i, float b){ return b < .5 ? mix(LEAF[i], LEAF[i + 1], b * 2.) : mix(LEAF[i + 1], LEAF[i + 2], b * 2. - 1.); }
      void main(){
        vec2 u = vec2(vUv.x * 16. - 8., vUv.y * 68. - 64.);
        bool leaf = vC.r > .5;
        vec2 g1 = dFdx(u), g2 = dFdy(u), uv;
        #ifdef ATLAS
          uv = vec2((leaf ? .5 : 0.) + .5 * (.02 + .96 * fract(u.x)), .01 + .98 * fract(u.y)); g1 *= vec2(.48, .98); g2 *= vec2(.48, .98);
        #else
          uv = fract(u);
        #endif
        vec4 t = textureGrad(map, uv, g1, g2);
        #ifndef VCOL
        if (vC.b > .5 && t.a < .5) discard;
        #endif
        vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
        float nd = dot(N, uLightDir), band = cel(nd);
        vec3 alb = t.rgb;
        #ifdef VCOL
          alb = vC.rgb;
        #endif
        #ifdef RECOLOR
        if (leaf) {
          float sea = (uForce >= 0. && vSea < 2.5) ? uForce : vSea;
          int s = int(sea + .5) * 6 + (fract(vSeed * 7.31) > .5 ? 3 : 0);
          float tl = .46 + .26 * N.y + .45 * (vC.g - .75) + .12 * (fract(vSeed * 13.7) - .5) + .14 * (1. - smoothstep(.5, .95, t.a));
          tl += sea > 1.5 ? .12 : 0.;
          float b = (smoothstep(.30, .34, tl) + smoothstep(.55, .59, tl)) * .5;
          alb = ramp(s, b) * .82;
          alb = mix(alb, alb * vec3(.86, .92, 1.08), (1. - band) * (sea < 1.5 ? 1. : .35));   // cool shade (blossom stays pink)
        }
        #endif
        #ifndef RECOLOR
          if (leaf) alb = mix(alb * 2., S(vec3(.2, .46, .28)), .65);   // pine needles: the painted texture is nearly black, lift it
        #endif
        #ifdef ROCK
          alb = mix(alb, alb * vec3(.5, .38, .4), vSea);          // ember rock on the volcano
          alb *= .92 + .12 * N.y;
        #endif
        alb = mix(alb, S(vec3(.93, .96, 1.)), uSnow * smoothstep(.1, .55, N.y) * (leaf ? 1. : .6)); // snow dusting on upward faces
        vec3 amb = mix(uAmb, vec3(dot(uAmb, vec3(.33))) * vec3(1.04, 1., .93), .55); // sky blue would turn pink blossom lilac: warm the shade
        vec3 lit = amb * (.8 + .2 * (N.y * .5 + .5)) * .95 + uSun * (.8 * band);
        vec3 col = alb * lit;
        col += uSun * pow(1. - max(dot(N, V), 0.), 3.) * smoothstep(-.2, .4, nd) * (leaf ? .13 : .04); // rim
        gl_FragColor = vec4(min(col, vec3(.85)), 1.);
        #include <fog_fragment>
      }`,
  });
}

// ---------- 3D grass, tall grass and reeds: crossed ribbon blades ----------
export function grassMaterial(shared, { mul = [1, 1, 1], sway = 1, headCol = '#6b3f23' } = {}) {
  return new ShaderMaterial({
    fog: true, side: DoubleSide, vertexColors: true,
    uniforms: { ...UniformsLib.fog, ...shared, uMul: { value: new Vector3(...mul) }, uSway: { value: sway }, uHead: { value: new Color(headCol) } },
    vertexShader: `
      #include <fog_pars_vertex>
      attribute vec4 iA, iB; uniform float uTime, uRange, uSway; uniform vec4 uPlayer;
      varying float vT, vSeed, vSea, vHead; varying vec2 vUv; varying vec3 vN, vW;
      ${COMMON}
      void main(){
        float t = uv.y;
        float fade = 1. - smoothstep(uRange - 10., uRange, distance(iA.xz, cameraPosition.xz));
        vec3 p = position * iB.x; p.y *= fade; p.xz *= mix(.4, 1., fade);
        vec3 wp = yaw(p, iA.w) + iA.xyz;
        float g = sin(dot(iA.xz, vec2(.55, .83)) * .19 - uTime * 1.35) + .5 * sin(dot(iA.xz, vec2(-.8, .6)) * .53 - uTime * 2.1); // travelling gusts
        float hill = 1. + 1.4 * smoothstep(8., 40., iA.y);                                                                       // wilder on the hills
        float amp = (.13 + .09 * g) * hill * uSway * t * t * iB.x;
        wp.xz += vec2(.8, .6) * amp + vec2(-.6, .8) * sin(uTime * 3. + iA.x * 2. + iA.z + position.x * 20.) * .012 * t * hill * uSway;
        ${trample}
        wp.xz += pd / (pl + .05) * push * t * .75 * iB.x; wp.y -= push * t * t * .4 * iB.x; // trampled: bends away from the player and flattens
        vT = t; vSeed = iB.y; vSea = iB.z; vHead = color.r; vUv = uv; vW = wp;
        vN = normalize(yaw(normal, iA.w) + vec3(0., .9, 0.));
        vec4 mvPosition = viewMatrix * vec4(wp, 1.);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <fog_pars_fragment>
      ${FRAG_UNI} uniform vec3 uMul, uHead;
      varying float vT, vSeed, vSea, vHead; varying vec2 vUv; varying vec3 vN, vW;
      ${COMMON}
      const vec3 GR[8] = ${'vec3[8](' + GRASS.flat().map(glsl).join(',') + ')'};
      void main(){
        float sea = (uForce >= 0. && vSea < 2.5) ? uForce : vSea;
        int s = int(sea + .5) * 2;
        float m = fract(vSeed * 5.3);
        vec3 col = mix(GR[s], GR[s + 1], smoothstep(.0, .95, vT));
        col *= vec3(.9 + .2 * m, .96 + .1 * m, .86 + .1 * (1. - m)) * uMul;
        col *= mix(.55, 1., smoothstep(0., .4, vT));                          // dark roots
        col *= .86 + .14 * smoothstep(.04, .2, abs(vUv.x - .5));              // painted centre vein
        col = mix(col, col * 1.18, step(.86, vT));                            // light tips
        if (vHead > .5) col = uHead;
        vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
        float nd = dot(N, uLightDir), band = cel(nd);
        col = mix(col, S(vec3(.93, .96, 1.)), uSnow * .75 * smoothstep(.3, .7, vT));
        vec3 lit = uAmb * .78 + uSun * (.78 * band + .2 * pow(max(dot(-uLightDir, -V), 0.), 3.) * vT); // a little glow when backlit
        gl_FragColor = vec4(min(col * lit, vec3(.85)), 1.);
        #include <fog_fragment>
      }`,
  });
}

// ---------- flowers: cel petals on a swaying stem; the grove's glow at night ----------
export function flowerMaterial(shared) {
  return new ShaderMaterial({
    fog: true, side: DoubleSide, vertexColors: true,
    uniforms: { ...UniformsLib.fog, ...shared },
    vertexShader: `
      #include <fog_pars_vertex>
      attribute vec4 iA, iB; uniform float uTime, uRange; uniform vec4 uPlayer;
      varying float vT, vPart, vCol; varying vec2 vUv; varying vec3 vN, vW; varying float vSeed;
      ${COMMON}
      void main(){
        float t = uv.y;
        float fade = 1. - smoothstep(uRange - 10., uRange, distance(iA.xz, cameraPosition.xz));
        vec3 p = position * iB.x * (iB.z > 5.5 ? 1.5 : 1.); p *= fade;
        vec3 wp = yaw(p, iA.w) + iA.xyz;
        float g = sin(dot(iA.xz, vec2(.55, .83)) * .19 - uTime * 1.35) + .5 * sin(dot(iA.xz, vec2(-.8, .6)) * .53 - uTime * 2.1);
        wp.xz += vec2(.8, .6) * (.08 + .05 * g) * t * t * iB.x + vec2(-.6, .8) * sin(uTime * 2.3 + iA.x * 3. + iA.z * 2.) * .025 * t * t;
        ${trample}
        wp.xz += pd / (pl + .05) * push * t * .35; wp.y -= push * t * .15;
        vT = t; vPart = color.r; vCol = iB.z; vUv = uv; vW = wp; vSeed = iB.y;
        vN = normalize(yaw(normal, iA.w) + vec3(0., 1.2, 0.));
        vec4 mvPosition = viewMatrix * vec4(wp, 1.);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <fog_pars_fragment>
      ${FRAG_UNI}
      varying float vT, vPart, vCol, vSeed; varying vec2 vUv; varying vec3 vN, vW;
      ${COMMON}
      const vec3 FL[7] = ${arr(FLOWER)};
      void main(){
        vec3 col; float glow = 0.;
        if (vPart < .2) col = mix(S(vec3(.12,.36,.14)), S(vec3(.36,.66,.2)), vT);                 // stem
        else if (vPart < .5) col = mix(S(vec3(.14,.4,.16)), S(vec3(.4,.72,.22)), vUv.x);           // leaf
        else if (vPart < .8) {                                                                      // petals: darker at the heart, bright rim, stepped
          vec3 base = FL[int(vCol + .5)];
          float r = vUv.x;
          col = base * (r < .35 ? .72 : r < .7 ? 1. : 1.12);
          glow = vCol > 5.5 ? 1. : 0.;
        } else col = S(vec3(1., .78, .16));                                                          // centre
        vec3 N = normalize(vN);
        float nd = dot(N, uLightDir), band = cel(nd);
        vec3 lit = uAmb * .85 + uSun * (.7 * band);
        vec3 c = col * lit + col * glow * uNight * 1.3;
        gl_FragColor = vec4(min(c, vec3(.85)), 1.);
        #include <fog_fragment>
      }`,
  });
}

// ---------- falling petals / leaves: one Points draw, shaped in the fragment shader ----------
export function petalMaterial(shared, size) {
  return new ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: { ...UniformsLib.fog, ...shared, uBox: { value: new Vector3(44, 16, 44) }, uAmount: { value: 0 }, uColA: { value: new Color('#ffd0e4') }, uColB: { value: new Color('#ffffff') }, uPx: { value: size } },
    vertexShader: `
      #include <fog_pars_vertex>
      attribute vec4 seed; uniform float uTime, uAmount, uPx; uniform vec3 uBox;
      varying float vA, vRot, vMix;
      void main(){
        vec3 base = seed.xyz * uBox;
        vec3 p = base + vec3(sin(uTime * .6 + seed.w * 20.) * 1.6, -uTime * (.8 + seed.w * .5), cos(uTime * .5 + seed.w * 13.) * 1.6);
        p = mod(p - cameraPosition + uBox * .5, uBox) - uBox * .5 + cameraPosition;
        p.y = cameraPosition.y + mod(p.y - cameraPosition.y + 6., uBox.y) - 6.;
        vA = step(seed.w, uAmount); vRot = seed.w * 31. + uTime * (1. + seed.w * 2.); vMix = fract(seed.w * 7.);
        vec4 mvPosition = viewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = uPx * (.6 + seed.w) / max(-mvPosition.z, .5);
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <fog_pars_fragment>
      uniform vec3 uColA, uColB; uniform vec3 uSun, uAmb;
      varying float vA, vRot, vMix;
      void main(){
        if (vA < .5) discard;
        vec2 c = gl_PointCoord - .5; float cs = cos(vRot), sn = sin(vRot);
        c = vec2(c.x * cs - c.y * sn, c.x * sn + c.y * cs) * vec2(1., 1.9);
        if (dot(c, c) > .2) discard;
        vec3 col = mix(uColA, uColB, vMix) * (uAmb * .6 + uSun * .5 + .15);
        gl_FragColor = vec4(min(col, vec3(.8)), 1.);
        #include <fog_fragment>
      }`,
  });
}
