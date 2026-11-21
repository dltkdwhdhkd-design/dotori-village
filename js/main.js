// 시작점: 자산을 불러오고, 타이틀을 보여 주고, 마을을 연다
import { G, initStage, loadAssets, buildWorld, startLoop, refreshTime, advanceVillageTime, runScript, save } from './game/game.js';
import { Player } from './game/player.js';
import { Critters } from './game/critters.js';
import { syncVillagers } from './game/npc.js';
import { registerScripts, intro } from './game/scripts.js';
import { registerMenus, showTitle, updateMailFlag, openBag, openDex, openMap, openMenu } from './game/menus.js';
import { newDay, firstDay, mail } from './game/daily.js';
import { S, Settings, loadSettings, newState, loadGame, addItem, addMoney, peekPlayer } from './game/state.js';
import { MODEL, defaultLook, unpackLook } from './game/look.js';
import { Village } from './world/village.js';
import { G as TT, WK, MAP_W } from './world/mapgen.js';
import { newProg, ensureProg, refreshGoal, openNote } from './game/quests.js';
import { UI } from './ui/ui.js';
import { openNet, openChat, setBaseMenu, closeNet } from './game/net.js';
import { Sound } from './core/audio.js';
import { Clock, dayKey } from './core/clock.js';
import { Input } from './core/input.js';
import { TitleScene } from './game/titlescene.js';

import { ensureBench, housing, islandTools, yardMenu } from './game/island.js';
import { travel } from './game/travel.js';
import { workshop } from './game/workshop.js';

function start(isNew) {
  ensureBench();
  if (G.title) { G.title.dispose(); G.title = null; }
  Clock.seed = S.seed;
  ensureProg();                                   // 예전 저장은 '다 자란 마을'로 이어받는다
  if (!S.flags.mirror) {                          // 거울이 생기기 전에 만든 마을에는 편지로 보낸다
    S.flags.mirror = true;
    mail('ujik', '우직 이장', `${S.player.name}에게.\n\n읍내 장에서 쓸 만한 거울을 하나 구했네.\n집 안에 세워 두고 그 앞에 서면\n머리 모양이며 옷을 바꿔 볼 수 있다네.\n\n이장 우직`, 'f_mirror');
  }
  G.player = new Player();
  G.critters = new Critters();
  syncVillagers(true);
  G.started = true;
  G.stage.setMode(false);
  G.stage.setFocus(G.player.x, 0, G.player.z, true);
  UI.showHud(true);
  setBaseMenu([['수첩', 'N', openNote], ['가방', 'E', openBag], ['도감', 'C', openDex], ['지도', 'M', openMap], ['메뉴', 'Esc', openMenu]]);
  refreshGoal();
  refreshTime(true);
  updateMailFlag();
  if (isNew) runScript(intro);
  save();
}

function onNew({ name, village, model, look = null, seed }) {
  seed = seed || ((Math.random() * 0x7fffffff) | 0);
  const v = Village.create(seed);
  Clock.advanceMs = 0;
  Clock.seed = seed;
  // 새 마을은 다리가 하나뿐이다. 둘째 다리 자리는 강물로 되돌려 두었다가, 마을을 키우면서 놓는다.
  if (v.bridges.length > 1) {
    const b = v.bridges[1];
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < b.w; dx++) { const i = (b.y + dy) * MAP_W + b.x + dx; v.terrain[i] = TT.WATER; v.waterKind[i] = WK.RIVER; }
    b.built = false;
  }
  newState({ name, village, model, look, seed, villageData: v, day: dayKey() });
  S.prog = newProg();
  S.flags.campStart=true;
  // A branch and loose stone cache around the plaza lets newcomers make their first tools.
  const goods=['mat_wood','mat_wood','mat_stone','mat_wood','mat_stone','mat_wood','mat_wood','mat_stone'];
  const p=v.plaza;
  for(let y=p.y+1;y<p.y+p.h && goods.length;y++)for(let x=p.x+1;x<p.x+p.w-1 && goods.length;x++){
    if(v.empty(x,y) && (x+y)%2===0 && !(x===p.x+3&&y===p.y+1))v.set(x,y,{t:'item',id:goods.pop()});
  }
  for(const [x,y] of [[0,0],[8,6],[0,6],[6,4],[7,4]]){const o=v.obj(p.x+x,p.y+y);if(o?.t==='fix'&&['lamp','platform','part'].includes(o.kind))v.set(p.x+x,p.y+y,null);}
  buildWorld(v);
  firstDay(dayKey());
  start(true);
}
function onContinue() {
  if (!loadGame()) return onNew({ name: '도토리', village: '솔바람', model: MODEL, look: defaultLook() });
  Clock.advanceMs = S.clockAdvanceMs;
  Clock.seed = S.seed;
  buildWorld(Village.deserialize(S.village.data));
  start(false);
}

async function boot() {
  UI.build();
  loadSettings();
  Clock.offsetMin = Settings.offsetMin || 0;
  Sound.setVolume(Settings.bgm, Settings.sfx);
  initStage(document.getElementById('game'));
  registerScripts(); registerMenus(); Object.assign(G.hooks,{housing,islandTools,yardMenu,travel,workshop});
  G.hooks.newDay = (k) => newDay(k);
  G.hooks.openNet = openNet; G.hooks.openChat = openChat;
  G.hooks.rebuildWorld = () => { buildWorld(G.village); if (G.critters) G.critters._water = null; };   // 다리를 놓는 등 땅 모양이 바뀌었을 때
  window.addEventListener('pointerdown', () => Sound.unlock(), { once: false });
  window.addEventListener('keydown', () => Sound.unlock());
  try {
    await loadAssets((p, m) => UI.loading(p, m));
  } catch (e) {
    console.error(e);
    UI.loading(0, '불러오지 못했습니다. 새로고침해 주세요. (' + e.message + ')');
    return;
  }
  startLoop();
  UI.loading(null);
  const q = new URLSearchParams(location.search);
  if (q.get('auto')) onNew({ name: '도토리', village: '솔바람', model: MODEL, look: q.get('look') ? unpackLook(q.get('look')) : defaultLook(), seed: +q.get('seed') || 1234 });   // 개발용: 바로 시작
  else {
    refreshTime(true);                               // 첫 화면도 지금 시각·계절의 빛으로
    G.title = new TitleScene(G.stage, G.look);
    const me = peekPlayer();                           // 살던 마을이 있으면 첫 화면에도 내 모습을 세운다
    if (me) G.title.setPlayer(me.model, me.look, false);
    showTitle({ onNew, onContinue });
  }
  window.addEventListener('beforeunload', () => { save(); closeNet(true); });
}

// 개발·점검용 도구 (브라우저 콘솔에서 DV.* 로 쓴다)
window.DV = {
  G, S, Input,
  time(iso) { Clock.frozen = iso ? new Date(new Date(iso).getTime() - Clock.advanceMs - Clock.offsetMin * 60000) : null; refreshTime(true); },
  tp(x, z) { G.player.setPos(x, z); G.stage.setFocus(x, 0, z, true); },
  give(id, n = 1) { return addItem(id, n); },
  money(n) { addMoney(n); },
  day() { return advanceVillageTime(true); },
};

boot();
