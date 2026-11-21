import { el } from '../core/util.js';
import { Sound } from '../core/audio.js';
import { UI } from '../ui/ui.js';
import { G, save } from './game.js';
import { S, addMoney } from './state.js';
import { action } from './workshop.js';
import { story, modelImage } from './fieldwork.js';
import { cookRamen } from './ramenGame.js';

// Four toppings from the shop's ordering call. Each bit corresponds to a visible bowl part.
const toppings=[
  ['garlic','다진 마늘','마늘 추가'],['sprouts','채소','채소 많이'],
  ['fat','등지방','등지방 많이'],['sauce','간장 양념','간 진하게']
];
const guests=['치이카와','하치와레','우사기'];
const orders=[9,2,5,11,4,3,13,6,10];
const shift=()=>{
  const s=story();
  if(s.shift?.day!==S.day)s.shift={day:S.day,served:0,selection:0};
  return s.shift;
};
const parts=mask=>Object.fromEntries(toppings.map(([id],i)=>[id,!!(mask & (1<<i))]));
const call=mask=>toppings.filter((_,i)=>mask&(1<<i)).map(t=>t[2]).join(', ')||'기본으로';
export function setBowl(object,mask){
  for(const [id,visible] of Object.entries(parts(mask)))object.userData.parts[id].visible=visible;
}
export function ramenDesk(box,room){
  const w=shift();
  action(box,'시사와 라멘 주문 받기 · '+w.served+'/3',()=>startRamenShift(room),w.served<3);
  action(box,'내 라멘 주문하기 · 70 도토리',()=>counter(room,false));
}
export function startRamenShift(room){
  if(room!==G.room)return;
  if(shift().served>=3){UI.toast('오늘 세 손님의 식사를 모두 냈어요. 내일 다시 만나요!');return;}
  counter(room,true);
}
function counter(room,working){
  const s=story(),w=shift(),ticket=w.served;
  if(working && ticket>=3)return;
  const current=()=>room===G.room && w===shift() && w.served===ticket;
  const order=orders[(S.day*3+ticket)%orders.length],guest=guests[(S.day+ticket)%3];
  function finish(mask,perfect=false){
    if(!current())return;
    if(working){
      if(mask!==order)return;
      w.served++;w.selection=0;w.added=[];w.plated=false;w.perfect=false;
      s.servings=(s.servings||0)+1;if(perfect)s.perfectBowls=(s.perfectBowls||0)+1;
      addMoney(50);
    }else{if(S.player.money<70)return;addMoney(-70);s.meals=(s.meals||0)+1;}
    s.lastBowl=mask;setBowl(room.counterBowl,mask);save();Sound.sfx(working?'coin':'fanfare');
    const done=el('div','story-page');
    done.append(modelImage('story_ramen',call(mask),{parts:parts(mask),view:'top'}),el('h3','',working?guest+'에게 라멘을 내줬어요.':'따뜻한 라멘이 나왔어요.'),
      el('p','note',working?(perfect?'꼬들꼬들하게 익었어요!　':'')+'시사와 일한 보수 50 도토리 · 오늘 '+w.served+'/3그릇':call(mask)+' 한 그릇을 다 먹었어요.'));
    if(working&&w.served<3)action(done,'다음 손님 맞이하기',()=>counter(room,true));
    action(done,'자리에서 일어나기',()=>UI.closePanel());UI.openPanel('라멘 가게 로(郎)',done);
  }
  if(working){
    const request=guest==='하치와레'?'하치와레　“'+call(order)+'! 이번엔 잘 말했지?”':guest==='치이카와'?'치이카와　“와…!”　주문표에 '+call(order)+' 표시가 있어요.':'우사기　“야하!”　'+call(order)+'에 동그라미가 쳐져 있어요.';
    return cookRamen({guest,order,orderText:call(order),request,work:w,store:save,serve:finish,valid:current});
  }
  let mask=0;
  const box=el('div','story-page'),kitchen=el('div','story-kitchen'),art=el('div'),labels=el('div');
  box.append(el('h3','','오늘은 어떻게 드릴까요?'),el('p','','라멘 갑옷 씨　“뜨거우니까 그릇은 여기 놓을게.”'),kitchen);
  kitchen.append(art,labels);
  function draw(){
    art.replaceChildren(modelImage('story_ramen',call(mask),{parts:parts(mask),view:'top'}));labels.replaceChildren();
    toppings.forEach(([,name,extra],i)=>{
      const selected=!!(mask&(1<<i)),btn=action(labels,selected?extra:name+' 기본',()=>{mask^=1<<i;draw();});
      btn.setAttribute('aria-pressed',String(selected));btn.dataset.topping=String(i);
    });
  }
  draw();action(box,'70 도토리 내고 먹기',()=>{if(S.player.money<70){UI.toast('70 도토리가 필요해요.');return;}finish(mask);});
  UI.openPanel('라멘 가게 로(郎)',box);
}
