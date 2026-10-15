# Asset credits

| Asset | Author | Source | Licence |
|---|---|---|---|
| CommonTree 3, 4, 5, Bush Common (Stylized Nature MegaKit) | Quaternius | https://quaternius.com/packs/stylizednaturemegakit.html (downloaded via https://poly.pizza/bundle/Stylized-Nature-MegaKit-T34GZFA0fm) | CC0 1.0 (public domain) |
| three.js r128 (vendored in `vendor/three/`: GLTFLoader, FBXLoader, EffectComposer, passes, shaders, SkeletonUtils) | three.js authors | https://threejs.org | MIT (`vendor/three/LICENSE`) |
| fflate 0.6.9 (`vendor/three/fflate.min.js`, used by FBXLoader) | fflate authors (101arrowz) | https://github.com/101arrowz/fflate | MIT (licence stated in the file header) |
| Cat (Animal Pack Vol.2, `assets/animals/Cat.fbx`) | Quaternius | https://opengameart.org/content/animated-animales-low-poly (downloaded 2026-10-14) | CC0 1.0 (public domain) |

Bush_Common is prepared for a later bush/flower pass and is not loaded yet.

The Stylized Nature MegaKit files were downloaded from the Poly Pizza mirror on 2026-10-14. The cat was downloaded from OpenGameArt on 2026-10-14, not from Poly Pizza. Re-confirm the licence of both on their source pages before launch.

Files in `assets/nature/` are the original models with embedded textures removed and the textures shared once as 512 px WebP, produced by `tools/prepare-assets.js`.

## Playable roster (web/public/models)

| Asset | Author | Source | Licence |
|---|---|---|---|
| VRoid Studio sample characters Sakurada Fumiriya, Sendagaya Shino, Vita (embedded VRM licence `CC0`; Vivi and Victoria Rubin were also checked) | pixiv Inc. (VRoid Studio samples) | https://github.com/madjin/vrm-samples (`vroid/beta/`) | CC0 (read from each file's embedded metadata by `web/scripts/fetch-roster.mjs`) |
| `VRM1_Constraint_Twist_Sample.vrm` (extra woman, not shipped unless chosen) | pixiv Inc. | https://github.com/pixiv/three-vrm (`packages/three-vrm/examples/models/`) | VRM 1 licence: avatarPermission everyone, modification and redistribution allowed, credit unnecessary (https://vrm.dev/licenses/1.0/) |

The models in `web/public/models/` are the originals with textures shrunk to at most 1024 px by `web/scripts/shrink-vrm.mjs` (the VRM extension JSON is untouched; morph-target normal deltas are dropped and the rest stored sparse). The wizard is the man model with a procedural robe, hat and staff. Ears, hat, robe, staff and beard are generated in code (`web/src/play/attachments.js`).
| Dog (Animal Pack, `world/animals/Dog.fbx`) | Quaternius | https://opengameart.org/content/animated-animales-low-poly | CC0 1.0 (public domain) |
| Dragon (Animated Monsters, `world/animals/Dragon.fbx`) | Quaternius | https://quaternius.com/ (Animated Monster Pack) | CC0 1.0 (public domain) |

## Flora models (public/world/flora)
Trees (CommonTree_3/4/5, Pine_4/5, DeadTree_5), Bush_Common, Fern_1, Mushroom_Common, Rock_Medium_1/2/3 and their textures are from the Quaternius "Stylized Nature MegaKit", licence CC0 1.0, obtained through the Poly Pizza mirror (poly.pizza). Shrunk by `tools/prepare-flora.mjs` (geometry only, quantised, shared 512 px WebP atlases). Grass, flowers, reeds, far-tree blobs, driftwood, shells and petals are generated in code.
