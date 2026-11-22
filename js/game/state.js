// 게임 진행 상태(저장되는 모든 것)와 가방 다루기
import { ITEMS } from '../data/items.js';
import { VILLAGER_IDS } from '../data/villagers.js';
import { RNG } from '../core/util.js';

const KEY = 'dotori-village-save-v1';
const SET_KEY = 'dotori-village-settings';
export const INV_SIZE = 20;
export const LOANS = [5000, 30000, 80000];          // 처음 집값, 1차 증축, 2차 증축
export const ROOM_SIZE = { 0: [4, 4], 1: [6, 5], 2: [8, 6], 3: [10, 8] };   // 0은 천막

export const S = {};                                // 현재 진행 상태
export const Settings = { bgm: 0.5, sfx: 0.7, offsetMin: 0, shadow: true };

export function loadSettings() {
  try { Object.assign(Settings, JSON.parse(localStorage.getItem(SET_KEY) || '{}')); } catch (e) { /* 무시 */ }
}
export function saveSettings() { try { localStorage.setItem(SET_KEY, JSON.stringify(Settings)); } catch (e) { /* 무시 */ } }

export function newState({ name, village, model, look = null, seed, villageData, day }) {
  const r = RNG(seed ^ 0x51ed);
  const ids = r.shuffle([...VILLAGER_IDS]);
  const residents = ids.slice(0, 2);                 // 처음엔 이웃이 둘뿐이다. 나머지는 마을을 키우면 이사 온다
  const villagers = {};
  const lots = r.shuffle([...Array(villageData.lots.length).keys()]);
  residents.forEach((id, i) => { villagers[id] = { lot: lots[i], friend: 0, met: false, talkDay: 0, talkN: 0, req: null, giftDay: 0 }; });
  const st = {
    v: 1, seed,
    player: { name, model, look, x: villageData.spawn.x + 0.5, z: villageData.spawn.y + 0.8, money: 0, loan: 0, houseLv: 0, loanStage: 0, tool: null, stung: false },
    village: { name: village },
    inv: Array(INV_SIZE).fill(null),
    storage: [],
    day, clockAdvanceMs: 0,
    villagers, residents, waiting: ids.slice(2),
    dex: { fish: {}, bug: {}, fossil: {} },
    museum: { fish: [], bug: [], fossil: [] },
    shop: { day: 0, stock: [] },
    mail: [],
    home: { wall: 'wall_cream', floor: 'floor_wood', items: [{ id: 'f_chest', x: 3, y: 0, r: 0 }, { id: 'f_yo', x: 0, y: 0, r: 0 }, { id: 'f_mirror', x: 2, y: 0, r: 0 }] },
    flags: { mirror: true },
    daily: { coinTrees: [], nestTrees: [], furnTrees: [], moneyRock: -1, rockHits: 0, shaken: [], stones: {} },
    stats: { fish: 0, bug: 0, days: 1, earned: 0 },
    moveInDay: day + 6,
  };
  for (const k of Object.keys(S)) delete S[k];
  Object.assign(S, st);
  addItem('tool_rod'); addItem('tool_net');
  return S;
}

export function hasSave() { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } }
/** 저장을 다 불러오지 않고 주인공의 모습만 본다(첫 화면에 세워 둘 때) */
export function peekPlayer() {
  try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); return o && o.player ? { model: o.player.model, look: o.player.look || null } : null; } catch (e) { return null; }
}
export function saveGame(village) {
  try {
    S.village.data = village.serialize();
    localStorage.setItem(KEY, JSON.stringify(S));
    return true;
  } catch (e) { console.warn('저장 실패', e); return false; }
}
export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const st = JSON.parse(raw);
    for (const k of Object.keys(S)) delete S[k];
    Object.assign(S, st);
    // 옛 저장에 없는 항목 채우기
    if (!Number.isSafeInteger(S.clockAdvanceMs) || S.clockAdvanceMs < 0 || !Number.isFinite(new Date(Date.now() + S.clockAdvanceMs).getTime())) S.clockAdvanceMs = 0;
    S.daily = Object.assign({ coinTrees: [], nestTrees: [], furnTrees: [], moneyRock: -1, rockHits: 0, shaken: [], stones: {} }, S.daily || {});
    S.stats = Object.assign({ fish: 0, bug: 0, days: 1, earned: 0 }, S.stats || {});
    S.flags = S.flags || {}; S.mail = S.mail || []; S.storage = S.storage || []; S.waiting = S.waiting || VILLAGER_IDS.filter(id=>!S.residents.includes(id));
    while (S.inv.length < INV_SIZE) S.inv.push(null);
    return S;
  } catch (e) { console.warn('불러오기 실패', e); return null; }
}
export function deleteSave() { try { localStorage.removeItem(KEY); } catch (e) { /* 무시 */ } }
export function exportSave() { return localStorage.getItem(KEY) || ''; }
export function importSave(text) { const o = JSON.parse(text); if (!o || !o.player || !o.village) throw new Error('저장 파일이 아닙니다'); localStorage.setItem(KEY, text); }

// ---------------------------------------------------------------- 가방
export function addItem(id, n = 1) {
  const it = ITEMS[id];
  if (!canAdd(id, n)) return false;
  const max = it.stack || 1;
  if (max > 1) {
    for (const s of S.inv) if (s && s.id === id && s.n < max) { const put = Math.min(n, max - s.n); s.n += put; n -= put; if (n <= 0) return true; }
  }
  while (n > 0) {
    const i = S.inv.indexOf(null);
    if (i < 0) return false;
    const put = Math.min(n, max);
    S.inv[i] = { id, n: put };
    n -= put;
  }
  return true;
}
export function canAdd(id, n = 1) {
  const it = ITEMS[id];
  if (!it || !Number.isSafeInteger(n) || n < 1) return false;
  const max = it.stack || 1;
  for (const slot of S.inv) {
    if (!slot) n -= max;
    else if (slot.id === id) n -= max - slot.n;
    if (n <= 0) return true;
  }
  return false;
}
export function removeAt(i, n = 1) {
  const s = S.inv[i];
  if (!s) return null;
  s.n -= n;
  const id = s.id;
  if (s.n <= 0) S.inv[i] = null;
  return id;
}
export function countItem(id) { let n = 0; for (const s of S.inv) if (s && s.id === id) n += s.n; return n; }
export function takeItem(id, n = 1) {
  for (let i = 0; i < S.inv.length && n > 0; i++) { const s = S.inv[i]; if (s && s.id === id) { const t = Math.min(n, s.n); removeAt(i, t); n -= t; } }
  return n <= 0;
}
export function hasItem(id) { return S.inv.some((s) => s && s.id === id); }
export function freeSlots() { return S.inv.filter((s) => !s).length; }
export function ownedTools() { return ['tool_net', 'tool_rod', 'tool_shovel', 'tool_axe', 'tool_can'].filter(hasItem); }
export function addMoney(n) { S.player.money = Math.max(0, S.player.money + n); if (n > 0) S.stats.earned += n; }
