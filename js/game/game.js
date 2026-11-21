// 게임의 중심: 장면(마을/실내) 전환, 매 프레임 갱신, 시간·날씨, 저장
import * as THREE from 'three';
import { Stage } from '../gfx/stage.js';
import { WorldView } from '../gfx/worldview.js';
import { loadBundle, loadSingle, patchMaterial, getMat, sharedMat } from '../gfx/models.js';
import { registerImageChar } from '../gfx/actor.js';
import { Village } from '../world/village.js';
import { G as T, MAP_W, MAP_H } from '../world/mapgen.js';
import { WATER_Y } from '../gfx/terrain.js';
import { Clock, dayKey, daylight, twilight, weatherAt, seasonLook, dateLabel, timeLabel, WEATHER_KO, SEASON_KO, season, hourF } from '../core/clock.js';
import { Input } from '../core/input.js';
import { Sound } from '../core/audio.js';
import { UI, Dialog } from '../ui/ui.js';
import { S, Settings, saveGame, ownedTools, saveSettings } from './state.js';
import { ITEMS, loadData } from '../data/items.js';
import { VERSION } from '../core/version.js';
import { VILLAGERS } from '../data/villagers.js';
import { clamp, rand } from '../core/util.js';

export const G = {
  stage: null, world: null, village: null, room: null, player: null, npcs: [], critters: null,
  time: 0, started: false, busy: 0, paused: false,
  now: new Date(), look: null, weather: 'clear', dayLight: 1,
  hooks: {},                 // 다른 모듈이 채우는 함수들(순환 참조를 피하려고)
  fxList: [],
};

// ---------------------------------------------------------------- 자산 불러오기
export async function loadAssets(onProgress) {
  const bundles = ['nature', 'buildings', 'furniture', 'items', 'fish', 'bugs','places'];
  let done = 0;
  const V = '?v=' + VERSION;
  const chars = await fetch('./assets/chars/chars.json' + V).then((r) => r.json());
  const total = bundles.length + Object.keys(chars).length + 1;
  const tick = (m) => { done++; onProgress(done / total, m); };
  await loadData(); tick('도감을 펼치는 중…');
  await Promise.all(bundles.map((b) => loadBundle(`./assets/models/${b}.glb${V}`).then(() => tick('마을 물건을 나르는 중…'))));
  await Promise.all(Object.entries(chars).map(([id, c]) => {
    const url = './assets/chars/' + c.file + V;
    const p = /\.(png|webp|jpg|jpeg)$/i.test(c.file) ? registerImageChar(id, url) : loadSingle(url, id).catch((e) => console.warn('캐릭터를 불러오지 못했습니다:', id, e));
    return p.then(() => tick('이웃들이 모이는 중…'));
  }));
  // 물고기 그림자는 반투명하게
  const sh = getMat('c_1a2a44'); if (sh) { sh.transparent = true; sh.opacity = 0.42; sh.depthWrite = false; }
  const glow = getMat('c_eaff8a'); if (glow) { glow.emissive.set(0xeaff8a); }
}

export function initStage(canvas) {
  G.stage = new Stage(canvas);
  G.stage.setShadows(Settings.shadow !== false);
  return G.stage;
}

// ---------------------------------------------------------------- 마을 만들기
/** 지금 서 있는 마을의 건물 겉모습을 정하는 정보(내 마을이면 내 저장에서, 놀러 간 마을이면 방장이 보내 준 것) */
export function worldInfo() {
  if (G.visit) return G.visit.info;
  const P = S.prog || { shop: 2, museum: 2, pend: {} }, lots = {};
  for (const [id, v] of Object.entries(S.villagers)) lots[v.lot] = id;
  return { shop:P.shop, museum:P.museum, pm:!!P.pend.museum, sites:[...(P.pend.sites||[]),...(S.islandLife?.projects||[]).map(p=>p.lot)], lv:S.player.houseLv, lots, camp:!!S.flags.campStart && S.player.houseLv===0, day:S.day };
}

export function buildWorld(village) {
  if (G.world) { G.stage.scene.remove(G.world.root); G.world.dispose(); }
  village.listeners = village.listeners.filter((f) => f.keep);      // 앞서 그렸던 화면이 걸어 둔 것은 떼어 낸다
  G.village = village;
  G.world = new WorldView(G.stage, village, {
    buildingLook: (b) => {
      const I = worldInfo();
      if (b.type === 'hall') return { model: I.camp ? 'tent_museum' : 'hall' };
      if (b.type==='atelier'||b.type==='campsite') return {model:b.ready>I.day?'site':b.type==='atelier'?'atelier':'tent_home',scale:b.type==='campsite'?.76:1};
      if (I.camp && b.type==='house' && I.lots[b.lot])return {model:'tent_home',scale:.79};
      if (b.type === 'shop') return { model: I.shop >= 2 ? 'shop' : 'tent_shop' };
      if (b.type === 'museum') return I.museum >= 2 ? { model: 'museum' } : I.museum === 1 ? { model: 'tent_museum' } : I.pm ? { model: 'site' } : null;
      if (b.type === 'home' && I.lv < 1) return { model: 'tent_home' };
      if (b.type === 'home') return { model: 'home_' + I.lv, tint: { roof: 0xb8763c, roof_d: 0x94592a, wall: 0xfff1d2, wall_d: 0xe6cfa2 } };     // 도토리 깍정이 지붕
      const vid = I.lots[b.lot];
      if (!vid) return I.sites.includes(b.lot) ? { model: 'site' } : null;        // 새 이웃을 맞으려고 다듬어 둔 터
      const v = VILLAGERS[vid], c = new THREE.Color(v.roof);
      return { model: v.house, tint: { roof: v.roof, roof_d: c.clone().multiplyScalar(0.8).getHex(), wall: v.wall, wall_d: new THREE.Color(v.wall).multiplyScalar(0.88).getHex(), door: v.door, door_d: new THREE.Color(v.door).multiplyScalar(0.8).getHex() } };
    },
    playerPos: () => (G.player && !G.room && G.started ? G.player : null),
    itemModel: (id) => {
      const it = ITEMS[id];
      if (!it) return 'bundle';
      if (it.kind === 'furniture' || it.kind === 'wall' || it.kind === 'floor') return 'bundle';
      if (it.kind === 'tool') return it.model;
      return it.model || 'bundle';
    },
    decorSize:id=>[ITEMS[id]?.w||1,ITEMS[id]?.d||1],
    decorModel: id=>ITEMS[id]?.model || 'bundle',
    itemTint: (id) => (ITEMS[id] && ITEMS[id].tint && !['wall', 'floor'].includes(ITEMS[id].kind) ? ITEMS[id].tint : undefined),
    itemScale: (id) => { const it = ITEMS[id]; if (!it) return 1; if (it.kind === 'fish' || it.kind === 'misc') return 0.8; if (it.kind === 'tool') return 0.7; return it.scale ? Math.min(it.scale, 1.5) : 1; },
  });
  refreshTime(true);
}

// ---------------------------------------------------------------- 시간·날씨
let lastMinute = -1;
export function refreshTime(force = false) {
  const now = Clock.now();
  G.now = now;
  const minute = now.getHours() * 60 + now.getMinutes();
  if (!force && minute === lastMinute) return;
  lastMinute = minute;
  G.look = seasonLook(now);
  G.weather = weatherAt(now);
  G.dayLight = daylight(now);
  if (G.world) { G.world.setLook(G.look); G.world.setNight(1 - clamp(G.dayLight * 1.4, 0, 1)); }
  G.stage.setLighting(G.dayLight, twilight(now), G.weather, hourF(now),G.room?.id);
  if (G.started) {
    UI.setClock(dateLabel(now), timeLabel(now), `${SEASON_KO[season(now)]} · ${WEATHER_KO[G.weather]}`);
    const k = dayKey(now);
    if (S.day !== k && G.hooks.newDay && !G.busy && !UI.blocking() && !G.visit) G.hooks.newDay(k);      // 놀러 가 있을 때는 돌아와서 넘긴다
    if (G.hooks.minute) G.hooks.minute(now);
    const h = hourF(now);
    Sound.music(G.room ? 'indoor' : h < 5 || h >= 21 ? 'night' : h < 10 ? 'morning' : h < 17 ? 'day' : 'evening');
  }
}

// ---------------------------------------------------------------- 작은 효과(잎, 흙, 물방울)
const fxGeo = new THREE.SphereGeometry(0.06, 5, 4);
const fxMats = {};
function fxMat(color) { if (!fxMats[color]) fxMats[color] = patchMaterial(new THREE.MeshBasicMaterial({ color, transparent: true })); return fxMats[color]; }
export function burst(kind, x, y, z, n = 8) {
  const C = { leaf: [0x6cc25a, 0x93da76], dirt: [0xa9774a, 0x86592f], splash: [0xffffff, 0xcfeeff], spark: [0xffe36e, 0xffffff], dust: [0xe9dcc0, 0xfff8e6], snow: [0xffffff, 0xe6f0fa], petal: [0xf9b3cb, 0xffe1ea], heart: [0xf0567a, 0xff9ab0] }[kind] || [0xffffff];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(fxGeo, fxMat(C[i % C.length]));
    m.frustumCulled = false;
    m.position.set(x + (Math.random() - 0.5) * 0.3, y, z + (Math.random() - 0.5) * 0.3);
    const up = kind === 'leaf' || kind === 'petal' ? 1.2 : kind === 'splash' ? 3.2 : 2.2;
    G.stage.scene.add(m);
    G.fxList.push({ m, vx: (Math.random() - 0.5) * 2.4, vy: up * (0.6 + Math.random() * 0.7), vz: (Math.random() - 0.5) * 2.4, t: 0, life: 0.5 + Math.random() * 0.4, g: kind === 'leaf' || kind === 'petal' ? 3 : 9, s: kind === 'leaf' ? 1.4 : 1 });
  }
}
function updateFx(dt) {
  for (let i = G.fxList.length - 1; i >= 0; i--) {
    const f = G.fxList[i]; f.t += dt;
    f.vy -= f.g * dt;
    f.m.position.x += f.vx * dt; f.m.position.y += f.vy * dt; f.m.position.z += f.vz * dt;
    const k = 1 - f.t / f.life;
    f.m.scale.setScalar(Math.max(0.01, k) * f.s);
    if (f.t >= f.life) { G.stage.scene.remove(f.m); G.fxList.splice(i, 1); }
  }
}

// 비와 눈
class Weather {
  constructor(scene) {
    const N = 500;
    this.N = N;
    const pos = new Float32Array(N * 6);
    this.rainGeo = new THREE.BufferGeometry(); this.rainGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.LineSegments(this.rainGeo, new THREE.LineBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.55 }));
    this.rain.frustumCulled = false; this.rain.visible = false; scene.add(this.rain);
    const sp = new Float32Array(N * 3);
    this.snowGeo = new THREE.BufferGeometry(); this.snowGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.snow = new THREE.Points(this.snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.14, transparent: true, opacity: 0.9 }));
    this.snow.frustumCulled = false; this.snow.visible = false; scene.add(this.snow);
    this.p = [];
    for (let i = 0; i < N; i++) this.p.push({ x: (Math.random() - 0.5) * 34, y: Math.random() * 14, z: (Math.random() - 0.7) * 30, s: 0.6 + Math.random() * 0.8 });
  }
  update(dt, kind, fx, fz) {
    this.rain.visible = kind === 'rain'; this.snow.visible = kind === 'snow';
    if (kind !== 'rain' && kind !== 'snow') return;
    const rp = this.rainGeo.attributes.position.array, sp = this.snowGeo.attributes.position.array;
    for (let i = 0; i < this.N; i++) {
      const p = this.p[i];
      p.y -= dt * (kind === 'rain' ? 17 : 1.6) * p.s;
      if (kind === 'snow') p.x += Math.sin(G.time * 1.3 + i) * dt * 0.5;
      if (p.y < 0) { p.y = 12 + Math.random() * 2; p.x = (Math.random() - 0.5) * 34; p.z = (Math.random() - 0.7) * 30; }
      const x = fx + p.x, z = fz + p.z;
      if (kind === 'rain') { rp[i * 6] = x; rp[i * 6 + 1] = p.y; rp[i * 6 + 2] = z; rp[i * 6 + 3] = x + 0.08; rp[i * 6 + 4] = p.y + 0.55; rp[i * 6 + 5] = z; }
      else { sp[i * 3] = x; sp[i * 3 + 1] = p.y; sp[i * 3 + 2] = z; }
    }
    (kind === 'rain' ? this.rainGeo : this.snowGeo).attributes.position.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- 진행
let weather = null, saveT = 0, timeT = 0, stepT = 0;

export function startLoop() {
  weather = new Weather(G.stage.scene);
  let last = performance.now();
  // 느린 컴퓨터 돌보기: 시작하고 몇 초 동안 화면이 버벅이면 해 그림자를 끄고, 그래도 느리면 해상도를 낮춘다
  let slowT = 0, slowN = 0, slowSum = 0, slowStep = 0;
  const frame = (t) => {
    const raw = (t - last) / 1000, dt = Math.min(0.05, raw);
    last = t;
    if (G.started && !G.room && document.visibilityState === 'visible' && raw < 1 && slowStep < 2 && !G.noAutoQuality) {
      slowT += raw;
      if (slowT > 3) { slowN++; slowSum += raw; }
      if (slowN >= 150) {
        const avg = slowSum / slowN;
        if (avg > 1 / 27) {
          if (slowStep === 0 && G.stage.shadows) { G.stage.setShadows(false); Settings.shadow = false; saveSettings(); UI.toast('화면이 느려서 해 그림자를 껐어요. (메뉴에서 다시 켤 수 있어요)'); }
          else { G.stage.renderer.setPixelRatio(1); G.stage.resize(); slowStep = 1; }
          slowStep++;
        } else slowStep = 2;
        slowN = 0; slowSum = 0; slowT = 0;
      }
    }
    update(dt);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/** 대본(대화 등)을 실행하는 동안 조작을 막는다 */
export async function runScript(fn) {
  G.busy++;
  try { await fn(); } catch (e) { console.error(e); } finally { G.busy--; Dialog.close(); }
}

export function update(dt) {
  G.time += dt;
  UI.update(dt);
  timeT += dt;
  if (timeT > 1) { timeT = 0; refreshTime(); }
  if (G.started) {
    const free = !UI.blocking() && !G.busy && !G.room?.observation;
    UI.touch?.show(free);
    if (G.player) G.player.update(dt, free);
    if (G.room) G.room.update(dt);
    else {
      for (const n of G.npcs) n.update(dt);
      if (G.extras) for (const a of G.extras) a.update(dt);      // 연출 때만 잠깐 나오는 인물(잔치의 이장·까미·두루)
    }
    if (G.net && G.net.update) G.net.update(dt);                 // 같이 하기: 다른 사람들
    if (!G.room) {
      if (G.critters) G.critters.update(dt);
    }
    if (free) {
      if (Input.take('bag')) G.hooks.openBag();
      else if (Input.take('dex')) G.hooks.openDex();
      else if (Input.take('map')) G.hooks.openMap();
      else if (Input.take('note')) G.hooks.openNote();
      else if (Input.take('chat')) { if (G.net && G.net.role) G.hooks.openChat(); }
      else if (Input.take('menu')) G.hooks.openMenu();
    }
    const p = G.player;
    if (p) {
      if (G.room) { const f = G.room.focus(p.x, p.z); G.stage.setFocus(f.x, f.y||0, f.z); }
      else G.stage.setFocus(clamp(p.x, 9, MAP_W - 9), 0, clamp(p.z, 8, MAP_H - 2.5));
      if (G.world && !G.room) G.world.update(dt, G.time, G.stage.focus.x, G.stage.focus.z);
      weather.update(dt, G.room ? 'none' : G.weather, G.stage.focus.x, G.stage.focus.z);
      UI.setMoney(S.player.money);
      UI.setTools(ownedTools(), S.player.tool, (id) => p.equip(S.player.tool === id ? null : id));
      const touchNet = UI.touch?.active && free && S.player.tool === 'tool_net' && p.netActionAvailable();
      UI.hint(free ? p.hint() : '', touchNet ? '잠자리채' : '행동');
    }
    saveT += dt;
    if (saveT > 45 && free && !G.room) { saveT = 0; save(); }
  } else if (G.title) {
    G.title.update(dt);
  } else if (G.world) {
    G.world.update(dt, G.time, G.stage.focus.x, G.stage.focus.z);
  }
  updateFx(dt);
  Input.endFrame();
  G.stage.zoomT = G.started && Dialog.active && !UI.panelOpen ? 0.88 : 1;      // 대화하는 동안 살짝 다가간다
  G.stage.render();
}

export function save() {
  if (!G.started || !G.village) return false;
  if (G.visit) {                                 // 놀러 가 있는 동안에는 내 마을만 저장한다(자리와 오늘의 기록도 떠나기 전 것)
    const d = S.daily; S.daily = G.visit.daily;
    const ok = saveGame(G.visit.home);
    S.daily = d;
    return ok;
  }
  if (G.player && !G.room) { S.player.x = G.player.x; S.player.z = G.player.z; }
  return saveGame(G.village);
}

/** 땅 높이(다리와 부두 위는 판자 높이) */
export function groundY(x, z) {
  const v = G.village; if (!v || G.room) return 0;
  const t = v.terrainAt(Math.floor(x), Math.floor(z));
  if (t === T.BRIDGE || t === T.DOCK) return 0.045;
  return G.world.gy(x, z);
}
export { WATER_Y };
