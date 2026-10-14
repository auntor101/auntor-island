// Pure data: where each plant grows. No three import (loads under node for the tests).
// cell + jit: one candidate per global cell (size cell), jittered inside the middle `jit` fraction of the cell,
//   so two instances of a species are never closer than cell * (1 - jit) (also across chunk borders).
// zones: probability per cell by zoneAt name. slope: max |grad h| (rise over run); rocks may sit on steep ground.
// water: minimum wetD (0 wet, 1 next to water, 2 two nodes away, 3 far); nearWater: only where wetD <= that (reeds).
// tier: 0 far (all the way to the fog), 1 mid (about 100 m), 2 near (about 46 m).
export const TIER_RANGE = [220, 100, 46];
export const SEASONS = ['summer', 'autumn', 'spring', 'grove'];

const RAW = [
  { id: 'tree', tier: 0, solid: 1, r: 2.2, cell: 5.6, jit: 0.5, scale: [0.85, 1.35], slope: 0.9, water: 2, hMax: 34, wood: 1, variants: 3,
    zones: { forest: 1, meadow: 0.1, grove: 0.85, village: 0.05, roost: 0.18, cove: 0.14, mountain: 0.04, lake: 0.25, river: 0.25 } },
  { id: 'pine', tier: 0, solid: 1, r: 1.8, cell: 6, jit: 0.5, scale: [0.8, 1.3], slope: 1.7, water: 2, variants: 2, alt: [28, 75],
    zones: { mountain: 0.9, forest: 0.12, roost: 0.4, meadow: 0.03 } },
  { id: 'dead', tier: 0, solid: 1, r: 1.4, cell: 8, jit: 0.6, scale: [0.7, 1.1], slope: 1.6, water: 2, variants: 1,
    zones: { volcano: 0.7, mountain: 0.03 } },
  { id: 'bush', tier: 1, solid: 1, r: 1.2, cell: 5, jit: 0.6, scale: [0.9, 1.7], slope: 0.9, water: 1, avoid: ['tree', 'pine'], variants: 1,
    zones: { meadow: 0.35, forest: 0.22, grove: 0.3, cove: 0.35, beach: 0.04, village: 0.08, lake: 0.35, river: 0.35, roost: 0.15 } },
  { id: 'rock', tier: 1, solid: 1, r: 1, cell: 7, jit: 0.7, scale: [0.6, 2.2], slope: 9, water: 1, avoid: ['tree', 'pine', 'bush'], variants: 3,
    zones: { mountain: 0.5, volcano: 0.6, beach: 0.14, cove: 0.3, roost: 0.35, glacier: 0.06, meadow: 0.05, forest: 0.07, lake: 0.3, river: 0.3 } },
  { id: 'fern', tier: 1, r: 0.5, cell: 2.4, jit: 0.7, scale: [0.8, 1.5], slope: 0.7, water: 1, avoid: ['tree', 'bush'], variants: 1,
    zones: { forest: 0.55, grove: 0.15, mountain: 0.05 } },
  { id: 'mushroom', tier: 1, r: 0.3, cell: 3.2, jit: 0.8, scale: [0.7, 1.4], slope: 0.7, water: 1, avoid: ['tree', 'bush', 'fern'], variants: 1,
    zones: { forest: 0.14, grove: 0.06 } },
  // ---- near layer (about 46 m): everything that makes the ground feel alive
  { id: 'grass', tier: 2, r: 0.2, cell: 1.05, jit: 0.9, scale: [0.8, 1.35], slope: 0.9, water: 1, patch: 1, noY: 1,
    zones: { meadow: 0.9, forest: 0.4, grove: 0.8, village: 0.6, roost: 0.45, cove: 0.5, mountain: 0.12, lake: 0.8, river: 0.8 } },
  { id: 'tall', tier: 2, r: 0.3, cell: 1.5, jit: 0.8, scale: [0.9, 1.5], slope: 1.0, water: 1, noY: 1,
    zones: { beach: 0.3, cove: 0.55, lake: 0.6, river: 0.6, meadow: 0.1, forest: 0.1, roost: 0.15 } },
  { id: 'reed', tier: 2, r: 0.3, cell: 1.5, jit: 0.8, scale: [0.9, 1.5], slope: 0.6, water: 1, nearWater: 2, noY: 1, clump: 1,
    zones: { cove: 0.85, lake: 0.95, river: 0.8, beach: 0.18, meadow: 0.5, forest: 0.4, village: 0.4, grove: 0.4 } },
  { id: 'flower', tier: 2, r: 0.1, cell: 0.8, jit: 0.9, scale: [0.8, 1.3], slope: 0.8, water: 1, drift: 1, noY: 1,
    zones: { meadow: 0.6, grove: 0.7, village: 0.35, forest: 0.08, roost: 0.2, cove: 0.15, lake: 0.3, river: 0.3 } },
  { id: 'driftwood', tier: 2, r: 0.9, cell: 14, jit: 0.6, scale: [0.7, 1.4], slope: 0.4, water: 1, variants: 1,
    zones: { beach: 0.45, cove: 0.3 } },
  { id: 'shell', tier: 2, r: 0.1, cell: 2.6, jit: 0.8, scale: [0.7, 1.3], slope: 0.4, water: 1, variants: 1,
    zones: { beach: 0.25, cove: 0.15 } },
];
export const SPECIES = RAW.map((s, i) => ({ ...s, index: i }));
export const SPECIES_BY_ID = Object.fromEntries(SPECIES.map((s) => [s.id, s]));
export const MAX_PER_CHUNK = 1400; // hard cap per species and chunk
