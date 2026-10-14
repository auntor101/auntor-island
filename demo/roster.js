// Roster demo. ?who=man|woman|elf|wizard (default: all four)  &view=front|three|back|walk|head  &steps=N (pre-step the walk, then freeze)  &beard=1
import { ACESFilmicToneMapping, Color, DirectionalLight, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, Scene, SRGBColorSpace, WebGLRenderer } from 'three';
import { loadCharacter, ROSTER } from '../src/play/roster.js';

const q = new URLSearchParams(location.search);
const who = q.get('who') ? [q.get('who')] : Object.keys(ROSTER), view = q.get('view') || 'front';
const canvas = document.getElementById('c');
const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.outputColorSpace = SRGBColorSpace; renderer.toneMapping = ACESFilmicToneMapping; renderer.setPixelRatio(1);
const scene = new Scene(); scene.background = new Color('#9db4c8');
const ground = new Mesh(new PlaneGeometry(40, 40).rotateX(-Math.PI / 2), new MeshStandardMaterial({ color: '#6f8a5c', roughness: 1 }));
scene.add(ground, new HemisphereLight('#bcd0ff', '#6f8a5c', 0.6));
const key = new DirectionalLight('#ffe0b0', 2.4); key.position.set(3, 5, 4); scene.add(key);
const fill = new DirectionalLight('#8fb0ff', 0.9); fill.position.set(-4, 2, 2); scene.add(fill);
const cam = new PerspectiveCamera(30, 1, 0.1, 100);

const chars = [];
const info = window.__roster = { tris: {}, calls: 0, ids: who, view, freeze: false };
const gap = 1.05;
for (const [i, id] of who.entries()) {
  const attach = id === 'wizard' && q.get('beard') ? ['robe', 'hat', 'staff', 'beard'] : undefined;
  const c = await loadCharacter(id, { attach });
  c.root.position.x = (i - (who.length - 1) / 2) * gap;
  scene.add(c.root); chars.push(c); info.tris[id] = c.triangles;
}
info.chars = chars;
const yaw = { front: 0, three: 0.6, back: Math.PI, walk: 0.7, head: 0.35 }[view] ?? 0;
function frame() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); cam.aspect = w / h;
  const span = who.length === 1 ? (view === 'head' ? 0.3 : 1.2) : who.length * gap;
  const tall = view === 'head' ? 0.32 : 2.1, dist = Math.max(tall / 2 / Math.tan(cam.fov * Math.PI / 360) * 1.1, span / (2 * Math.tan(cam.fov * Math.PI / 360) * cam.aspect) * 1.05);
  const ty = view === 'head' ? ROSTER[who[0]].height * 0.9 : 0.92;
  cam.position.set(Math.sin(yaw) * dist, ty + 0.25, Math.cos(yaw) * dist); cam.lookAt(0, ty, 0); cam.updateProjectionMatrix();
}
const step = (dt) => { for (const c of chars) c.update(dt, view === 'walk' ? 2.2 : 0, 0); };
const walkSteps = Number(q.get('steps') || 0);
if (walkSteps) { for (let i = 0; i < walkSteps; i++) step(1 / 60); info.freeze = true; }
const draw = () => { frame(); renderer.info.reset(); renderer.render(scene, cam); info.calls = renderer.info.render.calls; info.triangles = renderer.info.render.triangles; };
renderer.setAnimationLoop(() => { if (!info.freeze) step(1 / 60); draw(); });
draw();
document.getElementById('s').textContent = 'ready';
