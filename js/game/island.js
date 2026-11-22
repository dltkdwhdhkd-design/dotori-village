import { speakScene } from './speech.js';
import { G, save, runScript } from './game.js';
import { S, countItem, takeItem, addItem } from './state.js';
import { G as T, WK } from '../world/mapgen.js';
import { ITEMS } from '../data/items.js';
import { VILLAGERS } from '../data/villagers.js';
import { UI, Dialog } from '../ui/ui.js';
import { el } from '../core/util.js';
import { action, life, workshop } from './workshop.js';
import { putOnTop, surfaceSlot } from '../gfx/tabletop.js';
import { currentTown, townOf, townsOpen, townName, townLand, residentsOf, freeLots, refreshHouse } from './neighborhood.js';


export function designAllowed() { return !G.room && !G.visit && !G.net?.role; }
const note=t=>UI.toast(t);
const point=()=>G.player.front(1.08);
function terrainFree(x,y) {
  const v=G.village, obj=v.obj(x,y);
  if(!v.inb(x,y) || x<3 || y<4 || x>=v.W-3 || y>=v.H-5 || obj || v.buried[v.idx(x,y)]!=null) return false;
  if(Math.floor(G.player.x)===x && Math.floor(G.player.z)===y) return false;
  if(v.buildings.some(b=>b.doors.includes(x) && y===b.y+b.d)) return false;
  if(v.bridges.some(b=>x>=b.x-1 && x<=b.x+b.w && y>=b.y-1 && y<=b.y+2)) return false;
  return !(x>=v.plaza.x && x<v.plaza.x+v.plaza.w && y>=v.plaza.y && y<v.plaza.y+v.plaza.h);
}
function reachable(v,blocked) {
  const start=v.idx(Math.floor(G.player.x),Math.floor(G.player.z)), seen=new Set([start]), queue=[start];
  for(let i=0;i<queue.length;i++){
    const k=queue[i],x=k%v.W,y=Math.floor(k/v.W);
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const a=x+dx,b=y+dy,idx=v.idx(a,b);
      if(!v.inb(a,b)||seen.has(idx)||blocked.has(idx)||v.solid(a,b))continue;
      seen.add(idx);queue.push(idx);
    }
  }return seen;
}
function preservesAccess(v,cells) {
  const from=reachable(v,new Set()), after=reachable(v,new Set(cells));
  const targets=[v.idx(v.dock.x,v.dock.y),...v.buildings.map(b=>v.idx(b.doors[0],b.y+b.d))];
  return targets.every(i=>!from.has(i)||after.has(i));
}
function cellsOf(x,y,w,h) {
  const out=[];for(let j=0;j<h;j++)for(let i=0;i<w;i++)out.push([x+i,y+j]);return out;
}
function decorCells(x,y,id,r) {
  const it=ITEMS[id], w=it.w||1,h=it.d||1;
  return cellsOf(x,y,r%2?h:w,r%2?w:h);
}
function decorFits(cells,own) {
  const v=G.village;
  return cells.every(([x,y])=>{
    const i=v.idx(x,y);
    return (own?.has(i)||terrainFree(x,y)) && [T.GRASS,T.PATH,T.STONE,T.SAND].includes(v.terrainAt(x,y));
  }) && preservesAccess(v,cells.map(([x,y])=>v.idx(x,y)));
}
function put(x,y,id,r,cells,tops){
  const v=G.village,base=v.idx(x,y);
  for(const [a,b] of cells)v.set(a,b,a===x && b===y?{t:'decor',id,r,tops}:{t:'decorPart',base});
}
export function placeOutside(id) {
  if(!designAllowed())return false;
  const f=point(),cells=decorCells(f.tx,f.ty,id,0);
  if(!decorFits(cells)) {note('문과 통로를 남겨 두고 빈 땅을 바라봐 주세요.');return false;}
  put(f.tx,f.ty,id,0,cells);return true;
}
function yardDecorAt(tx,ty) {
  let x=tx,y=ty;
  const v=G.village;let o=v.obj(x,y);
  if(o?.t==='decorPart'){x=o.base%v.W;y=Math.floor(o.base/v.W);o=v.obj(x,y);}
  if(o?.t!=='decor')return null;
  const slot=surfaceSlot(o,tx-x,ty-y);
  return {o,x,y,slot,top:o.tops?.[slot]};
}
export function yardTableInFront() {
  if (!designAllowed()) return null;
  const f=G.player.front();
  return yardDecorAt(f.tx,f.ty);
}
export function placeOnYardTable(id) {
  const target=yardTableInFront();
  if (!target || !putOnTop(target.o,target.slot,id)) return false;
  G.village.touch(target.x,target.y);
  return true;
}
export function yardMenu(tx,ty){
  if(!designAllowed())return;
  const target=yardDecorAt(tx,ty);
  if (!target) return;
  const v=G.village,{o,x,y,slot,top}=target;
  const cells=decorCells(x,y,o.id,o.r),clear=()=>cells.forEach(([a,b])=>v.set(a,b,null)),box=el('div');
  const finish=()=>{v.touch(x,y);save();UI.closePanel();};
  if (top) {
    action(box,ITEMS[top.id].name+' 돌리기',()=>{top.r=(top.r+1)%4;finish();});
    action(box,ITEMS[top.id].name+' 가방에 넣기',()=>{if(!addItem(top.id))return note('가방이 가득 찼어요.');o.tops[slot]=null;finish();});
  }
  action(box,top?ITEMS[o.id].name+' 통째로 돌리기':'돌리기',()=>{const r=(o.r+1)%4, next=decorCells(x,y,o.id,r);
    if(!decorFits(next,new Set(cells.map(([a,b])=>v.idx(a,b)))))return note('돌릴 공간이 부족해요.');
    clear();put(x,y,o.id,r,next,o.tops);save();UI.closePanel();});
  if (!top) action(box,'가방에 넣기',()=>{if(o.tops?.some(Boolean))return note('먼저 위에 올린 소품을 꺼내 주세요.');if(!addItem(o.id))return note('가방이 가득 찼어요.');clear();save();UI.closePanel();});
  UI.openPanel(top?ITEMS[o.id].name+' 위의 '+ITEMS[top.id].name:ITEMS[o.id].name,box);
}
const brush={grass:['잔디 복원',T.GRASS],path:['흙길',T.PATH],pave:['돌길',T.STONE],pond:['물길 파기',T.WATER],cliff:['절벽 쌓기',T.CLIFF]};
export function reshape(id) {
  if(!designAllowed()||!S.prog.done||!brush[id])return false;
  const v=G.village,{tx:x,ty:y}=point(),old=v.terrainAt(x,y),t=brush[id][1],key=v.idx(x,y);
  const made=life().earth ||= {};
  if(!terrainFree(x,y)||![T.GRASS,T.PATH,T.STONE,T.WATER,T.CLIFF].includes(old)||old===t||
    (old===T.CLIFF && !made[key]) || [WK.MOUTH,WK.SEA].includes(v.waterAt(x,y))) return note('이곳은 공사할 수 없어요.');
  if([T.CLIFF,T.WATER].includes(t) && !preservesAccess(v,[key]))return note('집이나 부두로 가는 마지막 통로예요.');
  v.terrain[key]=t;
  const river=[[0,1],[0,-1],[1,0],[-1,0]].some(([a,b])=>v.waterAt(x+a,y+b)===WK.RIVER);
  v.waterKind[key]=t===T.WATER?(river?WK.RIVER:WK.POND):WK.NONE;
  made[key]=true;G.hooks.rebuildWorld();save();return true;
}
function buildAtFront(type='atelier') {
  if(!designAllowed()||S.player.houseLv<1 || G.village.buildings.some(b=>b.type===type))return;
  const v=G.village,f=point(),x=f.tx-1,y=f.ty-2,cells=cellsOf(x,y,3,3);
  if(!cells.every(([a,b])=>terrainFree(a,b)&&[T.GRASS,T.PATH].includes(v.terrainAt(a,b)))||
     !v.empty(x+1,y+3)||!preservesAccess(v,cells.map(([a,b])=>v.idx(a,b))))return note('앞쪽에 빈 땅 3×3칸과 문 앞 통로가 필요해요.');
  const wood=type==='campsite'?6:10,stone=type==='campsite'?2:4;
  if(countItem('mat_wood')<wood || countItem('mat_stone')<stone)return note('가방에 나무 '+wood+'개와 돌 '+stone+'개가 필요해요.');
  takeItem('mat_wood',wood);takeItem('mat_stone',stone);
  const b={id:v.buildings.length,type,x,y,w:3,d:3,doors:[x+1],ready:S.day+1};
  v.buildings.push(b);for(const [a,c] of cells)v.set(a,c,{t:'bld',b:b.id});
  G.world.refreshBuilding(b);save();UI.closePanel();note('터를 잡았어요. 다음 날 문을 열어요.');
}
function reserveHome(id,town,lot,moving) {
  const l=life(), resident=S.villagers[id];
  if(G.visit || G.net?.role || l.projects.some(p=>p.id===id) || !freeLots(town).includes(lot))return false;
  if(moving ? !resident || townOf(resident)===town : resident || !S.waiting.includes(id))return false;
  const project={id,town,lot};
  if(moving){project.move=true;project.day=S.day+1;}
  l.projects.push(project);
  l.contacts=l.contacts.filter(k=>k!==id);
  refreshHouse(town,lot);save();
  return true;
}

async function choosePlot(id,town,moving=false) {
  const plotList=el('div'), land=townLand(town), plots=freeLots(town);
  let chosen=false;
  plotList.append(el('p','note',moving?'집터를 고르면 다음 날 아침에 이사해요.':'새집에는 꽃 화분 하나와 마당의 통나무 걸상이 필요해요.'));
  for(const lot of plots){
    const b=land.buildings[land.lots[lot]];
    action(plotList,(lot+1)+'번 터 · 지도 ('+(b.x+1)+', '+(b.y+1)+')',()=>{
      chosen=reserveHome(id,town,lot,moving);
      UI.closePanel();
      if(!chosen)note('이미 예약된 집터예요. 다른 터를 골라 주세요.');
    });
  }
  if(!plots.length)plotList.append(el('p','','비어 있는 집터가 없어요.'));
  action(plotList,'취소',()=>UI.closePanel());
  Dialog.close();
  await UI.panelAsync(VILLAGERS[id].name+' · '+townName(town)+' 마을 집터',plotList);
  if(chosen)note(townName(town)+' 마을에 '+VILLAGERS[id].name+'의 집터를 예약했어요.');
  return chosen;
}

export async function invite(id) {
  if(G.visit || G.net?.role || !S.waiting.includes(id) || life().projects.some(p=>p.id===id))return false;
  if(!townsOpen()){
    if(life().contacts.includes(id))return false;
    life().contacts.push(id);save();return true;
  }
  const open=[0,1].filter(town=>freeLots(town).length);
  if(!open.length){note('두 마을 모두 집터가 가득 찼어요.');return false;}
  const labels=open.map(town=>townName(town)+' 마을로 초대하기');
  const dest=await Dialog.choose([...labels,'다음에 정하기'],{cancel:labels.length});
  if(dest>=open.length || dest<0)return false;
  return choosePlot(id,open[dest]);
}

export async function proposeMove(id) {
  const resident=S.villagers[id];
  if(!resident || !townsOpen() || G.visit || G.net?.role)return;
  const town=1-townOf(resident);
  if(life().projects.some(p=>p.id===id))return note('이미 이사할 집터를 골랐어요.');
  return choosePlot(id,town,true);
}
function yardChair(lot) {
  const v=G.village,b=v.buildings[v.lots[lot]];
  for(let y=b.y-2;y<=b.y+b.d+2;y++)for(let x=b.x-2;x<=b.x+b.w+1;x++){
    const o=v.obj(x,y);if(o?.t==='decor' && o.id==='f_log_stool')return true;
  }return false;
}
export function housing(){
  if(!designAllowed())return note('우리 마을 야외에서 집터를 정해 주세요.');
  const box=el('div'), towns=townsOpen()?[0,1]:[0];
  box.append(el('div','note','여행지나 캠핑장에서 이웃을 초대하세요. 새 이웃의 집터에 꽃 화분을 납품하고, 바깥 두 칸 이내에 통나무 걸상을 놓으면 이사 준비를 마칠 수 있어요.'));
  for(const id of life().contacts){
    const row=el('div','li');box.append(row);row.append(el('b','nm',VILLAGERS[id].name));
    for(const town of towns)action(row,towns.length===1?'집터 고르기':townName(town)+' 마을 집터',async()=>{
      await choosePlot(id,town);housing();
    },freeLots(town).length>0);
  }
  for(const p of life().projects){
    const town=townOf(p),land=townLand(town),b=land.buildings[land.lots[p.lot]],row=el('div','li'),info=el('div','nm');
    const local=town===currentTown();
    const status=p.day?'다음 날 아침 이사 예정':!local?'배를 타고 이 마을에서 새집을 준비하세요.':(p.pot?'화분 납품 완료':'꽃 화분 필요')+' · '+(yardChair(p.lot)?'걸상 배치 완료':'통나무 걸상 필요');
    info.append(el('b','',VILLAGERS[p.id].name+' · '+townName(town)+' '+(p.lot+1)+'번 집터'),el('span','sub','좌표 ('+(b.x+1)+', '+(b.y+1)+') · '+status));row.append(info);box.append(row);
    if(p.move)action(row,'이사 취소',()=>{
      life().projects=life().projects.filter(q=>q!==p);refreshHouse(town,p.lot);save();housing();
    });
    if(p.day || !local)continue;
    if(!p.pot)action(row,'화분 납품',()=>{if(countItem('f_flowerpot')<1)return note('가방에 꽃 화분이 필요해요.');takeItem('f_flowerpot');p.pot=true;save();housing();});
    else if(!p.day)action(row,'준비 마치기',()=>{if(!yardChair(p.lot))return note('집터 곁에 통나무 걸상을 놓아 주세요.');p.day=S.day+1;save();housing();});
  }
  if(townsOpen())for(const town of towns){
    const ids=residentsOf(town), dest=1-town, vacancies=freeLots(dest).length;
    box.append(el('h3','',townName(town)+' 마을 주민 · '+ids.length+'명'));
    if(!ids.length)box.append(el('p','note','아직 이사 온 주민이 없어요.'));
    for(const id of ids){
      const row=el('div','li');box.append(row);
      row.append(el('span','nm',VILLAGERS[id].name+' · '+(S.villagers[id].lot+1)+'번 집'));
      action(row,townName(dest)+' 마을로 이사',async()=>{await proposeMove(id);housing();},vacancies>0 && !life().projects.some(p=>p.id===id));
    }
  }
  UI.openPanel('이웃 초대와 집터',box);
}
export function islandTools(){
  if(!designAllowed())return note('섬 공사는 우리 마을 야외에서 혼자 진행해요.');
  const box=el('div'), f=point();box.append(el('p','note','바라보는 칸 ('+(f.tx+1)+', '+(f.ty+1)+')에서 작업해요.'));
  action(box,'이웃 초대와 집터',housing);
  action(box,'두 번째 마을 개척 · 여객선',()=>G.hooks.ferryOffice());
  action(box,'캠핑장 짓기 · 나무 6 / 돌 2',()=>buildAtFront('campsite'),S.player.houseLv>=1 && !G.village.buildings.some(b=>b.type==='campsite'));
  action(box,'공동 공방 짓기 · 나무 10 / 돌 4',()=>buildAtFront('atelier'),S.player.houseLv>=1 && !G.village.buildings.some(b=>b.type==='atelier'));
  box.append(el('p','note',S.prog.done?'바꿀 지형을 고르세요.':'내 집을 지으면 공동 공방을 세울 수 있어요. 마을 잔치를 마치면 길·하천·절벽 공사가 열려요.'));
  for(const [id,[label]] of Object.entries(brush))action(box,label,()=>{if(reshape(id)){UI.closePanel();note('공사를 마쳤어요.');}},S.prog.done);
  UI.openPanel('섬 공사',box);
}
export function ensureBench(){
  const v=G.village,{x,y}=v.plaza;
  if(v.objs.some(o=>o?.t==='fix'&&o.kind==='workbench'))return;
  for(const [dx,dy] of [[3,1],[2,2],[5,2],[1,3]])if(v.empty(x+dx,y+dy)){v.set(x+dx,y+dy,{t:'fix',kind:'workbench'});break;}
}
export function campsiteSpec(){
  const pool=S.waiting.filter(id=>!life().projects.some(p=>p.id===id)),id=pool.length?pool[Math.abs(S.day+S.seed)%pool.length]:S.residents[0],v=VILLAGERS[id];
  return {id:'campsite',w:5,h:4,wall:'wall_tent',floor:'floor_mat',items:[{id:'f_yo',x:0,y:0,r:0},{id:'f_deungjan',x:4,y:0,r:0}],
    npcDefs:[{id,model:'villager_'+id,name:v.name,x:2.3,z:1.7,fixed:true,talk:n=>runScript(async()=>{
      await speakScene(n,'camp');
      if(S.residents.includes(id)||(!townsOpen() && life().contacts.includes(id)))return;
      if(await Dialog.choose(['우리 마을에 이사 올래?','편히 쉬다 가!'],{cancel:1})===0 && await invite(id))await speakScene(n,'invite');
    })}]};
}
export function atelierSpec(){return {id:'atelier',w:6,h:5,wall:'wall_wood',floor:'floor_wood',items:[{id:'f_desk',x:2,y:1,r:0,act:()=>workshop(),actLabel:'DIY 작업대'},{id:'f_log_shelf',x:0,y:0,r:0},{id:'f_deungjan',x:5,y:0,r:0}]};}
