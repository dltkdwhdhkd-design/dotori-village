// 물고기 그림자와 곤충: 나타나고, 돌아다니고, 놀라 달아나고, 잡힌다
import * as THREE from 'three';
import { make } from '../gfx/models.js';
import { G, burst, WATER_Y } from './game.js';
import { G as T, MAP_W, MAP_H, WK } from '../world/mapgen.js';
import { FISH, BUGS, BUG_BY_ID, ITEMS } from '../data/items.js';
import { inMonths, inHours } from '../core/clock.js';
import { Sound } from '../core/audio.js';
import { UI } from '../ui/ui.js';
import { S } from './state.js';
import { rand, weighted, clamp, TAU } from '../core/util.js';

const LOC = { [WK.RIVER]: 'river', [WK.POND]: 'pond', [WK.SEA]: 'sea', [WK.MOUTH]: 'mouth' };
// 곤충을 화면에 그리는 크기(실제보다 크게, 하지만 징그럽지 않을 만큼만)
const BUG_SCALE = { air: 1.25, shore: 1.3, light: 1.25, glow: 1.3, flower: 1.2, ground: 1.2, path: 1.2, sand: 1.3, tree: 1.4, stump: 1.3, pond: 1.3, rainrock: 1.3, rock: 1.2, shake: 1.3, food: 0.62 };
export const UPSTREAM_Y = 20;  // 강에서 이보다 북쪽(위쪽)은 '상류'
const BUG_MAX = 4;           // 한 번에 주변에 나와 있는 곤충 수의 한도

export class Critters {
  constructor() {
    this.fish = []; this.bugs = []; this.bobber = null;
    this.fishT = 1; this.bugT = 1; this.swarm = null;
    this.root = new THREE.Group(); G.stage.scene.add(this.root);
  }
  clear() { for (const f of this.fish) this.root.remove(f.m); for (const b of this.bugs) this.root.remove(b.m); this.fish = []; this.bugs = []; this.bobber = null; if (this.swarm) { this.root.remove(this.swarm.m); this.swarm = null; } }
  setVisible(v) { this.root.visible = v; }

  // ---------------------------------------------------------------- 물고기
  fishListAt(x, z) {
    const v = G.village, k = v.waterAt(Math.floor(x), Math.floor(z));
    let loc = LOC[k]; if (!loc) return [];
    const d = v.dock, nearPier = loc === 'sea' && Math.abs(x - (d.x + 1)) < 3.5 && z < d.y + d.len + 2.5 && z > d.y + 1.2;
    const now = G.now;
    const up = loc === 'river' && z < UPSTREAM_Y;      // 강의 위쪽은 상류: 상류에만 사는 물고기가 나온다
    return FISH.filter((f) => (f.loc.includes(loc) || (up && f.loc.includes('upstream')) || (nearPier && f.loc.includes('pier'))) && inMonths(f.m, now) && inHours(f.h, now));
  }
  deepWater(x, z) { return G.world.terrain.sample(G.world.terrain.F.water, x, z) > 0.8 && G.village.isWater(Math.floor(x), Math.floor(z)); }
  /** 물고기가 나타날 수 있는 물 칸 목록(한 번만 만든다) */
  waterTiles() {
    if (this._water) return this._water;
    const v = G.village, list = [];
    for (let y = 4; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (v.isWater(x, y) && this.deepWater(x + 0.5, y + 0.5)) list.push([x, y]);
    return (this._water = list);
  }
  spawnFish() {
    const p = G.player;
    const near = this.waterTiles().filter(([x, y]) => { const d = Math.hypot(x + 0.5 - p.x, y + 0.5 - p.z); return d > 3.5 && d < 15; });
    for (let k = 0; k < 12 && near.length; k++) {
      const [tx, ty] = near[Math.floor(rand() * near.length)];
      const x = tx + 0.5 + (rand() - 0.5) * 0.5, z = ty + 0.5 + (rand() - 0.5) * 0.5;
      if (!this.deepWater(x, z)) continue;
      if (this.fish.some((f) => Math.hypot(f.x - x, f.z - z) < 2.5)) continue;
      const list = this.fishListAt(x, z);
      const sp = weighted(list, (f) => f.w * (G.weather === 'rain' ? (f.w <= 3 ? 1.6 : 1) : 1));
      if (!sp) return;
      const m = make('fishshadow_' + sp.sz);
      const g = new THREE.Group(); g.add(m);
      if (sp.fin) { const fin = make('fishfin'); fin.position.y = 0.06; g.add(fin); }
      g.position.set(x, WATER_Y - 0.04, z);
      this.root.add(g);
      this.fish.push({ sp, x, z, dir: rand() * TAU, tdir: rand() * TAU, spd: 0.35 + rand() * 0.35, state: 'swim', t: 0, life: 70 + rand() * 80, m: g, turnT: 2 });
      return;
    }
  }
  removeFish(f) { const i = this.fish.indexOf(f); if (i >= 0) { this.root.remove(f.m); this.fish.splice(i, 1); } if (this.bobber && this.bobber.fish === f) { this.bobber.fish = null; this.bobber.state = 'gone'; } }
  scare(f) { if (f.state === 'flee') return; f.state = 'flee'; f.t = 0; if (this.bobber && this.bobber.fish === f) { this.bobber.fish = null; this.bobber.state = 'gone'; } }

  updateFish(dt) {
    const p = G.player, B = this.bobber;
    this.fishT -= dt;
    if (this.fishT <= 0) { this.fishT = 2.5; if (this.fish.length < 6) this.spawnFish(); }
    for (let i = this.fish.length - 1; i >= 0; i--) {
      const f = this.fish[i];
      f.t += dt; f.life -= dt;
      const dp = Math.hypot(f.x - p.x, f.z - p.z);
      if (f.state === 'flee') {
        f.x += Math.sin(f.dir) * 3.2 * dt; f.z += Math.cos(f.dir) * 3.2 * dt;
        f.m.scale.setScalar(Math.max(0.01, 1 - f.t / 0.9));
        if (f.t > 0.9) { this.removeFish(f); continue; }
      } else if (f.state === 'swim') {
        if (dp > 24 || f.life <= 0) { this.removeFish(f); continue; }
        if (dp < 2.4 && p.speedNow > 4.5) { f.dir = Math.atan2(f.x - p.x, f.z - p.z); this.scare(f); continue; }
        f.turnT -= dt;
        if (f.turnT <= 0) { f.turnT = 2 + rand() * 4; f.tdir = f.dir + (rand() - 0.5) * 2.4; }
        const nx = f.x + Math.sin(f.tdir) * 0.9, nz = f.z + Math.cos(f.tdir) * 0.9;
        if (!this.deepWater(nx, nz)) { f.tdir += 1.4 + rand(); f.turnT = 1; }
        let d = f.tdir - f.dir; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
        f.dir += d * Math.min(1, dt * 2.5);
        const sx = f.x + Math.sin(f.dir) * f.spd * dt, sz = f.z + Math.cos(f.dir) * f.spd * dt;
        if (this.deepWater(sx, sz)) { f.x = sx; f.z = sz; }
        // 찌를 발견
        if (B && B.state === 'idle' && !B.fish) {
          const db = Math.hypot(B.x - f.x, B.z - f.z);
          if (db < 0.55) { f.dir = Math.atan2(f.x - B.x, f.z - B.z); this.scare(f); continue; }
          const ang = Math.atan2(B.x - f.x, B.z - f.z); let da = ang - f.dir; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
          if (db < 3.2 && (Math.abs(da) < 1.2 || db < 1.6)) { f.state = 'approach'; B.fish = f; f.nib = Math.floor(rand() * 4); f.wait = 0.4 + rand() * 0.8; }
        }
      } else if (f.state === 'approach') {
        if (!B) { f.state = 'swim'; continue; }
        const ang = Math.atan2(B.x - f.x, B.z - f.z); let da = ang - f.dir; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
        f.dir += da * Math.min(1, dt * 4);
        const db = Math.hypot(B.x - f.x, B.z - f.z), reach = 0.3 + f.sp.sz * 0.09;
        if (db > reach) { f.x += Math.sin(f.dir) * 0.85 * dt; f.z += Math.cos(f.dir) * 0.85 * dt; }
        else {
          f.wait -= dt; B.dipT = Math.max(0, (B.dipT || 0) - dt);
          if (f.wait <= 0) {
            if (f.nib > 0) { f.nib--; f.wait = 0.55 + rand() * 0.9; B.state = 'nibble'; B.dipT = 0.18; Sound.sfx('nibble'); burst('splash', B.x, WATER_Y + 0.05, B.z, 2); }
            else { f.state = 'bite'; f.t = 0; B.state = 'bite'; Sound.sfx('bite'); burst('splash', B.x, WATER_Y + 0.1, B.z, 9); }
          }
        }
      } else if (f.state === 'bite') {
        const win = f.sp.sz >= 5 ? 0.7 : f.sp.w <= 2 ? 0.75 : 0.95;
        if (f.t > win) { f.dir += Math.PI; this.scare(f); if (B) { B.state = 'gone'; } UI.toast('앗, 놓쳤다…'); Sound.sfx('fail'); continue; }
      }
      f.m.position.set(f.x, WATER_Y - 0.04, f.z);
      f.m.rotation.y = f.dir - Math.PI / 2 + Math.sin(G.time * 5 + i) * 0.12;
    }
  }

  // ---------------------------------------------------------------- 곤충
  bugOK(b) {
    const now = G.now, rain = G.weather === 'rain' || G.weather === 'snow';
    if (!inMonths(b.m, now) || !inHours(b.h, now)) return false;
    if (b.rain === 'no' && rain) return false;
    if (b.rain === 'only' && G.weather !== 'rain') return false;
    return true;
  }
  addBug(sp, x, y, z, extra = {}) {
    const m = make('bug_' + sp.id);
    const scale = BUG_SCALE[sp.where] || 1.3;
    m.scale.setScalar(scale);
    m.position.set(x, y, z);
    this.root.add(m);
    const b = { sp, x, y, z, hx: x, hz: z, baseY: y, m, scale, t: rand() * 9, state: 'idle', dir: rand() * TAU, life: 60 + rand() * 70, ...extra };
    this.bugs.push(b);
    return b;
  }
  /** 나비: 날아다니다가 가까운 꽃에 내려앉아 날개를 접고 잠시 쉬었다가 다시 난다. 앉으러 가거나 앉아 있으면 true */
  flowerVisit(b, dt, dp, fast) {
    const lk = b.sp.look;
    if (lk.f !== 'butterfly' || /^(moth|saturn|hawk|lantern)$/.test(lk.w || '') || b.sp.where !== 'air') return false;
    if (b.perch) {
      b.perch -= dt;
      if (b.perch <= 0 || (dp < 1.6 && fast)) { b.perch = 0; b.target = null; b.landT = 6 + rand() * 8; b.baseY = 0.75; return false; }   // 다 쉬었거나 놀라면 다시 난다
      b.y = b.target.y; return true;
    }
    if (b.target) {
      const dx = b.target.x - b.x, dz = b.target.z - b.z, d = Math.hypot(dx, dz);
      b.dir = Math.atan2(dx, dz);
      if (d < 0.05) { b.x = b.target.x; b.z = b.target.z; b.y = b.target.y; b.perch = 4 + rand() * 6; b.m.rotation.y = rand() * TAU; return true; }
      const st = Math.min(d, dt * 0.8);
      b.x += (dx / d) * st; b.z += (dz / d) * st;
      b.y += (b.target.y + Math.min(0.5, d * 0.4) - b.y) * Math.min(1, dt * 2.5) + Math.sin(b.t * 9) * 0.004;
      b.m.rotation.y = b.dir;
      return true;
    }
    b.landT = (b.landT ?? 3 + rand() * 6) - dt;
    if (b.landT > 0) return false;
    const v = G.village, cx = Math.floor(b.x), cz = Math.floor(b.z), list = [];
    for (let y = cz - 3; y <= cz + 3; y++) for (let x = cx - 3; x <= cx + 3; x++) { const o = v.obj(x, y); if (o && o.t === 'flower') list.push([x, y]); }
    if (!list.length) { b.landT = 5; return false; }
    const [fx, fz] = list[Math.floor(rand() * list.length)];
    b.target = { x: fx + 0.5 + (rand() - 0.5) * 0.12, z: fz + 0.42, y: 0.4 };
    return true;
  }

  removeBug(b) { const i = this.bugs.indexOf(b); if (i >= 0) { this.root.remove(b.m); this.bugs.splice(i, 1); } }

  /** 지금 철·시간·날씨에 나오는 곤충들. 종류가 적은 철에는 곤충도 드물게 나온다. */
  bugPool() { return BUGS.filter((b) => b.w > 0 && this.bugOK(b)); }
  bugCap() { const w = this.bugPool().reduce((s, b) => s + b.w, 0); return w <= 0 ? 0 : Math.min(BUG_MAX, 1 + Math.floor(w / 16)); }
  countOf(sp) { let n = 0; for (const b of this.bugs) if (b.sp === sp && b.state !== 'flee') n++; return n; }

  /** 땅에 놓아둔 과일에 개미가 꼬인다(그 밖에는 개미가 돌아다니지 않는다) */
  spawnAnts() {
    const v = G.village, p = G.player, sp = BUG_BY_ID.gaemi;
    if (!sp || !this.bugOK(sp) || this.countOf(sp) > 0) return;
    for (let k = 0; k < 40; k++) {
      const x = Math.floor(p.x + (rand() - 0.5) * 24), y = Math.floor(p.z + (rand() - 0.6) * 20);
      if (!v.inb(x, y) || Math.hypot(x + 0.5 - p.x, y + 0.5 - p.z) < 4) continue;
      const o = v.obj(x, y);
      if (!o || o.t !== 'item' || !ITEMS[o.id] || ITEMS[o.id].kind !== 'fruit') continue;
      const b = this.addBug(sp, x + 0.5, 0.02, y + 0.5, { crawl: true, tx: x, ty: y, life: 90 + rand() * 60 });
      for (let i = 1; i <= 2; i++) { const f = make('bug_' + sp.id); f.position.set(0.06 * i, 0, 0.3 * i); f.rotation.y = -0.28 * i; b.m.add(f); }   // 줄지어 따라가는 두 마리
      return;
    }
  }

  spawnBug() {
    const v = G.village, p = G.player;
    const list = this.bugPool().filter((b) => this.countOf(b) < (b.where === 'air' && b.w >= 6 ? 2 : 1));
    const sp = weighted(list, (b) => b.w);
    if (!sp) return;
    const pick = (pred) => {
      for (let k = 0; k < 60; k++) {
        const x = Math.floor(p.x + (rand() - 0.5) * 30), y = Math.floor(p.z + (rand() - 0.75) * 26);
        if (!v.inb(x, y) || Math.hypot(x + 0.5 - p.x, y + 0.5 - p.z) < 5) continue;
        if (this.bugs.some((b) => Math.hypot(b.hx - x - 0.5, b.hz - y - 0.5) < 2)) continue;
        if (pred(x, y, v.obj(x, y))) return { x, y };
      }
      return null;
    };
    const w = sp.where;
    let s = null;
    if (w === 'air') { s = pick((x, y, o) => o && o.t === 'flower') || pick((x, y, o) => !o && v.terrainAt(x, y) === T.GRASS); if (s) this.addBug(sp, s.x + 0.5, 0.75, s.y + 0.5, { fly: true }); }
    else if (w === 'shore') { s = pick((x, y, o) => !o && v.walkableTerrain(x, y) && (v.isWater(x + 1, y) || v.isWater(x - 1, y) || v.isWater(x, y + 1) || v.isWater(x, y - 1))); if (s) this.addBug(sp, s.x + 0.5, 0.55, s.y + 0.5, { fly: true }); }
    else if (w === 'path') { s = pick((x, y, o) => !o && v.terrainAt(x, y) === T.PATH); if (s) this.addBug(sp, s.x + 0.5, 0.02, s.y + 0.5, { hop: true }); }
    else if (w === 'sand') { s = pick((x, y, o) => !o && v.terrainAt(x, y) === T.SAND); if (s) this.addBug(sp, s.x + 0.5, 0.02, s.y + 0.5, { hop: true }); }
    else if (w === 'flower') { s = pick((x, y, o) => o && o.t === 'flower'); if (s) this.addBug(sp, s.x + 0.5, 0.42, s.y + 0.42); }
    else if (w === 'tree') { s = pick((x, y, o) => o && o.t === 'tree' && o.stage === 3 && v.walkableTerrain(x, y + 1) && !v.obj(x, y + 1)); if (s) { const b = this.addBug(sp, s.x + 0.5, 0.85, s.y + 0.5 + 0.24, { onTree: true }); b.m.rotation.x = -Math.PI / 2; } }
    else if (w === 'ground') { s = pick((x, y, o) => !o && v.terrainAt(x, y) === T.GRASS); if (s) this.addBug(sp, s.x + 0.5, 0.02, s.y + 0.5, { hop: true }); }
    else if (w === 'pond') { s = pick((x, y) => v.isWater(x, y) && (v.waterAt(x, y) === WK.POND || v.waterAt(x, y) === WK.RIVER) && (v.walkableTerrain(x, y + 1) || v.walkableTerrain(x - 1, y) || v.walkableTerrain(x + 1, y) || v.walkableTerrain(x, y - 1))); if (s) this.addBug(sp, s.x + 0.5, WATER_Y + 0.03, s.y + 0.5, { skate: true }); }
    else if (w === 'stump') { s = pick((x, y, o) => o && o.t === 'stump'); if (s) this.addBug(sp, s.x + 0.5, 0.3, s.y + 0.5); }
    else if (w === 'rainrock') { s = pick((x, y, o) => o && o.t === 'rock'); if (s) this.addBug(sp, s.x + 0.5, 0.5, s.y + 0.5); }
    else if (w === 'light') { s = pick((x, y, o) => o && o.t === 'fix' && o.kind === 'lamp'); if (s) this.addBug(sp, s.x + 0.5, 1.7, s.y + 0.6, { fly: true, orbit: 0.5 }); }
    else if (w === 'glow') { s = pick((x, y, o) => !o && v.terrainAt(x, y) === T.GRASS && (v.isWater(x + 1, y) || v.isWater(x - 1, y) || v.isWater(x, y + 1) || v.isWater(x, y - 1) || v.isWater(x + 2, y) || v.isWater(x - 2, y))); if (s) this.addBug(sp, s.x + 0.5, 0.7, s.y + 0.5, { fly: true, glow: true }); }
  }
  /** 나무를 흔들었을 때 떨어지는 벌레 */
  dropBug(x, z) {
    const list = ['geomi', 'dorongi'].map((id) => BUG_BY_ID[id]).filter((b) => this.bugOK(b));
    if (!list.length) return;
    const sp = list[Math.floor(rand() * list.length)];
    const b = this.addBug(sp, x, 1.2, z, { hang: true }); b.life = 9;
    UI.toast('나무에서 뭔가 내려왔다!');
  }
  rockBug(x, z) { const sp = BUG_BY_ID.gongbeolle; const b = this.addBug(sp, x, 0.02, z, { hop: true }); b.life = 8; b.state = 'run'; b.dir = rand() * TAU; }

  /** 벌 떼: 잠자리채로 잡지 못하면 쏘인다 */
  wasps(x, z) {
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) { const w = make('bug_malbeol'); w.scale.setScalar(1.2); w.userData.ph = i * 1.3; g.add(w); }
    g.position.set(x, 1.6, z); this.root.add(g);
    this.swarm = { m: g, x, z, t: 0 };
    Sound.sfx('buzz'); UI.toast('벌집이다! 잠자리채를 휘둘러!');
    G.player.actor.play('surprise', 0.5); G.player.actor.emote('!', 1);
  }

  /** 잠자리채를 휘두른 자리에 걸린 곤충 */
  netAt(x, z, r) {
    if (this.swarm && Math.hypot(this.swarm.x - x, this.swarm.z - z) < r + 0.5) { this.root.remove(this.swarm.m); this.swarm = null; return { sp: BUG_BY_ID.malbeol }; }
    let best = null, bd = r;
    for (const b of this.bugs) { const d = Math.hypot(b.x - x, b.z - z); if (d < bd && b.y < 1.6) { bd = d; best = b; } }
    if (best) this.removeBug(best);
    return best;
  }

  updateBugs(dt) {
    const p = G.player;
    this.bugT -= dt;
    if (this.bugT <= 0) { this.bugT = 3.5; if (this.bugs.length < this.bugCap()) this.spawnBug(); if (rand() < 0.3) this.spawnAnts(); }
    for (let i = this.bugs.length - 1; i >= 0; i--) {
      const b = this.bugs[i];
      b.t += dt; b.life -= dt;
      const dp = Math.hypot(b.x - p.x, b.z - p.z);
      if (dp > 26 || b.life <= 0 || (b.life < 50 && !this.bugOK(b.sp) && !b.hang)) { if (b.state !== 'flee') { b.state = 'flee'; b.ft = 0; } }
      const fast = p.speedNow > 1.6;
      if (b.state === 'flee') {
        b.ft += dt;
        b.y += dt * 2.2; b.x += Math.sin(b.dir) * dt * 2.5; b.z += Math.cos(b.dir) * dt * 2.5;
        b.m.scale.setScalar(Math.max(0.01, b.scale * (1 - b.ft / 1.1)));
        if (b.ft > 1.1) { this.removeBug(b); continue; }
      } else if (b.fly) {
        const alert = b.glow ? 1.2 : 1.5;
        if (dp < alert && fast) { b.dir = Math.atan2(b.x - p.x, b.z - p.z); b.state = 'flee'; b.ft = 0; Sound.sfx('flutter'); continue; }
        if (b.orbit) { b.x = b.hx + Math.cos(b.t * 2.2) * b.orbit; b.z = b.hz + Math.sin(b.t * 2.6) * b.orbit * 0.7; b.y = b.baseY + Math.sin(b.t * 3.1) * 0.15; }
        else if (this.flowerVisit(b, dt, dp, fast)) { /* 꽃에 앉으러 가거나 앉아 있다 */ }
        else {
          b.dir += (Math.sin(b.t * 0.9 + i) * 1.2) * dt;
          const nx = b.x + Math.sin(b.dir) * dt * 0.9, nz = b.z + Math.cos(b.dir) * dt * 0.9;
          if (Math.hypot(nx - b.hx, nz - b.hz) > 2.6) b.dir = Math.atan2(b.hx - b.x, b.hz - b.z); else { b.x = nx; b.z = nz; }
          b.y = b.baseY + Math.sin(b.t * 2.4) * 0.16;
        }
        b.m.rotation.y = b.dir;
      } else if (b.hop) {
        if (b.state === 'run' || (dp < 1.4 && fast)) {
          if (b.state !== 'run') { b.state = 'run'; b.dir = Math.atan2(b.x - p.x, b.z - p.z) + (rand() - 0.5); b.runT = 0; }
          b.runT = (b.runT || 0) + dt;
          const nx = b.x + Math.sin(b.dir) * dt * 3, nz = b.z + Math.cos(b.dir) * dt * 3;
          if (G.village.walkableTerrain(Math.floor(nx), Math.floor(nz))) { b.x = nx; b.z = nz; }
          b.y = Math.abs(Math.sin(b.t * 12)) * 0.35;
          if (b.runT > 1.3) { b.state = 'idle'; b.runT = 0; b.y = 0.02; if (rand() < 0.4) { b.state = 'flee'; b.ft = 0; } }
          b.m.rotation.y = b.dir;
        } else if (b.m.userData.parts && b.m.userData.parts.ball) {      // 쇠똥구리: 경단을 뒷다리로 받치고 뒷걸음질로 굴려 간다(굴리다 쉬다를 되풀이)
          b.y = 0.02;
          if (Math.sin(b.t * 0.45 + i) > -0.25) {
            b.dir += Math.sin(b.t * 0.6 + i * 2) * 0.5 * dt;
            if (Math.hypot(b.x - b.hx, b.z - b.hz) > 1.6) b.dir = Math.atan2(b.x - b.hx, b.z - b.hz);      // 너무 멀리 가면 머리를 바깥으로 돌려(= 경단 쪽이 집 방향) 되돌아온다
            const v = 0.11, nx = b.x - Math.sin(b.dir) * v * dt, nz = b.z - Math.cos(b.dir) * v * dt;
            if (G.village.walkableTerrain(Math.floor(nx), Math.floor(nz)) && !G.village.obj(Math.floor(nx), Math.floor(nz))) { b.x = nx; b.z = nz; b.m.userData.parts.ball.rotation.x -= (v * dt) / (0.078 * b.scale); }
            else b.dir += Math.PI * 0.6;
          }
          b.m.rotation.y = b.dir;
        } else if (Math.sin(b.t * 0.7 + i) > 0.96) { b.y = 0.02 + Math.abs(Math.sin(b.t * 9)) * 0.12; } else b.y = 0.02;
      } else if (b.crawl) {
        const o = G.village.obj(b.tx, b.ty);
        if (!o || o.t !== 'item') { b.state = 'flee'; b.ft = 0; continue; }
        const ang = b.t * 0.9;
        b.x = b.hx + Math.cos(ang) * 0.34; b.z = b.hz + Math.sin(ang) * 0.3;
        b.m.rotation.y = -ang + Math.PI;
      } else if (b.skate) {
        if (dp < 1.2 && fast) { b.state = 'flee'; b.ft = 0; b.dir = Math.atan2(b.x - p.x, b.z - p.z); continue; }
        b.x = b.hx + Math.sin(b.t * 0.8 + i) * 0.25; b.z = b.hz + Math.cos(b.t * 1.1 + i) * 0.2;
      } else if (b.hang) {
        b.y = Math.max(0.75, 1.2 - b.t * 0.6) + Math.sin(b.t * 3) * 0.04;
      } else {
        const alert = b.onTree ? (b.sp.price >= 1000 ? 2.3 : 1.7) : 1.3;
        if (dp < alert && fast) { b.dir = Math.atan2(b.x - p.x, b.z - p.z); b.state = 'flee'; b.ft = 0; Sound.sfx('flutter'); continue; }
      }
      b.m.position.set(b.x, b.y, b.z);
      const P = b.m.userData.parts;
      if (P && P.wing_L) {
        const lk = b.sp.look, bf = lk.f === 'butterfly';
        const moth = bf && /^(moth|saturn|hawk|lantern)$/.test(lk.w || '');           // 나방은 날개를 펴거나 지붕처럼 덮고 앉는다
        let fl;
        if ((b.fly && !b.perch) || b.state === 'flee') fl = bf && !moth ? 0.5 + Math.sin(b.t * 14) * 0.9 : Math.sin(b.t * (bf ? 16 : 60)) * 0.8;   // 나비는 날개를 거의 맞닿을 만큼 위로 쳐올린다(아랫면이 보인다)
        else fl = bf && !moth ? (lk.w === 'skipper' ? 0.7 : 1.42 - Math.max(0, Math.sin(b.t * 0.9 + i)) * 0.5) : 0.1;              // 앉은 나비는 날개를 접고 가끔 살짝 편다
        P.wing_L.rotation.z = fl; P.wing_R.rotation.z = -fl;
      }
    }
    // 벌 떼
    const sw = this.swarm;
    if (sw) {
      sw.t += dt;
      const dx = p.x - sw.x, dz = p.z - sw.z, d = Math.hypot(dx, dz) || 1;
      const sp = sw.t < 0.9 ? 0 : 6.2;
      sw.x += (dx / d) * sp * dt; sw.z += (dz / d) * sp * dt;
      sw.m.position.set(sw.x, sw.t < 0.9 ? 1.6 - sw.t * 0.5 : 1.0, sw.z);
      sw.m.children.forEach((w, k) => w.position.set(Math.cos(sw.t * 9 + w.userData.ph) * 0.3, Math.sin(sw.t * 7 + k) * 0.2, Math.sin(sw.t * 8 + w.userData.ph) * 0.3));
      if (sw.t > 0.9 && d < 0.5) { this.root.remove(sw.m); this.swarm = null; G.hooks.stung(); }
      else if (sw.t > 9) { this.root.remove(sw.m); this.swarm = null; }
    }
  }

  update(dt) { this.updateFish(dt); this.updateBugs(dt); }
}
