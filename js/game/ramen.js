import { el } from '../core/util.js';
import { Sound } from '../core/audio.js';
import { UI } from '../ui/ui.js';
import { G, save } from './game.js';
import { S, addMoney } from './state.js';
import { action } from './workshop.js';
import { story, modelImage } from './fieldwork.js';

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
  action(box,'시사와 라멘 주문 받기 · '+w.served+'/3',()=>counter(room,true),w.served<3);
  action(box,'내 라멘 주문하기 · 70 도토리',()=>counter(room,false));
}
function counter(room,working){
  const s=story(),w=shift(),ticket=w.served;
  if(working && ticket>=3)return;
  let mask=working?w.selection:0, submitted=false;
  const order=orders[(S.day*3+ticket)%orders.length],guest=guests[(S.day+ticket)%3];
  const box=el('div','story-page'),kitchen=el('div','story-kitchen'),art=el('div'),labels=el('div');
  box.append(el('p','story-count',working?'시사와 함께　'+(ticket+1)+' / 3번째 손님':'라멘 갑옷 씨의 카운터'),
    el('h3','',working?guest+'의 주문':'오늘은 어떻게 드릴까요?'),
    el('p','',working?(guest==='하치와레'?'“연습한 대로 말해 볼게. '+call(order)+'!”':guest==='치이카와'?'“와…!” 치이카와가 손에 꼭 쥔 주문표를 펴 보인다.':'“야하!” 우사기가 원하는 토핑에 동그라미를 치고 종이를 번쩍 든다.'):'“뜨거우니까 그릇은 여기 놓을게.”'),
    el('p','story-order',working?'주문표 · '+call(order):'원하는 토핑을 골라 주문하세요.'),kitchen);
  kitchen.append(art,labels);
  const status=el('p','story-status');status.setAttribute('aria-live','polite');
  function draw(){
    art.replaceChildren(modelImage('story_ramen',call(mask),{parts:parts(mask),view:'top'}));
    labels.replaceChildren();
    toppings.forEach(([,name,extra],i)=>{
      const selected=!!(mask&(1<<i)),btn=action(labels,selected?extra:name+' 기본',()=>{
        mask^=1<<i;if(working){w.selection=mask;save();}status.textContent='';draw();
      });
      btn.setAttribute('aria-pressed',String(selected));btn.dataset.topping=String(i);
    });
  }
  draw();box.append(status);
  action(box,working?'손님에게 내어 주기':'70 도토리 내고 먹기',()=>{
    if(submitted||room!==G.room||w!==shift()||w.served!==ticket)return;
    if(working){
      if(mask!==order){status.textContent='시사　“앗, 여기 한 번만 더 볼까요? 아직 손님한테 내기 전이라 괜찮아요!”';return;}
      w.served++;w.selection=0;s.servings=(s.servings||0)+1;addMoney(50);
    }else{
      if(S.player.money<70){status.textContent='70 도토리가 필요해요. 시사와 일하고 보수를 받을 수 있어요.';return;}
      addMoney(-70);s.meals=(s.meals||0)+1;
    }
    submitted=true;s.lastBowl=mask;setBowl(room.counterBowl,mask);save();Sound.sfx(working?'coin':'fanfare');
    const done=el('div','story-page');done.append(modelImage('story_ramen',call(mask),{parts:parts(mask),view:'top'}),
      el('h3','',working?guest+'에게 라멘을 내줬어요.':'따뜻한 라멘이 나왔어요.'),
      el('p','note',working?'시사와 일한 보수 50 도토리 · 오늘 '+w.served+'/3그릇':call(mask)+' 한 그릇을 다 먹었어요.'));
    if(working&&w.served<3)action(done,'다음 손님 맞이하기',()=>counter(room,true));
    action(done,'자리에서 일어나기',()=>UI.closePanel());UI.openPanel('라멘 가게 로(郎)',done);
  });
  UI.openPanel('라멘 가게 로(郎)',box);
}
