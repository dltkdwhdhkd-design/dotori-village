import { G, save } from './game.js';
import { S, addItem, countItem, takeItem } from './state.js';
import { ITEMS } from '../data/items.js';
import { el } from '../core/util.js';
import { UI } from '../ui/ui.js';
import { Sound } from '../core/audio.js';

export const recipes = [
  ['tool_rod',2,0,1], ['tool_net',2,0,2], ['tool_axe',2,1], ['tool_shovel',2,2], ['tool_can',1,2],
  ['hunt_bell',3,1,3,'hunt'], ['f_log_stool',2], ['f_log_chair',3], ['f_flowerpot',0,1,2], ['f_log_table',5,1],
  ['f_log_bed',6,0,4], ['f_chest',5,2], ['f_mirror',3,2], ['f_bangseok',0,0,5],
  ['f_log_shelf',5,2,0,'meadow'], ['f_deungjan',2,3,0,'cave'], ['f_soban',4,1,0,'ramen'],
  ['f_byeongpung',6,1,4,'hunt'], ['f_guitar',5,2,3,'hunt']
];
const materials = ['mat_wood','mat_stone','weed'];
export function life() {
  return S.islandLife ||= { recipes: [], contacts: [], projects: [], work: {}, hunts: 0 };
}
export function learn(key) {
  if (!life().recipes.includes(key)) life().recipes.push(key);
}
export function action(box,label,fn,enabled=true) {
  const b=el('button','btn'); b.textContent=label; b.disabled=!enabled; b.onclick=fn; box.append(b); return b;
}
export function available(id) {
  return countItem(id) + S.storage.reduce((n,s)=>n+(s.id===id?s.n:0),0);
}
function spend(id,n) {
  const bag=Math.min(n,countItem(id)); takeItem(id,bag); n-=bag;
  for (let i=S.storage.length-1; n>0 && i>=0; --i) {
    const s=S.storage[i]; if(s.id!==id) continue;
    const used=Math.min(n,s.n); s.n-=used; n-=used;
    if(!s.n) S.storage.splice(i,1);
  }
}
export function craft(recipe) {
  const [id,w=0,s=0,g=0,unlock]=recipe, costs=[w,s,g];
  if (G.visit || (unlock && !life().recipes.includes(unlock)) || costs.some((n,i)=>available(materials[i])<n)) return false;
  const bag=S.inv.map(x=>x && {...x}), storage=S.storage.map(x=>({...x}));
  costs.forEach((n,i)=>spend(materials[i],n));
  if(!addItem(id)){ S.inv=bag; S.storage=storage; UI.toast('완성한 물건을 넣을 가방 한 칸이 필요해요.'); return false; }
  save(); Sound.sfx('save'); UI.toast(ITEMS[id].name+' 완성! 가방에 넣었어요.'); return true;
}
export function workshop(tab='도구') {
  if(G.visit) return;
  const box=el('div'), tabs=el('div','tabs'), list=el('div','list');
  box.append(tabs,el('div','note','가방과 집 창고의 재료를 함께 사용해요. 만든 가구는 가방에서 꺼내 방이나 마당에 놓으세요.'),list);
  const draw=()=>{
    tabs.replaceChildren(); list.replaceChildren();
    for(const t of ['도구','가구']) action(tabs,t,()=>{tab=t;draw();}).className='tab'+(tab===t?' on':'');
    for(const r of recipes) {
      if((['tool','huntGear'].includes(ITEMS[r[0]].kind))!==(tab==='도구')) continue;
      const row=el('div','li'), info=el('div','nm'), costs=r.slice(1,4);
      const locked=r[4] && !life().recipes.includes(r[4]);
      info.append(el('b','',ITEMS[r[0]].name),el('span','sub',locked?({meadow:'풀잎 들녘 일손 돕기',cave:'동굴에서 등불 돌 모으기',ramen:'라멘 골목 일손 돕기',hunt:'첫 토벌 보수 받기'}[r[4]]+' 보상'):costs.map((n,i)=>n?ITEMS[materials[i]].name+' '+available(materials[i])+'/'+n:'').filter(Boolean).join(' · ')));
      row.append(info); action(row,locked?'미습득':'만들기',()=>{craft(r);draw();},!locked && costs.every((n,i)=>available(materials[i])>=n)); list.append(row);
    }
  }; draw(); UI.openPanel('DIY 작업대',box);
}
