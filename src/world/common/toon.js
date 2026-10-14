// Shared anime-style materials: one stepped toon ramp so every prop shades the same way.
import { DataTexture, RedFormat, NearestFilter, MeshToonMaterial, UnsignedByteType } from 'three';

let ramp;
export function toonRamp() {
  if (!ramp) {
    ramp = new DataTexture(new Uint8Array([70, 130, 200, 255]), 4, 1, RedFormat, UnsignedByteType);
    ramp.minFilter = ramp.magFilter = NearestFilter;
    ramp.needsUpdate = true;
  }
  return ramp;
}
export const toonMat = (color, opts = {}) => new MeshToonMaterial({ color, gradientMap: toonRamp(), ...opts });
