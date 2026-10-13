// Seasonal trees from the shared Quaternius models. Replaces the built-in blob trees once the models have loaded;
// if anything fails, the built-in trees stay.
(function () {
  'use strict';
  const LI = window.LI = window.LI || {};
  const TREES = ['CommonTree_3', 'CommonTree_4', 'CommonTree_5'];
  const TREE_H = 4.4; // world height of a scale-1 tree, about the old blob trees
  const SEASONS = {
    summer: { hue: .45, sat: 1.1, tint: [1.1, 1.15, 1.05] },
    autumn: { hue: -.75, sat: 1.2, tint: [1.3, 1.15, 1] },
    spring: { hue: -1.55, sat: .3, tint: [2.8, 2.2, 2.5] },
  };
  const HUE_GLSL = 'vec3 hueRot(vec3 c,float a){const vec3 k=vec3(.57735);float ca=cos(a),sa=sin(a);return c*ca+cross(k,c)*sa+k*dot(k,c)*(1.-ca);}';

  function seasonAt(x, z) {
    const a = (Math.atan2(z, x) + Math.PI * 2) % (Math.PI * 2);
    return a < 2.1 ? 'summer' : a < 4.2 ? 'autumn' : 'spring';
  }

  function leafMaterial(map, s) {
    const m = new THREE.MeshToonMaterial({ map, gradientMap: LI.gfx.GRAD, alphaTest: .5, side: THREE.DoubleSide, vertexColors: true });
    m.onBeforeCompile = sh => {
      sh.uniforms.uHue = { value: s.hue };
      sh.uniforms.uSat = { value: s.sat };
      sh.uniforms.uTint = { value: new THREE.Vector3(s.tint[0], s.tint[1], s.tint[2]) };
      sh.fragmentShader = 'uniform float uHue;uniform float uSat;uniform vec3 uTint;\n' + HUE_GLSL + '\n' +
        sh.fragmentShader.replace('#include <map_fragment>',
          '#include <map_fragment>\n diffuseColor.rgb=hueRot(diffuseColor.rgb,uHue);float lum=dot(diffuseColor.rgb,vec3(.299,.587,.114));diffuseColor.rgb=min(mix(vec3(lum),diffuseColor.rgb,uSat)*uTint,vec3(.82));');
    };
    m.customProgramCacheKey = () => 'leaf' + s.hue;
    return m;
  }
  function barkMaterial(map) {
    return new THREE.MeshToonMaterial({ map, gradientMap: LI.gfx.GRAD, vertexColors: true });
  }

  // Mesh parts of a loaded model with transforms baked in, scaled to TREE_H and standing on y=0.
  function parts(scene) {
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    const k = TREE_H / (box.max.y - box.min.y);
    const fix = new THREE.Matrix4().makeTranslation(0, -box.min.y * k, 0).multiply(new THREE.Matrix4().makeScale(k, k, k));
    const out = [];
    scene.traverse(o => { if (o.isMesh) out.push({ geo: o.geometry, matName: o.material.name, local: fix.clone().multiply(o.matrixWorld) }); });
    return out;
  }

  // Zero-scales the first n instances of the built-in forest so the new trees replace them (blob shadows stay).
  function hideProcedural(f, n) {
    if (!f) return;
    if (n >= f.trunk.count) { f.trunk.visible = f.fol.visible = f.folO.visible = false; return; } // all replaced: skip their draw calls
    const z = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < n; i++) {
      f.trunk.setMatrixAt(i, z);
      for (let k = 0; k < f.per; k++) { f.fol.setMatrixAt(i * f.per + k, z); f.folO.setMatrixAt(i * f.per + k, z); }
    }
    [f.trunk, f.fol, f.folO].forEach(m => { m.instanceMatrix.needsUpdate = true; });
  }

  async function upgradeHub(o) {
    const A = LI.assets;
    if (!A || !A.available() || !LI.gfx) return false;
    try {
      const man = await A.manifest('nature');
      const models = await Promise.all(TREES.map(n => A.model('nature', n)));
      if (!man || models.some(m => !m)) return false;
      const prefabs = models.map(parts);
      const used = [...new Set(prefabs.flat().map(pt => pt.matName))]; // only the textures the trees need (not the bush's)
      if (used.some(m => !man[m])) return false;
      const loaded = await Promise.all(used.map(m => A.texture('nature', man[m])));
      if (loaded.some(t => !t)) return false;
      const tex = {};
      used.forEach((m, i) => { tex[m] = loaded[i]; });
      const n = Math.min(o.spots.length, LI.gfx.Q.natureTrees);
      const mats = {}, buckets = {};
      const matFor = (name, season) => {
        const key = name + '|' + season;
        if (!mats[key]) mats[key] = name.startsWith('Leaves') ? leafMaterial(tex[name], SEASONS[season]) : barkMaterial(tex[name]);
        return mats[key];
      };
      const place = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
      o.spots.slice(0, n).forEach((t, i) => {
        const v = i % prefabs.length, season = seasonAt(t.x, t.z);
        place.compose(p.set(t.x, o.h(t.x, t.z), t.z), q.setFromEuler(e.set(0, t.rot, 0)), sc.setScalar(t.s));
        prefabs[v].forEach((part, pi) => {
          const key = v + '|' + season + '|' + pi;
          (buckets[key] = buckets[key] || { part, season, list: [] }).list.push(place.clone().multiply(part.local));
        });
      });
      const col = new THREE.Color(), group = new THREE.Group();
      for (const b of Object.values(buckets)) {
        const im = new THREE.InstancedMesh(b.part.geo, matFor(b.part.matName, b.season), b.list.length);
        b.list.forEach((m, k) => { im.setMatrixAt(k, m); col.setHSL(0, 0, .82 + ((k * 37) % 10) / 55); im.setColorAt(k, col); });
        im.frustumCulled = false;
        group.add(im);
      }
      o.scene.add(group);
      try { hideProcedural(o.forest, n); } catch (err) { o.scene.remove(group); throw err; }
      return true;
    } catch (e) {
      console.warn('nature upgrade failed:', e && e.message);
      return false;
    }
  }

  LI.nature = { seasonAt, upgradeHub };
})();
