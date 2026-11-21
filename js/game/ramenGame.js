import { activityCanvas, oval, rounded, label, line } from './activityCanvas.js';
import { Sound } from '../core/audio.js';

const pot={x:157,y:152},bowl={x:401,y:199},pass={x:555,y:130},tray={x:60,y:247};
const bins=[122,252,382,512],names=['마늘','채소','등지방','간장'];
const near=(p,q,r)=>Math.hypot(p.x-q.x,p.y-q.y)<r;
function noodle(c,x,y,scale=1){
  c.save();c.translate(x,y);c.scale(scale,scale);for(let i=-3;i<=3;i++){
    c.beginPath();c.moveTo(i*4-17,-8);c.bezierCurveTo(-33+i*4,8,-8+i*3,15,i*3+3,2);c.bezierCurveTo(14+i*3,-7,24+i*3,-2,21+i*3,9);c.strokeStyle=i%2?'#f7dc8a':'#eebf65';c.lineWidth=3;c.stroke();
  }c.restore();
}
function ingredient(c,i,x,y,s=1){
  c.save();c.translate(x,y);c.scale(s,s);
  for(let n=0;n<9;n++){
    const a=n*2.4,r=Math.sqrt(n)*4,xx=Math.cos(a)*r,yy=Math.sin(a)*r*.58;
    if(i===1){line(c,[[xx-4,yy+3],[xx+2,yy-4],[xx+6,yy-3]],'#c6df91',3);oval(c,xx+6,yy-3,3,1.8,'#80aa62');}
    else if(i===3)oval(c,xx,yy,6,3,n%2?'#8f573d':'#754430');
    else oval(c,xx,yy,i===0?3.5:4.6,3.3,i===0?(n%2?'#eedcb2':'#fff0cc'):(n%2?'#f1c4a6':'#f8d6ba'),a);
  }c.restore();
}
export function cookRamen({request,order,orderText,work,store,serve,valid}){
  let api,phase=work.plated?'top':'raw',mask=work.plated?(work.selection||0):0,seconds=0,age=0,stirs=0,lastSide=0,drag=null,chosen=0,finished=false;
  let hand=null,flight=null;
  function announce(s){api.say('시사　“'+s+'”');}
  function begin(){phase='boil';seconds=0;stirs=0;lastSide=0;announce('면이 붙지 않게 좌우로 풀어 주세요. 초록 구간에 건져요!');Sound.sfx('plop');}
  function stir(side){if(phase!=='boil'||!side||side===lastSide)return;lastSide=side;stirs=Math.min(2,stirs+1);Sound.sfx('splash');}
  function lift(){
    if(stirs<2){announce('면 덩어리를 먼저 좌우로 풀어 주세요!');return false;}
    if(seconds<3){announce('아직 면심이 단단해요. 초록 구간까지 조금만 더!');return false;}
    if(seconds>6.4)return false;
    phase='drain';work.perfect=seconds>=3.65&&seconds<=5.45;announce('건졌어요! 체를 국물 그릇 위로 옮겨요.');Sound.sfx('pick');return true;
  }
  function plate(){phase='top';work.plated=true;mask=work.selection||0;store();announce('주문표에 적힌 토핑을 집어 그릇에 담아 주세요.');flight={from:pot,to:bowl,t:0,i:-1};}
  function add(i){if(mask&(1<<i)){announce('이미 넣었어요. 잘못 올렸다면 마지막 토핑을 덜어 내세요.');return;}
    mask|=1<<i;(work.added ||= []).push(i);work.selection=mask;store();flight={from:{x:bins[i],y:308},to:bowl,t:0,i};Sound.sfx('pick');}
  function undo(){if(phase!=='top'||!mask)return;let i=work.added?.pop();if(i==null||!(mask&(1<<i)))i=[0,1,2,3].find(j=>mask&(1<<j));
    mask&=~(1<<i);work.selection=mask;store();announce(names[i]+'을 덜어 냈어요.');}
  function deliver(){if(phase!=='top'||finished)return;
    if(mask!==order){announce('잠깐! '+orderText+' 주문이에요. 토핑을 다시 봐 주세요.');Sound.sfx('fail');return;}
    if(!valid()){api.close();return;}
    finished=true;serve(mask,!!work.perfect);
  }
  function point(action,p){
    if(finished)return;
    if(action==='cancel'){drag=null;hand=null;return;}
    if(action==='down'){
      hand=p;
      if(phase==='raw'&&near(p,tray,69))drag='noodles';
      else if(phase==='boil'&&near(p,pot,76))drag='basket';
      else if(phase==='drain'&&near(p,pot,90))drag='drain';
      else if(phase==='top'){
        const i=bins.findIndex(x=>Math.abs(p.x-x)<52&&Math.abs(p.y-305)<31);
        if(i>=0){drag='ingredient';chosen=i;}else if(near(p,bowl,66))drag='serve';
        else if(p.x>505&&p.y>215&&p.y<254)undo();
      }
    }else if(action==='move'&&drag){
      hand=p;
      if(drag==='basket'&&Math.abs(p.x-pot.x)<72&&Math.abs(p.y-pot.y)<48&&Math.abs(p.x-pot.x)>12)stir(Math.sign(p.x-pot.x));
      if(drag==='basket' && (p.y<pot.y-42||p.x>pot.x+75) && lift())drag='drain';
    }else if(action==='up'){
      if(drag==='noodles'&&near(p,pot,80))begin();
      else if(drag==='basket'&&near(p,bowl,72)&&lift())plate();
      else if(drag==='drain'&&near(p,bowl,72))plate();
      else if(drag==='ingredient'&&near(p,bowl,70))add(chosen);
      else if(drag==='serve'&&near(p,pass,68))deliver();
      drag=null;hand=null;
    }
  }
  activityCanvas('라멘 가게 로(郎) · 조리대',request,
    '터치·마우스　재료를 끌어 옮기세요.　키보드　Space 면 넣기·건지기·담기 · ← → 젓기·토핑 선택 · Space 토핑 넣기 · X 덜기 · Enter 내기',{
    keys:['ArrowLeft','ArrowRight','Space','Enter','KeyX'],init(a){api=a;announce(phase==='top'?'담아 둔 면에 토핑을 마저 올려요.':'왼쪽 면 타래를 집어서 끓는 냄비에 넣어요!');},
    pointer:point,cancel(){drag=null;hand=null;},key(down,k){if(!down||finished)return;
      const dir=k==='ArrowLeft'?-1:k==='ArrowRight'?1:0;
      if(dir){if(phase==='boil')stir(dir);else if(phase==='top')chosen=(chosen+dir+4)%4;return;}
      if(k==='KeyX')return undo();if(k==='Enter')return deliver();
      if(phase==='raw')begin();else if(phase==='boil')lift();else if(phase==='drain')plate();else if(phase==='top')add(chosen);
    },
    tick(dt){age+=dt;if(flight&&(flight.t+=dt)>.35)flight=null;
      if(!valid()&&!finished){finished=true;api.close();return;}
      if(phase==='boil'){const last=seconds;seconds+=dt;
        if(last<3&&seconds>=3&&stirs===2)announce('지금이에요! 체로 면을 건져 그릇으로 옮기세요.');
        if(seconds>6.4){phase='raw';drag=null;hand=null;announce('면이 너무 퍼졌어요. 새 타래로 다시 삶아 볼까요?');Sound.sfx('fail');}}
      api.wrap.dataset.phase=phase;api.wrap.dataset.stirs=String(stirs);api.wrap.dataset.mask=String(mask);api.wrap.dataset.ready=String(phase==='boil'&&seconds>=3&&seconds<=6.4);
    },
    draw(c){
      c.fillStyle='#315952';c.fillRect(0,0,640,360);
      for(let i=0;i<10;i++){rounded(c,i*69-12,-8,66,48+(i%2)*4,9,i%2?'#ab5747':'#bb6450');}
      label(c,'郎',46,19,24,'#fff1d8');
      c.fillStyle='#ddbb85';c.fillRect(0,53,640,221);
      for(let i=0;i<4;i++)line(c,[[0,72+i*52],[640,73+i*52]],'#cda775',2);
      rounded(c,19,82,277,163,21,'#496561');rounded(c,27,88,260,143,19,'#768479');
      const steam=(x,y)=>{for(let i=0;i<5;i++){const t=(age*.45+i*.21)%1;c.globalAlpha=(1-t)*.43;c.beginPath();c.moveTo(x+i*16-32,y-t*36);c.bezierCurveTo(x+i*16-22,y-12-t*36,x+i*16-44,y-23-t*36,x+i*16-30,y-35-t*36);c.strokeStyle='#fff6df';c.lineWidth=4;c.stroke();}c.globalAlpha=1;};
      rounded(c,78,139,157,72,24,'#8b9690');oval(c,157,195,74,22,'#76847c');oval(c,157,143,79,29,'#c8cdc0');oval(c,157,144,70,23,'#79968a');
      for(let i=0;i<11;i++){const a=i*2.4;oval(c,157+Math.cos(a)*52,144+Math.sin(a)*14,2.1+(1+Math.sin(age*5+i))*1.9,2,'#d7e3c6');}
      if(phase==='boil')noodle(c,157+Math.sin(age*4)*2,144,.82);steam(158,129);
      rounded(c,31,223,65,38,8,'#a57d50');if(phase==='raw'&&drag!=='noodles')noodle(c,61,239,.83);
      label(c,'생면',63,257,12,'#4b4736');
      rounded(c,482,88,140,77,12,'#925b43');rounded(c,487,93,130,66,10,'#c09065');label(c,'손님에게 내기',555,124,14,'#fff3d8');
      const bx=401,by=186;oval(c,bx,by+32,69,14,'#b39369');
      c.fillStyle='#efdfc1';c.beginPath();c.moveTo(bx-69,by);c.bezierCurveTo(bx-61,by+57,bx+60,by+57,bx+69,by);c.fill();
      oval(c,bx,by,70,27,'#9c5042');oval(c,bx,by,64,22,'#efd4a6');oval(c,bx,by,59,18,'#b07d48');
      if(phase==='top'){noodle(c,bx-5,by,.91);for(let i=0;i<4;i++)if(mask&(1<<i))ingredient(c,i,bx+[-20,18,-2,28][i],by+[-5,-5,7,4][i],.68);steam(bx,by-18);}
      if(phase==='drain'){oval(c,157,119,39,13,'#bac2ae');noodle(c,157,118,.70);}
      const meterX=98,meterW=168;rounded(c,meterX,221,meterW,12,6,'#695e4b');rounded(c,meterX+meterW*3/6.4,221,meterW*3.4/6.4,12,6,'#b6cb7e');
      if(phase==='boil'){oval(c,meterX+seconds/6.4*meterW,227,5,8,'#fff0c3');label(c,'면 풀기 '+stirs+'/2',181,249,13,'#2f5147');}
      if(phase==='top'){rounded(c,511,220,91,27,10,'#846246');label(c,'토핑 덜기',556,234,13);}
      rounded(c,0,270,640,96,12,'#385c54');
      bins.forEach((x,i)=>{rounded(c,x-52,282,104,62,11,i===chosen&&phase==='top'?'#f4d48d':'#849388');rounded(c,x-47,286,94,40,9,'#dbcbb1');ingredient(c,i,x,305,1.3);label(c,names[i]+(mask&(1<<i)?' ✓':''),x,334,13,'#253e37');});
      if(hand&&drag==='noodles')noodle(c,hand.x,hand.y,.75);
      if(hand&&drag==='ingredient')ingredient(c,chosen,hand.x,hand.y,1);
      if(hand&&drag==='drain')noodle(c,hand.x,hand.y,.75);
      if(hand&&drag==='serve'){oval(c,hand.x,hand.y,31,13,'#f7dfbe');noodle(c,hand.x,hand.y,.42);}
      if(flight){const f=flight,k=f.t/.35,x=f.from.x+(f.to.x-f.from.x)*k,y=f.from.y+(f.to.y-f.from.y)*k-30*Math.sin(k*Math.PI);if(f.i<0)noodle(c,x,y,.68);else ingredient(c,f.i,x,y,.8);}
    }
  });
}
