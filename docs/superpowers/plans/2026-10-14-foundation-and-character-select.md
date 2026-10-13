# Foundation and Character Select Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the game script out of `index.html` into `js/` files, then add a male/female character-select with a validated name that persists and appears in dialogue.

**Architecture:** The 800-line inline IIFE moves verbatim to `js/game.js` (no rewrite, no renaming, so nothing can break by splitting). New code lives in two small files: `js/profile.js` (pure data and validation, unit-tested in Node) and `js/charselect.js` (start-screen UI only). `game.js` exposes one small bridge, `window.LI`, with `profile`, `applyProfile(p)` and `beforeStart`. This refines the spec's "split along banners": moving the script whole is the smallest change that still lets later features live in their own files, and it avoids cross-file scope problems.

**Tech Stack:** three.js r128 (global scripts, unchanged), vanilla JS, Node `assert` and the existing `vm` test harness, Puppeteer for screenshots.

**Scope of this plan:** spec Phase 0 and the character-select part of Phase 1. The VRoid GLB avatar, Mixamo clips and face swaps are a separate plan, because they need the owner's two `.vrm` exports. Later phases (coast, venues, vehicles, festivals, banter, analytics) each get their own plan.

## Global Constraints

- Keep three.js r128 and classic `<script>` files. No bundler, no new dependencies.
- No backend. Progress and profile live in `localStorage` only, always inside try/catch.
- Player name is max 12 characters, rendered with `textContent` only, never `innerHTML`, kept on the device only.
- PG-13, stylised, non-sexual avatars.
- UI keeps the storybook paper style: cream `#fff7ea` panels, ink `#2a1f3d` text, coral `#ff7a59` accent, Fraunces and Nunito fonts.
- Phone first: tap targets at least 44px, text inputs at least 16px (stops iOS zoom), no horizontal scroll.
- Performance: no new lights, no real-time shadows, no new per-frame work.
- `npm test` must pass after every task.
- The debug hook `window.__lumen` stays.

## File Structure

| File | Responsibility |
|---|---|
| `js/game.js` | The existing game, moved verbatim, plus the small bridge edits in Task 3 and 4 |
| `js/profile.js` | `LIProfile`: `sanitizeName`, `normalize`, `load`, `save`, `playerOpts`, `LOOKS`, `SKINS`. No DOM, no THREE. |
| `js/charselect.js` | Reads and writes the character-select form, sets `LI.beforeStart` |
| `index.html` | Loses the inline script, gains three script tags, the `#pick` markup and CSS |
| `tools/test-flow.js` | Loads `js/` files from the script tags, new profile and name assertions |
| `tools/test-profile.js` | Unit tests for `profile.js` |
| `package.json` | `test` runs both test files |

---

### Task 1: Move the script into `js/game.js`

**Files:**
- Create: `js/game.js`
- Modify: `index.html` (lines 162-958 replaced by script tags)
- Modify: `tools/test-flow.js:7-9,37`

**Interfaces:**
- Produces: `js/game.js` containing exactly the old IIFE; `index.html` loads `js/profile.js`, `js/game.js`, `js/charselect.js` after the vendor scripts.

- [ ] **Step 1: Baseline. Install, run the current test, and put the folder under git**

```bash
cd /c/Users/Auntor/Desktop/lumen-isle/lumen-isle
npm install
npm test
git init
git add -A
git commit -m "chore: baseline before restructuring"
```
Expected: `npm test` ends with `no script errors` and a `max objects` line. If `git init` is not wanted, skip it and ignore the commit steps in this plan.

- [ ] **Step 2: Move the script**

```bash
mkdir -p js
sed -n '163,957p' index.html > js/game.js
head -n 161 index.html > index.new
printf '%s\n' '<script src="js/profile.js"></script>' '<script src="js/game.js"></script>' '<script src="js/charselect.js"></script>' >> index.new
tail -n +959 index.html >> index.new
mv index.new index.html
head -n 3 js/game.js
tail -n 3 js/game.js
tail -n 8 index.html
```
Expected: `js/game.js` starts with `(function(){` and ends with `})();`. `index.html` ends with the three script tags then `</body>` and `</html>`.

- [ ] **Step 3: Create empty placeholders so the page still loads**

```bash
printf '// filled in by Task 2\n' > js/profile.js
printf '// filled in by Task 5\n' > js/charselect.js
```

- [ ] **Step 4: Update the test harness to load the script tags**

In `tools/test-flow.js` replace lines 7-9:

```js
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
// UI-only files need a real DOM, which the headless stub does not provide.
const UI_ONLY = ['js/charselect.js'];
const files = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map(m => m[1]).filter(f => !UI_ONLY.includes(f));
```

and replace `vm.runInContext(code, ctx);` (line 37) with:

```js
for (const f of files) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
```

- [ ] **Step 5: Run the test**

Run: `npm test`
Expected: PASS, same `ok` lines as the baseline and `no script errors`.

- [ ] **Step 6: Serve it and check it in a browser**

Run: `npx serve .` and open the printed URL. The start screen shows and "Enter the island" works. Check the browser console is clean.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: move inline game script to js/game.js"
```

---

### Task 2: `profile.js` with unit tests

**Files:**
- Create: `tools/test-profile.js`
- Modify: `js/profile.js`
- Modify: `package.json` (`test` script)

**Interfaces:**
- Produces, on `window.LIProfile` (and `module.exports` under Node):
  - `sanitizeName(raw: any): string` (1-12 chars, never empty)
  - `normalize(p: any): {gender:'m'|'f', name:string, look:number, skin:number}`
  - `load(storage: Storage|null|undefined): Profile` (never throws)
  - `save(storage, p): void` (never throws)
  - `playerOpts(p: Profile): object` (options for `makeChar`)
  - `LOOKS: {m: Look[], f: Look[]}`, `SKINS: string[]`

- [ ] **Step 1: Write the failing test**

Create `tools/test-profile.js`:

```js
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
```

- [ ] **Step 2: Run it to see it fail**

Run: `node tools/test-profile.js`
Expected: FAIL with `TypeError: P.sanitizeName is not a function` (the placeholder exports nothing).

- [ ] **Step 3: Implement**

Replace `js/profile.js` with:

```js
// Player profile: pure data and validation. No DOM, no THREE. Loaded before game.js.
(function (root) {
  'use strict';
  const KEY = 'lumen-isle-profile-v1';
  const MAXLEN = 12, FALLBACK = 'Traveler';
  const SKINS = ['#f5c7a3', '#e0a77d', '#b9805a', '#7a4f36'];
  const LOOKS = {
    m: [
      { label: 'Sunset', shirt: '#ff7a59', pants: '#3d5a80', hair: '#3b2a2a', scarf: '#ffc94d' },
      { label: 'Ocean', shirt: '#3f8fd2', pants: '#2b2d42', hair: '#1f1a1a', scarf: '#f1e4cf' },
      { label: 'Forest', shirt: '#5b9a6a', pants: '#5a4038', hair: '#6b4a2e', scarf: '#ff7a59' },
    ],
    f: [
      { label: 'Blossom', shirt: '#f08fb0', pants: '#3d5a80', hair: '#2a1f3d', scarf: '#fff7ea' },
      { label: 'Lavender', shirt: '#8e7dd6', pants: '#2b2d42', hair: '#3b2a2a', scarf: '#ffc94d' },
      { label: 'Sunrise', shirt: '#ff9a4d', pants: '#5a4038', hair: '#8a3b2a', scarf: '#ffffff' },
    ],
  };
  // shortcut: tiny blocklist that misses creative spellings, extend it if abuse shows up in analytics
  const BLOCK = ['fuck', 'shit', 'cunt', 'nigg', 'rape', 'nazi'];

  function sanitizeName(raw) {
    let s = typeof raw === 'string' ? raw : '';
    s = s.replace(/[\u0000-\u001f\u007f-\u009f<>]/g, '').replace(/\s+/g, ' ').trim();
    s = Array.from(s).slice(0, MAXLEN).join('').trim();
    const flat = s.toLowerCase().replace(/[^a-z]/g, '');
    if (!s || BLOCK.some(b => flat.includes(b))) return FALLBACK;
    return s;
  }
  const idx = (v, n) => (Number.isInteger(v) && v >= 0 && v < n ? v : 0);
  function normalize(p) {
    p = p && typeof p === 'object' ? p : {};
    const gender = p.gender === 'f' ? 'f' : 'm';
    return { gender, name: sanitizeName(p.name), look: idx(p.look, LOOKS[gender].length), skin: idx(p.skin, SKINS.length) };
  }
  function load(storage) {
    try { return normalize(JSON.parse(storage.getItem(KEY))); } catch (e) { return normalize(null); }
  }
  function save(storage, p) {
    try { storage.setItem(KEY, JSON.stringify(normalize(p))); } catch (e) { /* storage blocked or full: the game still works */ }
  }
  function playerOpts(p) {
    const l = LOOKS[p.gender][p.look];
    return { skin: SKINS[p.skin], shirt: l.shirt, sleeve: l.shirt, pants: l.pants, hair: l.hair, scarf: l.scarf, style: 'player', shoes: '#f1e4cf', gender: p.gender };
  }

  const api = { sanitizeName, normalize, load, save, playerOpts, LOOKS, SKINS };
  root.LIProfile = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Run it to see it pass**

Run: `node tools/test-profile.js`
Expected: `profile tests ok`

- [ ] **Step 5: Run both tests from `npm test`**

In `package.json` change the test script to:

```json
"test": "node tools/test-profile.js && node tools/test-flow.js",
```

Run: `npm test`
Expected: `profile tests ok`, then the quest-flow `ok` lines, ending `no script errors`.

- [ ] **Step 6: Commit**

```bash
git add js/profile.js tools/test-profile.js package.json
git commit -m "feat: add validated player profile module"
```

---

### Task 3: Bridge the profile into the game

**Files:**
- Modify: `js/game.js` (top of IIFE, `say`, boot block, start handler, debug hook)
- Modify: `tools/test-flow.js`

**Interfaces:**
- Consumes: `LIProfile.load`, `normalize`, `playerOpts` from Task 2.
- Produces: `window.LI = { profile, applyProfile(p), beforeStart }`; `{name}` token in `say()` text; `__lumen.say`, `__lumen.applyProfile`, `__lumen.LI`.

- [ ] **Step 1: Write the failing test**

In `tools/test-flow.js`, after `step(30);` (first line inside the async block) add:

```js
  L.applyProfile({ gender: 'f', name: 'Sam', look: 1, skin: 2 });
  expect(L.LI.profile.name === 'Sam' && L.LI.profile.gender === 'f', 'a girl profile can be applied');
  expect(L.P.c.root.parent === L.HUB.scene, 'the rebuilt player is still in the world');
  L.say({ name: 'T' }, 'Hi {name}'); L.advance();
  expect(els.dText.textContent === 'Hi Sam', '{name} is replaced in dialogue');
  L.pick(0);
```

Note: `L` is defined on the line before the async block, so also move nothing; it is already in scope.

- [ ] **Step 2: Run it to see it fail**

Run: `node tools/test-flow.js`
Expected: FAIL with `TypeError: L.applyProfile is not a function`.

- [ ] **Step 3: Add the LI object**

In `js/game.js`, directly under the `'use strict';` line (line 2) add:

```js
window.LI=window.LI||{};
```

- [ ] **Step 4: Replace the player build in the boot block**

Replace this line in the boot block:

```js
P.c=makeChar({skin:'#f5c7a3',shirt:'#ff7a59',sleeve:'#ff7a59',pants:'#3d5a80',hair:'#3b2a2a',scarf:'#ffc94d',style:'player',shoes:'#f1e4cf'});
```

with:

```js
function store(){try{return window.localStorage;}catch(e){return null;}}
function applyProfile(p){
  LI.profile=LIProfile.normalize(p);
  const old=P.c,c=makeChar(LIProfile.playerOpts(LI.profile));
  c.root.position.copy(old?old.root.position:P.pos);c.root.rotation.y=P.rot;
  if(old&&old.root.parent){old.root.parent.add(c.root);old.root.parent.remove(old.root);}
  P.c=c;
}
LI.applyProfile=applyProfile;LI.store=store;
applyProfile(LIProfile.load(store()));
```

- [ ] **Step 5: Replace `{name}` in dialogue**

In `say`, change the first line of the promise body so it reads:

```js
function say(who,text,choices){return new Promise(res=>{
  text=text.replace(/\{name\}/g,LI.profile.name);
```

(keep the following `if(dlgState&&dlgState.tm)...` line as is).

- [ ] **Step 6: Call `beforeStart` and extend the debug hook**

In the `go.addEventListener('click',()=>{` handler change the first statement to:

```js
go.addEventListener('click',()=>{if(started)return;if(LI.beforeStart)LI.beforeStart();started=true;audioInit();$('start').classList.add('gone');
```

and in `window.__lumen={...}` add `LI,say,applyProfile,` before `HUB,INNER`.

- [ ] **Step 7: Run it to see it pass**

Run: `npm test`
Expected: PASS, including `a girl profile can be applied`, `the rebuilt player is still in the world`, `{name} is replaced in dialogue`.

- [ ] **Step 8: Commit**

```bash
git add js/game.js tools/test-flow.js
git commit -m "feat: profile bridge, applyProfile and {name} in dialogue"
```

---

### Task 4: Female look in `makeChar`

**Files:**
- Modify: `js/game.js` (`makeChar`, `style==='player'` branch)

**Interfaces:**
- Consumes: `o.gender` from `LIProfile.playerOpts`.
- Produces: a longer-haired, ponytailed variant when `o.gender==='f'`. The male build is unchanged.

- [ ] **Step 1: Add the female hair**

In `makeChar`, directly after the existing `if(st==='player'){ ... }` block (it ends with the `tail` line), add:

```js
  if(st==='player'&&o.gender==='f'){const bk=M(G.sph,toon(H),0,-.1,-.15,head);bk.scale.set(.36,.42,.24);ol(bk,1.05);
    const pt=M(G.cone,toon(H),0,-.14,-.36,head);pt.scale.set(.1,.34,.1);pt.rotation.x=2.7;ol(pt,1.06);}
```

- [ ] **Step 2: Look at it**

Run `npx serve .`, open the page with the browser console, and run:

```js
__lumen.applyProfile({gender:'f',name:'Ann',look:0,skin:1})
```

Then press Enter and look at the player from behind and from the side. The long hair and ponytail should sit behind the head without clipping through the body. If the ponytail points the wrong way, adjust `pt.rotation.x` and `pt.position` until it hangs down the back.

- [ ] **Step 3: Run the tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add js/game.js
git commit -m "feat: female hair variant for the player"
```

---

### Task 5: Character-select panel

**Files:**
- Modify: `index.html` (CSS block, `#start .inner` markup)
- Modify: `js/charselect.js`

**Interfaces:**
- Consumes: `LI.profile`, `LI.applyProfile`, `LI.store`, `LIProfile.LOOKS`, `LIProfile.SKINS`, `LIProfile.save`.
- Produces: `LI.beforeStart` set to a function that reads the form, applies the profile and saves it.

- [ ] **Step 1: Add the markup**

In `index.html`, inside `#start .inner`, directly before `<button id="go" ...>` insert:

```html
      <div id="pick" role="group" aria-label="Choose your character">
        <div class="seg" role="group" aria-label="Character">
          <button type="button" data-g="m" aria-pressed="true">Male</button>
          <button type="button" data-g="f" aria-pressed="false">Female</button>
        </div>
        <input id="pname" type="text" maxlength="12" autocomplete="off" autocapitalize="words" spellcheck="false" placeholder="Your name" aria-label="Your name">
        <div class="sws" id="looks" aria-label="Outfit"></div>
        <div class="sws" id="skins" aria-label="Skin tone"></div>
      </div>
```

- [ ] **Step 2: Add the CSS**

In `index.html`, directly after the `#loadmsg{...}` rule add:

```css
#start{overflow-y:auto}
#pick{display:flex;flex-direction:column;gap:10px;align-self:flex-start;background:rgba(255,247,234,.94);color:var(--ink);border-radius:20px;padding:14px;width:min(360px,100%);box-sizing:border-box;box-shadow:0 14px 30px -12px rgba(0,0,0,.5)}
#pick .seg{display:grid;grid-template-columns:1fr 1fr;gap:6px;background:var(--paper-2);border-radius:999px;padding:4px}
#pick .seg button{min-height:44px;border:0;border-radius:999px;background:transparent;color:var(--ink);font-weight:800;font-size:15px}
#pick .seg button.on{background:var(--coral);color:#fff}
#pname{min-height:44px;box-sizing:border-box;border:2px solid rgba(42,31,61,.18);border-radius:14px;padding:0 14px;font:800 16px var(--body);color:var(--ink);background:#fff;-webkit-user-select:text;user-select:text}
#pname:focus-visible{outline:3px solid var(--gold);outline-offset:2px}
#pick .sws{display:flex;gap:10px}
#pick .sw{width:44px;height:44px;border-radius:50%;border:3px solid transparent;box-shadow:0 0 0 2px rgba(42,31,61,.18);padding:0}
#pick .sw.on{border-color:var(--ink)}
```

- [ ] **Step 3: Write the panel logic**

Replace `js/charselect.js` with:

```js
// Character-select panel on the start screen. UI only: reads the form and hands a profile to game.js.
(function () {
  'use strict';
  if (!window.LI || !LI.applyProfile || !window.LIProfile) return;
  const $ = id => document.getElementById(id);
  const P = LIProfile;
  const cur = Object.assign({}, LI.profile);
  const genderBtns = document.querySelectorAll('#pick [data-g]');
  const nameIn = $('pname'), looksEl = $('looks'), skinsEl = $('skins');

  function swatch(color, on, label, onclick) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'sw' + (on ? ' on' : ''); b.style.background = color;
    b.setAttribute('aria-label', label); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.addEventListener('click', onclick);
    return b;
  }
  function render() {
    genderBtns.forEach(b => {
      const on = b.dataset.g === cur.gender;
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    looksEl.textContent = ''; skinsEl.textContent = '';
    P.LOOKS[cur.gender].forEach((l, i) => looksEl.appendChild(swatch(l.shirt, i === cur.look, l.label + ' outfit', () => { cur.look = i; render(); })));
    P.SKINS.forEach((c, i) => skinsEl.appendChild(swatch(c, i === cur.skin, 'Skin tone ' + (i + 1), () => { cur.skin = i; render(); })));
  }
  genderBtns.forEach(b => b.addEventListener('click', () => { cur.gender = b.dataset.g; cur.look = 0; render(); }));
  nameIn.value = cur.name === 'Traveler' ? '' : cur.name;
  render();

  LI.beforeStart = () => {
    cur.name = nameIn.value;
    LI.applyProfile(cur);
    P.save(LI.store(), LI.profile);
  };
})();
```

- [ ] **Step 4: Check it on a phone-size screen**

Run `npx serve .`. In Chrome DevTools use device mode at 390x844 (iPhone 14). Check:
- The panel and the "Enter the island" button fit without clipping, and the start screen scrolls if it does not fit in landscape.
- Tapping Male and Female switches the outfit swatches, and the selected swatch has a dark ring.
- Type `<b>Zed</b>` into the name box and press Enter the island. Then run `__lumen.LI.profile.name` in the console. Expected: `bZed/b`. No HTML is injected anywhere.
- Reload. The form shows your last choices.
- Block site data in DevTools, reload. The page still loads and plays.

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: PASS. (The headless test skips `js/charselect.js` on purpose.)

- [ ] **Step 6: Commit**

```bash
git add index.html js/charselect.js
git commit -m "feat: character select with name, gender, outfit and skin"
```

---

### Task 6: Docs and review gates

**Files:**
- Modify: `CLAUDE.md` (Files and index.html sections)
- Modify: `docs/superpowers/specs/2026-10-14-lumen-isle-expansion-design.md` (Architecture paragraph)

- [ ] **Step 1: Update `CLAUDE.md`**

Replace the `index.html` bullet under **Files** with:

```
- `index.html`: the CSS, the HTML UI and the script tags.
- `js/game.js`: the whole game (the old inline script, unchanged in structure). Its banner sections are described below.
- `js/profile.js`: player profile validation and appearance data (pure, unit-tested by `tools/test-profile.js`).
- `js/charselect.js`: the start-screen character-select UI. It talks to the game only through `window.LI`.
```

Change the heading "How `index.html` is organised" to "How `js/game.js` is organised". Add a short section:

```
## The `LI` bridge
`window.LI` is how UI files talk to the game: `LI.profile` (current player profile), `LI.applyProfile(p)` (rebuilds the player), `LI.beforeStart` (called when Enter is pressed). Dialogue text may contain `{name}`, which `say()` replaces with the player's name.
```

- [ ] **Step 2: Update the spec architecture paragraph**

In the spec, replace the **Architecture** paragraph with: "`index.html` keeps the CSS, HTML and script tags. The original inline script lives unchanged in `js/game.js`; each new feature gets its own file under `js/` and talks to the game through the small `window.LI` bridge. This avoids the shared-scope problems of cutting the old script apart."

- [ ] **Step 3: Run the full checks**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Review gates (required by the owner for every phase)**

Run in order and fix real findings only:
1. `verification-before-completion`: show the `npm test` output and one 390x844 screenshot of the start screen.
2. `code-review` on the working tree.
3. `ponytail-review` on the same change.
4. `security-review`: confirm the name only ever reaches the DOM through `textContent` and `LI.profile`, and that stored data is validated on load.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md docs
git commit -m "docs: describe js/ layout and the LI bridge"
```

---

## Self-Review

**Spec coverage.** Phase 0 (split) is Task 1, deliberately simplified. Phase 1 character select (male/female, name, presets, name in banter) is Tasks 2 to 5. Security rules for the name (textContent, length cap, validation on load) are in Tasks 2, 5 and 6. **Not covered here, by design:** VRoid GLB avatar, Mixamo clips and face swaps (needs the `.vrm` files), and Phases 2 to 9.

**Placeholders.** None. The two placeholder files in Task 1 are replaced in Tasks 2 and 5.

**Type consistency.** `LIProfile` exposes `sanitizeName, normalize, load, save, playerOpts, LOOKS, SKINS` and every later use matches. `LI` exposes `profile, applyProfile, store, beforeStart` and `charselect.js` uses exactly those.

**Known gaps.** There is no live character preview on the start screen (the camera does not frame the player there); add it in the avatar plan. The profanity filter is a short blocklist. Task 4's ponytail angle needs the visual check in Step 2.
