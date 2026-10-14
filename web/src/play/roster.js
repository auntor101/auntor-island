// The playable roster: four anime VRM characters, a procedural walk, idle breathing and blinking.
import { Box3, Group, SkinnedMesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { addElfEars, addWizardHat, addWizardRobe, addStaff, addBeard, measureHead, isFlipped } from './attachments.js';

// height is the standing height in metres, slim narrows the body for the elf. wizard shares the man's model file.
export const ROSTER = {
  man: { id: 'man', label: 'Man', file: 'man.vrm', base: 'Sakurada Fumiriya', attach: [], height: 1.78, slim: 1 },
  woman: { id: 'woman', label: 'Woman', file: 'woman.vrm', base: 'Sendagaya Shino', attach: [], height: 1.66, slim: 1 },
  elf: { id: 'elf', label: 'Elf', file: 'elf.vrm', base: 'Vita', attach: ['ears'], height: 1.84, slim: 0.94 },
  wizard: { id: 'wizard', label: 'Wizard', file: 'man.vrm', base: 'Sakurada Fumiriya', attach: ['robe', 'hat', 'staff'], height: 1.8, slim: 1 },
};

const FINGERS = ['left', 'right'].flatMap((s) => ['Index', 'Middle', 'Ring', 'Little', 'Thumb'].flatMap((f) => (f === 'Thumb' ? ['Proximal', 'Distal'] : ['Proximal', 'Intermediate', 'Distal']).map((j) => s + f + j)));
const BASE = import.meta.env?.BASE_URL ?? '/';
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// The VRoid exports split hair and body into dozens of primitives (about 100 draw calls with outlines).
// Merge the visible, morph-free skinned meshes that share a skeleton, material and transform into one mesh each.
function mergeDraws(root) {
  const buckets = new Map();
  root.traverse((o) => {
    if (!o.isSkinnedMesh || !o.visible || o.morphTargetInfluences?.length) return;
    const g = o.geometry, key = [o.skeleton.uuid, [o.material].flat().map((m) => m.uuid), Object.keys(g.attributes), !!g.index, o.parent.uuid, o.renderOrder, o.matrixWorld.elements.join(), o.bindMatrix.elements.join()].join('|');
    (buckets.get(key) || buckets.set(key, []).get(key)).push(o);
  });
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const geo = mergeGeometries(list.map((m) => m.geometry));
    if (!geo) continue; // shortcut: incompatible primitives stay separate
    const first = list[0], mats = Array.isArray(first.material) ? first.material : null, n = geo.index ? geo.index.count : geo.attributes.position.count;
    if (mats) { geo.clearGroups(); mats.forEach((_, i) => geo.addGroup(0, n, i)); }
    const merged = new SkinnedMesh(geo, first.material);
    merged.name = first.name + '_merged'; merged.renderOrder = first.renderOrder; merged.frustumCulled = false;
    first.parent.add(merged); merged.bind(first.skeleton, first.bindMatrix);
    for (const m of list) { m.removeFromParent(); m.geometry.dispose(); }
  }
}

export function countTriangles(root) {
  let n = 0;
  root.traverse((o) => { if (o.isMesh && o.visible) n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  return Math.round(n);
}

// opts.attach overrides the roster list (e.g. [] for the bare model, add 'beard'); opts.url overrides the model path
export async function loadCharacter(id, opts = {}) {
  const def = ROSTER[id];
  if (!def) throw new Error('unknown character ' + id);
  const loader = new GLTFLoader();
  loader.register((p) => new VRMLoaderPlugin(p));
  const gltf = await loader.loadAsync(opts.url || `${BASE}models/${def.file}`);
  const vrm = gltf.userData.vrm;
  VRMUtils.removeUnnecessaryVertices(gltf.scene);
  VRMUtils.combineSkeletons(gltf.scene);
  VRMUtils.rotateVRM0(vrm);
  vrm.scene.traverse((o) => { o.frustumCulled = false; }); // skinned bounds are bind-pose only

  // scale to the roster height, feet on y = 0
  vrm.scene.updateMatrixWorld(true);
  const box = new Box3().setFromObject(vrm.scene), size = box.getSize(new Vector3());
  const k = def.height / size.y;
  vrm.scene.position.y -= box.min.y;
  const model = new Group(); model.add(vrm.scene); // scaled after the accessories are measured, so they live in model units
  const root = new Group(); root.add(model);
  vrm.scene.updateMatrixWorld(true);

  // accessories (measured in the model's own rest pose, before any animation)
  const list = opts.attach || def.attach, attachments = [];
  const frame = list.some((a) => ['ears', 'hat', 'beard'].includes(a)) ? measureHead(vrm) : null;
  const make = { ears: addElfEars, hat: addWizardHat, robe: addWizardRobe, staff: addStaff, beard: addBeard };
  for (const a of list) attachments.push(make[a](vrm, { frame }));
  if (!opts.noMerge) mergeDraws(vrm.scene);
  model.scale.set(k * def.slim, k, k * def.slim);
  const holdsStaff = list.includes('staff');

  const sg = isFlipped(vrm) ? -1 : 1; // pose written in the "model forward" frame; VRM0 bone axes x and z are mirrored
  const B = (n) => vrm.humanoid.getNormalizedBoneNode(n);
  const bones = {}, rest = {};
  for (const n of ['hips', 'spine', 'chest', 'upperChest', 'neck', 'head', 'leftUpperArm', 'rightUpperArm', 'leftLowerArm', 'rightLowerArm', 'leftHand', 'rightHand',
    'leftUpperLeg', 'rightUpperLeg', 'leftLowerLeg', 'rightLowerLeg', 'leftFoot', 'rightFoot', 'leftShoulder', 'rightShoulder', ...FINGERS]) {
    const b = B(n); if (b) { bones[n] = b; rest[n] = b.position.clone(); }
  }
  const rot = (n, x = 0, y = 0, z = 0) => bones[n]?.rotation.set(x * sg, y, z * sg);

  const st = { phase: 0, amp: 0, t: 0, blinkAt: 2, blink: 0 };
  const update = (dt, speed = 0, heading) => {
    dt = Math.min(dt, 0.1);
    if (heading != null) root.rotation.y = heading;
    st.t += dt;
    st.amp += (clamp(speed / 2.2, 0, 1.3) - st.amp) * Math.min(1, dt * 8);
    if (st.amp > 0.02) st.phase += dt * 2.7 * Math.max(speed, 0.6);
    const a = st.amp, p = st.phase, s = Math.sin(p), c = Math.cos(p), br = Math.sin(st.t * 1.9) * (1 - a);
    // legs: positive x swings a leg back; the knee bends while the leg swings forward; the foot stays roughly flat
    const swing = (side, sn, cs) => {
      const th = -0.45 * sn * a, knee = a * (0.08 + 0.75 * Math.max(0, cs)) + 0.02;
      rot(side + 'UpperLeg', th, 0, 0); rot(side + 'LowerLeg', knee, 0, 0); rot(side + 'Foot', -(th + knee) * 0.7, 0, 0);
    };
    swing('left', s, c); swing('right', -s, -c);
    // arms hang down, swing against the legs, elbows soften
    rot('leftShoulder', 0, 0, 0.0); rot('rightShoulder', 0, 0, 0);
    rot('leftUpperArm', 0.4 * s * a, 0, -1.35 + 0.03 * br); rot('leftLowerArm', 0, -0.18 - 0.35 * a * (0.5 + 0.5 * c), 0); rot('leftHand', 0, 0, 0);
    if (holdsStaff) { rot('rightUpperArm', -0.6, 0, 1.38 + 0.03 * s * a); rot('rightLowerArm', 0, 1.05, 0); }
    else { rot('rightUpperArm', -0.4 * s * a, 0, 1.35 - 0.03 * br); rot('rightLowerArm', 0, 0.18 + 0.35 * a * (0.5 - 0.5 * c), 0); }
    // hands: relaxed curl, a fist round the staff
    for (const side of ['left', 'right']) {
      const c = (side === 'right' && holdsStaff ? 1.3 : 0.28) * (side === 'left' ? -1 : 1);
      for (const f of ['Index', 'Middle', 'Ring', 'Little']) { rot(side + f + 'Proximal', 0, 0, c); rot(side + f + 'Intermediate', 0, 0, c * 1.1); rot(side + f + 'Distal', 0, 0, c * 0.7); }
      rot(side + 'ThumbProximal', 0, 0, c * 0.3); rot(side + 'ThumbDistal', 0, 0, c * 0.4);
    }
    // torso: twist against the hips, breathe, bob
    rot('spine', 0.01 * br, 0.1 * s * a, 0); rot('chest', 0.018 * br, 0.06 * s * a, 0); rot('upperChest', 0.012 * br, 0, 0); rot('head', 0.01 * br, -0.12 * s * a, 0); rot('neck', 0, 0, 0);
    if (bones.hips) { bones.hips.position.y = rest.hips.y - 0.045 * a * s * s; bones.hips.rotation.set(0, -0.08 * s * a, 0); }
    // blink every few seconds
    st.blinkAt -= dt; if (st.blinkAt < 0) { st.blink = 0.17; st.blinkAt = 2.5 + Math.random() * 3; }
    st.blink = Math.max(0, st.blink - dt);
    vrm.expressionManager?.setValue('blink', st.blink > 0 ? Math.sin((1 - st.blink / 0.17) * Math.PI) : 0);
    vrm.update(dt); // expressions and spring bones
    for (const x of attachments) x.update?.(dt);
  };
  update(0.0001, 0);

  const dispose = () => { attachments.forEach((x) => x.remove()); root.removeFromParent(); VRMUtils.deepDispose(vrm.scene); };
  return { id, root, vrm, update, dispose, attachments, triangles: countTriangles(root) };
}
