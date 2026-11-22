import * as THREE from 'three';
import { Room } from './rooms.js';
import { G, save, runScript, refreshTime } from './game.js';
import { S, addMoney, addItem, canAdd } from './state.js';
import { setVillagersVisible } from './npc.js';
import { make } from '../gfx/models.js';
import { enterHuntField } from './huntField.js';
import { UI, Dialog } from '../ui/ui.js';
import { el } from '../core/util.js';
import { VILLAGERS } from '../data/villagers.js';
import { Sound } from '../core/audio.js';
import { action,life,learn,available } from './workshop.js';
import { invite } from './island.js';
import { townsOpen } from './neighborhood.js';
import { certifiedPlots, fieldDesk, gradeWork, inspectPlot, plantModel, story, study, openResults } from './fieldwork.js';
import { ramenDesk, setBowl, startRamenShift } from './ramen.js';
import { VOICES } from '../data/voices.js';
import { speakScene } from './speech.js';
import { buildRescue, rescueDesk, rescueFrame, rescueProbe } from './rescue.js';
import { paintVillage, dressVillage, steamFrame } from './travelDesign.js';

const places={
  meadow:{name:'풀잎 들녘',desc:'노동 갑옷 씨에게 풀 뽑기와 토벌을 접수하고, 5급 검정에 도전해요.',task:'밭의 잡초 뽑기',mat:'weed1',tint:'#a6c783', path:'#e6ce93',ids:['dalgom','beomi','dahong','dungdung'],props:[['board',2,2,.80],['tree_fruit',11,1,1.12],['tree_blossom',13,4,1.06],['bench',2,6,.78]]},
  cave:{name:'동굴 등불 마을',desc:'하치와레와 검정 공부를 하고, 동쪽 구덩이에서 들리는 소리를 따라가요.',task:'등불 돌 모으기',mat:'mat_stone',tint:'#a3b396',path:'#dcc9ac',ids:['goran','nureong','sandeul','pogeun'],props:[['boulder2',.6,2.2,1.2],['f_deungjan',5.25,3.15,.85],['boulder1',13,5,1.06]]},
  ramen:{name:'라멘 골목',desc:'라멘 가게 로(郎)에서 시사와 손님의 주문을 맞추고 내 라멘도 주문해요.',task:'가게에 파 잎 모아 주기',mat:'weed2',tint:'#b8c495',path:'#d8b598',ids:['pongdang','jangkki','kkokki','dodam'],props:[['f_jangdok',1.2,5.45,.9],['lamp',11.8,2.05,.9],['tree_blossom',13.1,4.7,1.05],['f_flowerpot',10.7,2.8,.84]]}
};
const spots=[[2.4,7],[9.9,6.4],[12,8.1]];
function place(room,name,x,z,scale=1){
  const o=make(name);o.position.set(x,0,z);o.scale.setScalar(scale);room.group.add(o);return o;
}
function landscape(room){
  const d=places[room.area], c=document.createElement('canvas');c.width=768;c.height=576;
  const cx=c.getContext('2d');cx.fillStyle=d.tint;cx.fillRect(0,0,c.width,c.height);
  paintVillage(cx,room,spots);
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(room.w+2,room.h+2),new THREE.MeshLambertMaterial({map:tex}));
  ground.rotation.x=-Math.PI/2;ground.position.set(room.w/2,-.015,room.h/2);ground.receiveShadow=true;room.group.add(ground);
  const meadow=new THREE.Mesh(new THREE.PlaneGeometry(120,120),new THREE.MeshLambertMaterial({color:d.tint}));meadow.rotation.x=-Math.PI/2;meadow.position.y=-.024;room.group.add(meadow);room.outskirts=meadow;
  for(const [n,x,z,s] of d.props){place(room,n,x,z,s);room.block(Math.floor(x),Math.floor(z));}
  for(let i=0;i<8;i++)place(room,room.area==='cave'?'boulder2':room.area==='ramen'?'tree_blossom':'tree_pine',i*2-1,-1.55,1.00+(i%3)*.18);
  dressVillage(room);
  if(room.area==='meadow')place(room,'board',5.95,9.8,.61);
  refreshPlots(room);
  if(room.area==='ramen'){
    room.counterBowl=place(room,'story_ramen',5.05,2.33,.86);room.counterBowl.position.y=.92;
    setBowl(room.counterBowl,story().lastBowl ?? 9);
  }
  room.floorResource=ground;
}
function refreshPlots(room){
  if(room.plotDay===S.day)return;
  room.plotDay=S.day;
  for(const old of [...(room.resources||[]),...(room.gradePlants||[])])room.group.remove(old);
  const field=room.area==='meadow',job=dayWork(room.area);
  room.resources=spots.map(([x,z],i)=>{
    const node=place(room,field?plantModel(i):places[room.area].mat,x,z,1.4);
    node.visible=!job.picked.includes(i);return node;
  });
  if(field){
    const special=gradeWork();
    room.gradePlants=certifiedPlots.map(([x,z],i)=>{
      const node=place(room,plantModel(i,true),x,z,1.65);
      node.visible=special.active && !special.picked.includes(i);return node;
    });
  }
}
function dayWork(area){
  const log=life().work;
  if(log[area]?.day!==S.day)log[area]={day:S.day,picked:[],paid:false};
  return log[area];
}
function villageTalk(id,area,n,chatOnly=false){
  if(!chatOnly && ((area==='ramen'&&id==='pongdang')||(area==='cave'&&id==='goran')||(area==='meadow'&&id==='beomi'))){
    const room=G.room,b=el('div','story-page');
    b.append(el('p','note',id==='pongdang'?VOICES.pongdang.kitchen:id==='beomi'?VOICES.beomi.hunt:'풀 그림을 같이 보면 잘 기억나더라. 같이 볼래?'));
    if(id==='pongdang')ramenDesk(b,room);
    if(id==='goran')action(b,'함께 풀 뽑기 공부하기',study);
    if(id==='beomi')action(b,'함께 토벌하러 가기',()=>huntDesk(room));
    action(b,'이야기 나누기',()=>{UI.closePanel();villageTalk(id,area,n,true);});
    UI.openPanel(VILLAGERS[id].name,b);return;
  }
  runScript(async()=>{
    const memo=story();
    const cue=memo.rescue===6 && VOICES[id].rescue?'rescue':memo.grade===5 && VOICES[id].grade?'grade':'travel';
    await speakScene(n,cue);
    if(S.residents.includes(id)){await speakScene(n,'resident');return;}
    if((!townsOpen() && life().contacts.includes(id))||life().projects.some(p=>p.id===id)){
      await speakScene(n,'pending');UI.toast('이웃 초대와 집터에서 준비 상황을 볼 수 있어요.');return;
    }
    if(await Dialog.choose(['우리 마을로 이사 올래?','여행 이야기 더 듣기'],{cancel:1})===0){
      if(await invite(id)){await speakScene(n,'invite');UI.toast('이웃 초대와 집터에서 새집 준비를 확인하세요.');}
    }else await speakScene(n,'camp');
  });
}
function workDesk(room){
  const area=room.area,w=dayWork(area),b=el('div');
  b.append(el('p','',area==='ramen'?'어서 와. 자리는 여기다. 주문은 시사랑 같이 들어 보자.':'왔구나. 작업표는 챙겼니? 끝나면 나한테 와. 보수는 맡아 둘게.'),
    el('p','note',places[area].task+' · '+w.picked.length+'/3'));
  if(!w.paid && w.picked.length===3)action(b,'일손 보수 받기',()=>{
    if(w!==dayWork(area)||w.paid||w.picked.length!==3)return;w.paid=true;learn(area);addMoney(180);save();UI.closePanel();UI.toast('도토리 180개와 마을 가구 레시피를 받았어요.');
  }); else b.append(el('p','note',w.paid?'오늘의 일손을 마쳤어요.':'길 옆에 놓인 재료 세 곳에 다가가서 행동하세요.'));
  if(area==='meadow'){
    action(b,'토벌 의뢰 보기',()=>huntDesk(room));
    fieldDesk(b,room);
  }
  if(area==='cave'){rescueDesk(b,room);action(b,'풀 뽑기 연습장 읽기',study);}
  if(area==='ramen')ramenDesk(b,room);
  UI.openPanel(area==='meadow'?'노동 갑옷 씨의 접수처':area==='ramen'?'라멘 가게 로(郎)':'마을 일손 돕기',b);
}
function huntDesk(room){
  const b=el('div'),l=life(),h=l.contract;
  if(h?.phase==='field'){
    b.append(el('p','note','접수한 의뢰가 있어요. 출발하면 바람고개 초지로 이동해요.'));
    action(b,'토벌 전용 필드로 출발',()=>enterHuntField(room));
    action(b,'의뢰 철회',()=>{UI.closePanel();l.contract=null;save();});
  }else if(h?.phase==='report'){
    b.append(el('p','note','들녘이 조용해졌어요. 접수처에 보고하고 보수를 받으세요.'));
    action(b,'토벌 완료 보고 · 보수 받기',()=>{
      if(l.contract?.phase!=='report')return;const pay=250*l.contract.level;
      l.contract=null;l.hunts++;learn('hunt');addMoney(pay);save();UI.closePanel();Sound.sfx('fanfare');UI.toast('토벌 완료! 도토리 '+pay+'개와 토벌반 가구 도안을 받았어요.');
    });
  }else{
    b.append(el('p','note','바람고개 초지에서 앞을 보고 공격하고 붉은 예고선을 피하세요. 괴이가 지쳤을 때 동료와 연계할 수 있어요.'));
    for(const [i,name] of ['들녘 순찰','커다란 솜뭉치','저녁 안개 무리'].entries()){
      const level=i+1;action(b,name+' · '+(level*250)+' 도토리',()=>{
        const party=el('div');party.append(el('p','note','함께 출동할 동료를 골라 주세요.'));
        for(const [id,mark] of [['beomi','더 강한 호응'],['goran','추가 용기']])action(party,VILLAGERS[id].name+' · '+mark,()=>{
          if(room!==G.room)return;
          const start=weapon=>{
            l.contract={phase:'field',level,ally:id,weapon};save();enterHuntField(room);
          };
          if(!available('hunt_bell')) return start('hunt_fork');
          const gear=el('div');action(gear,'분홍 사스마타 · 대여',()=>start('hunt_fork'));
          action(gear,'내 잎새 방울봉 · 첫 호응에 용기 회복',()=>start('hunt_bell'));
          UI.openPanel('토벌 장비 선택',gear);
        });UI.openPanel('토벌 동료',party);
      },l.hunts>=i);
    }
  }
  UI.openPanel('토벌 의뢰소 · 완료 '+l.hunts+'건',b);
}
function fieldProbe(room,p){
  const dist=(x,z)=>Math.hypot(p.x-x,p.z-z);
  if(room.area==='ramen' && dist(7.18,3.18)<1.04)return {label:'시사의 조리대 · 라멘 만들기',act:()=>startRamenShift(room)};
  if(room.area==='meadow' && story().posted && dist(5.95,9.8)<1.20)return {label:'풀 뽑기 검정 합격자 명단',act:openResults};
  if(dist(7,10.35)<1.15)return {label:'우리 마을로 귀가',act:()=>G.hooks.exit()};
  if(room.area==='cave'){
    const rescue=rescueProbe(room,p);if(rescue)return rescue;
  }
  if(room.area==='meadow'){
    const job=gradeWork();
    for(const [i,pos] of certifiedPlots.entries()){
      if(!job.active || job.picked.includes(i) || dist(...pos)>=1.05)continue;
      return {label:'5급 구역 작업표 확인',act:()=>inspectPlot(room,i,true,job,()=>{
        job.picked.push(i);room.gradePlants[i].visible=false;save();Sound.sfx('pick');
        UI.toast(job.picked.length===3?'서쪽 밭 작업 완료! 접수처에서 보수를 받으세요.':job.picked.length+' / 3곳 완료');
      })};
    }
  }
  const w=dayWork(room.area);
  for(const [i,pos] of spots.entries()){
    if(w.picked.includes(i)||dist(...pos)>=1.25)continue;
    const pick=()=>{
      if(w!==dayWork(room.area)||w.picked.includes(i))return;
      w.picked.push(i);room.resources[i].visible=false;save();Sound.sfx('pick');
      UI.toast(w.picked.length===3?'모두 모았어요. 접수처에서 보수를 받으세요.':w.picked.length+' / 3');
    };
    return {label:places[room.area].task,act:room.area==='meadow'?()=>inspectPlot(room,i,false,w,pick):pick};
  }
  return null;
}
export function visitArea(area){
  if(!places[area]||G.room||G.visit||G.net?.role||G.busy)return;
  UI.closePanel();save();runScript(async()=>{
    await UI.fade(true);const p=G.player;if(p.fishing)p.endFishing();
    const d=places[area],day=S.day,ids=[d.ids[0],d.ids[1],d.ids[2+Math.abs(day%2)]];
    const npcDefs=ids.map((id,i)=>({id,model:'villager_'+id,name:VILLAGERS[id].name,x:[4.3,8.1,11.3][i],z:[4.1,4.7,3.7][i],fixed:true,talk:n=>villageTalk(id,area,n)}));
    npcDefs.push({id:'desk',model:area==='ramen'?'npc_duru':'npc_ujik',name:area==='ramen'?'라멘 갑옷 씨':'노동 갑옷 씨',x:5.9,z:4.9,fixed:true,talk:()=>workDesk(G.room)});
    G.world.setVisible(false);G.critters.setVisible(false);setVillagersVisible(false);
    const room=G.room=new Room({id:'trip-'+area,area,w:14,h:11,items:[],landscape,npcDefs,setup:r=>({probe:p=>fieldProbe(r,p),update:dt=>{refreshPlots(r);rescueFrame(r,dt);steamFrame(r,G.time);}})});
    room.building={doors:[S.player.x-.5],y:S.player.z-.45,d:0};
    G.stage.setMode(true,11);p.setPos(7,8.8);p.yaw=Math.PI;p.actor.face(Math.PI,true);
    const f=room.focus(p.x,p.z);G.stage.setFocus(f.x,0,f.z,true);
    if(area==='cave')buildRescue(room);
    refreshTime(true);await UI.fade(false);UI.toast(d.name+' 도착 · 갑옷 씨에게 말을 걸어 보세요.');
  });
}
export function travel(){
  const box=el('div');
  if(G.room?.exitField){
    action(box,'토벌 접수처로 복귀',()=>G.room.exitField());
  }else if(G.room?.area){
    const room=G.room;box.append(el('p','note',places[room.area].name+' 여행 중'));
    action(box,'마을 의뢰',()=>workDesk(room));
    action(box,'우리 마을로 돌아가기',()=>{UI.closePanel();G.hooks.exit();});
  }else{
    if(G.room||G.visit||G.net?.role)return UI.toast('우리 마을 야외에서 여행을 떠나요.');
    action(box,'두 마을 여객선 · 개척과 왕복',()=>G.hooks.ferryOffice());
    for(const [id,d] of Object.entries(places)){const row=el('div','li'),txt=el('div','nm');txt.append(el('b','',d.name),el('span','sub',d.desc));row.append(txt);action(row,'여행하기',()=>visitArea(id));box.append(row);}
  }
  UI.openPanel('마을 여행',box);
}
