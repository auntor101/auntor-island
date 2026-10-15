// Road ribbons draped on the terrain. makeRoadRibbon(polyline, width, heightAt) -> BufferGeometry using the village atlas material (stone edge, cobble or dirt centre).
import { B } from './geom.js';
import { TILE as T } from './atlas.js';

export function addRoad(b, pts, width, heightAt, { kind = 'dirt', lift = 0.1, step = 1.6 } = {}) {
  const s = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
    for (let k = 0; k < n; k++) s.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]);
  }
  s.push(pts[pts.length - 1]);
  const hw = width / 2, e = Math.min(0.35, hw * 0.4), offs = [-hw, -hw + e, hw - e, hw], dirs = [], tile = kind === 'cobble' ? T.cobble : T.dirt;
  const rows = s.map((p, i) => {
    const a = s[Math.max(0, i - 1)], c = s[Math.min(s.length - 1, i + 1)], dx = c[0] - a[0], dz = c[1] - a[1], l = Math.hypot(dx, dz) || 1, sx = dz / l, sz = -dx / l;
    return offs.map((o, j) => { const x = p[0] + sx * o, z = p[1] + sz * o; return [x, heightAt(x, z) + lift - (j === 0 || j === 3 ? 0.04 : 0), z]; });
  });
  void dirs;
  for (let i = 0; i + 1 < rows.length; i++) for (let j = 0; j < 3; j++) {
    const o = j === 1 ? { tile, us: 0.7, vs: 0.7, col: kind === 'cobble' ? 0xfff0e0 : 0xffe8d0 } : { tile: T.stone, us: 1, vs: 1, col: 0xe8e0d8 };
    o.uo = i * 0.07;
    b.quad(rows[i][j], rows[i + 1][j], rows[i + 1][j + 1], rows[i][j + 1], o);
  }
}
export function addDisc(b, cx, cz, r, heightAt, { lift = 0.1 } = {}) { // cobbled square
  const N = 28, rings = [0, r * 0.35, r * 0.7, r - 0.45, r], pt = (k, a) => { const x = cx + Math.cos(a) * rings[k], z = cz + Math.sin(a) * rings[k]; return [x, heightAt(x, z) + lift - (k === 4 ? 0.04 : 0), z]; };
  for (let k = 0; k < 4; k++) for (let i = 0; i < N; i++) {
    const a0 = i / N * 6.2832, a1 = (i + 1) / N * 6.2832, o = k === 3 ? { tile: T.stone, us: 1, vs: 1, col: 0xe8e0d8 } : { tile: T.cobble, us: 0.75, vs: 0.75, col: k === 1 ? 0xf0e0d0 : 0xfff4e8, uo: i * 0.13 };
    b.quad(pt(k, a0), pt(k, a1), pt(k + 1, a1), pt(k + 1, a0), o);
  }
}
export function makeRoadRibbon(polyline, width, heightAt, opts) { const b = new B(); addRoad(b, polyline, width, heightAt, opts); return b.geometry(); }
