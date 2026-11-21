import { Actor } from '../gfx/actor.js';
import { make } from '../gfx/models.js';
import { el } from '../core/util.js';
import { Sound } from '../core/audio.js';
import { UI } from '../ui/ui.js';
import { G, save } from './game.js';
import { action } from './workshop.js';
import { story } from './fieldwork.js';

const hole=[10.6,8.3], branch=[2.7,5.4];
const hints=['동굴 동쪽에서 희미한 목소리가 들려요.','동쪽 돌무더기 옆 구덩이를 살펴보세요.',
  '하치와레　“들려? 나 여기 있어! 서쪽에 늘어진 덩굴, 아직 있을까?”','구덩이 곁의 치이카와에게 덩굴을 건네세요.',
  '“앗!” 치이카와가 바닥에 남은 파란 사스마타를 가리켜요.',
  '둘이 신호를 보내면 가장자리에서 덩굴을 당겨 주세요.','치이카와와 하치와레가 파란 사스마타를 들고 함께 돌아왔어요.'];
function prop(room,id,x,z,scale){
  const o=make(id);o.position.set(x,0,z);o.scale.setScalar(scale);room.group.add(o);return o;
}
function actor(room,id){const a=new Actor('villager_'+id);room.group.add(a.root);return a;}
export function buildRescue(room){
  const [x,z]=hole;
  const h={
    rock:prop(room,'story_hollow',x,z,1),vine:prop(room,'story_vine',...branch,1.55),
    edge:prop(room,'story_vine',x-.47,z+.25,1.20),fork:prop(room,'hunt_blue',x+.45,z+.30,.62),
    friend:actor(room,'goran'),helper:actor(room,'dalgom'),local:room.npcs.find(n=>n.id==='goran'),
    clock:0,beat:-1,finish:0,grip:false
  };
  prop(room,'sapling',branch[0]-.18,branch[1]-.22,1.40);
  h.fork.rotation.z=1.13;room.rescueSite=h;
  if(story().rescue===5 && story().pulls>=2)h.finish=.001;
  sync(room);
}
function sync(room){
  const h=room.rescueSite,step=story().rescue||0,active=step>0&&step<6;
  h.rock.visible=step<6;h.vine.visible=step===2;h.edge.visible=step>=4&&step<6;
  h.fork.visible=step>0&&step<5;h.friend.root.visible=h.helper.root.visible=active;
  h.local.visible=!active;h.local.actor.root.visible=!active;
  if(active && (step>=5)!==h.grip){h.grip=step>=5;h.helper.hold(h.grip?'hunt_blue':null);}
}
function advance(room,step){
  if(room!==G.room || (story().rescue||0)!==step-1)return;
  story().rescue=step;save();sync(room);Sound.sfx(step===6?'fanfare':'pick');UI.toast(hints[step]);
}
export function rescueDesk(box,room){
  const step=story().rescue||0;
  box.append(el('p','note',hints[step]));
  if(!step)action(box,'구덩이의 목소리 따라가기',()=>{UI.closePanel();advance(room,1);});
}
export function rescueFrame(room,dt){
  const h=room.rescueSite,step=story().rescue||0;
  if(!h || !step || step===6 || UI.blocking() || G.busy)return;
  h.clock+=dt;
  if(h.finish)h.finish=Math.min(1,h.finish+dt*.95);
  const t=h.finish,up=t*t*(3-2*t),[x,z]=hole;
  const progress=(story().pulls||0)*.11;
  h.friend.setPos(x-.13+up*.94,-.51+progress+up*(.51-progress),z-.12+.4*up);
  h.helper.setPos(x-.64+.43*(step>=5?1:0)-up*.71,step>=5?-.32+progress+up*(.32-progress):0,z+.24+.24*up);
  h.friend.face(-.30);h.helper.face(step>=5 ? .30 : 1.7);h.friend.update(dt);h.helper.update(dt);
  if(step===5 && !h.finish){
    h.edge.scale.setScalar(1.2+.19*Math.sin(h.clock*3));
    const beat=Math.floor(h.clock/1.8);
    if(isReady(h) && beat!==h.lastSignal){h.lastSignal=beat;h.friend.play('hop',.30);}
  }
  if(t===1){advance(room,6);h.local.actor.play('joy',.8);}
}
const isReady=h=>h.clock%1.8<1.13;
export function rescueProbe(room,p){
  const h=room.rescueSite,s=story(),step=s.rescue||0;
  if(!h||step===6)return null;
  const near=([x,z])=>Math.hypot(p.x-x,p.z-z)<1.36;
  if(step===2 && near(branch))return {label:'나무 아래 덩굴 줍기',act:()=>advance(room,3)};
  if(!near(hole))return null;
  const labels=['구덩이에서 들리는 목소리','치이카와와 구덩이 들여다보기','하치와레에게 대답하기','치이카와에게 덩굴 건네기','치이카와가 사스마타를 줍도록 돕기'];
  if(step<5)return {label:labels[step],act:()=>{
    if(step===2){UI.toast(hints[2]);return;}
    if(step===4)h.helper.play('pick',.4);
    advance(room,step+1);
  }};
  const count=s.pulls||0;
  if(count>=2 && !h.finish)h.finish=.001;
  const ok=isReady(h)&&h.beat!==Math.floor(h.clock/1.8)&&!h.finish;
  return {label:h.finish?'두 친구가 올라오는 중':ok?'지금! 함께 당기기 · '+count+'/2':'덩굴을 잡고 신호 기다리기',act:()=>{
    if(!ok || h.finish || s.rescue!==5 || h.beat===Math.floor(h.clock/1.8))return;
    h.beat=Math.floor(h.clock/1.8);s.pulls=Math.min(2,(s.pulls||0)+1);G.player.do('pull',.35);
    if(s.pulls===2)h.finish=.001;save();
  }};
}
