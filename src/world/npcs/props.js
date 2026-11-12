// Hats, capes and scarves for the NPCs: a few primitives merged into one vertex-coloured mesh per person (one draw call, a few hundred triangles).
import { Color, CylinderGeometry, DoubleSide, Float32BufferAttribute, Mesh, MeshLambertMaterial, SphereGeometry, TorusGeometry, ConeGeometry, BoxGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const propMaterial = new MeshLambertMaterial({ vertexColors: true, side: DoubleSide });

const part = (g, color, x = 0, y = 0, z = 0, rx = 0, rz = 0) => {
  g = g.index ? g.toNonIndexed() : g;
  g.rotateX(rx); g.rotateZ(rz); g.translate(x, y, z);
  const c = new Color(color), n = g.attributes.position.count, a = [];
  for (let i = 0; i < n; i++) a.push(c.r, c.g, c.b);
  g.setAttribute('color', new Float32BufferAttribute(a, 3));
  g.deleteAttribute('uv');
  return g;
};

// d: a DEFS entry (h, look, hat, cape, scarf). Returns a Mesh in metres, origin at the feet, facing +z, or null when the person wears nothing extra.
export function makeProps(d) {
  const H = d.h, top = H * 0.985, ps = [], dark = new Color(d.look.top).multiplyScalar(0.55);
  if (d.hat === 'chef') ps.push(part(new CylinderGeometry(0.12, 0.13, 0.2, 10), 0xffffff, 0, top + 0.08), part(new SphereGeometry(0.17, 10, 6), 0xffffff, 0, top + 0.24));
  if (d.hat === 'cap') ps.push(part(new CylinderGeometry(0.125, 0.13, 0.07, 10), dark, 0, top + 0.005), part(new BoxGeometry(0.2, 0.012, 0.12), dark, 0, top - 0.025, 0.15));
  if (d.hat === 'colonel') ps.push(part(new CylinderGeometry(0.15, 0.17, 0.34, 12), 0x8a1c2c, 0, top + 0.16), part(new CylinderGeometry(0.155, 0.155, 0.05, 12), 0xe8c26a, 0, top + 0.1), part(new CylinderGeometry(0.3, 0.3, 0.025, 14), 0xe8c26a, 0, top - 0.01), part(new ConeGeometry(0.035, 0.5, 6), 0xf6f2e8, 0.12, top + 0.5, 0, 0, -0.5));
  if (d.hat === 'scarf') ps.push(part(new SphereGeometry(0.15, 10, 6, 0, 6.283, 0, 1.4), d.look.top, 0, top - 0.1));
  if (d.hat === 'bun') ps.push(part(new SphereGeometry(0.075, 8, 6), d.look.hair, 0, top - 0.02, -0.1));
  if (d.cape != null) { // a half-cylinder hanging from the shoulders down the back
    const col = d.hat === 'colonel', len = col ? 0.78 : 0.55, w = col ? 0.62 : 0.38;
    ps.push(part(new CylinderGeometry(col ? 0.27 : 0.2, w, H * len, 14, 1, true, Math.PI - (col ? 1.5 : 1.15), col ? 3 : 2.3), d.cape, 0, H * 0.83 - H * len / 2, -0.01));
    if (col) { // shoulder mantle, gold epaulettes with fringe, chest medals
      ps.push(part(new CylinderGeometry(0.25, 0.33, 0.16, 14, 1, true), d.cape, 0, H * 0.82), part(new TorusGeometry(0.33, 0.02, 6, 16), 0xe8c26a, 0, H * 0.82 - 0.08, 0, Math.PI / 2));
      for (const s of [-1, 1]) ps.push(part(new BoxGeometry(0.17, 0.035, 0.14), 0xe8c26a, s * 0.26, H * 0.84), part(new BoxGeometry(0.17, 0.08, 0.02), 0xf6e08a, s * 0.26, H * 0.84 - 0.05, 0.07));
      for (let i = 0; i < 3; i++) ps.push(part(new CylinderGeometry(0.03, 0.03, 0.015, 8), i === 1 ? 0xd83a3a : 0xe8c26a, -0.1 + i * 0.065, H * 0.76 - (i === 1 ? 0.025 : 0), 0.215, Math.PI / 2));
    }
  }
  if (d.scarf != null) ps.push(part(new TorusGeometry(0.115, 0.045, 6, 12), d.scarf, 0, H * 0.845, 0, Math.PI / 2), part(new BoxGeometry(0.09, 0.3, 0.025), d.scarf, 0.07, H * 0.74, -0.12));
  for (const a of d.acc || []) { // small extras: [name, colour]
    const [k, c] = Array.isArray(a) ? a : [a, 0x2a1f3d];
    if (k === 'glasses') for (const s of [-1, 1]) ps.push(part(new TorusGeometry(0.036, 0.007, 5, 10), c, s * 0.047, top - 0.105, 0.105));
    if (k === 'flower') ps.push(part(new SphereGeometry(0.035, 6, 5), c, 0.1, top - 0.05, 0.03), part(new SphereGeometry(0.015, 5, 4), 0xffe36a, 0.1, top - 0.05, 0.062));
    if (k === 'beanie') ps.push(part(new SphereGeometry(0.125, 10, 6, 0, 6.283, 0, 1.45), c, 0, top - 0.05));
    if (k === 'headband') ps.push(part(new TorusGeometry(0.115, 0.014, 5, 14), c, 0, top - 0.06, 0, Math.PI / 2));
    if (k === 'satchel') ps.push(part(new BoxGeometry(0.2, 0.15, 0.07), c, 0.2, H * 0.52, 0.0), part(new BoxGeometry(0.03, 0.62, 0.02), c, 0, H * 0.67, 0.12, 0, -0.55));
    if (k === 'apron') ps.push(part(new BoxGeometry(0.3, H * 0.3, 0.02), c, 0, H * 0.5, 0.17));
  }
  if (!ps.length) return null;
  const m = new Mesh(mergeGeometries(ps), propMaterial);
  m.frustumCulled = false;
  return m;
}

// The distant stand-in: head, hair cap, torso and legs (about 260 triangles). Top colour comes from the instance colour, skin and hair are baked.
export function standInGeometry() {
  const skin = 0xf0c8a8;
  const g = mergeGeometries([
    part(new SphereGeometry(0.11, 8, 6), skin, 0, 1.6),
    part(new SphereGeometry(0.12, 8, 5, 0, 6.283, 0, 1.5), 0x5a4a3a, 0, 1.63),
    part(new CylinderGeometry(0.17, 0.2, 0.62, 8), 0xffffff, 0, 1.2),
    part(new CylinderGeometry(0.17, 0.15, 0.85, 8), 0x555566, 0, 0.45),
  ]);
  return g; // 1.75 m tall; scaled per person
}

