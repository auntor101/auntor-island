// Builds chunk geometry off the main thread. island.js and chunks.js are pure, so they import fine here.
import { buildChunkData } from './chunks.js';

self.onmessage = ({ data: { id, cx, cz, lod } }) => {
  const d = buildChunkData(cx, cz, lod);
  self.postMessage({ id, d }, d ? [d.pos.buffer, d.nor.buffer, d.wa.buffer, d.wb.buffer, d.au.buffer, d.idx.buffer] : []);
};
