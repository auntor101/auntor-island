import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { ROSTER } from '../src/play/roster.js';
import * as att from '../src/play/attachments.js';
import { vrmMeta, licenceOk } from '../scripts/vrm-meta.mjs';

const path = (r) => new URL(`../public/models/${r.file}`, import.meta.url);

test('roster has exactly man, woman, elf, wizard', () => {
  assert.deepEqual(Object.keys(ROSTER).sort(), ['elf', 'man', 'wizard', 'woman']);
  for (const [k, r] of Object.entries(ROSTER)) { assert.equal(r.id, k); assert.ok(r.label && r.file && r.base && Array.isArray(r.attach)); }
});
test('model files exist, are small and have a passing licence', () => {
  for (const r of Object.values(ROSTER)) {
    const size = statSync(path(r)).size;
    assert.ok(size < 6e6, `${r.file} is ${size} bytes`);
    assert.ok(licenceOk(vrmMeta(readFileSync(path(r)))), `${r.file} licence`);
  }
});
test('licenceOk rules', () => {
  assert.ok(licenceOk({ version: 0, licenseName: 'CC0' }));
  assert.ok(!licenceOk({ version: 0, licenseName: 'Other' }));
  assert.ok(!licenceOk({ version: 1, avatarPermission: 'onlyAuthor', modification: 'allowModification', allowRedistribution: true }));
  assert.ok(!licenceOk({ version: 1, avatarPermission: 'everyone', modification: 'prohibited', allowRedistribution: true }));
});
test('attachment helpers are functions', () => {
  for (const n of ['addElfEars', 'addWizardHat', 'addWizardRobe', 'addStaff', 'addBeard']) assert.equal(typeof att[n], 'function', n);
});
