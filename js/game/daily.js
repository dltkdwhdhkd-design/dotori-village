// 하루가 바뀔 때 일어나는 일: 나무가 자라고, 조개가 밀려오고, 가게 물건이 바뀐다
import { G, save } from './game.js';
import { G as T, MAP_W, MAP_H, FRUITS, FLOWER_SPECIES } from '../world/mapgen.js';
import { S } from './state.js';
import { ITEMS, FURNITURE, WALLS, FLOORS, SHELL_IDS } from '../data/items.js';
import { VILLAGERS } from '../data/villagers.js';
import { TALK } from '../data/talk.js';
import { RNG, hash32, weighted } from '../core/util.js';
import { UI, fill } from '../ui/ui.js';
import { dateOfDay } from '../core/clock.js';
import { LOANS } from './state.js';
import { checkAch, fillTasks, refreshGoal } from './quests.js';
import { G as TT, WK } from '../world/mapgen.js';

const MIX = { 'red,yellow': 'orange', 'red,white': 'pink', 'blue,red': 'purple', 'pink,red': 'pink', 'orange,yellow': 'orange', 'pink,white': 'pink', 'blue,white': 'blue', 'purple,white': 'purple' };

function freeGrass(v, x, y) { return v.inb(x, y) && v.terrainAt(x, y) === T.GRASS && !v.objs[y * MAP_W + x] && v.buried[y * MAP_W + x] == null && !nearDoor(v, x, y); }
function nearDoor(v, x, y) { for (const b of v.buildings) if (y >= b.y + b.d && y <= b.y + b.d + 1 && x >= b.doors[0] - 1 && x <= b.doors[b.doors.length - 1] + 1) return true; return false; }

/** 하루치 변화. 저장된 날짜에서 하루씩 진행한다. */
function growDay(day) {
  const v = G.village, r = RNG(hash32(S.seed, day, 77));
  let weeds = 0, flowers = 0, shells = 0;
  const flowerList = [];
  v.each((o, x, y) => {
    if (o.t === 'tree') {
      o.chop = 0;
      if (o.stage < 3) { o.stage++; if (o.stage === 3 && o.kind === 'fruit') { o.fruits = 3; } v.touch(x, y); }
      else if (o.kind === 'fruit' && !o.fruits && day - (o.picked || 0) >= 3) { o.fruits = 3; v.touch(x, y); }
    } else if (o.t === 'weed') weeds++;
    else if (o.t === 'flower') { flowers++; flowerList.push([o, x, y]); }
    else if (o.t === 'item' && ITEMS[o.id] && ITEMS[o.id].kind === 'shell') shells++;
  });
  // 물 준 꽃 옆에 새 꽃
  for (const [o, x, y] of flowerList) {
    if (o.w !== day - 1) continue;
    const mates = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].map(([dx, dy]) => v.obj(x + dx, y + dy)).filter((m) => m && m.t === 'flower' && m.sp === o.sp);
    if (!mates.length || !r.chance(0.5)) continue;
    const m = r.pick(mates);
    const key = [o.col, m.col].sort().join(',');
    let col = MIX[key] || (o.col === m.col ? o.col : r.pick([o.col, m.col]));
    if (o.col === m.col && o.col === 'white' && r.chance(0.25)) col = 'blue';
    if (o.col === m.col && o.col === 'red' && r.chance(0.2)) col = 'pink';
    const spots = r.shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]]).map(([dx, dy]) => [x + dx, y + dy]).filter(([a, b]) => freeGrass(v, a, b));
    if (spots.length) { v.set(spots[0][0], spots[0][1], { t: 'flower', sp: o.sp, col }); flowers++; }
  }
  if (flowers < 30 && r.chance(0.3)) { const p = v.randomTile(r, (x, y) => freeGrass(v, x, y)); if (p) v.set(p.x, p.y, { t: 'flower', sp: r.pick(FLOWER_SPECIES), col: r.pick(['red', 'yellow', 'white']) }); }
  for (let n = r.int(3, 5); n > 0 && weeds < 45; n--) { const p = v.randomTile(r, (x, y) => freeGrass(v, x, y)); if (p) { v.set(p.x, p.y, { t: 'weed', v: r.int(1, 2) }); weeds++; } }
  // 해변의 조개
  for (let n = 0; shells < 7 && n < 30; n++) {
    const x = r.int(4, MAP_W - 5), y = r.int(50, 54);
    if (v.terrainAt(x, y) !== T.SAND || v.objs[y * MAP_W + x]) continue;
    const id = weighted(SHELL_IDS, (s) => ITEMS[s].w, r);
    v.set(x, y, { t: 'item', id }); shells++;
  }
  // 땅속 화석
  let fossils = Object.values(v.buried).filter((b) => b === 'fossil').length;
  for (let n = 0; n < 3 && fossils < 6; n++) { const p = v.randomTile(r, (x, y) => freeGrass(v, x, y)); if (p) { v.buried[p.y * MAP_W + p.x] = 'fossil'; v.touch(p.x, p.y); fossils++; } }
}

/** 오늘 하루 동안 쓰는 표: 도토리 나무, 벌집 나무, 가게 물건 등 */
export function setupToday(day) {
  const v = G.village, r = RNG(hash32(S.seed, day, 99));
  const trees = [], rocks = [];
  v.each((o, x, y, i) => { if (o.t === 'tree' && o.stage === 3 && o.kind !== 'fruit') trees.push(i); if (o.t === 'rock') rocks.push(i); });
  r.shuffle(trees);
  S.daily = { coinTrees: trees.slice(0, 5), nestTrees: trees.slice(5, 8), furnTrees: trees.slice(8, 10), moneyRock: rocks.length ? r.pick(rocks) : -1, rockHits: 0, shaken: [], stones: {} };
  const furn = r.shuffle(FURNITURE.map((f) => f[0])).slice(0, 5);
  const others = FRUITS.filter((f) => f !== v.fruit);
  S.shop = {
    day, furn, sold: [],
    wall: r.pick(WALLS.filter((w) => w[2] > 0))[0], floor: r.pick(FLOORS.filter((w) => w[2] > 0))[0],
    seeds: r.shuffle([...FLOWER_SPECIES]).slice(0, 3).map((s) => 'seed_' + s),
    fruit: r.chance(0.35) ? 'fruit_' + r.pick(others) : null,
  };
  for (const id of Object.keys(S.villagers)) { S.villagers[id].talkN = 0; S.villagers[id].stungSeen = 0; S.villagers[id].reqAsked = 0; }
  S.player.stung = false;
}

function mail(from, name, text, item) { S.mail.unshift({ from, name, text, item: item || null, read: false, day: S.day }); if (S.mail.length > 30) S.mail.length = 30; }
export { mail };

function dailyMail(day) {
  const r = RNG(hash32(S.seed, day, 55));
  // 친해진 이웃이 보내는 편지
  for (const id of S.residents) {
    const st = S.villagers[id], def = VILLAGERS[id];
    st.ms = st.ms || 0;
    const lv = st.friend >= 80 ? 3 : st.friend >= 50 ? 2 : st.friend >= 25 ? 1 : 0;
    if (lv > st.ms) {
      st.ms = lv;
      const pool = FURNITURE.filter((f) => f[5] === def.set || lv === 3).map((f) => f[0]);
      const text = fill(TALK[def.p].letter[0], { p: S.player.name, me: def.name, c: def.catch });
      mail(id, def.name, text, r.pick(pool.length ? pool : FURNITURE.map((f) => f[0])));
    }
  }
  // 새 이웃(마을 잔치를 마친 뒤부터는 빈터가 있으면 저절로 이사 온다. 그 전에는 집터를 마련해야 온다)
  if (S.prog.done && S.waiting.length && day >= (S.moveInDay || 0)) {
    const used = new Set(Object.values(S.villagers).map((s) => s.lot));
    const free = [...Array(G.village.lots.length).keys()].filter((l) => !used.has(l));
    if (free.length) { moveIn(day, r); S.moveInDay = day + 5 + r.int(0, 3); }
  }
}

/** 빈 집터 하나에 새 이웃을 들인다 */
function moveIn(day, r, want = null, chosen = null) {
  const used = new Set(Object.values(S.villagers).map((s) => s.lot));
  const free = [...Array(G.village.lots.length).keys()].filter((l) => !used.has(l));
  if (!free.length || !S.waiting.length) return false;
  const held=S.islandLife?.projects||[], contacts=S.islandLife?.contacts||[];
  const candidates=S.waiting.filter(k=>!held.some(p=>p.id===k));
  const id=chosen||candidates.find(k=>!contacts.includes(k))||(want!=null?candidates[0]:null);
  const allowed=free.filter(l=>!held.some(p=>p.lot===l&&p.id!==chosen) && (l===want || !(S.prog.pend.sites||[]).includes(l)));
  if(!id||!S.waiting.includes(id)||!allowed.length|| (want!=null&&!allowed.includes(want)))return false;
  const lot=want!=null?want:r.pick(allowed);
  S.waiting.splice(S.waiting.indexOf(id),1);
  if(contacts.includes(id))S.islandLife.contacts=contacts.filter(k=>k!==id);
  S.villagers[id] = { lot, friend: 0, met: false, talkDay: 0, talkN: 0, req: null, giftDay: 0 };
  S.residents.push(id);
  const b = G.village.buildings.find((bb) => bb.lot === lot);
  if (G.world) G.world.refreshBuilding(b);
  mail('ujik', '우직 이장', `${S.player.name}에게.\n\n마을에 새 식구가 왔다네.\n이름은 ${VILLAGERS[id].name}. 자네가 다듬어 준 터에 집을 지었으니\n오가다 인사나 나누게나.\n\n이장 우직`, null);
  return true;
}

/** 둘째 다리를 놓는다(땅 모양이 바뀌므로 마을을 다시 그린다) */
export function buildBridge() {
  const v = G.village, b = v.bridges.find((x) => x.built === false);
  if (!b) return;
  for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < b.w; dx++) { const i = (b.y + dy) * MAP_W + b.x + dx; v.terrain[i] = TT.BRIDGE; v.waterKind[i] = WK.NONE; }
  b.built = true;
  if (G.hooks.rebuildWorld) G.hooks.rebuildWorld();
}

/** 어제 맡긴 공사가 끝난다: 내 집, 가게, 두루의 천막·박물관, 다리, 새 이웃 */
function progressDay(day) {
  const P = S.prog, pd = P.pend, r = RNG(hash32(S.seed, day, 31));
  const refresh = (type) => { const b = G.village.buildings.find((x) => x.type === type); if (b && G.world) G.world.refreshBuilding(b); };
  if (pd.home && day >= pd.home) {
    delete pd.home; S.player.houseLv = 1; S.player.loan = LOANS[0]; refresh('home');
    mail('ujik', '우직 이장', `${S.player.name}에게.\n\n집이 다 지어졌네!\n작아도 볕은 잘 드는 집일세.\n집값은 벌리는 대로 마을회관에 와서 갚게.\n\n이장 우직`, null);
  }
  if (pd.shop && day >= pd.shop) { delete pd.shop; P.shop = 2; refresh('shop'); mail('kkami', '까미', `${S.player.name} 손님께.\n\n까악! 가게가 다 지어졌어요!\n가구랑 벽지도 들여놓았으니 구경 오세요.\n재료를 구해 줘서 정말 고마워요.\n\n까치네 만물상 까미`, null); }
  if (pd.museum && day >= pd.museum.day) {
    P.museum = pd.museum.to; delete pd.museum; refresh('museum');
    mail('duru', '두루', P.museum === 1 ? `${S.player.name} 님께.\n\n처음 인사드립니다. 생물을 연구하는 두루입니다.\n마을에 조사 천막을 쳤으니,\n잡으신 물고기와 곤충을 보여 주시면 고맙겠습니다.\n\n두루 드림` : `${S.player.name} 님께.\n\n박물관이 문을 열었습니다.\n화석관과 곤충관, 민물·바다 수족관에서\n기증하신 것들을 직접 보실 수 있습니다.\n\n관장 두루 드림`, null);
  }
  if (pd.bridge && day >= pd.bridge) { delete pd.bridge; P.bridge = 2; buildBridge(); mail('ujik', '우직 이장', `${S.player.name}에게.\n\n강에 둘째 다리가 놓였네.\n이제 오가기가 한결 편할 걸세.\n\n이장 우직`, null); }
  while(pd.movein.length && day>=pd.movein[0]){
    if(!moveIn(day,r,pd.sites?.[0]))break;
    pd.movein.shift();pd.sites?.shift();
  }
  for(const p of [...(S.islandLife?.projects||[])]){
    if(p.day && p.day<=day && moveIn(day,r,p.lot,p.id)){
      S.islandLife.projects=S.islandLife.projects.filter(q=>q!==p);
      P.lots=Math.min(3,P.lots+1);
    }
  }
  for(const b of G.village.buildings)if(['atelier','campsite'].includes(b.type)||(S.flags.campStart&&['hall','house'].includes(b.type)))G.world?.refreshBuilding(b);
  P.tasks = P.tasks.filter((t) => t.n > 0);            // 손대지 않은 일감은 날마다 새것으로 바뀐다
  fillTasks(); checkAch(); refreshGoal();
}

/** 날짜가 바뀌었을 때(또는 오랜만에 접속했을 때) 부른다 */
export function newDay(k, quiet = false) {
  const from = S.day;
  const gap = Math.max(1, Math.min(10, k - from));
  for (let d = k - gap + 1; d <= k; d++) growDay(d);
  S.day = k;
  S.stats.days += 1;
  setupToday(k);
  progressDay(k);
  dailyMail(k);
  if (G.hooks.syncVillagers) G.hooks.syncVillagers();
  save();
  if (!quiet) { const d = dateOfDay(k); UI.toast(`${d.getMonth() + 1}월 ${d.getDate()}일, 새 하루가 시작됐다.`, 3500); }
  if (S.mail.some((m) => !m.read)) UI.toast('우체통에 편지가 와 있다.', 3500);
}

/** 새 게임 첫날 준비 */
export function firstDay(k) {
  growDay(k);
  // 첫날은 나무가 자라면 안 되므로 묘목은 없지만, 과일은 가득 채워 둔다
  setupToday(k);
  S.day = k;
}
