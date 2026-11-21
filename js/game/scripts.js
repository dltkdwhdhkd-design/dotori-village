// 대본: 주민과의 대화, 가게·박물관·마을회관, 건물 드나들기, 잡았을 때의 연출
import * as THREE from 'three';
import { G, runScript, save, refreshTime, burst, groundY } from './game.js';
import { Room } from './rooms.js';
import { atelierSpec, campsiteSpec, freeLots } from './island.js';
import { museumSpec } from './museum.js';
import { COST, stepId, advance, canPay, costText, donated, species, greeted, festivalReady, track, refreshGoal } from './quests.js';
import { Villager, villagerAwake, villagerOut, syncVillagers, setVillagersVisible } from './npc.js';
import { S, addItem, canAdd, takeItem, hasItem, countItem, freeSlots, addMoney, removeAt, LOANS, ROOM_SIZE } from './state.js';
import { ITEMS, FISH, BUGS, FISH_BY_ID, BUG_BY_ID, FOSSILS, FURNITURE, WALLS, FLOORS, FRUIT_KO, SHELL_IDS, itemName, sellPrice, isDonatable } from '../data/items.js';
import { VILLAGERS, PERSONALITY, NPCS, HOME_LAYOUT, HOME_STYLE } from '../data/villagers.js';
import { VOICES, voice, seasonalVoice } from '../data/voices.js';
import { speak } from './speech.js';
import { NPC_TALK } from '../data/talk.js';
import { UI, Dialog, fill, itemRow, acorns } from '../ui/ui.js';
import { Sound } from '../core/audio.js';
import { make } from '../gfx/models.js';
import { flatYaw } from '../gfx/thumbs.js';
import { Actor } from '../gfx/actor.js';
import { dayKey, hourF, inMonths, inHours, season } from '../core/clock.js';
import { rand, fmt, josa, el, wait } from '../core/util.js';

const pick = (a) => a[Math.floor(rand() * a.length)];
const narr = (t) => Dialog.say('', t);
const say = (who, text, vars = {}) => VOICES[who.id] ? speak(who,text,vars) : Dialog.say(who.name, fill(text, { p: S.player.name, v: S.village.name, ...vars }), { pitch: who.pitch || 1, actor: who.actor || null });
const npcOf = (k) => ({ name: NPCS[k].name, pitch: NPCS[k].pitch });
const haveMat = (c) => Object.entries(c).map(([k, n]) => `${{ wood: '나무', stone: '돌', money: '도토리' }[k]} ${fmt(Math.min(n, k === 'money' ? S.player.money : countItem('mat_' + k)))}/${fmt(n)}`).join(', ');
function payCost(c) { for (const [k, n] of Object.entries(c)) { if (k === 'money') addMoney(-n); else takeItem('mat_' + k, n); } }
const refreshBld = (type) => { const b = G.village.buildings.find((x) => x.type === type); if (b && G.world) G.world.refreshBuilding(b); };
/** 새 이웃이 들어올 집터를 하나 잡아 둔다(다음 날 그 자리에 집이 선다) */
function reserveLot() {
  const used = new Set(Object.values(S.villagers).map((v) => v.lot)), pd = S.prog.pend;
  pd.sites = pd.sites || [];
  const lot = freeLots()[0];
  if (lot == null) return;
  pd.sites.push(lot);
  const b = G.village.buildings.find((x) => x.lot === lot);
  if (b && G.world) G.world.refreshBuilding(b);
}

// ---------------------------------------------------------------- 주민과 대화
function vvars(n, extra = {}) { const def = VILLAGERS[n.id]; return { me: def.name, c: def.catch, f: FRUIT_KO[G.village.fruit], ...extra }; }
function otherName(id) { const o = S.residents.filter((x) => x !== id); return o.length ? VILLAGERS[pick(o)].name : '이장님'; }

function chatLine(n) {
  const v=VILLAGERS[n.id],lines=[...voice(n.id,'chat')],now=G.now;
  if(v.bday[0]===now.getMonth()+1 && v.bday[1]===now.getDate())return voice(n.id,'bday');
  lines.push(seasonalVoice(n.id,season(now)));
  if(G.weather==='rain' || G.weather==='snow')lines.push(voice(n.id,G.weather),voice(n.id,G.weather));
  const memory=S.islandLife?.story;
  if(memory?.rescue===6 && VOICES[n.id].rescue)lines.push(VOICES[n.id].rescue);
  if(memory?.grade===5 && VOICES[n.id].grade)lines.push(VOICES[n.id].grade);
  const choices=lines.filter(line=>line!==n.lastChat);
  n.lastChat=pick(choices.length?choices:lines);return n.lastChat;
}
function greetLine(n) {
  const h=hourF();return voice(n.id,'greet')[h>=5 && h<11?0:h>=11 && h<17?1:h>=17 && h<21?2:3];
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
  const id = n.id, st = S.villagers[id], def = VILLAGERS[id], L = VOICES[id], today = dayKey(), p = G.player;
  if (!st) return;
  n.talking = true;
  p.actor.faceTo(n.x, n.z); n.actor.faceTo(p.x, p.z);
  const V = (x) => vvars(n, x);
  try {
    let h = hourF(); if (h < 5) h += 24;
    const sleepy = h > PERSONALITY[def.p].sleep - 0.5;
    if (st.talkT !== today) { st.talkT = today; track('talk'); }
    if (!st.met) { st.met = true; refreshGoal(); st.friend += 3; st.talkDay = today; n.actor.play('wave', 0.9); await say(n, L.hello, V()); }
    else {
      const par = (S.parcels || []).find((q) => q.to === id);
      if (par && hasItem('parcel')) {
        takeItem('parcel'); S.parcels = S.parcels.filter((q) => q !== par);
        n.actor.play('joy', 0.8);
        await say(n, L.recv, V({ o: VILLAGERS[par.from].name }));
        await giveReward(n, 1);
        st.friend += 3;
        if (S.villagers[par.from]) { S.villagers[par.from].friend += 4; S.villagers[par.from].req = null; }
      } else if (st.req && st.req.type !== 'deliver' && hasItem(st.req.item)) {
        await narr(`가방에 ${def.name}의 부탁이었던 <b>${josa(itemName(st.req.item), '이/가')}</b> 있다.`);
        const c = await Dialog.choose(['건네준다', '아직 안 준다'], { cancel: 1 });
        if (c === 0) {
          takeItem(st.req.item); const price = sellPrice(st.req.item, G.village.fruit);
          st.req = null; st.friend += 5; n.actor.play('joy', 0.8); n.actor.emote('heart', 1.4);
          await say(n, L.thanks, V());
          await giveReward(n, 1 + Math.min(3, price / 400));
        }
      } else if (S.player.stung && st.stungSeen !== today) { st.stungSeen = today; n.actor.play('surprise', 0.6); await say(n, L.stung, V()); }
      else if (st.talkDay !== today) { st.talkDay = today; st.friend += 2; n.actor.play('nod', 0.5); await say(n, sleepy ? voice(id,'sleepy') : greetLine(n), V()); }
      else if (st.talkN > 5) { n.actor.emote('sweat', 1.2); await say(n, voice(id,'annoyed'), V()); return; }
      else await say(n, chatLine(n), V({ o: otherName(id) }));
    }
    for (;;) {
      const c = await Dialog.choose(['얘기하자', '부탁할 일 없어?', '선물 줄게', '그만 가 볼게'], { cancel: 3 });
      if (c === 0) {
        st.talkN = (st.talkN || 0) + 1;
        if (st.talkN > 5) { n.actor.emote('sweat', 1.2); await say(n, voice(id,'annoyed'), V()); break; }
        n.actor.play('nod', 0.5);
        await say(n, chatLine(n), V({ o: otherName(id) }));
      } else if (c === 1) {
        if (st.req) {
          await say(n, L.wait, V());
          if (st.req.type !== 'deliver') await narr(`(${def.name}의 부탁: <b>${itemName(st.req.item)}</b> 구해다 주기)`);
          else await narr(`(${def.name}의 부탁: <b>${VILLAGERS[st.req.to].name}</b>에게 꾸러미 전하기)`);
        } else if (st.reqAsked === today) await narr(`${josa(def.name, '은/는')} 지금은 딱히 부탁할 일이 없는 모양이다.`);
        else {
          const rq = makeRequest(id);
          if (rq.type === 'deliver' && !canAdd('parcel')) { await narr('가방이 가득 차서 부탁을 받을 수 없다.'); continue; }
          const key=rq.type==='deliver'?'deliver':'request';
          await say(n, L[key], V({ i: rq.item ? itemName(rq.item) : '', o: rq.to ? VILLAGERS[rq.to].name : '' }));
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
        await say(n, like ? L.giftLike : L.giftOk, V());
      } else break;
    }
    await say(n, L.bye, V());
  } finally { n.talking = false; }
}

// ---------------------------------------------------------------- 가게
function shopBuyPanel() {
  return new Promise((res) => {
    const box = el('div');
    const draw = () => {
      box.innerHTML = '';
      const tent = S.prog.shop < 2;
      box.appendChild(el('div', 'note', `가진 도토리: ${acorns(S.player.money)}　·　${tent ? '가게를 번듯하게 지으면 가구와 벽지도 들여놓는대요.' : '가구는 가게 안에 진열돼 있어요. 다가가서 살펴보세요.'}`));
      const list = el('div', 'list');
      const stock = [];
      for (const t of ['tool_shovel', 'tool_can', 'tool_axe', 'tool_net', 'tool_rod']) if (!hasItem(t)) stock.push(t);
      stock.push(...S.shop.seeds, 'sapling_blossom', 'sapling_pine', 'medicine');
      if (!tent) { stock.push(S.shop.wall, S.shop.floor); if (S.shop.fruit && !S.shop.sold.includes(S.shop.fruit)) stock.push(S.shop.fruit); }
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
    UI.openPanel('까미네 만물상 — 사기', box, { onClose: res });
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
      go.onclick = () => { for (const i of picked) { S.inv[i] = null; } addMoney(total); sold += total; track('sell', total); picked.clear(); Sound.sfx('coin'); draw(); };
      head.appendChild(all); head.appendChild(go);
      box.appendChild(head); box.appendChild(list);
    };
    draw();
    UI.openPanel('까미네 만물상 — 팔기', box, { onClose: () => res(sold) });
  });
}
async function talkKkami() {
  const k = npcOf('kkami'), P = S.prog, tent = P.shop < 2;
  if (!P.met.kkami) {
    P.met.kkami = true; refreshGoal();
    await say(k, '어서 와요, {p}! 이 포셰트, 제가 한 땀씩 꿰맨 거예요. 작은데 제법 많이 들어가죠? 전 여기서 만물상을 맡은 까미예요.');
    await say(k, tent ? '지금은 천막 좌판이지만, 언젠가는 번듯한 가게를 차릴 거예요. 물고기든 과일이든 뭐든 사 드릴게요!' : '필요한 건 뭐든 말해요. 물고기든 과일이든 뭐든 사 드릴게요!');
  } else await say(k,pick(tent?['아, 천 조각이 소매에 붙었네요. 방금 포셰트 안감을 다는 중이었어요. 뭘 찾으세요?','천막 안으로 오세요. 오늘은 단추를 색깔별로 놓아 봤어요.']:['새 끈을 달았더니 가방이 꼭 새 물건 같죠? 편히 둘러보세요.','작은 주머니 하나면 주운 도토리도 잃어버리지 않더라고요. 뭐 도와드릴까요?']));
  for (;;) {
    const build = stepId() === 'shop' && tent && !P.pend.shop;
    const opts = ['물건을 사고 싶어', '팔 물건이 있어'].concat(build ? ['가게 지을 재료를 가져왔어'] : [], ['그냥 구경할게']);
    const c = await Dialog.choose(opts, { cancel: opts.length - 1 });
    if (c === 0) { Dialog.close(); await shopBuyPanel(); await say(k, '더 필요한 건 없어요?'); }
    else if (c === 1) { Dialog.close(); const sold = await shopSellPanel(); await say(k, sold > 0 ? `전부 해서 도토리 ${fmt(sold)}개! 좋은 물건 고마워요.` : '팔 게 생기면 언제든 가져와요.'); }
    else if (build && c === 2) {
      if (!canPay(COST.shop)) { await say(k, `정말요?! 가게를 지으려면 <b>${costText(COST.shop)}</b>가 있어야 해요. 지금은 ${haveMat(COST.shop)}이네요. 조금만 더 부탁해요!`); continue; }
      payCost(COST.shop); P.pend.shop = dayKey() + 1; Sound.sfx('fanfare');
      await say(k, '와, 이거면 충분해요! 내일이면 번듯한 가게가 설 거예요.');
      await say(k, '가게가 서면 가구랑 벽지도 들여놓을게요. 날마다 물건이 바뀌니까 자주 들러요!');
      advance();
    } else break;
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

/** 기증품이 넉넉히 모이면 천막을 박물관 건물로 */
async function museumGrow(d) {
  const P = S.prog;
  if (stepId() !== 'museum' || P.museum !== 1 || P.pend.museum || donated() < COST.museum) return;
  P.pend.museum = { day: dayKey() + 1, to: 2 }; Sound.sfx('fanfare');
  await say(d, `기증품이 ${donated()}점이 되었습니다! 이만하면 천막으로는 좁지요.`);
  await say(d, '이장님께 말씀드려 박물관 건물을 짓겠습니다. 내일이면 문을 엽니다. 전시관에서 기증하신 것을 직접 보실 수 있을 겁니다.');
  advance();
}
async function talkDuru() {
  const d = npcOf('duru'), P = S.prog;
  if (P.museum < 2 && !P.met.duru) {
    P.met.duru = true;
    await say(d, '두루라고 해요. 라멘 가게 로의 주방을 잠깐 맡기고 나왔어요. 이 마을에선 생물 조사도 돕기로 했거든요.');
    await say(d, `물고기든 곤충이든 화석이든, 처음 보는 것이 있으면 가져다주십시오. <b>${COST.museum}점</b>이 모이면 박물관을 지을 수 있습니다.`);
  } else await say(d,pick(P.museum<2?['어서 와요. 가져온 걸 하나씩 볼까요? 이쪽에 차례대로 놓아 줘요.']:['어서 와요. 새로 들어온 표본부터 볼까요?','잠깐 앞치마 좀 풀고요. 어떤 걸 가져왔어요?']));
  await museumGrow(d);
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
      await say(d, `덕분에 ${P.museum < 2 ? '표본' : '전시'}이 ${idxs.length}점 늘었습니다. 고맙습니다.`);
      track('donate', idxs.length);
      await museumGrow(d);
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
          if (a === 0) { S.museum.fossil.push(f[0]); track('donate'); await say(d, f[3]); continue; }
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
  await museumGrow(d);
  await say(d, P.museum >= 2 ? '또 오십시오. 기증하신 것은 뒤쪽 전시관에서 직접 보실 수 있습니다.' : P.pend.museum ? '또 오십시오. 내일부터는 박물관에서 뵙겠습니다.' : '또 오십시오. 기증품이 모이면 박물관을 지을 수 있습니다.');
}

// ---------------------------------------------------------------- 마을회관
/** 마을 키우기: 이장에게 지금 할 일을 알리거나 다음 일을 받는다 */
async function storyUjik(u) {
  const Q = S.prog, id = stepId(), P = S.player, tm = dayKey() + 1;
  if (id === 'hello') {
    await say(u, '오, 왔구먼. 천막에서 하룻밤은 지낼 만하던가?');
    await say(u, '보다시피 우리 마을은 이제 막 시작이라네. 사는 이는 자네까지 셋, 가게는 까미의 천막 좌판 하나가 전부지.');
    await say(u, '자네가 조금만 거들어 주면 번듯한 마을이 될 걸세. 할 일은 <b>수첩(N)</b>에 적어 두었으니 틈틈이 펴 보게.');
    addMoney(500); Sound.sfx('coin');
    await say(u, '자, 이사 축하금으로 <b>도토리 500개</b>를 주지. 우선 이웃 둘하고 까미한테 인사부터 다녀오게. 다녀와서 내게 알려 주고.');
    advance();
  } else if (id === 'greet') {
    if (greeted() < 3) { await say(u, `아직 인사를 다 못 다녔구먼. 이웃 둘과 천막 가게의 까미, 이렇게 셋일세. 지금까지 ${greeted()}명을 만났군.`); return; }
    await say(u, '다들 반가워하던가? 좋아, 좋아. 이웃끼리 얼굴을 알아야 마을이지.');
    if (!hasItem('tool_can') && canAdd('tool_can')) { addItem('tool_can'); Sound.sfx('pick'); await say(u, '이 <b>물뿌리개</b>를 받게. 꽃에 물을 주면 다음 날 옆에 새 꽃이 피기도 한다네.'); }
    await say(u, `다음은 이 마을에 어떤 생물이 사는지 알아봐 주게. 물고기든 곤충이든 <b>${COST.five}종</b>만 잡아 보고 오면 되네.`);
    advance();
  } else if (id === 'five') {
    if (species() < COST.five) { await say(u, `아직 ${species()}종이로구먼. ${COST.five}종이 되면 다시 오게. 강과 바다, 꽃밭과 나무를 두루 살펴보게나.`); return; }
    await say(u, `벌써 ${species()}종이나! 이만하면 내 오랜 벗 두루를 부를 만하겠어.`);
    await say(u, '두루는 생물을 연구하는 학자라네. 내일이면 마을에 조사 천막을 칠 걸세. 잡은 것을 가져다주면 무척 좋아할 거야.');
    Q.pend.museum = { day: tm, to: 1 }; refreshBld('museum');
    addMoney(1000); Sound.sfx('coin');
    await say(u, '수고비로 <b>도토리 1,000개</b>를 주지.');
    await say(u, `그리고 자네도 언제까지 천막에서 살 수는 없지. <b>${costText(COST.house)}</b>를 구해 오면 집을 지어 주겠네. 도끼는 까미네 좌판에서 판다네.`);
    advance();
  } else if (id === 'house') {
    if (!canPay(COST.house)) { await say(u, `집을 지으려면 <b>${costText(COST.house)}</b>가 있어야 하네. 지금 가진 건 ${haveMat(COST.house)}일세.`); await say(u, '도끼로 나무를 찍으면 나무가 나온다네. 한 그루를 세 번 찍으면 쓰러지니, 두 번씩만 찍으면 숲이 남아나지.'); return; }
    await say(u, `나무를 다 구해 왔구먼! 집값은 <b>도토리 ${fmt(LOANS[0])}개</b>일세. 먼저 짓고, 벌리는 대로 와서 갚으면 되네.`);
    if (await Dialog.choose(['집을 지어 주세요', '조금 더 있다가요'], { cancel: 1 }) !== 0) return;
    payCost(COST.house); Q.pend.home = tm; Sound.sfx('fanfare');
    await say(u, '좋아, 맡겨 두게! 내일 아침이면 천막 자리에 집이 서 있을 걸세.');
    await say(u, '그동안 까미를 좀 도와주게. 좌판 대신 번듯한 가게를 짓고 싶다더군.');
    advance();
  } else if (id === 'shop') {
    await say(u, `까미가 가게 지을 재료를 모으고 있다네. <b>${costText(COST.shop)}</b>라던가. 돌은 삽으로 바위를 두드리면 나온다네.`);
  } else if (id === 'museum') {
    await say(u, Q.museum < 1 ? '두루의 천막은 내일이면 설 걸세. 그동안 물고기랑 곤충을 넉넉히 잡아 두게.' : `두루에게 기증한 것이 ${donated()}점이로구먼. ${COST.museum}점이 되면 박물관 건물을 지을 수 있다더군.`);
  } else if (id === 'lots') {
    await say(u, `마을이 자라려면 식구가 늘어야지. 새 식구가 살 집터를 세 곳 다듬으려 하네. 한 곳에 <b>${costText(COST.lot)}</b>가 드네. 지금까지 ${Q.lots}곳을 마련했지.`);
    while (Q.lots < 3) {
      if (!canPay(COST.lot)) { await say(u, `재료가 모자라는구먼. 지금은 ${haveMat(COST.lot)}일세. 모이면 다시 오게.`); return; }
      if (await Dialog.choose(['집터를 마련해 주세요', '다음에요'], { cancel: 1 }) !== 0) return;
      if (!freeLots().length) { await say(u,'먼저 약속한 이웃의 이사 준비를 마쳐 주게.'); return; }
      payCost(COST.lot); Q.lots++; Q.pend.movein.push(tm); reserveLot(); refreshGoal(); Sound.sfx('coin');
      await say(u, `좋아! ${Q.lots}번째 집터를 다듬어 두겠네. 내일이면 새 식구가 이사 올 걸세.`);
    }
    await say(u, '이걸로 세 곳이 다 찼구먼! 마을이 북적북적해지겠어.');
    await say(u, `이제 강에 다리를 하나 더 놓으면 오가기가 한결 편할 걸세. <b>${costText(COST.bridge)}</b>가 든다네.`);
    advance();
  } else if (id === 'bridge') {
    if (!canPay(COST.bridge)) { await say(u, `다리를 놓으려면 <b>${costText(COST.bridge)}</b>가 드네. 지금은 ${haveMat(COST.bridge)}일세.`); return; }
    await say(u, `재료와 돈이 다 모였구먼! <b>${costText(COST.bridge)}</b>로 둘째 다리를 놓겠는가?`);
    if (await Dialog.choose(['다리를 놓아 주세요', '다음에요'], { cancel: 1 }) !== 0) return;
    payCost(COST.bridge); Q.pend.bridge = tm; Sound.sfx('fanfare');
    await say(u, '좋아! 내일 아침이면 다리가 놓여 있을 걸세.');
    await say(u, '가게와 박물관, 다리가 다 서고 이웃이 다섯이 되면… 다 같이 <b>마을 잔치</b>를 여세!');
    advance();
  } else if (id === 'festival') {
    if (!festivalReady()) { await say(u, `잔치는 가게와 박물관, 다리가 다 서고 이웃이 다섯이 되면 열자꾸나. 지금 이웃은 ${S.residents.length}명일세.${Q.shop < 2 ? ' 가게가 아직이고.' : ''}${Q.museum < 2 ? ' 박물관이 아직이고.' : ''}${Q.bridge < 2 ? ' 다리가 아직이군.' : ''}`); return; }
    await say(u, '가게도, 박물관도, 다리도 다 섰구먼. 이웃도 다섯이나 되고! 이제 잔치를 열 때가 됐네.');
    if (await Dialog.choose(['잔치를 열어요!', '조금 있다가요'], { cancel: 1 }) !== 0) return;
    await festival(u);
  }
}

/** 마을 잔치: 광장에 모두 모여 축하한다. 이야기의 끝. */
async function festival(u) {
  const pz = G.village.plaza;
  Sound.sfx('door');
  await UI.fade(true);
  G.room.dispose(); G.room = null;
  G.world.setVisible(true); G.critters.setVisible(true);
  G.stage.setMode(false);
  // 기념사진처럼 선다: 앞줄에 두루·이장·나·까미, 뒷줄에 이웃들. 모두 앞을 본다.
  const cx = pz.x + 4.5, zf = pz.y + 6.45, zb = pz.y + 5.3;
  G.player.setPos(cx, zf); G.player.yaw = 0; G.player.actor.face(0, true);
  const guests = G.npcs.filter((n) => S.villagers[n.id]);
  guests.forEach((n, i) => {
    const k = guests.length, t = (i - (k - 1) / 2) * 1.2 + (k % 2 ? 0.6 : 0);      // 앞줄 사이사이로 얼굴이 보이게 반 칸 어긋나게
    n.show(true); n.x = cx + t; n.z = zb + 0.04 * t * t; n.path = null; n.state = 'idle'; n.staged = true;
    n.actor.face(0, true); n.place();
  });
  const front = [['ujik', -1.25], ['kkami', 1.25], ['duru', -2.5]].map(([k, dx]) => {
    const a = new Actor('npc_' + k);
    G.stage.scene.add(a.root);
    a.setPos(cx + dx, groundY(cx + dx, zf - 0.12), zf - 0.12); a.face(0, true);
    return a;
  });
  G.extras = front;
  const mayor = { ...u, actor: front[0] };
  setVillagersVisible(true);
  G.stage.setFocus(cx, 0, zf, true);
  refreshTime(true);
  await UI.fade(false);
  const everyone = guests.map((n) => n.actor).concat(front, [G.player.actor]);
  const pop = () => { for (let i = 0; i < 6; i++) burst(i % 2 ? 'petal' : 'spark', cx + (Math.random() - 0.5) * 7, 2.2 + Math.random() * 1.5, zf - 0.6 + (Math.random() - 0.5) * 3, 10); };
  Sound.sfx('fanfare'); pop();
  for (const a of everyone) a.play('joy', 1.2);
  await say(mayor, `자, 다들 모였는가! 오늘은 우리 ${S.village.name} 마을의 잔칫날일세!`);
  pop();
  await say(mayor, '천막 하나로 시작한 마을에 가게가 서고, 박물관이 서고, 다리가 놓였네. 이게 다 {p|이/가} 발로 뛰어 준 덕분이지.');
  for (const n of guests) n.actor.play('wave', 1.0);

  for(const n of guests.slice(0,3)){n.actor.play('wave',1);await speak(n,voice(n.id,'fest'));}
  front[1].play('joy', 1.0);
  await say({ ...npcOf('kkami'), actor: front[1] }, '우리 가게도 잔치 기념으로 좋은 물건 많이 들여놓을게요!');
  front[2].play('wave', 1.0);
  await say({ ...npcOf('duru'), actor: front[2] }, '박물관도 잊지 마십시오. 전시관은 이제부터 채워 가는 것이니까요.');
  Sound.sfx('fanfare'); pop();
  for (const a of everyone) a.play('joy', 1.2);
  addMoney(10000);
  await say(mayor, '마을 사람들이 조금씩 모은 <b>도토리 10,000개</b>일세. 받아 두게. 그리고 앞으로도 잘 부탁하네!');
  await narr('마을 잔치를 마쳤다. 이제 마음 가는 대로 지내면 된다. 빈 집터가 남아 있는 동안에는 새 이웃이 계속 이사 온다.');
  S.prog.done = true; S.prog.step = 99; S.moveInDay = dayKey() + 3;
  await UI.fade(true);
  for (const a of front) G.stage.scene.remove(a.root);
  G.extras = null;
  for (const n of guests) { n.staged = false; n.wait = 1 + rand() * 4; }
  syncVillagers();
  await UI.fade(false);
  refreshGoal(); save();
}

async function talkUjik() {
  const u = npcOf('ujik'), P = S.player, Q = S.prog;
  if (stepId() === 'hello') { await storyUjik(u); await say(u, '그럼 살펴 가게!'); return; }
  await say(u, pick(['왔구나, {p}. 오늘 일한 몫은 잘 챙겼니?', '작업표는 잠깐 여기 두고. 무슨 일인지 들어 보자.']));
  for (;;) {
    const story = !Q.done;
    const opts = (story ? ['마을 일로 왔어요'] : []).concat(['집 문제로 왔어요', '마을 소식이 궁금해요', '아니에요']);
    let c = await Dialog.choose(opts, { cancel: opts.length - 1 });
    if (story) { if (c === 0) { await storyUjik(u); if (!G.room) return; continue; } c--; }
    if (c === 0) {
      if (P.houseLv < 1) { await say(u, Q.pend.home ? '집은 내일 아침이면 다 지어진다네. 하룻밤만 더 천막에서 자게.' : `아직 천막에 살고 있지 않은가. <b>${costText(COST.house)}</b>를 가져오면 집을 지어 주겠네.`); continue; }
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
  await say(u,'광장 작업대에서 주운 나무와 돌로 도구를 만들 수 있다네. 게시판에서 풀잎 들녘으로 가면 노동 갑옷 씨가 일손과 토벌 동료를 찾고 있어.');
  S.flags.intro = true;
  mailLetter();
  save();
}
function mailLetter() {
  S.mail.unshift({ from: 'ujik', name: '우직 이장', text: `${S.player.name}에게.\n\n이사를 축하하네.\n농사지은 것 조금 넣었으니 요긴하게 쓰게.\n모르는 건 마을회관으로 물으러 오고.\n\n이장 우직`, item: 'tool_shovel', read: false, day: S.day });
}

/** 놀러 간 마을의 이웃과는 가볍게 인사만 나눈다 */
async function talkVisit(n) {
  n.talking=true;
  try{await speak(n,voice(n.id,'home'));}finally{n.talking=false;}
}

// ---------------------------------------------------------------- 건물 드나들기
function wrapNpc(id) { const def = VILLAGERS[id]; return { id, name: def.name, pitch: PERSONALITY[def.p].pitch }; }
function roomSpec(b) {
  if(b.type==='campsite')return campsiteSpec();
  if(b.type==='atelier')return atelierSpec();
  if(S.flags.campStart && S.player.houseLv===0 && b.type==='hall')return {id:'hall',w:5,h:4,wall:'wall_tent',floor:'floor_mat',items:[{id:'f_log_stool',x:0,y:0,r:0}],npcDefs:[{model:'npc_ujik',name:NPCS.ujik.name,x:2.6,z:1.4,fixed:true,talk:()=>runScript(talkUjik)}]};
  if (b.type === 'home') {
    const lv = S.player.houseLv, [w, h] = ROOM_SIZE[lv];
    return { id: 'home', w, h, wall: lv < 1 ? 'wall_tent' : S.home.wall, floor: lv < 1 ? 'floor_mat' : S.home.floor, items: S.home.items, editable: true };
  }
  if (b.type === 'shop' && S.prog.shop < 2) {       // 천막 좌판
    return { id: 'shop', w: 6, h: 4, wall: 'wall_tent', floor: 'floor_mat', items: [{ id: 'p_counter', x: 2, y: 1, w: 2, d: 1, r: 0 }],
      npcDefs: [{ model: 'npc_kkami', name: NPCS.kkami.name, x: 3, z: 0.6, fixed: true, talk: () => runScript(talkKkami) }] };
  }
  if (b.type === 'museum' && S.prog.museum < 2) {   // 두루의 조사 천막
    return { id: 'museum', w: 6, h: 4, wall: 'wall_tent', floor: 'floor_mat', items: [{ id: 'p_desk', x: 2, y: 1, w: 2, d: 1, r: 0 }, { id: 'p_bugcase', x: 5, y: 0, r: 0 }, { id: 'p_plant', x: 0, y: 0, r: 0 }],
      npcDefs: [{ model: 'npc_duru', name: NPCS.duru.name, x: 3, z: 0.6, fixed: true, talk: () => runScript(talkDuru) }] };
  }
  if (b.type === 'shop') {
    const spots = [[0, 0], [6, 0], [0, 2], [6, 2], [1, 4]];
    const items = [{ id: 'p_counter', x: 3, y: 1, w: 2, d: 1, r: 0 }, { id: 'p_plant', x: 7, y: 5, r: 0 }];
    S.shop.furn.filter((f) => !S.shop.sold.includes(f)).forEach((f, i) => { if (spots[i]) items.push({ id: f, x: spots[i][0], y: spots[i][1], r: 0, sale: ITEMS[f].buy }); });
    return { id: 'shop', w: 8, h: 6, wall: 'wall_wood', floor: 'floor_wood', items, npcDefs: [{ model: 'npc_kkami', name: NPCS.kkami.name, x: 4, z: 0.6, fixed: true, talk: () => runScript(talkKkami) }] };
  }
  if (b.type === 'museum') return museumSpec('museum');
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
    npcDefs: [{ ...n, model: 'villager_' + vid, x: 3.5, z: 2.5, talk: (self) => runScript(async () => { if (!S.villagers[vid].homeSeen || S.villagers[vid].homeSeen !== dayKey()) { S.villagers[vid].homeSeen = dayKey(); await speak(self,voice(vid,'home'),vvars(n)); } await talkVillager(self); }) }],
  };
}

export async function enter(b) {
  await runScript(async () => {
    if (G.visit) { await narr('놀러 온 마을에서는 건물에 들어가지 않는다. 밖에서 같이 놀자!'); return; }
    const h = hourF();
    if(['atelier','campsite'].includes(b.type) && b.ready>S.day){await narr('공사 중이에요. 내일 문을 열어요.');return;}
    if (b.type === 'museum' && S.prog.museum < 1) { await narr(S.prog.pend.museum ? '말뚝과 줄이 쳐져 있다. 내일이면 두루의 조사 천막이 선다고 한다.' : '아직 빈 터다. 팻말에 "박물관 자리"라고 적혀 있다.'); return; }
    if (b.type === 'shop' && (h < 8 || h >= 22)) { Sound.sfx('fail'); await narr('문이 잠겨 있다. 팻말에 "아침 8시부터 밤 10시까지"라고 적혀 있다.'); return; }
    if (b.type === 'house') {
      const vid = Object.keys(S.villagers).find((k) => S.villagers[k].lot === b.lot);
      if (!vid) { await narr((S.prog.pend.sites || []).includes(b.lot) ? '집 지을 채비가 한창이다. 내일이면 새 이웃이 이사 온다고 한다.' : '아직 빈 집터다. 언젠가 새 이웃이 이사 올 자리.'); return; }
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
/** 박물관 안에서 방과 방 사이를 오간다 */
export async function portal(to) {
  await runScript(async () => {
    Sound.sfx('door');
    await UI.fade(true);
    const from = G.room.id, b = G.room.building;
    G.room.dispose();
    G.room = new Room(museumSpec(to)); G.room.building = b;
    G.stage.setMode(true, G.room.h);
    const pt = (G.room.portals || []).find((q) => q.to === from);
    if (pt) { G.player.setPos(pt.x, 0.8); G.player.yaw = 0; G.player.actor.face(0, true); }          // 전시관에서 로비로: 그 문 앞에
    else { G.player.setPos(G.room.w / 2, G.room.h - 0.7); G.player.yaw = Math.PI; G.player.actor.face(Math.PI, true); }
    const f = G.room.focus(G.player.x, G.player.z); G.stage.setFocus(f.x, 0, f.z, true);
    await UI.fade(false);
  });
}
export async function exitRoom() {
  if (G.room && G.room.exitTo) return portal(G.room.exitTo);
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
function holdUp(model, tint, scale = 1, tilt = 0, yaw = 0) {
  const a = G.player.actor;
  const o = make(model, tint ? { tint } : {});
  o.scale.setScalar(scale); o.position.set(0, a.topY + 0.25 + (tilt ? 0.2 : 0), 0);
  o.rotation.set(tilt, yaw, 0);        // 위에서 본 모습이 특징인 생물(곤충, 게, 넙치 등)은 등이 보이게 세워 든다. yaw: 먼저 돌려 놓을 각도
  a.root.add(o); a.play('show', 99); a.face(0);
  return () => { a.root.remove(o); a.anim = null; };
}
export function caughtFish(sp) {
  runScript(async () => {
    const id = 'fish_' + sp.id;
    const cm = Math.round((sp.cm[0] + rand() * (sp.cm[1] - sp.cm[0])) * 10) / 10;
    const d = S.dex.fish[sp.id], isNew = !d && !sp.trash;
    if (!sp.trash) S.dex.fish[sp.id] = { n: (d ? d.n : 0) + 1, max: Math.max(d ? d.max : 0, cm) };
    const done = holdUp('fish_' + sp.id, null, Math.min(1.1, 0.9 / (sp.look.len || 0.8)), sp.look.view === 'top' ? 1.0 : 0, flatYaw(sp.look));
    Sound.sfx(isNew ? 'fanfare' : sp.trash ? 'fail' : 'catch');
    if (!sp.trash) burst('spark', G.player.x, 2, G.player.z, 8);
    await UI.card({ id, title: sp.say, sub: sp.trash ? '' : `${cm}cm${d && cm > d.max ? ' · 내 최고 기록!' : ''}`, isNew });
    done();
    S.stats.fish++;
    if (!sp.trash && G.net) G.net.got('fish', sp.id);
    if (!sp.trash) { track('fish'); track(sp.water === 'sea' ? 'seafish' : 'freshfish'); if (isNew) track('newsp'); }
    if (!addItem(id)) UI.toast(sp.trash ? '가방이 가득 차서 그냥 두고 왔다.' : '가방이 가득 차서 놓아주었다.');
  });
}
export function caughtBug(b) {
  runScript(async () => {
    const sp = b.sp, id = 'bug_' + sp.id, d = S.dex.bug[sp.id], isNew = !d;
    S.dex.bug[sp.id] = { n: (d ? d.n : 0) + 1 };
    const side = sp.look.view === 'side';      // 메뚜기·사마귀처럼 옆모습이 특징인 곤충은 옆으로 돌려(머리가 오른쪽) 든다
    const done = holdUp('bug_' + sp.id, null, Math.min(2.2, 0.8 / (sp.look.span || sp.look.len || 0.36)), side ? 0.25 : 1.0, side ? Math.PI / 2 : 0);
    Sound.sfx(isNew ? 'fanfare' : 'catch'); burst('spark', G.player.x, 2, G.player.z, 8);
    await UI.card({ id, title: sp.say, sub: '', isNew });
    done();
    S.stats.bug++;
    if (G.net) G.net.got('bug', sp.id);
    track('bug'); if (isNew) track('newsp');
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
    talk: (n) => runScript(() => (n.remote ? talkVisit(n) : talkVillager(n))),
    enter, exit: exitRoom, portal, caughtFish, caughtBug, stung,
    talkDuru: () => runScript(talkDuru),
    exhibit: (name, text) => runScript(async () => { await Dialog.say(name, text); }), buyDisplay: (room, i) => runScript(() => buyDisplay(room, i)),
    syncVillagers: () => { if (!G.room) syncVillagers(); },
    minute: () => { if (!G.room) syncVillagers(); },
  });
}
