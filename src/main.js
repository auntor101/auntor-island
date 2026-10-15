import { Scene, PerspectiveCamera, HemisphereLight, DirectionalLight, Fog, Color, Vector3, Mesh, PlaneGeometry, MeshBasicMaterial, CanvasTexture } from 'three';
import { createRenderer, startLoop } from './render/renderer.js';
import { heightAt, isWet, zoneAt, LAKE } from './world/island.js';
import { ChunkManager, createTerrainMaterial } from './world/terrain.js';
import { createSky } from './world/sky.js';
import { skyPalette, sunDirection, moonDirection } from './world/time.js';
import { createStars } from './world/stars.js';
import { createMoon } from './world/moon.js';
import { createSnow } from './world/snow.js';
import { createHud, loadPrefs, TIMES } from './ui/hud.js';
import { createWater } from './world/water.js';
import { stepPlayer } from './play/player.js';
import { createControls } from './play/controls.js';
import { createCamera } from './play/camera.js';
import { loadCharacter } from './play/roster.js';
import { CHARS, load as loadProfile, save as saveProfile, sanitizeName } from './profile.js';
import { createSelect } from './ui/select.js';
import { createVillage } from './world/village/village.js';
import { createFlora } from './world/flora/flora.js';
import { createLife } from './life/index.js';
import { createAudio, createAudioButton } from './audio/index.js';
import { createAudioDriver } from './game/audio-driver.js';
import { spawnPoint, createPetUi, pullCamera } from './game/companion-ui.js';

const gl = createRenderer(document.getElementById('gl'));
const scene = new Scene();
scene.fog = new Fog('#ffffff', 80, 260);
const camera = new PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 600);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

const hemi = new HemisphereLight('#ffffff', '#ffffff', 1.5);
const sun = new DirectionalLight('#ffffff', 3);
scene.add(hemi, sun, sun.target);
const sky = createSky(), water = createWater(), terrain = createTerrainMaterial(), chunks = new ChunkManager(scene, terrain);
const stars = createStars(), moon = createMoon(), snow = createSnow(camera);
scene.add(sky.mesh, stars.points, moon.group, water.mesh, snow.points);
const village = createVillage(scene, { heightAt, isWet, zoneAt });
const flora = createFlora(scene, { heightAt, zoneAt, isWet, getSeason: () => 'auto' });
flora.setKeepOut(village.keepOut);
const audio = createAudio(), audioDrv = createAudioDriver(audio, water, village);
const life = createLife(scene, { heightAt, isWet, zoneAt, colliders: village.colliders, isTouch: matchMedia('(pointer:coarse)').matches, onSfx: (name, o) => audio.sfx(name, o) });
addEventListener('pointerdown', () => audio.unlock(), { passive: true }); // iOS fallback: any first tap

// One palette drives sky, fog, lights, terrain and water. It is rebuilt every frame from the hour and the snow amount.
const pal = { sunDir: new Vector3(), lightDir: new Vector3() }, WHITE = new Color('#ffffff'), tmp = new Color(), fogC = new Color(), horC = new Color(), zenC = new Color(), grey = new Color('#a8b4c8'), SNOWFOG = new Color('#e4edfb');
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
let fogNear = 80, fogFar = 260;
function applyPalette(hours, snowK) {
  const base = skyPalette(hours), sd = sunDirection(hours), md = moonDirection(hours), w = smooth(-0.15, 0.1, sd[1]), day = smooth(-0.1, 0.25, sd[1]);
  Object.assign(pal, base);
  pal.sunDir.fromArray(sd);
  pal.lightDir.set(md[0] + (sd[0] - md[0]) * w, md[1] + (sd[1] - md[1]) * w, md[2] + (sd[2] - md[2]) * w).normalize(); // moonlight takes over below the horizon
  pal.snow = snowK;
  // snow weather: whiter, greyer, closer fog; the horizon follows the fog so the two always blend
  fogC.set(base.fog).lerp(tmp.copy(SNOWFOG).multiplyScalar(0.2 + 0.8 * day), 0.35 * snowK);
  horC.set(base.horizon).lerp(fogC, snowK);
  zenC.set(base.zenith).lerp(tmp.copy(grey).multiplyScalar(0.15 + 0.85 * day), 0.3 * snowK);
  pal.fog = fogC; pal.horizon = horC; pal.zenith = zenC;
  fogNear = 80 * (1 - 0.4 * snowK); fogFar = 260 * (1 - 0.35 * snowK);
  scene.fog.color.copy(fogC);
  hemi.color.set(base.ambient);
  hemi.groundColor.set(base.ambient).multiplyScalar(0.5).lerp(tmp.set('#8a6a48'), 0.4);
  hemi.intensity = 1.5;
  sun.color.set(base.sunColor); sun.intensity = 3 * base.sunIntensity;
  sun.position.copy(pal.lightDir).multiplyScalar(100);
  sky.update(pal);
  terrain.update(pal);
  return { day, base };
}

// Time of day: Auto is a full day in 6 real minutes; a fixed choice (or ?t=<hours>) pauses it. ?snow=0|1, ?phase=0..1 (moon) for repeatable shots.
const params = new URLSearchParams(location.search);
const prefs = loadPrefs();
if (params.has('snow')) prefs.snow = params.get('snow') === '1';
const fixedT = params.has('t') ? Number(params.get('t')) : null;
let totalHours = 15.5, mode = prefs.mode, snowK = 0, snowOn = prefs.snow;
const phaseOf = () => params.has('phase') ? Number(params.get('phase')) : (0.5 + Math.floor((totalHours + 12) / 24) / 8) % 1; // one step per in-game day
const hud = document.getElementById('hud');
const skyHud = createHud(hud, prefs, { onMode: (m) => { mode = m; }, onSnow: (on) => { snowOn = on; } });

// ?fly (or ?cam=spawn|village|aerial|topdown|beach|sunset|volcano|peak, or x,y,z,yawDeg,pitchDeg) is the debug free camera: WASD + shift, space/C up/down,
// mouse drag to look, touch: left half drags to move, right half drags to look. No hero, no select screen. Everything else is the real game.
const VC = village.layout.center;
const VIEWS = { // x,y,z,yawDeg,pitchDeg (yaw 0 looks north, -z)
  spawn: [VC[0] + 8, heightAt(VC[0] + 8, VC[1] + 50) + 12, VC[1] + 50, 0, 3], village: [VC[0], heightAt(VC[0], VC[1] + 12) + 7, VC[1] + 12, 0, -10], aerial: [0, 180, 70, 0, -60], topdown: [0, 200, 0, 0, -90],
  beach: [-60, 14, 80, -150, -8], sunset: [-60, 14, 80, 127, 6], volcano: [50, 55, 45, -52, -18], peak: [-10, 125, -30, 0, -14],
};
const camParam = params.get('cam'), fly = params.has('fly') || camParam != null;
let [x, y, z, yaw, pitch] = VIEWS[camParam] || (camParam ? camParam.split(',').map(Number) : VIEWS.spawn);
yaw = yaw * Math.PI / 180; pitch = pitch * Math.PI / 180;
const keys = new Set(), touches = new Map(), cv = document.getElementById('gl');
if (fly) {
  addEventListener('keydown', (e) => keys.add(e.code));
  addEventListener('keyup', (e) => keys.delete(e.code));
  cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); touches.set(e.pointerId, { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, move: e.pointerType === 'touch' && e.clientX < innerWidth / 2 }); });
  cv.addEventListener('pointermove', (e) => {
    const t = touches.get(e.pointerId);
    if (!t) return;
    if (!t.move) { yaw -= (e.clientX - t.x) * 0.005; pitch = Math.max(-1.5, Math.min(1.5, pitch - (e.clientY - t.y) * 0.005)); }
    t.x = e.clientX; t.y = e.clientY;
  });
  const end = (e) => touches.delete(e.pointerId);
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
}

// Stats live in the same column as the Sky button, under its panel, so the two never overlap.
const panel = document.createElement('pre');
panel.hidden = true;
const btn = document.createElement('button');
btn.textContent = 'stats';
btn.setAttribute('aria-expanded', 'false');
btn.onclick = () => { panel.hidden = !panel.hidden; btn.setAttribute('aria-expanded', String(!panel.hidden)); };
skyHud.root.append(btn, panel);
createAudioButton(skyHud.root, audio).el.style.margin = '8px';
btn.after(skyHud.root.lastChild); // Sky, stats, sound stack in one column; the stats text panel stays last
const note = document.createElement('div');
note.className = 'note';
hud.append(note);

// The hero: a soft blob shadow (one transparent disc), the character from the roster, walking physics, follow camera.
const blob = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(0,0,0,.45)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const m = new Mesh(new PlaneGeometry(1.3, 1.3).rotateX(-Math.PI / 2), new MeshBasicMaterial({ map: new CanvasTexture(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.visible = false; scene.add(m); return m;
})();
let hero = null, controls = null, follow = null, state = null, heroId = '';
const inp = { x: 0, y: 0, run: false, cameraYaw: 0 };
const game = window.__game = { bot: null, village, life, audio, get state() { return state; }, get cam() { return follow; } }; // bot = { x, y, run } overrides the controls (tests, screenshots)

async function startGame(char, name, comp) {
  const t0 = performance.now();
  hero = await loadCharacter(char);
  heroId = char; scene.add(hero.root);
  const at = village.anchors[{ feast: 'feastStreet', dock: 'harbourDock', hall: 'greatHall' }[params.get('at')] || params.get('at')], sp = at ? { x: at.x, z: at.z } : params.get('at') === 'lake' ? { x: LAKE.x + 6, z: LAKE.z + LAKE.r - 6 } : spawnPoint(village, heightAt, isWet); // ?at=feast|dock|hall|lake|<anchor> for screenshots
  if (comp) life.setCompanion(comp);
  state = { x: sp.x, z: sp.z, y: heightAt(sp.x, sp.z), heading: 0, speed: 0 };
  pet.show(true);
  controls = createControls(cv, hud); follow = createCamera(camera);
  blob.visible = true;
  note.textContent = 'Welcome to Auntor Island, ' + name;
  note.classList.add('on');
  setTimeout(() => note.classList.remove('on'), 6000);
  game.loadMs = Math.round(performance.now() - t0);
}

const pet = createPetUi(hud, cv, camera, life, () => state);
const profile = loadProfile(localStorage);
const compParam = ['dragon', 'dog', 'cat'].includes(params.get('comp')) ? params.get('comp') : null;
const skipChar = CHARS.includes(params.get('char')) ? params.get('char') : null;
let select = null;
if (!skipChar && !fly) hud.style.visibility = 'hidden'; // the start card covers the screen, the HUD returns with the game
if (skipChar) startGame(skipChar, sanitizeName(params.get('name')), compParam);
else if (!fly) {
  select = createSelect(document.getElementById('ui'), { ...profile, comp: compParam || life.getCompanion() }, async (p) => {
    audio.unlock(); // inside the Start tap
    saveProfile(localStorage, p);
    select.busy(true, 'Loading...');
    try { await startGame(p.char, p.name, p.comp); select.hide(); select = null; hud.style.visibility = ''; } catch (e) { console.error(e); select.busy(false, 'Try again'); }
  });
}

let acc = 0;
startLoop((dt, now, rawMs) => {
  if (hero) {
    const c = game.bot || controls.read();
    inp.x = c.x; inp.y = c.y; inp.run = c.run; inp.cameraYaw = follow.yaw;
    state = stepPlayer(state, inp, dt, heightAt, village.colliders);
    follow.update(state, c.lookDX || 0, c.lookDY || 0, dt);
    pullCamera(camera, state, village.colliders, heightAt);
    hero.update(dt, state.speed);
    hero.root.position.set(state.x, state.y, state.z);
    hero.root.rotation.y = state.heading + Math.PI; // the models face +z, the player heading 0 faces -z
    blob.position.set(state.x, state.y + 0.04, state.z);
    life.update(dt, state, camera, pal);
    audioDrv.update(dt, state, totalHours, snowK);
    pet.update();
  } else if (fly) {
    let f = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0), r = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    for (const t of touches.values()) if (t.move) { f += Math.max(-1, Math.min(1, (t.y0 - t.y) / 50)); r += Math.max(-1, Math.min(1, (t.x - t.x0) / 50)); }
    const v = (keys.has('ShiftLeft') ? 60 : 20) * dt, cy = Math.cos(pitch);
    x += (-Math.sin(yaw) * cy * f + Math.cos(yaw) * r) * v;
    y += (Math.sin(pitch) * f + (keys.has('Space') ? 1 : 0) - (keys.has('KeyC') ? 1 : 0)) * v;
    z += (-Math.cos(yaw) * cy * f - Math.sin(yaw) * r) * v;
    camera.position.set(x, Math.max(y, heightAt(x, z) + 2), z);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
  } else { // behind the start card: a slow orbit round the spawn
    const a = now * 0.00008, sp = { x: VC[0], z: VC[1] }, ox = sp.x + Math.sin(a) * 34, oz = sp.z + Math.cos(a) * 34;
    camera.position.set(ox, Math.max(heightAt(ox, oz), 0) + 12, oz);
    camera.lookAt(sp.x, heightAt(sp.x, sp.z) + 4, sp.z);
  }
  const cp = camera.position;

  if (fixedT != null) totalHours = fixedT;
  else if (mode === 'auto') totalHours += dt * 24 / 360;
  else totalHours = Math.floor(totalHours / 24) * 24 + TIMES[mode];
  snowK += ((snowOn ? 1 : 0) - snowK) * Math.min(1, dt * 1.2);
  const { day, base } = applyPalette(totalHours, snowK);
  const px = gl.stats().pixelRatio;
  const alt = Math.max(0, cp.y - heightAt(cp.x, cp.z)); // lift the fog when flying high so the island stays visible
  scene.fog.near = fogNear + 2 * alt; scene.fog.far = fogFar + 3 * alt;
  stars.points.position.copy(cp); moon.group.position.copy(cp);
  stars.update(now / 1000, base.stars * (1 - 0.6 * snowK), px);
  moon.update(totalHours, phaseOf(), base.moon * (1 - 0.5 * snowK));
  snow.update(now / 1000, snowK, px, tmp.set('#8fa4d8').lerp(WHITE, day));
  chunks.update(cp);
  village.update(dt, pal, cp);
  flora.update(cp, state ? { x: state.x, y: state.y, z: state.z } : null, dt, pal, camera);
  sky.mesh.position.copy(cp);
  water.update(pal, now / 1000, camera.position);

  gl.render(scene, camera, rawMs);
  if (select) select.progress(chunks.built, chunks.wanted);
  acc += dt;
  if (acc > 0.25 && !panel.hidden) {
    acc = 0;
    const s = gl.stats();
    panel.textContent = `fps ${s.fps}\ncalls (all passes) ${s.calls}\ntris (all passes) ${s.triangles}\npr ${s.pixelRatio.toFixed(2)}\nchunks ${chunks.built}/${chunks.wanted}\nchar ${heroId || '-'}`;
  }
});
