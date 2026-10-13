// Optional 3D models. Everything here fails soft: if a loader or a file is missing the game keeps its built-in shapes.
(function () {
  'use strict';
  const LI = window.LI = window.LI || {};
  const cache = { model: {}, manifest: {}, texture: {} };
  let loader = null;

  const available = () => !!(window.THREE && THREE.GLTFLoader && typeof fetch === 'function');

  function memo(bucket, key, make) {
    if (!(key in cache[bucket])) cache[bucket][key] = Promise.resolve().then(make).catch(e => { console.warn('asset failed:', key, e && e.message); return null; });
    return cache[bucket][key];
  }
  const guard = make => () => (available() ? make() : null);

  const model = (dir, name) => memo('model', dir + '/' + name, guard(() => {
    loader = loader || new THREE.GLTFLoader();
    return new Promise((res, rej) => loader.load('assets/' + dir + '/' + name + '.glb', g => res(g.scene), undefined, rej));
  }));

  const manifest = dir => memo('manifest', dir, guard(() =>
    fetch('assets/' + dir + '/manifest.json').then(r => { if (!r.ok) throw new Error('manifest ' + r.status); return r.json(); })));

  const texture = (dir, file) => memo('texture', dir + '/' + file, guard(() =>
    new Promise((res, rej) => new THREE.TextureLoader().load('assets/' + dir + '/' + file, t => { t.flipY = false; res(t); }, undefined, rej))));

  LI.assets = { available, model, manifest, texture };
})();
