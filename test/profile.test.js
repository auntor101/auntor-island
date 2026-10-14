import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeName, normalize, load, save } from '../src/profile.js';

test('sanitizeName trims, strips tags and control characters, caps at 12', () => {
  assert.equal(sanitizeName('  Sam  '), 'Sam');
  assert.equal(sanitizeName('A<b>c'), 'Abc');
  assert.equal(sanitizeName('abcdefghijklmnop'), 'abcdefghijkl');
  assert.equal(sanitizeName('\u0007Zed\u0000'), 'Zed');
  assert.equal(sanitizeName("O'Brien"), "O'Brien");
  assert.equal(sanitizeName('Ann\u202e'), 'Ann');
  assert.equal(Array.from(sanitizeName('😀'.repeat(14))).length, 12);
});
test('sanitizeName falls back to Traveler for empty, invisible or non-string input', () => {
  for (const v of ['', null, 42, '\u200b\u200b']) assert.equal(sanitizeName(v), 'Traveler');
});
test('blocked words are matched as whole words only', () => {
  for (const n of ['Nazia', 'Nazim', 'Nazir', 'Shital', 'Ashita', 'Grape', 'Scunthorpe', 'Ana Zip']) assert.equal(sanitizeName(n), n);
  for (const n of ['fuck', 'F u c k', 'Fucker', 'nazi', 'SHIT']) assert.equal(sanitizeName(n), 'Traveler');
});
test('normalize validates the character and the name', () => {
  assert.deepEqual(normalize(null), { char: 'man', name: 'Traveler' });
  assert.deepEqual(normalize({ char: 'elf', name: 'Ann' }), { char: 'elf', name: 'Ann' });
  assert.equal(normalize({ char: 'dragon' }).char, 'man');
  assert.equal(normalize({ char: '__proto__' }).char, 'man');
});
test('load and save survive missing, broken or throwing storage', () => {
  const d = {}, s = { getItem: (k) => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = v; } };
  assert.deepEqual(load(s), normalize(null));
  save(s, { char: 'woman', name: 'Mo' });
  assert.deepEqual(load(s), { char: 'woman', name: 'Mo' });
  s.setItem('isle.profile', '{not json');
  assert.deepEqual(load(s), normalize(null));
  assert.deepEqual(load(null), normalize(null));
  assert.doesNotThrow(() => save(null, {}));
  assert.doesNotThrow(() => save({ setItem() { throw new Error('quota'); } }, {}));
});
