import { G, buildWorld, refreshTime, runScript, save, WATER_Y } from './game.js';
import { S, addMoney, countItem, takeItem } from './state.js';
import { buildBridge, catchUpLand } from './daily.js';
import { ensureBench } from './island.js';
import { action } from './workshop.js';
import { clearNetMood } from './netplay.js';
import { syncVillagers } from './npc.js';
import { Village } from '../world/village.js';
import { make } from '../gfx/models.js';
import { Clock } from '../core/clock.js';
import { Sound } from '../core/audio.js';
import { el, hash32 } from '../core/util.js';
import { UI } from '../ui/ui.js';

const cost={mat_wood:12,mat_stone:8}, fare=500;
const atHomePort=()=>G.started&&!G.room&&!G.visit&&!G.net?.role&&!G.busy;
function hasSupplies(){return S.player.money>=fare && Object.entries(cost).every(([id,n])=>countItem(id)>=n);}

export function refreshFerry() {
  if(!G.world || G.visit || !S.ferry || S.day<S.ferry.ready || G.world.ferryBoat)return;
  const dock=G.village.dock, boat=make('village_ferry');
  boat.position.set(dock.x-.73,WATER_Y+.025,dock.y+2.1);boat.rotation.y=Math.PI;
  G.world.root.add(boat);G.world.ferryBoat=boat;
}
export function ferryOffice() {
  if(!atHomePort())return UI.toast('우리 마을 야외에서 여객선을 이용할 수 있어요.');
  const box=el('div'), route=S.ferry;
  if(!route){
    const title=el('label','','새 마을 이름 '),input=el('input');
    input.value='모래별';input.maxLength=8;title.append(input);
    box.append(title,el('p','note','새 섬에 부두와 마을 터를 지어요. 집 안과 마당은 따로 꾸미고, 가방·창고·주민·박물관은 두 마을이 함께 써요.'));
    box.append(el('p','',`건설비　나무 ${countItem('mat_wood')}/12 · 돌 ${countItem('mat_stone')}/8 · 도토리 ${S.player.money}/500`));
    action(box,'부두와 두 번째 마을 건설 신청',()=>{
      if(!atHomePort()||S.ferry||!hasSupplies())return;
      const name=input.value.trim().replace(/[^\p{L}\p{N} ]/gu,'').trim().slice(0,8);
      if(!name || name===S.village.name)return UI.toast('현재 마을과 다른 이름을 지어 주세요.');
      for(const [id,n] of Object.entries(cost))takeItem(id,n);
      addMoney(-fare);S.ferry={name,seed:hash32(S.seed,23581),ready:S.day+1,away:false,other:null};
      save();UI.closePanel();UI.toast('건설을 시작했어요. 다음 날 새벽 5시부터 배가 다녀요.');
    },hasSupplies());
  }else if(S.day<route.ready){
    box.append(el('p','',route.name+' 마을의 부두를 짓고 있어요. 다음 날 새벽 5시에 첫 배가 출발해요.'));
  }else{
    const dest=route.other?.village.name||route.name;
    box.append(el('p','',S.village.name+' 부두 → '+dest+' 부두'),el('p','note','항상 무료로 왕복해요. 도착한 섬에서 바로 이어서 생활할 수 있어요.'));
    action(box,dest+' 마을행 승선',()=>sail(route));
  }
  UI.openPanel('두 마을 여객선',box);
}
function sail(route) {
  if(!atHomePort()||S.ferry!==route||S.day<route.ready)return;
  UI.closePanel();
  runScript(async()=>{
    if(G.player.fishing)G.player.endFishing();
    const ship=G.world.ferryBoat;
    if(ship){G.stage.setFocus(ship.position.x,0,ship.position.z,true);ship.userData.departure=G.time;}
    Sound.sfx('splash');await new Promise(r=>setTimeout(r,650));await UI.fade(true);
    const previous={village:{name:S.village.name,data:G.village.serialize()},daily:S.daily,shop:S.shop,home:S.home,day:S.day};
    const dest=route.other;
    const land=dest?Village.deserialize(dest.village.data):Village.create(route.seed);
    S.village=dest?dest.village:{name:route.name};
    S.home=dest?dest.home:{wall:'wall_cream',floor:'floor_wood',items:[{id:'f_yo',x:0,y:0,r:0},{id:'f_chest',x:3,y:0,r:0}]};
    S.daily=dest?.daily;S.shop=dest?.shop;
    route.other=previous;route.away=!route.away;
    for(const n of G.npcs){clearNetMood(n);G.stage.scene.remove(n.actor.root);}
    G.npcs=[];G.critters.clear();G.critters._water=null;Clock.seed=land.seed;
    buildWorld(land);ensureBench();catchUpLand(dest?.day??S.day-1,S.day);
    if(S.prog.bridge===2 && land.bridges.some(b=>b.built===false))buildBridge();
    G.player.setPos(land.dock.x+.95,land.dock.y+.5);G.player.yaw=Math.PI;G.player.actor.face(Math.PI,true);
    syncVillagers(true);refreshTime(true);save();G.stage.setFocus(G.player.x,0,G.player.z,true);
    await UI.fade(false);UI.toast(S.village.name+' 부두에 도착했어요.');
  });
}
