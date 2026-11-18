// 마을 지도 만들기 — 씨앗 하나로 강·연못·해변·건물 자리·길·나무가 정해진다
import { RNG } from '../core/util.js';

export const MAP_W = 76, MAP_H = 60;
export const G = { GRASS: 0, PATH: 1, SAND: 2, WATER: 3, SEA: 4, STONE: 5, CLIFF: 6, BRIDGE: 7, DOCK: 8, FOREST: 9 };
export const WK = { NONE: 0, RIVER: 1, POND: 2, SEA: 3, MOUTH: 4 };
export const WALKABLE = new Set([G.GRASS, G.PATH, G.SAND, G.STONE, G.BRIDGE, G.DOCK]);
export const FRUITS = ['apple', 'pear', 'peach', 'persimmon', 'mandarin'];
export const FLOWER_SPECIES = ['tulip', 'cosmos', 'pansy', 'mum'];

// 건물 종류: w,d = 차지하는 칸, door = 왼쪽에서 문까지 칸(문은 남쪽 면)
export const BUILDING = {
  hall: { w: 6, d: 4, door: [2, 3] },
  shop: { w: 5, d: 4, door: [2] },
  museum: { w: 6, d: 4, door: [2, 3] },
  home: { w: 5, d: 4, door: [2] },
  house: { w: 4, d: 3, door: [1, 2] },
};
const NUM_LOTS = 8;
const idx = (x, y) => y * MAP_W + x;

function tryGenerate(seed) {
  const r = RNG(seed);
  const W = MAP_W, H = MAP_H;
  const t = new Uint8Array(W * H);                 // 지형
  const wk = new Uint8Array(W * H);                // 물 종류
  const res = new Uint8Array(W * H);               // 1 = 아무것도 심지 않는 자리
  const objs = new Array(W * H).fill(null);
  const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

  // ---- 해변 경계선
  const beach = [];
  let b = 50;
  for (let x = 0; x < W; x++) {
    if (x % 5 === 0) b += r.int(-1, 1);
    b = Math.max(49, Math.min(51, b));
    beach.push(b);
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = G.GRASS;
    if (y < 4) v = G.CLIFF;
    else if (y >= 55) v = G.SEA;
    else if (y >= beach[x]) v = G.SAND;
    else if (x < 3 || x >= W - 3) v = G.FOREST;
    t[idx(x, y)] = v;
    if (v === G.SEA) wk[idx(x, y)] = WK.SEA;
  }

  // ---- 강: 곧은 구간과 비스듬한 구간을 번갈아
  const cx = new Array(H).fill(0);
  let x = r.int(24, 52), y = 0;
  let dir = r.chance(0.5) ? 1 : -1;
  while (y < 56) {
    const sl = y < 5 ? 7 : r.int(5, 9);
    for (let i = 0; i < sl && y < 56; i++) cx[y++] = x;
    const dl = r.int(3, 8);
    if (x < 20) dir = 1; else if (x > 56) dir = -1; else if (r.chance(0.4)) dir = -dir;
    for (let i = 0; i < dl && y < 56; i++) { x = Math.max(13, Math.min(62, x + dir)); cx[y++] = x; }
  }
  const fallX = cx[3];
  for (let yy = 4; yy < 55; yy++) {
    const half = yy >= beach[cx[yy]] - 1 ? 2 : 1;
    for (let dx = -half; dx <= half; dx++) {
      const i = idx(cx[yy] + dx, yy);
      t[i] = G.WATER;
      wk[i] = yy >= beach[cx[yy]] - 4 ? WK.MOUTH : WK.RIVER;
    }
  }
  for (let yy = 0; yy < 4; yy++) for (let dx = -1; dx <= 1; dx++) { wk[idx(cx[yy] + dx, yy)] = WK.RIVER; }

  const nearWater = (px, py, d) => {
    for (let yy = py - d; yy <= py + d; yy++) for (let xx = px - d; xx <= px + d; xx++)
      if (inb(xx, yy) && (t[idx(xx, yy)] === G.WATER || t[idx(xx, yy)] === G.SEA)) return true;
    return false;
  };
  const rectOK = (rx, ry, rw, rh, margin, waterDist) => {
    for (let yy = ry - margin; yy < ry + rh + margin; yy++) for (let xx = rx - margin; xx < rx + rw + margin; xx++) {
      if (!inb(xx, yy)) return false;
      const i = idx(xx, yy);
      if (t[i] !== G.GRASS || res[i]) return false;
    }
    if (waterDist) {
      for (let yy = ry - waterDist; yy < ry + rh + waterDist; yy++) for (let xx = rx - waterDist; xx < rx + rw + waterDist; xx++)
        if (inb(xx, yy) && t[idx(xx, yy)] === G.WATER) return false;
    }
    return true;
  };
  const reserve = (rx, ry, rw, rh, m = 0) => {
    for (let yy = ry - m; yy < ry + rh + m; yy++) for (let xx = rx - m; xx < rx + rw + m; xx++) if (inb(xx, yy)) res[idx(xx, yy)] = 1;
  };

  // ---- 광장(돌바닥 9×7)과 마을회관
  let plaza = null, best = 1e9;
  for (let py = 13; py <= 30; py++) for (let px = 8; px <= W - 17; px++) {
    if (!rectOK(px - 1, py - 6, 11, 14, 0, 2)) continue;
    const d = Math.abs(px + 4.5 - W / 2) + Math.abs(py + 3.5 - 24) * 1.3 + r() * 3;
    if (d < best) { best = d; plaza = { x: px, y: py, w: 9, h: 7 }; }
  }
  if (!plaza) return 'L99';
  for (let yy = plaza.y; yy < plaza.y + plaza.h; yy++) for (let xx = plaza.x; xx < plaza.x + plaza.w; xx++) t[idx(xx, yy)] = G.STONE;
  const buildings = [];
  const addBuilding = (type, bx, by, extra = {}) => {
    const def = BUILDING[type];
    const bd = { id: buildings.length, type, x: bx, y: by, w: def.w, d: def.d, doors: def.door.map((dx) => bx + dx), ...extra };
    buildings.push(bd);
    for (let yy = by; yy < by + def.d; yy++) for (let xx = bx; xx < bx + def.w; xx++) objs[idx(xx, yy)] = { t: 'bld', b: bd.id };
    reserve(bx, by, def.w, def.d, 1);
    reserve(bx - 1, by - 2, def.w + 2, 2);                                  // 건물 뒤(북쪽)는 비워 둔다
    reserve(bd.doors[0] - 1, by + def.d, def.door.length + 2, 3);           // 문 앞
    return bd;
  };
  reserve(plaza.x, plaza.y, plaza.w, plaza.h, 1);
  addBuilding('hall', plaza.x + 1, plaza.y - 4);                           // 광장 북쪽에 붙여서

  // ---- 연못
  let pond = null;
  for (let k = 0; k < 300 && !pond; k++) {
    const px = r.int(9, W - 10), py = r.int(9, 42), rx = r.int(3, 4), ry = r.int(2, 3);
    if (!rectOK(px - rx - 1, py - ry - 1, rx * 2 + 3, ry * 2 + 3, 1, 4)) continue;
    pond = { x: px, y: py, rx, ry };
  }
  if (pond) {
    for (let yy = pond.y - pond.ry; yy <= pond.y + pond.ry; yy++) for (let xx = pond.x - pond.rx; xx <= pond.x + pond.rx; xx++) {
      const e = ((xx - pond.x) / (pond.rx + 0.4)) ** 2 + ((yy - pond.y) / (pond.ry + 0.4)) ** 2;
      if (e <= 1) { t[idx(xx, yy)] = G.WATER; wk[idx(xx, yy)] = WK.POND; }
    }
    reserve(pond.x - pond.rx - 1, pond.y - pond.ry - 1, pond.rx * 2 + 3, pond.ry * 2 + 3);
  }

  // ---- 다리 두 개 (강이 곧게 흐르는 곳)
  const cand = [];
  for (let yy = 9; yy <= 44; yy++) if (cx[yy - 2] === cx[yy] && cx[yy - 1] === cx[yy] && cx[yy + 1] === cx[yy] && cx[yy + 2] === cx[yy] && cx[yy + 3] === cx[yy]) cand.push(yy);
  if (cand.length < 2) return 'L133';
  const bridges = [];
  const pickBridge = (lo, hi) => {
    const c = cand.filter((v) => v >= lo && v <= hi && bridges.every((bb) => Math.abs(bb.y - v) >= 10)
      && !res[idx(cx[v] - 3, v)] && !res[idx(cx[v] + 3, v)] && t[idx(cx[v] - 2, v)] === G.GRASS && t[idx(cx[v] + 2, v)] === G.GRASS);
    if (!c.length) return false;
    const v = r.pick(c);
    bridges.push({ x: cx[v] - 1, y: v, w: 3 });
    return true;
  };
  pickBridge(9, 24) || pickBridge(9, 44);
  pickBridge(28, 44) || pickBridge(9, 44);
  if (bridges.length < 2) return 'L145';
  for (const bb of bridges) {
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < bb.w; dx++) { const i = idx(bb.x + dx, bb.y + dy); t[i] = G.BRIDGE; wk[i] = WK.NONE; }
    reserve(bb.x - 3, bb.y - 1, bb.w + 6, 4);
  }

  // ---- 부두
  let dockX = -1;
  for (let k = 0; k < 100 && dockX < 0; k++) {
    const dx = r.int(8, W - 10);
    if (Math.abs(dx - cx[54]) < 9) continue;
    dockX = dx;
  }
  if (dockX < 0) return 'L158';
  const dock = { x: dockX, y: 55, len: 4 };
  for (let dy = 0; dy < dock.len; dy++) for (let dx = 0; dx < 2; dx++) { const i = idx(dockX + dx, 55 + dy); t[i] = G.DOCK; wk[i] = WK.NONE; }

  // ---- 큰 건물과 집터
  const place = (type, tries, cond) => {
    const def = BUILDING[type];
    for (let k = 0; k < tries; k++) {
      const bx = r.int(5, W - 5 - def.w), by = r.int(7, 45 - def.d);
      if (!rectOK(bx - 2, by - 2, def.w + 4, def.d + 6, 0, 3)) continue;
      if (cond && !cond(bx, by)) continue;
      return addBuilding(type, bx, by);
    }
    return null;
  };
  const pcx = plaza.x + 4.5, pcy = plaza.y + 3.5;
  const far = (bx, by, d) => Math.hypot(bx - pcx, by - pcy) >= d;
  const riverSide = (bx, by) => (bx + 2 < cx[Math.min(54, by + 2)] ? -1 : 1);
  const plazaSide = riverSide(plaza.x, plaza.y);
  const shop = place('shop', 600, (bx, by) => !far(bx, by, 22) && far(bx, by, 9));
  const museum = place('museum', 900, (bx, by) => far(bx, by, 12) && riverSide(bx, by) !== plazaSide) || place('museum', 600, (bx, by) => far(bx, by, 12));
  const home = place('home', 900, (bx, by) => far(bx, by, 10) && !far(bx, by, 26) && by > 12);
  if (!shop || !museum || !home) return 'L180';
  const lots = [];
  for (let n = 0; n < NUM_LOTS; n++) {
    const want = n % 2 === 0 ? -1 : 1;
    const bd = place('house', 500, (bx, by) => riverSide(bx, by) === want && far(bx, by, 8)) || place('house', 500, (bx, by) => far(bx, by, 8));
    if (!bd) return 'L185';
    bd.lot = n;
    lots.push(bd.id);
  }

  // ---- 길: 광장에서 건물 문 앞과 다리까지
  const walk = (i) => WALKABLE.has(t[i]) && !objs[i];
  const pathTo = (sx, sy, gx, gy, wide) => {
    const N = W * H, distA = new Float64Array(N).fill(1e9), prev = new Int32Array(N).fill(-1);
    const open = [[0, idx(sx, sy)]];
    distA[idx(sx, sy)] = 0;
    const goal = idx(gx, gy);
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const [d, c] = open.splice(bi, 1)[0];
      if (c === goal) break;
      if (d > distA[c]) continue;
      const px = c % W, py = (c / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = px + dx, ny = py + dy;
        if (!inb(nx, ny)) continue;
        const ni = idx(nx, ny);
        if (!walk(ni) || t[ni] === G.SAND || t[ni] === G.DOCK) continue;
        let cost = t[ni] === G.PATH || t[ni] === G.STONE || t[ni] === G.BRIDGE ? 0.35 : 1;
        if (t[ni] === G.GRASS && nearWater(nx, ny, 1)) cost += 4;
        cost += r() * 0.2;
        if (d + cost < distA[ni]) { distA[ni] = d + cost; prev[ni] = c; open.push([d + cost, ni]); }
      }
    }
    if (prev[goal] < 0 && goal !== idx(sx, sy)) return false;
    let c = goal;
    while (c >= 0) {
      if (t[c] === G.GRASS) { t[c] = G.PATH; res[c] = 1; }
      if (wide) { const e = c + 1; if (t[e] === G.GRASS && !objs[e] && !nearWater(e % W, (e / W) | 0, 1)) { t[e] = G.PATH; res[e] = 1; } }
      c = prev[c];
    }
    return true;
  };
  const sx = plaza.x + 4, sy = plaza.y + plaza.h;        // 광장 남쪽 가운데 바로 아래
  if (t[idx(sx, sy)] === G.GRASS) t[idx(sx, sy)] = G.PATH;
  const doorFront = (bd) => ({ x: bd.doors[0], y: bd.y + bd.d });
  for (const bb of bridges) {
    const lx = bb.x - 1, rx2 = bb.x + bb.w;
    const nearSide = Math.abs(lx - pcx) < Math.abs(rx2 - pcx) ? lx : rx2;
    if (!pathTo(sx, sy, nearSide, bb.y, true)) return 'L230';
    for (const ex of [lx, rx2]) for (let dy = 0; dy < 2; dy++) { const i = idx(ex, bb.y + dy); if (t[i] === G.GRASS) { t[i] = G.PATH; res[i] = 1; } }
  }
  for (const bd of buildings) {
    if (bd.type === 'hall') continue;
    const f = doorFront(bd);
    if (!pathTo(sx, sy, f.x, f.y, bd.type !== 'house')) return 'L236';
    for (const dxx of bd.doors) { const i = idx(dxx, f.y); if (t[i] === G.GRASS) t[i] = G.PATH; }
  }

  // ---- 시설물
  const fix = (kind, fx, fy, extra = {}) => { objs[idx(fx, fy)] = { t: 'fix', kind, ...extra }; res[idx(fx, fy)] = 1; };
  fix('bigtree', plaza.x + 4, plaza.y + 3);
  fix('platform', plaza.x + 6, plaza.y + 4); fix('part', plaza.x + 7, plaza.y + 4);
  fix('board', plaza.x + 7, plaza.y);
  for (const [lx, ly] of [[plaza.x, plaza.y], [plaza.x + 8, plaza.y + 6], [plaza.x, plaza.y + 6]]) fix('lamp', lx, ly);
  fix('bench', plaza.x + 1, plaza.y + 5); fix('part', plaza.x + 2, plaza.y + 5);
  for (const bb of bridges) {
    for (const ex of [bb.x - 1, bb.x + bb.w]) { const i = idx(ex, bb.y - 1); if (t[i] === G.GRASS && !objs[i]) fix('lamp', ex, bb.y - 1); }
  }
  for (const bd of [shop, museum]) { const fx = bd.x + bd.w, fy = bd.y + bd.d; if (walk(idx(fx, fy)) && t[idx(fx, fy)] !== G.PATH) fix('lamp', fx, fy); }
  { const fx = home.doors[0] + 2, fy = home.y + home.d; if (t[idx(fx, fy)] === G.PATH) t[idx(fx, fy)] = G.GRASS; fix('mailbox', fx, fy); }

  // 해변 양 끝과 숲 가장자리는 바위로 막는다
  for (let yy = 4; yy < 55; yy++) for (const xx of [0, 1, 2, W - 3, W - 2, W - 1]) {
    const i = idx(xx, yy);
    if (t[i] === G.SAND) objs[i] = { t: 'fix', kind: 'boulder', v: 1 + ((xx + yy) % 2) };
  }

  // ---- 닿을 수 있는지 확인
  const spawn = { x: home.doors[0], y: home.y + home.d };
  const blocked = (i) => !WALKABLE.has(t[i]) || (objs[i] && objs[i].t !== 'item');
  const seen = new Uint8Array(W * H);
  const q = [idx(spawn.x, spawn.y)];
  seen[q[0]] = 1;
  while (q.length) {
    const c = q.pop(), px = c % W, py = (c / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = px + dx, ny = py + dy;
      if (!inb(nx, ny)) continue;
      const ni = idx(nx, ny);
      if (seen[ni] || blocked(ni)) continue;
      seen[ni] = 1; q.push(ni);
    }
  }
  let total = 0, reach = 0;
  for (let i = 0; i < W * H; i++) if (!blocked(i)) { total++; if (seen[i]) reach++; }
  if (reach / total < 0.97) return 'L277';
  for (const bd of buildings) { const f = doorFront(bd); if (!seen[idx(f.x, f.y)]) return 'L278'; }
  if (!seen[idx(dock.x, dock.y + 2)]) return 'L279';

  // ---- 나무·돌·꽃·잡초
  const fruit = r.pick(FRUITS);
  const free = (px, py) => inb(px, py) && t[idx(px, py)] === G.GRASS && !objs[idx(px, py)] && !res[idx(px, py)];
  const lonely = (px, py) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const o = inb(px + dx, py + dy) ? objs[idx(px + dx, py + dy)] : null;
      if (o && (o.t === 'tree' || o.t === 'rock')) return false;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const tt = t[idx(px + dx, py + dy)];
      if (tt === G.PATH || tt === G.STONE || tt === G.BRIDGE) return false;
    }
    return true;
  };
  const scatter = (count, make, cond) => {
    let placed = 0;
    for (let k = 0; k < count * 60 && placed < count; k++) {
      const px = r.int(3, W - 4), py = r.int(4, 49);
      if (!free(px, py) || !lonely(px, py) || (cond && !cond(px, py))) continue;
      objs[idx(px, py)] = make(px, py);
      placed++;
    }
  };
  scatter(15, () => ({ t: 'tree', kind: 'fruit', fruit, stage: 3, fruits: 3 }), (px, py) => py > 8);
  scatter(34, () => ({ t: 'tree', kind: 'blossom', stage: 3 }), (px, py) => py > 9);
  scatter(30, () => ({ t: 'tree', kind: 'pine', stage: 3 }), (px, py) => py < 22 || r.chance(0.12));
  scatter(6, () => ({ t: 'rock', v: r.int(1, 2) }), (px, py) => !nearWater(px, py, 1));
  const cols = ['red', 'yellow', 'white'];
  for (const bd of buildings) {
    if (bd.type === 'hall') continue;
    const sp = r.pick(FLOWER_SPECIES);
    let n = r.int(2, 4);
    for (let k = 0; k < 40 && n > 0; k++) {
      const px = r.int(bd.x - 2, bd.x + bd.w + 1), py = r.int(bd.y + bd.d, bd.y + bd.d + 2);
      const i = inb(px, py) ? idx(px, py) : -1;
      if (i < 0 || t[i] !== G.GRASS || objs[i] || bd.doors.includes(px) || bd.doors.includes(px - 1) || bd.doors.includes(px + 1)) continue;
      objs[i] = { t: 'flower', sp, col: r.pick(cols) };
      n--;
    }
  }
  scatter(14, () => ({ t: 'flower', sp: r.pick(FLOWER_SPECIES), col: r.pick(cols) }));
  scatter(12, () => ({ t: 'weed', v: r.int(1, 2) }));

  return { W, H, seed, terrain: t, waterKind: wk, objs, buildings, lots, plaza, pond, bridges, dock, fallX, riverX: cx, beach, fruit, spawn };
}

/** 마을을 만든다. 조건에 맞지 않으면 씨앗을 바꿔 다시 시도한다. */
export function generateVillage(seed) {
  for (let k = 0; k < 400; k++) {
    const v = tryGenerate((seed + k * 7919) >>> 0);
    if (v && typeof v === 'object') { v.tries = k + 1; return v; }
    if (generateVillage.debug) generateVillage.debug[v] = (generateVillage.debug[v] || 0) + 1;
  }
  throw new Error('마을을 만들지 못했습니다');
}
