import { Mesh, PlaneGeometry, ShaderMaterial, InstancedBufferGeometry, InstancedBufferAttribute, DoubleSide, Group, Vector2, Vector3 } from 'three';

export const NOISE_GLSL = `
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }`;

// Where the curtain hangs: at the fall's x,z, facing downstream along the nearest river, from lake.level + drop down to lake.level.
export function fallInfo(fall, rivers, lake) {
  let best = 1e9, dx = 0, dz = 1, width = 4;
  for (const r of rivers) for (let i = 0; i + 1 < r.pts.length; i++) {
    const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1], vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1;
    const t = Math.max(0, Math.min(1, ((fall.x - ax) * vx + (fall.z - az) * vz) / l2)), d = Math.hypot(ax + vx * t - fall.x, az + vz * t - fall.z);
    if (d < best) { best = d; const l = Math.sqrt(l2); dx = vx / l; dz = vz / l; width = r.width; }
  }
  const bulge = 1.1;
  return { x: fall.x, z: fall.z, dx, dz, width, top: lake.level + fall.drop, bottom: lake.level, bulge, px: fall.x + dx * (bulge + 0.6), pz: fall.z + dz * (bulge + 0.6) };
}

// Curtain + spray: 2 draw calls. S = the shared water uniforms (time, light, palette), so it follows day, night and snow with the lake.
export function createWaterfall(S, info) {
  const { x, z, dx, dz, width, top, bottom, bulge } = info, drop = top - bottom, rx = -dz, rz = dx;
  const cg = new PlaneGeometry(width, drop, 8, 24), pos = cg.attributes.position;
  for (let i = 0; i < pos.count; i++) { // water leaves the lip with some speed, then falls straight: x = sqrt(s)
    const s = (drop / 2 - pos.getY(i)) / drop, u = pos.getX(i) * (1 + 0.25 * s), off = bulge * Math.sqrt(s);
    pos.setXYZ(i, x + rx * u + dx * off, top - s * drop, z + rz * u + dz * off);
  }
  const curtain = new Mesh(cg, new ShaderMaterial({
    transparent: true, depthWrite: false, side: DoubleSide, uniforms: { uTime: S.uTime, uDay: S.uDay, uLight: S.uLight, uFoam: S.uFoam, uLCol: S.uLCol },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.); }`,
    fragmentShader: `
      uniform float uTime, uDay; uniform vec3 uLight, uFoam, uLCol;
      varying vec2 vUv;
      ${NOISE_GLSL}
      void main(){
        float u = vUv.x, v = 1. - vUv.y, t = uTime;
        float a = noise(vec2(u * 15. + sin(v * 3. + t) * .3, v * 1.2 - t * 2.6)), b = noise(vec2(u * 31. + 7., v * .8 - t * 3.6));
        float s = a * .6 + b * .4;
        vec3 col = mix(vec3(.45, .78, .95), vec3(.8, .94, 1.), smoothstep(.35, .65, s));    // two cel tones
        col = mix(col, vec3(1.), step(.66, s) * .85) * clamp(uLight * 1.25, 0., 1.2);       // bright streak highlights
        float sp = step(.93, hash(floor(vec2(u * 38., v * 26. - t * 22.)))) * uDay;          // sun glimmer
        col += uLCol * sp * 1.3;
        col = mix(col, uFoam, smoothstep(.82, 1., v) + (1. - smoothstep(0., .05, v)));       // lip and plunge foam
        float eu = min(u, 1. - u), edge = smoothstep(0., .12 + .1 * noise(vec2(v * 9. - t * 3., u * 4.)), eu);
        gl_FragColor = vec4(col, edge * (.55 + .4 * s) * (1. - .35 * smoothstep(.75, 1., v)));
      }`,
  }));
  curtain.frustumCulled = false; curtain.renderOrder = 2;

  const N = 40, base = new PlaneGeometry(1, 1), sg = new InstancedBufferGeometry(), seed = new Float32Array(N * 4);
  for (let i = 0; i < seed.length; i++) seed[i] = Math.random();
  sg.index = base.index; sg.setAttribute('position', base.attributes.position); sg.setAttribute('aSeed', new InstancedBufferAttribute(seed, 4)); sg.instanceCount = N;
  const wind = new Vector2(), uni = { uBase: { value: new Vector3(info.px, bottom, info.pz) }, uDir: { value: new Vector2(dx, dz) }, uWind: { value: wind }, uW: { value: width }, uTime: S.uTime, uLight: S.uLight, uHorizon: S.uHorizon };
  const spray = new Mesh(sg, new ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: uni,
    vertexShader: `
      attribute vec4 aSeed; uniform float uTime, uW; uniform vec3 uBase; uniform vec2 uDir, uWind; varying vec2 vUv; varying float vA;
      void main(){
        float ph = fract(uTime * (.16 + .1 * aSeed.x) + aSeed.y);
        vec3 c = uBase;
        c.xz += vec2(-uDir.y, uDir.x) * (aSeed.z - .5) * uW * 1.5 + uDir * (aSeed.w * 1.6 - .3) * (.4 + ph) + uWind * ph * ph * 5.;
        c.y += .2 + ph * (2.2 + aSeed.x * 3.);
        vec4 mv = viewMatrix * vec4(c, 1.); mv.xy += position.xy * (1.2 + aSeed.w * 1.6) * (.5 + ph * 1.4);
        gl_Position = projectionMatrix * mv; vUv = position.xy * 2.; vA = sin(3.14159 * ph);
      }`,
    fragmentShader: `
      uniform vec3 uLight, uHorizon; varying vec2 vUv; varying float vA;
      void main(){
        float d = length(vUv);
        gl_FragColor = vec4(mix(vec3(1.), uHorizon, .15) * clamp(uLight * 1.4 + .1, 0., 1.), vA * (smoothstep(1., .75, d) * .3 + smoothstep(.55, .4, d) * .18));
      }`,
  }));
  spray.frustumCulled = false; spray.renderOrder = 3;
  const group = new Group(); group.add(curtain, spray);
  return {
    group,
    update(time) { wind.set(.5 * Math.sin(time * .3) + .45, .25 * Math.cos(time * .21)); },
    dispose() { cg.dispose(); sg.dispose(); base.dispose(); curtain.material.dispose(); spray.material.dispose(); },
  };
}
