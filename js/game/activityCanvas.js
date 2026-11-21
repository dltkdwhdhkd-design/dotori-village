import { UI } from '../ui/ui.js';
import { el } from '../core/util.js';

// Logical coordinates are shared by drawing, mouse, touch, and keyboard controls.
export function activityCanvas(title,objective,instructions,game) {
  const wrap=el('div','activity-game'),lead=el('p','activity-objective',objective),canvas=el('canvas'),status=el('p','activity-status'),keys=el('p','note',instructions);
  canvas.tabIndex=0;canvas.setAttribute('aria-label',title+' · '+instructions);status.setAttribute('role','status');
  wrap.append(lead,canvas,status,keys);UI.openPanel(title,wrap);
  const c=canvas.getContext('2d'),scale=Math.min(2,window.devicePixelRatio||1);
  canvas.width=640*scale;canvas.height=360*scale;c.scale(scale,scale);
  const abort=new AbortController(),opt={signal:abort.signal};let capture=null,previous=0,frame=0;
  const stop=()=>{abort.abort();cancelAnimationFrame(frame);};
  const say=text=>{if(status.textContent!==text)status.textContent=text;};
  const point=e=>{const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*640/r.width,y:(e.clientY-r.top)*360/r.height};};
  canvas.addEventListener('pointerdown',e=>{if(capture!==null)return;e.preventDefault();canvas.focus();capture=e.pointerId;canvas.setPointerCapture(capture);game.pointer('down',point(e));},opt);
  canvas.addEventListener('pointermove',e=>{if(e.pointerId===capture)game.pointer('move',point(e));},opt);
  const release=(e,type)=>{if(e.pointerId===capture){capture=null;game.pointer(type,point(e));}};
  canvas.addEventListener('pointerup',e=>release(e,'up'),opt);canvas.addEventListener('pointercancel',e=>release(e,'cancel'),opt);
  const key=(down,e)=>{
    if(!wrap.isConnected||!UI.panelOpen||!game.keys.includes(e.code))return;
    if(!canvas.contains(document.activeElement) && document.activeElement?.tagName==='BUTTON')return;
    e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)game.key(down,e.code);
  };
  window.addEventListener('keydown',e=>key(true,e),{...opt,capture:true});
  window.addEventListener('keyup',e=>key(false,e),{...opt,capture:true});
  const pause=()=>{capture=null;previous=0;game.cancel?.();};
  window.addEventListener('blur',pause,opt);document.addEventListener('visibilitychange',pause,opt);
  UI.onPanelClose=stop;
  game.init({say,wrap,canvas,close:()=>UI.closePanel()});canvas.focus({preventScroll:true});
  function paint(now){
    if(!wrap.isConnected||!UI.panelOpen){stop();return;}
    const dt=previous&&!document.hidden?Math.min((now-previous)/1000,.12):0;previous=now;
    game.tick(dt);if(!wrap.isConnected)return;
    c.save();game.draw(c);c.restore();frame=requestAnimationFrame(paint);
  }
  frame=requestAnimationFrame(paint);
}
export function oval(c,x,y,rx,ry,color,angle=0){
  c.beginPath();c.ellipse(x,y,rx,ry,angle,0,Math.PI*2);c.fillStyle=color;c.fill();
}
export function rounded(c,x,y,w,h,r,color){
  c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=color;c.fill();
}
export function label(c,text,x,y,size,color='#fff8dc',align='center'){
  c.font='bold '+size+'px system-ui, sans-serif';c.textAlign=align;c.textBaseline='middle';c.fillStyle=color;c.fillText(text,x,y);
}
export function line(c,points,color,width){
  c.beginPath();c.moveTo(...points[0]);for(const point of points.slice(1))c.lineTo(...point);
  c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();
}
