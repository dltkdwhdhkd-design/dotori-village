import * as THREE from 'three';
import { make } from '../gfx/models.js';

const colors = {
  museum: ['#d5c3a4','#eedfc1','#936f44','#f2e7cd'],
  m_fresh: ['#719d99','#c5d5bd','#467c79','#bdd9c8'],
  m_sea: ['#28475a','#416981','#8ec4c6','#587c83'],
  m_bug: ['#90a47a','#d5c49c','#62816c','#adc39d'],
  m_butterfly: ['#a9bca1','#e7d6b0','#608f82','#bfd9bc'],
  m_fossil: ['#95857b','#c7b6a0','#795746','#bba794'],
};
function paintFloor(room) {
  const [stone,path,trim,wall]=colors[room.id];
  const c=document.createElement('canvas'), sz=48;
  c.width=room.w*sz;c.height=room.h*sz;
  const ctx=c.getContext('2d'); ctx.scale(sz,sz);
  ctx.fillStyle=stone;ctx.fillRect(0,0,room.w,room.h);
  for(let z=0;z<room.h;z++)for(let x=0;x<room.w;x++){
    ctx.fillStyle=(x*7+z*11)%5<2?'#ffffff0d':'#00000005';ctx.fillRect(x+.02,z+.02,.96,.96);
  }
  const garden=room.id==='m_bug'||room.id==='m_butterfly';
  let seed=94;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  if(garden){
    for(let i=0;i<75;i++){
      const x=random()*room.w,z=random()*room.h,r=.4+random()*1.45;
      const shade=ctx.createRadialGradient(x,z,0,x,z,r);
      shade.addColorStop(0,i%2?'#81935b55':'#bad18540');shade.addColorStop(1,'#91a76d00');
      ctx.fillStyle=shade;ctx.fillRect(x-r,z-r,r*2,r*2);
    }
  }
  for(let i=0;i<room.w*room.h*(garden?12:7);i++){
    const x=random()*room.w,z=random()*room.h;
    ctx.fillStyle=i%3?'#ffffff2a':'#363d3523';
    if(garden){
      ctx.beginPath();ctx.moveTo(x-.044,z-.055);ctx.lineTo(x+.018,z-.01);ctx.lineTo(x+.048,z-.075);ctx.lineTo(x+.03,z+.027);ctx.fill();
    }else ctx.fillRect(x,z,.016+random()*.043,.013);
  }
  const mid=room.w/2, route=room.h*.58;
  const pathLine=(points,width,color)=>{
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
    points.forEach(([x,z],i)=>i?ctx.lineTo(x,z):ctx.moveTo(x,z));ctx.stroke();
  };
  const paths=[[[mid,room.h+.2],[mid,route],[mid,2]],[[2,route],[room.w-2,route]]];
  for(const pt of room.portals||[])paths.push([[mid,route],[pt.x,route],[pt.x,-.1]]);
  for(const [width,color] of [[2.42,trim],[2.30,path]])for(const points of paths)pathLine(points,width,color);
  ctx.fillStyle=path;ctx.beginPath();ctx.arc(mid,route,2.15,0,Math.PI*2);ctx.fill();
  for(const r of [1.84,2.07]){ctx.strokeStyle=trim;ctx.lineWidth=.04;ctx.beginPath();ctx.arc(mid,route,r,0,Math.PI*2);ctx.stroke();}
  ctx.save();ctx.translate(mid,route);ctx.fillStyle=trim;
  for(let i=0;i<8;i++){ctx.rotate(Math.PI/4);ctx.beginPath();ctx.moveTo(0,-1.56);ctx.lineTo(.105,-1.04);ctx.lineTo(0,-.75);ctx.lineTo(-.105,-1.04);ctx.fill();}ctx.restore();
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;
  const mat=room.floorMesh.material;mat.map.dispose();mat.map=t;
  for(const m of room.wallMeshes){m.material.map.dispose();m.material.map=null;m.material.color.set(wall);m.material.needsUpdate=true;}
}
const mat = color => new THREE.MeshLambertMaterial({color});
function mesh(room,geometry,material,x,y,z) {
  const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);room.group.add(m);return m;
}
function beam(room,a,b,r,material) {
  const v=new THREE.Vector3(...a),w=new THREE.Vector3(...b),d=w.clone().sub(v);
  const mid=v.clone().lerp(w,.5),m=mesh(room,new THREE.CylinderGeometry(r,r,d.length(),8),material,mid.x,mid.y,mid.z);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());
}
function arch(room,x,z,width,base,height,material,r=.065) {
  const pts=[];
  for(let i=0;i<=24;i++){
    const a=i*Math.PI/24;pts.push(new THREE.Vector3(x+width*Math.cos(a),base+height*Math.sin(a),z));
  }
  const path=new THREE.CatmullRomCurve3(pts);
  mesh(room,new THREE.TubeGeometry(path,28,r,7,false),material,0,0,0);
}
function prop(room,id,x,z,scale=1,angle=0) {
  const m=make(id);m.position.set(x,0,z);m.scale.setScalar(scale);m.rotation.y=angle;room.group.add(m);return m;
}
function bench(room,x,z,angle=0) {
  prop(room,'bench',x,z,.83,angle);room.block(Math.floor(x),Math.floor(z));
}
function columns(room,x,z,material) {
  for(const [a,b,h,y] of [[.4,.46,.17,.085],[.32,.36,.21,.275],[.23,.29,2.40,1.58],[.32,.25,.16,2.86],[.42,.34,.18,3.03]]){
    mesh(room,new THREE.CylinderGeometry(a,b,h,12),material,x,y,z);
  }
  room.block(Math.floor(x),Math.floor(z));
}
function greenhouse(room,x,z,span,length){
  const steel=mat(0x427e74), cream=mat(0xead7a6);
  for(const dz of [-length/2,0,length/2]){
    arch(room,x,z+dz,span,1.95,1.49,steel,.055);
    for(const s of [-1,1]) {
      const xx=x+s*span;beam(room,[xx,.08,z+dz],[xx,1.97,z+dz],.065,steel);
      mesh(room,new THREE.CylinderGeometry(.12,.18,.28,8),cream,xx,.14,z+dz);
      room.block(Math.floor(xx),Math.floor(z+dz));
    }
  }
  for(const a of [.35,Math.PI/2,Math.PI-.35]){
    const xx=x+span*Math.cos(a),y=1.95+1.49*Math.sin(a);
    beam(room,[xx,y,z-length/2],[xx,y,z+length/2],.037,steel);
  }
}
function seaTunnel(room){
  const x=room.w*.5,z=room.h*.68,frame=mat(0x73a9a9),r=2.35;
  const shell=new THREE.MeshBasicMaterial({color:0x83d7db,opacity:.11,transparent:true,side:THREE.DoubleSide,depthWrite:false});
  const pane=mesh(room,new THREE.CylinderGeometry(r,r,4.8,40,1,true,0,Math.PI),shell,x,.20,z);
  pane.rotation.set(0,0,0);pane.geometry.rotateY(-Math.PI/2);pane.geometry.rotateX(-Math.PI/2);
  for(const dz of [-2.4,-.8,.8,2.4])arch(room,x,z+dz,r,.20,r,frame,.055);
}
export function tankWindow(width,height,sea,theme){
  const c=document.createElement('canvas');c.width=1024;c.height=256;
  const ctx=c.getContext('2d'),wash=ctx.createLinearGradient(0,0,0,256);
  const tint=({cold:['#487793','#304a76','#262c4c'],drift:['#826da8','#4b5488','#363361'],mouth:['#91b5aa','#649188','#496d66'],reef:['#69bcb0','#3c8e94','#285d73']})[theme]|| (sea?['#3d9cab','#217895','#124765']:['#79bba9','#508e84','#325f61']);
  wash.addColorStop(0,tint[0]);wash.addColorStop(.42,tint[1]);wash.addColorStop(1,tint[2]);
  ctx.fillStyle=wash;ctx.fillRect(0,0,1024,256);
  for(let i=0;i<18;i++){
    const x=i*73+19*Math.sin(i*5.3),dy=102+i%4*35;
    const ray=ctx.createLinearGradient(0,0,0,dy);ray.addColorStop(0,'rgba(215,255,237,.15)');ray.addColorStop(1,'rgba(215,255,237,0)');
    ctx.fillStyle=ray;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+12+i%3*8,0);ctx.lineTo(x-80,dy);ctx.lineTo(x-133,dy);ctx.fill();
  }
  for(let j=0;j<2;j++){
    ctx.fillStyle=sea?['#25687b','#1b566a'][j]:['#538e82','#427674'][j];
    ctx.beginPath();ctx.moveTo(0,256);
    for(let x=0;x<=1024;x+=8)ctx.lineTo(x,203+j*26+14*Math.sin(x*.018+j)+10*Math.sin(x*.051+j));
    ctx.lineTo(1024,256);ctx.fill();
  }
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:texture}));
}
export function habitatDecor(room,id,[x0,x1,z0,depth]){
  const mid=(x0+x1)/2,back=z0+depth*.32;
  if(id==='upper'||id==='middle'){
    for(let i=0;i<5;i++){const r=prop(room,'boulder1',x0+.85+i*(x1-x0-1.7)/4,back+.17*Math.sin(i),id==='upper'?.78:.45,i*.9);r.position.y=.53;}
    if(id==='upper'){
      const waterfall=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
        uniforms:{time:room.waterClock},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader:`varying vec2 vUv;uniform float time;void main(){float band=.5+.5*sin(vUv.x*52.+sin(vUv.y*8.+time*4.));
          float flow=.5+.5*sin(vUv.y*23.+time*7.+vUv.x*5.);float edge=smoothstep(0.,.12,vUv.x)*(1.-smoothstep(.88,1.,vUv.x));
          gl_FragColor=vec4(.65+.22*flow,.92,.94,edge*(.16+.35*band+.12*flow));
          #include <colorspace_fragment>
        }`});
      const fall=mesh(room,new THREE.PlaneGeometry(1.12,.94),waterfall,x0+1.16,2.17,z0+.44);fall.renderOrder=4;
    }
  }else if(id==='pond'){
    const leaf=mat(0x7b9c58);
    for(let i=0;i<8;i++){const m=mesh(room,new THREE.CircleGeometry(.15+(i%3)*.045,18,.24,5.84),leaf,mid+Math.cos(i*2.4)*2.65,.43,back+.7+.72*Math.sin(i*2.4));m.rotation.x=-Math.PI/2;}
  }else if(id==='reef'){
    for(let i=0;i<6;i++){const x=x0+.6+(x1-x0-1.3)*i/5,z=back+.42*Math.sin(i*2.3),c=mat(i%2?0xcf906f:0xba8391);
      beam(room,[x,.54,z],[x+.12,1.17,z],.052,c);
      for(const side of [-1,1]){beam(room,[x+.07,.82,z],[x+side*.22,1.02,z],.035,c);beam(room,[x+side*.22,1.02,z],[x+side*.24,1.19,z],.029,c);}
    }
  }
}
// Kelp ribbons, gravel outcrops and rising air sit behind the donated fish.
export function tankHabitat(room,x0,x1,z0,z1,y0,y1,sea,theme){
  const width=x1-x0,count=Math.max(2,Math.round(width*.62));
  const rock=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),mat(0x899a92),count*3);
  const leafPositions=[],leafIndices=[],leafColors=[],pose=new THREE.Object3D();
  const noise=(i,k)=>.5+.5*Math.sin(i*37.23+k*11.67+Math.sin(i*.81+k)*3.2);
  let index=0;
  const fronds=['cold','drift','ocean','tidal'].includes(theme)?0:4;
  for(let i=0;i<count;i++){
    const x=x0+.55+(width-1.1)*(i+.4)/count,z=z0+.46+(z1-z0)*.32*noise(i,2);
    for(let j=0;j<3;j++){
      const r=.12+.28*noise(i+j,4);
      pose.position.set(x+(j-1)*r,y0+.06,z+.18*noise(i,j));pose.rotation.set(.13,i+j*.69,-.14);
      pose.scale.set(r*1.6,r,r*.86);pose.updateMatrix();rock.setMatrixAt(index,pose.matrix);
      rock.setColorAt(index++,new THREE.Color().setHSL(.46,.09,.53+.21*noise(i+j,8)));
    }
    for(let j=0;j<fronds;j++){
      const height=(.50+noise(i,j)*.63)*(y1-y0)*.56;
      const shade=new THREE.Color(sea?(j%2?0x467e73:0x66947c):(j%2?0x62894e:0x749a65));const first=leafPositions.length/3;
      for(let k=0;k<=8;k++){
        const t=k/8,bend=(j-1.5)*.16*t+Math.sin(t*6.2+i+j)*.115*t,w=.08*(.26+.75*Math.sin(t*Math.PI))*(k===8?.1:1);
        for(const s of [-1,1]){
          leafPositions.push(x+(j-1.5)*.14+bend+s*w,y0+.06+t*height,z+.035*Math.sin(t*4+j)+j*.024);
          leafColors.push(shade.r*(.64+.36*t),shade.g*(.64+.36*t),shade.b*(.64+.36*t));
        }
        if(k){const a=first+2*k-2;leafIndices.push(a,a+2,a+1,a+1,a+2,a+3);}
      }
    }
  }
  room.group.add(rock);
  if(fronds){
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(leafPositions,3));
    geo.setAttribute('color',new THREE.Float32BufferAttribute(leafColors,3));geo.setIndex(leafIndices);geo.computeVertexNormals();
    room.group.add(new THREE.Mesh(geo,new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide})));
  }
  const dots=count*3,points=new Float32Array(dots*3);
  for(let i=0;i<dots;i++){
    points[i*3]=x0+.44+(width-.88)*noise(Math.floor(i/5),6)+(noise(i,3)-.5)*.25;
    points[i*3+1]=noise(i,7);points[i*3+2]=z0+.44+(z1-z0)*.60*noise(Math.floor(i/5),9);
  }
  const bubbleGeo=new THREE.BufferGeometry();bubbleGeo.setAttribute('position',new THREE.BufferAttribute(points,3));
  const bubbles=new THREE.Points(bubbleGeo,new THREE.ShaderMaterial({transparent:true,depthWrite:false,
    uniforms:{clock:room.waterClock ||= {value:0},floorY:{value:y0+.08},span:{value:y1-y0-.25}},
    vertexShader:`uniform float clock,floorY,span;void main(){vec3 p=position;float t=fract(p.y+clock*.145);
      p.y=floorY+t*span;p.x+=.055*sin(t*13.+p.z);vec4 v=modelViewMatrix*vec4(p,1.);
      gl_Position=projectionMatrix*v;gl_PointSize=clamp(31./-v.z,1.6,4.);}`,
    fragmentShader:`void main(){float r=length(gl_PointCoord-.5);float a=smoothstep(.19,.33,r)*(1.-smoothstep(.34,.49,r));
      gl_FragColor=vec4(.72,.94,.97,a*.72);
      #include <colorspace_fragment>
    }`}));
  bubbles.frustumCulled=false;bubbles.renderOrder=5;room.group.add(bubbles);
}
export function decorateMuseum(room,signMesh) {
  paintFloor(room);
  const stone=mat(room.id==='m_fossil'?0xb3a18c:0xe3d0a9);
  if(room.id==='museum'){
    const mid=room.w/2;
    for(const x of [2.5,room.w-2.5])for(const z of [3.5,8.5])columns(room,x,z,stone);
    for(const p of room.portals){
      arch(room,p.x,.34,.97,1.4,1.18,mat(0xb69560),.095);
      const s=signMesh(p.label,2.04,.42,({m_bug:'#426951',m_fossil:'#765342',m_fresh:'#325f75'})[p.to],'#f6e8c1');s.position.set(p.x,2.44,.40);room.group.add(s);
    }
    bench(room,mid-5,room.h-3);bench(room,mid+5,room.h-3);
  }else if(room.id==='m_bug'||room.id==='m_butterfly'){
    greenhouse(room,room.id==='m_bug'?6:room.w/2,room.id==='m_bug'?4.5:room.h*.48,room.id==='m_bug'?4:5,room.id==='m_bug'?5:7);
    const W=room.w,H=room.h;
    for(const [x,z] of [[1.5,2.5],[W-2.5,3.5],[1.6,H-3.5],[W-2.5,H-4.5]]){
      prop(room,'tree_blossom',x,z,.72);room.block(Math.floor(x),Math.floor(z));
    }
    bench(room,3.5,H-3.2);
  }else if(room.id==='m_sea'){
    seaTunnel(room);bench(room,4.5,room.h-3.5);bench(room,room.w-5.5,room.h-3.5);
  }else if(room.id==='m_fresh'){
    for(const [x,z] of [[2.5,9.5],[room.w-3.5,room.h-4.5]]){
      prop(room,'p_plant',x,z,1.1);room.block(Math.floor(x),Math.floor(z));
    }
    bench(room,3.5,room.h-3.5);
  }else{
    for(const x of [1.5,room.w-1.5])for(const z of [2.5,8.5,room.h-2.5])columns(room,x,z,stone);
    bench(room,room.w/2-3,room.h-2.5);bench(room,room.w/2+3,room.h-2.5);
  }
}
