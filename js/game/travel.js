import * as THREE from 'three';
import { Room } from './rooms.js';
import { G, save, runScript, refreshTime } from './game.js';
import { S, addMoney, addItem, canAdd } from './state.js';
import { setVillagersVisible } from './npc.js';
import { make } from '../gfx/models.js';
import { Actor } from '../gfx/actor.js';
import { UI, Dialog } from '../ui/ui.js';
import { el } from '../core/util.js';
import { VILLAGERS } from '../data/villagers.js';
import { Sound } from '../core/audio.js';
import { action,life,learn } from './workshop.js';
import { invite } from './island.js';

const places={
  meadow:{name:'풀잎 들녘',desc:'노동 갑옷 씨의 접수처 너머로 풀밭이 이어져요.',task:'밭의 잡초 뽑기',mat:'weed1',tint:'#a6c783', path:'#e6ce93',ids:['dalgom','beomi','dahong','dungdung'],props:[['tent_shop',2,2,.67],['board',6,2,.83],['tree_fruit',11,1,1.12],['tree_blossom',13,4,1],['bench',2,6,.85],['flower_cosmos',8,2,1.5]]},
  cave:{name:'동굴 등불 마을',desc:'바위 처마 밑에서 하치와레가 등불을 밝히는 마을이에요.',task:'등불 돌 모으기',mat:'mat_stone',tint:'#a3b396',path:'#dcc9ac',ids:['goran','nureong','sandeul','pogeun'],props:[['boulder1',1,2,1.65],['boulder2',3,1,1.8],['boulder1',5,1,1.42],['f_log_stool',3,3,.85],['f_deungjan',4,3,1.1],['f_bookpile',5,3,.9],['lamp',9,2,.88],['tree_pine',12,2,1.17],['boulder1',13,5,1.1]]},
  ramen:{name:'라멘 골목',desc:'시사가 손님을 맞는 작은 가게 앞에 고소한 냄새가 퍼져요.',task:'가게에 파 잎 모아 주기',mat:'weed2',tint:'#b8c495',path:'#d8b598',ids:['pongdang','jangkki','kkokki','dodam'],props:[['shop',3,1,.7],['f_stove',6,2,.8],['f_soban',8,3,.9],['f_log_stool',9,3,.8],['f_jangdok',1,5,1.1],['lamp',11,2,.9],['tree_blossom',13,4,1.06],['f_flowerpot',10,2,.88]]}
};
const spots=[[2.4,7],[9.9,6.4],[12,8.1]];
function place(room,name,x,z,scale=1){
  const o=make(name);o.position.set(x,0,z);o.scale.setScalar(scale);room.group.add(o);return o;
}
function landscape(room){
  const d=places[room.area], c=document.createElement('canvas');c.width=768;c.height=576;
  const cx=c.getContext('2d');cx.fillStyle=d.tint;cx.fillRect(0,0,c.width,c.height);
  cx.lineCap='round';cx.strokeStyle=d.path;cx.lineWidth=89;cx.beginPath();cx.moveTo(386,610);cx.bezierCurveTo(426,388,246,280,222,72);cx.stroke();
  cx.lineWidth=49;cx.beginPath();cx.moveTo(330,326);cx.quadraticCurveTo(460,265,685,229);cx.stroke();
  let seed=31;const rnd=()=>((seed=Math.imul(1664525,seed)+1013904223>>>0)/4294967296);
  for(let i=0;i<4100;i++){const x=rnd()*768,y=rnd()*576;cx.fillStyle=i%3?'#ffffff23':'#66572e22';cx.fillRect(x,y,1+rnd()*3,1+rnd()*2);}
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(room.w+2,room.h+2),new THREE.MeshLambertMaterial({map:tex}));
  ground.rotation.x=-Math.PI/2;ground.position.set(room.w/2,-.015,room.h/2);ground.receiveShadow=true;room.group.add(ground);
  const meadow=new THREE.Mesh(new THREE.PlaneGeometry(120,120),new THREE.MeshLambertMaterial({color:d.tint}));meadow.rotation.x=-Math.PI/2;meadow.position.y=-.024;room.group.add(meadow);room.outskirts=meadow;
  for(const [n,x,z,s] of d.props){place(room,n,x,z,s);room.block(Math.floor(x),Math.floor(z));}
  for(let i=0;i<8;i++)place(room,i%2?'tree_pine':'tree_blossom',i*2-1,-1.3,.72+(i%3)*.16);
  for(const [x,z] of [[.1,4],[.1,8],[13.7,7],[12.9,1],[1.2,1.2],[11.7,2.2]])place(room,'flower_cosmos',x,z,.85);
  place(room,'board',5.95,9.8,.61);room.resources=spots.map(([x,z])=>place(room,d.mat,x,z,1.4));
  room.floorResource=ground;
}
function dayWork(area){
  const log=life().work;
  if(log[area]?.day!==S.day)log[area]={day:S.day,picked:[],paid:false};
  return log[area];
}
function villageTalk(id,area,n){
  runScript(async()=>{
    const d=places[area],v=VILLAGERS[id],msgs={meadow:'풀을 다 뽑고 나면 바람 냄새가 달라져.',cave:'조금만 더 있다 가. 동굴 앞에서 보면 등불이 참 예뻐.',ramen:'따끈한 한 그릇 먹고 갈래? 오늘도 손님이 많아.'};
    await Dialog.say(v.name,msgs[area],{actor:n.actor});
    if(S.residents.includes(id)){await Dialog.say(v.name,'집에 돌아가면 또 만나자!');return;}
    if(life().contacts.includes(id)||life().projects.some(p=>p.id===id)){await Dialog.say(v.name,'우리 집터 소식 기다릴게!');return;}
    if(await Dialog.choose(['우리 마을로 이사 올래?','여행 이야기 더 듣기'],{cancel:1})===0){
      invite(id);await Dialog.say(v.name,'좋아! 돌아가면 집터를 골라 줘. 화분하고 마당에 놓을 의자 하나면 충분해.');
    }else await Dialog.say(v.name,d.desc);
  });
}
function workDesk(room){
  const area=room.area,w=dayWork(area),b=el('div');
  b.append(el('p','note',places[area].task+' · '+w.picked.length+'/3'));
  if(!w.paid && w.picked.length===3)action(b,'일손 보수 받기',()=>{
    if(w.paid)return;w.paid=true;learn(area);addMoney(180);save();UI.closePanel();UI.toast('도토리 180개와 마을 가구 레시피를 받았어요.');
  }); else b.append(el('p','note',w.paid?'오늘의 일손을 마쳤어요.':'길 옆에 놓인 재료 세 곳에 다가가서 행동하세요.'));
  if(area==='meadow')action(b,'토벌 의뢰 보기',()=>huntDesk(room));
  UI.openPanel(area==='meadow'?'노동 갑옷 씨의 접수처':'마을 일손 돕기',b);
}
function huntDesk(room){
  const b=el('div'),l=life(),h=l.contract;
  if(h?.phase==='report'){
    b.append(el('p','note','들녘이 조용해졌어요. 접수처에 보고하고 보수를 받으세요.'));
    action(b,'토벌 완료 보고 · 보수 받기',()=>{
      if(l.contract?.phase!=='report')return;const pay=250*l.contract.level;
      l.contract=null;l.hunts++;learn('hunt');addMoney(pay);save();UI.closePanel();Sound.sfx('fanfare');UI.toast('토벌 완료! 도토리 '+pay+'개와 토벌반 가구 도안을 받았어요.');
    });
  }else{
    b.append(el('p','note','길을 가로막은 솜뭉치 괴이를 몰아내요. 금빛으로 빛날 때 다가가 행동하면 동료가 호응해요. 붉게 부풀면 떨어져 주세요.'));
    for(const [i,name] of ['들녘 순찰','커다란 솜뭉치','저녁 안개 무리'].entries()){
      const level=i+1;action(b,name+' · '+(level*250)+' 도토리',()=>{
        const party=el('div');party.append(el('p','note','함께 출동할 동료를 골라 주세요.'));
        for(const [id,mark] of [['beomi','더 강한 호응'],['goran','추가 용기']])action(party,VILLAGERS[id].name+' · '+mark,()=>{
          if(room!==G.room)return;l.contract={phase:'field',level,ally:id};save();UI.closePanel();spawnHunt(room);UI.toast('길 오른쪽 풀밭에 괴이가 나타났어요. 동료와 다가가세요.');
        });UI.openPanel('토벌 동료',party);
      },l.hunts>=i);
    }
  }
  UI.openPanel('토벌 의뢰소 · 완료 '+l.hunts+'건',b);
}
function endField(room){
  const h=room.hunt;if(!h)return;room.group.remove(h.foe,h.ally.root,h.ring);h.ring.geometry.dispose();h.ring.material.dispose();if(h.local){h.local.actor.root.visible=true;h.local.visible=true;}room.hunt=null;
}
function spawnHunt(room){
  endField(room);const c=life().contract;if(c?.phase!=='field')return;
  const foe=place(room,'field_wisp',10.6,7.9,1.1), ally=new Actor('villager_'+c.ally);room.group.add(ally.root);
  const ring=new THREE.Mesh(new THREE.RingGeometry(.59,.74,44),new THREE.MeshBasicMaterial({color:0xf5c765,side:THREE.DoubleSide,transparent:true,opacity:.85}));
  ring.rotation.x=-Math.PI/2;ring.position.set(10.6,.013,7.9);room.group.add(ring);
  const local=room.npcs.find(n=>n.id===c.ally);
  if(local){local.visible=false;local.actor.root.visible=false;}
  room.hunt={foe,ally,ring,local,x:10.6,z:7.9,time:0,hit:false,cycle:-1,hp:c.level+2,hearts:c.ally==='goran'?4:3,level:c.level};
}
function huntFrame(room,dt){
  const h=room.hunt;if(!h || UI.blocking() || G.busy)return;
  h.time+=dt;const length=3.9-.24*h.level,cycle=Math.floor(h.time/length),phase=h.time%length/length;
  if(cycle!==h.cycle){h.hit=false;h.bump=false;h.cycle=cycle;}
  h.ready=phase<.56;const danger=phase>.73;
  h.foe.position.set(h.x+.30*Math.sin(h.time*1.6),.07+.17*Math.abs(Math.sin(h.time*3)),h.z+.14*Math.cos(h.time*1.6));
  h.foe.scale.setScalar((danger?1.31:h.ready?1.08:1.17)+.04*Math.sin(h.time*5));h.foe.rotation.y=.22*Math.sin(h.time*1.6);
  const color=danger?0xed757b:h.ready?0xf5c765:0xb4a9d7;
  h.ring.material.color.setHex(color);h.ring.scale.setScalar(danger?1.9:h.ready?1.02:1.4);
  const p=G.player;h.ally.setPos(p.x+.62,0,p.z+.37);h.ally.faceTo(h.x,h.z);h.ally.update(dt);
  if(danger && !h.bump && Math.hypot(p.x-h.foe.position.x,p.z-h.foe.position.z)<1.48){
    h.bump=true;h.hearts--;p.actor.play('hop',.3);UI.toast('깜짝! 남은 용기 '+h.hearts);
    if(h.hearts<=0){life().contract=null;endField(room);save();UI.toast('동료와 무사히 물러났어요. 접수처에서 다시 도전할 수 있어요.');}
  }
}
function strike(room){
  const h=room.hunt;if(!h||!h.ready||h.hit)return;
  h.hit=true;h.hp-=life().contract.ally==='beomi'?2:1;h.ally.play('hop',.4);G.player.do('swing',.38);Sound.sfx('pick');
  if(h.hp<=0){life().contract.phase='report';endField(room);save();UI.toast('괴이가 달아났어요! 노동 갑옷 씨에게 보고하세요.');}
  else UI.toast('호흡이 맞았어요! 남은 기세 '+h.hp);
}
function fieldProbe(room,p){
  const dist=(x,z)=>Math.hypot(p.x-x,p.z-z);
  if(room.hunt && dist(room.hunt.foe.position.x,room.hunt.foe.position.z)<1.85){
    const h=room.hunt;return {label:h.ready&&!h.hit?'동료와 토벌하기':'물러서기 · 용기 '+h.hearts,act:()=>strike(room)};
  }
  if(dist(7,10.35)<1.15)return {label:'우리 마을로 귀가',act:()=>G.hooks.exit()};
  const w=dayWork(room.area);
  for(let i=0;i<spots.length;i++)if(!w.picked.includes(i)&&dist(...spots[i])<1.25)return {label:places[room.area].task,act:()=>{
    if(w.picked.includes(i))return;w.picked.push(i);room.resources[i].visible=false;save();Sound.sfx('pick');
    UI.toast(w.picked.length===3?'모두 모았어요. 접수처에서 보수를 받으세요.':w.picked.length+' / 3');}};
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
    const room=G.room=new Room({id:'trip-'+area,area,w:14,h:11,items:[],landscape,npcDefs,setup:r=>({probe:p=>fieldProbe(r,p),update:dt=>huntFrame(r,dt)})});
    room.building={doors:[S.player.x-.5],y:S.player.z-.45,d:0};room.resources.forEach((o,i)=>o.visible=!dayWork(area).picked.includes(i));
    G.stage.setMode(true,11);p.setPos(7,8.8);p.yaw=Math.PI;p.actor.face(Math.PI,true);
    const f=room.focus(p.x,p.z);G.stage.setFocus(f.x,0,f.z,true);
    if(area==='meadow')spawnHunt(room);refreshTime(true);await UI.fade(false);UI.toast(d.name+' 도착 · 갑옷 씨에게 말을 걸어 보세요.');
  });
}
export function travel(){
  const box=el('div');
  if(G.room?.area){
    const room=G.room;box.append(el('p','note',places[room.area].name+' 여행 중'));
    action(box,'마을 의뢰',()=>workDesk(room));
    action(box,'우리 마을로 돌아가기',()=>{UI.closePanel();G.hooks.exit();});
  }else{
    if(G.room||G.visit||G.net?.role)return UI.toast('우리 마을 야외에서 여행을 떠나요.');
    for(const [id,d] of Object.entries(places)){const row=el('div','li'),txt=el('div','nm');txt.append(el('b','',d.name),el('span','sub',d.desc));row.append(txt);action(row,'여행하기',()=>visitArea(id));box.append(row);}
  }
  UI.openPanel('마을 여행',box);
}
