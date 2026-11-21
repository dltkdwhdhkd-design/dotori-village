import { Input } from '../core/input.js';
import { el } from '../core/util.js';

export function touchControls(root) {
  const shell=el('div','touch-controls'),pad=el('div','touch-stick'),knob=el('i');
  pad.setAttribute('aria-label','이동 조이스틱');pad.append(knob);shell.append(pad);root.append(shell);
  let active=false,visible=false,stickId=null;
  const enable=()=>{active=true;document.documentElement.classList.add('touch-mode');};
  if(navigator.maxTouchPoints||matchMedia('(any-pointer: coarse)').matches)enable();
  window.addEventListener('pointerdown',e=>{if(!active&&e.pointerType==='touch')enable();},{passive:true});
  function rest(){stickId=null;Input.moveStick(0,0);Input.setDown('TouchRun',false);knob.style.transform='translate(-50%,-50%)';}
  function move(e){
    const r=pad.getBoundingClientRect(),radius=r.width*.34,dx=(e.clientX-r.left-r.width/2)/radius,dy=(e.clientY-r.top-r.height/2)/radius;
    const d=Math.hypot(dx,dy),k=Math.max(1,d),x=dx/k,y=dy/k;
    Input.moveStick(d<.13?0:x,d<.13?0:y);Input.setDown('TouchRun',d>1.04);
    knob.style.transform='translate(calc(-50% + '+x*radius+'px),calc(-50% + '+y*radius+'px))';
  }
  pad.onpointerdown=e=>{if(!visible||stickId!==null)return;e.preventDefault();stickId=e.pointerId;pad.setPointerCapture(stickId);move(e);};
  pad.onpointermove=e=>{if(e.pointerId===stickId)move(e);};
  pad.onpointerup=pad.onpointercancel=pad.onlostpointercapture=e=>{if(e.pointerId===stickId)rest();};
  const releases=[];
  let actionButton;
  for(const [label,code,cls] of [['행동','TouchAct','touch-act'],['대화','TouchTalk','touch-talk'],['줍기','TouchPick','touch-pick']]){
    const b=el('button',cls,label);let owner=null;
    if (code === 'TouchAct') actionButton = b;
    const release=()=>{owner=null;Input.setDown(code,false);b.classList.remove('pressed');};
    releases.push(release);shell.append(b);
    b.onpointerdown=e=>{if(!visible||owner!==null)return;e.preventDefault();owner=e.pointerId;b.setPointerCapture(owner);Input.press(code);Input.setDown(code,true);b.classList.add('pressed');};
    b.onpointerup=b.onpointercancel=b.onlostpointercapture=e=>{if(owner===e.pointerId)release();};
    b.onclick=e=>{if(visible&&e.detail===0)Input.press(code);};
  }
  const reset=()=>{rest();releases.forEach(fn=>fn());};
  window.addEventListener('blur',reset);document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
  shell.oncontextmenu=e=>e.preventDefault();
  return {
    setActionLabel(label) { if (actionButton.textContent !== label) actionButton.textContent = label; },
    show(free){const next=!!(free&&active);if(next===visible)return;visible=next;shell.classList.toggle('active',visible);if(!visible)reset();},
    get active(){return active;}
  };
}
