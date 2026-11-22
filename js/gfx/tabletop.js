import { make } from './models.js';

// 높이와 좌석 중심은 Blender 가구의 상판 치수(타일 단위)에 맞춘다.
const surfaces = {
  f_log_table:   {height:.606, centers:[-.41,.41]},
  f_desk:        {height:.70, centers:[-.42,.42], z:-.04},
  f_pastel_table:{height:.50, centers:[0]},
  f_soban:       {height:.35, centers:[0]},
  f_log_dresser: {height:.90, centers:[0], z:-.05},
  f_jagaejang:   {height:1.48, centers:[-.42,.42], z:-.08},
};
const sizes = {
  f_flowerpot:.86, f_cactus:.82, f_bookpile:.8, f_globe:.8, f_teddy:.72,
  f_radio:.72, f_fishtank:.65, f_picnic_basket:.76, f_shell_lamp:.85, f_ramen_tray:.75,
};
export const isTabletopItem = id => Object.hasOwn(sizes,id);
export function surfaceSlot(base,dx,dz) {
  const surface=surfaces[base?.id];
  if (!surface) return -1;
  const r=base.r||0, length=surface.centers.length;
  const along=r%2?dz:dx, across=r%2?dx:dz;
  if (across!==0 || along<0 || along>=length) return -1;
  return r<2?along:length-1-along;
}
export function putOnTop(base,slot,id) {
  if (!isTabletopItem(id) || !surfaces[base?.id] || slot<0 || slot>=surfaces[base.id].centers.length || base.tops?.[slot]) return false;
  base.tops ||= [];
  base.tops[slot]={id,r:0};
  return true;
}
export function drawTabletop(model,base) {
  const surface=surfaces[base.id];
  if (!surface || !base.tops) return;
  surface.centers.forEach((x,slot)=>{
    const top=base.tops[slot];
    if (!top || !isTabletopItem(top.id)) return;
    const setting=model.userData.parts?.['setting'+slot];
    if (setting) setting.visible=false;
    const prop=make(top.id);
    prop.position.set(x,surface.height,surface.z||0);
    prop.scale.setScalar(sizes[top.id]);
    prop.rotation.y=-(top.r||0)*Math.PI/2;
    model.add(prop);
  });
}
