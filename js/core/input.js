// 키보드 입력
const down = new Set(), pressed = new Set();
let enabled = true;
const MAP = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'], act: ['Space', 'KeyZ', 'Enter'], pick: ['KeyF', 'KeyX'], bag: ['KeyE', 'KeyI', 'Tab'],
  map: ['KeyM'], dex: ['KeyC'], note: ['KeyN'], menu: ['Escape'], cycle: ['KeyQ'], put: ['Backquote', 'Digit0'],
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
    let x = 0, y = 0;
    if (this.held('left')) x -= 1; if (this.held('right')) x += 1;
    if (this.held('up')) y -= 1; if (this.held('down')) y += 1;
    const l = Math.hypot(x, y) || 1;
    return { x: x / l, y: y / l, on: x !== 0 || y !== 0 };
  },
  endFrame() { pressed.clear(); },
  press(code) { pressed.add(code); },                 // 테스트·화면 버튼용
  setDown(code, v) { v ? down.add(code) : down.delete(code); },
  enable(v) { enabled = v; },
};
