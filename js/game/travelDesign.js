import * as THREE from 'three';
import { make } from '../gfx/models.js';
import { signMesh } from './museum.js';
import { certifiedPlots } from './fieldwork.js';

// Paint paths and working surfaces in the same world coordinates as the actors and props.
export function paintVillage(ctx,room,spots){
  const sx=ctx.canvas.width/(room.w+2),sz=ctx.canvas.height/(room.h+2);
  ctx.save();ctx.scale(sx,sz);ctx.translate(1,1);
  let seed=413;const rnd=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  function trail(points,width,color){
    ctx.beginPath();ctx.lineCap='round';ctx.lineJoin='round';ctx.moveTo(...points[0]);
    for(let i=1;i<points.length-1;i++)ctx.quadraticCurveTo(...points[i],(points[i][0]+points[i+1][0])/2,(points[i][1]+points[i+1][1])/2);
    ctx.lineTo(...points[points.length-1]);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
  }
  if(room.area==='meadow'){
    ctx.fillStyle='#a7b581';ctx.fillRect(-1,-1,16,13);
    for(let i=0;i<380;i++){const x=rnd()*16-1,z=rnd()*13-1;ctx.fillStyle=i%3?'#b7c68a':'#95a677';ctx.beginPath();ctx.ellipse(x,z,.14+rnd()*.24,.05+rnd()*.08,0,0,Math.PI*2);ctx.fill();}
    trail([[7,11.5],[6.9,8.7],[6.1,6.8],[5.9,4.5],[5.5,2.3]],1.42,'#d6bd8e');
    trail([[6.8,8.8],[8.9,8.6],[11.9,7.6]],.85,'#cabb91');
    for(const [x,z] of [...spots,...certifiedPlots]){
      ctx.fillStyle='#aa875c';ctx.beginPath();ctx.roundRect(x-.73,z-.46,1.46,.92,.20);ctx.fill();
      for(let k=-1;k<=1;k++)trail([[x-.53,z+k*.22],[x+.03,z+k*.22+.025],[x+.53,z+k*.22]],.055,'#896e4e');
    }
  }else if(room.area==='cave'){
    ctx.fillStyle='#8a978b';ctx.fillRect(-1,-1,16,13);
    for(let i=0;i<110;i++){
      const x=rnd()*16-1,z=rnd()*13-1,r=.18+rnd()*.50;ctx.fillStyle=['#899183','#7e897f','#9da28d'][i%3];
      ctx.beginPath();ctx.ellipse(x,z,r,r*.56,-.24,0,Math.PI*2);ctx.fill();
    }
    trail([[7,11.6],[6.7,9.1],[4.4,7.6],[4.5,5.9],[4.5,3.0]],1.4,'#bba98b');
    trail([[5.3,8.4],[7.8,7.25],[9.2,7.40],[10.6,8.35]],.88,'#afa58b');
    trail([[4.5,6.1],[3.4,5.9],[2.7,5.4]],.77,'#bba98b');
    for(let i=0;i<17;i++){const t=i/16,x=5.6+t*4.45,z=8.05-.75*Math.sin(t*3.4)+.16*Math.sin(i*2.2);
      ctx.fillStyle=i%3?'#a49f8c':'#cac3a4';ctx.beginPath();ctx.ellipse(x,z,.14,.086,i,0,Math.PI*2);ctx.fill();}
  }else{
    ctx.fillStyle='#98a38a';ctx.fillRect(-1,-1,16,13);
    ctx.save();ctx.beginPath();ctx.roundRect(.8,1.3,12.65,8.2,.66);ctx.clip();ctx.fillStyle='#9c9180';ctx.fillRect(0,0,15,11);
    for(let row=0;row<25;row++)for(let col=0;col<24;col++){
      const x=col*.7-(row%2)*.35,z=row*.37;ctx.fillStyle=['#c5b9a3','#d1c4ab','#bfb6a2','#c9bca5'][Math.floor(rnd()*4)];
      ctx.beginPath();ctx.roundRect(x+.018,z+.018,.665,.332,.04);ctx.fill();
    }ctx.restore();trail([[7,11.6],[7,10.6],[7.4,9.4]],1.45,'#d8c5a0');
  }
  for(let i=0;i<1050;i++){ctx.fillStyle=i%2?'#fffae123':'#594a381c';ctx.fillRect(rnd()*16-1,rnd()*13-1,.025+rnd()*.045,.018);}
  ctx.restore();
}

function prop(room,id,x,z,size=1,yaw=0){
  const m=make(id);m.position.set(x,0,z);m.scale.setScalar(size);m.rotation.y=yaw;room.group.add(m);return m;
}
function sign(room,text,x,y,z,width){
  const m=signMesh(text,width,.34,'#574d3e','#fbe8bd');m.position.set(x,y,z);room.group.add(m);
  (room.localGraphics ||= []).push(m);
}
function fence(room,x,z,length){
  const mat=new THREE.MeshLambertMaterial({color:0xa78b64}),pieces=[];
  for(let i=0;i<=length;i++){const o=new THREE.Mesh(new THREE.CylinderGeometry(.052,.075,.73,7),mat);o.position.set(x+i,.36,z);pieces.push(o);}
  for(const y of [.25,.53]){const o=new THREE.Mesh(new THREE.BoxGeometry(length,.066,.074),mat);o.position.set(x+length/2,y,z);pieces.push(o);}
  room.group.add(...pieces);(room.localGraphics ||= []).push(...pieces);
  room.block(Math.floor(x),Math.floor(z),Math.floor(x+length),Math.floor(z));
}
export function dressVillage(room){
  if(room.area==='meadow'){
    prop(room,'place_field_shelter',5.75,2.55);room.block(4,2,7,2);sign(room,'들녘 작업 접수',5.75,1.56,3.25,1.64);
    for(const [x,z] of [[3.43,2.9],[2.74,3.4],[1.5,7.8]]){prop(room,'place_harvest_basket',x,z,1.12);room.block(Math.floor(x),Math.floor(z));}
    fence(room,.35,5.45,2);fence(room,8.15,2.47,3);
    for(const [x,z] of [[2,5],[3,5],[.35,6.3],[8.1,2.6],[11.3,2.7],[9.3,4.1]])prop(room,'flower_cosmos',x,z,.76);
  }else if(room.area==='ramen'){
    prop(room,'place_noodle_shop',5.43,1.59);room.block(3,0,7,2);sign(room,'郎',5.43,2.18,2.59,.48);
    for(const x of [3.7,4.85,5.98]){prop(room,'f_log_stool',x,3.54,.68);room.block(Math.floor(x),3);}
    for(const [id,x,z,s]of [['f_jangdok',2.4,1.7,.92],['p_plant',2.4,3.2,.76],['place_harvest_basket',8.1,1.4,.85],['f_soban',10.1,4.7,.95],['f_log_stool',10.25,5.65,.70]]){
      prop(room,id,x,z,s);room.block(Math.floor(x),Math.floor(z));
    }
    sign(room,'조리대',6.86,1.05,2.64,.82);
    const count=9,positions=new Float32Array(count*3),geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
    const m=new THREE.Points(geo,new THREE.PointsMaterial({size:.065,color:0xf9ebd2,transparent:true,opacity:.52,depthWrite:false}));
    m.frustumCulled=false;room.group.add(m);(room.localGraphics ||= []).push(m);room.steam=m;
  }else{
    prop(room,'place_cave_home',4.2,1.17,1.11);room.block(2,0,6,1);
    prop(room,'f_bangseok',4.3,3.24,.82);prop(room,'f_bookpile',3.38,3.05,.68);
    for(const [x,z] of [[3.0,2.52],[6.98,6.8],[9.45,7.0],[2.10,4.86]]){prop(room,'place_cave_lamp',x,z,.89);room.block(Math.floor(x),Math.floor(z));}
    for(const [x,z,s] of [[1.33,1.06,1.32],[7.15,.76,1.52],[11.35,1.49,1.67],[12.3,7.78,.83],[11.97,9.20,.75]]){prop(room,'boulder2',x,z,s);room.block(Math.floor(x),Math.floor(z));}
    sign(room,'동굴 등불 길',6.98,.68,6.96,1.09);
  }
}
export function steamFrame(room,time){
  const p=room.steam?.geometry.attributes.position;if(!p)return;
  for(let i=0;i<p.count;i++){
    const k=(time*.52+i/p.count)%1;p.setXYZ(i,6.72+.09*Math.sin(i*2.31+k*4),1.37+k*.88,2.16+.08*Math.cos(i*3.13+k*6));
  }p.needsUpdate=true;
}
