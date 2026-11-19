// 박물관: 로비와 네 전시관. 기증한 생물이 전시관에서 살아 움직이고, 앞에서 Space를 누르면 설명이 나온다.
//   로비(museum) ─ 화석관(m_fossil) · 곤충관(m_bug) · 민물 수족관(m_fresh) · 바다 수족관(m_sea)
// 방 사이의 문은 rooms.js 의 portals, 전시물은 여기서 만든다(spec.setup).
import * as THREE from 'three';
import { make, patchMaterial } from '../gfx/models.js';
import { G } from './game.js';
import { S } from './state.js';
import { FISH, BUGS, FISH_BY_ID, BUG_BY_ID, FOSSILS } from '../data/items.js';
import { NPCS } from '../data/villagers.js';
import { TAU } from '../core/util.js';

const lam = (color, o = {}) => patchMaterial(new THREE.MeshLambertMaterial({ color, ...o }));
const WATER_FRESH = 0x7fd0c8, WATER_SEA = 0x4aa8e0;
/** 늘 같은 자리에 놓이도록, 번호로 정해지는 난수 */
const rnd = (i, k = 1) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };

function box(g, w, h, d, x, y, z, m) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); return b; }

/** 글자가 적힌 작은 팻말 */
export function signMesh(text, w = 1.5, h = 0.34, bg = '#fff3d6', fg = '#6b4a2e') {
  const c = document.createElement('canvas'); c.width = 384; c.height = Math.round(384 * h / w);
  const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height);
  x.strokeStyle = '#b8935e'; x.lineWidth = 8; x.strokeRect(4, 4, c.width - 8, c.height - 8);
  x.fillStyle = fg; x.font = `${Math.round(c.height * 0.56)}px "Jua","Malgun Gothic","Apple SD Gothic Neo",sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, c.width / 2, c.height / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t }));
}

// ---------------------------------------------------------------- 전시물 공통
/** 전시관 하나의 전시물 묶음: 움직이고(update), 앞에 선 사람에게 설명한다(probe) */
class Exhibits {
  constructor(room) { this.room = room; this.list = []; this.t = 0; }
  /** e: { name, fact, x, z, m, move(e, t, dt) } */
  add(e) { this.list.push(e); this.room.group.add(e.m); return e; }
  update(dt) { this.t += dt; for (const e of this.list) if (e.move) e.move(e, this.t, dt); }
  probe(p) {
    const f = p.front(0.75);
    let best = null, bd = 1.05;
    for (const e of this.list) { if (!e.name) continue; const d = Math.hypot(e.x - f.x, e.z - f.z); if (d < bd) { bd = d; best = e; } }
    return best ? { label: `${best.name} 살펴보기`, act: () => G.hooks.exhibit(best.name, best.fact || '설명이 아직 없다.') } : null;
  }
}
const flap = (m, t, speed, amp = 0.7) => { const P = m.userData.parts; if (P && P.wing_L) { const a = Math.sin(t * speed) * amp + 0.15; P.wing_L.rotation.z = a; P.wing_R.rotation.z = -a; } };

// ---------------------------------------------------------------- 수조
/** 벽에 붙은 큰 수조. 반환값: 물고기가 헤엄칠 공간 */
function wallTank(room, g, x0, x1, title, water, o = {}) {
  const z0 = 0.12, z1 = o.depth || 1.6, y0 = 0.5, y1 = o.top || 1.85;
  const w = x1 - x0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  box(g, w + 0.16, y0, z1 - z0 + 0.16, cx, y0 / 2, cz, lam(0x8a6a48));                      // 받침
  box(g, w, 0.06, z1 - z0, cx, y0 + 0.03, cz, lam(o.sand || 0xe6d6a6));                      // 바닥 모래
  box(g, w, y1 - y0, 0.04, cx, (y0 + y1) / 2, z0 + 0.02, lam(o.back || 0x2f7f9a));            // 뒤판
  const wm = lam(water, { transparent: true, opacity: 0.3, depthWrite: false });
  const vol = box(g, w - 0.02, y1 - y0 - 0.1, z1 - z0 - 0.04, cx, (y0 + y1) / 2 - 0.03, cz, wm); vol.renderOrder = 3;
  const fm = lam(0xf3ead2);
  for (const x of [x0, x1]) box(g, 0.08, y1 - y0, 0.08, x, (y0 + y1) / 2, z1, fm);          // 앞 기둥
  box(g, w + 0.08, 0.08, 0.08, cx, y1, z1, fm);                                                // 위는 열려 있어 내려다보인다
  for (let i = 0; i < Math.round(w * 1.2); i++) {                                            // 물풀과 돌
    const px = x0 + 0.3 + rnd(i, x0) * (w - 0.6), pz = z0 + 0.25 + rnd(i, 7) * (z1 - z0 - 0.5);
    if (i % 3 === 0) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12 + rnd(i, 3) * 0.1), lam(0x8a8a82)); r.position.set(px, y0 + 0.12, pz); r.scale.y = 0.6; g.add(r); }
    else { const h = 0.3 + rnd(i, 5) * 0.5; const s = new THREE.Mesh(new THREE.ConeGeometry(0.05, h, 5), lam(o.weed || 0x4fae6a)); s.position.set(px, y0 + h / 2 + 0.04, pz); g.add(s); }
  }
  const sg = signMesh(title, Math.min(1.7, w * 0.6), 0.26); sg.position.set(cx, y0 * 0.5, z1 + 0.09); g.add(sg);
  room.block(Math.floor(x0), 0, Math.ceil(x1) - 1, Math.ceil(z1) - 1);
  return { x0: x0 + 0.25, x1: x1 - 0.25, z0: z0 + 0.3, z1: z1 - 0.25, y0: y0 + 0.2, y1: y1 - 0.25, front: z1 + 0.4 };
}
/** 바닥에 놓인 얕은 수조(위에서 들여다본다): 게·거북·넙치처럼 바닥에 사는 것들 */
function pool(room, g, x0, z0, x1, z1, title, water) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, h = 0.5;
  const rim = lam(0x9a7a56);
  box(g, x1 - x0, 0.1, z1 - z0, cx, 0.05, cz, lam(0xe6d6a6));
  box(g, x1 - x0, h, 0.12, cx, h / 2, z0 + 0.06, rim); box(g, x1 - x0, h, 0.12, cx, h / 2, z1 - 0.06, rim);
  box(g, 0.12, h, z1 - z0, x0 + 0.06, h / 2, cz, rim); box(g, 0.12, h, z1 - z0, x1 - 0.06, h / 2, cz, rim);
  const w = box(g, x1 - x0 - 0.2, 0.02, z1 - z0 - 0.2, cx, h - 0.1, cz, lam(water, { transparent: true, opacity: 0.32, depthWrite: false })); w.renderOrder = 3;
  const sg = signMesh(title, 1.5, 0.26); sg.rotation.x = -0.5; sg.position.set(cx, h + 0.16, z1 + 0.02); g.add(sg);
  room.block(Math.floor(x0), Math.floor(z0), Math.ceil(x1) - 1, Math.ceil(z1) - 1);
  return { x0: x0 + 0.4, x1: x1 - 0.4, z0: z0 + 0.4, z1: z1 - 0.4, y: 0.12 };
}

/** 수조 안을 좌우로 헤엄치는 물고기 */
function swimmer(ex, sp, tk, i, n, scale) {
  const m = make('fish_' + sp.id);
  const len = (sp.look.len || 0.7) * scale;
  m.scale.setScalar(scale);
  const e = { name: sp.name, fact: sp.fact, m, x: tk.x0 + (tk.x1 - tk.x0) * rnd(i, 1), z: tk.front, dir: rnd(i, 2) < 0.5 ? 1 : -1, sp: (0.25 + rnd(i, 3) * 0.3) * (len > 0.6 ? 1.3 : 1),
    y: tk.y0 + (tk.y1 - tk.y0) * ((i % n) + 0.5) / n * 0.9 + rnd(i, 4) * 0.08, tz: tk.z0 + (tk.z1 - tk.z0) * rnd(i, 5), ph: rnd(i, 6) * 9, turn: 0, half: len * 0.5 };
  e.move = (q, t, dt) => {
    q.x += q.dir * q.sp * dt;
    if (q.x > tk.x1 - q.half) { q.x = tk.x1 - q.half; q.dir = -1; } else if (q.x < tk.x0 + q.half) { q.x = tk.x0 + q.half; q.dir = 1; }
    const want = q.dir > 0 ? 0 : Math.PI;
    q.turn += (want - q.turn) * Math.min(1, dt * 4);
    q.m.rotation.y = q.turn + Math.sin(t * 3 + q.ph) * 0.08;
    q.m.position.set(q.x, q.y + Math.sin(t * 0.8 + q.ph) * 0.05, q.tz);
  };
  return ex.add(e);
}
/** 얕은 수조 바닥을 느릿느릿 돌아다니는 것 */
function crawler(ex, sp, pl, i, scale, prefix = 'fish_') {
  const m = make(prefix + sp.id); m.scale.setScalar(scale);
  const yaw0 = sp.look.f === 'flat' ? -Math.PI / 2 : 0;      // 넙치·가자미는 모델의 머리가 옆(+X)을 향해 있어서, 가는 쪽으로 머리가 오게 돌려 놓는다
  const e = { name: sp.name, fact: sp.fact, m, x: pl.x0 + (pl.x1 - pl.x0) * rnd(i, 11), z: pl.z0 + (pl.z1 - pl.z0) * rnd(i, 12), a: rnd(i, 13) * TAU, wait: rnd(i, 14) * 4, go: 0, y: pl.y };
  e.move = (q, t, dt) => {
    if (q.go > 0) {
      q.go -= dt;
      const nx = q.x + Math.sin(q.a) * 0.22 * dt, nz = q.z + Math.cos(q.a) * 0.22 * dt;
      if (nx < pl.x0 || nx > pl.x1 || nz < pl.z0 || nz > pl.z1) { q.a += Math.PI * 0.7; q.go = 0; } else { q.x = nx; q.z = nz; }
    } else { q.wait -= dt; if (q.wait <= 0) { q.wait = 2 + rnd(i, Math.floor(t)) * 5; q.go = 1.5 + rnd(i, t) * 2; q.a += (rnd(i, t * 3) - 0.5) * 2.4; } }
    q.m.rotation.y = q.a + yaw0; q.m.position.set(q.x, q.y, q.z);
  };
  e.move(e, 0, 0);
  return ex.add(e);
}

function board(room, g, x, z, textFn) {
  box(g, 0.1, 1.0, 0.1, x, 0.5, z, lam(0x8a6a48));
  const s = signMesh('전시 현황', 0.9, 0.5); s.position.set(x, 1.15, z + 0.06); g.add(s);
  room.block(Math.floor(x), Math.floor(z));
  return { name: '전시 현황판', fact: '', x, z: z + 0.5, m: new THREE.Group(), get text() { return textFn(); } };
}
/** 현황판은 설명 대신 지금 숫자를 알려 준다 */
function addBoard(ex, room, g, x, z, textFn) {
  const b = board(room, g, x, z, textFn);
  Object.defineProperty(b, 'fact', { get: textFn });
  ex.add(b);
}

// ---------------------------------------------------------------- 전시관: 수족관
function setupAquarium(room, water) {
  const g = room.group, ex = new Exhibits(room), sea = water === 'sea';
  const got = FISH.filter((f) => f.water === water && S.museum.fish.includes(f.id));
  const flat = got.filter((f) => f.look.view === 'top'), swim = got.filter((f) => f.look.view !== 'top');
  const wcol = sea ? WATER_SEA : WATER_FRESH;
  if (sea) {
    const tk = wallTank(room, g, 0.5, room.w - 0.5, '먼바다와 갯바위', wcol, { depth: 2.8, top: 2.0, back: 0x1f5f8f, sand: 0xe8dcc0, weed: 0x3f9a8a });
    swim.forEach((sp, i) => swimmer(ex, sp, tk, i, 6, sp.look.len > 1.4 ? 0.5 : 0.62));
    const pl = pool(room, g, 4, 5, room.w - 4, 7.4, '모래 바닥', wcol);
    flat.forEach((sp, i) => crawler(ex, sp, pl, i, 0.62));
  } else {
    const third = (room.w - 1) / 3;
    const names = [['upstream', '강 상류'], ['river', '강과 강어귀'], ['pond', '연못']];
    const tanks = names.map(([k, ko], i) => wallTank(room, g, 0.5 + third * i + 0.06, 0.5 + third * (i + 1) - 0.06, ko, wcol, { back: [0x3a8a8a, 0x3a8a6a, 0x4a7a5a][i] }));
    const where = (f) => (f.loc[0] === 'upstream' ? 0 : f.loc.includes('pond') && !f.loc.includes('river') ? 2 : f.loc[0] === 'pond' ? 2 : 1);
    const cnt = [0, 0, 0];
    swim.forEach((sp) => { const k = where(sp); swimmer(ex, sp, tanks[k], cnt[k]++, 5, 0.62); });
    const pl = pool(room, g, 3.5, 3.8, room.w - 3.5, 5.8, '얕은 물가', wcol);
    flat.forEach((sp, i) => crawler(ex, sp, pl, i, 0.6));
  }
  const all = FISH.filter((f) => f.water === water).length;
  addBoard(ex, room, g, 0.5, room.h - 1.5, () => `${sea ? '바닷물고기' : '민물고기'} ${got.length} / ${all}종이 전시되어 있다.${got.length === 0 ? ' 잡은 물고기를 두루 관장에게 기증하면 이 수조에서 헤엄친다.' : ''}`);
  return ex;
}

// ---------------------------------------------------------------- 전시관: 곤충관(온실 정원)
function setupBugHall(room) {
  const g = room.group, ex = new Exhibits(room), W = room.w, H = room.h;
  const got = BUGS.filter((b) => S.museum.bug.includes(b.id));
  const by = (...ws) => got.filter((b) => ws.includes(b.where));
  // 뒤쪽 구석의 나무 두 그루(풍경), 그리고 줄기에 붙어 사는 곤충이 잘 보이도록 세운 통나무 다섯 개
  for (const [x, z, name] of [[1.2, 0.9, 'tree_fruit'], [W - 1.2, 0.9, 'tree_pine']]) { const t = make(name); t.scale.setScalar(0.7); if (t.userData.parts && t.userData.parts.snow) t.userData.parts.snow.visible = false; t.position.set(x, 0, z); g.add(t); room.block(Math.floor(x), Math.floor(z)); }
  const bark = lam(0x8a5a3a), cut = lam(0xd9b98a);
  const logs = [3.4, 5.2, 7.0, 8.8, 10.6].map((x, i) => [x, 1.3 + (i % 2) * 0.5]);
  for (const [x, z] of logs) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 1.7, 12), bark); c.position.set(x, 0.85, z); g.add(c);
    const tp = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 12), cut); tp.position.set(x, 1.71, z); g.add(tp);
    room.block(Math.floor(x), Math.floor(z));
  }
  by('tree', 'shake').forEach((sp, i) => {
    const [tx, tz] = logs[i % logs.length], k = Math.floor(i / logs.length);
    const m = make('bug_' + sp.id); m.rotation.x = -Math.PI / 2; m.rotation.z = (rnd(i, 21) - 0.5) * 0.5;
    const x = tx + [0, -0.1, 0.1, -0.05, 0.07][k % 5], y = 0.32 + k * 0.3, z = tz + 0.3;
    m.position.set(x, y, z);
    ex.add({ name: sp.name, fact: sp.fact, m, x, z: z + 0.3 });
  });
  // 그루터기와 바위
  const stump = make('stump'); stump.position.set(2.5, 0, 5.5); g.add(stump); room.block(2, 5);
  by('stump').forEach((sp, i) => { const m = make('bug_' + sp.id); m.position.set(2.4 + i * 0.22, 0.3, 5.5 + i * 0.08); m.rotation.y = 1 + i * 2; ex.add({ name: sp.name, fact: sp.fact, m, x: 2.5, z: 5.9 }); });
  const rock = make('rock1'); rock.position.set(8.6, 0, 6.6); g.add(rock); room.block(8, 6);
  by('rock', 'rainrock').forEach((sp, i) => { const m = make('bug_' + sp.id); m.position.set(8.4 + i * 0.6, i ? 0.02 : 0.52, 6.7 + i * 0.4); m.rotation.y = i * 2.2; ex.add({ name: sp.name, fact: sp.fact, m, x: 8.5 + i * 0.5, z: 7.1 }); });
  // 꽃밭 둘: 꽃 위의 곤충
  const flowers = [];
  [[3.4, 3.2], [9.0, 3.4]].forEach(([fx, fz], bi) => {
    for (let i = 0; i < 6; i++) {
      const x = fx + (i % 3) * 0.55, z = fz + Math.floor(i / 3) * 0.5;
      const f = make('flower_' + ['tulip', 'cosmos', 'pansy'][(i + bi) % 3], { tint: { petal: [0xe8463c, 0xf2c230, 0xffffff, 0xf08ab0, 0x8a6ad6, 0xf2903c][(i + bi * 2) % 6] } });
      f.position.set(x, 0, z); g.add(f); flowers.push([x, z]);
    }
  });
  by('flower').forEach((sp, i) => { const [x, z] = flowers[i % flowers.length]; const m = make('bug_' + sp.id); m.position.set(x, 0.42, z - 0.04); m.rotation.y = rnd(i, 31) * TAU; ex.add({ name: sp.name, fact: sp.fact, m, x, z }); });
  // 작은 연못: 물 위의 곤충
  const pond = new THREE.Mesh(new THREE.CircleGeometry(1.25, 28), lam(0x6ac0e0)); pond.rotation.x = -Math.PI / 2; pond.position.set(W - 2.2, 0.02, H - 2.4); g.add(pond);
  const pr = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.42, 28), lam(0x9a8a6a)); pr.rotation.x = -Math.PI / 2; pr.position.set(W - 2.2, 0.025, H - 2.4); g.add(pr);
  by('pond').forEach((sp, i) => {
    const m = make('bug_' + sp.id), a0 = i * 1.26;
    const e = { name: sp.name, fact: sp.fact, m, x: W - 2.2, z: H - 2.4 };
    e.move = (q, t) => { const a = a0 + Math.sin(t * 0.5 + i) * 0.6; q.x = W - 2.2 + Math.cos(a) * 0.7; q.z = H - 2.4 + Math.sin(a) * 0.6; q.m.position.set(q.x, 0.05, q.z); q.m.rotation.y = -a; };
    ex.add(e);
  });
  // 가로등: 밤에 불빛으로 모이는 것들이 그 둘레를 돈다
  const lamp = make('lamp'); lamp.scale.setScalar(0.8); lamp.position.set(6.2, 0, 6.2); g.add(lamp); room.block(6, 6);
  // 날아다니는 곤충: 꽃밭·연못·가로등 둘레를 맴돈다
  const anchors = { air: [[4.0, 3.4], [9.5, 3.6], [6.5, 4.6], [2.2, 3.8], [11.2, 4.4]], shore: [[W - 2.2, H - 2.4]], light: [[6.2, 6.2]], glow: [[W - 2.2, H - 2.4]] };
  by('air', 'shore', 'light', 'glow').forEach((sp, i) => {
    const list = anchors[sp.where], [ax, az] = list[i % list.length];
    const m = make('bug_' + sp.id), bf = sp.look.f === 'butterfly';
    const r = 0.5 + rnd(i, 41) * 0.7, h = (sp.where === 'light' ? 1.3 : 0.7) + rnd(i, 42) * 0.5, w = (0.35 + rnd(i, 43) * 0.3) * (rnd(i, 44) < 0.5 ? 1 : -1), a0 = rnd(i, 45) * TAU;
    const e = { name: sp.name, fact: sp.fact, m, x: ax, z: az };
    e.move = (q, t) => {
      const a = a0 + t * w;
      q.x = ax + Math.cos(a) * r; q.z = az + Math.sin(a) * r * 0.75;
      q.m.position.set(q.x, h + Math.sin(t * 1.7 + i) * 0.12, q.z);
      q.m.rotation.y = Math.atan2(-Math.sin(a) * w, Math.cos(a) * w * 0.75);
      flap(q.m, t + i, bf ? 9 : 40, bf ? 0.75 : 0.5);
      const P = q.m.userData.parts; if (P && P.glow) P.glow.visible = Math.sin(t * 2 + i) > -0.2;
    };
    ex.add(e);
  });
  // 풀밭·길·모래밭의 곤충: 바닥에
  by('ground', 'path', 'sand', 'food').forEach((sp, i) => {
    const m = make('bug_' + sp.id);
    let x = 0, z = 0;
    for (let k = 0; k < 20; k++) { x = 1 + rnd(i, 51 + k) * (W - 2); z = 4.4 + rnd(i, 71 + k) * (H - 5.6); if (room.free(Math.floor(x), Math.floor(z)) && Math.hypot(x - (W - 2.2), z - (H - 2.4)) > 1.7 && Math.abs(x - W / 2) > 0.9) break; }
    const e = { name: sp.name, fact: sp.fact, m, x, z, a: rnd(i, 61) * TAU, hx: x, hz: z };
    e.move = (q, t) => { const hop = Math.max(0, Math.sin(t * 0.6 + i * 1.7) - 0.92) * 3; q.m.position.set(q.hx, 0.02 + hop, q.hz); q.m.rotation.y = q.a + Math.sin(t * 0.3 + i) * 0.5; };
    ex.add(e);
  });
  addBoard(ex, room, g, 0.5, H - 1.5, () => `곤충 ${got.length} / ${BUGS.length}종이 전시되어 있다.${got.length === 0 ? ' 잡은 곤충을 두루 관장에게 기증하면 이 정원에 풀어놓는다.' : ''}`);
  return ex;
}

// ---------------------------------------------------------------- 전시관: 화석관
function setupFossilHall(room) {
  const g = room.group, ex = new Exhibits(room);
  const spots = [[0, 1], [2, 1], [7, 1], [9, 1], [0, 3], [2, 3], [7, 3], [9, 3], [0, 5], [2, 5], [7, 5], [9, 5]];
  const stone = lam(0xd8d2c6), top = lam(0x6a4a8a);
  FOSSILS.forEach((f, i) => {
    const [tx, ty] = spots[i], x = tx + 0.5, z = ty + 0.5, has = S.museum.fossil.includes(f[0]);
    box(g, 0.8, 0.55, 0.8, x, 0.275, z, stone); box(g, 0.7, 0.04, 0.7, x, 0.57, z, top);
    room.block(tx, ty);
    if (has) { const m = make('fossil_' + f[0]); m.scale.setScalar(1.25); m.position.set(x, 0.6, z); g.add(m); ex.list.push({ name: f[1], fact: f[3], x, z, m }); }
    else { const s = signMesh('?', 0.3, 0.3, '#efe6d2', '#b0a48c'); s.rotation.x = -0.6; s.position.set(x, 0.72, z + 0.1); g.add(s); ex.list.push({ name: '빈 전시대', fact: '아직 비어 있다. 화석을 캐서 두루 관장에게 감정받고 기증하면 여기에 놓인다.', x, z, m: s }); }
  });
  const sk = make('p_skeleton'); sk.position.set(5, 0, 2.5); g.add(sk); room.block(4, 2, 5, 2);
  const n = S.museum.fossil.length;
  ex.list.push({ name: '공룡 뼈대', fact: `화석 ${n} / ${FOSSILS.length}점이 전시되어 있다.${n >= FOSSILS.length ? ' 전시대가 모두 찼다!' : ''}`, x: 5, z: 3.2, m: sk });
  return ex;
}

// ---------------------------------------------------------------- 방 정의
export const HALL_KO = { museum: '로비', m_fossil: '화석관', m_bug: '곤충관', m_fresh: '민물 수족관', m_sea: '바다 수족관' };

export function museumSpec(id = 'museum') {
  if (id === 'm_fossil') return { id, exitTo: 'museum', w: 10, h: 7, wall: 'wall_cream', floor: 'floor_stone', items: [], setup: setupFossilHall };
  if (id === 'm_bug') return { id, exitTo: 'museum', w: 14, h: 9, wall: 'wall_forest', floor: 'floor_grass', items: [], setup: setupBugHall };
  if (id === 'm_fresh') return { id, exitTo: 'museum', w: 13, h: 7, wall: 'wall_stripe', floor: 'floor_tile', items: [], setup: (r) => setupAquarium(r, 'fresh') };
  if (id === 'm_sea') return { id, exitTo: 'museum', w: 14, h: 9, wall: 'wall_stripe', floor: 'floor_tile', items: [], setup: (r) => setupAquarium(r, 'sea') };
  return {
    id: 'museum', w: 12, h: 7, wall: 'wall_cream', floor: 'floor_stone',
    items: [{ id: 'p_desk', x: 5, y: 1, w: 2, d: 1, r: 0 }, { id: 'p_plant', x: 0, y: 6, r: 0 }, { id: 'p_plant', x: 11, y: 6, r: 0 }, { id: 'p_plant', x: 0, y: 2, r: 0 }, { id: 'p_plant', x: 11, y: 2, r: 0 }],
    portals: [{ x: 1.5, to: 'm_fossil', label: '화석관' }, { x: 3.9, to: 'm_bug', label: '곤충관' }, { x: 8.1, to: 'm_fresh', label: '민물 수족관' }, { x: 10.5, to: 'm_sea', label: '바다 수족관' }],
    npcDefs: [{ model: 'npc_duru', name: NPCS.duru.name, x: 6, z: 0.6, fixed: true, talk: () => G.hooks.talkDuru() }],
  };
}
