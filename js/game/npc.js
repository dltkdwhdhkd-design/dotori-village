// 마을을 돌아다니는 주민들
import { Actor } from '../gfx/actor.js';
import { G, groundY } from './game.js';
import { G as T, MAP_W, MAP_H } from '../world/mapgen.js';
import { VILLAGERS, PERSONALITY } from '../data/villagers.js';
import { S } from './state.js';
import { dayKey, hourF } from '../core/clock.js';
import { rand, hash01 } from '../core/util.js';

/** 칸 단위 길 찾기(4방향). 못 찾으면 null */
export function findPath(sx, sy, gx, gy, limit = 900) {
  const v = G.village;
  if (v.solid(gx, gy)) return null;
  const key = (x, y) => y * MAP_W + x;
  const open = [[Math.abs(gx - sx) + Math.abs(gy - sy), 0, sx, sy]], came = new Map(), cost = new Map([[key(sx, sy), 0]]);
  let n = 0;
  while (open.length && n++ < limit) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
    const [, g, x, y] = open.splice(bi, 1)[0];
    if (x === gx && y === gy) {
      const path = []; let k = key(x, y);
      while (k !== key(sx, sy)) { path.push([k % MAP_W, (k / MAP_W) | 0]); k = came.get(k); }
      return path.reverse();
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (v.solid(nx, ny) || v.terrainAt(nx, ny) === T.DOCK) continue;
      const ng = g + 1, k = key(nx, ny);
      if (cost.has(k) && cost.get(k) <= ng) continue;
      cost.set(k, ng); came.set(k, key(x, y));
      open.push([ng + Math.abs(gx - nx) + Math.abs(gy - ny), ng, nx, ny]);
    }
  }
  return null;
}

export function villagerAwake(id, now = G.now) {
  const p = PERSONALITY[VILLAGERS[id].p];
  let h = hourF(now); if (h < 5) h += 24;
  return h >= p.wake && h < p.sleep;
}
/** 지금 밖에 나와 있을 차례인가 (20분 단위로 정해진다) */
export function villagerOut(id, now = G.now) {
  if (!villagerAwake(id, now)) return false;
  const block = Math.floor((now.getHours() * 60 + now.getMinutes()) / 20);
  const wet = G.weather === 'rain' || G.weather === 'snow';
  return hash01(dayKey(now), block, id) < (wet ? 0.3 : 0.72);
}

export class Villager {
  constructor(id) {
    this.id = id; this.def = VILLAGERS[id]; this.pers = PERSONALITY[this.def.p];
    this.name = this.def.name; this.pitch = this.pers.pitch;
    this.actor = new Actor('villager_' + id);
    this.actor.root.visible = false;
    G.stage.scene.add(this.actor.root);
    this.visible = false; this.x = 0; this.z = 0;
    this.state = 'idle'; this.wait = 1 + rand() * 3; this.path = null; this.talking = false;
  }
  building() { return G.village.buildings.find((b) => b.lot === S.villagers[this.id].lot); }
  doorFront() { const b = this.building(); return { x: b.doors[0], y: b.y + b.d }; }
  show(atDoor = true) {
    if (this.visible) return;
    const d = this.doorFront();
    if (atDoor || !this.x) { this.x = d.x + 0.5; this.z = d.y + 0.5; }
    this.visible = true; this.actor.root.visible = true; this.state = 'idle'; this.wait = 0.5 + rand() * 2; this.path = null;
    this.actor.face(0, true); this.place();
  }
  /** 마을 어딘가(집 근처)에 이미 나와 있는 상태로 둔다 */
  scatter() {
    const d = this.doorFront(), v = G.village;
    for (let k = 0; k < 40; k++) {
      const x = d.x + Math.floor((rand() - 0.5) * 16), y = d.y + Math.floor(rand() * 9);
      if (!v.solid(x, y) && !v.obj(x, y) && findPath(d.x, d.y, x, y, 400)) { this.x = x + 0.5; this.z = y + 0.5; break; }
    }
    this.show(false);
  }
  hide() { this.visible = false; this.actor.root.visible = false; this.path = null; this.goingHome = false; }
  place() { this.actor.setPos(this.x, groundY(this.x, this.z), this.z); }
  goHome() { const d = this.doorFront(); const p = findPath(Math.floor(this.x), Math.floor(this.z), d.x, d.y, 2500); if (p) { this.path = p; this.state = 'walk'; this.goingHome = true; } else this.hide(); }

  update(dt) {
    if (!this.visible) return;
    const a = this.actor, p = G.player;
    const dp = Math.hypot(p.x - this.x, p.z - this.z);
    if (this.staged) { a.speed = 0; a.update(dt); return; }                 // 잔치 같은 연출: 세워 둔 자리에서 그대로
    if (this.talking) { a.speed = 0; a.faceTo(p.x, p.z); a.update(dt); return; }
    if (this.state === 'idle') {
      a.speed = 0;
      if (dp < 1.6) a.faceTo(p.x, p.z);
      this.wait -= dt;
      if (this.wait <= 0) {
        const v = G.village, d = this.doorFront();
        let found = false;
        for (let k = 0; k < 12 && !found; k++) {
          const tx = Math.floor(this.x) + Math.floor((rand() - 0.5) * 12), ty = Math.floor(this.z) + Math.floor((rand() - 0.5) * 10);
          if (Math.hypot(tx - d.x, ty - d.y) > 18 || v.solid(tx, ty) || v.obj(tx, ty)) continue;
          const path = findPath(Math.floor(this.x), Math.floor(this.z), tx, ty, 500);
          if (path && path.length) { this.path = path; this.state = 'walk'; found = true; }
        }
        if (!found) this.wait = 2;
        else if (rand() < 0.15) a.emote('note', 1.4);
      }
    } else if (this.state === 'walk') {
      if (!this.path || !this.path.length) { if (this.goingHome) { this.hide(); return; } this.state = 'idle'; this.wait = 2 + rand() * 5; a.speed = 0; }
      else {
        const [tx, ty] = this.path[0];
        if (G.village.solid(tx, ty)) { this.path = null; a.update(dt); return; }
        const gx = tx + 0.5, gz = ty + 0.5, dx = gx - this.x, dz = gz - this.z, d = Math.hypot(dx, dz);
        const toward = dp < 0.85 && (dx * (p.x - this.x) + dz * (p.z - this.z)) > 0;
        if (toward) { a.speed = 0; a.faceTo(p.x, p.z); this.blockT = (this.blockT || 0) + dt; if (this.blockT > 2.5) { this.path = null; this.blockT = 0; } }
        else {
          this.blockT = 0;
          const sp = 1.7 * dt;
          if (d <= sp) { this.x = gx; this.z = gz; this.path.shift(); }
          else { this.x += (dx / d) * sp; this.z += (dz / d) * sp; a.face(Math.atan2(dx, dz)); }
          a.speed = 1;
        }
      }
    }
    this.place();
    a.update(dt);
  }
}

/** 지금 사는 주민에 맞춰 목록을 만들고, 나와 있을 주민만 보이게 한다 */
export function syncVillagers(initial = false) {
  for (const id of S.residents) if (!G.npcs.find((n) => n.id === id)) G.npcs.push(new Villager(id));
  for (const n of G.npcs) {
    const out = villagerOut(n.id);
    if (out && !n.visible) { if (initial) n.scatter(); else n.show(true); }
    else if (!out && n.visible && !n.goingHome && !n.talking) n.goHome();
  }
}
export function setVillagersVisible(v) { for (const n of G.npcs) n.actor.root.visible = v && n.visible; }
