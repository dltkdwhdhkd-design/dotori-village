// 꾸미기 창: 왼쪽에 살아 움직이는 미리보기, 오른쪽에 고르는 단추들. 시작 화면과 집 안 거울이 같이 쓴다.
import * as THREE from 'three';
import { Actor } from '../gfx/actor.js';
import { CURVE } from '../gfx/models.js';
import { el } from '../core/util.js';
import { Sound } from '../core/audio.js';
import { SKIN, HAIRC, EYEC, CLOTH, SHOE, HAIR, FACE, BROW, NOSE, EYES, MOUTH, CHEEK, OUTFIT, HAT, GLASS, PRESETS, MODEL, cleanLook, randomLook, dress } from './look.js';
import { hairThumb } from '../gfx/thumbs.js';

/** 캐릭터 한 명을 작은 화면에 따로 그린다(끌어서 돌릴 수 있다) */
class Preview {
  constructor(w, h) {
    const cv = this.canvas = document.createElement('canvas');
    cv.className = 'lk-view'; cv.style.width = w + 'px'; cv.style.height = h + 'px';
    this.renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xdcebc6, 2.25));
    const sun = new THREE.DirectionalLight(0xfff2dc, 1.9); sun.position.set(-3, 6, 5); this.scene.add(sun);
    const g = new THREE.Mesh(new THREE.CircleGeometry(0.62, 28), new THREE.MeshBasicMaterial({ color: 0x8a6a48, transparent: true, opacity: 0.2 }));
    g.rotation.x = -Math.PI / 2; g.scale.set(1, 0.72, 1); g.position.y = 0.005; this.scene.add(g);
    this.cam = new THREE.PerspectiveCamera(22, w / h, 0.1, 50);
    this.frame(true);
    this.actor = new Actor(MODEL);
    this.scene.add(this.actor.root);
    this.yaw = 0.3; this.actor.face(this.yaw, true);
    let drag = null;
    cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, yaw: this.yaw }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => { if (drag) { this.yaw = drag.yaw + (e.clientX - drag.x) * 0.012; this.actor.face(this.yaw, true); } });
    const end = () => { drag = null; };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    this.last = performance.now(); this.alive = true;
    const loop = (now) => {
      if (!this.alive) return;
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
      this.actor.update(dt);
      const k = CURVE.k.value; CURVE.k.value = 0;          // 미리보기에서는 '굽은 세계'를 끈다
      this.renderer.render(this.scene, this.cam);
      CURVE.k.value = k;
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  turn(d) { this.yaw += d; this.actor.face(this.yaw); }
  frame(close) {
    this.close = close;
    this.cam.position.set(0, close ? 1.32 : 1.42, close ? 4.22 : 5.25);
    this.cam.lookAt(0, close ? .995 : .79, 0);
  }
  dispose() {
    this.alive = false; cancelAnimationFrame(this.raf);
    this.renderer.dispose();
    try { this.renderer.forceContextLoss(); } catch (e) { /* 이미 닫힌 화면 */ }
  }
}

const TABS = [
  ['face', '얼굴', [['얼굴형', 'face', FACE.map(f => f.ko), 'name0'], ['피부', 'skin', SKIN, 'color'], ['눈썹', 'brow', BROW, 'name0'], ['눈', 'eyes', EYES, 'name1'], ['눈 색', 'eyec', EYEC, 'color'], ['코', 'nose', NOSE, 'name0'], ['입', 'mouth', MOUTH, 'name1'], ['볼', 'cheek', CHEEK, 'name0']]],
  ['hair', '머리', [['머리 모양', 'hair', HAIR, 'name1'], ['머리색', 'hairc', HAIRC, 'color']]],
  ['wear', '옷', [['옷', 'outfit', OUTFIT.map((o) => o.ko), 'name1'], ['윗옷 색', 'top', CLOTH, 'color'], ['아래옷 색', 'bot', CLOTH, 'color', (L) => L.outfit !== 3], ['신발 색', 'shoe', SHOE, 'color']]],
  ['deco', '꾸밈', [['모자', 'hat', HAT.map((o) => o.ko), 'name0'], ['모자 색', 'hatc', CLOTH, 'color', (L) => !!HAT[L.hat].color], ['안경', 'glass', GLASS, 'name0']]],
];

/**
 * 꾸미기 화면을 만든다. onChange(look): 고를 때마다 부른다.
 * 돌려주는 것: { el, look(지금 고른 모습), set(look), dispose() }
 */
export function lookEditor(initial, onChange = null, { w = 230, h = 290 } = {}) {
  let look = cleanLook(initial), tab = 'face';
  const root = el('div', 'lookui');
  const left = el('div', 'lk-left'), right = el('div', 'lk-right');
  const pv = new Preview(w, h);
  dress(pv.actor, look);
  left.appendChild(pv.canvas);
  const turn = el('div', 'lk-turn');
  const bl = el('button', 'btn', '◀'), br = el('button', 'btn', '▶');
  bl.setAttribute('aria-label', '왼쪽으로 돌리기'); br.setAttribute('aria-label', '오른쪽으로 돌리기');
  bl.onclick = () => pv.turn(-0.7); br.onclick = () => pv.turn(0.7);
  const zoom = el('button', 'btn lk-zoom', '전신 보기');
  const frame = close => { pv.frame(close); zoom.textContent = close ? '전신 보기' : '얼굴 확대'; };
  zoom.onclick = () => frame(!pv.close);
  turn.append(bl, zoom, br);
  left.appendChild(turn);
  const quick = el('div', 'lk-quick');
  const apply = (L, hop = true) => {
    look = cleanLook(L);
    dress(pv.actor, look);
    if (hop && !pv.close) pv.actor.play('hop', 0.32);
    if (onChange) onChange({ ...look });
    draw();
  };
  PRESETS.forEach((p, i) => { const b = el('button', 'btn', '본보기 ' + (i + 1)); b.onclick = () => { Sound.sfx('ui'); apply(p); }; quick.appendChild(b); });
  const rnd = el('button', 'btn go', '무작위'); rnd.onclick = () => { Sound.sfx('ui'); apply(randomLook()); }; quick.appendChild(rnd);
  const reset = el('button', 'btn', '처음 모습'); reset.onclick = () => apply(initial, false); quick.appendChild(reset);
  const tabs = el('div', 'tabs'), opts = el('div', 'lk-opts');
  right.appendChild(quick); right.appendChild(tabs); right.appendChild(opts);
  root.appendChild(left); root.appendChild(right);

  let lastTab;
  function draw() {
    const scroll = tab === lastTab ? opts.scrollTop : 0;
    const focus = document.activeElement?.dataset.lk;
    lastTab = tab;
    tabs.innerHTML = '';
    for (const [k, ko] of TABS) {
      const t = el('button', 'tab' + (tab === k ? ' on' : ''), ko);
      t.dataset.lk = 'tab-' + k; t.setAttribute('aria-pressed', String(tab === k));
      t.onclick = () => { tab = k; frame(k !== 'wear'); Sound.sfx('ui'); draw(); };
      tabs.appendChild(t);
    }
    opts.innerHTML = '';
    for (const [label, key, list, kind, when] of TABS.find((t) => t[0] === tab)[2]) {
      if (when && !when(look)) continue;
      const row = el('div', 'lk-row');
      row.appendChild(el('div', 'lk-label', label));
      const box = el('div', 'lk-box');
      box.setAttribute('role', 'group'); box.setAttribute('aria-label', label);
      if (key === 'hair') box.classList.add('lk-hair-grid');
      list.forEach((v, i) => {
        const val = kind === 'name1' ? i + 1 : i;
        const b = kind === 'color' ? el('button', 'sw' + (look[key] === val ? ' on' : '')) : el('button', 'opt' + (look[key] === val ? ' on' : ''), v);
        if (kind === 'color') { b.style.background = v; b.title = label + ' ' + (i + 1); }
        b.dataset.lk = key + '-' + val;
        b.setAttribute('aria-label', kind === 'color' ? b.title : v);
        b.setAttribute('aria-pressed', String(look[key] === val));
        if (key === 'hair') {
          const img = document.createElement('img');
          img.alt = ''; img.width = 52; img.height = 52; b.prepend(img);
          requestAnimationFrame(() => { if (img.isConnected) img.src = hairThumb(val); });
        }
        b.onclick = () => { Sound.sfx('ui'); apply({ ...look, [key]: val }, kind !== 'color'); };
        box.appendChild(b);
      });
      row.appendChild(box); opts.appendChild(row);
    }
    opts.scrollTop = scroll;
    if (focus) root.querySelector('[data-lk="' + focus + '"]')?.focus({ preventScroll: true });
  }
  draw();
  return { el: root, get look() { return { ...look }; }, set: (L) => apply(L, false), dispose: () => pv.dispose(), preview: pv };
}
