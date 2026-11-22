import { G, save } from './game.js';
import { S, addItem, countItem, takeItem } from './state.js';
import { ITEMS } from '../data/items.js';
import { el } from '../core/util.js';
import { UI } from '../ui/ui.js';
import { Sound } from '../core/audio.js';
import { thumbOfModel } from '../gfx/thumbs.js';

// 가방 개조는 완성 즉시 적용하며 판매·선물 목록에는 등록하지 않는다.
const pockets = {
  pocket_field: {name:'들풀 덧주머니', from:20, to:30},
  pocket_travel: {name:'탐험가의 배낭 안감', from:30, to:40},
};
export const recipes = [
  ['tool_rod',{mat_wood:2,weed:1}], ['tool_net',{mat_wood:2,weed:2}], ['tool_axe',{mat_wood:2,mat_stone:1}],
  ['tool_shovel',{mat_wood:2,mat_stone:2}], ['tool_can',{mat_wood:1,mat_stone:2}], ['hunt_bell',{mat_wood:3,mat_stone:1,weed:3},'hunt'],
  ['mat_cloth',{weed:5}], ['mat_cord',{weed:2}],
  ['pocket_field',{mat_cloth:3,mat_cord:2}], ['pocket_travel',{mat_cloth:6,mat_cord:4,mat_wood:2}],
  ['f_log_stool',{mat_wood:2}], ['f_log_chair',{mat_wood:3}], ['f_flowerpot',{mat_stone:1,weed:2}],
  ['f_log_table',{mat_wood:5,mat_stone:1}], ['f_log_bed',{mat_wood:6,weed:4}], ['f_chest',{mat_wood:5,mat_stone:2}],
  ['f_mirror',{mat_wood:3,mat_stone:2}], ['f_bangseok',{weed:5}], ['f_log_shelf',{mat_wood:5,mat_stone:2},'meadow'],
  ['f_deungjan',{mat_wood:2,mat_stone:3},'cave'], ['f_soban',{mat_wood:4,mat_stone:1},'ramen'],
  ['f_byeongpung',{mat_wood:6,mat_stone:1,weed:4},'hunt'], ['f_guitar',{mat_wood:5,mat_stone:2,weed:3},'hunt'],
  ['f_desk',{mat_wood:7,mat_stone:2}], ['f_log_dresser',{mat_wood:6,mat_cord:1}],
  ['f_pastel_table',{mat_wood:4,mat_stone:2}], ['f_pastel_sofa',{mat_wood:5,mat_cloth:3}],
  ['f_yo',{mat_cloth:4,mat_cord:1}], ['f_teddy',{mat_cloth:3,mat_cord:1}],
  ['f_easel',{mat_wood:4,mat_cloth:1}], ['f_bookpile',{mat_cloth:2,weed:4}],
  ['f_picnic_basket',{weed:4,mat_cord:2,mat_cloth:1}], ['f_meadow_box',{mat_wood:4,seed_cosmos:1,seed_tulip:1}],
  ['f_camp_kettle',{mat_stone:5,mat_wood:3,mat_cord:1}], ['f_shell_lamp',{shell_scallop:2,shell_clam:1,mat_stone:2}],
  ['f_ramen_tray',{mat_wood:3,mat_stone:2,weed:1},'ramen'], ['f_herb_rack',{mat_wood:3,mat_cord:2,weed:4},'meadow'],
  ['wall_wood',{mat_wood:6}], ['wall_hanji',{mat_wood:3,mat_cloth:2}], ['floor_stone',{mat_stone:6}],
  ['floor_grass',{weed:8,mat_cord:1}], ['floor_carpet',{mat_cloth:4,mat_cord:2}],
];
const decor = new Set(['f_flowerpot','f_bangseok','f_deungjan','f_teddy','f_easel','f_bookpile','f_picnic_basket','f_meadow_box','f_camp_kettle','f_shell_lamp','f_ramen_tray','f_herb_rack']);
const unlockText = {meadow:'풀잎 들녘 일손 돕기',cave:'동굴에서 등불 돌 모으기',ramen:'라멘 골목 일손 돕기',hunt:'첫 토벌 보수 받기'};
function category(id) {
  if (pockets[id]) return '가방';
  if (decor.has(id)) return '소품';
  return {tool:'도구',huntGear:'도구',material:'재료',wall:'벽·바닥',floor:'벽·바닥',furniture:'가구'}[ITEMS[id].kind];
}
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
  const [id,ingredients,unlock]=recipe, costs=Object.entries(ingredients), pocket=pockets[id];
  if (G.visit || (unlock && !life().recipes.includes(unlock)) || (pocket && S.inv.length !== pocket.from) || costs.some(([mat,n])=>available(mat)<n)) return false;
  const bag=S.inv.map(x=>x && {...x}), storage=S.storage.map(x=>({...x}));
  costs.forEach(([mat,n])=>spend(mat,n));
  if (pocket) S.inv.push(...Array(pocket.to-pocket.from).fill(null));
  else if(!addItem(id)){ S.inv=bag; S.storage=storage; UI.toast('완성한 물건을 넣을 가방 한 칸이 필요해요.'); return false; }
  save(); Sound.sfx('save');
  UI.toast(pocket ? pocket.name+' 완성! 가방이 '+pocket.to+'칸으로 늘었어요.' : ITEMS[id].name+' 완성! 가방에 넣었어요.'); return true;
}
export function workshop(tab='도구') {
  if(G.visit) return;
  const box=el('div'), tabs=el('div','tabs'), list=el('div','list');
  box.append(tabs,el('div','note','가방과 집 창고의 재료를 함께 사용해요. 만든 가구는 가방에서 꺼내 방이나 마당에 놓으세요.'),list);
  const draw=()=>{
    tabs.replaceChildren(); list.replaceChildren();
    for(const t of ['도구','재료','가방','가구','소품','벽·바닥']) action(tabs,t,()=>{tab=t;draw();}).className='tab'+(tab===t?' on':'');
    for(const r of recipes) {
      const [id,ingredients,unlock]=r;
      if (category(id)!==tab) continue;
      const row=el('div','li'), info=el('div','nm'), costs=Object.entries(ingredients), pocket=pockets[id];
      const locked=unlock && !life().recipes.includes(unlock);
      const preview=el('img');preview.alt='';preview.src=thumbOfModel(pocket ? id : ITEMS[id].model,{tint:ITEMS[id]?.tint});row.append(preview);
      info.append(el('b','',pocket ? pocket.name : ITEMS[id].name));
      if (pocket) info.append(el('span','sub',`가방 ${pocket.from}칸 → ${pocket.to}칸 · 완성 즉시 적용`));
      info.append(el('span','sub',locked ? unlockText[unlock]+' 보상' : costs.map(([mat,n])=>ITEMS[mat].name+' '+available(mat)+'/'+n).join(' · ')));
      const status=locked?'미습득':pocket && S.inv.length>=pocket.to?'확장 완료':pocket && S.inv.length<pocket.from?'덧주머니 먼저':'만들기';
      row.append(info); action(row,status,()=>{craft(r);draw();},status==='만들기' && costs.every(([mat,n])=>available(mat)>=n)); list.append(row);
    }
  }; draw(); UI.openPanel('DIY 작업대',box);
}
