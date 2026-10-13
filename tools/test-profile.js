const assert = require('assert');
const P = require('../js/profile.js');

// sanitizeName
assert.strictEqual(P.sanitizeName('  Sam  '), 'Sam');
assert.strictEqual(P.sanitizeName('A<b>c'), 'Abc');
assert.strictEqual(P.sanitizeName('abcdefghijklmnop'), 'abcdefghijkl');
assert.strictEqual(P.sanitizeName('\u0007Zed\u0000'), 'Zed');
assert.strictEqual(P.sanitizeName(''), 'Traveler');
assert.strictEqual(P.sanitizeName(null), 'Traveler');
assert.strictEqual(P.sanitizeName(42), 'Traveler');
assert.strictEqual(P.sanitizeName('F u c k'), 'Traveler');
assert.strictEqual(P.sanitizeName("O'Brien"), "O'Brien");
assert.strictEqual(Array.from(P.sanitizeName('😀😀😀😀😀😀😀😀😀😀😀😀😀😀')).length, 12);

// normalize
assert.deepStrictEqual(P.normalize(null), { gender: 'm', name: 'Traveler', look: 0, skin: 0 });
assert.deepStrictEqual(P.normalize({ gender: 'f', name: 'Ann', look: 2, skin: 3 }), { gender: 'f', name: 'Ann', look: 2, skin: 3 });
assert.strictEqual(P.normalize({ gender: 'x' }).gender, 'm');
assert.strictEqual(P.normalize({ look: 99 }).look, 0);
assert.strictEqual(P.normalize({ skin: -1 }).skin, 0);
assert.strictEqual(P.normalize({ look: '1' }).look, 0);

// load / save
const mem = () => { const d = {}; return { getItem: k => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = v; } }; };
const s = mem();
assert.deepStrictEqual(P.load(s), P.normalize(null));
P.save(s, { gender: 'f', name: 'Mo', look: 1, skin: 2 });
assert.deepStrictEqual(P.load(s), { gender: 'f', name: 'Mo', look: 1, skin: 2 });
s.setItem('lumen-isle-profile-v1', '{not json');
assert.deepStrictEqual(P.load(s), P.normalize(null));
assert.deepStrictEqual(P.load(null), P.normalize(null));
assert.doesNotThrow(() => P.save(null, {}));
assert.doesNotThrow(() => P.save({ setItem() { throw new Error('quota'); } }, {}));

// playerOpts
const o = P.playerOpts({ gender: 'f', name: 'Ann', look: 1, skin: 2 });
assert.strictEqual(o.style, 'player');
assert.strictEqual(o.gender, 'f');
assert.strictEqual(o.skin, P.SKINS[2]);
assert.strictEqual(o.shirt, P.LOOKS.f[1].shirt);

console.log('profile tests ok');
