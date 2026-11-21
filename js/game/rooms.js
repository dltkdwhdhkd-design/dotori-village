// 실내: 방 한 칸을 3D로 짓고, 가구를 놓고, 안의 캐릭터를 움직인다
import * as THREE from 'three';
import { make, patchMaterial } from '../gfx/models.js';
import { roomTexture } from '../gfx/roomtex.js';
import { Actor } from '../gfx/actor.js';
import { G } from './game.js';
import { ITEMS } from '../data/items.js';
import { Input } from '../core/input.js';
import { Sound } from '../core/audio.js';
import { UI } from '../ui/ui.js';
import { S, addItem, canAdd } from './state.js';
import { clamp, rand } from '../core/util.js';
import { signMesh } from './museum.js';

const WALL_H = 2.5;
const K = (k, t) => `<b>${k}</b>${t}`;

export function footprint(it) {
  const d = ITEMS[it.id] || {};
  const w = it.w || d.w || 1, h = it.d || d.d || 1;
  return it.r % 2 ? [h, w] : [w, h];
}

export class Room {
  /** spec: { id, w, h, wall, floor, items:[{id,x,y,r,sale?,prop?}], editable, npcDefs:[{model,name,pitch,x,z,fixed,talk,face}],
   *          portals:[{x, to, label}] 뒷벽에 난 다른 방으로 가는 문,  exitTo 아래쪽 문으로 나가면 가는 방(없으면 마을),
   *          setup(room) 방을 다 지은 뒤 꾸밈·전시물을 더하는 함수. { update(dt), probe(player) → {label, act} } 를 돌려주면 방이 불러 준다 } */
  constructor(spec) {
    Object.assign(this, spec);
    this.blocks = [];          // 가구가 아닌 것(수조, 전시대, 나무)이 막고 있는 칸
    this.ex = null;
    this.group = new THREE.Group();
    this.npcs = [];
    this.objs = [];
    this.build();
  }

  build() {
    const { w, h } = this;
    if(this.landscape){this.landscape(this);} else {
    const floorT = roomTexture(this.floor).clone(); floorT.needsUpdate = true; floorT.repeat.set(w / 2, h / 2);
    const fm = new THREE.Mesh(new THREE.PlaneGeometry(w, h), patchMaterial(new THREE.MeshLambertMaterial({ map: floorT })));
    fm.rotation.x = -Math.PI / 2; fm.position.set(w / 2, 0, h / 2); this.group.add(fm); this.floorMesh = fm;
    const wallM = () => { const t = roomTexture(this.wall).clone(); t.needsUpdate = true; return t; };
    const tb = wallM(); tb.repeat.set(w / 2.5, 1);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, WALL_H), patchMaterial(new THREE.MeshLambertMaterial({ map: tb })));
    back.position.set(w / 2, WALL_H / 2, 0); this.group.add(back);
    this.wallMeshes = [back];
    for (const sx of [0, w]) {
      const ts = wallM(); ts.repeat.set(h / 2.5, 1);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(h, WALL_H), patchMaterial(new THREE.MeshLambertMaterial({ map: ts, color: 0xe6e0d6 })));
      m.rotation.y = sx === 0 ? Math.PI / 2 : -Math.PI / 2; m.position.set(sx, WALL_H / 2, h / 2); this.group.add(m); this.wallMeshes.push(m);
    }
    // 벽 윗면과 바깥(어두운 테두리), 걸레받이
    const dark = patchMaterial(new THREE.MeshLambertMaterial({ color: 0x5a4632 }));
    const trim = patchMaterial(new THREE.MeshLambertMaterial({ color: 0x8a6a48 }));
    const box = (bw, bh, bd, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), m); b.position.set(x, y, z); this.group.add(b); return b; };
    box(w + 0.6, 0.2, 0.3, w / 2, WALL_H + 0.1, -0.15, dark); box(0.3, 0.2, h + 0.3, -0.15, WALL_H + 0.1, h / 2 - 0.15, dark); box(0.3, 0.2, h + 0.3, w + 0.15, WALL_H + 0.1, h / 2 - 0.15, dark);
    box(w, 0.14, 0.05, w / 2, 0.07, 0.025, trim); box(0.05, 0.14, h, 0.025, 0.07, h / 2, trim); box(0.05, 0.14, h, w - 0.025, 0.07, h / 2, trim);
    // 문 앞 깔개와 바닥 아래 어둠
    const under = new THREE.Mesh(new THREE.PlaneGeometry(w + 30, h + 30), new THREE.MeshBasicMaterial({ color: 0x2a1f18 }));
    under.rotation.x = -Math.PI / 2; under.position.set(w / 2, -0.02, h / 2); this.group.add(under);
    const mat = make('doormat'); mat.position.set(w / 2, 0, h + 0.32); this.group.add(mat);
    box(1.5, 0.02, 0.7, w / 2, -0.005, h + 0.3, patchMaterial(new THREE.MeshLambertMaterial({ color: 0xcfb58a })));
    // 다른 방으로 가는 문(뒷벽): 어두운 문틀과 팻말
    for (const pt of this.portals || []) {
      box(1.24, 2.0, 0.05, pt.x, 1.0, 0.03, new THREE.MeshBasicMaterial({ color: 0x3a2a20 }));
      box(0.12, 2.1, 0.12, pt.x - 0.68, 1.05, 0.06, trim); box(0.12, 2.1, 0.12, pt.x + 0.68, 1.05, 0.06, trim); box(1.48, 0.12, 0.12, pt.x, 2.12, 0.06, trim);
      const s = signMesh(pt.label, 1.16, 0.3); s.position.set(pt.x, 1.74, 0.07); this.group.add(s);
      box(1.1, 0.02, 0.5, pt.x, 0.011, 0.3, patchMaterial(new THREE.MeshLambertMaterial({ color: 0xb85a4a })));
    }
    }
    this.rebuildItems();
    for (const n of this.npcDefs || []) this.addNpc(n);
    if (this.setup) { this.ex = this.setup(this) || null; this.rebuildItems(); }
    G.stage.scene.add(this.group);
  }

  setStyle(wall, floor) {
    this.wall = wall; this.floor = floor;
    const ft = roomTexture(floor).clone(); ft.needsUpdate = true; ft.repeat.set(this.w / 2, this.h / 2);
    this.floorMesh.material.map = ft; this.floorMesh.material.needsUpdate = true;
    this.wallMeshes.forEach((m, i) => { const t = roomTexture(wall).clone(); t.needsUpdate = true; t.repeat.set((i === 0 ? this.w : this.h) / 2.5, 1); m.material.map = t; m.material.needsUpdate = true; });
  }

  rebuildItems() {
    for (const o of this.objs) this.group.remove(o);
    this.objs = [];
    this.occ = new Array(this.w * this.h).fill(-1);
    this.items.forEach((it, i) => {
      const [fw, fh] = footprint(it);
      for (let y = it.y; y < it.y + fh; y++) for (let x = it.x; x < it.x + fw; x++) if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.occ[y * this.w + x] = i;
      const def = ITEMS[it.id];
      const o = make(def ? def.model : it.id, def && def.tint ? { tint: def.tint } : {});
      o.position.set(it.x + fw / 2, it.lift || 0, it.y + fh / 2);
      o.rotation.y = -(it.r || 0) * Math.PI / 2;
      if (it.scale) o.scale.setScalar(it.scale);
      this.group.add(o); this.objs.push(o);
    });
    for (const [x, y] of this.blocks) this.occ[y * this.w + x] = -2;
  }
  /** 가구가 아닌 것이 차지한 칸을 막는다 */
  block(x0, y0, x1 = x0, y1 = y0) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < this.w && y < this.h) { this.blocks.push([x, y]); if(this.occ)this.occ[y * this.w + x] = -2; }
  }
  portalAt(x) { return (this.portals || []).find((q) => Math.abs(x - q.x) < 0.5) || null; }

  addNpc(d) {
    const a = new Actor(d.model);
    this.group.add(a.root);
    const n = { ...d, actor: a, visible: true, wait: 1 + rand() * 3, tx: d.x, tz: d.z, state: 'idle' };
    a.setPos(n.x, 0, n.z); a.face(d.face || 0, true);
    this.npcs.push(n);
    return n;
  }

  dispose() { G.stage.scene.remove(this.group); if(this.floorResource){this.floorResource.material.map.dispose();this.floorResource.material.dispose();this.floorResource.geometry.dispose();this.outskirts?.material.dispose();this.outskirts?.geometry.dispose();} this.endHunt?.(); }
  focus(px, pz) { return { x: this.w / 2 + (px - this.w / 2) * 0.45, z: this.h / 2 + (pz - this.h / 2) * 0.5 + 0.9 }; }

  free(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h && this.occ[y * this.w + x] === -1; }
  canPlace(it, ignore = -1) {
    const [fw, fh] = footprint(it);
    for (let y = it.y; y < it.y + fh; y++) for (let x = it.x; x < it.x + fw; x++) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
      const o = this.occ[y * this.w + x];
      if (o !== -1 && o !== ignore) return false;
    }
    // 문 앞 두 칸은 비워 둔다
    const dx = Math.floor(this.w / 2);
    for (let x = dx - 1; x <= dx; x++) if (it.y + fh - 1 >= this.h - 1 && x >= it.x && x < it.x + fw) return false;
    return true;
  }

  resolve(x, z, r) {
    const door = Math.abs(x - this.w / 2) < 0.62;
    const pt = this.portalAt(x);
    x = clamp(x, r, this.w - r);
    z = clamp(z, pt ? -0.45 : r + 0.15, door ? this.h + 0.5 : this.h - r);
    if (z > this.h - r) x = clamp(x, this.w / 2 - 0.5, this.w / 2 + 0.5);
    if (pt && z < r + 0.15) x = clamp(x, pt.x - 0.3, pt.x + 0.3);
    for (let pass = 0; pass < 2; pass++) {
      const cx0 = Math.floor(x), cy0 = Math.floor(z);
      for (let cy = cy0 - 1; cy <= cy0 + 1; cy++) for (let cx = cx0 - 1; cx <= cx0 + 1; cx++) {
        if (cx < 0 || cy < 0 || cx >= this.w || cy >= this.h || this.occ[cy * this.w + cx] === -1) continue;
        const nx = clamp(x, cx, cx + 1), nz = clamp(z, cy, cy + 1), dx = x - nx, dz = z - nz, d = Math.hypot(dx, dz);
        if (d < r) {
          if (d < 1e-5) { const l = x - cx, rr = cx + 1 - x, u = z - cy, dn = cy + 1 - z, m = Math.min(l, rr, u, dn); if (m === l) x = cx - r; else if (m === rr) x = cx + 1 + r; else if (m === u) z = cy - r; else z = cy + 1 + r; }
          else { x = nx + (dx / d) * r; z = nz + (dz / d) * r; }
        }
      }
    }
    for (const n of this.npcs) { if(n.visible===false)continue; const dx = x - n.x, dz = z - n.z, d = Math.hypot(dx, dz); if (d < 0.6 && d > 1e-4) { x = n.x + (dx / d) * 0.6; z = n.z + (dz / d) * 0.6; } }
    return { x, z };
  }

  checkExit(p) {
    if (p.z > this.h + 0.28) { G.hooks.exit(); return true; }
    const pt = this.portalAt(p.x);
    if (pt && p.z < -0.12) { G.hooks.portal(pt.to); return true; }
    return false;
  }
  probe(p) { return this.ex && this.ex.probe ? this.ex.probe(p) : null; }

  itemInFront(p) {
    const f = p.front(0.75);
    const x = Math.floor(f.x), y = Math.floor(f.z);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    const i = this.occ[y * this.w + x];
    return i >= 0 ? { i, it: this.items[i], x, y } : { i: -1, x, y };
  }

  hint(p) {
    if (p.npcInFront()) return K('Space', '말 걸기');
    const e = this.probe(p);
    if (e) return K('Space', e.label);
    const t = this.itemInFront(p);
    if (!t || t.i < 0) return this.editable ? K('E', '가방에서 가구 꺼내 놓기') : '';
    const def = ITEMS[t.it.id];
    let h = '';
    if (t.it.sale != null) return K('Space', `${def.name} 살펴보기`);
    if (t.it.act) h = K('Space', t.it.actLabel || '살펴보기');
    else if (def && def.use) h = K('Space', { storage: '창고 열기', bed: '누워서 쉬기(저장)', lamp: '불 켜고 끄기', tv: '켜기', radio: '틀기', piano: '쳐 보기', guitar: '쳐 보기', mirror: '모습 바꾸기' }[def.use] || '쓰기');
    if (this.editable) h += (h ? '　' : '') + K('F', '집어넣기') + '　' + K('Q', '돌리기');
    return h;
  }

  act(p) {
    const npc = p.npcInFront();
    if (npc) { if (npc.talk) npc.talk(npc); return; }
    const e = this.probe(p);
    if (e) return e.act();
    const t = this.itemInFront(p);
    if (!t || t.i < 0) return;
    const def = ITEMS[t.it.id];
    if (t.it.sale != null) return G.hooks.buyDisplay(this, t.i);
    if (t.it.act) return t.it.act(t.it);
    if (!def || !def.use) return;
    if (def.use === 'storage') return G.hooks.openStorage();
    if (def.use === 'bed') return G.hooks.rest();
    if (def.use === 'mirror') return G.hooks.openMirror();
    if (def.use === 'lamp') { Sound.sfx('ui'); UI.toast('딸깍.'); return; }
    if (def.use === 'piano' || def.use === 'guitar') { Sound.sfx('fanfare'); p.do('joy', 0.8); return; }
    if (def.use === 'tv' || def.use === 'radio') { Sound.sfx('letter'); UI.toast(def.use === 'tv' ? '화면에서 날씨 예보가 나온다.' : '라디오에서 잔잔한 음악이 흐른다.'); }
  }

  pickup(p) {
    if (!this.editable) return;
    const t = this.itemInFront(p);
    if (!t || t.i < 0) return;
    if (!canAdd(t.it.id)) { UI.toast('가방이 가득 찼다.'); Sound.sfx('fail'); return; }
    addItem(t.it.id);
    this.items.splice(t.i, 1);
    this.rebuildItems(); Sound.sfx('pick'); p.do('pick', 0.3);
    if (this.onChange) this.onChange();
  }
  rotateInFront(p) {
    if (!this.editable) return;
    const t = this.itemInFront(p);
    if (!t || t.i < 0) return;
    const it = t.it, old = it.r || 0;
    for (let k = 1; k <= 3; k++) {
      it.r = (old + k) % 4;
      if (this.canPlace(it, t.i)) { this.rebuildItems(); Sound.sfx('ui'); if (this.onChange) this.onChange(); return; }
    }
    it.r = old; Sound.sfx('fail');
  }
  /** 주인공 앞에 가구를 놓는다. 자리가 없으면 false */
  placeFront(p, id) {
    const f = p.front(0.9);
    const bx = Math.floor(f.x), by = Math.floor(f.z);
    const cand = [[0, 0], [0, -1], [-1, 0], [1, 0], [-1, -1], [1, -1], [0, 1]];
    for (const r of [0, 1]) for (const [dx, dy] of cand) {
      const it = { id, x: bx + dx, y: by + dy, r };
      const [fw, fh] = footprint(it);
      // 주인공이 서 있는 칸은 피한다
      const px = Math.floor(p.x), py = Math.floor(p.z);
      if (px >= it.x && px < it.x + fw && py >= it.y && py < it.y + fh) continue;
      if (this.canPlace(it)) { this.items.push(it); this.rebuildItems(); if (this.onChange) this.onChange(); return true; }
    }
    return false;
  }

  update(dt) {
    const p = G.player;
    if (this.editable && !UI.blocking() && !G.busy && Input.take('cycle')) this.rotateInFront(p);
    if (this.ex && this.ex.update) this.ex.update(dt);
    for (const n of this.npcs) {
      const a = n.actor;
      const dp = Math.hypot(p.x - n.x, p.z - n.z);
      if (n.fixed || n.talking) { a.speed = 0; if (dp < 2.2 || n.talking) a.faceTo(p.x, p.z); else a.face(n.face || 0); a.update(dt); continue; }
      if (n.state === 'idle') {
        a.speed = 0; if (dp < 1.5) a.faceTo(p.x, p.z);
        n.wait -= dt;
        if (n.wait <= 0) {
          for (let k = 0; k < 10; k++) { const x = Math.floor(rand() * this.w), y = Math.floor(rand() * (this.h - 1)); if (this.free(x, y)) { n.tx = x + 0.5; n.tz = y + 0.5; n.state = 'walk'; n.walkT = 0; break; } }
          n.wait = 2 + rand() * 4;
        }
      } else {
        const dx = n.tx - n.x, dz = n.tz - n.z, d = Math.hypot(dx, dz);
        n.walkT += dt;
        if (d < 0.08 || n.walkT > 4 || dp < 0.8) { n.state = 'idle'; a.speed = 0; }
        else {
          const sp = 1.4 * dt, q = this.resolveNpc(n.x + (dx / d) * sp, n.z + (dz / d) * sp, 0.27, n);
          if (Math.hypot(q.x - n.x, q.z - n.z) < sp * 0.3) n.walkT += dt * 4;
          n.x = q.x; n.z = q.z; a.face(Math.atan2(dx, dz)); a.speed = 1;
        }
      }
      a.setPos(n.x, 0, n.z); a.update(dt);
    }
  }
  resolveNpc(x, z, r, self) {
    const keep = this.npcs; this.npcs = [];
    const q = this.resolve(x, z, r);
    this.npcs = keep;
    q.z = Math.min(q.z, this.h - 0.5);
    return q;
  }
}
