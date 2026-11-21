import { G } from './game.js';
import { el } from '../core/util.js';
import { Input } from '../core/input.js';

export function observeSchool(room,title,actors){
  if(!actors.length||G.room!==room)return;
  const box=el('aside','museum-watch'),name=el('strong'),note=el('span'),buttons=el('div');
  box.append(name,note,buttons);document.body.append(box);
  const stage=G.stage,cam=stage.camOff.clone(),look=stage.lookOff.clone();let index=0;
  function select(diff){
    index=(index+diff+actors.length)%actors.length;const e=actors[index];
    room.observation.target=e.m;name.textContent=title+'　·　'+e.name;note.textContent=e.fact;
  }
  const close=()=>{box.remove();room.observation=null;stage.camOff.copy(cam);stage.lookOff.copy(look);};
  for(const [label,fn] of [['이전 생물',()=>select(-1)],['다음 생물',()=>select(1)],['관찰 끝내기',close]]){
    const b=el('button','btn',label);if(actors.length===1&&fn!==close)b.disabled=true;b.onclick=fn;buttons.append(b);
  }
  room.observation={close,update:()=>{
    if(Input.take('menu')||Input.take('act'))return close();
    if(Input.take('left'))select(-1);if(Input.take('right'))select(1);
  }};
  stage.camOff.set(0,1.15,4.4);stage.lookOff.set(0,.06,0);select(0);
}
