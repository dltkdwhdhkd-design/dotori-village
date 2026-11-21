// 마을의 상태: 지형, 칸마다 놓인 것, 묻힌 것. 저장/불러오기도 여기서.
import { generateVillage, MAP_W, MAP_H, G, WK, WALKABLE } from './mapgen.js';

const SOLID = new Set(['tree', 'stump', 'rock', 'fix', 'bld', 'hole','decor','decorPart']);

export class Village {
  constructor(d) {
    Object.assign(this, d);
    this.W = MAP_W; this.H = MAP_H;
    this.buried = d.buried || {};            // 칸 번호 -> 아이템 id
    this.listeners = [];
  }
  static create(seed) { return new Village(generateVillage(seed)); }

  idx(x, y) { return y * MAP_W + x; }
  inb(x, y) { return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H; }
  terrainAt(x, y) { return this.inb(x, y) ? this.terrain[y * MAP_W + x] : G.CLIFF; }
  waterAt(x, y) { return this.inb(x, y) ? this.waterKind[y * MAP_W + x] : WK.NONE; }
  obj(x, y) { return this.inb(x, y) ? this.objs[y * MAP_W + x] : null; }
  isWater(x, y) { const t = this.terrainAt(x, y); return t === G.WATER || t === G.SEA; }
  walkableTerrain(x, y) { return this.inb(x, y) && WALKABLE.has(this.terrain[y * MAP_W + x]); }
  solid(x, y) {
    if (!this.walkableTerrain(x, y)) return true;
    const o = this.objs[y * MAP_W + x];
    return !!o && SOLID.has(o.t);
  }
  /** 아무것도 없고 걸을 수 있는 칸인가 */
  empty(x, y) { return this.walkableTerrain(x, y) && !this.objs[y * MAP_W + x]; }

  set(x, y, o) {
    const i = y * MAP_W + x;
    this.objs[i] = o;
    for (const f of this.listeners) f(i, x, y);
  }
  touch(x, y) { const i = y * MAP_W + x; for (const f of this.listeners) f(i, x, y); }
  onChange(f) { this.listeners.push(f); }

  building(id) { return this.buildings[id]; }
  /** 문 앞(남쪽 한 칸)에 서 있으면 그 건물을 돌려준다 */
  doorAt(x, y) {
    for (const b of this.buildings) if (y === b.y + b.d - 1 && b.doors.includes(x)) return b;
    return null;
  }
  each(fn) { for (let i = 0; i < this.objs.length; i++) if (this.objs[i]) fn(this.objs[i], i % MAP_W, (i / MAP_W) | 0, i); }
  count(pred) { let n = 0; for (const o of this.objs) if (o && pred(o)) n++; return n; }

  /** 조건에 맞는 빈 칸을 무작위로 찾는다 */
  randomTile(r, pred, tries = 300) {
    for (let k = 0; k < tries; k++) {
      const x = r.int(3, MAP_W - 4), y = r.int(4, MAP_H - 6);
      if (pred(x, y)) return { x, y };
    }
    return null;
  }

  serialize() {
    const objs = [];
    this.each((o, x, y, i) => { if (o.t !== 'bld') objs.push([i, o]); });
    return {
      seed: this.seed, fruit: this.fruit, spawn: this.spawn, plaza: this.plaza, pond: this.pond, bridges: this.bridges, dock: this.dock,
      buildings: this.buildings, lots: this.lots, riverX: this.riverX, beach: this.beach, fallX: this.fallX,
      terrain: Array.from(this.terrain).join(''), waterKind: Array.from(this.waterKind).join(''), objs, buried: this.buried,
    };
  }
  static deserialize(s) {
    const terrain = Uint8Array.from(s.terrain, (c) => +c), waterKind = Uint8Array.from(s.waterKind, (c) => +c);
    const objs = new Array(MAP_W * MAP_H).fill(null);
    for (const [i, o] of s.objs) objs[i] = o;
    for (const b of s.buildings) for (let y = b.y; y < b.y + b.d; y++) for (let x = b.x; x < b.x + b.w; x++) objs[y * MAP_W + x] = { t: 'bld', b: b.id };
    return new Village({ ...s, terrain, waterKind, objs });
  }
}
