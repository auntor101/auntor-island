// Feast Quarter menus, small buffs and the Food Passport. Pure; storage is passed in and validated on read. Everything on the menu is made up and family friendly.
export const BUFFS = {
  swift: { label: 'Swift feet', secs: 45, mul: 1.25 },
  steady: { label: 'Steady wings', secs: 60, mul: 1 }, // stamina refills faster while flying (see flight.js REFILL via perk)
  merry: { label: 'Merry', secs: 60, mul: 1 }, // cosmetic: a happy note, no stat
};
export const MENUS = {
  tiramisu: { name: 'Tiramisu Nook', items: [['tira-classic', 'Moonlit tiramisu', 'steady'], ['tira-berry', 'Wild-berry tiramisu cup', 'merry'], ['tira-chai', 'Chai tiramisu', 'swift']] },
  'blueberry-cheesecake': { name: 'Blue Cheesecake Hut', items: [['bc-slice', 'Blueberry cheesecake slice', 'merry'], ['bc-jar', 'Cheesecake in a jar', 'steady'], ['bc-swirl', 'Swirl cheesecake', 'swift']] },
  mungdi: { name: 'Mungdi Noodle House', items: [['mn-broth', 'Mungdi broth noodles', 'swift'], ['mn-dry', 'Dry-chilli mungdi', 'swift'], ['mn-veg', 'Garden mungdi', 'steady']] },
  coffee: { name: 'Lantern Coffee', items: [['cf-flat', 'Flat white of the isle', 'swift'], ['cf-cold', 'Cold-foam sunrise', 'steady'], ['cf-cocoa', 'Cloud cocoa', 'merry']] },
  steakhouse: { name: 'Hearth Steakhouse', items: [['sk-ribeye', 'Fire-seared ribeye', 'steady'], ['sk-mush', 'Mushroom steak', 'steady'], ['sk-pie', 'Colonel\'s pepper pie', 'swift']] },
  seafood: { name: 'Harbour Stalls', items: [['sf-prawn', 'Harbour prawn skewer', 'swift'], ['sf-chowder', 'Sea-glass chowder', 'steady'], ['sf-fish', 'Crispy fish wrap', 'merry']] },
  'asian-fusion': { name: 'Fusion Counter', items: [['af-bao', 'Dragon-egg bao', 'merry'], ['af-bowl', 'Teriyaki rice bowl', 'steady'], ['af-roll', 'Rainbow sushi roll', 'swift']] },
  'velvet-lounge': { name: 'Velvet Lounge', items: [['vl-elder', 'Sparkling elderflower', 'merry'], ['vl-mock', 'Midnight mocktail', 'merry'], ['vl-tea', 'Velvet spiced tea', 'steady']] },
};
export const ALL_ITEMS = Object.entries(MENUS).flatMap(([v, m]) => m.items.map(([id, name, buff]) => ({ id, name, buff, venue: v })));
export const KEY = 'isle.passport';
const IDS = new Set(ALL_ITEMS.map((i) => i.id));

// Passport: { id: times eaten }. Unknown ids and bad counts are dropped.
export function load(store) {
  const out = {};
  try { const j = JSON.parse(store.getItem(KEY) || '{}'); for (const id in j) if (IDS.has(id) && Number.isInteger(j[id]) && j[id] > 0 && j[id] < 1e6) out[id] = j[id]; } catch { /* blocked or corrupt: empty passport */ }
  return out;
}
// Eat one dish. Returns { item, first, tried, total, buff } or null for an unknown id.
export function eat(store, id) {
  const item = ALL_ITEMS.find((i) => i.id === id);
  if (!item) return null;
  const p = load(store), first = !p[id];
  p[id] = (p[id] || 0) + 1;
  try { store.setItem(KEY, JSON.stringify(p)); } catch { /* storage full: the dish was still tasty */ }
  return { item, first, tried: Object.keys(p).length, total: ALL_ITEMS.length, buff: BUFFS[item.buff] };
}
export const venueNear = (anchors, p, r = 3.5) => Object.keys(MENUS).find((v) => anchors[v] && Math.hypot(anchors[v].x - p.x, anchors[v].z - p.z) < r) || null;

// Active buff timers: { swift: secondsLeft }. Pure helpers.
export const give = (b, key) => ({ ...b, [key]: BUFFS[key].secs });
export const tick = (b, dt) => { const o = {}; for (const k in b) if (b[k] - dt > 0) o[k] = b[k] - dt; return o; };
export const speedMul = (b) => (b.swift ? BUFFS.swift.mul : 1);
