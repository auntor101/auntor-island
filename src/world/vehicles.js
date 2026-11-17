// The Colonel's Garage and Stables: four parked rides (pony, cart, trike, motorbike) built from a few toon primitives. Front faces -z.
import { Group, Mesh, BoxGeometry, CylinderGeometry, SphereGeometry } from 'three';
import { toonMat } from './common/toon.js';
import { clear } from '../game/companion-ui.js';
import { hits } from '../play/vehicle.js';

const M = { wood: toonMat('#a06a3c'), dark: toonMat('#3a2a2a'), coral: toonMat('#ff7a59'), cream: toonMat('#fff7ea'), ink: toonMat('#2a1f3d'), gold: toonMat('#ffd36b') };
const box = (m, w, h, d, x, y, z) => { const o = new Mesh(new BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; };
const wheel = (r, w, x, y, z) => { const o = new Mesh(new CylinderGeometry(r, r, w, 10), M.dark); o.rotation.z = Math.PI / 2; o.position.set(x, y, z); return o; };

const cap = (m, r, h, x, y, z) => { const o = new Mesh(new CylinderGeometry(r, r, h, 6), m); o.position.set(x, y, z); return o; };
export const BUILD = {
  // A toon pony: barrel body, neck and head toward -z, four legs, tail. Rides with the same physics as the rest.
  pony() { const g = new Group(), coat = toonMat('#c98b57'), mane = M.ink; const neck = box(coat, 0.35, 0.8, 0.35, 0, 1.55, -0.95); neck.rotation.x = -0.5; g.add(box(coat, 0.7, 0.7, 1.7, 0, 1.15, 0), neck, box(coat, 0.35, 0.35, 0.7, 0, 1.85, -1.35), box(mane, 0.12, 0.7, 0.2, 0, 1.6, -0.75), box(mane, 0.12, 0.6, 0.12, 0, 1.0, 0.95), box(M.ink, 0.5, 0.1, 0.5, 0, 1.55, 0.1), cap(coat, 0.09, 0.8, 0.22, 0.4, -0.65), cap(coat, 0.09, 0.8, -0.22, 0.4, -0.65), cap(coat, 0.09, 0.8, 0.22, 0.4, 0.65), cap(coat, 0.09, 0.8, -0.22, 0.4, 0.65)); return g; },
  cart() { const g = new Group(); g.add(box(M.wood, 1.5, 0.35, 2.2, 0, 0.75, 0.3), box(M.wood, 1.5, 0.5, 0.1, 0, 1.1, 1.35), box(M.cream, 1.3, 0.5, 0.4, 0, 1.05, 0.6), wheel(0.5, 0.15, 0.85, 0.5, 0.4), wheel(0.5, 0.15, -0.85, 0.5, 0.4), box(M.wood, 0.1, 0.1, 1.8, 0.45, 0.7, -1.5), box(M.wood, 0.1, 0.1, 1.8, -0.45, 0.7, -1.5)); return g; },
  trike() { const g = new Group(); g.add(box(M.coral, 0.9, 0.35, 1.9, 0, 0.7, 0.1), box(M.ink, 0.6, 0.15, 0.6, 0, 1.0, 0.5), wheel(0.4, 0.15, 0.7, 0.4, 0.6), wheel(0.4, 0.15, -0.7, 0.4, 0.6), wheel(0.35, 0.15, 0, 0.35, -0.9), box(M.dark, 0.9, 0.08, 0.08, 0, 1.15, -0.7), box(M.gold, 0.3, 0.2, 0.2, 0, 0.9, -1.0)); return g; },
  bike() { const g = new Group(), t = new Mesh(new SphereGeometry(0.35, 8, 6), M.coral); t.scale.set(1, 0.8, 1.6); t.position.set(0, 0.95, -0.1); g.add(t, box(M.ink, 0.35, 0.12, 0.8, 0, 0.9, 0.7), wheel(0.42, 0.14, 0, 0.42, -0.85), wheel(0.42, 0.14, 0, 0.42, 0.95), box(M.dark, 0.9, 0.07, 0.07, 0, 1.3, -0.8)); return g; },
};
export const LABELS = { pony: 'pony', cart: 'cart', trike: 'trike', bike: 'bike' };

// Parked heading faces away from the stables. anchor = village.anchors.stables ([x,z]); the three rides line up beside it on dry, clear ground.
export function createVehicles(scene, { heightAt, isWet, colliders, anchor }) {
  const out = [], kinds = ['pony', 'cart', 'trike', 'bike'];
  let k = 0;
  // The 9 m straight out of a parking spot must be dry, level and free of buildings and props, so the first drive does not end in a wall.
  const openRun = (x, z, a) => { for (let d = 1; d <= 9; d++) { const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, h = heightAt(px, pz); if (isWet(px, pz) || Math.abs(h - heightAt(x, z)) > 0.8 || hits(colliders, px, pz)) return false; } return true; };
  for (let r = 4; r <= 12 && k < kinds.length; r += 2) for (let i = 0; i < 12 && k < kinds.length; i++) {
    const a = i * Math.PI / 6, x = anchor[0] + Math.cos(a) * r, z = anchor[1] + Math.sin(a) * r;
    if (isWet(x, z) || heightAt(x, z) < 0.6 || out.some((v) => Math.hypot(v.home.x - x, v.home.z - z) < 3) || !colliders.every((c) => clear(c, x, z, 1.6)) || !openRun(x, z, a)) continue;
    const mesh = BUILD[kinds[k]](); scene.add(mesh);
    const v = { kind: kinds[k], mesh, home: { x, z, heading: Math.atan2(-Math.cos(a), -Math.sin(a)) },place(px, pz, h) { mesh.position.set(px, heightAt(px, pz), pz); mesh.rotation.y = h; }, park() { this.place(this.home.x, this.home.z, this.home.heading); } };
    v.park(); out.push(v); k++;
  }
  return out;
}
