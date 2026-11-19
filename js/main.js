// 시작점: 자산을 불러오고, 타이틀을 보여 주고, 마을을 연다
import { G, initStage, loadAssets, buildWorld, startLoop, refreshTime, runScript, save } from './game/game.js';
import { Player } from './game/player.js';
import { Critters } from './game/critters.js';
import { syncVillagers } from './game/npc.js';
import { registerScripts, intro } from './game/scripts.js';
import { registerMenus, showTitle, updateMailFlag, openBag, openDex, openMap, openMenu } from './game/menus.js';
import { newDay, firstDay } from './game/daily.js';
import { S, Settings, loadSettings, newState, loadGame, addItem, addMoney } from './game/state.js';
import { Village } from './world/village.js';
import { G as TT, WK, MAP_W } from './world/mapgen.js';
import { newProg, ensureProg, refreshGoal, openNote } from './game/quests.js';
import { UI } from './ui/ui.js';
import { Sound } from './core/audio.js';
import { Clock, dayKey } from './core/clock.js';
import { Input } from './core/input.js';
import { TitleScene } from './game/titlescene.js';

function start(isNew) {
  if (G.title) { G.title.dispose(); G.title = null; }
  Clock.seed = S.seed;
  ensureProg();                                   // 예전 저장은 '다 자란 마을'로 이어받는다
  G.player = new Player();
  G.critters = new Critters();
  syncVillagers(true);
  G.started = true;
  G.stage.setMode(false);
  G.stage.setFocus(G.player.x, 0, G.player.z, true);
  UI.showHud(true);
  UI.setMenu([['수첩', 'N', openNote], ['가방', 'E', openBag], ['도감', 'C', openDex], ['지도', 'M', openMap], ['메뉴', 'Esc', openMenu]]);
  refreshGoal();
  refreshTime(true);
  updateMailFlag();
  if (isNew) runScript(intro);
  else if (S.day !== dayKey()) newDay(dayKey());
  save();
}

function onNew({ name, village, model, seed }) {
  seed = seed || ((Math.random() * 0x7fffffff) | 0);
  const v = Village.create(seed);
  Clock.seed = seed;
  // 새 마을은 다리가 하나뿐이다. 둘째 다리 자리는 강물로 되돌려 두었다가, 마을을 키우면서 놓는다.
  if (v.bridges.length > 1) {
    const b = v.bridges[1];
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < b.w; dx++) { const i = (b.y + dy) * MAP_W + b.x + dx; v.terrain[i] = TT.WATER; v.waterKind[i] = WK.RIVER; }
    b.built = false;
  }
  newState({ name, village, model, seed, villageData: v, day: dayKey() });
  S.prog = newProg();
  buildWorld(v);
  firstDay(dayKey());
  start(true);
}
function onContinue() {
  if (!loadGame()) return onNew({ name: '도토리', village: '솔바람', model: 'player_1' });
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
  registerScripts(); registerMenus();
  G.hooks.newDay = (k) => newDay(k);
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
  if (q.get('auto')) onNew({ name: '도토리', village: '솔바람', model: 'player_1', seed: +q.get('seed') || 1234 });   // 개발용: 바로 시작
  else {
    refreshTime(true);                               // 첫 화면도 지금 시각·계절의 빛으로
    G.title = new TitleScene(G.stage, G.look);
    showTitle({ onNew, onContinue });
  }
  window.addEventListener('beforeunload', () => save());
}

// 개발·점검용 도구 (브라우저 콘솔에서 DV.* 로 쓴다)
window.DV = {
  G, S, Input,
  time(iso) { Clock.frozen = iso ? new Date(iso) : null; refreshTime(true); },
  tp(x, z) { G.player.setPos(x, z); G.stage.setFocus(x, 0, z, true); },
  give(id, n = 1) { return addItem(id, n); },
  money(n) { addMoney(n); },
  day() { newDay(S.day + 1); },
};

boot();
