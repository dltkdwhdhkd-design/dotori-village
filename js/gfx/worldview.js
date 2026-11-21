// 마을을 3D로 보여 주는 부분: 지형 위에 나무·꽃·건물·다리 등을 세운다
import * as THREE from 'three';
import { make, MODELS, setMatColor, getMat, sharedMat, patchMaterial, FX } from './models.js';
import { Terrain, PAD } from './terrain.js';
import { makeBlobShadow } from './stage.js';
import { G, MAP_W, MAP_H } from '../world/mapgen.js';
import { hash01 } from '../core/util.js';

const TREE_MODEL = { fruit: 'tree_fruit', blossom: 'tree_blossom', pine: 'tree_pine' };
const STAGE_SCALE = [1, 0.5, 0.75, 1];
export const FLOWER_HEX = { red: 0xf0564e, yellow: 0xffd84a, white: 0xffffff, pink: 0xff9fc2, orange: 0xff9a3d, purple: 0xb07be0, blue: 0x6aa5f2 };

// 계절별 잎 색
const LEAVES = {
  spring: { leaf: 0x6cc25a, leaf_d: 0x4fa551, leaf_l: 0x93da76, bloom: 0x80cf68, bloom_d: 0x5aae58, bloom_l: 0xb4ea8c, pine: 0x3f9a63, pine_d: 0x2f7f55, pine_l: 0x5cba7a, big: 0x74c860, big_d: 0x50a652, big_l: 0xa9e584, weed: 0x6cc25a, tuft: 0x7fd06a, tuft_l: 0xa4e486 },
  summer: { leaf: 0x55b254, leaf_d: 0x3b9049, leaf_l: 0x86d570, bloom: 0x5fb95a, bloom_d: 0x43964d, bloom_l: 0x8fd975, pine: 0x3a9862, pine_d: 0x2a7b52, pine_l: 0x57b877, big: 0x52ae52, big_d: 0x398d48, big_l: 0x84d36e, weed: 0x5fb04a, tuft: 0x5cb658, tuft_l: 0x80cf6c },
  autumn: { leaf: 0x98b853, leaf_d: 0x759a45, leaf_l: 0xc4d268, bloom: 0xb9c45a, bloom_d: 0x95a548, bloom_l: 0xd8dc78, pine: 0x3a9862, pine_d: 0x2a7b52, pine_l: 0x57b877, big: 0xe6b53e, big_d: 0xc58a30, big_l: 0xf7dd62, weed: 0xb3b05a, tuft: 0xa9b65e, tuft_l: 0xc6cf74 },
  winter: { leaf: 0x5fae62, leaf_d: 0x42894f, leaf_l: 0x8ccf8a, bloom: 0xb7a58c, bloom_d: 0x93806a, bloom_l: 0xd0c2ac, pine: 0x3a9862, pine_d: 0x2a7b52, pine_l: 0x57b877, big: 0xb7a58c, big_d: 0x93806a, big_l: 0xd3c6b0, weed: 0xb9b49c, tuft: 0xa9b65e, tuft_l: 0xc6cf74 },
};
const BLOSSOM = { bloom: 0xf9b3cb, bloom_d: 0xe88aae, bloom_l: 0xffe1ea };
const FOLIAGE = { bloom: 0xec8b3e, bloom_d: 0xcd6336, bloom_l: 0xfac457 };

let glowTex = null;
function glowMaterial(color = 0xffe9a0) {
  if (!glowTex) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    glowTex = new THREE.CanvasTexture(c);
  }
  return patchMaterial(new THREE.MeshBasicMaterial({ map: glowTex, color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
}

// 주인공을 가리는 건물·나무를 비쳐 보이게 할 때 쓰는 재질(원래 재질마다 하나씩)
const fadeCache = new Map();
function fadeOf(mat) {
  let m = fadeCache.get(mat);
  if (!m) {
    m = mat.clone();
    m.userData = { base: mat.userData.base, fade: true };
    m.transparent = true; m.opacity = 0.3;          // 깊이는 그대로 기록해서 겹친 잎이 덧칠되지 않게 한다
    m.onBeforeCompile = null;
    m.customProgramCacheKey = THREE.Material.prototype.customProgramCacheKey;
    patchMaterial(m, mat.userData.fx);
    fadeCache.set(mat, m);
  }
  m.color.copy(mat.color);
  if (mat.emissive) m.emissive.copy(mat.emissive);
  return m;
}
function setFade(obj, on) {
  if (!!obj.userData.faded === on) return;
  obj.userData.faded = on;
  obj.traverse((n) => {
    if (!n.isMesh || n.userData.noFade) return;
    if (on) { if (!n.userData.orig) n.userData.orig = n.material; n.material = fadeOf(n.userData.orig); n.renderOrder = 3; }
    else if (n.userData.orig) { n.material = n.userData.orig; n.renderOrder = 0; }
  });
}

export class WorldView {
  /** hooks: { buildingLook(b) -> {model,tint}|null, itemModel(id) -> 모델 이름 } */
  constructor(stage, village, hooks) {
    this.stage = stage; this.v = village; this.hooks = hooks;
    this.root = new THREE.Group();
    stage.scene.add(this.root);
    this.terrain = new Terrain(village);
    this.root.add(this.terrain.group);
    this.objRoot = new THREE.Group(); this.root.add(this.objRoot);
    this.objs = new Map();
    this.marks = new Map();
    this.bldObjs = new Map();
    this.anims = [];
    this.glows = [];
    this.glowMat = glowMaterial();
    this.look = null;
    this.night = 0;
    this.buildStatic();
    this.buildGrass();
    this.buildBuildings();
    village.each((o, x, y, i) => this.refresh(i, x, y));
    for (const k of Object.keys(village.buried)) this.refreshMark(+k);
    village.onChange((i, x, y) => { this.refresh(i, x, y); this.refreshMark(i); });
  }

  dispose() {
    const t=this.terrain;
    for(const m of [t.ground,t.water]) {m.geometry.dispose();m.material.dispose();}
    for(const tex of [t.groundTex,t.detTex,t.maskTex])tex?.dispose();
    this.grass.traverse(o=>{if(o.isInstancedMesh)o.geometry.dispose();});
    this.root.traverse(o=>{if(o.isInstancedMesh)o.dispose();});
    this.glowMat.dispose();
  }
  gy(x, z) { return this.terrain.heightAt(x, z); }

  // ---------------------------------------------------------------- 고정된 것들
  buildStatic() {
    const v = this.v;
    // 다리
    for (const b of v.bridges) {
      if (b.built === false) continue;                 // 아직 놓지 않은 다리
      for (let dx = 0; dx < b.w; dx++) {
        for (const [dy, nm] of [[0, 'bridge_n'], [1, 'bridge_s']]) {
          const o = make(nm); o.position.set(b.x + dx + 0.5, 0, b.y + dy + 0.5); this.root.add(o);
        }
      }
      for (const px of [b.x + 0.6, b.x + b.w - 0.6]) for (const pz of [b.y + 0.3, b.y + 1.7]) { const o = make('bridge_post'); o.position.set(px, 0, pz); this.root.add(o); }
    }
    // 부두
    const d = v.dock;
    for (let dy = 0; dy < d.len; dy++) for (let dx = 0; dx < 2; dx++) {
      const o = make('dock'); o.position.set(d.x + dx + 0.5, 0, d.y + dy + 0.5); this.root.add(o);
    }
    for (let dy = 0; dy <= d.len; dy += 2) for (const px of [d.x - 0.02, d.x + 2.02]) { const o = make('dock_post'); o.position.set(px, 0, d.y + dy); this.root.add(o); }

    // 숲 가장자리와 절벽 위의 나무(인스턴스)
    const mats = [], rocks = [];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const T = this.terrain;
    for (let y = -PAD.n; y < MAP_H + 2; y++) for (let x = -PAD.w; x < MAP_W + PAD.w; x++) {
      const t = T.tt(x, y);
      const inMap = x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
      const h = hash01(x, y, 31);
      if (t === G.FOREST || (t === G.CLIFF && T.sample(T.F.cliff, x + 0.5, y + 0.5) > 0.9)) {
        // 지도에서 멀어질수록 듬성듬성 심는다(보이지 않는 곳에 나무를 낭비하지 않게)
        const far = Math.max(-x, x - (MAP_W - 1), -y, 0);
        const dens = (t === G.FOREST ? 0.62 : 0.3) * (far > 5 ? 0.35 : 1);
        if (h > dens) continue;
        const sc = 1.05 + hash01(x, y, 32) * 0.55;
        p.set(x + 0.5 + (hash01(x, y, 33) - 0.5) * 0.5, T.heightAt(x + 0.5, y + 0.5), y + 0.5 + (hash01(x, y, 34) - 0.5) * 0.5);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), h * 20);
        s.set(sc, sc, sc);
        mats.push(m4.compose(p, q, s).clone());
      } else if (t === G.SAND && !inMap && h < 0.2) {
        const sc = 0.8 + hash01(x, y, 35) * 0.6;
        p.set(x + 0.5, T.heightAt(x + 0.5, y + 0.5), y + 0.5); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), h * 30); s.set(sc, sc, sc);
        rocks.push(m4.compose(p, q, s).clone());
      }
    }
    this.chunks = [];
    this.forest = this.chunked('tree_pine', mats, 3);
    this.root.add(this.forest);
    if (rocks.length) this.root.add(this.chunked('boulder1', rocks, 1.5));
  }

  /** 풀밭 곳곳에 풀포기를 심는다(길·모래·건물 자리는 비운다). 장식일 뿐 걸리지 않는다. */
  buildGrass() {
    const v = this.v, T = this.terrain;
    const lists = { grass_a: [], grass_b: [], grass_f: [] };
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      if (v.terrainAt(x, y) !== G.GRASS) continue;
      const o = v.obj(x, y);
      if (o && o.t === 'bld') continue;
      for (let k = 0; k < 3; k++) {
        const h = hash01(x, y, 70 + k);
        if (h > 0.3) continue;
        const px = x + 0.5 + (hash01(x, y, 73 + k) - 0.5) * 0.92, pz = y + 0.5 + (hash01(x, y, 76 + k) - 0.5) * 0.92;
        if (Math.hypot(px - x - 0.5, pz - y - 0.5) < 0.3) continue;      // 칸 한가운데는 꽃·나무 자리
        if (T.grassAt(px, pz) < 0.97) continue;
        const kind = h < 0.03 ? 'grass_f' : h < 0.16 ? 'grass_a' : 'grass_b';
        const sc = 0.8 + hash01(x, y, 79 + k) * 0.45;
        p.set(px, T.heightAt(px, pz), pz); q.setFromAxisAngle(up, h * 40); s.set(sc, sc, sc);
        lists[kind].push(m4.compose(p, q, s).clone());
      }
    }
    this.grass = new THREE.Group();
    for (const [name, list] of Object.entries(lists)) {
      const g = this.chunked(name, list, 0.5, (im) => {     // 잎이 어느 쪽을 보든 땅처럼 환하게 빛을 받게 한다
        im.geometry = im.geometry.clone();
        const n = im.geometry.attributes.normal;
        for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
      });
      g.userData.kind = name;
      this.grass.add(g);
    }
    this.root.add(this.grass);
  }

  /** 여러 자리에 놓을 모델을 구역(12칸)별 묶음으로 나눠 만든다. 화면에서 먼 구역은 그리지 않는다. */
  chunked(name, matrices, margin = 2, each = null) {
    const SIZE = 12, map = new Map(), root = new THREE.Group();
    for (const m of matrices) {
      const cx = Math.floor(m.elements[12] / SIZE), cz = Math.floor(m.elements[14] / SIZE), key = cx + ',' + cz;
      if (!map.has(key)) map.set(key, { cx, cz, list: [] });
      map.get(key).list.push(m);
    }
    const geoCache = new Map();
    for (const c of map.values()) {
      const g = this.instanced(name, c.list);
      for (const im of g.children) {
        if (each) { const k = im.name; if (!geoCache.has(k)) { each(im); geoCache.set(k, im.geometry); } else im.geometry = geoCache.get(k); }
      }
      g.userData.box = [c.cx * SIZE - margin, c.cz * SIZE - margin, (c.cx + 1) * SIZE + margin, (c.cz + 1) * SIZE + margin];
      this.chunks.push(g);
      root.add(g);
    }
    return root;
  }

  /** 모델 하나를 여러 자리에 한꺼번에 그린다(그림자를 받기만 하고 드리우지는 않는다) */
  instanced(name, matrices) {
    const src = MODELS[name], g = new THREE.Group();
    if (!src) return g;
    src.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(src.matrixWorld).invert();
    src.traverse((n) => {
      if (!n.isMesh) return;
      const local = new THREE.Matrix4().multiplyMatrices(inv, n.matrixWorld);
      const im = new THREE.InstancedMesh(n.geometry, n.material, matrices.length);
      const m = new THREE.Matrix4();
      matrices.forEach((mm, i) => { m.multiplyMatrices(mm, local); im.setMatrixAt(i, m); });
      im.frustumCulled = false;
      im.receiveShadow = true;
      im.name = n.name;
      let a = n; while (a && a !== src) { if (a.name.endsWith('__snow')) im.userData.snow = true; a = a.parent; }
      g.add(im);
    });
    return g;
  }

  buildBuildings() {
    for (const [, o] of this.bldObjs) this.root.remove(o);
    this.bldObjs.clear();
    for (const b of this.v.buildings) this.refreshBuilding(b);
  }
  refreshBuilding(b) {
    const old = this.bldObjs.get(b.id);
    if (old) this.root.remove(old);
    const look = this.hooks.buildingLook(b);
    const o = look ? make(look.model, { tint: look.tint }) : make('sign_lot');
    o.position.set(b.x + b.w / 2, 0, b.y + b.d / 2 + (look ? 0 : 0.5));
    if(look?.scale)o.scale.setScalar(look.scale);
    o.userData.b = b;
    this.root.add(o);
    this.bldObjs.set(b.id, o);
  }

  // ---------------------------------------------------------------- 칸마다 놓인 것
  makeObj(o, x, y) {
    let g = null, shadow = 0;
    const h = hash01(x, y, 5);
    if (o.t === 'tree') {
      if (o.stage === 0) { g = make('sapling'); }
      else {
        g = make(TREE_MODEL[o.kind]);
        g.scale.setScalar(STAGE_SCALE[o.stage] * (0.94 + h * 0.12));
        g.rotation.y = o.kind === 'fruit' ? (h - 0.5) * 0.5 : h * 6.28;
        shadow = 0.95;
        if (o.kind === 'fruit' && o.stage === 3) {
          for (let i = 0; i < (o.fruits || 0); i++) {
            const a = g.userData.parts['fruit' + (i + 1)];
            if (a) { const f = make('fruit_' + o.fruit); f.scale.setScalar(1.3); f.position.y = -0.2; a.add(f); }
          }
        }
        this.seasonTree(g, o);
      }
    } else if (o.t === 'stump') { g = make('stump'); shadow = 0.35; this.snowPart(g); }
    else if (o.t === 'rock') { g = make('rock' + (o.v || 1)); g.rotation.y = h * 6.28; shadow = 0.5; this.snowPart(g); }
    else if (o.t === 'flower') { g = make('flower_' + o.sp, { tint: { petal: FLOWER_HEX[o.col] ?? 0xffffff } }); g.rotation.y = (h - 0.5) * 0.8; }
    else if (o.t === 'weed') { g = make('weed' + (o.v || 1)); g.rotation.y = h * 6.28; g.scale.setScalar(1.25); }
    else if (o.t === 'hole') { g = make('hole'); }
    else if (o.t === 'item') {
      g = make(this.hooks.itemModel(o.id), this.hooks.itemTint ? { tint: this.hooks.itemTint(o.id) } : {});
      g.rotation.y = (h - 0.5) * 1.2; shadow = 0.22;
      if (this.hooks.itemScale) g.scale.setScalar(this.hooks.itemScale(o.id));
    } else if(o.t==='decor'){
      g=make(this.hooks.decorModel(o.id));g.rotation.y=-(o.r||0)*Math.PI/2;shadow=.38;
    } else if (o.t === 'fix') {
      if (o.kind === 'part') return null;
      const nm = o.kind === 'boulder' ? 'boulder' + (o.v || 1) : o.kind==='workbench'?'workbench':o.kind;
      g = make(nm);
      if (o.kind === 'boulder') g.rotation.y = h * 6.28;
      shadow = { bigtree: 2.3, lamp: 0.22, boulder: 0.9, mailbox: 0.25, board: 0.6 }[o.kind] || 0;
      if (o.kind === 'bigtree') this.snowPart(g);
      if (o.kind === 'lamp') {
        const gl = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), this.glowMat);
        gl.position.set(0, 2.0, 0.1); gl.rotation.x = -0.75; gl.frustumCulled = false; gl.renderOrder = 5;
        g.add(gl);
      }
      if (o.kind === 'mailbox') this.mailbox = g;
    }
    if (!g) return null;
    if (o.t === 'flower' || o.t === 'weed' || o.t === 'item' || o.t === 'hole' || (o.t === 'tree' && o.stage === 0)) g.traverse((n) => { n.castShadow = false; });   // 자잘한 것은 그림자 생략
    g.position.set(x + 0.5, this.gy(x + 0.5, y + 0.5), y + 0.5);
    if(o.t==='decor'){const d=this.hooks.decorSize?.(o.id) || [1,1];g.position.x+=((o.r%2?d[1]:d[0])-1)/2;g.position.z+=((o.r%2?d[0]:d[1])-1)/2;}
    if (shadow) { const sh = makeBlobShadow(shadow / g.scale.x, 0.28); sh.userData.noFade = true; g.add(sh); }
    g.userData.o = o;
    return g;
  }

  snowPart(g) { const s = g.userData.parts && g.userData.parts.snow; if (s) s.visible = !!(this.look && this.look.snow); }
  seasonTree(g, o) {
    const p = g.userData.parts, L = this.look || {};
    if (p.snow) p.snow.visible = !!L.snow;
    if (o.kind === 'blossom' && p.canopy) p.canopy.visible = L.season !== 'winter';
  }

  refresh(i, x, y) {
    const old = this.objs.get(i);
    if (old) { this.objRoot.remove(old); this.objs.delete(i); }
    const o = this.v.objs[i];
    if (!o || o.t === 'bld') return;
    const g = this.makeObj(o, x, y);
    if (g) { this.objRoot.add(g); this.objs.set(i, g); }
  }
  refreshMark(i) {
    const old = this.marks.get(i);
    if (old) { this.objRoot.remove(old); this.marks.delete(i); }
    if (this.v.buried[i] == null || this.v.objs[i]) return;
    const x = i % MAP_W, y = (i / MAP_W) | 0;
    const g = make('digspot');
    g.position.set(x + 0.5, this.gy(x + 0.5, y + 0.5) + 0.01, y + 0.5);
    g.rotation.y = hash01(x, y, 9) * 3;
    this.objRoot.add(g); this.marks.set(i, g);
  }

  // ---------------------------------------------------------------- 계절·밤낮
  setLook(look) {
    const key = JSON.stringify(look);
    if (this.lookKey === key) return;
    this.lookKey = key; this.look = look;
    const L = { ...LEAVES[look.season] };
    if (look.blossom) Object.assign(L, BLOSSOM);
    if (look.foliage) Object.assign(L, FOLIAGE);
    for (const [k, c] of Object.entries(L)) setMatColor(k, c);
    this.terrain.setSeason(look.snow ? 'winter' : look.season === 'winter' ? 'autumn' : look.season);
    for (const [, g] of this.objs) {
      const o = g.userData.o;
      if (o.t === 'tree' && o.stage > 0) this.seasonTree(g, o); else this.snowPart(g);
    }
    if (this.forest) for (const g of this.forest.children) for (const im of g.children) if (im.userData.snow) im.visible = !!look.snow;
    if (this.grass) {
      this.grass.visible = !look.snow;                 // 눈이 쌓이면 풀포기는 눈에 덮인다
      for (const g of this.grass.children) if (g.userData.kind === 'grass_f') g.visible = look.season === 'spring' || look.season === 'summer';
    }
  }

  /** night: 0(낮)~1(밤) — 가로등과 창문 불빛 */
  setNight(n) {
    if (Math.abs(n - this.night) < 0.01 && this._nightInit) return;
    this._nightInit = true; this.night = n;
    this.glowMat.opacity = n * 0.55;
    const lg = getMat('lampglass'); if (lg) { lg.emissive = lg.emissive || new THREE.Color(); lg.emissive.setRGB(1, 0.86, 0.4).multiplyScalar(n * 0.9); }
    const w = getMat('window'); if (w) { w.emissive.setRGB(1, 0.82, 0.36).multiplyScalar(n * 0.95); }
  }

  shake(i, power = 1) { const g = this.objs.get(i); if (g) this.anims.push({ g, t: 0, power, base: g.rotation.z }); }
  bump(i) { const g = this.objs.get(i); if (g) this.anims.push({ g, t: 0, power: 0, bump: true, sy: g.scale.y }); }

  update(dt, time, fx, fz) {
    FX.time.value = time;
    this.terrain.update(time);
    this.terrain.setLight(this.stage.waterLight,this.stage.light.wet);
    for (let k = this.anims.length - 1; k >= 0; k--) {
      const a = this.anims[k]; a.t += dt;
      if (a.bump) { const s = 1 + Math.sin(Math.min(1, a.t / 0.25) * Math.PI) * 0.18; a.g.scale.y = a.sy * s; if (a.t > 0.25) { a.g.scale.y = a.sy; this.anims.splice(k, 1); } continue; }
      const d = Math.max(0, 1 - a.t / 0.7);
      a.g.rotation.z = a.base + Math.sin(a.t * 34) * 0.07 * d * a.power;
      if (a.t > 0.7) { a.g.rotation.z = a.base; this.anims.splice(k, 1); }
    }
    // 화면 밖의 것은 그리지 않는다
    for (const g of this.chunks) { const b = g.userData.box; g.visible = b[2] > fx - 21 && b[0] < fx + 21 && b[3] > fz - 36 && b[1] < fz + 12; }
    for (const [, g] of this.objs) {
      const dx = g.position.x - fx, dz = g.position.z - fz;
      g.visible = dx > -19 && dx < 19 && dz > -34 && dz < 11;
    }
    for (const [, g] of this.marks) { const dx = g.position.x - fx, dz = g.position.z - fz; g.visible = dx > -19 && dx < 19 && dz > -34 && dz < 11; }
    for (const [, g] of this.bldObjs) { const dx = g.position.x - fx, dz = g.position.z - fz; g.visible = dx > -24 && dx < 24 && dz > -38 && dz < 14; }
    this.updateFade();
  }

  /** 주인공이 건물이나 나무 뒤(북쪽)에 서 있으면 그것을 비쳐 보이게 한다 */
  updateFade() {
    const p = this.hooks.playerPos ? this.hooks.playerPos() : null;
    for (const [, g] of this.bldObjs) {
      const b = g.userData.b;
      const reach = b.type === 'house' ? 4.4 : 5.2;          // 건물 높이만큼 뒤쪽(북쪽)이 가려진다
      const on = !!p && b && this.hooks.buildingLook(b) && p.x > b.x - 0.8 && p.x < b.x + b.w + 0.8 && p.z < b.y + 0.4 && p.z > b.y - reach;
      setFade(g, on);
    }
    if (!p) return;
    const px = Math.floor(p.x), pz = Math.floor(p.z);
    const want = new Set();
    for (let dy = 1; dy <= 3; dy++) for (let dx = -1; dx <= 1; dx++) {
      const i = (pz + dy) * MAP_W + px + dx, g = this.objs.get(i);
      if (!g) continue;
      const o = g.userData.o;
      const tall = (o.t === 'tree' && o.stage >= 2) || (o.t === 'fix' && o.kind === 'bigtree');
      if (!tall) continue;
      const ddx = Math.abs(g.position.x - p.x), ddz = g.position.z - p.z;
      const reach = o.kind === 'bigtree' ? 3.6 : 2.7, wide = o.kind === 'bigtree' ? 2.2 : 1.05;
      if (ddx < wide && ddz > 0.35 && ddz < reach) want.add(g);
    }
    if (this.fadedObjs) for (const g of this.fadedObjs) if (!want.has(g)) setFade(g, false);
    for (const g of want) setFade(g, true);
    this.fadedObjs = want;
  }

  setVisible(v) { this.root.visible = v; }
}
