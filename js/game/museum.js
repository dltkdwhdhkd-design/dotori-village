// 로비의 세 관람로는 수족관, 곤충 생태원, 화석관으로 이어진다.
import * as THREE from 'three';
import { make, patchMaterial } from '../gfx/models.js';
import { G } from './game.js';
import { S } from './state.js';
import { FISH, BUGS, FISH_BY_ID, BUG_BY_ID, FOSSILS } from '../data/items.js';
import { NPCS } from '../data/villagers.js';
import { TAU, el } from '../core/util.js';
import { UI } from '../ui/ui.js';
import { decorateMuseum, tankWindow, tankHabitat, habitatDecor } from './museumDesign.js';
import { aquariumHabitats } from '../data/aquarium.js';
import { observeSchool } from './museumWatch.js';
import { exhibitSurface } from '../gfx/water.js';

const lam = (color, o = {}) => patchMaterial(new THREE.MeshLambertMaterial({ color, ...o }));
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
  update(dt) { this.t += dt; if(this.room.waterClock)this.room.waterClock.value=this.t;for (const e of this.list) if (e.move) e.move(e, this.t, dt); }
  probe(p) {
    const f = p.front(0.75);
    let best = null, bd = 1.05;
    for (const e of this.list) { if (!e.name) continue; const d = Math.hypot(e.x - f.x, e.z - f.z); if (d < bd) { bd = d; best = e; } }
    return best ? { label: `${best.name} 살펴보기`, act: best.act || (() => G.hooks.exhibit(best.name, best.fact || '설명이 아직 없다.')) } : null;
  }
}
const flap = (m, t, speed, amp = 0.7) => { const P = m.userData.parts; if (P && P.wing_L) { const a = Math.sin(t * speed) * amp + 0.15; P.wing_L.rotation.z = a; P.wing_R.rotation.z = -a; } };

// ---------------------------------------------------------------- 수조
/** 벽에 붙은 큰 수조. 반환값: 물고기가 헤엄칠 공간 */
function wallTank(room, g, x0, x1, title, water, o = {}) {
  const z0 = o.z0 ?? 0.12, z1 = z0+(o.depth || 1.6), y0 = 0.5, y1 = o.top || 1.85;
  const w = x1 - x0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  box(g, w + 0.16, y0, z1 - z0 + 0.16, cx, y0 / 2, cz, lam(0x8a6a48));                      // 받침
  box(g, w, 0.06, z1 - z0, cx, y0 + 0.03, cz, lam(o.sand || 0xe6d6a6));                      // 바닥 모래
  box(g, w, y1 - y0, 0.04, cx, (y0 + y1) / 2, z0 + 0.02, lam(o.back || 0x2f7f9a));            // 뒤판
  const window=tankWindow(w-.05,y1-y0-.04,room.id==='m_sea',o.theme);
  window.position.set(cx,(y0+y1)/2,z0+.048);g.add(window);
  const wm = lam(water, { transparent: true, opacity: 0.16, depthWrite: false });
  const vol = box(g, w - 0.02, y1 - y0 - 0.1, z1 - z0 - 0.04, cx, (y0 + y1) / 2 - 0.03, cz, wm); vol.renderOrder = 3;
  exhibitSurface(room,cx,cz,w-.10,z1-z0-.10,y1-.075,water);
  const fm = lam(0xf3ead2);
  for (const x of [x0, x1]) box(g, 0.08, y1 - y0, 0.08, x, (y0 + y1) / 2, z1, fm);          // 앞 기둥
  box(g, w + 0.08, 0.08, 0.08, cx, y1, z1, fm);                                                // 위는 열려 있어 내려다보인다
  tankHabitat(room,x0,x1,z0,z1,y0,y1,room.id==='m_sea',o.theme);
  if(w>12)for(let i=1;i<5;i++){
    const x=x0+w*i/5;
    box(g,.034,y1-y0,.05,x,(y0+y1)/2,z1,fm);
  }
  const sg = signMesh(title, Math.min(1.7, w * 0.6), 0.26); sg.position.set(cx, y0 * 0.5, z1 + 0.09); g.add(sg);
  room.block(Math.floor(x0), Math.floor(z0), Math.ceil(x1) - 1, Math.ceil(z1) - 1);
  return { x0: x0 + 0.25, x1: x1 - 0.25, z0: z0 + 0.3, z1: z1 - 0.25, y0: y0 + 0.2, y1: y1 - 0.25, front: z1 + 0.4 };
}
/** 바닥에 놓인 얕은 수조(위에서 들여다본다): 게·거북·넙치처럼 바닥에 사는 것들 */
function pool(room, g, x0, z0, x1, z1, title, water) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, h = 0.5;
  const rim = lam(0x9a7a56);
  box(g, x1 - x0, 0.1, z1 - z0, cx, 0.05, cz, lam(0xe6d6a6));
  box(g, x1 - x0, h, 0.12, cx, h / 2, z0 + 0.06, rim); box(g, x1 - x0, h, 0.12, cx, h / 2, z1 - 0.06, rim);
  box(g, 0.12, h, z1 - z0, x0 + 0.06, h / 2, cz, rim); box(g, 0.12, h, z1 - z0, x1 - 0.06, h / 2, cz, rim);
  exhibitSurface(room,cx,cz,x1-x0-.20,z1-z0-.20,h-.10,water);
  const sg = signMesh(title, 1.5, 0.26); sg.rotation.x = -0.5; sg.position.set(cx, h + 0.16, z1 + 0.02); g.add(sg);
  room.block(Math.floor(x0), Math.floor(z0), Math.ceil(x1) - 1, Math.ceil(z1) - 1);
  return { x0:x0+.4,x1:x1-.4,z0:z0+.4,z1:z1-.4,y0:.18,y1:.32,front:z1+.35 };
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
    q.zT = (q.zT ?? 0) - dt;                         // 수조 안쪽과 앞쪽 사이도 오간다: 가끔 새 깊이를 골라 비스듬히 헤엄쳐 간다
    if (q.zT <= 0) { q.zT = 3 + Math.random() * 5; q.zt = tk.z0 + (tk.z1 - tk.z0) * Math.random(); }
    const vz = Math.max(-0.14, Math.min(0.14, ((q.zt ?? q.tz) - q.tz) * 0.5));
    q.tz += vz * dt;
    const want = Math.atan2(-vz, q.dir * q.sp);      // 가는 쪽으로 머리를 돌린다(모델의 머리는 +X)
    let dA = want - q.turn; dA -= Math.round(dA / TAU) * TAU;
    q.turn += dA * Math.min(1, dt * 4);
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

function galleryGuide(ex,x,z,title,description,specimens,actors) {
  const g=ex.room.group;
  box(g,.78,.68,.43,x,.34,z,lam(0x47605b));
  const s=signMesh(title,1.45,.48,'#304b4d','#fff0c9');s.position.set(x,.83,z+.03);s.rotation.x=-.48;g.add(s);
  ex.room.block(Math.floor(x),Math.floor(z));
  ex.list.push({name:title,x,z:z+.36,m:s,act:()=>{
    const page=el('div','museum-guide');page.append(el('p','',description));
    if(specimens){
      page.append(el('p','note',specimens.length?'전시 중인 표본 '+specimens.length+'종':'첫 기증품을 기다리고 있어요.'));
      if(actors?.length){
        const b=el('button','btn','수조 가까이 관찰하기');b.onclick=()=>{UI.closePanel();observeSchool(ex.room,title,actors);};page.append(b);
      }
      for(const sp of specimens){
        const b=el('button','btn',sp.name);b.onclick=()=>{UI.closePanel();G.hooks.exhibit(sp.name,sp.fact);};page.append(b);
      }
    }
    UI.openPanel(title,page);
  }});
}

// ---------------------------------------------------------------- 전시관: 수족관
function setupAquarium(room,water) {
  const g=room.group,ex=new Exhibits(room),sea=water==='sea';
  const got=FISH.filter(sp=>sp.water===water && S.museum.fish.includes(sp.id));
  for(const habitat of aquariumHabitats(water,got)){
    const {id,name,detail,species,bounds,color}=habitat,[x0,x1,z0,depth,top]=bounds;
    const open=id==='pond'||id==='sand';
    const tk=open?pool(room,g,x0,z0,x1,z0+depth,name,color):wallTank(room,g,x0,x1,name,color,{z0,depth,top,back:color,theme:id});
    habitatDecor(room,id,bounds);
    const actors=[];
    species.forEach((sp,i)=>{
      const floor=sp.look.view==='top' && !['jelly','turtle','ray'].includes(sp.look.f);
      const scale=id==='ocean'?1.13:id==='drift'?1.36:open?.68:.82;
      const e=floor?crawler(ex,sp,{...tk,y:open?.14:.60},i,scale):swimmer(ex,sp,tk,i,Math.min(6,species.length),scale);
      if(sp.look.f==='jelly'){
        const move=e.move;e.sp=.13;e.move=(q,t,dt)=>{move(q,t,dt);q.m.position.y+=.15*Math.sin(t*1.7);q.m.scale.y=scale*(1+.14*Math.sin(t*2.4));};
      }
      e.species=sp.id;e.habitat=id;actors.push(e);
    });
    galleryGuide(ex,Math.floor(x0+1)+.5,Math.ceil(z0+depth)+.55,name,detail,species,actors);
  }
  galleryGuide(ex,room.w/2+2.5,room.h-2.5,sea?'바다 생물 도감':'민물 생물 도감',
    sea?'뒤편은 대양·깊은 층·해파리, 가운데는 연안·암초, 입구 양쪽은 모래 바닥과 갯벌이에요. 각 수조의 팻말에서 기증한 생물을 가까이 관찰할 수 있어요.':'뒤편 왼쪽부터 강 상류·중류·하류예요. 남서쪽은 연못, 남동쪽은 강어귀예요. 오른쪽 뒤 문은 대양 전시실로 이어져요.',got);
  const total=FISH.filter(sp=>sp.water===water).length;
  addBoard(ex,room,g,.5,room.h-1.5,()=>`이 전시실의 기증 생물 ${got.length} / ${total}종. 각 수조의 관찰대에서 움직임을 살펴볼 수 있다.`);
  return ex;
}

// ---------------------------------------------------------------- 전시관: 곤충관(온실 정원)
function setupBugHall(room) {
  const g = room.group, ex = new Exhibits(room), W = room.w, H = room.h;
  const glass=room.id==='m_butterfly';
  const livesInGlass=b=>b.where==='flower' || (b.where==='air' && b.look.f==='butterfly' && !/^(moth|saturn|hawk|lantern)$/.test(b.look.w||''));
  const species=BUGS.filter(b=>livesInGlass(b)===glass);
  const got=species.filter(b=>S.museum.bug.includes(b.id));
  const by = (...ws) => got.filter((b) => ws.includes(b.where));
  // 뒤쪽 구석의 나무 두 그루(풍경), 그리고 줄기에 붙어 사는 곤충이 잘 보이도록 세운 통나무 다섯 개
  for (const [x, z, name] of [[1.2, 0.9, 'tree_fruit'], [W - 1.2, 0.9, 'tree_pine']]) { const t = make(name); t.scale.setScalar(0.7); if (t.userData.parts && t.userData.parts.snow) t.userData.parts.snow.visible = false; t.position.set(x, 0, z); g.add(t); room.block(Math.floor(x), Math.floor(z)); }
  const bark = lam(0x8a5a3a), cut = lam(0xd9b98a);
  const logs = glass ? [] : [3.4, 6.2, 9.0, 12.2, 15.6,18.5].map((x, i) => [x, 1.9 + (i % 2) * 0.8]);
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
  const rock = make('boulder1'); rock.position.set(W-6.4, 0, 6.6); g.add(rock); room.block(W-7, 6);
  by('rock', 'rainrock').forEach((sp, i) => { const m = make('bug_' + sp.id); m.position.set(W-6.6 + i * 0.6, i ? 0.02 : 0.52, 6.7 + i * 0.4); m.rotation.y = i * 2.2; ex.add({ name: sp.name, fact: sp.fact, m, x: W-6.5 + i * 0.5, z: 7.1 }); });
  // 꽃밭 둘: 꽃 위의 곤충
  const flowers = [];
  [[3.4,3.2],[W*.62,3.4],[W*.30,H*.60],[W*.63,H*.68]].forEach(([fx, fz], bi) => {
    for (let i = 0; i < (glass?13:6); i++) {
      const x=fx+Math.cos(i*2.4)*Math.sqrt(i)*.43,z=fz+Math.sin(i*2.4)*Math.sqrt(i)*.39;
      const f = make('flower_' + ['tulip', 'cosmos', 'pansy'][(i + bi) % 3], { tint: { petal: [0xe8463c, 0xf2c230, 0xffffff, 0xf08ab0, 0x8a6ad6, 0xf2903c][(i + bi * 2) % 6] } });
      f.position.set(x, 0, z); g.add(f); flowers.push([x, z]);
    }
  });
  by('flower').forEach((sp, i) => { const [x, z] = flowers[i % flowers.length]; const m = make('bug_' + sp.id); m.position.set(x, 0.42, z - 0.04); m.rotation.y = rnd(i, 31) * TAU; ex.add({ name: sp.name, fact: sp.fact, m, x, z }); });
  // 작은 연못: 물 위의 곤충
  const pond = new THREE.Mesh(new THREE.CircleGeometry(1.25, 28), lam(0x6ac0e0)); pond.rotation.x = -Math.PI / 2; pond.position.set(W - 2.2, 0.02, H - 2.4); g.add(pond);
  const pr = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.42, 28), lam(0x9a8a6a)); pr.rotation.x = -Math.PI / 2; pr.position.set(W - 2.2, 0.025, H - 2.4); g.add(pr);
  room.block(W-3,H-3);
  by('pond').forEach((sp, i) => {
    const m = make('bug_' + sp.id), a0 = i * 1.26;
    const e = { name: sp.name, fact: sp.fact, m, x: W - 2.2, z: H - 2.4 };
    e.move = (q, t) => { const a = a0 + Math.sin(t * 0.5 + i) * 0.6; q.x = W - 2.2 + Math.cos(a) * 0.7; q.z = H - 2.4 + Math.sin(a) * 0.6; q.m.position.set(q.x, 0.05, q.z); q.m.rotation.y = -a; };
    ex.add(e);
  });
  // 가로등: 밤에 불빛으로 모이는 것들이 그 둘레를 돈다
  const lamp = make('lamp'); lamp.scale.setScalar(0.8); lamp.position.set(6.2, 0, 6.2); g.add(lamp); room.block(6, 6);
  // 날아다니는 곤충: 꽃밭·연못·가로등 둘레를 맴돈다
  const anchors = { air: [[4,3.4],[W*.62,3.6],[W*.3,H*.6],[W*.63,H*.68],[W*.5,6.3]], shore: [[W - 2.2, H - 2.4]], light: [[6.2, 6.2]], glow: [[W - 2.2, H - 2.4]] };
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
      if (bf && !/^(moth|saturn|hawk|lantern)$/.test(sp.look.w || '')) { const P = q.m.userData.parts; if (P && P.wing_L) { const a = 0.5 + Math.sin((t + i) * 8) * 0.9; P.wing_L.rotation.z = a; P.wing_R.rotation.z = -a; } }   // 나비는 날개를 위로 높이 쳐올린다(아랫면이 보인다)
      else flap(q.m, t + i, bf ? 9 : 40, bf ? 0.75 : 0.5);
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
  galleryGuide(ex,W/2+2.5,H-2.5,glass?'온실 관찰 일지':'곤충 생태 지도',glass?'꽃 위에 앉은 곤충과 정원을 나는 나비를 찾아보세요.':'뒤편은 수액 숲, 동쪽은 잠자리 연못이에요. 오른쪽 뒤의 문은 나비 온실로 이어져요.',got);
  addBoard(ex,room,g,.5,H-1.5,()=>`이 전시실에는 ${got.length} / ${species.length}종이 살고 있다. 기증한 곤충은 서식지에 따라 생태원과 나비 온실로 간다.`);
  return ex;
}

// ---------------------------------------------------------------- 전시관: 화석관
function setupFossilHall(room) {
  const g = room.group, ex = new Exhibits(room);
  const spots={trilobite:[3,3],ammonite:[6,3],fish:[3,6],fern:[6,6],amber:[3,9],egg:[10,2],
    trex:[13,2],horn:[16,2],plate:[19,2],footprint:[21,5],tusk:[21,9],megalodon:[21,12]};
  const stone=lam(0x9c8d7e),top=lam(0x3f5253);
  FOSSILS.forEach((f, i) => {
    const [tx, ty] = spots[f[0]], x = tx + 0.5, z = ty + 0.5, has = S.museum.fossil.includes(f[0]);
    box(g,.98,.59,.94,x,.295,z,stone);box(g,1.04,.055,1.0,x,.615,z,top);
    room.block(tx, ty);
    if (has) { const m = make('fossil_' + f[0]); m.scale.setScalar(1.65); m.position.set(x, 0.65, z); g.add(m); ex.list.push({ name: f[1], fact: f[3], x, z, m }); }
    else { const s = signMesh('?', 0.3, 0.3, '#efe6d2', '#b0a48c'); s.rotation.x = -0.6; s.position.set(x, 0.72, z + 0.1); g.add(s); ex.list.push({ name: '빈 전시대', fact: '아직 비어 있다. 화석을 캐서 두루 관장에게 감정받고 기증하면 여기에 놓인다.', x, z, m: s }); }
  });
  const island=new THREE.Mesh(new THREE.CylinderGeometry(1,1,.28,48),top);
  island.position.set(13,.14,7.4);island.scale.set(5.5,1,1.52);g.add(island);
  const sk=make('gallery_sauropod');sk.position.set(13.5,.28,7.4);g.add(sk);room.block(8,6,17,8);
  ex.list.push({name:'긴목공룡 복원 골격',fact:'박물관 개관을 위해 만든 실물 모형이에요. 꼬리에서 목까지 이어지는 척추를 따라 한 바퀴 걸어 보세요. 기증한 진품은 둘레 전시대에 놓여요.',x:13.5,z:9.1,m:sk});
  galleryGuide(ex,10.5,13.5,'화석 전시 목록','서쪽은 옛 바다와 숲, 북쪽은 공룡, 동쪽은 거대 동물 전시예요. 가운데 긴목공룡은 복원 모형이에요.',
    FOSSILS.filter(f=>S.museum.fossil.includes(f[0])).map(f=>({name:f[1],fact:f[3]})));
  return ex;
}

// ---------------------------------------------------------------- 방 정의
export const HALL_KO={museum:'박물관 중앙 로비',m_fossil:'화석관 · 긴목공룡 홀',m_bug:'곤충관 · 숲 생태원',m_butterfly:'곤충관 · 나비 온실',m_fresh:'수족관 · 민물 전시실',m_sea:'수족관 · 대양 전시실'};

function lobby(room){
  const ex=new Exhibits(room);
  galleryGuide(ex,13.5,11.5,'박물관 안내도','서쪽 초록 문은 곤충 생태원과 나비 온실, 가운데 문은 화석관, 동쪽 푸른 문은 민물과 대양 수족관으로 이어져요. 기증과 화석 감정은 왼쪽 안내대의 두루 관장이 맡고 있어요.');
  return ex;
}
const wings={
  m_fossil:[26,18,'wall_cream','floor_stone',setupFossilHall,'museum'],
  m_bug:[24,16,'wall_forest','floor_grass',setupBugHall,'museum',{x:21.5,to:'m_butterfly',label:'나비 온실'}],
  m_butterfly:[20,14,'wall_forest','floor_grass',setupBugHall,'m_bug'],
  m_fresh:[30,21,'wall_stripe','floor_tile',r=>setupAquarium(r,'fresh'),'museum',{x:27.5,to:'m_sea',label:'대양 전시실'}],
  m_sea:[32,24,'wall_stripe','floor_tile',r=>setupAquarium(r,'sea'),'m_fresh']
};

export function museumSpec(id = 'museum') {
  const config=wings[id];
  let spec;
  if(config){
    const [w,h,wall,floor,setup,exitTo,door]=config;
    spec={id,w,h,wall,floor,setup,exitTo,items:[],portals:door?[door]:[]};
  }else spec={
    id:'museum',w:22,h:14,wall:'wall_cream',floor:'floor_stone',setup:lobby,
    items:[{id:'p_desk',x:6,y:5,w:2,d:1,r:0},{id:'p_plant',x:5,y:5,r:0},{id:'p_plant',x:8,y:5,r:0}],
    portals:[{x:3.5,to:'m_bug',label:'곤충관'},{x:11,to:'m_fossil',label:'화석관'},{x:18.5,to:'m_fresh',label:'수족관'}],
    npcDefs:[{model:'npc_duru',name:NPCS.duru.name,x:7,z:4.65,fixed:true,talk:()=>G.hooks.talkDuru()}],
  };
  const setup=spec.setup;
  return {...spec,cameraDepth:8,setup:r=>{decorateMuseum(r,signMesh);return setup(r);}};
}
