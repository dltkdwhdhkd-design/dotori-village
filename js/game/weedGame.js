import { activityCanvas, oval, rounded, label, line } from './activityCanvas.js';
import { Sound } from '../core/audio.js';

const seats=[[118,200],[319,185],[510,198],[189,299],[417,299]];
export function pullWeeds({target,name,advanced,seed,record,checkpoint,done}){
  const goal=advanced?3:2,order=[0,1,2,3,4];
  for(let i=4;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[order[i],order[j]]=[order[j],order[i]];}
  const types=Array(5).fill(1-target);for(const i of order.slice(0,goal))types[i]=target;types[order[4]]=2;
  let selected=0,held=null,time=0,celebrate=0,fx=null,api,finished=false;
  const gone=i=>record.includes(i),remaining=()=>types.filter((t,i)=>t===target&&!gone(i)).length;
  if(!remaining()){done();return;}
  function grab(i,p) {
    if(finished||i<0||gone(i))return;
    selected=i;
    if(types[i]!==target){api.say(types[i]===2?'하치와레　“두 잎짜리는 어린나무야. 이건 남겨 두자!”':'이 포기는 오늘 작업표와 달라요. 잎 끝을 살펴보세요.');Sound.sfx('fail');return;}
    held={i,origin:p,dx:0,lift:0,side:0,shakes:0};api.say('좌우로 번갈아 흔들어서 뿌리 주변 흙을 풀어 주세요.');
  }
  function move(dx,up){
    if(!held)return;
    const h=held;h.dx=Math.max(-36,Math.min(36,dx));const sign=Math.sign(dx),need=advanced?4:3;
    if(Math.abs(dx)>16&&sign!==h.side){h.side=sign;h.shakes=Math.min(need,h.shakes+1);Sound.sfx('step',{});}
    h.lift=Math.min(64,Math.max(0,up));
    if(h.shakes>=need)api.say('뿌리가 느슨해졌어요! 위로 쭉 당기세요.');
    if(up<49)return;
    if(h.shakes<need){held=null;Sound.sfx('fail');api.say('손이 미끄러졌어요. 잎 밑을 잡고 좌우로 더 흔들어 주세요.');return;}
    record.push(h.i);checkpoint();const [x,y]=seats[h.i];fx={x,y,t:0,type:target};held=null;Sound.sfx('pick');
    selected=types.findIndex((t,i)=>t===target&&!gone(i));if(selected<0)selected=0;
    if(!remaining()){finished=true;celebrate=.45;api.say('마지막 뿌리까지 쏙!');}else api.say('한 포기 뽑았어요. 남은 포기 '+remaining()+'개');
  }
  function plant(c,x,y,t,dx=0,lift=0){
    c.save();c.translate(x,y-lift);c.rotate(dx*.009+Math.sin(time*1.9+x)*.014);
    if(lift>1){for(let k=-1;k<=1;k++)line(c,[[k*3,0],[k*5+1,8],[k*8-2,17],[k*9,22]],'#c59e61',2.3);}
    if(t===2){
      line(c,[[0,0],[1,-27],[0,-44]],'#65523a',5);oval(c,-12,-37,20,9,'#65a851',.5);oval(c,13,-47,20,9,'#99bd64',-.5);
    }else{
      for(let i=-3;i<=3;i++){
        const tipX=i*(t===0?9:5.8),tipY=-31-13*Math.cos(i*.72);
        c.fillStyle=i%2?'#57934e':'#72ac55';c.beginPath();c.moveTo(-2,0);c.quadraticCurveTo(tipX-9,tipY*.48,tipX,tipY);c.quadraticCurveTo(tipX+9,tipY*.48,2,0);c.fill();
      }
      if(t===1){line(c,[[0,-1],[2,-51]],'#64883c',3);oval(c,2,-53,5,7,'#f4cc5b');}
    }c.restore();
  }
  activityCanvas(advanced?'5급 구역 · 풀 뽑기':'들녘 · 풀 뽑기',name+' '+goal+'포기를 뿌리째 모으세요.',
    '터치·마우스　잎 밑을 잡고 좌우로 흔든 뒤 위로 당기세요.　키보드　← → 선택 · Space 누른 채 ← → 흔들기 · ↑ 뽑기',{
    keys:['ArrowLeft','ArrowRight','ArrowUp','Space'],init(a){api=a;api.say('작업표의 풀을 찾아 잎 밑을 잡아 주세요.');},
    pointer(action,p){if(action==='down'){const i=seats.findIndex(([x,y])=>Math.hypot((x-p.x)/1.13,y-21-p.y)<46);grab(i,p);}
      else if(action==='move'&&held)move(p.x-held.origin.x,held.origin.y-p.y);
      else if(action==='up'||action==='cancel')held=null;},
    key(down,k){if(finished)return;if(k==='Space'){if(down){if(!held)grab(selected,{x:0,y:0});}else held=null;return;}
      if(!down)return;if(k==='ArrowUp'){if(held)move(held.dx,60);return;}
      const dir=k==='ArrowLeft'?-1:1;if(held)move(dir*28,0);else{do{selected=(selected+dir+5)%5;}while(gone(selected));}},
    cancel(){held=null;},tick(dt){time+=dt;if(fx)fx.t+=dt;if(finished && (celebrate-=dt)<=0){celebrate=Infinity;done();}},
    draw(c){
      api.wrap.dataset.harvested=String(goal-remaining());api.wrap.dataset.selected=String(selected);api.wrap.dataset.grip=held?'held':'free';
      const sky=c.createLinearGradient(0,0,0,360);sky.addColorStop(0,'#c2dab1');sky.addColorStop(.39,'#91b07c');sky.addColorStop(1,'#607e58');c.fillStyle=sky;c.fillRect(0,0,640,360);
      for(let i=0;i<9;i++)oval(c,i*91-23,104+8*Math.sin(i*6),72,42,'#a3c492');
      rounded(c,24,108,592,228,34,'#816049');rounded(c,24,100,592,229,34,'#b68c60');
      for(let j=0;j<4;j++){line(c,[[46,141+j*48],[240,138+j*48],[594,142+j*48]],'#a47a54',3);}
      for(let i=0;i<110;i++){const x=44+(i*137%552),y=121+(i*61%192);oval(c,x,y,2.8,1.6,i%3?'#c7a77a':'#967250');}
      rounded(c,18,13,181,43,18,'#ffefd3');c.save();c.translate(44,46);c.scale(.50,.50);plant(c,0,0,target);c.restore();label(c,'작업표 · '+name,117,35,16,'#57482f');
      rounded(c,514,13,110,43,18,'#405e46');label(c,'바구니 '+(goal-remaining())+'/'+goal,569,35,16);
      seats.forEach(([x,y],i)=>{oval(c,x,y,gone(i)?15:24,gone(i)?6:7,gone(i)?'#76543e':'#9b7652');if(gone(i))return;
        if(i===selected){c.strokeStyle='#fff0a9';c.lineWidth=3;c.beginPath();c.ellipse(x,y,31,10,0,0,Math.PI*2);c.stroke();}
        const h=held?.i===i?held:null;plant(c,x,y,types[i],h?.dx||0,h?Math.min(h.lift,8+h.shakes*4):0);
        if(h){rounded(c,x-30,y+13,60,7,4,'#705b45');rounded(c,x-30,y+13,Math.max(1,60*h.shakes/(advanced?4:3)),7,4,'#f2d878');}
      });
      if(fx&&fx.t<.49){const k=fx.t/.49;c.save();c.globalAlpha=1-k;plant(c,fx.x+22*k,fx.y-18-55*k,fx.type,12,9);for(let i=0;i<8;i++)oval(c,fx.x+Math.cos(i)*k*45,fx.y-Math.sin(i)*k*24,3,2,'#70513e');c.restore();}
    }
  });
}
