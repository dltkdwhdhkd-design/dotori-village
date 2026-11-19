// 주인공: 이동, 충돌, 도구 쓰기(낚시·채집·삽질 등)
import * as THREE from 'three';
import { Actor } from '../gfx/actor.js';
import { make, patchMaterial } from '../gfx/models.js';
import { G, groundY, burst, runScript, WATER_Y, save } from './game.js';
import { G as T, MAP_W, MAP_H, WK } from '../world/mapgen.js';
import { Input } from '../core/input.js';
import { Sound } from '../core/audio.js';
import { UI } from '../ui/ui.js';
import { S, addItem, canAdd, ownedTools, addMoney, hasItem } from './state.js';
import { ITEMS, FISH_BY_ID, BUG_BY_ID, FURNITURE, itemName } from '../data/items.js';
import { clamp, rand, josa, hash01 } from '../core/util.js';
import { dayKey } from '../core/clock.js';
import { track } from './quests.js';
import { MODEL as LOOK_MODEL, dress, cleanLook } from './look.js';

const WALK = 3.3, RUN = 5.4, SNEAK = 1.25, R = 0.27;
const K = (k, t) => `<b>${k}</b>${t}`;

/** 칸에 놓인 것의 충돌 모양: 숫자면 원의 반지름, true면 칸 전체 */
export function colliderOf(o) {
  if (!o) return 0;
  if (o.t === 'tree') return o.stage > 0 ? 0.34 : 0.2;
  if (o.t === 'rock') return 0.42;
  if (o.t === 'stump') return 0.3;
  if (o.t === 'hole') return 0.36;
  if (o.t === 'bld') return true;
  if (o.t === 'fix') return { lamp: 0.2, mailbox: 0.24, bigtree: 0.78 }[o.kind] || true;
  return 0;
}

/** 마을에서 원(반지름 r)을 (x,z)에 놓았을 때 겹치지 않게 밀어낸 위치 */
export function resolveVillage(x, z, r) {
  const v = G.village;
  for (let pass = 0; pass < 2; pass++) {
    const tx0 = Math.floor(x), ty0 = Math.floor(z);
    for (let ty = ty0 - 1; ty <= ty0 + 1; ty++) for (let tx = tx0 - 1; tx <= tx0 + 1; tx++) {
      let shape = 0;
      if (!v.walkableTerrain(tx, ty)) shape = true; else shape = colliderOf(v.objs[ty * MAP_W + tx]);
      if (!shape) continue;
      if (shape === true) {
        const cx = clamp(x, tx, tx + 1), cz = clamp(z, ty, ty + 1);
        let dx = x - cx, dz = z - cz; const d = Math.hypot(dx, dz);
        if (d < r) {
          if (d < 1e-5) { // 칸 안에 들어가 있으면 가까운 변으로
            const l = x - tx, rr = tx + 1 - x, u = z - ty, dn = ty + 1 - z, m = Math.min(l, rr, u, dn);
            if (m === l) x = tx - r; else if (m === rr) x = tx + 1 + r; else if (m === u) z = ty - r; else z = ty + 1 + r;
          } else { x = cx + (dx / d) * r; z = cz + (dz / d) * r; }
        }
      } else {
        const cx = tx + 0.5, cz = ty + 0.5; const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz), need = r + shape;
        if (d < need) { if (d < 1e-5) { z += need; } else { x = cx + (dx / d) * need; z = cz + (dz / d) * need; } }
      }
    }
  }
  return { x: clamp(x, 3.3, MAP_W - 3.3), z: clamp(z, 4.3, MAP_H - 0.6) };
}

const _tip = new THREE.Vector3();

export class Player {
  constructor() {
    this.actor = new Actor(S.player.model);
    if (S.player.look) dress(this.actor, S.player.look);
    G.stage.scene.add(this.actor.root);
    this.x = S.player.x; this.z = S.player.z; this.yaw = 0;
    this.lock = 0; this.after = null; this.fishing = null; this.netHold = false; this.stepT = 0;
    this.line = null; this.bobber = null;
    this.equip(S.player.tool && hasItem(S.player.tool) ? S.player.tool : null, true);
    this.actor.face(0, true);
    this.place();
  }
  place() { this.actor.setPos(this.x, groundY(this.x, this.z), this.z); }
  setPos(x, z) { this.x = x; this.z = z; this.place(); }
  front(d = 0.8) { const x = this.x + Math.sin(this.yaw) * d, z = this.z + Math.cos(this.yaw) * d; return { x, z, tx: Math.floor(x), ty: Math.floor(z) }; }
  busy() { return this.lock > 0 || !!this.fishing; }
  /** 동작을 하고 그동안 움직이지 못하게 한다. after는 동작의 at(0~1) 지점에서 실행한다(휘두르기는 내려친 순간). */
  do(anim, dur, after, at) {
    if (anim === 'swing' || anim === 'dig') dur = Math.max(dur, 0.5);
    if (at == null) at = anim === 'swing' || anim === 'dig' ? 0.48 : anim === 'pour' ? 0.45 : 1;
    this.actor.play(anim, dur); this.lock = dur; this.after = after || null; this.afterT = dur * (1 - at);
    if (G.net && G.net.role) G.net.anim(anim, dur);
  }

  /** 거울에서 고른 모습으로 바꾼다 */
  setLook(look) {
    S.player.look = cleanLook(look);
    if (S.player.model !== LOOK_MODEL) {           // 예전의 정해진 모습에서 꾸미는 모습으로
      S.player.model = LOOK_MODEL;
      this.actor.id = LOOK_MODEL; this.actor.setModel(LOOK_MODEL);
      this.actor.hold(S.player.tool ? ITEMS[S.player.tool].model : null);
    }
    dress(this.actor, S.player.look);
    if (G.net && G.net.role) G.net.refresh();
  }

  equip(id, silent = false) {
    if (this.fishing) this.endFishing();
    S.player.tool = id;
    this.actor.hold(id ? ITEMS[id].model : null);
    this.netHold = false; this.actor.sneak = false;
    if (!silent) Sound.sfx(id ? 'pick' : 'drop');
    if (G.net && G.net.role) G.net.refresh();
  }
  cycleTool() {
    const list = ownedTools(); if (!list.length) return;
    const i = list.indexOf(S.player.tool);
    this.equip(i + 1 >= list.length ? null : list[i + 1]);
  }

  // ---------------------------------------------------------------- 매 프레임
  /** sec초 뒤에 fn을 실행한다(동작 도중의 효과용) */
  later(sec, fn) { (this.queue || (this.queue = [])).push({ t: sec, fn }); }

  update(dt, free) {
    const a = this.actor;
    if (this.queue && this.queue.length) { for (const q of this.queue) q.t -= dt; const due = this.queue.filter((q) => q.t <= 0); this.queue = this.queue.filter((q) => q.t > 0); for (const q of due) q.fn(); }
    if (this.lock > 0) {
      this.lock -= dt; a.speed = 0;
      if (this.after && this.lock <= (this.afterT || 0)) { const f = this.after; this.after = null; f(); }
      a.update(dt); return;
    }
    if (this.fishing) { this.updateFishing(dt, free); a.update(dt); return; }
    if (!free) { a.speed = 0; if (this.netHold) { this.netHold = false; a.sneak = false; a.anim = null; } a.update(dt); return; }

    // 도구 바꾸기
    const all = ['tool_net', 'tool_rod', 'tool_shovel', 'tool_axe', 'tool_can'];
    for (let i = 0; i < 5; i++) if (Input.take('t' + (i + 1)) && hasItem(all[i])) this.equip(S.player.tool === all[i] ? null : all[i]);
    if (Input.take('cycle')) this.cycleTool();
    if (Input.take('put')) this.equip(null);

    // 이동
    const ax = Input.axis();
    const sneaking = this.netHold;
    const sp = sneaking ? SNEAK : Input.held('run') ? RUN : WALK;
    if (ax.on) {
      this.yaw = Math.atan2(ax.x, ax.y);
      a.face(this.yaw);
      let nx = this.x + ax.x * sp * dt, nz = this.z + ax.y * sp * dt;
      if (G.room) { const p = G.room.resolve(nx, nz, R); nx = p.x; nz = p.z; }
      else {
        let p = resolveVillage(nx, nz, R);
        for (const n of G.npcs) { if (!n.visible) continue; const dx = p.x - n.x, dz = p.z - n.z, d = Math.hypot(dx, dz); if (d < 0.6 && d > 1e-4) { p.x = n.x + (dx / d) * 0.6; p.z = n.z + (dz / d) * 0.6; } }
        p = resolveVillage(p.x, p.z, R);
        nx = p.x; nz = p.z;
      }
      const moved = Math.hypot(nx - this.x, nz - this.z);
      this.x = nx; this.z = nz;
      a.speed = moved > 0.001 ? (sneaking ? 0.5 : sp === RUN ? 1.6 : 1) : 0;
      this.stepT -= dt * (sp === RUN ? 1.5 : 1);
      if (this.stepT <= 0 && moved > 0.001 && !sneaking) {
        this.stepT = 0.3;
        const t = G.room ? -1 : G.village.terrainAt(Math.floor(this.x), Math.floor(this.z));
        Sound.sfx('step', { sand: t === T.SAND, wood: t === T.BRIDGE || t === T.DOCK || !!G.room });
      }
    } else a.speed = 0;
    this.speedNow = ax.on ? sp : 0;
    this.place();

    if (G.room) { if (G.room.checkExit(this)) return; }

    // 행동
    if (S.player.tool === 'tool_net' && !G.room) {
      if (!this.netHold && Input.hit('act') && !this.wouldTalk()) { Input.take('act'); this.netHold = true; a.sneak = true; a.play('raise', 99); }
      else if (this.netHold && !Input.held('act')) { this.netHold = false; a.sneak = false; this.swingNet(); }
    }
    if (Input.take('act')) this.act();
    else if (Input.take('pick')) this.pickup();
    a.update(dt);
  }

  npcInFront() {
    let best = null, bd = 1.35;
    const list = G.room ? G.room.npcs : G.npcs;
    for (const n of list) {
      if (!n.visible) continue;
      const dx = n.x - this.x, dz = n.z - this.z, d = Math.hypot(dx, dz);
      if (d > (n.fixed ? Math.max(bd, 2.3) : bd)) continue;      // 계산대 너머의 상대와도 말할 수 있게
      const dot = (dx * Math.sin(this.yaw) + dz * Math.cos(this.yaw)) / (d || 1);
      if (dot > (n.fixed ? 0.6 : 0.25) || d < 0.7) { best = n; bd = Math.min(bd, d); }
    }
    return best;
  }
  wouldTalk() { return !!this.npcInFront() || !!this.doorInFront(); }
  doorInFront() {
    if (G.room || Math.cos(this.yaw) > -0.5) return null;
    const v = G.village, px = Math.floor(this.x), py = Math.floor(this.z);
    const o = v.obj(px, py - 1);
    if (o && o.t === 'bld') { const b = v.building(o.b); if (b.doors.includes(px) && py - 1 === b.y + b.d - 1) return b; }
    return null;
  }

  /** 화면 아래에 띄울 안내 */
  hint() {
    if (this.fishing) return this.fishing.state === 'bite' ? K('Space', '지금 당기기!') : K('Space', '거두기');
    if (this.lock > 0) return '';
    if (G.room) return G.room.hint(this);
    if (this.npcInFront()) return K('Space', '말 걸기');
    if (this.doorInFront()) return K('Space', '들어가기');
    const v = G.village, f = this.front(), o = v.obj(f.tx, f.ty), tool = S.player.tool;
    if (o && o.t === 'fix') { if (o.kind === 'mailbox') return K('Space', '우체통 열기'); if (o.kind === 'board') return K('Space', '게시판 보기'); if (o.kind === 'bigtree') return K('Space', '올려다보기'); }
    const under = v.obj(Math.floor(this.x), Math.floor(this.z));
    const pk = (o && ['item', 'flower', 'weed'].includes(o.t)) || (under && ['item', 'weed'].includes(under.t));
    let h = '';
    if (tool === 'tool_rod') { if (this.castSpot()) h = K('Space', '찌 던지기'); }
    else if (tool === 'tool_net') h = K('Space', '누르고 있으면 살금살금, 떼면 휘두르기');
    else if (tool === 'tool_shovel') {
      if (o && o.t === 'hole') h = K('Space', '구멍 메우기'); else if (o && o.t === 'rock') h = K('Space', '돌 두드리기'); else if (o && o.t === 'stump') h = K('Space', '그루터기 캐기');
      else if (o && (o.t === 'flower' || (o.t === 'tree' && o.stage === 0))) h = K('Space', '캐내기'); else if (!o && v.buried[f.ty * MAP_W + f.tx] != null) h = K('Space', '파내기');
      else if (!o && this.canDig(f.tx, f.ty)) h = K('Space', '땅 파기');
    } else if (tool === 'tool_axe') { if (o && o.t === 'tree' && o.stage > 0) h = K('Space', '나무 베기'); }
    else if (tool === 'tool_can') { if (o && o.t === 'flower') h = K('Space', '물 주기'); }
    if (!h && o && o.t === 'tree' && o.stage > 0 && tool !== 'tool_axe' && tool !== 'tool_shovel') h = K('Space', '나무 흔들기');
    if (pk) h += (h ? '　' : '') + K('F', o && o.t === 'flower' ? '꽃 꺾기' : o && o.t === 'weed' ? '잡초 뽑기' : '줍기');
    return h;
  }

  // ---------------------------------------------------------------- 행동
  act() {
    if (G.room) return G.room.act(this);
    const npc = this.npcInFront();
    if (npc) return G.hooks.talk(npc);
    const door = this.doorInFront();
    if (door) return G.hooks.enter(door);
    const v = G.village, f = this.front(), o = v.obj(f.tx, f.ty), tool = S.player.tool;
    if (G.visit) {                                // 놀러 온 마을: 그 마을 것은 건드리지 않는다
      if (o && o.t === 'fix' && ['mailbox', 'board', 'bigtree'].includes(o.kind)) { UI.toast(o.kind === 'mailbox' ? '남의 우체통이다.' : '이 마을 사람들이 쓰는 것이다.'); return; }
      if (tool === 'tool_shovel' || tool === 'tool_axe') { UI.toast('놀러 온 마을에서는 삽과 도끼를 쓰지 않는다.'); Sound.sfx('fail'); return; }
    }
    if (o && o.t === 'fix') {
      if (o.kind === 'mailbox') return G.hooks.openMail();
      if (o.kind === 'board') return G.hooks.board();
      if (o.kind === 'bigtree') return G.hooks.bigTree();
    }
    if (tool === 'tool_rod') return this.cast();
    if (tool === 'tool_net') return;
    if (tool === 'tool_shovel') return this.shovel(f, o);
    if (tool === 'tool_axe' && o && o.t === 'tree' && o.stage > 0) return this.chop(f, o);
    if (tool === 'tool_can') return this.water(f, o);
    if (o && o.t === 'tree' && o.stage > 0) return this.shake(f, o);
    if (o && ['item', 'flower', 'weed'].includes(o.t)) return this.pickup();
  }

  pickup() {
    if (G.room) return G.room.pickup(this);
    const v = G.village, f = this.front();
    let tx = f.tx, ty = f.ty, o = v.obj(tx, ty);
    if (!o || !['item', 'flower', 'weed'].includes(o.t)) { tx = Math.floor(this.x); ty = Math.floor(this.z); o = v.obj(tx, ty); if (!o || !['item', 'weed'].includes(o.t)) return; }
    if (G.visit && o.t === 'flower') { UI.toast('남의 마을 꽃은 꺾지 않는다.'); return; }
    let id = o.t === 'item' ? o.id : o.t === 'flower' ? `flower_${o.sp}_${o.col}` : 'weed';
    const it = ITEMS[id];
    if (it && it.kind === 'coin') {
      v.set(tx, ty, null); addMoney(it.value); Sound.sfx('coin'); this.do('pick', 0.3);
      UI.toast(`도토리 ${it.value}개를 주웠다!`); return;
    }
    if (!canAdd(id)) { UI.toast('가방이 가득 찼다.'); Sound.sfx('fail'); return; }
    addItem(id); v.set(tx, ty, null);
    if (o.t === 'weed') track('weed'); else if (it && it.kind === 'shell') track('shell');
    Sound.sfx('pick'); this.do('pick', 0.3);
    if (o.t !== 'item') burst(o.t === 'weed' ? 'leaf' : 'petal', tx + 0.5, 0.2, ty + 0.5, 5);
  }

  /** 주변 빈 칸에 물건을 떨어뜨린다 */
  dropNear(tx, ty, id, prefer = [[0, 1], [-1, 1], [1, 1], [-1, 0], [1, 0], [0, -1], [-1, -1], [1, -1]]) {
    const v = G.village;
    for (const [dx, dy] of prefer) {
      const x = tx + dx, y = ty + dy;
      if (v.empty(x, y) && v.buried[y * MAP_W + x] == null && v.terrainAt(x, y) !== T.BRIDGE && v.terrainAt(x, y) !== T.DOCK) { v.set(x, y, { t: 'item', id }); return true; }
    }
    return false;
  }

  shake(f, o) {
    const v = G.village, idx = f.ty * MAP_W + f.tx;
    this.actor.faceTo(f.tx + 0.5, f.ty + 0.5);
    Sound.sfx('shake'); G.world.shake(idx);
    this.do('shake', 0.55, () => {
      const cx = f.tx + 0.5, cz = f.ty + 0.5;
      if (o.kind === 'fruit' && o.stage === 3 && o.fruits > 0) {
        let n = 0;
        for (let i = 0; i < o.fruits; i++) if (this.dropNear(f.tx, f.ty, 'fruit_' + o.fruit)) n++;
        o.fruits = 0; o.picked = dayKey(); track('fruit', n); track('shake');
        v.touch(f.tx, f.ty); Sound.sfx('plop'); burst('leaf', cx, 2, cz, 8);
        return;
      }
      burst(G.look && G.look.blossom && o.kind === 'blossom' ? 'petal' : G.look && G.look.snow ? 'snow' : 'leaf', cx, 2.2, cz, 7);
      const D = S.daily;
      if (D.shaken.includes(idx)) return;
      D.shaken.push(idx); track('shake');
      if (D.coinTrees.includes(idx)) { this.dropNear(f.tx, f.ty, 'coin'); Sound.sfx('coin'); return; }
      if (D.furnTrees.includes(idx)) { const fu = FURNITURE[Math.floor(rand() * FURNITURE.length)][0]; this.dropNear(f.tx, f.ty, fu); Sound.sfx('plop'); UI.toast('나무에서 보따리가 떨어졌다!'); return; }
      if (D.nestTrees.includes(idx)) { this.dropNear(f.tx, f.ty, 'nest'); Sound.sfx('plop'); G.critters.wasps(cx, cz); return; }
      if (rand() < 0.07) G.critters.dropBug(cx, cz + 0.6);
    });
  }

  canDig(tx, ty) { const t = G.village.terrainAt(tx, ty); return (t === T.GRASS || t === T.SAND) && !G.village.doorAt(tx, ty - 1); }
  shovel(f, o) {
    const v = G.village, idx = f.ty * MAP_W + f.tx, cx = f.tx + 0.5, cz = f.ty + 0.5;
    this.actor.faceTo(cx, cz);
    if (o && (o.t === 'tree' && o.stage > 0)) { this.do('dig', 0.35, () => { Sound.sfx('bonk'); UI.toast('단단해서 삽이 들어가지 않는다.'); }); return; }
    if (o && o.t === 'rock') {
      this.do('dig', 0.35, () => {
        Sound.sfx('bonk'); G.world.bump(idx); G.stage.shake = 0.08;
        const D = S.daily;
        if (D.moneyRock === idx && D.rockHits < 8) { D.rockHits++; const n = 100 * D.rockHits; addMoney(n); Sound.sfx('coin'); burst('spark', cx, 0.6, cz, 6); UI.toast(`돌에서 도토리 ${n}개가 나왔다!`); }
        else {
          D.stones = D.stones || {};
          if ((D.stones[idx] || 0) < 3) {            // 바위 하나에서 하루에 돌 세 개까지
            if (canAdd('mat_stone')) { D.stones[idx] = (D.stones[idx] || 0) + 1; addItem('mat_stone'); track('stone'); burst('dirt', cx, 0.5, cz, 5); Sound.sfx('pick'); UI.toast('돌을 얻었다.', 1200); }
            else UI.toast('가방이 가득 차서 돌을 줍지 못했다.');
          } else if (!D.shaken.includes(-idx - 1)) { D.shaken.push(-idx - 1); if (rand() < 0.5) G.critters.rockBug(cx, cz + 0.6); else UI.toast('이 바위에서는 오늘 더 나올 돌이 없다.', 1600); }
        }
      });
      return;
    }
    if (o && o.t === 'hole') { this.do('dig', 0.4, () => { v.set(f.tx, f.ty, null); Sound.sfx('dig'); burst('dirt', cx, 0.1, cz, 6); }); return; }
    if (o && o.t === 'stump') { this.do('dig', 0.5, () => { v.set(f.tx, f.ty, { t: 'hole' }); Sound.sfx('dig'); burst('dirt', cx, 0.2, cz, 8); }); return; }
    if (o && o.t === 'flower') {
      const id = `flower_${o.sp}_${o.col}`;
      if (!canAdd(id)) { UI.toast('가방이 가득 찼다.'); return; }
      this.do('dig', 0.4, () => { addItem(id); v.set(f.tx, f.ty, null); Sound.sfx('dig'); burst('dirt', cx, 0.1, cz, 5); });
      return;
    }
    if (o && o.t === 'tree' && o.stage === 0) { this.do('dig', 0.4, () => { v.set(f.tx, f.ty, null); Sound.sfx('dig'); }); return; }
    if (o && o.t === 'weed') { this.do('dig', 0.35, () => { v.set(f.tx, f.ty, null); addItem('weed'); track('weed'); Sound.sfx('dig'); }); return; }
    if (o) return;
    if (v.buried[idx] != null) {
      const id = v.buried[idx];
      if (!canAdd(id)) { UI.toast('가방이 가득 차서 캐낼 수 없다.'); Sound.sfx('fail'); return; }
      this.do('dig', 0.45, () => {
        delete v.buried[idx]; addItem(id); if (id === 'fossil') track('fossil');
        v.set(f.tx, f.ty, { t: 'hole' });
        Sound.sfx('dig'); burst('dirt', cx, 0.1, cz, 8); Sound.sfx('pick');
        UI.toast(`${josa(itemName(id), '을/를')} 캐냈다!`);
      });
      return;
    }
    if (!this.canDig(f.tx, f.ty)) { Sound.sfx('bonk'); return; }
    this.do('dig', 0.4, () => { v.set(f.tx, f.ty, { t: 'hole' }); Sound.sfx('dig'); burst('dirt', cx, 0.1, cz, 6); });
  }

  chop(f, o) {
    const v = G.village, idx = f.ty * MAP_W + f.tx, cx = f.tx + 0.5, cz = f.ty + 0.5;
    this.actor.faceTo(cx, cz);
    this.do('swing', 0.5, () => {
      Sound.sfx('chop'); G.world.shake(idx, 1.4); burst('leaf', cx, 1.6, cz, 4);
      o.chop = (o.chop || 0) + 1;
      const got = o.stage < 3 ? 0 : o.chop >= 3 ? 2 : 1;       // 다 자란 나무를 찍을 때마다 나무가 나온다(쓰러질 때는 둘)
      if (got) { if (canAdd('mat_wood')) { addItem('mat_wood', got); track('wood', got); UI.toast(`나무를 ${got}개 얻었다.${o.chop === 2 ? ' 한 번 더 찍으면 쓰러진다.' : ''}`, 1500); } else UI.toast('가방이 가득 차서 나무를 줍지 못했다.'); }
      if (o.chop >= 3) {
        if (o.kind === 'fruit') for (let i = 0; i < (o.fruits || 0); i++) this.dropNear(f.tx, f.ty, 'fruit_' + o.fruit);
        v.set(f.tx, f.ty, { t: 'stump' });
        burst('leaf', cx, 1.5, cz, 16); Sound.sfx('plop'); G.stage.shake = 0.12;
      }
    });
  }

  water(f, o) {
    const cx = f.tx + 0.5, cz = f.ty + 0.5;
    this.do('pour', 1.0, () => {
      Sound.sfx('water'); burst('splash', cx, 0.45, cz, 7);
      if (o && o.t === 'flower') { if (o.w !== dayKey()) track('water'); o.w = dayKey(); }
    });
    // 물뿌리개 주둥이에서 꽃까지 떨어지는 물줄기
    for (let i = 0; i < 5; i++) this.later(0.3 + i * 0.09, () => { const k = 0.35 + Math.random() * 0.5; burst('splash', this.x + (cx - this.x) * k, 0.75 - k * 0.4, this.z + (cz - this.z) * k, 2); });
  }

  swingNet() {
    Sound.sfx('swing');
    this.do('swing', 0.4, () => {
      const f = this.front(0.85);
      const bug = G.critters.netAt(f.x, f.z, 0.95);
      if (bug) G.hooks.caughtBug(bug);
    });
  }

  // ---------------------------------------------------------------- 낚시
  castSpot() {
    const v = G.village;
    for (const d of [2.6, 2.0, 3.2, 1.5]) {
      const x = this.x + Math.sin(this.yaw) * d, z = this.z + Math.cos(this.yaw) * d;
      if (v.isWater(Math.floor(x), Math.floor(z)) && G.world.terrain.sample(G.world.terrain.F.water, x, z) > 0.6) return { x, z };
    }
    return null;
  }
  cast() {
    const spot = this.castSpot();
    if (!spot) { this.do('cast', 0.4, () => UI.toast('찌를 던질 물이 앞에 없다.')); Sound.sfx('swing'); return; }
    Sound.sfx('swing');
    this.actor.play('cast', 0.5);
    if (!this.bobber) {
      this.bobber = make('bobber'); this.bobber.scale.setScalar(1.3); G.stage.scene.add(this.bobber);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      this.line = new THREE.Line(g, patchMaterial(new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })));
      this.line.frustumCulled = false; G.stage.scene.add(this.line);
    }
    this.bobber.visible = true; this.line.visible = true;
    this.fishing = { state: 'fly', t: 0, x: spot.x, z: spot.z, sx: this.x, sz: this.z, dip: 0 };
  }
  endFishing() {
    if (!this.fishing) return;
    this.fishing = null;
    if (this.bobber) { this.bobber.visible = false; this.line.visible = false; }
    G.critters.bobber = null;
    this.actor.anim = null;
  }
  updateFishing(dt, free) {
    const F = this.fishing, a = this.actor;
    F.t += dt; a.speed = 0;
    let bx = F.x, bz = F.z, by = WATER_Y + 0.03;
    if (F.state === 'fly') {
      const k = Math.min(1, F.t / 0.5);
      bx = F.sx + (F.x - F.sx) * k; bz = F.sz + (F.z - F.sz) * k; by = WATER_Y + 0.03 + Math.sin(k * Math.PI) * 1.6 + (1 - k) * 1.0;
      if (k >= 1) { F.state = 'wait'; F.t = 0; Sound.sfx('plop'); burst('splash', F.x, WATER_Y + 0.1, F.z, 5); G.critters.bobber = { x: F.x, z: F.z, state: 'idle', fish: null }; a.play('holdrod', 99); }
    } else {
      const B = G.critters.bobber;
      if (B) {
        if (B.state === 'nibble' && B.dipT > 0) { by -= 0.05; }
        if (B.state === 'bite') { by -= 0.16; if (F.state !== 'bite') { F.state = 'bite'; a.emote('!', 0.9); G.stage.shake = 0.05; } }
        else if (F.state === 'bite') F.state = 'wait';
        by += Math.sin(G.time * 3) * 0.012;
      }
      const moveOn = Input.axis().on;
      if (free && (Input.take('act') || moveOn)) {
        if (B && B.state === 'bite' && !moveOn) { const fish = B.fish; G.critters.removeFish(fish); this.reelIn(fish.sp); return; }
        if (B && B.fish) G.critters.scare(B.fish);
        Sound.sfx('reel'); this.endFishing(); return;
      }
      if (B && B.state === 'gone') { B.state = 'idle'; B.fish = null; F.state = 'wait'; }
    }
    this.bobber.position.set(bx, by, bz);
    const p = this.line.geometry.attributes.position.array;
    // 낚싯줄은 낚싯대 끝에서 나간다
    const tip = a.held && a.held.userData.parts && a.held.userData.parts.tip;
    if (tip) { tip.getWorldPosition(_tip); p[0] = _tip.x; p[1] = _tip.y; p[2] = _tip.z; }
    else { p[0] = this.x + Math.sin(this.yaw) * 0.55; p[1] = a.root.position.y + 1.75; p[2] = this.z + Math.cos(this.yaw) * 0.55; }
    p[3] = bx; p[4] = by + 0.1; p[5] = bz;
    this.line.geometry.attributes.position.needsUpdate = true;
  }
  reelIn(sp) {
    Sound.sfx('reel');
    burst('splash', this.fishing.x, WATER_Y + 0.1, this.fishing.z, 12);
    this.endFishing();
    this.do('pull', 0.5, () => G.hooks.caughtFish(sp));
  }
}
