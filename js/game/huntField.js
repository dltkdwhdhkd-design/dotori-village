import * as THREE from 'three';
import { G, burst, refreshTime, runScript, save } from './game.js';
import { Room } from './rooms.js';
import { life } from './workshop.js';
import { Actor } from '../gfx/actor.js';
import { RakkoSword, DRAW_TIME, SWING_TIME } from '../gfx/rakko.js';
import { make } from '../gfx/models.js';
import { UI } from '../ui/ui.js';
import { Input } from '../core/input.js';
import { Sound } from '../core/audio.js';
import { RNG, clamp, el } from '../core/util.js';

function trail(room) {
  const rng=RNG(451), canvas=document.createElement('canvas');canvas.width=864;canvas.height=672;
  const c=canvas.getContext('2d'), w=canvas.width,h=canvas.height;
  c.fillStyle='#92ad77';c.fillRect(0,0,w,h);
  const soil=c.createRadialGradient(w*.47,h*.44,20,w*.5,h*.46,w*.39);
  soil.addColorStop(0,'#dbc99b');soil.addColorStop(.75,'#c9ba8b');soil.addColorStop(1,'#a8b17a');
  c.fillStyle=soil;c.beginPath();c.ellipse(w*.5,h*.46,w*.35,h*.3,-.16,0,Math.PI*2);c.fill();
  c.strokeStyle='#c8b684';c.lineWidth=63;c.beginPath();c.moveTo(w*.5,h);c.quadraticCurveTo(w*.41,h*.7,w*.52,h*.55);c.stroke();
  for(let i=0;i<2600;i++){const x=rng()*w,y=rng()*h;c.fillStyle=i%2?'#e8db9a40':'#586f4a30';c.fillRect(x,y,2+rng()*7,1+rng()*3);}
  for(let i=0;i<100;i++){
    const angle=rng()*Math.PI*2,radius=.85+rng()*.33,x=w*(.5+Math.cos(angle)*.34*radius),y=h*(.46+Math.sin(angle)*.30*radius);
    c.strokeStyle=i%3?'#69885388':'#b1c477';c.lineWidth=2;c.beginPath();
    c.moveTo(x-5,y-4);c.lineTo(x,y);c.lineTo(x+4,y-6);c.stroke();
  }
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(22,18),new THREE.MeshLambertMaterial({map}));
  ground.rotation.x=-Math.PI/2;ground.position.set(9,-.015,7);ground.receiveShadow=true;room.group.add(ground);room.floorResource=ground;
  const outskirts=new THREE.Mesh(new THREE.PlaneGeometry(150,130),new THREE.MeshLambertMaterial({color:0x839771}));outskirts.rotation.x=-Math.PI/2;outskirts.position.y=-.035;room.group.add(outskirts);room.outskirts=outskirts;
  const put=(name,x,z,scale)=>{const o=make(name);o.scale.setScalar(scale);o.position.set(x,0,z);o.rotation.y=rng()*.6;room.group.add(o);};
  for(let i=0;i<12;i++)put(i%3?'tree_pine':'boulder2',i*1.8-1,-.6-rng()*1.8,1+rng()*.5);
  for(let i=0;i<7;i++){put(i%2?'boulder1':'tree_pine',-.55,i*2+.2,.8+rng()*.55);put(i%3?'boulder2':'tree_pine',18.6,i*2+.3,1+rng()*.4);}
  put('place_cave_lamp',7.85,13.4,.78);put('place_cave_lamp',10.15,13.4,.78);
  put('f_camp_kettle',1.2,11.2,1);put('f_picnic_basket',2.2,11.6,1);
  for(const [x,z] of [[2.2,3],[3,8.4],[15.4,2.3],[16,9.5],[4.6,1.1],[13.3,12.5]]){
    put('boulder2',x,z,.48);put('weed2',x+.48,z+.19,1.18);
    put('flower_cosmos',x-.32,z+.36,.85);put('weed1',x+.06,z-.32,.8);
  }
}

function indicator(room,geometry,color,opacity) {
  const m=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,opacity,transparent:true,side:THREE.DoubleSide,depthWrite:false}));
  m.rotation.x=-Math.PI/2;m.position.y=.025;room.group.add(m);
  room.localGraphics ||= [];room.localGraphics.push(m);return m;
}

export function enterHuntField(meadow) {
  const contract=life().contract;
  if (G.room!==meadow || meadow.area!=='meadow' || contract?.phase!=='field' || G.busy) return;
  UI.closePanel();
  runScript(async()=>{
    await UI.fade(true);
    const p=G.player, origin={x:p.x,z:p.z,yaw:p.yaw};
    meadow.group.visible=false;
    const room=new Room({id:'hunt-pass',area:'hunt',w:18,h:14,items:[],landscape:trail});
    G.room=room;room.building=meadow.building;
    G.stage.setMode(true,11,room.id);p.setPos(9,10.2);p.yaw=Math.PI;p.actor.face(Math.PI,true);
    const focus=room.focus(p.x,p.z);G.stage.setFocus(focus.x,0,focus.z,true);
    const hud=el('div','hunt-status'), readout=el('span'),retreat=el('button','btn','접수처로 복귀');
    hud.append(readout,retreat);document.getElementById('ui').append(hud);
    const ally=new Actor('villager_'+contract.ally);ally.setPos(9.8,0,10.4);room.group.add(ally.root);
    const foe=make('field_wisp');room.group.add(foe);
    const h=room.hunt={ally,foe,rig:contract.ally==='beomi'?new RakkoSword(ally):null,draw:0,swing:0,
      x:9,z:5.4,wave:contract.wave||1,level:contract.level,hearts:contract.hearts??(contract.ally==='goran'?4:3),
      hp:contract.hp??(4+contract.level),phase:'chase',timer:1.15,turn:0,time:0,invul:0,dash:0,cool:0,lastAttack:-4,ending:false};
    foe.position.set(h.x,0,h.z);p.setHuntGear(contract.weapon==='hunt_bell'?'hunt_bell':'hunt_fork');
    if(!h.rig)ally.hold('hunt_blue');
    const ring=indicator(room,new THREE.RingGeometry(.95,1,56),0xdc6d65,.88);
    const lane=indicator(room,new THREE.PlaneGeometry(1.25,4.1),0xe28074,.52);
    const swipe=indicator(room,new THREE.RingGeometry(.92,1.10,24,1,-.9,1.8),0xffe4a1,.85);
    const beam=new THREE.Group();room.group.add(beam);beam.add(lane);lane.position.z=2.05;
    ring.visible=beam.visible=swipe.visible=false;
    let leaving=false;
    room.exitField=()=>{
      if(leaving||G.room!==room)return;
      if(h.draw>0 || h.swing>0){h.ending=true;UI.closePanel();return;}
      leaving=true;UI.closePanel();
      runScript(async()=>{
        await UI.fade(true);room.dispose();G.room=meadow;meadow.group.visible=true;
        G.stage.setMode(true,11,meadow.id);p.setPos(origin.x,origin.z);p.yaw=origin.yaw;p.actor.face(p.yaw,true);
        const f=meadow.focus(p.x,p.z);G.stage.setFocus(f.x,0,f.z,true);refreshTime(true);
        await UI.fade(false);UI.toast(contract.phase==='report'?'토벌 성공! 노동 갑옷 씨에게 보고하세요.':'풀잎 들녘 접수처로 돌아왔어요.');
      });
    };
    room.endHunt=()=>{hud.remove();p.setHuntGear();};
    retreat.onclick=()=>{if(!G.busy&&!UI.blocking())room.exitField();};
    function persist(){Object.assign(contract,{wave:h.wave,hp:h.hp,hearts:h.hearts});save();}
    function dodge() {
      if(h.cool>0||h.ending||h.draw<1)return;
      const a=Input.axis();h.dx=a.on?a.x:Math.sin(p.yaw);h.dz=a.on?a.y:Math.cos(p.yaw);
      h.dash=.24;h.invul=.32;h.cool=.85;p.do('hop',.24);Sound.sfx('step',{sand:true});
    }
    function impact() {
      const dx=h.x-p.x,dz=h.z-p.z,d=Math.hypot(dx,dz);
      if(h.ending||h.phase==='wave'||d>1.65|| (d>.36 && (dx*Math.sin(h.yaw)+dz*Math.cos(h.yaw))/d<.42))return;
      const assist=h.phase==='recover' && !h.assisted;
      h.hp-=1+(h.chain?1:0)+(assist?(h.rig?2:1):0);
      burst('spark',h.x,.55,h.z,assist?10:5);G.stage.shake=assist?.07:.035;Sound.sfx('bonk');
      if(assist){
        h.assisted=true;h.swing=SWING_TIME;if(!h.rig)ally.play('swing',SWING_TIME);
        if(contract.weapon==='hunt_bell'&&!contract.chimed){contract.chimed=true;h.hearts++;Sound.sfx('coin');}
      }
      if(h.hp<=0){
        if(h.wave<h.level){h.wave++;h.hp=4+h.level;h.phase='wave';h.timer=.8;foe.visible=false;}
        else {contract.phase='report';h.ending=true;UI.toast('괴이가 물러났어요!');}
      }
      persist();
    }
    room.attack=()=>{
      if(h.ending||h.draw<1||h.attackTime>0)return;
      h.chain=h.time-h.lastAttack<.90 && !h.chain;h.lastAttack=h.time;h.yaw=p.yaw;h.attackTime=.35;h.struck=false;
      p.do('swing',.50);Sound.sfx('swing');
    };
    room.dodge=dodge;
    function enemyHit(){
      if(h.bump||h.invul>0)return;
      h.bump=true;h.hearts--;h.invul=.72;p.recoilFrom({x:h.x,z:h.z});h.attackTime=0;
      if(h.hearts<=0){h.ending=true;life().contract=null;save();UI.toast('용기를 다 썼어요. 동료와 함께 돌아가요.');}else persist();
    }
    room.ex={update(dt){
      if(UI.blocking()||G.busy||leaving)return;
      h.time+=dt;h.cool=Math.max(0,h.cool-dt);h.invul=Math.max(0,h.invul-dt);
      h.swing=Math.max(0,h.swing-dt);
      h.draw=clamp(h.draw+(h.ending?(h.swing?0:-dt):dt)/DRAW_TIME,0,1);
      const byEnemy=h.swing>0,aimX=byEnemy?h.x+.65:p.x+.66,aimZ=byEnemy?h.z+.34:p.z+.28;
      ally.speed=Math.min(1.4,Math.hypot(aimX-ally.x,aimZ-ally.z)*2);
      ally.setPos(ally.x+(aimX-ally.x)*Math.min(1,dt*8),0,ally.z+(aimZ-ally.z)*Math.min(1,dt*8));
      ally.faceTo(h.x,h.z);ally.update(dt);h.rig?.pose(h.draw,h.swing?1-h.swing/SWING_TIME:0);
      const status=h.ending?'복귀 준비':h.draw<1?'출동 준비':({chase:'추적 중',tell:h.stomp?'충격파 예고':'돌진 예고',lunge:'돌진!',pulse:'충격파!',recover:'연계 기회',wave:'다음 괴이 등장'})[h.phase];
      const msg=`바람고개 초지 · ${h.wave}/${h.level}　${status}\n용기 ${h.hearts}　괴이 기세 ${Math.max(0,h.hp)}　회피 ${h.cool>0?'준비 중':'가능'}`;
      if(readout.textContent!==msg)readout.textContent=msg;
      ring.visible=beam.visible=swipe.visible=false;
      if(h.ending){if(contract.phase==='report')foe.scale.multiplyScalar(Math.exp(-dt*4));if(!h.draw)room.exitField();return;}
      if(h.draw<1)return;
      if(h.dash>0){const step=6.6*Math.min(dt,h.dash),q=room.resolve(p.x+h.dx*step,p.z+h.dz*step,.27);p.setPos(q.x,q.z);h.dash-=dt;}
      if(h.attackTime>0){
        h.attackTime-=dt;swipe.visible=true;swipe.position.set(p.x,.35,p.z);swipe.rotation.z=h.yaw+Math.PI*1.5+(h.attackTime-.18)*2.1;
        if(!h.struck&&h.attackTime<=.17){h.struck=true;impact();}
      }
      if(h.ending)return;
      h.timer-=dt;
      const dx=p.x-h.x,dz=p.z-h.z,d=Math.hypot(dx,dz)||.001;
      if(h.phase==='wave'){
        if(h.timer<=0){h.x=h.wave%2?6:12;h.z=5;foe.visible=true;h.phase='chase';h.timer=1;}
      }else if(h.phase==='chase'){
        const speed=1.45+.24*h.level;
        if(d>1.05){h.x+=dx/d*speed*dt;h.z+=dz/d*speed*dt;}
        if(h.timer<=0&&d<4){
          h.phase='tell';h.stomp=++h.turn%2===0;h.timer=h.stomp?.88:.74;
          h.ax=dx/d;h.az=dz/d;h.bump=false;h.assisted=false;
        }
      }else if(h.phase==='tell'){
        if(h.stomp){ring.visible=true;ring.position.set(h.x,.03,h.z);ring.scale.setScalar(2);}
        else{beam.visible=true;beam.position.set(h.x,0,h.z);beam.rotation.y=Math.atan2(h.ax,h.az);}
        if(h.timer<=0){h.phase=h.stomp?'pulse':'lunge';h.timer=h.stomp?.46:.48;Sound.sfx('swing');}
      }else if(h.phase==='lunge'){
        h.x=clamp(h.x+h.ax*8.5*dt,.6,17.4);h.z=clamp(h.z+h.az*8.5*dt,.6,13.4);
        if(Math.hypot(p.x-h.x,p.z-h.z)<.85)enemyHit();
      }else if(h.phase==='pulse'){
        const radius=.36+(1-clamp(h.timer/.46,0,1))*1.7;
        ring.visible=true;ring.position.set(h.x,.03,h.z);ring.scale.setScalar(radius);
        if(Math.abs(d-radius)<.36)enemyHit();
      }else if(h.phase==='recover'&&h.timer<=0){h.phase='chase';h.timer=.66;}
      if((h.phase==='pulse'||h.phase==='lunge')&&h.timer<=0){h.phase='recover';h.timer=1.75-.12*h.level;h.assisted=false;burst('leaf',h.x,.12,h.z,6);}
      ring.material.color.setHex(h.phase==='recover'?0xffd664:0xdc6d65);
      if(h.phase==='recover'){ring.visible=true;ring.position.set(h.x,.03,h.z);ring.scale.setScalar(.78+.06*Math.sin(h.time*8));}
      foe.position.set(h.x,.08+.13*Math.abs(Math.sin(h.time*(h.phase==='lunge'?13:4))),h.z);
      foe.rotation.y=Math.atan2(h.phase==='lunge'?h.ax:dx,h.phase==='lunge'?h.az:dz);
      const stretch=h.phase==='tell'?1+.08*Math.sin(h.time*17):1;foe.scale.set(1.1*stretch,1.1/stretch,1.1*stretch);
    }};
    refreshTime(true);await UI.fade(false);UI.toast('공격은 Space, 방향을 잡고 F로 회피해요.');
  });
}
