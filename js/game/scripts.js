// 대본: 주민과의 대화, 가게·박물관·마을회관, 건물 드나들기, 잡았을 때의 연출
import * as THREE from 'three';
import { G, runScript, save, refreshTime, burst } from './game.js';
import { Room } from './rooms.js';
import { Villager, villagerAwake, villagerOut, syncVillagers, setVillagersVisible } from './npc.js';
import { S, addItem, canAdd, takeItem, hasItem, countItem, freeSlots, addMoney, removeAt, LOANS, ROOM_SIZE } from './state.js';
import { ITEMS, FISH, BUGS, FISH_BY_ID, BUG_BY_ID, FOSSILS, FURNITURE, WALLS, FLOORS, FRUIT_KO, SHELL_IDS, itemName, sellPrice, isDonatable } from '../data/items.js';
import { VILLAGERS, PERSONALITY, NPCS, HOME_LAYOUT, HOME_STYLE } from '../data/villagers.js';
import { TALK, NPC_TALK } from '../data/talk.js';
import { UI, Dialog, fill, itemRow, acorns } from '../ui/ui.js';
import { Sound } from '../core/audio.js';
import { make } from '../gfx/models.js';
import { dayKey, hourF, inMonths, inHours, season } from '../core/clock.js';
import { rand, fmt, josa, el, wait } from '../core/util.js';

const pick = (a) => a[Math.floor(rand() * a.length)];
const narr = (t) => Dialog.say('', t);
const say = (who, text, vars = {}) => Dialog.say(who.name, fill(text, { p: S.player.name, v: S.village.name, ...vars }), { pitch: who.pitch || 1, actor: who.actor || null });
const npcOf = (k) => ({ name: NPCS[k].name, pitch: NPCS[k].pitch });

// ---------------------------------------------------------------- 주민과 대화
function vvars(n, extra = {}) { const def = VILLAGERS[n.id]; return { me: def.name, c: def.catch, f: FRUIT_KO[G.village.fruit], ...extra }; }
function otherName(id) { const o = S.residents.filter((x) => x !== id); return o.length ? VILLAGERS[pick(o)].name : '이장님'; }

function chatLine(n) {
  const def = VILLAGERS[n.id], L = TALK[def.p], now = G.now, m = now.getMonth() + 1, h = now.getHours();
  if (def.bday[0] === m && def.bday[1] === now.getDate()) return pick(L.bday);
  const pool = [];
  if (G.weather === 'rain') pool.push(...L.rain, ...L.rain);
  if (G.weather === 'snow') pool.push(...L.snow, ...L.snow);
  if ((m === 7 || m === 8) && h >= 11 && h < 17 && G.weather === 'clear') pool.push(...L.hot);
  if (m === 12 || m <= 2) pool.push(...L.cold);
  pool.push(...L[season(now)]);
  pool.push(...L.about);
  pool.push(...L.chat, ...L.chat);
  return pick(pool);
}
function greetLine(n) {
  const L = TALK[VILLAGERS[n.id].p], h = hourF();
  return pick(h >= 5 && h < 11 ? L.morning : h < 17 ? L.day : h < 21 ? L.evening : L.night);
}

async function giveReward(n, scale = 1) {
  if (rand() < 0.45 && freeSlots() > 0) {
    const r = rand();
    const id = r < 0.6 ? pick(FURNITURE)[0] : r < 0.75 ? pick(WALLS.filter((w) => w[2] > 0))[0] : r < 0.9 ? pick(FLOORS.filter((w) => w[2] > 0))[0] : 'fruit_' + pick(Object.keys(FRUIT_KO).filter((f) => f !== G.village.fruit));
    addItem(id); Sound.sfx('catch');
    await narr(`${n.name}에게서 <b>${josa(itemName(id), '을/를')}</b> 받았다!`);
  } else {
    const amt = Math.round((300 + rand() * 700) * scale / 10) * 10;
    addMoney(amt); Sound.sfx('coin');
    await narr(`${n.name}에게서 <b>도토리 ${fmt(amt)}개</b>를 받았다!`);
  }
}

function makeRequest(id) {
  const now = G.now, types = [];
  const fishNow = FISH.filter((f) => !f.trash && f.w >= 5 && inMonths(f.m, now) && inHours(f.h, now));
  const bugNow = BUGS.filter((b) => b.w >= 5 && G.critters.bugOK(b));
  if (fishNow.length) types.push('fish', 'fish');
  if (bugNow.length) types.push('bug', 'bug');
  types.push('fruit', 'shell');
  if (S.residents.length > 1 && !(S.parcels || []).length) types.push('deliver', 'deliver');
  const type = pick(types);
  if (type === 'fish') return { type, item: 'fish_' + pick(fishNow).id };
  if (type === 'bug') return { type, item: 'bug_' + pick(bugNow).id };
  if (type === 'fruit') return { type, item: 'fruit_' + G.village.fruit };
  if (type === 'shell') return { type, item: pick(SHELL_IDS.slice(0, 4)) };
  return { type, to: pick(S.residents.filter((x) => x !== id)) };
}

/** 가방에서 물건 하나를 고르게 한다. 고른 칸 번호(없으면 -1) */
function pickFromBag(title, filter) {
  return new Promise((res) => {
    const box = el('div', 'list');
    let chosen = -1;
    S.inv.forEach((s, i) => {
      if (!s || !filter(s.id)) return;
      const row = itemRow(s.id, s.n > 1 ? `${s.n}개` : '');
      row.style.cursor = 'pointer';
      row.onclick = () => { chosen = i; UI.closePanel(); };
      box.appendChild(row);
    });
    if (!box.children.length) box.appendChild(el('div', 'note', '건넬 만한 물건이 없다.'));
    UI.openPanel(title, box, { onClose: () => res(chosen) });
  });
}

export async function talkVillager(n) {
  const id = n.id, st = S.villagers[id], def = VILLAGERS[id], L = TALK[def.p], today = dayKey(), p = G.player;
  if (!st) return;
  n.talking = true;
  p.actor.faceTo(n.x, n.z); n.actor.faceTo(p.x, p.z);
  const V = (x) => vvars(n, x);
  try {
    let h = hourF(); if (h < 5) h += 24;
    const sleepy = h > PERSONALITY[def.p].sleep - 0.5;
    if (!st.met) { st.met = true; st.friend += 3; st.talkDay = today; n.actor.play('wave', 0.9); await say(n, pick(L.hello), V()); }
    else {
      const par = (S.parcels || []).find((q) => q.to === id);
      if (par && hasItem('parcel')) {
        takeItem('parcel'); S.parcels = S.parcels.filter((q) => q !== par);
        n.actor.play('joy', 0.8);
        await say(n, pick(L.recv), V({ o: VILLAGERS[par.from].name }));
        await giveReward(n, 1);
        st.friend += 3;
        if (S.villagers[par.from]) { S.villagers[par.from].friend += 4; S.villagers[par.from].req = null; }
      } else if (st.req && st.req.type !== 'deliver' && hasItem(st.req.item)) {
        await narr(`가방에 ${def.name}의 부탁이었던 <b>${josa(itemName(st.req.item), '이/가')}</b> 있다.`);
        const c = await Dialog.choose(['건네준다', '아직 안 준다'], { cancel: 1 });
        if (c === 0) {
          takeItem(st.req.item); const price = sellPrice(st.req.item, G.village.fruit);
          st.req = null; st.friend += 5; n.actor.play('joy', 0.8); n.actor.emote('heart', 1.4);
          await say(n, pick(L.reqDone), V());
          await giveReward(n, 1 + Math.min(3, price / 400));
        }
      } else if (S.player.stung && st.stungSeen !== today) { st.stungSeen = today; n.actor.play('surprise', 0.6); await say(n, pick(L.stung), V()); }
      else if (st.talkDay !== today) { st.talkDay = today; st.friend += 2; n.actor.play('nod', 0.5); await say(n, sleepy ? pick(L.sleepy) : greetLine(n), V()); }
      else if (st.talkN > 5) { n.actor.emote('sweat', 1.2); await say(n, pick(L.annoyed), V()); return; }
      else await say(n, chatLine(n), V({ o: otherName(id) }));
    }
    for (;;) {
      const c = await Dialog.choose(['얘기하자', '부탁할 일 없어?', '선물 줄게', '그만 가 볼게'], { cancel: 3 });
      if (c === 0) {
        st.talkN = (st.talkN || 0) + 1;
        if (st.talkN > 5) { n.actor.emote('sweat', 1.2); await say(n, pick(L.annoyed), V()); break; }
        n.actor.play('nod', 0.5);
        await say(n, chatLine(n), V({ o: otherName(id) }));
      } else if (c === 1) {
        if (st.req) {
          await say(n, pick(L.reqWait), V());
          if (st.req.type !== 'deliver') await narr(`(${def.name}의 부탁: <b>${itemName(st.req.item)}</b> 구해다 주기)`);
          else await narr(`(${def.name}의 부탁: <b>${VILLAGERS[st.req.to].name}</b>에게 꾸러미 전하기)`);
        } else if (st.reqAsked === today) await narr(`${josa(def.name, '은/는')} 지금은 딱히 부탁할 일이 없는 모양이다.`);
        else {
          const rq = makeRequest(id);
          if (rq.type === 'deliver' && !canAdd('parcel')) { await narr('가방이 가득 차서 부탁을 받을 수 없다.'); continue; }
          const key = { fish: 'reqFish', bug: 'reqBug', fruit: 'reqFruit', shell: 'reqShell', deliver: 'reqDeliver' }[rq.type];
          await say(n, pick(L[key]), V({ i: rq.item ? itemName(rq.item) : '', o: rq.to ? VILLAGERS[rq.to].name : '' }));
          const a = await Dialog.choose(['맡겨 줘', '미안, 다음에'], { cancel: 1 });
          st.reqAsked = today;
          if (a === 0) {
            st.req = rq;
            if (rq.type === 'deliver') { addItem('parcel'); S.parcels = S.parcels || []; S.parcels.push({ from: id, to: rq.to }); await narr(`<b>꾸러미</b>를 받았다. ${VILLAGERS[rq.to].name}에게 전해 주자.`); }
            n.actor.play('joy', 0.6);
          }
        }
      } else if (c === 2) {
        Dialog.close();
        const i = await pickFromBag(`${def.name}에게 줄 선물`, (iid) => !['tool', 'parcel', 'coin'].includes(ITEMS[iid].kind));
        if (i < 0) continue;
        const iid = S.inv[i].id, kind = ITEMS[iid].kind;
        removeAt(i, 1);
        const k2 = kind === 'fossilid' ? 'furniture' : kind;
        const like = def.likes.includes(k2);
        const bday = def.bday[0] === G.now.getMonth() + 1 && def.bday[1] === G.now.getDate();
        st.friend += st.giftDay === today ? 1 : (like ? 4 : 2) + (bday ? 8 : 0);
        st.giftDay = today;
        n.actor.play(like ? 'joy' : 'nod', 0.8); if (like) n.actor.emote('heart', 1.4);
        await say(n, pick(like ? L.giftLike : L.giftOk), V());
      } else break;
    }
    await say(n, pick(L.bye), V());
  } finally { n.talking = false; }
}

// ---------------------------------------------------------------- 가게
function shopBuyPanel() {
  return new Promise((res) => {
    const box = el('div');
    const draw = () => {
      box.innerHTML = '';
      box.appendChild(el('div', 'note', `가진 도토리: ${acorns(S.player.money)}　·　가구는 가게 안에 진열돼 있어요. 다가가서 살펴보세요.`));
      const list = el('div', 'list');
      const stock = [];
      for (const t of ['tool_shovel', 'tool_can', 'tool_axe', 'tool_net', 'tool_rod']) if (!hasItem(t)) stock.push(t);
      stock.push(...S.shop.seeds, 'sapling_blossom', 'sapling_pine', 'medicine', S.shop.wall, S.shop.floor);
      if (S.shop.fruit && !S.shop.sold.includes(S.shop.fruit)) stock.push(S.shop.fruit);
      for (const id of stock) {
        const it = ITEMS[id], price = it.kind === 'fruit' ? 900 : it.buy;
        const row = itemRow(id, it.desc, acorns(price));
        const b = el('button', 'btn go', '사기'); b.disabled = S.player.money < price || !canAdd(id);
        b.onclick = () => { addMoney(-price); addItem(id); if (it.kind === 'fruit') S.shop.sold.push(id); Sound.sfx('coin'); draw(); };
        row.appendChild(b); list.appendChild(row);
      }
      box.appendChild(list);
    };
    draw();
    UI.openPanel('까치네 만물상 — 사기', box, { onClose: res });
  });
}
function shopSellPanel() {
  return new Promise((res) => {
    const box = el('div'), picked = new Set();
    let sold = 0;
    const draw = () => {
      box.innerHTML = '';
      const list = el('div', 'list');
      let total = 0;
      S.inv.forEach((s, i) => {
        if (!s || ITEMS[s.id].kind === 'parcel') return;
        const price = sellPrice(s.id, G.village.fruit) * s.n;
        const row = itemRow(s.id, s.n > 1 ? `${s.n}개` : '', acorns(price));
        row.style.cursor = 'pointer';
        if (picked.has(i)) { row.classList.add('picked'); total += price; }
        row.onclick = () => { picked.has(i) ? picked.delete(i) : picked.add(i); Sound.sfx('ui'); draw(); };
        list.appendChild(row);
      });
      if (!list.children.length) list.appendChild(el('div', 'note', '팔 물건이 없다.'));
      const head = el('div', 'note', `팔 물건을 눌러 고르세요.　고른 것: ${picked.size}가지　합계 ${acorns(total)}　`);
      const all = el('button', 'btn', '채집한 것 모두 고르기');
      all.onclick = () => { S.inv.forEach((s, i) => { if (s && ['fish', 'bug', 'shell', 'fruit', 'misc', 'flower'].includes(ITEMS[s.id].kind)) picked.add(i); }); draw(); };
      const go = el('button', 'btn go', '팔기'); go.disabled = !picked.size; go.style.marginLeft = '6px';
      go.onclick = () => { for (const i of picked) { S.inv[i] = null; } addMoney(total); sold += total; picked.clear(); Sound.sfx('coin'); draw(); };
      head.appendChild(all); head.appendChild(go);
      box.appendChild(head); box.appendChild(list);
    };
    draw();
    UI.openPanel('까치네 만물상 — 팔기', box, { onClose: () => res(sold) });
  });
}
async function talkKkami() {
  const k = npcOf('kkami');
  await say(k, pick(['어서 와요, 어서 와! 까치네 만물상입니다. 오늘은 뭘 도와드릴까?', '{p} 손님 오셨네! 반짝이는 건 못 드려도 쓸 만한 건 다 있어요.', '까악! 아니, 어서 오세요. 천천히 둘러봐요.']));
  for (;;) {
    const c = await Dialog.choose(['물건을 사고 싶어', '팔 물건이 있어', '그냥 구경할게'], { cancel: 2 });
    if (c === 0) { Dialog.close(); await shopBuyPanel(); await say(k, '더 필요한 건 없어요?'); }
    else if (c === 1) { Dialog.close(); const sold = await shopSellPanel(); await say(k, sold > 0 ? `전부 해서 도토리 ${fmt(sold)}개! 좋은 물건 고마워요.` : '팔 게 생기면 언제든 가져와요.'); }
    else break;
  }
  await say(k, pick(['또 와요! 내일은 물건이 바뀐답니다.', '고마워요, 살펴 가요!']));
}
async function buyDisplay(room, i) {
  const it = room.items[i], def = ITEMS[it.id], k = npcOf('kkami');
  await say(k, `그건 <b>${def.name}</b>! ${def.series ? '시리즈로 모으면 방이 근사해져요. ' : ''}값은 도토리 ${fmt(it.sale)}개랍니다.`);
  const c = await Dialog.choose(['살게', '다음에'], { cancel: 1 });
  if (c !== 0) return;
  if (S.player.money < it.sale) { await say(k, '어머, 도토리가 모자라네요. 모아서 다시 와요.'); return; }
  if (!canAdd(it.id)) { await say(k, '가방이 가득 찼어요. 비우고 다시 와요.'); return; }
  addMoney(-it.sale); addItem(it.id); S.shop.sold.push(it.id);
  room.items.splice(i, 1); room.rebuildItems(); Sound.sfx('coin');
  await say(k, '탁월한 선택! 집에 가서 가방을 열고 놓아 보세요.');
}

// ---------------------------------------------------------------- 박물관
const CAT = { fish: '물고기', bug: '곤충', fossilid: '화석' };
function museumKey(id) { const it = ITEMS[id]; return it.kind === 'fish' ? ['fish', it.sp] : it.kind === 'bug' ? ['bug', it.sp] : ['fossil', id.slice(7)]; }
function isDonated(id) { const [c, k] = museumKey(id); return S.museum[c].includes(k); }
function factOf(id) { const it = ITEMS[id]; return it.kind === 'fish' ? FISH_BY_ID[it.sp].fact : it.kind === 'bug' ? BUG_BY_ID[it.sp].fact : it.fact; }
export function museumProgress() { return { fish: [S.museum.fish.length, FISH.filter((f) => !f.trash).length], bug: [S.museum.bug.length, BUGS.length], fossil: [S.museum.fossil.length, FOSSILS.length] }; }

async function talkDuru() {
  const d = npcOf('duru');
  await say(d, pick(['어서 오세요. 마을 박물관의 두루입니다. 오늘은 어떤 걸 가져오셨는지요?', '흠흠, {p} 님이시군요. 조용히 둘러보셔도 좋고, 기증은 언제나 환영입니다.']));
  for (;;) {
    const c = await Dialog.choose(['기증할게요', '화석을 감정해 주세요', '전시 현황이 궁금해요', '안녕히 계세요'], { cancel: 3 });
    if (c === 0) {
      const idxs = []; const seen = new Set();
      S.inv.forEach((s, i) => { if (s && isDonatable(s.id) && !isDonated(s.id) && !seen.has(s.id)) { seen.add(s.id); idxs.push(i); } });
      if (!idxs.length) { await say(d, '지금 가지신 것 가운데 새로 기증하실 만한 건 없군요. 처음 보는 것이 생기면 꼭 보여 주십시오.'); continue; }
      for (const i of idxs) {
        const id = S.inv[i].id; const [cat, key] = museumKey(id);
        removeAt(i, 1); S.museum[cat].push(key);
        Sound.sfx('catch');
        await say(d, `오오, <b>${itemName(id)}</b>! 귀한 걸 주셨습니다.`);
        const f = factOf(id); if (f) await say(d, f);
      }
      await say(d, `덕분에 전시가 ${idxs.length}점 늘었습니다. 고맙습니다.`);
    } else if (c === 1) {
      const n = countItem('fossil');
      if (!n) { await say(d, '감정할 화석이 없으시군요. 땅에 별 모양으로 갈라진 자리가 보이면 삽으로 파 보십시오.'); continue; }
      await say(d, `화석이 ${n}개 있군요. 어디 봅시다… 흠, 흠흠.`);
      for (let k = 0; k < n; k++) {
        takeItem('fossil');
        const notYet = FOSSILS.filter((f) => !S.museum.fossil.includes(f[0]) && !hasItem('fossil_' + f[0]));
        const f = notYet.length && rand() < 0.75 ? pick(notYet) : pick(FOSSILS);
        const id = 'fossil_' + f[0];
        S.dex.fossil[f[0]] = (S.dex.fossil[f[0]] || 0) + 1;
        Sound.sfx('alert');
        await say(d, `이건… <b>${f[1]}</b>입니다!`);
        if (!S.museum.fossil.includes(f[0])) {
          const a = await Dialog.choose(['기증할게요', '제가 가질게요'], { cancel: 1 });
          if (a === 0) { S.museum.fossil.push(f[0]); await say(d, f[3]); continue; }
        } else await say(d, '이미 전시하고 있는 것이니 가져가셔도 좋습니다.');
        addItem(id);
      }
    } else if (c === 2) {
      const pr = museumProgress();
      await say(d, `지금까지 물고기 ${pr.fish[0]}/${pr.fish[1]}종, 곤충 ${pr.bug[0]}/${pr.bug[1]}종, 화석 ${pr.fossil[0]}/${pr.fossil[1]}점이 모였습니다.`);
      const tot = pr.fish[0] + pr.bug[0] + pr.fossil[0];
      await say(d, tot === 0 ? '아직은 텅 비어 있지요. 첫 기증의 주인공이 되어 주시겠습니까?' : tot < 30 ? '갈 길이 멀지만, 박물관은 원래 천천히 채우는 곳입니다.' : '이만하면 어디 내놓아도 부끄럽지 않은 박물관입니다. 전부 {p} 님 덕분이지요.');
    } else break;
  }
  await say(d, '또 오십시오. 박물관은 밤에도 열려 있습니다.');
}

// ---------------------------------------------------------------- 마을회관
async function talkUjik() {
  const u = npcOf('ujik'), P = S.player;
  await say(u, pick(['어서 오게, {p}! 마을 살림은 할 만한가?', '오, 왔는가. 무슨 일로 왔나?']));
  for (;;) {
    const c = await Dialog.choose(['집 문제로 왔어요', '마을 소식이 궁금해요', '아니에요'], { cancel: 2 });
    if (c === 0) {
      if (P.loan > 0) {
        await say(u, `남은 집값이 <b>도토리 ${fmt(P.loan)}개</b>일세. 자네 주머니엔 ${fmt(P.money)}개가 있구먼.`);
        const opts = ['전부 갚을게요', '1,000개만 갚을게요', '5,000개만 갚을게요', '다음에 갚을게요'];
        const a = await Dialog.choose(opts, { cancel: 3 });
        const want = a === 0 ? P.loan : a === 1 ? 1000 : a === 2 ? 5000 : 0;
        if (!want) continue;
        const pay = Math.min(want, P.loan, P.money);
        if (pay <= 0) { await say(u, '허허, 빈 주머니로는 못 갚지. 천천히 벌어서 오게.'); continue; }
        P.money -= pay; P.loan -= pay; Sound.sfx('coin');
        if (P.loan <= 0) { Sound.sfx('fanfare'); G.player.actor.play('joy', 1); await say(u, '다 갚았구먼! 장하네, 장해. 이제 그 집은 온전히 자네 것일세.'); if (P.houseLv < 3) await say(u, '살다가 집이 좁다 싶으면 말하게. 넓혀 줄 수 있으니.'); }
        else await say(u, `도토리 ${fmt(pay)}개 받았네. 남은 건 ${fmt(P.loan)}개일세.`);
      } else if (P.houseLv < 3) {
        const cost = LOANS[P.houseLv], [w, h] = ROOM_SIZE[P.houseLv + 1];
        await say(u, `집을 넓혀 볼 텐가? 방이 ${w}×${h}칸으로 커진다네. 값은 <b>도토리 ${fmt(cost)}개</b>. 먼저 짓고 나중에 갚으면 되네.`);
        const a = await Dialog.choose(['넓혀 주세요', '좀 더 생각해 볼게요'], { cancel: 1 });
        if (a === 0) {
          P.houseLv++; P.loan = cost;
          const b = G.village.buildings.find((x) => x.type === 'home'); G.world.refreshBuilding(b);
          Sound.sfx('fanfare');
          await say(u, '좋아, 맡겨 두게! …뚝딱뚝딱. 다 됐네. 이 우직이 일솜씨가 좀 빠르지. 가서 보게나.');
        }
      } else await say(u, '자네 집은 이제 더 넓힐 데가 없네. 마을에서 제일 큰 집이야!');
    } else if (c === 1) {
      const names = S.residents.map((id) => VILLAGERS[id].name).join(', ');
      await say(u, `지금 우리 마을엔 ${names}, 그리고 자네까지 ${S.residents.length + 1}명이 산다네.`);
      const m = G.now.getMonth() + 1, d = G.now.getDate();
      const b = S.residents.map((id) => VILLAGERS[id]).filter((v) => v.bday[0] === m && v.bday[1] >= d).sort((a, b2) => a.bday[1] - b2.bday[1])[0];
      if (b) await say(u, `이번 달 ${b.bday[1]}일은 ${b.name}의 생일일세. 선물 하나 챙겨 주면 좋아할 걸세.`);
      else await say(u, pick(['해변에는 날마다 조개가 밀려온다네. 주워다 팔면 쏠쏠하지.', '비 오는 날에만 나오는 녀석들도 있다네. 궂은 날이라고 집에만 있지 말게.', '과일은 따고 나서 사흘이면 다시 열린다네.', '꽃에 물을 주면 다음 날 옆에 새 꽃이 필 때가 있지. 색이 섞이기도 하고.']));
    } else break;
  }
  await say(u, '그럼 살펴 가게!');
}

export async function intro() {
  const u = npcOf('ujik');
  for (const [, line] of NPC_TALK.intro) await say(u, line, { loan: fmt(LOANS[0]) });
  S.flags.intro = true;
  mailLetter();
  save();
}
function mailLetter() {
  S.mail.unshift({ from: 'ujik', name: '우직 이장', text: `${S.player.name}에게.\n\n이사를 축하하네.\n농사지은 것 조금 넣었으니 요긴하게 쓰게.\n모르는 건 마을회관으로 물으러 오고.\n\n이장 우직`, item: 'tool_shovel', read: false, day: S.day });
}

// ---------------------------------------------------------------- 건물 드나들기
function wrapNpc(id) { const def = VILLAGERS[id]; return { id, name: def.name, pitch: PERSONALITY[def.p].pitch }; }
function roomSpec(b) {
  if (b.type === 'home') {
    const [w, h] = ROOM_SIZE[S.player.houseLv];
    return { id: 'home', w, h, wall: S.home.wall, floor: S.home.floor, items: S.home.items, editable: true };
  }
  if (b.type === 'shop') {
    const spots = [[0, 0], [6, 0], [0, 2], [6, 2], [1, 4]];
    const items = [{ id: 'p_counter', x: 3, y: 1, w: 2, d: 1, r: 0 }, { id: 'p_plant', x: 7, y: 5, r: 0 }];
    S.shop.furn.filter((f) => !S.shop.sold.includes(f)).forEach((f, i) => { if (spots[i]) items.push({ id: f, x: spots[i][0], y: spots[i][1], r: 0, sale: ITEMS[f].buy }); });
    return { id: 'shop', w: 8, h: 6, wall: 'wall_wood', floor: 'floor_wood', items, npcDefs: [{ model: 'npc_kkami', name: NPCS.kkami.name, x: 4, z: 0.6, fixed: true, talk: () => runScript(talkKkami) }] };
  }
  if (b.type === 'museum') {
    const pr = museumProgress();
    const show = (title, cat) => () => runScript(async () => { await narr(`${title} 전시. 지금까지 ${pr[cat][0]}/${pr[cat][1]}${cat === 'fossil' ? '점' : '종'}이 모였다.`); });
    return {
      id: 'museum', w: 10, h: 7, wall: 'wall_cream', floor: 'floor_stone',
      items: [{ id: 'p_desk', x: 4, y: 1, w: 2, d: 1, r: 0 }, { id: 'p_skeleton', x: 0, y: 2, w: 2, d: 1, r: 0, act: show('화석', 'fossil'), actLabel: '화석 전시 보기' },
        { id: 'p_tank', x: 8, y: 2, w: 2, d: 1, r: 0, act: show('물고기', 'fish'), actLabel: '수조 보기' }, { id: 'p_bugcase', x: 8, y: 5, r: 0, act: show('곤충', 'bug'), actLabel: '표본 보기' },
        { id: 'p_plant', x: 0, y: 6, r: 0 }, { id: 'p_plant', x: 0, y: 0, r: 0 }, { id: 'p_plant', x: 9, y: 0, r: 0 }],
      npcDefs: [{ model: 'npc_duru', name: NPCS.duru.name, x: 5, z: 0.6, fixed: true, talk: () => runScript(talkDuru) }],
    };
  }
  if (b.type === 'hall') {
    return {
      id: 'hall', w: 8, h: 6, wall: 'wall_hanji', floor: 'floor_dark',
      items: [{ id: 'p_desk', x: 3, y: 1, w: 2, d: 1, r: 0 }, { id: 'f_log_shelf', x: 0, y: 0, r: 0 }, { id: 'f_clock', x: 7, y: 0, r: 0 }, { id: 'p_plant', x: 0, y: 5, r: 0 }, { id: 'f_bookpile', x: 6, y: 0, r: 0 }, { id: 'f_bangseok', x: 1, y: 3, r: 0 }, { id: 'f_bangseok', x: 6, y: 3, r: 0 }],
      npcDefs: [{ model: 'npc_ujik', name: NPCS.ujik.name, x: 4, z: 0.6, fixed: true, talk: () => runScript(talkUjik) }],
    };
  }
  const vid = Object.keys(S.villagers).find((k) => S.villagers[k].lot === b.lot), def = VILLAGERS[vid];
  const [wall, floor] = HOME_STYLE[def.set];
  const n = wrapNpc(vid);
  return {
    id: 'v:' + vid, w: 6, h: 5, wall, floor, items: HOME_LAYOUT[def.set].map(([id, x, y]) => ({ id, x, y, r: 0 })),
    npcDefs: [{ ...n, model: 'villager_' + vid, x: 3.5, z: 2.5, talk: (self) => runScript(async () => { if (!S.villagers[vid].homeSeen || S.villagers[vid].homeSeen !== dayKey()) { S.villagers[vid].homeSeen = dayKey(); await say(n, pick(TALK[def.p].home), vvars(n)); } await talkVillager(self); }) }],
  };
}

export async function enter(b) {
  await runScript(async () => {
    const h = hourF();
    if (b.type === 'shop' && (h < 8 || h >= 22)) { Sound.sfx('fail'); await narr('문이 잠겨 있다. 팻말에 "아침 8시부터 밤 10시까지"라고 적혀 있다.'); return; }
    if (b.type === 'house') {
      const vid = Object.keys(S.villagers).find((k) => S.villagers[k].lot === b.lot);
      if (!vid) { await narr('아직 빈 집터다. 언젠가 새 이웃이 이사 올 자리.'); return; }
      const npc = G.npcs.find((n) => n.id === vid);
      if (!villagerAwake(vid)) { Sound.sfx('fail'); await narr('불이 꺼져 있다. 자고 있는 모양이다.'); return; }
      if (npc && npc.visible) { Sound.sfx('fail'); await narr(`문을 두드려 봤지만 대답이 없다. ${josa(VILLAGERS[vid].name, '은/는')} 밖에 나가 있는 모양이다.`); return; }
    }
    Sound.sfx('door');
    await UI.fade(true);
    S.player.x = b.doors[0] + 0.5; S.player.z = b.y + b.d + 0.5;
    if (G.player.fishing) G.player.endFishing();
    G.world.setVisible(false); G.critters.setVisible(false); setVillagersVisible(false);
    G.room = new Room(roomSpec(b));
    G.room.building = b;
    G.stage.setMode(true, G.room.h);
    G.player.setPos(G.room.w / 2, G.room.h - 0.7); G.player.yaw = Math.PI; G.player.actor.face(Math.PI, true);
    const f = G.room.focus(G.player.x, G.player.z); G.stage.setFocus(f.x, 0, f.z, true);
    refreshTime(true);
    await UI.fade(false);
  });
}
export async function exitRoom() {
  await runScript(async () => {
    Sound.sfx('door');
    await UI.fade(true);
    const b = G.room.building;
    G.room.dispose(); G.room = null;
    G.world.setVisible(true); G.critters.setVisible(true); syncVillagers(); setVillagersVisible(true);
    G.stage.setMode(false);
    G.player.setPos(b.doors[0] + 0.5, b.y + b.d + 0.45); G.player.yaw = 0; G.player.actor.face(0, true);
    G.stage.setFocus(G.player.x, 0, G.player.z, true);
    refreshTime(true); save();
    await UI.fade(false);
  });
}

// ---------------------------------------------------------------- 잡았다!
function holdUp(model, tint, scale = 1) {
  const a = G.player.actor;
  const o = make(model, tint ? { tint } : {});
  o.scale.setScalar(scale); o.position.set(0, a.topY + 0.25, 0);
  a.root.add(o); a.play('show', 99); a.face(0);
  return () => { a.root.remove(o); a.anim = null; };
}
export function caughtFish(sp) {
  runScript(async () => {
    const id = 'fish_' + sp.id;
    const cm = Math.round((sp.cm[0] + rand() * (sp.cm[1] - sp.cm[0])) * 10) / 10;
    const d = S.dex.fish[sp.id], isNew = !d && !sp.trash;
    if (!sp.trash) S.dex.fish[sp.id] = { n: (d ? d.n : 0) + 1, max: Math.max(d ? d.max : 0, cm) };
    const done = holdUp('fish_' + sp.id, null, Math.min(1.1, 0.9 / (sp.look.len || 0.8)));
    Sound.sfx(isNew ? 'fanfare' : sp.trash ? 'fail' : 'catch');
    if (!sp.trash) burst('spark', G.player.x, 2, G.player.z, 8);
    await UI.card({ id, title: sp.say, sub: sp.trash ? '' : `${cm}cm${d && cm > d.max ? ' · 내 최고 기록!' : ''}`, isNew });
    done();
    S.stats.fish++;
    if (!addItem(id)) UI.toast(sp.trash ? '가방이 가득 차서 그냥 두고 왔다.' : '가방이 가득 차서 놓아주었다.');
  });
}
export function caughtBug(b) {
  runScript(async () => {
    const sp = b.sp, id = 'bug_' + sp.id, d = S.dex.bug[sp.id], isNew = !d;
    S.dex.bug[sp.id] = { n: (d ? d.n : 0) + 1 };
    const done = holdUp('bug_' + sp.id, null, 2.2);
    Sound.sfx(isNew ? 'fanfare' : 'catch'); burst('spark', G.player.x, 2, G.player.z, 8);
    await UI.card({ id, title: sp.say, sub: '', isNew });
    done();
    S.stats.bug++;
    if (!addItem(id)) UI.toast('가방이 가득 차서 놓아주었다.');
  });
}
export function stung() {
  S.player.stung = true;
  Sound.sfx('sting'); G.stage.shake = 0.2;
  G.player.do('ouch', 0.9);
  G.player.actor.emote('sweat', 1.6);
  UI.toast('아야! 벌에 쏘였다… 약을 먹거나 하루 지나면 낫는다.', 3600);
}

export function registerScripts() {
  Object.assign(G.hooks, {
    talk: (n) => runScript(() => talkVillager(n)),
    enter, exit: exitRoom, caughtFish, caughtBug, stung, buyDisplay: (room, i) => runScript(() => buyDisplay(room, i)),
    syncVillagers: () => { if (!G.room) syncVillagers(); },
    minute: () => { if (!G.room) syncVillagers(); },
  });
}
