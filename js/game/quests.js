// 마을 키우기: 할 일(이야기 순서), 오늘의 일감, 도전 과제, 그리고 이것들을 보여 주는 수첩
//
// S.prog = {
//   step      지금 하는 '할 일'의 번호(STORY의 순서). STORY.length 이상이면 끝난 것
//   shop      0 천막 가게, 2 번듯한 가게         museum  0 없음, 1 두루의 천막, 2 박물관 건물
//   bridge    0 둘째 다리 없음, 2 놓임           lots    새 이웃을 위해 마련한 집터 수(0~3)
//   pend      다음 날 끝나는 공사 { home: 날, shop: 날, museum: {day, to}, bridge: 날, movein: [날…], sites: [새 이웃이 들어올 집터 번호…] }
//   tasks     오늘의 일감 다섯 개 [{k, need, n, pay}]      tasksDone  해낸 일감 수
//   count     평생 누적 횟수 { talk, water, weed, wood, stone, fossil … }      ach  도전 과제마다 받은 단계
//   met       이웃이 아닌 사람과 인사했는지 { kkami }      done  마을 잔치까지 끝났는지
// }
// 예전 저장(S.prog 없음)은 '다 지어진 마을'로 이어받는다(legacyProg).
import { G } from './game.js';
import { S, addMoney, countItem, hasItem } from './state.js';
import { UI, acorns } from '../ui/ui.js';
import { Sound } from '../core/audio.js';
import { el, fmt, rand } from '../core/util.js';

export const COST = {
  house: { wood: 10 }, shop: { wood: 20, stone: 10 }, lot: { wood: 8, stone: 4 }, bridge: { wood: 20, stone: 15, money: 5000 },
  five: 5, museum: 15,
};
const MAT_KO = { wood: '나무', stone: '돌', money: '도토리' };

export const species = () => Object.keys(S.dex.fish).length + Object.keys(S.dex.bug).length;
export const donated = () => S.museum.fish.length + S.museum.bug.length + S.museum.fossil.length;
export const greeted = () => S.residents.filter((id) => S.villagers[id] && S.villagers[id].met).length + (S.prog.met.kkami ? 1 : 0);
const have = (c) => Object.entries(c).every(([k, n]) => (k === 'money' ? S.player.money : countItem('mat_' + k)) >= n);
export const costText = (c) => Object.entries(c).map(([k, n]) => `${MAT_KO[k]} ${fmt(n)}개`).join(', ');
const haveText = (c) => Object.entries(c).map(([k, n]) => `${MAT_KO[k]} ${fmt(Math.min(n, k === 'money' ? S.player.money : countItem('mat_' + k)))}/${fmt(n)}`).join(' · ');
export const canPay = have;

/** 할 일의 순서. who: 누구에게 가면 되는지. prog: 지금 얼마나 했는지 [현재, 목표] 또는 글 */
export const STORY = [
  { id: 'hello', title: '이장님 찾아가기', who: '이장', text: '광장 옆 마을회관에 가서 우직 이장님과 이야기하자.' },
  { id: 'greet', title: '이웃과 인사하기', who: '이장', text: '마을에 사는 이웃 둘, 그리고 천막 가게의 까미와 인사를 나누고 이장님께 알리자.', prog: () => [Math.min(3, greeted()), 3] },
  { id: 'five', title: '생물 다섯 종 잡기', who: '이장', text: '낚싯대와 잠자리채로 물고기나 곤충을 다섯 종 잡아서 이장님께 알리자.', prog: () => [Math.min(COST.five, species()), COST.five] },
  { id: 'house', title: '내 집 짓기', who: '이장', text: `천막 대신 집을 짓자. ${costText(COST.house)}를 이장님께 가져가면 된다. 나무는 도끼로 나무를 찍으면 나온다(도끼는 까미네 천막 가게에서).`, prog: () => haveText(COST.house) },
  { id: 'shop', title: '가게 짓기', who: '까미', text: `까미가 번듯한 가게를 짓고 싶어 한다. ${costText(COST.shop)}를 까미에게 가져다주자. 돌은 삽으로 바위를 두드리면 나온다.`, prog: () => haveText(COST.shop) },
  { id: 'museum', title: '박물관 세우기', who: '두루', text: `두루의 천막에 물고기·곤충·화석을 모두 ${COST.museum}점 기증하면 박물관 건물을 지을 수 있다.`, prog: () => (S.prog.museum < 1 ? '두루의 천막이 곧 마을에 온다' : [Math.min(COST.museum, donated()), COST.museum]) },
  { id: 'lots', title: '새 이웃 맞이하기', who: '이장', text: `새 식구가 살 집터 세 곳을 마련하자. 한 곳마다 ${costText(COST.lot)}를 이장님께.`, prog: () => [S.prog.lots, 3] },
  { id: 'bridge', title: '다리 놓기', who: '이장', text: `강에 둘째 다리를 놓자. ${costText(COST.bridge)}를 이장님께.`, prog: () => haveText(COST.bridge) },
  { id: 'festival', title: '마을 잔치', who: '이장', text: '가게와 박물관, 다리가 다 지어지고 이웃이 다섯이 되면 이장님과 마을 잔치를 열 수 있다.', prog: () => `이웃 ${S.residents.length}/5` + (S.prog.shop < 2 ? ' · 가게 공사 중' : '') + (S.prog.museum < 2 ? ' · 박물관 아직' : '') + (S.prog.bridge < 2 ? ' · 다리 아직' : '') },
];
export const stepId = () => (S.prog.step < STORY.length ? STORY[S.prog.step].id : 'done');
export const festivalReady = () => S.prog.shop >= 2 && S.prog.museum >= 2 && S.prog.bridge >= 2 && S.residents.length >= 5;

export function newProg() { return { step: 0, shop: 0, museum: 0, bridge: 0, lots: 0, pend: { movein: [] }, tasks: [], tasksDone: 0, count: {}, ach: {}, met: {}, done: false }; }
function legacyProg() { return { ...newProg(), step: STORY.length, shop: 2, museum: 2, bridge: 2, lots: 3, done: true, legacy: true, met: { kkami: true } }; }
/** 저장에 진행 정보가 없으면(예전 저장) 다 지어진 마을로 채운다 */
export function ensureProg() {
  if (!S.prog) S.prog = legacyProg();
  const d = newProg();
  for (const k of Object.keys(d)) if (S.prog[k] === undefined) S.prog[k] = d[k];
  if (!S.prog.pend.movein) S.prog.pend.movein = [];
  fillTasks();
}
export function advance() {
  S.prog.step++;
  Sound.sfx('fanfare');
  refreshGoal();
}

// ---------------------------------------------------------------- 오늘의 일감
const TASK = {
  fish: { ko: (n) => `물고기 ${n}마리 낚기`, n: [3, 5], pay: [300, 500] },
  seafish: { ko: (n) => `바다에서 물고기 ${n}마리 낚기`, n: [2, 3], pay: [350, 500] },
  freshfish: { ko: (n) => `강이나 연못에서 물고기 ${n}마리 낚기`, n: [2, 3], pay: [350, 500] },
  bug: { ko: (n) => `곤충 ${n}마리 잡기`, n: [3, 5], pay: [300, 500] },
  newsp: { ko: () => '처음 보는 생물 한 종 잡기', n: [1], pay: [500] },
  sell: { ko: (n) => `가게에 도토리 ${fmt(n)}개어치 팔기`, n: [1000, 3000], pay: [300, 600] },
  talk: { ko: (n) => `이웃 ${n}명과 이야기 나누기`, n: [2, 3], pay: [200, 300] },
  water: { ko: (n) => `꽃 ${n}송이에 물 주기`, n: [3, 5], pay: [200, 300], ok: () => hasItem('tool_can') },
  weed: { ko: (n) => `잡초 ${n}개 뽑기`, n: [3, 5], pay: [200, 300] },
  shake: { ko: (n) => `나무 ${n}그루 흔들기`, n: [5], pay: [200] },
  wood: { ko: (n) => `나무 ${n}개 구하기`, n: [5, 10], pay: [300, 500], ok: () => hasItem('tool_axe') },
  stone: { ko: (n) => `돌 ${n}개 구하기`, n: [3, 6], pay: [300, 500], ok: () => hasItem('tool_shovel') },
  fossil: { ko: () => '화석 하나 캐기', n: [1], pay: [400], ok: () => hasItem('tool_shovel') },
  donate: { ko: () => '박물관에 한 점 기증하기', n: [1], pay: [400], ok: () => S.prog.museum >= 1 },
  plant: { ko: (n) => `꽃이나 나무 ${n}개 심기`, n: [1, 3], pay: [250, 400] },
  fruit: { ko: (n) => `과일 ${n}개 따기`, n: [3, 6], pay: [200, 300] },
  shell: { ko: (n) => `조개 ${n}개 줍기`, n: [2, 4], pay: [200, 300] },
};
export const taskText = (t) => TASK[t.k].ko(t.need);
function newTask(avoid = []) {
  const pool = Object.keys(TASK).filter((k) => !avoid.includes(k) && (!TASK[k].ok || TASK[k].ok()) && (k !== 'talk' || S.residents.length >= 2));
  const k = pool[Math.floor(rand() * pool.length)], d = TASK[k], i = Math.floor(rand() * d.n.length);
  return { k, need: k === 'talk' ? Math.min(d.n[i], S.residents.length) : d.n[i], n: 0, pay: d.pay[i] };
}
export function fillTasks() {
  const P = S.prog;
  P.tasks = (P.tasks || []).filter((t) => TASK[t.k]);
  while (P.tasks.length < 5) P.tasks.push(newTask(P.tasks.map((t) => t.k)));
}

/** 무슨 일을 했는지 알린다. 일감과 도전 과제가 여기서 채워진다. */
export function track(k, n = 1) {
  const P = S.prog; if (!P) return;
  P.count[k] = (P.count[k] || 0) + n;
  for (let i = 0; i < P.tasks.length; i++) {
    const t = P.tasks[i];
    if (t.k !== k || t.n >= t.need) continue;
    t.n = Math.min(t.need, t.n + n);
    if (t.n >= t.need) {
      addMoney(t.pay); P.tasksDone++;
      Sound.sfx('coin');
      UI.toast(`일감을 해냈다! “${taskText(t)}” — 도토리 +${fmt(t.pay)}`, 3600);
      P.tasks[i] = newTask(P.tasks.map((x) => x.k));
    }
  }
  checkAch();
  refreshGoal();
}

// ---------------------------------------------------------------- 도전 과제
const cnt = (k) => () => S.prog.count[k] || 0;
export const ACH = [
  { id: 'fish', ko: '낚시꾼', unit: '마리', get: () => S.stats.fish, tiers: [10, 50, 200, 500] },
  { id: 'bug', ko: '채집가', unit: '마리', get: () => S.stats.bug, tiers: [10, 50, 200, 500] },
  { id: 'fishdex', ko: '물고기 도감', unit: '종', get: () => Object.keys(S.dex.fish).length, tiers: [10, 30, 60, 80] },
  { id: 'bugdex', ko: '곤충 도감', unit: '종', get: () => Object.keys(S.dex.bug).length, tiers: [10, 30, 60, 80] },
  { id: 'donate', ko: '박물관 후원자', unit: '점', get: donated, tiers: [10, 40, 100, 172] },
  { id: 'earn', ko: '도토리 부자', unit: '개', get: () => S.stats.earned, tiers: [5000, 50000, 300000, 1000000] },
  { id: 'days', ko: '마을 지킴이', unit: '일', get: () => S.stats.days, tiers: [3, 10, 30, 100] },
  { id: 'talk', ko: '다정한 이웃', unit: '번', get: cnt('talk'), tiers: [20, 100, 400] },
  { id: 'water', ko: '꽃밭 가꾸기', unit: '송이', get: cnt('water'), tiers: [20, 100, 300] },
  { id: 'weed', ko: '깔끔한 마을', unit: '개', get: cnt('weed'), tiers: [20, 100, 300] },
  { id: 'wood', ko: '나무꾼', unit: '개', get: cnt('wood'), tiers: [20, 100, 300] },
  { id: 'fossil', ko: '화석 발굴', unit: '개', get: cnt('fossil'), tiers: [5, 20, 60] },
  { id: 'friend', ko: '단짝', unit: '명', get: () => S.residents.filter((id) => S.villagers[id] && S.villagers[id].friend >= 50).length, tiers: [1, 3, 6] },
  { id: 'task', ko: '일감 해결사', unit: '개', get: () => S.prog.tasksDone, tiers: [5, 30, 100] },
];
const ACH_PAY = [500, 1500, 4000, 10000];
export function checkAch() {
  const P = S.prog;
  for (const a of ACH) {
    const v = a.get(), got = P.ach[a.id] || 0;
    let lv = got; while (lv < a.tiers.length && v >= a.tiers[lv]) lv++;
    if (lv > got) {
      let pay = 0; for (let i = got; i < lv; i++) pay += ACH_PAY[i];
      P.ach[a.id] = lv; addMoney(pay); Sound.sfx('fanfare');
      UI.toast(`도전 과제 달성! ${a.ko} ${lv}단계 — 도토리 +${fmt(pay)}`, 4200);
    }
  }
}

// ---------------------------------------------------------------- 화면 위의 '할 일' 한 줄
export function goalText() {
  const P = S.prog; if (!P || P.done || P.step >= STORY.length) return '';
  const s = STORY[P.step], p = s.prog ? s.prog() : null;
  return `할 일 · ${s.title}` + (Array.isArray(p) ? ` (${p[0]}/${p[1]})` : '');
}
export function refreshGoal() { if (UI.setGoal) UI.setGoal(goalText()); }

// ---------------------------------------------------------------- 수첩
export function openNote() {
  const box = el('div'); let tab = 'story';
  const bar = (a, b) => `<div class="bar"><i style="width:${Math.round(Math.min(1, a / b) * 100)}%"></i></div>`;
  const draw = () => {
    box.innerHTML = '';
    const tabs = el('div', 'tabs');
    for (const [k, ko] of [['story', '할 일'], ['task', '오늘의 일감'], ['ach', '도전 과제']]) { const t = el('button', 'tab' + (tab === k ? ' on' : ''), ko); t.onclick = () => { tab = k; Sound.sfx('ui'); draw(); }; tabs.appendChild(t); }
    box.appendChild(tabs);
    const P = S.prog;
    if (tab === 'story') {
      if (P.step >= STORY.length) box.appendChild(el('div', 'note', P.legacy ? '이 마을은 이미 다 자란 마을이다. 오늘의 일감과 도전 과제를 즐겨 보자.' : '마을 잔치까지 마쳤다! 이제 마음 가는 대로 지내면 된다. 새 이웃은 빈 집터가 남아 있는 동안 계속 이사 온다.'));
      const list = el('div', 'list');
      STORY.forEach((s, i) => {
        const done = i < P.step, cur = i === P.step;
        const row = el('div', 'li q' + (cur ? ' picked' : ''));
        const p = cur && s.prog ? s.prog() : null;
        row.innerHTML = `<div class="mk">${done ? '✔' : cur ? '▶' : '·'}</div><div class="nm"><b>${i + 1}. ${done || cur ? s.title : '???'}</b>`
          + (cur ? `<span class="sub">${s.text}</span>` + (Array.isArray(p) ? bar(p[0], p[1]) + `<span class="sub">${p[0]} / ${p[1]}</span>` : p ? `<span class="sub">지금: ${p}</span>` : '') + `<span class="sub">찾아갈 사람: ${s.who}</span>` : '') + '</div>';
        list.appendChild(row);
      });
      const pd = [];
      if (P.pend.home) pd.push('내 집'); if (P.pend.shop) pd.push('가게'); if (P.pend.museum) pd.push(P.pend.museum.to === 1 ? '두루의 천막' : '박물관'); if (P.pend.bridge) pd.push('다리'); if (P.pend.movein.length) pd.push(`새 이웃 ${P.pend.movein.length}명`);
      if (pd.length) box.appendChild(el('div', 'note', `내일이면 준비되는 것: ${pd.join(', ')}`));
      box.appendChild(list);
    } else if (tab === 'task') {
      box.appendChild(el('div', 'note', `일감을 해내면 도토리를 받고, 바로 새 일감이 생긴다. 손대지 않은 일감은 날이 바뀌면 다른 것으로 바뀐다.　지금까지 해낸 일감 ${P.tasksDone}개`));
      const list = el('div', 'list');
      for (const t of P.tasks) {
        const row = el('div', 'li q');
        row.innerHTML = `<div class="nm"><b>${taskText(t)}</b>${bar(t.n, t.need)}<span class="sub">${fmt(t.n)} / ${fmt(t.need)}</span></div><div class="pr">${acorns(t.pay)}</div>`;
        list.appendChild(row);
      }
      box.appendChild(list);
    } else {
      checkAch();
      const list = el('div', 'list');
      for (const a of ACH) {
        const lv = P.ach[a.id] || 0, v = a.get(), next = a.tiers[lv];
        const row = el('div', 'li q');
        row.innerHTML = `<div class="mk star">${'★'.repeat(lv)}${'☆'.repeat(a.tiers.length - lv)}</div><div class="nm"><b>${a.ko}</b>`
          + (next ? bar(v, next) + `<span class="sub">${fmt(Math.min(v, next))} / ${fmt(next)}${a.unit}</span>` : `<span class="sub">모두 달성! (${fmt(v)}${a.unit})</span>`) + '</div>'
          + `<div class="pr">${next ? acorns(ACH_PAY[lv]) : ''}</div>`;
        list.appendChild(row);
      }
      box.appendChild(list);
    }
  };
  draw();
  UI.openPanel('수첩', box);
}
