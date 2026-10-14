import { Scene, PerspectiveCamera, Mesh, BoxGeometry, PlaneGeometry, MeshStandardMaterial, HemisphereLight, DirectionalLight, Color } from 'three';
import { createRenderer, startLoop } from './render/renderer.js';

const gl = createRenderer(document.getElementById('gl'));
const scene = new Scene();
scene.background = new Color('#bfe3f2');
const camera = new PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 500);
camera.position.set(3, 3, 5);
camera.lookAt(0, 0.8, 0);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

scene.add(new HemisphereLight('#fff4d6', '#6a8f5a', 1.2));
const sun = new DirectionalLight('#fff0cc', 2.5);
sun.position.set(5, 8, 3);
scene.add(sun);
const ground = new Mesh(new PlaneGeometry(40, 40), new MeshStandardMaterial({ color: '#7fb069' }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
const cube = new Mesh(new BoxGeometry(1.5, 1.5, 1.5), new MeshStandardMaterial({ color: '#ff7a59' }));
cube.position.y = 0.75;
scene.add(cube);

const hud = document.getElementById('hud');
const panel = document.createElement('pre');
const btn = document.createElement('button');
btn.textContent = 'stats';
btn.onclick = () => { panel.hidden = !panel.hidden; };
hud.append(btn, panel);

let acc = 0;
startLoop((dt) => {
  cube.rotation.y += dt;
  gl.render(scene, camera, dt * 1000);
  acc += dt;
  if (acc > 0.25 && !panel.hidden) {
    acc = 0;
    const s = gl.stats();
    panel.textContent = `fps ${s.fps}\ncalls ${s.calls}\ntris ${s.triangles}\npr ${s.pixelRatio.toFixed(2)}`;
  }
});
