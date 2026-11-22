import { ITEMS, FLOWER_KO, FRUIT_KO, WALLS, FLOORS } from '../data/items.js';
import { RNG, hash32 } from '../core/util.js';
import { S, hasItem } from './state.js';

// 같은 날 저장을 다시 불러와도 진열과 한정 수량을 유지한다.
export function counterStock(nativeFruit,seed=S.seed) {
  const shop=S.shop, tent=S.prog.shop<2, r=RNG(hash32(seed,shop.day,613));
  const offer=(id,price=ITEMS[id].buy,limited=false)=>({id,price,limited});
  const supplies=['tool_shovel','tool_can','tool_axe','tool_net','tool_rod'].filter(id=>!hasItem(id)).concat('medicine');
  const materials=['mat_wood','mat_stone','mat_cloth','mat_cord'];
  const flowers=r.shuffle(Object.keys(FLOWER_KO)).slice(0,tent?1:2);
  const colors=tent?['white','red','yellow']:['pink','orange','purple'];
  const garden=[...shop.seeds,'sapling_blossom','sapling_pine'].map(id=>offer(id));
  for(const sp of flowers) garden.push(offer('flower_'+sp+'_'+r.pick(colors),tent?150:980,true));
  const decorPool=['f_picnic_basket','f_shell_lamp','f_ramen_tray','f_meadow_box','f_herb_rack','f_camp_kettle','f_flowerpot','f_bookpile','f_teddy','f_easel','f_cactus','f_radio'];
  const specials=r.shuffle(decorPool.filter(id=>!shop.furn.includes(id))).slice(0,tent?2:5).map(id=>offer(id,ITEMS[id].buy,true));
  const result=[['오늘의 소품',specials],['도구·약',supplies.map(id=>offer(id))],['DIY 재료',materials.map(id=>offer(id))],['원예',garden]];
  if (!tent) {
    const fruit=shop.fruit || 'fruit_'+r.pick(Object.keys(FRUIT_KO).filter(f=>f!==nativeFruit));
    garden.push(offer(fruit,900,true));
    const extra=(list,current)=>r.pick(list.filter(([id,,price])=>id!==current && price>0))[0];
    result.push(['벽·바닥',[shop.wall,extra(WALLS,shop.wall),shop.floor,extra(FLOORS,shop.floor)].map(id=>offer(id))]);
  }
  return result;
}
