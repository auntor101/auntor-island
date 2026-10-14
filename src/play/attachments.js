// Accessories for VRM characters: elf ears, wizard hat, robe, staff, beard.
// Each helper is (vrm, opts) -> { object, remove(), update?(dt) }. Geometry is built from lathes, extrusions and tubes,
// parented to the character's normalised humanoid bones (so it moves with the body) and measured from the character itself.
import {
  BackSide, Color, DataTexture, DoubleSide, ExtrudeGeometry, Group, LatheGeometry, Mesh, MeshBasicMaterial, MeshToonMaterial, NearestFilter,
  Quaternion, RedFormat, Shape, SRGBColorSpace, TubeGeometry, CatmullRomCurve3, Vector2, Vector3, Box3, CylinderGeometry,
} from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const bone = (vrm, n) => vrm.humanoid.getNormalizedBoneNode(n);
// VRM0 models keep their original -z facing inside vrm.scene (rotateVRM0 turns the whole scene), so bone-local x and z are mirrored
export const isFlipped = (vrm) => vrm.meta?.metaVersion === '0';
const matName = (o) => [o.material].flat().map((m) => m?.name || '').join(' ');

let gradient;
const toon = (color, opts = {}) => {
  gradient ||= Object.assign(new DataTexture(new Uint8Array([80, 160, 255]), 3, 1, RedFormat), { minFilter: NearestFilter, magFilter: NearestFilter, needsUpdate: true });
  return new MeshToonMaterial({ color, gradientMap: gradient, side: DoubleSide, ...opts });
};
// weld the lathe seam and recompute normals so the surface shades smoothly
const smooth = (g) => { g.deleteAttribute('uv'); const m = mergeVertices(g, 1e-5); m.computeVertexNormals(); return m; };

// average colour of a texture region (browser only); used to match skin and hair
export function sampleColor(tex, fallback = '#f0c8b0', bright) {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 16;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(tex.image, 0, 0, 16, 16);
    const d = x.getImageData(0, 0, 16, 16).data, px = [];
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) px.push([d[i], d[i + 1], d[i + 2]]);
    px.sort((p, q) => q[0] + q[1] + q[2] - p[0] - p[1] - p[2]); // the lit half of the texture, not the shadows and blush
    const top = px.slice(0, Math.ceil(px.length * (bright ?? 0.4))), m = (k) => top.reduce((t, p) => t + p[k], 0) / top.length / 255;
    return top.length ? new Color().setRGB(m(0), m(1), m(2), SRGBColorSpace) : new Color(fallback);
  } catch { return new Color(fallback); }
}
const matColor = (vrm, re, fallback, bright) => {
  let col = null;
  vrm.scene.traverse((o) => { if (!col && o.isMesh) for (const m of [o.material].flat()) if (!col && re.test(m.name || '') && m.map) col = sampleColor(m.map, fallback, bright); });
  return col || new Color(fallback);
};
export const skinColor = (vrm) => matColor(vrm, /face.*skin|skin/i, '#f0c8b0', 0.5);
export const hairColor = (vrm) => matColor(vrm, /hair/i, '#6a4a3a', 1);

// Head frame: face and hair vertices in head-bone local space (rest pose, call at load time).
export function measureHead(vrm) {
  const head = bone(vrm, 'head'), v = new Vector3(), box = new Box3(), hair = [], face = [], fl = isFlipped(vrm) ? -1 : 1;
  vrm.scene.updateMatrixWorld(true);
  const pts = (mesh) => {
    mesh.skeleton?.update();
    const p = mesh.geometry.attributes.position, out = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld); head.worldToLocal(v); out.set([v.x * fl, v.y, v.z * fl], i * 3); }
    return out;
  };
  vrm.scene.traverse((o) => {
    if (!o.isMesh || !o.geometry.attributes.position) return;
    const n = matName(o);
    if (/face/i.test(n) && /skin/i.test(n)) { const a = pts(o); face.push(a); for (let i = 0; i < a.length; i += 3) box.expandByPoint(v.set(a[i], a[i + 1], a[i + 2])); }
    else if (/hair/i.test(n)) hair.push({ mesh: o, pts: pts(o) });
  });
  if (box.isEmpty()) box.set(new Vector3(-0.08, -0.03, -0.09), new Vector3(0.08, 0.2, 0.09)); // shortcut: unknown rig, generic head
  // half width of the skull at eye height, measured on the front half of the head so the human ears do not count
  const eyeY = box.min.y + (box.max.y - box.min.y) * 0.46, cz0 = (box.min.z + box.max.z) / 2;
  let hw = 0; for (const a of face) for (let i = 0; i < a.length; i += 3) if (Math.abs(a[i + 1] - eyeY) < 0.02 && a[i + 2] > cz0) hw = Math.max(hw, Math.abs(a[i]));
  return { head, box, hair, hw: hw || (box.max.x - box.min.x) * 0.38, eyeY, cx: (box.min.x + box.max.x) / 2, cz: (box.min.z + box.max.z) / 2, w: box.max.x - box.min.x, h: box.max.y - box.min.y };
}

const add = (vrm, parent, object, extra = {}) => {
  const pivot = extra.raw ? object : new Group(); // pivot turns the "model forward" frame back into the bone's own frame
  if (!extra.raw) { pivot.rotation.y = isFlipped(vrm) ? Math.PI : 0; pivot.add(object); }
  parent.add(pivot);
  return {
    object, ...extra,
    remove() { pivot.removeFromParent(); pivot.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); }); extra.restore?.(); },
  };
};

// ---------- elf ears ----------
export function addElfEars(vrm, opts = {}) {
  const f = opts.frame || measureHead(vrm), s = (opts.scale ?? 0.88) * f.hw / 0.075;
  const sh = new Shape(); // ear outline in (z, y): rounded lobe at the front, long upper edge sweeping back and up to the tip
  sh.moveTo(0.008, -0.034).quadraticCurveTo(0.026, -0.004, 0.01, 0.034).bezierCurveTo(-0.01, 0.052, -0.05, 0.062, -0.105, 0.062)
    .bezierCurveTo(-0.07, 0.03, -0.05, 0.0, -0.036, -0.022).quadraticCurveTo(-0.02, -0.04, 0.008, -0.034);
  const g = new ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 3, curveSegments: 16 });
  g.translate(0, 0, -0.003); g.rotateY(Math.PI / 2); // extrusion now runs along x, outline lies in the zy plane
  const skin = (opts.color || skinColor(vrm)).clone().lerp(new Color('#ffffff'), 0.3);
  const mat = toon(skin, { emissive: skin, emissiveIntensity: 0.18 }), inner = toon(skin.clone().lerp(new Color('#e58a95'), 0.45)), hullMat = toon('#5a3a46', { side: BackSide });
  const ig = new ExtrudeGeometry(sh, { depth: 0.002, bevelEnabled: false }); ig.translate(0, 0, -0.001); ig.rotateY(Math.PI / 2);
  const hg = new ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.0055, bevelSize: 0.0055, bevelSegments: 2, curveSegments: 16 }); hg.translate(0, 0, -0.003); hg.rotateY(Math.PI / 2);
  const grp = new Group(), eyeY = f.eyeY + 0.01;
  for (const side of [1, -1]) {
    const m = new Mesh(g, mat), pin = new Mesh(ig, inner), hull = new Mesh(hg, hullMat);
    pin.scale.set(1.0, 0.55, 0.55); pin.position.set(0, 0.006, -0.03); pin.renderOrder = 1; m.add(pin, hull); // pink inner ear and a dark outline
    m.scale.set(side * s, s, s);
    m.position.set(f.cx + side * (f.hw - 0.008 * s), eyeY, f.cz - 0.005);
    m.rotateY(side * 0.45); m.rotateZ(-side * 0.12); // sweep the tip back and out
    grp.add(m);
  }
  return add(vrm, f.head, grp);
}

// ---------- wizard hat ----------
export function addWizardHat(vrm, opts = {}) {
  const f = opts.frame || measureHead(vrm), s = f.hw / 0.075;
  const bandY = f.box.min.y + f.h * (opts.band ?? 0.7);
  // radius of the hair (and head) at band height, so the hat band clears everything underneath
  let rb = f.w * 0.5;
  for (const { pts } of f.hair) for (let i = 0; i < pts.length; i += 3) if (Math.abs(pts[i + 1] - bandY) < 0.015) rb = Math.max(rb, Math.hypot(pts[i] - f.cx, pts[i + 2] - f.cz));
  rb = rb * 1.03 + 0.008;
  // hair clumps that sit entirely above the band would poke through the crown: hide them
  const hidden = [];
  for (const { mesh, pts } of f.hair) {
    let lo = Infinity; for (let i = 1; i < pts.length; i += 3) lo = Math.min(lo, pts[i]);
    if (lo > bandY && mesh.visible) { mesh.visible = false; hidden.push(mesh); }
  }
  const H = 0.36 * s, brim = 0.085 * s, P = [new Vector2(rb - 0.004, -0.004), new Vector2(rb + brim * 0.5, -0.016 * s), new Vector2(rb + brim, -0.03 * s), new Vector2(rb + brim + 0.006, -0.022 * s),
    new Vector2(rb + brim * 0.5, 0.0), new Vector2(rb + 0.01, 0.012 * s)];
  for (let i = 1; i <= 24; i++) { const t = i / 24; P.push(new Vector2(rb * Math.pow(1 - t, 0.85) * (1 + 0.04 * Math.sin(t * Math.PI)), 0.012 * s + t * H)); }
  const g = new LatheGeometry(P, 48), pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) { // bend the tip backwards and let it droop
    const t = Math.max(0, pos.getY(i) / H);
    pos.setZ(i, pos.getZ(i) - 0.55 * H * t * t * t); pos.setY(i, pos.getY(i) - 0.12 * H * t * t * t * t);
  }
  const hat = new Mesh(smooth(g), toon(opts.color ?? '#3b2f78'));
  const band = new Mesh(smooth(new LatheGeometry([new Vector2(rb + 0.004, 0.006 * s), new Vector2(rb * 0.98 + 0.012, 0.03 * s), new Vector2(rb * 0.97 + 0.012, 0.05 * s)].map((p) => p), 48)), toon('#d9a93a'));
  const grp = new Group(); grp.add(hat, band);
  grp.position.set(f.cx, bandY, f.cz); grp.rotation.x = -0.1; // tipped slightly back
  return add(vrm, f.head, grp, { restore: () => hidden.forEach((m) => (m.visible = true)) });
}

// ---------- robe ----------
// profile rows are [height above hips, half width x, half depth z] bottom to top; built as an elliptical lathe
function ellipticLathe(rows, seg = 40) {
  const g = new LatheGeometry(rows.map(([y, rx]) => new Vector2(rx, y)), seg), p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) { const k = rows[i % rows.length][2] / rows[i % rows.length][1]; p.setZ(i, p.getZ(i) * k); n.setZ(i, n.getZ(i) / k); }
  return smooth(g);
}
const tube = (a, b, r0, r1, flare = 0) => { // tapered sleeve from a to b (both in bone space)
  const d = b.clone().sub(a), g = new LatheGeometry([new Vector2(r0 * 0.8, -0.07), new Vector2(r0, -0.03), new Vector2((r0 + r1) / 2, d.length() * 0.5), new Vector2(r1 + flare, d.length())], 20);
  g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.normalize())); g.translate(a.x, a.y, a.z);
  return smooth(g);
};
export function addWizardRobe(vrm, opts = {}) {
  vrm.scene.updateMatrixWorld(true);
  const W = (n) => bone(vrm, n).getWorldPosition(new Vector3());
  const hips = W('hips'), y = (n) => W(n).y - hips.y;
  const S = Math.abs(W('leftUpperArm').x - W('rightUpperArm').x) / 2;
  const knee = y('leftLowerLeg'), hem = knee - 0.15; // just below the knee; legs swing inside the flare
  const rows = [
    [hem, Math.max(0.3, S * 2.2), Math.max(0.33, S * 2.4)], [knee, S * 1.9, S * 2.0], [(knee + y('leftUpperLeg')) / 2, S * 1.6, S * 1.6], [y('leftUpperLeg'), S * 1.3, S * 1.2],
    [-0.02, S * 1.12, S * 1.05], [y('spine') * 0.9, S * 1.08, S * 0.95], [y('chest'), S * 1.25, S * 1.02], [y('leftUpperArm') + 0.01, S * 1.6, S * 0.98], [y('leftUpperArm') + 0.045, S * 1.2, S * 0.85],
    [y('neck') - 0.012, S * 0.64, S * 0.6], [y('neck') + 0.025, S * 0.5, S * 0.5], [y('neck') + 0.05, S * 0.52, S * 0.52],
  ];
  const mat = toon(opts.color ?? '#2c3f8f'), trim = toon(opts.trim ?? '#d9a93a'), grp = new Group();
  grp.add(new Mesh(ellipticLathe(rows), mat));
  const ring = (yy, r0, r1, rz0, rz1, m) => new Mesh(ellipticLathe([[yy, r0, rz0], [yy + 0.04, r1, rz1]], 40), m);
  grp.add(ring(hem, rows[0][1] + 0.006, rows[0][1] + 0.004, rows[0][2] + 0.006, rows[0][2] + 0.004, trim)); // hem trim
  grp.add(ring(rows[4][0] - 0.03, rows[4][1] + 0.01, rows[4][1] + 0.01, rows[4][2] + 0.01, rows[4][2] + 0.01, trim)); // belt
  const parts = [{ node: bone(vrm, 'hips'), obj: grp }];
  for (const side of ['left', 'right']) {
    const ua = bone(vrm, side + 'UpperArm'), la = bone(vrm, side + 'LowerArm'), hd = bone(vrm, side + 'Hand');
    ua.add(new Mesh(tube(new Vector3(), la.position.clone(), 0.08, 0.058), mat)); // sleeves ride on the arm bones
    la.add(new Mesh(tube(new Vector3(), hd.position.clone(), 0.052, 0.05, 0.035), mat));
    parts.push({ node: ua, obj: ua.children.at(-1) }, { node: la, obj: la.children.at(-1) });
  }
  const h = add(vrm, bone(vrm, 'hips'), grp);
  return { ...h, parts, remove() { h.remove(); for (const { obj } of parts.slice(1)) { obj.removeFromParent(); obj.geometry.dispose(); } } };
}

// ---------- staff ----------
export function addStaff(vrm, opts = {}) {
  const hand = bone(vrm, 'rightHand'), up = (opts.height ?? 0.62), down = opts.reach ?? 1.12;
  const pole = new CatmullRomCurve3([new Vector3(0, -down, 0), new Vector3(0.006, -down * 0.4, 0), new Vector3(-0.006, up * 0.3, 0.004), new Vector3(0, up, 0)]);
  const wood = toon('#6b4a2c'), gold = toon('#d9a93a');
  const grp = new Group(); grp.add(new Mesh(new TubeGeometry(pole, 40, 0.016, 12), wood));
  const claw = new CatmullRomCurve3([...Array(9)].map((_, i) => { const t = i / 8, a = t * Math.PI * 2.6; return new Vector3(Math.cos(a) * 0.045 * (1 - 0.25 * t), up + t * 0.12, Math.sin(a) * 0.045 * (1 - 0.25 * t)); }));
  grp.add(new Mesh(new TubeGeometry(claw, 48, 0.011, 8), wood));
  const orb = new Mesh(new LatheGeometry([...Array(13)].map((_, i) => new Vector2(Math.sin((i / 12) * Math.PI) * 0.042, -Math.cos((i / 12) * Math.PI) * 0.042)), 24), new MeshBasicMaterial({ color: opts.glow ?? '#7fe6ff' }));
  orb.position.y = up + 0.07; grp.add(orb);
  const cap = new Mesh(new CylinderGeometry(0.019, 0.019, 0.03, 12), gold); cap.position.y = -down + 0.015; grp.add(cap);
  grp.position.set(0.045 * Math.sign(hand.position.x || 1), -0.012, 0); // grip a little along the fingers
  const q = new Quaternion(), r = new Quaternion(), tilt = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -0.06);
  const handle = add(vrm, hand, grp, {
    raw: true,
    update() { // keep the staff upright in the world whatever the hand does
      hand.getWorldQuaternion(q).invert(); vrm.scene.getWorldQuaternion(r);
      grp.quaternion.copy(q).multiply(r).multiply(tilt);
    },
  });
  return handle;
}

// ---------- beard (off by default) ----------
export function addBeard(vrm, opts = {}) {
  const f = opts.frame || measureHead(vrm), s = f.w / 0.16;
  const sh = new Shape();
  sh.moveTo(-0.062, 0.03).bezierCurveTo(-0.07, -0.04, -0.045, -0.1, 0, -0.17).bezierCurveTo(0.045, -0.1, 0.07, -0.04, 0.062, 0.03)
    .bezierCurveTo(0.03, 0.0, -0.03, 0.0, -0.062, 0.03);
  const g = new ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3, curveSegments: 18 });
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) - 2.2 * p.getX(i) * p.getX(i)); // wrap round the jaw
  g.computeVertexNormals();
  const col = (opts.color || hairColor(vrm)).clone().lerp(new Color('#e8e8ee'), opts.grey ?? 0.55);
  const m = new Mesh(g, toon(col));
  m.scale.setScalar(s); m.position.set(f.cx, f.box.min.y + 0.03 * s, f.box.max.z - 0.035 * s);
  return add(vrm, f.head, m);
}
