import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAST, SHARED, NEAR_IDS } from '../src/story/cast.js';
import { DEFS } from '../src/world/npcs/defs.js';
import { createConversation, createStore, lineWeight } from '../src/story/dialogue.js';

const MAX_LEN = 110;
// Hard content rules. Whole-word matches on lower-case text (phrases match as written).
const BANNED = ['fuck', 'shit', 'bitch', 'cunt', 'asshole', 'bastard', 'damn', 'hell', 'nigger', 'nigga', 'faggot', 'fag', 'retard', 'slut', 'whore', 'sex', 'sexy', 'porn', 'nude', 'naked', 'boob', 'horny', 'blood', 'bloody', 'gore', 'corpse', 'murder', 'kill', 'killed', 'suicide', 'rape', 'nazi'];
const REAL = [
  // actors and public figures (never use)
  'scarlett', 'johansson', 'downey', 'hemsworth', 'ruffalo', 'cumberbatch', 'hiddleston', 'boseman', 'zendaya', 'gadot', 'dicaprio', 'cruise', 'jolie', 'depp', 'hathaway', 'streep', 'portman', 'blanchett', 'reeves', 'swift', 'beyonce', 'rihanna', 'kardashian', 'musk', 'zuckerberg', 'bezos',
  // politicians and leaders
  'trump', 'biden', 'obama', 'putin', 'modi', 'macron', 'merkel', 'sunak', 'netanyahu', 'kim jong', 'hitler', 'stalin', 'erdogan', 'xi jinping', 'trudeau', 'sanders', 'churchill',
  // countries, regions, nationalities
  'america', 'american', 'usa', 'canada', 'england', 'english', 'britain', 'british', 'france', 'french', 'germany', 'german', 'russia', 'russian', 'china', 'chinese', 'india', 'indian', 'japan', 'japanese', 'korea', 'korean', 'israel', 'israeli', 'palestine', 'gaza', 'ukraine', 'iran', 'iraq', 'egypt', 'egyptian', 'saudi', 'arabia', 'arab', 'mexico', 'brazil', 'australia', 'pakistan', 'italy', 'italian', 'spain', 'spanish', 'turkey', 'greece', 'africa', 'europe', 'asia', 'asian', 'texas', 'california', 'london', 'paris', 'bedouin', 'sheikh',
  // religions, communities, festivals
  'christ', 'jesus', 'allah', 'islam', 'muslim', 'hindu', 'buddhist', 'jewish', 'church', 'mosque', 'temple', 'bible', 'quran', 'christmas', 'halloween', 'easter', 'diwali', 'eid', 'hanukkah', 'ramadan', 'thanksgiving', 'pride month',
  // film brands and characters
  'marvel', 'avengers', 'iron man', 'spider-man', 'spiderman', 'thor', 'hulk', 'thanos', 'loki', 'disney', 'batman', 'superman', 'star wars', 'mcu', 'kfc',
];
const words = (s) => s.toLowerCase().replace(/[^a-z0-9'\- ]/g, ' ');
const has = (text, w) => new RegExp(`(^|[^a-z])${w.replace(/[-\s]/g, '[-\\s]')}($|[^a-z])`).test(words(text));

const allLines = () => {
  const out = SHARED.map((l) => ['shared', l.t]);
  for (const [id, c] of Object.entries(CAST)) { for (const l of c.banter) out.push([id, l.t]); for (const n of c.first) { out.push([id + ':' + n.id, n.text]); for (const ch of n.choices || []) out.push([id + ':choice', ch.text]); } }
  return out;
};

test('every line is short enough for a phone and free of banned and real names', () => {
  const all = allLines();
  assert.ok(all.length > 300, 'content exists: ' + all.length);
  for (const [who, t] of all) {
    assert.ok(t.length <= MAX_LEN, `${who} too long (${t.length}): ${t}`);
    assert.ok(!/<|>/.test(t), `${who} markup: ${t}`);
    for (const w of BANNED) assert.ok(!has(t, w), `${who} banned word "${w}": ${t}`);
    for (const w of REAL) assert.ok(!has(t, w), `${who} real name "${w}": ${t}`);
    assert.ok(!/[—–]/.test(t), `${who} dash: ${t}`); // plain punctuation, no em dashes
  }
});

test('the name check itself works', () => {
  assert.ok(has('I met Trump today', 'trump'));
  assert.ok(has('a trip to Paris!', 'paris'));
  assert.ok(!has('the trumpet played', 'trump'));
  assert.ok(has('Spider-Man swings', 'spider-man'));
});

const CATS = ['day', 'night', 'snow', 'greet', 'mcu', 'astro', 'science', 'council', 'tease', 'comp', 'rumour'];
test('everyone in DEFS has a script, 12 to 20 lines of their own plus shared, all categories, one rumour', () => {
  assert.deepEqual(Object.keys(CAST).sort(), DEFS.map((d) => d.id).sort());
  for (const d of DEFS) {
    const c = CAST[d.id], pool = [...c.banter, ...SHARED];
    assert.ok(c.banter.length >= 11 && c.banter.length <= 20, d.id + ' own lines ' + c.banter.length);
    assert.ok(pool.length >= 12, d.id + ' pool');
    for (const cat of CATS) assert.ok(c.banter.some((l) => l.c === cat), `${d.id} lacks ${cat}`);
    assert.equal(c.banter.filter((l) => l.c === 'rumour').length, 1, d.id + ' rumour');
    assert.equal(new Set(c.banter.map((l) => l.t)).size, c.banter.length, d.id + ' duplicate lines');
    // something is sayable at noon, at night, in snow, and with each companion
    for (const ctx of [{ hours: 12, snow: 0, comp: 'cat', met: 2 }, { hours: 23, snow: 0, comp: 'dog', met: 2 }, { hours: 12, snow: 1, comp: 'dragon', met: 2 }, { hours: 12, snow: 0, comp: null, met: 1 }]) {
      assert.ok(pool.filter((l) => lineWeight(l, ctx) > 0).length >= 8, d.id + ' thin pool for ' + JSON.stringify(ctx));
    }
  }
  const rumourNear = new Set(Object.values(NEAR_IDS));
  for (const id of ['academy', 'arena', 'hatchery', 'springs', 'embers', 'icecave', 'tower', 'grove']) assert.ok(rumourNear.has(id), id);
});

test('first-meet scripts are 3 to 6 boxes with one or two choices and reach the end', () => {
  for (const [id, c] of Object.entries(CAST)) {
    const ids = new Set(c.first.map((n) => n.id));
    for (const n of c.first) { assert.ok(!n.next || ids.has(n.next), id + ' dangling ' + n.next); for (const ch of n.choices || []) assert.ok(ids.has(ch.next), id + ' bad choice'); }
    for (let pick = 0; pick < 2; pick++) {
      const cv = createConversation(c.first, 'start', createStore(null), 'Sam'); let boxes = 0, asked = 0;
      while (!cv.done && boxes < 20) { boxes++; if (cv.node.choices) { asked++; assert.ok(cv.node.choices.length >= 1 && cv.node.choices.length <= 2); } cv.choose(pick); }
      assert.ok(cv.done && boxes >= 3 && boxes <= 6 && asked >= 1, `${id} path ${pick}: ${boxes} boxes`);
    }
  }
});
