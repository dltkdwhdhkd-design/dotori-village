// 같이 하기 — 방 코드로 친구 마을에 놀러 간다.
//
// 자체 서버가 없다. 공개 MQTT 중계 서버 세 곳에 동시에 붙어서, 방 코드(숫자 4자리)가 들어간 주제로 글을 주고받는다.
// 문을 연 사람(방장)의 마을이 무대가 된다. 손님은 방장에게서 마을을 통째로 받아 그 마을에 선다.
//   누구나 보내는 것  me(이름·모습·손에 든 것)  p(위치, 1초에 8번쯤)  a(몸짓)  say(말풍선)  got(잡은 것 자랑)  tiles(땅 위의 것이 바뀐 칸)  bye
//   방장만 보내는 것  snap(마을 전체 — 들어온 손님에게)  npc(이웃 주민의 위치 + 건물 겉모습 정보)  full(자리가 없음)  close(문을 닫음)
//   손님이 보내는 것  join(마을을 보내 달라)
// 같은 글이 세 서버로 세 번 오므로 글 번호(mid)로 한 번만 받는다.
//
// 손님은 남의 마을에서 삽·도끼·심기·꽃 꺾기를 못 하고 건물에 들어가지 못한다. 낚시, 곤충 채집, 나무 흔들기, 줍기, 놓기, 물 주기는 된다.
// 손님으로 있는 동안에는 자기 마을만 저장된다(game.js 의 save 가 G.visit.home 을 저장한다).
import * as THREE from 'three';
import { G, buildWorld, groundY, refreshTime, save, worldInfo } from './game.js';
import { S } from './state.js';
import { Village } from '../world/village.js';
import { MAP_W, MAP_H } from '../world/mapgen.js';
import { Actor } from '../gfx/actor.js';
import { CURVE } from '../gfx/models.js';
import { MODEL, dress, packLook, unpackLook, lookOfModel } from './look.js';
import { syncVillagers } from './npc.js';
import { VILLAGERS, PERSONALITY } from '../data/villagers.js';
import { ITEMS, FISH_BY_ID, BUG_BY_ID } from '../data/items.js';
import { UI } from '../ui/ui.js';
import { Sound } from '../core/audio.js';
import { Clock } from '../core/clock.js';
import { el, josa } from '../core/util.js';
import { refreshGoal } from './quests.js';
import { clearNetMood, updateNetMood } from './netplay.js';

const BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt'];
const BASE = 'dotori-village/v1/';
const MAX_GUESTS = 7;
const TEST_BROKER = new URLSearchParams(location.search).get('mq');      // 점검용: ?mq=ws://127.0.0.1:1884 처럼 다른 중계 서버를 쓴다
const TOOLS = new Set(['tool_net', 'tool_rod', 'tool_shovel', 'tool_axe', 'tool_can']);
const ANIMS = new Set(['swing', 'dig', 'pour', 'cast', 'pull', 'pick', 'joy', 'wave', 'hop', 'ouch', 'shake', 'holdup']);
const OBJ_T = new Set(['tree', 'stump', 'rock', 'flower', 'weed', 'item', 'hole']);     // 손님이 알려 올 수 있는 칸의 종류(건물·고정물은 안 됨)

export const Net = {
  role: null,              // null | 'host' | 'guest'
  code: '', id: Math.random().toString(36).slice(2, 10),
  clients: [], seen: new Set(), n: 0, topic: '', t0: 0,
  peers: new Map(),        // 다른 사람들: id -> Remote
  puppets: new Map(),      // (손님) 방장 마을의 이웃 주민: id -> Puppet
  state: 'off',            // off | opening | open | joining | visiting
  err: '', hostSeen: 0, joinT: 0, sendT: 0, meT: 0, npcT: 0, infoT: 0, tileT: 0, lastP: '', day: 0,
  dirty: new Set(), applying: false, onChange: null,
};
G.net = Net;

const now = () => performance.now() / 1000;
const num = (v, a, b, d = 0) => (typeof v === 'number' && isFinite(v) ? Math.min(b, Math.max(a, v)) : d);
const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
const changed = () => { if (Net.onChange) Net.onChange(); hud(); };

// ---------------------------------------------------------------- 중계 서버
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
async function loadMqtt() {
  if (window.mqtt) return;
  for (const u of ['./vendor/mqtt/mqtt.min.js', 'https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js', 'https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js']) {
    try { await loadScript(u); if (window.mqtt) return; } catch (e) { /* 다음 주소로 */ }
  }
  throw new Error('mqtt');
}
export const netUp = () => Net.clients.filter((c) => c.connected).length;
export const netSlow = () => !netUp() && now() - Net.t0 > 10;
async function connect(code) {
  drop(); Net.t0 = now();
  await loadMqtt();
  Net.topic = BASE + code + '/m';
  for (const url of TEST_BROKER ? [TEST_BROKER] : BROKERS) {
    try {
      const c = window.mqtt.connect(url, { clientId: 'dv_' + Net.id + Math.random().toString(36).slice(2, 6), keepalive: 30, reconnectPeriod: 4000, connectTimeout: 9000, clean: true });
      c.on('connect', () => { c.subscribe(Net.topic); if (Net.role === 'guest' && Net.state === 'joining') send({ t: 'join' }); announce(); changed(); });
      c.on('close', changed);
      c.on('error', () => { });
      c.on('message', (topic, payload) => {
        let m; try { m = JSON.parse(payload.toString()); } catch (e) { return; }
        if (!m || typeof m !== 'object' || typeof m.mid !== 'string' || typeof m.f !== 'string' || m.f === Net.id || Net.seen.has(m.mid)) return;
        if (Net.seen.size > 9000) Net.seen.clear();
        Net.seen.add(m.mid);
        try { onMsg(m); } catch (e) { console.warn('같이 하기: 받은 글을 처리하지 못했습니다', e); }
      });
      Net.clients.push(c);
    } catch (e) { /* 이 서버는 건너뛴다 */ }
  }
}
function send(o) {
  if (!Net.clients.length) return;
  o.f = Net.id; o.mid = (Net.n++).toString(36) + '.' + Net.id;
  const s = JSON.stringify(o);
  for (const c of Net.clients) if (c.connected) { try { c.publish(Net.topic, s); } catch (e) { /* 끊긴 서버 */ } }
}
function drop() { for (const c of Net.clients) { try { c.end(true); } catch (e) { /* 이미 닫힘 */ } } Net.clients = []; Net.seen.clear(); }

// ---------------------------------------------------------------- 다른 사람(아바타)
let tags = null;
function tagLayer() { if (!tags) { tags = el('div'); tags.id = 'nettags'; document.getElementById('ui').appendChild(tags); } return tags; }
const _v = new THREE.Vector3();
/** 땅 위의 한 점이 화면의 어디인지(굽은 세계를 따라 내려간 만큼 맞춘다) */
function screenOf(x, y, z) {
  const d = z - CURVE.z.value;
  _v.set(x, y - d * d * CURVE.k.value, z).project(G.stage.camera);
  return _v.z > 1 || _v.z < -1 ? null : { x: (_v.x * 0.5 + 0.5) * window.innerWidth, y: (-_v.y * 0.5 + 0.5) * window.innerHeight };
}
class Tag {
  constructor(name, mine = false) {
    this.el = el('div', 'ntag' + (mine ? ' me' : ''));
    this.bub = el('div', 'nb hidden'); this.nm = el('div', 'nn', name || '');
    this.el.appendChild(this.bub); this.el.appendChild(this.nm);
    tagLayer().appendChild(this.el);
    this.t = 0;
  }
  name(s) { this.nm.textContent = s; }
  say(text, sec = 5) { this.bub.textContent = text; this.bub.classList.remove('hidden'); this.t = sec; }
  place(x, y, z, show, dt) {
    if (this.t > 0) { this.t -= dt; if (this.t <= 0) this.bub.classList.add('hidden'); }
    const p = show ? screenOf(x, y, z) : null;
    this.el.style.display = p ? '' : 'none';
    if (p) this.el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%)`;
  }
  dispose() { this.el.remove(); }
}

class Remote {
  constructor(id) {
    this.id = id; this.name = '손님'; this.lookS = ''; this.host = false;
    this.actor = new Actor(MODEL); this.actor.root.visible = false;
    G.stage.scene.add(this.actor.root);
    this.x = this.tx = 0; this.z = this.tz = 0; this.yaw = 0; this.sp = 0; this.inside = false; this.placed = false;
    this.seen = now(); this.tool = null; this.tag = new Tag(this.name); this.known = false;
  }
  me(m) {
    const name = str(m.n, 8) || '손님', ls = str(m.l, 20);
    this.name = name; this.tag.name(name); this.host = !!m.h;
    if (ls !== this.lookS) { this.lookS = ls; dress(this.actor, unpackLook(ls)); }
    const tool = TOOLS.has(m.tool) ? m.tool : null;
    if (tool !== this.tool) { this.tool = tool; this.actor.hold(tool ? ITEMS[tool].model : null); }
    this.known = true;
  }
  pos(m) {
    this.tx = num(m.x, 0, MAP_W, this.tx); this.tz = num(m.z, 0, MAP_H, this.tz); this.yaw = num(m.y, -10, 10, this.yaw); this.sp = num(m.s, 0, 2, 0); this.inside = !!m.i;
    if (!this.placed) { this.x = this.tx; this.z = this.tz; this.placed = true; this.actor.face(this.yaw, true); }
  }
  update(dt) {
    const show = this.placed && this.known && !this.inside && !G.room;
    this.actor.root.visible = show;
    const dx = this.tx - this.x, dz = this.tz - this.z, d = Math.hypot(dx, dz);
    if (d > 6) { this.x = this.tx; this.z = this.tz; }                       // 너무 멀면(다리를 건넜거나 끊겼다 이어짐) 바로 옮긴다
    else { const k = Math.min(1, dt * 9); this.x += dx * k; this.z += dz * k; }
    this.actor.speed = d > 0.05 ? Math.max(1, this.sp) : 0;
    this.actor.face(d > 0.08 ? Math.atan2(dx, dz) : this.yaw);
    const y = groundY(this.x, this.z);
    this.actor.setPos(this.x, y, this.z);
    if (show) this.actor.update(dt);
    this.tag.place(this.x, y + this.actor.topY + 0.12, this.z, show, dt);
  }
  dispose() { G.stage.scene.remove(this.actor.root); this.tag.dispose(); }
}

/** (손님 쪽) 방장 마을의 이웃 주민. 방장이 알려 주는 자리로 따라 움직인다 */
class Puppet {
  constructor(id) {
    this.id = id; this.def = VILLAGERS[id]; this.name = this.def.name; this.pitch = PERSONALITY[this.def.p].pitch; this.remote = true;
    this.actor = new Actor('villager_' + id); this.actor.root.visible = false;
    G.stage.scene.add(this.actor.root);
    this.x = this.tx = 0; this.z = this.tz = 0; this.yaw = 0; this.sp = 0; this.visible = false; this.talking = false; this.placed = false;
  }
  set(x, z, yaw, sp, vis) {
    this.tx = x; this.tz = z; this.yaw = yaw; this.sp = sp; this.visible = vis;
    if (!this.placed) { this.x = x; this.z = z; this.placed = true; this.actor.face(yaw, true); }
  }
  update(dt) {
    this.actor.root.visible = this.visible;
    if (!this.visible) { if (this.netMood) clearNetMood(this); return; }
    if (updateNetMood(this,dt)) return;
    const dx = this.tx - this.x, dz = this.tz - this.z, d = Math.hypot(dx, dz);
    if (d > 6) { this.x = this.tx; this.z = this.tz; } else if (!this.talking) { const k = Math.min(1, dt * 6); this.x += dx * k; this.z += dz * k; }
    this.actor.speed = d > 0.06 && !this.talking ? 1 : 0;
    if (this.talking) this.actor.faceTo(G.player.x, G.player.z); else this.actor.face(d > 0.08 ? Math.atan2(dx, dz) : this.yaw);
    this.actor.setPos(this.x, groundY(this.x, this.z), this.z);
    this.actor.update(dt);
  }
  dispose() { G.stage.scene.remove(this.actor.root); }
}

function peer(id) {
  let r = Net.peers.get(id);
  if (!r) {
    if (Net.peers.size >= MAX_GUESTS + 1) return null;
    r = new Remote(id); Net.peers.set(id, r);
    send({ t: 'me', ...meInfo() });                          // 새로 온 사람에게 나를 알린다
  }
  r.seen = now();
  return r;
}
function removePeer(id, quiet = false) {
  const r = Net.peers.get(id); if (!r) return;
  if (!quiet && r.known) { UI.toast(`${r.name} 님이 돌아갔다.`); Sound.sfx('close'); }
  r.dispose(); Net.peers.delete(id); changed();
}

// ---------------------------------------------------------------- 내가 보내는 것
const myLook = () => packLook(S.player.look || lookOfModel(S.player.model));
function meInfo() { return { n: S.player.name, l: myLook(), tool: S.player.tool || null, h: Net.role === 'host' ? 1 : 0 }; }
function announce() { if (Net.role && netUp()) { send({ t: 'me', ...meInfo() }); Net.meT = now(); } }
/** 몸짓을 알린다(player.js 가 부른다) */
Net.anim = (k, d) => { if (Net.role && ANIMS.has(k)) send({ t: 'a', k, d: +d.toFixed(2) }); };
/** 손에 든 것이나 모습이 바뀌었다 */
Net.refresh = () => announce();
/** 잡은 것을 자랑한다 */
Net.got = (kind, sp) => { if (Net.role) send({ t: 'got', k: kind, sp }); };
/** 말한다 */
Net.say = (text) => {
  text = String(text || '').trim().slice(0, 40); if (!text || !Net.role) return;
  send({ t: 'say', s: text });
  myTag().say(text);
};
let mine = null;
function myTag() { if (!mine) mine = new Tag('', true); return mine; }

// ---------------------------------------------------------------- 땅 위의 것 맞추기
function cleanObj(o) {
  if (o === null) return null;
  if (!o || typeof o !== 'object' || !OBJ_T.has(o.t)) return undefined;
  const r = {};
  for (const [k, v] of Object.entries(o).slice(0, 12)) {
    if (typeof v === 'string') r[k] = v.slice(0, 40); else if (typeof v === 'number' && isFinite(v)) r[k] = v; else if (typeof v === 'boolean') r[k] = v;
  }
  if (r.t === 'item' && !ITEMS[r.id]) return undefined;
  return r;
}
function watchVillage(v) {
  if (v.listeners.some((f) => f.net)) return;
  const f = (i) => { if (!Net.applying && Net.role && G.village === v) Net.dirty.add(i); };
  f.keep = f.net = true;                           // 마을을 다시 그려도(buildWorld) 떼어 내지 않는다
  v.onChange(f);
}
function flushTiles() {
  if (!Net.dirty.size) return;
  const v = G.village, list = [];
  for (const i of Net.dirty) { const o = v.objs[i]; if (o && (o.t === 'bld' || o.t === 'fix')) continue; list.push([i, o || null, v.buried[i] != null ? v.buried[i] : null]); }
  Net.dirty.clear();
  if (list.length > 120) { if (Net.role === 'host') sendSnap('*'); return; }       // 날이 바뀌어 한꺼번에 바뀐 경우: 마을을 통째로 다시 보낸다
  for (let k = 0; k < list.length; k += 40) send({ t: 'tiles', l: list.slice(k, k + 40) });
}
function applyTiles(m, fromHost) {
  if (!Array.isArray(m.l)) return;
  const v = G.village;
  Net.applying = true;
  try {
    for (const e of m.l.slice(0, 60)) {
      if (!Array.isArray(e)) continue;
      const i = e[0] | 0; if (i < 0 || i >= MAP_W * MAP_H) continue;
      const cur = v.objs[i]; if (cur && (['bld','fix','decor','decorPart'].includes(cur.t))) continue;
      const o = cleanObj(e[1]); if (o === undefined) continue;
      if (fromHost) { if (typeof e[2] === 'string' && ITEMS[e[2]]) v.buried[i] = e[2]; else delete v.buried[i]; }      // 땅에 묻는 것은 방장만 한다
      v.set(i % MAP_W, (i / MAP_W) | 0, o);
    }
  } finally { Net.applying = false; }
}

// ---------------------------------------------------------------- 방장: 문 열기
function sendSnap(to) {
  send({ t: 'snap', to, v: G.village.serialize(), info: worldInfo(), seed: Clock.seed, off: Clock.offsetMin, advanceMs: Clock.advanceMs, vn: S.village.name, hn: S.player.name });
}
export async function openGate() {
  if(G.room?.area)return UI.toast('귀가한 뒤 우리 마을의 문을 열 수 있어요.');
  if (Net.role) return;
  Net.role = 'host'; Net.state = 'opening'; Net.err = ''; Net.code = String(1000 + Math.floor(Math.random() * 9000)); Net.day = S.day;
  changed();
  try { await connect(Net.code); } catch (e) { Net.err = '중계 서버 프로그램을 불러오지 못했다. 인터넷 연결을 확인해 주세요.'; closeNet(true); return; }
  if (Net.role !== 'host') return;
  Net.state = 'open';
  watchVillage(G.village);
  changed();
}

// ---------------------------------------------------------------- 손님: 놀러 가기
export async function visit(code) {
  if (Net.role) return;
  if (G.room) { UI.toast('밖으로 나가서 떠나자.'); return; }
  Net.role = 'guest'; Net.state = 'joining'; Net.err = ''; Net.code = code; Net.joinT = now(); Net.hostSeen = 0;
  changed();
  try { await connect(code); } catch (e) { Net.err = '중계 서버 프로그램을 불러오지 못했다. 인터넷 연결을 확인해 주세요.'; closeNet(true); return; }
}
function cleanInfo(i) {
  const o = { shop: 0, museum: 0, pm: false, sites: [], lv: 1, lots: {} };
  if (!i || typeof i !== 'object') return o;
  o.shop = num(i.shop, 0, 2) | 0; o.museum = num(i.museum, 0, 2) | 0; o.pm = !!i.pm; o.lv = num(i.lv, 0, 3, 1) | 0;
  o.camp=!!i.camp; o.day=num(i.day,0,100000,0)|0;
  if (Array.isArray(i.sites)) o.sites = i.sites.slice(0, 12).map((n) => n | 0);
  if (i.lots && typeof i.lots === 'object') for (const [k, v] of Object.entries(i.lots).slice(0, 16)) if (VILLAGERS[v]) o.lots[+k | 0] = v;
  return o;
}
function arrival(v) {
  const d = v.dock;
  return d ? { x: d.x + 0.6 + Math.random() * 0.8, z: d.y + 0.5 + Math.random() * 0.6 } : { x: v.spawn.x + 0.5, z: v.spawn.y + 0.8 };
}
function enterVisit(m) {
  let v;
  try { v = Village.deserialize(m.v); if (!v.terrain || v.terrain.length !== MAP_W * MAP_H || !Array.isArray(v.buildings)) throw new Error('마을 모양이 다르다'); } catch (e) { Net.err = '마을을 받지 못했다. 방장과 내가 같은 판인지 확인해 주세요.'; closeNet(true); return; }
  const info = cleanInfo(m.info), again = !!G.visit;
  if (!again) {
    save();                                       // 내 마을을 저장해 두고 떠난다
    G.visit = { home: G.village, npcs: G.npcs, daily: S.daily, seed: Clock.seed, off: Clock.offsetMin, x: G.player.x, z: G.player.z };
    for (const n of G.npcs) { clearNetMood(n); n.actor.root.visible = false; }
    G.npcs = [];
    S.daily = { coinTrees: [], nestTrees: [], furnTrees: [], moneyRock: -1, rockHits: 0, shaken: [], stones: {} };
    if (G.player.fishing) G.player.endFishing();
  }
  Object.assign(G.visit, { info, name: str(m.vn, 8) || '친구', host: str(m.hn, 8) || '방장' });
  Clock.seed = num(m.seed, -2147483648, 2147483647, 1) | 0;
  readHostClock(m);
  buildWorld(v);
  watchVillage(v);
  G.critters.clear(); G.critters._water = null;
  if (!again) { const p = arrival(v); G.player.setPos(p.x, p.z); G.player.yaw = Math.PI; G.player.actor.face(Math.PI, true); G.stage.setFocus(p.x, 0, p.z, true); }
  refreshTime(true); refreshGoal();
  Net.state = 'visiting'; Net.hostSeen = now();
  if (!again) { UI.closePanel(); Sound.sfx('fanfare'); UI.toast(`${G.visit.name} 마을에 도착했다! 말하기는 T`, 4000); }
  announce(); changed();
}
function leaveVisit() {
  const V = G.visit; if (!V) return;
  for (const p of Net.puppets.values()) p.dispose();
  Net.puppets.clear();
  if (G.player.fishing) G.player.endFishing();
  G.visit = null;
  S.daily = V.daily; Clock.seed = V.seed; Clock.offsetMin = V.off;
  Clock.advanceMs = S.clockAdvanceMs;
  G.npcs = V.npcs;
  buildWorld(V.home);
  G.critters.clear(); G.critters._water = null;
  G.player.setPos(V.x, V.z); G.stage.setFocus(V.x, 0, V.z, true);
  syncVillagers(true);
  refreshTime(true); refreshGoal();
  save();
}

/** 문을 닫거나(방장) 돌아온다(손님). */
export function closeNet(quiet = false) {
  if (!Net.role) return;
  const role = Net.role;
  if (netUp()) send({ t: role === 'host' ? 'close' : 'bye' });
  for (const id of [...Net.peers.keys()]) removePeer(id, true);
  if (mine) { mine.dispose(); mine = null; }
  const c = Net.clients; Net.clients = []; Net.seen.clear();
  setTimeout(() => { for (const x of c) { try { x.end(true); } catch (e) { /* 이미 닫힘 */ } } }, 300);     // 마지막 글이 나갈 틈을 준다
  Net.role = null; Net.state = 'off'; Net.code = ''; Net.dirty.clear();
  if (role === 'guest' && G.visit) { leaveVisit(); if (!quiet) UI.toast('우리 마을로 돌아왔다.'); }
  changed();
}

// ---------------------------------------------------------------- 받은 글
function onMsg(m) {
  if (!Net.role) return;
  const host = Net.role === 'host';
  if (m.t === 'join') { if (host) { if (!Net.peers.has(m.f) && Net.peers.size >= MAX_GUESTS) send({ t: 'full', to: m.f }); else sendSnap(m.f); } return; }
  if (m.t === 'snap') { if (!host && (m.to === Net.id || (m.to === '*' && G.visit))) { Net.hostId = m.f; enterVisit(m); } return; }
  if (m.t === 'full') { if (!host && m.to === Net.id && Net.state === 'joining') { Net.err = '그 마을은 지금 손님이 가득 찼다.'; closeNet(true); } return; }
  if (Net.role === 'guest' && Net.state !== 'visiting') return;          // 아직 마을을 받지 못했으면 다른 글은 미뤄 둔다
  if (m.t === 'close') { if (!host && m.f === Net.hostId) { closeNet(true); UI.toast('방장이 문을 닫아 우리 마을로 돌아왔다.', 4000); } return; }
  if (m.t === 'bye') { removePeer(m.f); return; }
  if (m.t === 'npc') { if (!host && m.f === Net.hostId) { Net.hostSeen = now(); onNpc(m); } return; }
  if (m.t === 'tiles') { applyTiles(m, m.f === Net.hostId); return; }
  const r = peer(m.f); if (!r) return;
  if (m.f === Net.hostId) Net.hostSeen = now();
  if (m.t === 'me') { const first = !r.known; r.me(m); if (first) { UI.toast(host ? `${r.name} 님이 놀러 왔다!` : `${r.name} 님도 와 있다.`); if (host) Sound.sfx('fanfare'); changed(); } }
  else if (m.t === 'p') r.pos(m);
  else if (m.t === 'a') { if (ANIMS.has(m.k)) r.actor.play(m.k, num(m.d, 0.1, 3, 0.5)); }
  else if (m.t === 'say') { const s = str(m.s, 40); if (s) { r.tag.say(s); Sound.sfx('ui'); } }
  else if (m.t === 'got') {
    const sp = m.k === 'fish' ? FISH_BY_ID[m.sp] : m.k === 'bug' ? BUG_BY_ID[m.sp] : null;
    if (sp) { r.tag.say(`${josa(sp.name, '을/를')} ${m.k === 'fish' ? '낚았다' : '잡았다'}!`, 4); r.actor.play('joy', 0.9); }
  }
}
function readHostClock(m) {
  Clock.offsetMin = num(m.off, -720, 720);
  Clock.advanceMs = num(m.advanceMs, 0, 8.64e15 - Date.now() - 86400000);
}
function onNpc(m) {
  if (Array.isArray(m.l)) {
    const seen = new Set();
    for (const e of m.l.slice(0, 16)) {
      if (!Array.isArray(e) || !VILLAGERS[e[0]]) continue;
      let p = Net.puppets.get(e[0]);
      if (!p) { p = new Puppet(e[0]); Net.puppets.set(e[0], p); }
      p.set(num(e[1], 0, MAP_W), num(e[2], 0, MAP_H), num(e[3], -10, 10), num(e[4], 0, 2), !!e[5]);
      seen.add(e[0]);
    }
    for (const [id, p] of Net.puppets) if (!seen.has(id)) { p.dispose(); Net.puppets.delete(id); }
    G.npcs = [...Net.puppets.values()];
  }
  if (m.info && G.visit) {                           // 건물이 새로 섰거나 이웃이 이사 왔으면 겉모습을 다시 그린다
    if (typeof m.off === 'number') readHostClock(m);
    const info = cleanInfo(m.info);
    if (JSON.stringify(info) !== JSON.stringify(G.visit.info)) { G.visit.info = info; for (const b of G.village.buildings) G.world.refreshBuilding(b); }
  }
}

// ---------------------------------------------------------------- 매 프레임
export function updateNet(dt) {
  if (!Net.role || !G.player) return;
  const t = now(), P = G.player;
  for (const r of Net.peers.values()) r.update(dt);
  if (mine) mine.place(P.x, groundY(P.x, P.z) + P.actor.topY + 0.12, P.z, !G.room && mine.t > 0, dt);
  if (Net.role === 'guest' && Net.state === 'joining') {
    if (t - Net.joinT > 3 && netUp()) { Net.joinT = t; send({ t: 'join' }); }           // 답이 없으면 다시 청한다
    return;
  }
  // 내 위치: 움직일 때는 1초에 8번, 서 있을 때는 1초에 한 번
  const inside = G.room ? 1 : 0, sp = P.actor.speed || 0;
  const key = inside ? 'in' : `${P.x.toFixed(2)},${P.z.toFixed(2)},${P.yaw.toFixed(1)}`;
  if ((key !== Net.lastP && t - Net.sendT > 0.125) || t - Net.sendT > 1) {
    Net.sendT = t; Net.lastP = key;
    send({ t: 'p', x: +P.x.toFixed(2), z: +P.z.toFixed(2), y: +P.yaw.toFixed(2), s: +sp.toFixed(1), i: inside });
  }
  if (t - Net.meT > 4) announce();
  if (t - Net.tileT > 0.25) { Net.tileT = t; flushTiles(); }
  if (Net.role === 'host') {
    if (t - Net.npcT > 0.25) {                       // 이웃 주민의 자리
      Net.npcT = t;
      const o = { t: 'npc', l: G.npcs.map((n) => [n.id, +n.x.toFixed(2), +n.z.toFixed(2), +(n.actor.yaw || 0).toFixed(2), n.actor.speed ? 1 : 0, n.visible && !G.room ? 1 : 0]) };
      if (t - Net.infoT > 4) { Net.infoT = t; o.info = worldInfo(); o.off = Clock.offsetMin; o.advanceMs = Clock.advanceMs; }
      if (Net.peers.size) send(o);
    }
    if (S.day !== Net.day) { Net.day = S.day; Net.dirty.clear(); if (Net.peers.size) sendSnap('*'); }      // 날이 바뀌면 마을을 다시 보낸다
  } else if (Net.hostSeen && t - Net.hostSeen > 14) {
    closeNet(true); UI.toast('방장과 연결이 끊겨 우리 마을로 돌아왔다.', 4500);
  }
  for (const [id, r] of Net.peers) if (t - r.seen > 12) removePeer(id);
}

// ---------------------------------------------------------------- 화면: 알림 한 줄, 말하기, 같이 하기 창
let chip = null, chatBox = null;
function hud() {
  if (!chip) { chip = el('div', 'hidden'); chip.id = 'hud-net'; document.getElementById('ui').appendChild(chip); chip.onclick = () => openNet(); }
  const n = [...Net.peers.values()].filter((r) => r.known).length;
  const text = Net.state === 'open' || Net.state === 'opening' ? `문 열림 · 방 코드 ${Net.code} · 손님 ${n}명` : Net.state === 'visiting' ? `${G.visit ? G.visit.name : ''} 마을에 놀러 옴 · ${n + 1}명` : Net.state === 'joining' ? `방 ${Net.code} 찾는 중…` : '';
  chip.textContent = text; chip.classList.toggle('hidden', !text);
  if (G.started && baseMenu) UI.setMenu(menuList());
}
let baseMenu = null;
/** 화면 아래 단추 줄: 같이 하는 동안에는 '말하기'가 더해진다 */
export function setBaseMenu(list) { baseMenu = list; UI.setMenu(menuList()); }
function menuList() { return Net.role && Net.state !== 'joining' ? [['말하기', 'T', openChat], ...baseMenu] : baseMenu; }

const QUICK = [['안녕!', 'wave'], ['이리 와!', 'hop'], ['좋아!', 'joy'], ['고마워!', 'joy'], ['잘 가!', 'wave']];
export function openChat() {
  if (!Net.role || UI.blocking() || G.busy) return;
  if (chatBox) { chatBox.querySelector('input').focus(); return; }
  chatBox = el('div'); chatBox.id = 'chat';
  const row = el('div', 'cq');
  const close = () => { if (chatBox) { chatBox.remove(); chatBox = null; } };
  for (const [s, a] of QUICK) { const b = el('button', 'btn', s); b.onclick = () => { Net.say(s); G.player.actor.play(a, 0.8); Net.anim(a, 0.8); close(); }; row.appendChild(b); }
  const inp = el('input'); inp.type = 'text'; inp.maxLength = 40; inp.placeholder = '할 말을 적고 Enter (Esc: 닫기)';
  inp.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { if (inp.value.trim()) Net.say(inp.value); close(); } else if (e.key === 'Escape') close();
  });
  chatBox.appendChild(row); chatBox.appendChild(inp);
  document.getElementById('ui').appendChild(chatBox);
  setTimeout(() => inp.focus(), 0);
}
export const chatOpen = () => !!chatBox;

export function openNet() {
  const box = el('div', 'netui');
  const draw = () => {
    box.innerHTML = '';
    const up = netUp(), people = [...Net.peers.values()].filter((r) => r.known);
    const status = () => el('div', 'note', up ? `중계 서버 연결됨 (${up}/${TEST_BROKER ? 1 : BROKERS.length})` : netSlow() ? '⚠ 중계 서버에 연결되지 않는다. 학교나 회사의 방화벽이 실시간 연결(WebSocket)을 막고 있을 수 있다. 다른 네트워크(휴대폰 핫스팟 등)에서 다시 해 보자.' : '중계 서버에 연결하는 중…');
    if (Net.err) box.appendChild(el('div', 'note warn', '⚠ ' + Net.err));
    if (!Net.role) {
      box.appendChild(el('div', 'note', '친구와 같은 마을에서 놀 수 있다. 한 사람이 문을 열어 <b>방 코드</b>를 알려 주면, 다른 사람이 그 코드로 놀러 간다. 놀러 간 마을에서는 낚시와 곤충 채집, 나무 흔들기, 줍기와 놓기를 할 수 있고, 삽·도끼는 쓰지 않는다. 내 마을은 그대로 남는다.'));
      const a = el('div', 'net2');
      const h = el('div', 'nc'); h.appendChild(el('h3', '', '우리 마을에 부르기'));
      h.appendChild(el('div', 'note', '방 코드가 만들어진다. 친구에게 알려 주자.'));
      const bo = el('button', 'btn go', '문 열기'); bo.onclick = () => { Net.err = ''; openGate(); draw(); }; h.appendChild(bo);
      const g = el('div', 'nc'); g.appendChild(el('h3', '', '친구 마을에 놀러 가기'));
      const inp = el('input'); inp.type = 'text'; inp.maxLength = 4; inp.inputMode = 'numeric'; inp.placeholder = '방 코드 4자리'; inp.className = 'code-in';
      const bg = el('button', 'btn go', '놀러 가기');
      const go = () => { const c = inp.value.trim(); if (!/^\d{4}$/.test(c)) { UI.toast('방 코드는 숫자 4자리'); return; } Net.err = ''; visit(c); draw(); };
      bg.onclick = go; inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') go(); });
      g.appendChild(inp); g.appendChild(bg);
      a.appendChild(h); a.appendChild(g); box.appendChild(a);
      if (G.room) box.appendChild(el('div', 'note', '놀러 가려면 먼저 밖으로 나가야 한다.'));
    } else if (Net.role === 'host') {
      box.appendChild(el('div', 'note', '문이 열려 있다. 친구에게 이 방 코드를 알려 주자.'));
      box.appendChild(el('div', 'code', Net.code));
      box.appendChild(status());
      box.appendChild(el('div', 'note', people.length ? `와 있는 손님: ${people.map((r) => r.name).join(', ')}` : '아직 온 손님이 없다. (손님은 메뉴 → 같이 하기 → 놀러 가기에서 코드를 넣는다)'));
      const b = el('button', 'btn warn', '문 닫기'); b.onclick = () => { closeNet(); draw(); }; box.appendChild(b);
    } else if (Net.state === 'joining') {
      box.appendChild(el('div', 'note', `방 ${Net.code}에 가는 중… 코드가 맞는지, 친구가 문을 열어 두었는지 확인하자.`));
      box.appendChild(status());
      const b = el('button', 'btn', '그만두기'); b.onclick = () => { closeNet(true); draw(); }; box.appendChild(b);
    } else {
      box.appendChild(el('div', 'note', `<b>${G.visit.name}</b> 마을에 놀러 와 있다. (방장: ${G.visit.host})`));
      box.appendChild(status());
      box.appendChild(el('div', 'note', `같이 있는 사람: ${people.map((r) => r.name + (r.host ? '(방장)' : '')).join(', ') || '…'}`));
      box.appendChild(el('div', 'note', '말하기는 <b>T</b>. 낚은 것과 잡은 것은 내 가방과 도감에 들어간다.'));
      const b = el('button', 'btn warn', '우리 마을로 돌아가기'); b.onclick = () => { closeNet(); UI.closePanel(); }; box.appendChild(b);
    }
  };
  draw();
  Net.onChange = draw;
  const iv = setInterval(() => { if (Net.role) draw(); }, 2500);
  UI.openPanel('같이 하기', box, { onClose: () => { Net.onChange = null; clearInterval(iv); } });
}

Net.update = updateNet;
