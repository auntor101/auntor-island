import { Group, Mesh, PlaneGeometry, ShaderMaterial, Vector3 } from 'three';
import { moonDirection } from './time.js';

// One quad = glow + disc. Disc radius is 1/4 of the quad; the lit side comes from the phase uniform; craters are cell noise.
export function createMoon() {
  const material = new ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uLight: { value: new Vector3(0, 0, 1) }, uVis: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv * 2. - 1.; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `
      uniform vec3 uLight; uniform float uVis; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
        return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
      float crater(vec2 p, float sc){ // bowl floor darker, bright rim
        p *= sc; vec2 c = floor(p); float r = 0.;
        for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
          vec2 g = c + vec2(i, j), o = vec2(h(g), h(g + 7.3)) * .6 + .2;
          float rad = .12 + .22 * h(g + 3.1), d = length(p - g - o) / rad;
          if (h(g + 1.7) > .55) r += smoothstep(1., .75, d) * -.5 + smoothstep(.2, 1., d) * smoothstep(1.3, 1., d) * .35;
        }
        return r;
      }
      void main(){
        float r = length(vUv) * 4.; // 1 = disc edge
        float glow = exp(-pow(max(r - 1., 0.) * .55, 1.3) * 2.2) * .5 + exp(-r * r * .02) * .06;
        vec3 col = vec3(.62, .72, 1.) * glow * (.35 + .65 * clamp(uLight.z * .5 + .5, 0., 1.)); // glow dims toward new moon
        float a = glow * (1. - smoothstep(6., 10., r));
        if (r < 1.02) {
          vec2 q = vUv * 4.; vec3 N = vec3(q, sqrt(max(1. - dot(q, q), 0.)));
          float maria = smoothstep(.5, .62, n(q * 1.7 + 3.) * .65 + n(q * 4.5) * .35);
          float cr = crater(q, 5.) + crater(q + 4., 11.) * .6;
          vec3 alb = mix(vec3(.95, .93, .85), vec3(.36, .39, .47), maria * .85) + cr * .3;
          float nl = dot(N, uLight), lit = smoothstep(-.03, .07, nl) * (.55 + .45 * clamp(nl * 1.6, 0., 1.)); // soft terminator
          vec3 m = alb * (lit * 1.6 + .035);
          float edge = 1. - smoothstep(.97, 1., r);
          col = mix(col, m, edge); a = mix(a, .3 + .7 * clamp(lit * 2., 0., 1.), edge); // the dark side stays faint so it does not read as a black ball
        }
        gl_FragColor = vec4(col * uVis, a * uVis);
      }`,
  });
  const mesh = new Mesh(new PlaneGeometry(1, 1), material);
  mesh.scale.setScalar(112); // disc radius 14 m at 380 m: about 2.1 degrees, a stylised big moon
  mesh.frustumCulled = false;
  mesh.renderOrder = -8;
  const group = new Group();
  group.add(mesh);
  const d = new Vector3();
  return {
    group,
    // call after group.position follows the camera
    update(hours, phase, visibility) {
      d.fromArray(moonDirection(hours));
      mesh.position.copy(d).multiplyScalar(380);
      mesh.lookAt(group.position);
      const a = phase * 2 * Math.PI; // 0 new, .5 full; waxing is lit on the right
      material.uniforms.uLight.value.set(Math.sin(a), 0, -Math.cos(a));
      material.uniforms.uVis.value = visibility;
      group.visible = visibility > 0.01;
    },
  };
}
