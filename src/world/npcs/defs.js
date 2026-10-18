// Who stands where, and what they look like. Looks come from three VRM bases plus tints and a hat; see docs/cast.md for the people.
// spot: { at: 'square', a: degrees round the market centre, r: metres } | { at: 'venue', v } | { at: 'theatre', lx } | { at: 'anchor', k, dx, dz }
// look: hair / top / bottom / shoe colours; hat: 'chef' | 'cap' | 'colonel' | 'scarf' | 'bun'; cape: colour; h: height in m; w: width scale
export const DEFS = [
  { id: 'nma', name: 'Nma', base: 'woman', h: 1.78, look: { hair: 0x1fb5a8, top: 0x2c4a7c, bottom: 0x2b3350, shoe: 0x7a4a2a }, hat: 'cap', tag: '#7fe0d4', spot: { at: 'square', a: 200, r: 3.5 } },
  { id: 'ukkass', name: 'Ukk-ass', base: 'man', h: 1.96, look: { hair: 0xc9d0dc, top: 0x3a3f58, bottom: 0x23263a, shoe: 0x1a1a22 }, scarf: 0xff7a59, tag: '#c9d0dc', spot: { at: 'square', a: 330, r: 5 } },
  { id: 'bangodi', name: 'Bang-odi', base: 'man', h: 1.84, w: 1.18, look: { hair: 0xb8863a, top: 0x9c2f3a, bottom: 0x3b2e2a, shoe: 0x4a2f20 }, tag: '#f2b66b', spot: { at: 'square', a: 100, r: 5 } },
  { id: 'tom', name: 'Tom', base: 'man', h: 1.76, look: { hair: 0x2a2230, top: 0x2f6f8f, bottom: 0x40403a, shoe: 0x30241c }, tag: '#9fd4ea', spot: { at: 'square', a: 270, r: 6 } },
  { id: 'nanda', name: 'Nanda', base: 'woman', h: 1.72, look: { hair: 0xb59be0, top: 0x5a3f8f, bottom: 0x35295a, shoe: 0x2a2036 }, hat: 'bun', tag: '#d4c4f5', spot: { at: 'square', a: 60, r: 7 } },
  { id: 'colonel', name: 'The Colonel', base: 'man', h: 2.0, w: 1.22, look: { hair: 0x6a4a24, top: 0xc8a064, bottom: 0x8a3a2a, shoe: 0x3a2a1a }, hat: 'colonel', cape: 0xb8283a, tag: '#e8c26a', spot: { at: 'anchor', k: 'greatHall', dx: 3, dz: 2 } },
  { id: 'selkie', name: 'Selkie Dune', base: 'woman', h: 1.84, look: { hair: 0x9fc4e8, top: 0x4a6fc8, bottom: 0xe8e8f4, shoe: 0xe8e8f4 }, cape: 0x5ab0e0, tag: '#a8d4f5', spot: { at: 'theatre', lx: -3 } },
  { id: 'dax', name: 'Dax Orrel', base: 'man', h: 1.92, look: { hair: 0x9a4a2a, top: 0x5a3a2a, bottom: 0x2a2a30, shoe: 0x1a1a1a }, tag: '#e09a6a', spot: { at: 'theatre', lx: -1 } },
  { id: 'pim', name: 'Pim Tarragon', base: 'elf', h: 1.8, look: { hair: 0x5bbf6a, top: 0xe8c84a, bottom: 0x3a4a3a, shoe: 0x2a3a2a }, scarf: 0xff7a59, tag: '#a8e0a8', spot: { at: 'theatre', lx: 1 } },
  { id: 'ravenna', name: 'Ravenna Quill', base: 'woman', h: 1.86, look: { hair: 0x2a1a44, top: 0x4a1a5a, bottom: 0x1a1226, shoe: 0x120c1c }, cape: 0x2a1040, tag: '#c4a0e8', spot: { at: 'theatre', lx: 3 } },
  { id: 'tira', name: 'Tira Bellweather', base: 'woman', h: 1.62, w: 1.1, look: { hair: 0xf0d890, top: 0xf6c8d0, bottom: 0xf4ead8, shoe: 0xb87a5a }, hat: 'bun', tag: '#f6c8d0', spot: { at: 'venue', v: 'tiramisu' } },
  { id: 'mungma', name: 'Mung-ma', base: 'woman', h: 1.52, w: 1.1, look: { hair: 0x1a1418, top: 0xb82a2a, bottom: 0x2a2020, shoe: 0x2a2020 }, hat: 'scarf', tag: '#f08a7a', spot: { at: 'venue', v: 'mungdi' } },
  { id: 'fenn', name: 'Fenn', base: 'elf', h: 1.92, look: { hair: 0x6fe0b8, top: 0x2f4f4a, bottom: 0x20302e, shoe: 0x101818 }, tag: '#9fe8cc', spot: { at: 'venue', v: 'coffee' } },
  { id: 'bighob', name: 'Big Hob', base: 'man', h: 1.9, w: 1.3, look: { hair: 0x6a3a1a, top: 0xf4f0e8, bottom: 0x3a3a46, shoe: 0x2a2018 }, hat: 'chef', tag: '#f4f0e8', spot: { at: 'venue', v: 'steakhouse' } },
  { id: 'sela', name: 'Sela', base: 'woman', h: 1.7, look: { hair: 0x3a9ad8, top: 0xf0f4f8, bottom: 0x24507a, shoe: 0x2a2a30 }, hat: 'cap', tag: '#8ad0f5', spot: { at: 'venue', v: 'seafood' } },
  { id: 'plush', name: 'Mr Plush', base: 'man', h: 1.9, look: { hair: 0x2a2a3a, top: 0x6a2a7a, bottom: 0x241a2c, shoe: 0x14101a }, tag: '#d09ae8', spot: { at: 'venue', v: 'velvet-lounge' } },
  { id: 'oat', name: 'Granny Oat', base: 'woman', h: 1.5, look: { hair: 0xf2f2f6, top: 0xb69be0, bottom: 0x6a5a8a, shoe: 0x4a3a2a }, hat: 'bun', tag: '#e0d4f5', spot: { at: 'anchor', k: 'market', dx: -9, dz: 7 } },
  { id: 'brine', name: 'Harbourmaster Brine', base: 'man', h: 1.88, look: { hair: 0x8a96a8, top: 0x3a5a78, bottom: 0x2a3a4c, shoe: 0x1c2630 }, hat: 'cap', tag: '#a0c4e0', spot: { at: 'anchor', k: 'harbourDock', dx: 1.5, dz: 0 } },
  { id: 'wick', name: 'Wick', base: 'man', h: 1.7, look: { hair: 0xd8a24a, top: 0x8a6a3a, bottom: 0x3a3028, shoe: 0x2a1c14 }, hat: 'cap', tag: '#f5d48a', spot: { at: 'anchor', k: 'feastStreet', dx: 3, dz: 4.5 } },
];

export const BASES = ['man', 'woman', 'elf'];
