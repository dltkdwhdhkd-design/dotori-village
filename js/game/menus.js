// 창: 가방, 도감, 지도, 설정, 우체통, 창고, 게시판, 타이틀 화면
import { journal } from './fieldwork.js';
import { G, runScript, save, burst, refreshTime, worldInfo } from './game.js';
import { VERSION } from '../core/version.js';
import { G as T, MAP_W, MAP_H } from '../world/mapgen.js';
import { S, Settings, saveSettings, addItem, canAdd, removeAt, hasItem, addMoney, exportSave, importSave, deleteSave, INV_SIZE, hasSave } from './state.js';
import { ITEMS, FISH, BUGS, FOSSILS, FISH_BY_ID, BUG_BY_ID, itemName, sellPrice, FRUIT_KO } from '../data/items.js';
import { VILLAGERS, PERSONALITY } from '../data/villagers.js';
import { UI, Dialog, slotEl, itemRow, acorns } from '../ui/ui.js';
import { Sound } from '../core/audio.js';
import { Clock, dayKey, dateLabel, season, SEASON_KO, WEATHER_KO } from '../core/clock.js';
import { el, fmt, josa, rand } from '../core/util.js';
import { museumProgress } from './scripts.js';
import { track, openNote } from './quests.js';
import { lookEditor } from './lookui.js';
import { MODEL as LOOK_MODEL, defaultLook, lookOfModel } from './look.js';

import { placeOutside, designAllowed } from './island.js';
import { action } from './workshop.js';
const KIND_KO = { tool: '도구', fruit: '과일', shell: '조개', fish: '물고기', bug: '곤충', fossil: '화석', fossilid: '화석', furniture: '가구', wall: '벽지', floor: '바닥재', seed: '씨앗', sapling: '묘목', flower: '꽃', medicine: '약', misc: '잡동사니', parcel: '부탁받은 물건' };
const narr = (t) => Dialog.say('', t);

// ---------------------------------------------------------------- 가방
function frontTile() { const f = G.player.front(0.8); return { ...f, idx: f.ty * MAP_W + f.tx, o: G.village.obj(f.tx, f.ty) }; }
function canPlantAt(f) { if (G.visit) return false; const v = G.village; return (!f.o && v.terrainAt(f.tx, f.ty) === T.GRASS && v.buried[f.idx] == null && !v.doorAt(f.tx, f.ty - 1)) || (f.o && f.o.t === 'hole' && v.terrainAt(f.tx, f.ty) === T.GRASS); }

function bagActions(i, close, redraw) {
  const s = S.inv[i], it = ITEMS[s.id], p = G.player, acts = [];
  const add = (label, fn, cls = '') => acts.push([label, fn, cls]);
  const inVillage = !G.room, inHome = G.room && G.room.editable;
  if (it.kind === 'tool') add(S.player.tool === s.id ? '집어넣기' : '손에 들기', () => { p.equip(S.player.tool === s.id ? null : s.id); close(); }, 'go');
  if (it.kind === 'fruit') add('먹기', () => { removeAt(i); Sound.sfx('pick'); close(); p.do('joy', 0.7); UI.toast(`${josa(it.name, '을/를')} 먹었다. 아삭, 달다!`); });
  if (it.kind === 'medicine') add('먹기', () => { removeAt(i); S.player.stung = false; Sound.sfx('save'); close(); UI.toast('약을 먹었다. 부기가 가라앉는다.'); });
  if (inVillage && ['fruit', 'seed', 'sapling', 'flower'].includes(it.kind)) add('앞에 심기', () => {
    const f = frontTile();
    if (!canPlantAt(f)) { UI.toast('여기에는 심을 수 없다. 풀밭의 빈자리를 보고 서 보자.'); Sound.sfx('fail'); return; }
    removeAt(i);
    let o;
    if (it.kind === 'fruit') o = { t: 'tree', kind: 'fruit', fruit: s.id.slice(6), stage: 0, fruits: 0 };
    else if (it.kind === 'sapling') o = { t: 'tree', kind: it.tree, stage: 0 };
    else if (it.kind === 'seed') o = { t: 'flower', sp: it.sp, col: ['red', 'yellow', 'white'][Math.floor(rand() * 3)] };
    else o = { t: 'flower', sp: it.sp, col: it.col };
    G.village.set(f.tx, f.ty, o); track('plant');
    Sound.sfx('dig'); burst('dirt', f.tx + 0.5, 0.1, f.ty + 0.5, 6); close(); p.do('pick', 0.4);
  }, 'go');
  if (designAllowed() && it.kind==='furniture')add('야외에 장식하기',()=>{
    if(placeOutside(s.id)){removeAt(i);save();Sound.sfx('drop');close();}
  },'go');
  if (inHome && it.kind === 'furniture') add('방에 놓기', () => {
    if (G.room.placeFront(p, s.id)) { removeAt(i); Sound.sfx('drop'); close(); } else { UI.toast('앞에 놓을 자리가 없다.'); Sound.sfx('fail'); }
  }, 'go');
  if (inHome && (it.kind === 'wall' || it.kind === 'floor')) add(it.kind === 'wall' ? '벽에 바르기' : '바닥에 깔기', () => {
    const old = it.kind === 'wall' ? S.home.wall : S.home.floor;
    removeAt(i); addItem(old);
    if (it.kind === 'wall') S.home.wall = s.id; else S.home.floor = s.id;
    G.room.setStyle(S.home.wall, S.home.floor); Sound.sfx('save'); close();
  }, 'go');
  if (inVillage) {
    const f = frontTile();
    if (f.o && f.o.t === 'hole' && it.kind !== 'tool' && it.kind !== 'parcel') add('구멍에 묻기', () => {
      const id = removeAt(i);
      G.village.buried[f.idx] = id; G.village.set(f.tx, f.ty, null);
      Sound.sfx('dig'); burst('dirt', f.tx + 0.5, 0.1, f.ty + 0.5, 6); close(); p.do('dig', 0.4);
    });
    if (it.kind !== 'parcel') add('내려놓기', () => {
      const v = G.village, ok = (x, y) => v.empty(x, y) && v.buried[y * MAP_W + x] == null && v.terrainAt(x, y) !== T.BRIDGE && v.terrainAt(x, y) !== T.DOCK;
      let spot = ok(f.tx, f.ty) ? [f.tx, f.ty] : null;
      if (!spot) { const px = Math.floor(p.x), py = Math.floor(p.z); for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1]]) if (ok(px + dx, py + dy)) { spot = [px + dx, py + dy]; break; } }
      if (!spot) { UI.toast('내려놓을 자리가 없다.'); Sound.sfx('fail'); return; }
      const id = removeAt(i); if (S.player.tool === id && !hasItem(id)) p.equip(null, true);
      v.set(spot[0], spot[1], { t: 'item', id }); Sound.sfx('drop'); redraw();
    });
  }
  return acts;
}

export function openBag() {
  const box = el('div', 'row2'); let sel = -1;
  const draw = () => {
    box.innerHTML = '';
    const left = el('div');
    left.appendChild(el('div', 'note', `도토리 ${acorns(S.player.money)}${S.player.loan > 0 ? `　·　남은 집값 ${fmt(S.player.loan)}` : ''}`));
    const grid = el('div', 'grid');
    S.inv.forEach((s, i) => { const d = slotEl(s, { sel: i === sel }); if (s) d.onclick = () => { sel = i; Sound.sfx('ui'); draw(); }; grid.appendChild(d); });
    left.appendChild(grid);
    const det = el('div', 'detail');
    const s = sel >= 0 ? S.inv[sel] : null;
    if (!s) det.innerHTML = '<p>물건을 누르면 쓸 수 있는 일이 나온다.</p><p>풀밭에서는 심기·내려놓기, 내 집에서는 가구 놓기와 벽지 바르기를 할 수 있다.</p>';
    else {
      const it = ITEMS[s.id];
      det.innerHTML = `<h3>${it.name}${s.n > 1 ? ` × ${s.n}` : ''}</h3><p>${KIND_KO[it.kind] || ''}${it.kind !== 'parcel' && it.kind !== 'coin' ? `　·　팔면 ${acorns(sellPrice(s.id, G.village.fruit))}` : ''}</p><p>${it.desc || ''}</p>`;
      const acts = el('div', 'acts');
      for (const [label, fn, cls] of bagActions(sel, () => UI.closePanel(), () => { if (!S.inv[sel]) sel = -1; draw(); })) { const b = el('button', 'btn ' + cls, label); b.onclick = fn; acts.appendChild(b); }
      det.appendChild(acts);
    }
    box.appendChild(left); box.appendChild(det);
  };
  draw();
  UI.openPanel('가방', box);
}

// ---------------------------------------------------------------- 창고
export function openStorage() {
  const box = el('div');
  const draw = () => {
    box.innerHTML = '';
    box.appendChild(el('div', 'note', '물건을 누르면 가방과 창고 사이를 오간다. 창고에는 120개까지 들어간다.'));
    const row = el('div', 'row2');
    const a = el('div'); a.appendChild(el('div', 'note', '가방'));
    const g1 = el('div', 'grid');
    S.inv.forEach((s, i) => { const d = slotEl(s); if (s) d.onclick = () => { if (ITEMS[s.id].kind === 'parcel') return; if (S.storage.length >= 120) { UI.toast('창고가 가득 찼다.'); return; } S.storage.push({ id: s.id, n: s.n }); if (S.player.tool === s.id) G.player.equip(null, true); S.inv[i] = null; Sound.sfx('drop'); draw(); }; g1.appendChild(d); });
    a.appendChild(g1);
    const b = el('div'); b.style.flex = '1'; b.appendChild(el('div', 'note', `창고 (${S.storage.length}/120)`));
    const g2 = el('div', 'grid'); g2.style.gridTemplateColumns = 'repeat(5, 76px)'; g2.style.maxHeight = '420px'; g2.style.overflow = 'auto';
    S.storage.forEach((s, i) => { const d = slotEl(s); d.onclick = () => { if (!canAdd(s.id)) { UI.toast('가방이 가득 찼다.'); return; } addItem(s.id, s.n); S.storage.splice(i, 1); Sound.sfx('pick'); draw(); }; g2.appendChild(d); });
    b.appendChild(g2);
    row.appendChild(a); row.appendChild(b); box.appendChild(row);
  };
  draw();
  UI.openPanel('창고', box);
}

// ---------------------------------------------------------------- 도감
const monthsText = (m) => (m === 'all' ? '일 년 내내' : compress(m).join(', ') + '월');
function compress(m) { // [3,4,5,9] -> ['3~5','9']
  const set = new Set(m), out = []; let i = 1;
  const runs = [];
  for (let k = 1; k <= 12; k++) if (set.has(k) && !set.has(k === 1 ? 12 : k - 1)) { let e = k; while (set.has(e === 12 ? 1 : e + 1) && (e === 12 ? 1 : e + 1) !== k) e = e === 12 ? 1 : e + 1; runs.push([k, e]); }
  for (const [a, b] of runs) out.push(a === b ? `${a}` : `${a}~${b}`);
  return out.length ? out : ['1~12'];
}
const hoursText = (h) => (h === 'all' ? '하루 종일' : h.map(([a, b]) => `${a}시~${b}시`).join(', '));
const LOC_KO = { river: '강', upstream: '강 상류', pond: '연못', sea: '바다', mouth: '강어귀', pier: '부두' };
const WHERE_KO = { shore: '물가를 날아다님', path: '길 위', sand: '모래밭', air: '날아다님', flower: '꽃 위', tree: '나무줄기', ground: '풀밭', pond: '물 위', stump: '그루터기', rainrock: '비 오는 날 바위', light: '가로등 주변', glow: '물가의 밤', shake: '나무를 흔들면', rock: '바위를 두드리면', food: '땅에 놓아둔 과일 곁' };

export function openDex() {
  const box = el('div'); let tab = 'fresh', sel = null;
  const draw = () => {
    box.innerHTML = '';
    const tabs = el('div', 'tabs');
    for (const [k, ko] of [['fresh', '민물고기'], ['sea', '바닷물고기'], ['bug', '곤충'], ['fossil', '화석']]) { const t = el('button', 'tab' + (tab === k ? ' on' : ''), ko); t.onclick = () => { tab = k; sel = null; Sound.sfx('ui'); draw(); }; tabs.appendChild(t); }
    box.appendChild(tabs);
    const cat = tab === 'fresh' || tab === 'sea' ? 'fish' : tab;       // 기록은 민물·바다를 나누지 않고 fish 하나에 쌓인다
    const list = cat === 'fish' ? FISH.filter((f) => f.water === tab) : tab === 'bug' ? BUGS : FOSSILS.map((f) => ({ id: f[0], name: f[1], fact: f[3], price: f[2] }));
    const got = (id) => !!S.dex[cat][id], don = (id) => S.museum[cat].includes(id);
    const n = list.filter((x) => got(x.id)).length;
    box.appendChild(el('div', 'note', `찾은 것 ${n} / ${list.length}　·　박물관 기증 ${list.filter((x) => don(x.id)).length}`));
    box.appendChild(el('div', 'bar', `<i style="width:${Math.round((n / list.length) * 100)}%"></i>`));
    const row = el('div', 'row2');
    const grid = el('div', 'grid'); grid.style.gridTemplateColumns = 'repeat(7, 76px)';
    grid.style.maxHeight = '56vh'; grid.style.overflowY = 'auto'; grid.style.paddingRight = '6px'; grid.style.alignContent = 'start';
    for (const x of list) {
      const id = (tab === 'fossil' ? 'fossil_' : cat + '_') + x.id;
      const d = slotEl({ id, n: 1 }, { unknown: !got(x.id), sel: sel === x });
      if (don(x.id)) d.appendChild(el('span', 'mark', '기증'));
      d.title = got(x.id) ? x.name : '???';
      d.onclick = () => { sel = x; Sound.sfx('ui'); draw(); };
      grid.appendChild(d);
    }
    const det = el('div', 'detail');
    if (!sel) det.innerHTML = '<p>칸을 누르면 자세한 내용이 나온다. 아직 못 만난 것은 그림자로만 보인다.</p>';
    else if (!got(sel.id)) det.innerHTML = '<h3>???</h3><p>아직 만나지 못했다.</p>';
    else if (cat === 'fish') { const r = S.dex.fish[sel.id]; det.innerHTML = `<h3>${sel.name}</h3><p>사는 곳: ${sel.loc.map((l) => LOC_KO[l]).join(', ')}</p><p>철: ${monthsText(sel.m)}</p><p>시간: ${hoursText(sel.h)}</p><p>잡은 수 ${r.n}마리 · 최고 ${r.max}cm</p><p>값: ${acorns(sel.price)}</p><p>${sel.fact}</p>`; }
    else if (tab === 'bug') { const r = S.dex.bug[sel.id]; det.innerHTML = `<h3>${sel.name}</h3><p>있는 곳: ${WHERE_KO[sel.where] || ''}</p><p>철: ${monthsText(sel.m)}</p><p>시간: ${hoursText(sel.h)}</p><p>잡은 수 ${r.n}마리</p><p>값: ${acorns(sel.price)}</p><p>${sel.fact}</p>`; }
    else det.innerHTML = `<h3>${sel.name}</h3><p>값: ${acorns(sel.price)}</p><p>${sel.fact}</p>`;
    row.appendChild(grid); row.appendChild(det); box.appendChild(row);
  };
  draw();
  UI.openPanel('도감', box);
}

// ---------------------------------------------------------------- 지도
export function openMap() {
  const box = el('div');
  const cv = el('canvas', 'map'); const SC = 10; cv.width = MAP_W * SC; cv.height = MAP_H * SC;
  const x = cv.getContext('2d'), v = G.village;
  const COL = { [T.GRASS]: '#8fd16c', [T.PATH]: '#e2c48a', [T.SAND]: '#f3e4ad', [T.WATER]: '#5ab8ea', [T.SEA]: '#41a6de', [T.STONE]: '#d3cabc', [T.CLIFF]: '#7f9a72', [T.BRIDGE]: '#bd8a56', [T.DOCK]: '#bd8a56', [T.FOREST]: '#5fa862' };
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
    x.fillStyle = COL[v.terrain[ty * MAP_W + tx]]; x.fillRect(tx * SC, ty * SC, SC, SC);
    const o = v.objs[ty * MAP_W + tx];
    if (o && o.t === 'tree' && o.stage > 0) { x.fillStyle = o.kind === 'fruit' ? '#3f9a52' : o.kind === 'pine' ? '#2f7f55' : '#58b256'; x.beginPath(); x.arc(tx * SC + SC / 2, ty * SC + SC / 2, SC * 0.42, 0, 7); x.fill(); }
    else if (o && o.t === 'rock') { x.fillStyle = '#9a948c'; x.fillRect(tx * SC + 2, ty * SC + 3, SC - 4, SC - 5); }
    else if (o && o.t === 'flower') { x.fillStyle = '#ff9fc2'; x.fillRect(tx * SC + 3, ty * SC + 3, 4, 4); }
  }
  x.font = 'bold 13px "Jua","Malgun Gothic",sans-serif'; x.textAlign = 'center';
  for (const b of v.buildings) {
    let label = { hall: '마을회관', shop: '만물상', museum: '박물관', home: '우리 집' }[b.type], col = { hall: '#4a5568', shop: '#3fa39a', museum: '#7c93b0', home: '#d9584a' }[b.type];
    const I = worldInfo();
    if(b.type==='atelier'||b.type==='campsite'){label=b.type==='atelier'?'공동 공방':'캠핑장';col='#8b7150';}
    if(b.type==='hall'&&I.camp)label='안내 천막';
    if (b.type === 'house') { const vid = I.lots[b.lot]; if (!vid) { label = I.sites.includes(b.lot) ? ((b.lot+1)+'번 공사터') : ((b.lot+1)+'번 빈터'); col = '#b9a98a'; } else { label = G.visit || S.villagers[vid].met ? VILLAGERS[vid].name : '?'; col = VILLAGERS[vid].roof; } }
    else if (b.type === 'shop' && I.shop < 2) label = '천막 가게';
    else if (b.type === 'museum' && I.museum < 2) { label = I.museum === 1 ? '조사 천막' : '박물관 터'; if (I.museum < 1) col = '#b9a98a'; }
    else if (b.type === 'home') label = G.visit ? `${G.visit.host}네 ${I.lv < 1 ? '천막' : '집'}` : I.lv < 1 ? '내 천막' : '우리 집';
    x.fillStyle = col; x.fillRect(b.x * SC + 1, b.y * SC + 1, b.w * SC - 2, b.d * SC - 2);
    x.strokeStyle = '#4a3220'; x.lineWidth = 1.5; x.strokeRect(b.x * SC + 1, b.y * SC + 1, b.w * SC - 2, b.d * SC - 2);
    x.fillStyle = '#fff'; x.strokeStyle = '#3a2a1a'; x.lineWidth = 3; x.strokeText(label, (b.x + b.w / 2) * SC, (b.y + b.d / 2) * SC + 5); x.fillText(label, (b.x + b.w / 2) * SC, (b.y + b.d / 2) * SC + 5);
  }
  for (const n of G.npcs) if (n.visible) { x.fillStyle = VILLAGERS[n.id].roof; x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.arc(n.x * SC, n.z * SC, 5, 0, 7); x.fill(); x.stroke(); }
  for (const r of (G.net ? G.net.peers.values() : [])) if (r.known && r.placed && !r.inside) { x.fillStyle = '#4a90d9'; x.strokeStyle = '#fff'; x.lineWidth = 3; x.beginPath(); x.arc(r.x * SC, r.z * SC, 6, 0, 7); x.fill(); x.stroke(); }
  const px = S.player.x, pz = S.player.z, P = G.room ? { x: px, z: pz } : G.player;
  x.fillStyle = '#e8463c'; x.strokeStyle = '#fff'; x.lineWidth = 3; x.beginPath(); x.arc(P.x * SC, P.z * SC, 7, 0, 7); x.fill(); x.stroke();
  box.appendChild(cv);
  box.appendChild(el('div', 'note', `<b style="color:#e8463c">●</b> 나　·　<b style="color:#4a90d9">●</b> 같이 있는 친구　·　작은 색 점은 밖에 나와 있는 이웃　·　${G.visit ? G.visit.name : S.village.name} 마을의 특산 과일은 ${FRUIT_KO[v.fruit]}`));
  UI.openPanel(`${G.visit ? G.visit.name : S.village.name} 마을 지도`, box);
}

// ---------------------------------------------------------------- 우체통
export function openMail() {
  const box = el('div'); let cur = null;
  const draw = () => {
    box.innerHTML = '';
    if (cur) {
      box.appendChild(el('div', 'letter', cur.text));
      const acts = el('div', 'acts'); acts.style.display = 'flex'; acts.style.gap = '6px'; acts.style.marginTop = '10px';
      if (cur.item) {
        const row = itemRow(cur.item, '편지에 들어 있는 선물');
        const b = el('button', 'btn go', '꺼내기');
        b.onclick = () => { if (!canAdd(cur.item)) { UI.toast('가방이 가득 찼다.'); return; } addItem(cur.item); cur.item = null; Sound.sfx('catch'); draw(); };
        row.appendChild(b); box.appendChild(row);
      }
      const back = el('button', 'btn', '목록으로'); back.onclick = () => { cur = null; draw(); };
      const del = el('button', 'btn warn', '버리기'); del.onclick = () => { if (cur.item) { UI.toast('선물을 먼저 꺼내자.'); return; } S.mail.splice(S.mail.indexOf(cur), 1); cur = null; draw(); };
      acts.appendChild(back); acts.appendChild(del); box.appendChild(acts);
      return;
    }
    if (!S.mail.length) { box.appendChild(el('div', 'note', '편지가 없다. 이웃과 친해지면 편지가 온다.')); return; }
    const list = el('div', 'list');
    for (const m of S.mail) {
      const row = el('div', 'li'); row.style.cursor = 'pointer'; row.style.padding = '10px 14px';
      row.innerHTML = `<div class="nm">${m.read ? '' : '<b style="color:#e8574c">새 편지</b> '}${m.name}에게서 온 편지${m.item ? ' <span style="color:#5fae62">(선물)</span>' : ''}</div>`;
      row.onclick = () => { cur = m; m.read = true; Sound.sfx('letter'); draw(); };
      list.appendChild(row);
    }
    box.appendChild(list);
  };
  draw();
  UI.openPanel('우체통', box, { onClose: () => updateMailFlag() });
}
export function updateMailFlag() {
  const mb = G.world && G.world.mailbox;
  if (mb && mb.userData.parts && mb.userData.parts.flag) mb.userData.parts.flag.rotation.x = S.mail.some((m) => !m.read) ? 0 : 1.4;
}

// ---------------------------------------------------------------- 게시판·큰 나무·쉬기
export function board() {
  runScript(async () => {
    const now = G.now, pr = museumProgress();
    await narr(`<b>${S.village.name} 마을 게시판</b>\n${dateLabel(now)} · ${SEASON_KO[season(now)]} · ${WEATHER_KO[G.weather]}`);
    const m = now.getMonth() + 1, d = now.getDate();
    const bd = S.residents.map((id) => VILLAGERS[id]).filter((v) => v.bday[0] === m && v.bday[1] >= d).sort((a, b) => a.bday[1] - b.bday[1])[0];
    if (bd) await narr(bd.bday[1] === d ? `오늘은 <b>${bd.name}</b>의 생일! 선물을 주면 기뻐할 거예요.` : `이달 ${bd.bday[1]}일은 ${bd.name}의 생일입니다.`);
    await narr(`박물관 소식: 물고기 ${pr.fish[0]}종, 곤충 ${pr.bug[0]}종, 화석 ${pr.fossil[0]}점 전시 중.`);
    const tips = ['만물상은 아침 8시부터 밤 10시까지 엽니다.', '물고기 그림자 앞에 찌를 던지고, 찌가 쑥 들어가는 순간에 당기세요. 툭툭 건드릴 때는 참아야 합니다.', '곤충은 달려가면 달아납니다. 잠자리채를 든 채 Space를 누르고 살금살금 다가가세요.', '땅에 별 모양으로 갈라진 자리를 삽으로 파면 화석이 나옵니다.', '과일을 풀밭에 심으면 사흘 뒤 나무가 됩니다.', '나무를 흔들면 가끔 도토리 주머니나 보따리가 떨어집니다. 벌집도요.'];
    await narr('알림: ' + tips[(dayKey(now) + now.getHours()) % tips.length]);
  });
}
export function bigTree() {
  runScript(async () => {
    Sound.sfx('shake');
    await narr(['마을을 지켜 온 큰 나무다. 올려다보니 잎 사이로 하늘이 반짝인다.', '큰 나무 줄기에 손을 대 보았다. 따뜻한 것 같기도 하다.', '이 나무는 마을이 생기기 전부터 여기 있었다고 한다.'][Math.floor(rand() * 3)]);
  });
}
export function rest() {
  runScript(async () => {
    const c = await (async () => { await narr('폭신해 보인다. 잠깐 누워서 쉴까?'); return Dialog.choose(['쉰다 (저장)', '그만둔다'], { cancel: 1 }); })();
    if (c !== 0) return;
    await UI.fade(true);
    const ok = save(); Sound.sfx('save');
    await new Promise((r) => setTimeout(r, 500));
    await UI.fade(false);
    await narr(ok ? '푹 쉬었다. 지금까지의 일이 저장되었다.' : '쉬긴 했는데… 저장에는 실패했다. 브라우저 저장 공간을 확인하자.');
  });
}

// ---------------------------------------------------------------- 메뉴(설정)
export function openMenu() {
  const box = el('div');
  box.innerHTML = `
    <div class="kv">
      <span>배경음</span><input type="range" id="st-bgm" min="0" max="100" value="${Math.round(Settings.bgm * 100)}">
      <span>효과음</span><input type="range" id="st-sfx" min="0" max="100" value="${Math.round(Settings.sfx * 100)}">
      <span>게임 시계</span><span><select id="st-off"></select> <span class="note">밤에만 접속한다면 시계를 앞뒤로 옮길 수 있다.</span></span>
      <span>해 그림자</span><span><label><input type="checkbox" id="st-shadow" ${Settings.shadow !== false ? 'checked' : ''}> 켜기</label> <span class="note">느린 컴퓨터에서는 끄면 가벼워진다.</span></span>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin:14px 0 6px">
      <button class="btn go" id="st-look">캐릭터 꾸미기</button><button class="btn go" id="st-net">같이 하기</button><button class="btn go" id="st-save">지금 저장</button><button class="btn" id="st-exp">저장 내보내기</button><button class="btn" id="st-imp">저장 가져오기</button><button class="btn warn" id="st-reset">처음부터 다시</button>
    </div>
    <textarea id="st-text" class="hidden" style="width:100%;height:90px;font-size:12px"></textarea>
    <div class="note">${S.village.name} 마을에서 ${S.stats.days}일째 · 낚은 물고기 ${S.stats.fish}마리 · 잡은 곤충 ${S.stats.bug}마리 · 번 도토리 ${fmt(S.stats.earned)}</div>
    <h3 style="font-weight:normal;margin:12px 0 6px">조작법</h3>
    <div class="keys">
      <span><b>W</b><b>A</b><b>S</b><b>D</b> / 방향키</span><span>걷기 (Shift를 누르면 달리기)</span>
      <span><b>Space</b> / Z / Enter</span><span>말 걸기, 문 열기, 도구 쓰기, 나무 흔들기</span>
      <span><b>F</b> / X</span><span>줍기, 꽃 꺾기 (집에서는 가구 집어넣기)</span>
      <span><b>E</b> / I / Tab</span><span>가방</span>
      <span><b>1</b>~<b>5</b>, <b>Q</b>, <b>0</b></span><span>도구 꺼내기, 차례로 바꾸기(집에서는 가구 돌리기), 집어넣기</span>
      <span><b>N</b> <b>C</b> <b>M</b> <b>Esc</b></span><span>수첩, 도감, 지도, 이 창</span>
      <span><b>T</b></span><span>말하기(같이 하는 동안)</span>
    </div>`;
  UI.openPanel('메뉴', box);
  const $ = (id) => box.querySelector('#' + id);
  const off = $('st-off');
  for (let h = -12; h <= 12; h++) { const o = el('option', '', h === 0 ? '실제 시간 그대로' : `${h > 0 ? '+' : ''}${h}시간`); o.value = h * 60; if (h * 60 === Settings.offsetMin) o.selected = true; off.appendChild(o); }
  const activities=el('div','island-actions');
  box.prepend(activities);
  if(!G.visit){action(activities,'먼작귀 생활 수첩',journal);action(activities,G.room?.area?'여행 안내':'마을 여행',()=>G.hooks.travel(),!G.room||!!G.room.area);
    if(!G.room){action(activities,'이웃 초대와 집터',()=>G.hooks.housing());action(activities,'섬 공사',()=>G.hooks.islandTools());}
  }
  $('st-net').onclick = () => G.hooks.openNet();
  $('st-look').onclick = openMirror;
  $('st-bgm').oninput = (e) => { Settings.bgm = e.target.value / 100; Sound.setVolume(Settings.bgm, Settings.sfx); saveSettings(); };
  $('st-sfx').oninput = (e) => { Settings.sfx = e.target.value / 100; Sound.setVolume(Settings.bgm, Settings.sfx); saveSettings(); Sound.sfx('ui'); };
  off.onchange = () => { Settings.offsetMin = +off.value; Clock.offsetMin = Settings.offsetMin; saveSettings(); refreshTime(true); UI.toast('게임 시계를 바꿨다.'); };
  $('st-shadow').onchange = (e) => { Settings.shadow = e.target.checked; G.stage.setShadows(Settings.shadow); G.noAutoQuality = true; saveSettings(); };
  $('st-save').onclick = () => { UI.toast(save() ? '저장했다.' : '저장에 실패했다.'); Sound.sfx('save'); };
  $('st-exp').onclick = () => { save(); const t = $('st-text'); t.classList.remove('hidden'); t.value = exportSave(); t.select(); UI.toast('아래 글자를 전부 복사해 보관하세요.'); };
  $('st-imp').onclick = () => { const t = $('st-text'); if (t.classList.contains('hidden') || !t.value.trim()) { t.classList.remove('hidden'); t.value = ''; t.placeholder = '보관해 둔 저장 글자를 붙여 넣고 [저장 가져오기]를 한 번 더 누르세요.'; return; } try { importSave(t.value.trim()); location.reload(); } catch (e) { UI.toast('저장 글자가 올바르지 않다.'); } };
  $('st-reset').onclick = () => { if (confirm('지금 마을을 지우고 처음부터 다시 시작할까요? 되돌릴 수 없습니다.')) { deleteSave(); location.reload(); } };
}

// ---------------------------------------------------------------- 타이틀
export function showTitle({ onNew, onContinue }) {
  const t = document.getElementById('title');
  t.classList.remove('hidden');
  const main = () => {
    t.classList.add('front');
    t.innerHTML = `<div class="head"><h1>도토리 마을</h1><div class="sub">느긋하게 사는 작은 마을 이야기</div></div>
      <div class="box">${hasSave() ? '<button class="big" id="t-cont">이어서 하기</button>' : ''}<button class="big ${hasSave() ? 'alt' : ''}" id="t-new">새로 시작하기</button></div>
      <div class="foot">저장은 이 브라우저에 됩니다 · 소리가 납니다 · 판 ${VERSION}</div>`;
    const c = t.querySelector('#t-cont'); if (c) c.onclick = () => { Sound.unlock(); Sound.sfx('open'); t.classList.add('hidden'); onContinue(); };
    t.querySelector('#t-new').onclick = () => { Sound.unlock(); Sound.sfx('ui'); if (hasSave() && !confirm('이미 살고 있는 마을이 있습니다. 새로 시작하면 그 마을은 사라져요. 계속할까요?')) return; form(); };
  };
  const form = () => {
    t.classList.remove('front');
    t.innerHTML = `<h1 style="font-size:46px">이사 준비</h1><div class="sub lt" style="margin-bottom:12px">이름과 모습을 골라 주세요. 이사 후에도 메뉴나 집 안 거울에서 꾸밀 수 있어요.</div>
      <div class="box wide"><div class="tf"><label>내 이름</label><input type="text" id="t-name" maxlength="6" value="도토리"><label>마을 이름</label><input type="text" id="t-vil" maxlength="6" value="솔바람"></div>
      <div id="t-look"></div>
      <div class="tb"><button class="big alt" id="t-back">돌아가기</button><button class="big" id="t-go">마을로 출발!</button></div></div>`;
    const ed = lookEditor(defaultLook(), (L) => { if (G.title) G.title.setPlayer(LOOK_MODEL, L, false); }, {arrival:true});
    t.querySelector('#t-look').appendChild(ed.el);
    if (G.title) G.title.setPlayer(LOOK_MODEL, ed.look, false);
    t.querySelector('#t-back').onclick = () => { ed.dispose(); main(); };
    t.querySelector('#t-go').onclick = () => {
      const name = t.querySelector('#t-name').value.trim() || '도토리', village = t.querySelector('#t-vil').value.trim() || '솔바람';
      const look = ed.look; ed.dispose();
      Sound.sfx('open'); t.classList.add('hidden'); t.innerHTML = ''; onNew({ name, village, model: LOOK_MODEL, look });
    };
  };
  main();
}

// ---------------------------------------------------------------- 거울: 모습 바꾸기
export function openMirror() {
  const box = el('div');
  const ed = lookEditor(S.player.look || lookOfModel(S.player.model), null, { w: 250, h: 310 });
  box.appendChild(ed.el);
  const acts = el('div', 'lk-acts');
  const ok = el('button', 'btn go', '이 모습으로 할래'), no = el('button', 'btn', '그만둘래');
  let done = false;
  ok.onclick = () => { done = true; G.player.setLook(ed.look); Sound.sfx('fanfare'); UI.closePanel(); G.player.actor.play('joy', 0.9); save(); };
  no.onclick = () => UI.closePanel();
  acts.appendChild(no); acts.appendChild(ok); box.appendChild(acts);
  UI.openPanel('캐릭터 꾸미기', box, { onClose: () => { ed.dispose(); if (!done) Sound.sfx('close'); } });
}

function noticeboard(){const b=el('div');action(b,'마을 소식',()=>{UI.closePanel();board();});action(b,'먼작귀 생활 수첩',journal);action(b,'마을 여행과 토벌',()=>G.hooks.travel());action(b,'이웃 초대와 집터',()=>G.hooks.housing());action(b,'섬 공사',()=>G.hooks.islandTools());UI.openPanel('광장 게시판',b);}
export function registerMenus() {
  G.hooks.noticeboard=noticeboard;
  Object.assign(G.hooks, { openBag, openDex, openMap, openMenu, openNote, openMail, openStorage, openMirror, board, bigTree, rest });
}
