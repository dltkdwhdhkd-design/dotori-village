// 키보드 입력
const down = new Set(), pressed = new Set();
let enabled = true;
let touchX=0,touchY=0;
const MAP = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight','TouchRun'], act: ['Space', 'KeyZ', 'Enter','TouchAct'], pick: ['KeyF', 'KeyX','TouchPick'], bag: ['KeyE', 'KeyI', 'Tab'],
  talk: ['KeyG', 'TouchTalk'],
  map: ['KeyM'], dex: ['KeyC'], note: ['KeyN'], chat: ['KeyT'], menu: ['Escape'], cycle: ['KeyQ'], put: ['Backquote', 'Digit0'],
  t1: ['Digit1'], t2: ['Digit2'], t3: ['Digit3'], t4: ['Digit4'], t5: ['Digit5'],
};
const BLOCK = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);

window.addEventListener('keydown', (e) => {
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (BLOCK.has(e.code)) e.preventDefault();
  if (!e.repeat) pressed.add(e.code);
  down.add(e.code);
});
window.addEventListener('keyup', (e) => down.delete(e.code));
window.addEventListener('blur', () => { down.clear(); pressed.clear(); });

export const Input = {
  held: (name) => enabled && MAP[name].some((c) => down.has(c)),
  hit: (name) => enabled && MAP[name].some((c) => pressed.has(c)),
  /** 한 번 눌린 것을 써 버린다(같은 프레임에 다른 곳에서 또 반응하지 않게) */
  take(name) { if (!this.hit(name)) return false; for (const c of MAP[name]) pressed.delete(c); return true; },
  axis() {
    let x=enabled?touchX:0,y=enabled?touchY:0;
    if (this.held('left')) x -= 1; if (this.held('right')) x += 1;
    if (this.held('up')) y -= 1; if (this.held('down')) y += 1;
    const l = Math.max(1,Math.hypot(x,y));
    return { x: x / l, y: y / l, on: x !== 0 || y !== 0 };
  },
  endFrame() { pressed.clear(); },
  press(code) { pressed.add(code); },                 // 테스트·화면 버튼용
  setDown(code, v) { v ? down.add(code) : down.delete(code); },
  moveStick(x,y){touchX=x;touchY=y;},
  enable(v) { enabled = v; },
};
