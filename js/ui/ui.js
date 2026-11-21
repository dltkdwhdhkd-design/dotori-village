// 화면 위의 글과 창: 시계, 도토리, 도구 칸, 대화, 창(패널), 알림
import { Input } from '../core/input.js';
import { Sound } from '../core/audio.js';
import { el, fmt, josa } from '../core/util.js';
import { thumb } from '../gfx/thumbs.js';
import { ITEMS } from '../data/items.js';
import { touchControls } from './touch.js';

const $ = (id) => document.getElementById(id);
const root = () => $('ui');

export const UI = {
  modal: 0,                 // 0보다 크면 주인공 조작을 막는다
  built: false,
  build() {
    if (this.built) return;
    this.built = true;
    root().innerHTML = `
      <div id="hud-clock" class="hud hidden"><div class="date"></div><div class="time"></div><div class="wx"></div></div>
      <div id="hud-money" class="hud hidden"><i class="acorn"></i><span></span></div>
      <div id="hud-tools" class="hud hidden"></div>
      <div id="hud-hint" class="hud hidden"></div>
      <div id="hud-goal" class="hud hidden"></div>
      <div id="hud-menu" class="hud hidden"></div>
      <div id="toasts"></div>
      <div id="card" class="hidden"></div>
      <div id="shade" class="hidden"></div>
      <div id="panel" class="hidden"><div class="head"><span class="ttl"></span><button class="x">✕</button></div><div class="body"></div></div>
      <div id="dlg" class="hidden"><div class="name"></div><div class="text"></div><div class="gesture" hidden></div><div class="next">▼</div></div>
      <div id="dlg-choices" class="hidden"></div>
      <div id="title" class="hidden"></div>
      <div id="loading"><div>도토리 마을</div><div class="pbar"><i></i></div><div class="msg" style="font-size:16px">짐을 푸는 중…</div></div>
      <div id="fade"></div>`;
    $('panel').querySelector('.x').onclick = () => this.closePanel();
    $('dlg').onclick = () => Dialog.click();
    $('shade').onclick = () => { if (this.panelOpen && !this.panelSticky) this.closePanel(); };
    this.touch=touchControls(root());
  },
  showHud(v) { for (const id of ['hud-clock', 'hud-money', 'hud-tools', 'hud-menu']) $(id).classList.toggle('hidden', !v); if (!v) { $('hud-hint').classList.add('hidden'); $('hud-goal').classList.add('hidden'); } },
  loading(p, msg) { const L = $('loading'); if (p == null) { L.classList.add('hidden'); return; } L.classList.remove('hidden'); L.querySelector('i').style.width = Math.round(p * 100) + '%'; if (msg) L.querySelector('.msg').textContent = msg; },

  setClock(date, time, wx) { const c = $('hud-clock'); c.querySelector('.date').textContent = date; c.querySelector('.time').textContent = time; c.querySelector('.wx').textContent = wx; },
  /** 화면 위쪽의 '할 일' 한 줄(빈 글이면 숨긴다) */
  setGoal(text) { const g = $('hud-goal'); g.textContent = text || ''; g.classList.toggle('hidden', !text || $('hud-clock').classList.contains('hidden')); },
  setMoney(n) { $('hud-money').querySelector('span').textContent = fmt(n); },
  setTools(list, current, onPick) {
    const key = list.join(',') + '|' + current;
    if (this._toolKey === key) return;
    this._toolKey = key;
    const box = $('hud-tools'); box.innerHTML = '';
    const all = ['tool_net', 'tool_rod', 'tool_shovel', 'tool_axe', 'tool_can'];
    all.forEach((id, i) => {
      const has = list.includes(id);
      const d = el('div', 'tool' + (id === current ? ' on' : '') + (has ? '' : ' none'), `<span class="key">${i + 1}</span>`);
      if (has) { const im = el('img'); im.src = thumb(id); d.appendChild(im); d.title = ITEMS[id].name; d.onclick = () => onPick(id); }
      box.appendChild(d);
    });
  },
  setMenu(buttons) {
    const box = $('hud-menu'); box.innerHTML = '';
    for (const [label, key, fn] of buttons) { const b = el('button', '', `${label}<span>${key}</span>`); b.onclick = () => { Sound.sfx('ui'); fn(); }; box.appendChild(b); }
  },
  hint(text, actionLabel = '행동') {
    const h = $('hud-hint');
    if (this.touch?.active) {
      this.touch.setActionLabel(actionLabel);
      text = text.replaceAll('<b>Space</b>', '<b>' + actionLabel + '</b>').replaceAll('<b>G</b>', '<b>대화</b>').replaceAll('<b>F</b>', '<b>줍기</b>');
    }
    if (!text || this.modal > 0) { h.classList.add('hidden'); this._hint = ''; return; }
    if (this._hint !== text) { h.innerHTML = text; this._hint = text; }
    h.classList.remove('hidden');
  },
  toast(msg, ms = 2400) {
    const t = el('div', 'toast', msg);
    $('toasts').appendChild(t);
    while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
    setTimeout(() => t.remove(), ms);
  },
  async fade(on) { $('fade').classList.toggle('on', on); await new Promise((r) => setTimeout(r, 300)); },

  // ------------------------------------------------------------ 창(패널)
  panelOpen: false, panelSticky: false, onPanelClose: null,
  openPanel(title, body, { onClose = null, sticky = false } = {}) {
    if (this.panelOpen) this.closePanel(true);
    this.panelOpen = true; this.panelSticky = sticky; this.onPanelClose = onClose; this.modal++;
    const p = $('panel');
    p.querySelector('.ttl').textContent = title;
    const b = p.querySelector('.body'); b.innerHTML = '';
    if (typeof body === 'string') b.innerHTML = body; else b.appendChild(body);
    p.classList.remove('hidden'); $('shade').classList.remove('hidden');
    Sound.sfx('open');
    return b;
  },
  closePanel(silent = false) {
    if (!this.panelOpen) return;
    this.panelOpen = false; this.modal = Math.max(0, this.modal - 1);
    $('panel').classList.add('hidden'); $('shade').classList.add('hidden');
    if (!silent) Sound.sfx('close');
    const f = this.onPanelClose; this.onPanelClose = null;
    if (f) f();
  },
  /** 창이 닫힐 때까지 기다린다 */
  panelAsync(title, body, opts = {}) { return new Promise((res) => this.openPanel(title, body, { ...opts, onClose: () => res() })); },

  // ------------------------------------------------------------ 잡았다 카드
  card({ id, title, sub, isNew }) {
    return new Promise((res) => {
      const c = $('card');
      c.innerHTML = `${isNew ? '<div class="new">도감에 새로 실렸다!</div><br>' : ''}<img src="${thumb(id)}"><div class="t">${title}</div><div class="s">${sub || ''}</div>`;
      c.classList.remove('hidden');
      this.modal++;
      this._card = () => { c.classList.add('hidden'); this.modal--; this._card = null; res(); };
      c.onclick = () => this._card && this._card();
    });
  },

  /** 매 프레임: 창과 대화가 키 입력을 먼저 가져간다 */
  update(dt) {
    if (this._card) { if (Input.take('act') || Input.take('menu')) this._card(); return; }
    if (Dialog.active) { Dialog.update(dt); return; }
    if (this.panelOpen) {
      if (Input.take('menu') || Input.take('bag')) { if (!this.panelSticky) this.closePanel(); }
      Input.take('act'); Input.take('pick');
    }
  },
  blocking() { return this.modal > 0 || Dialog.active; },
};

// ---------------------------------------------------------------- 대화
export const Dialog = {
  active: false, full: '', shown: 0, acc: 0, done: false, resolve: null, choices: null, sel: 0, pitch: 1, holdT: 0,
  /** 한 마디. 주인공이 넘길 때까지 기다린다. */
  say(name, text, { pitch = 1, color = null, actor = null, gesture = '' } = {}) {
    return new Promise((res) => {
      const d = $('dlg');
      d.classList.remove('hidden');
      const nm = d.querySelector('.name');
      nm.textContent = name || ''; nm.style.display = name ? '' : 'none';
      nm.style.background = color || '';
      const note=d.querySelector('.gesture');note.textContent=gesture;note.hidden=!gesture;
      d.classList.toggle('gesture-only',!text && !!gesture);
      this.active = true; this.full = text; this.shown = 0; this.acc = 0; this.done = false; this.resolve = res; this.pitch = pitch; this.choices = null; this.actor = actor;
      d.querySelector('.text').innerHTML = ''; d.querySelector('.next').style.visibility = 'hidden';
      $('dlg-choices').classList.add('hidden');
    });
  },
  /** 선택지. 고른 번호를 돌려준다. */
  choose(options, { cancel = -1 } = {}) {
    return new Promise((res) => {
      const box = $('dlg-choices');
      box.innerHTML = ''; box.classList.remove('hidden');
      this.active = true; this.choices = options; this.sel = 0; this.cancel = cancel; this.resolve = res; this.done = true;
      $('dlg').querySelector('.next').style.visibility = 'hidden';
      options.forEach((o, i) => { const b = el('button', 'choice' + (i === 0 ? ' sel' : ''), o); b.onclick = () => { this.sel = i; this.pick(); }; b.onmouseenter = () => { this.sel = i; this.paint(); }; box.appendChild(b); });
    });
  },
  paint() { [...$('dlg-choices').children].forEach((c, i) => c.classList.toggle('sel', i === this.sel)); },
  pick() {
    Sound.sfx('ui');
    const r = this.resolve, v = this.sel;
    $('dlg-choices').classList.add('hidden');
    this.choices = null; this.resolve = null;
    r(v);
  },
  render() {
    // <b>…</b> 강조만 허용한다
    const t = this.full.slice(0, this.shown);
    const open = (t.match(/<b>/g) || []).length, close = (t.match(/<\/b>/g) || []).length;
    $('dlg').querySelector('.text').innerHTML = t + (open > close ? '</b>' : '');
  },
  click() { if (this.choices) return; if (!this.done) { this.shown = this.full.length; this.finish(); } else this.advance(); },
  finish() { this.done = true; this.render(); $('dlg').querySelector('.next').style.visibility = 'visible'; },
  advance() { const r = this.resolve; this.resolve = null; if (r) { Sound.sfx('ui'); r(); } },
  close() { this.active = false; $('dlg').classList.add('hidden'); $('dlg-choices').classList.add('hidden'); },
  update(dt) {
    if (this.choices) {
      if (Input.take('up')) { this.sel = (this.sel + this.choices.length - 1) % this.choices.length; this.paint(); Sound.sfx('ui'); }
      if (Input.take('down')) { this.sel = (this.sel + 1) % this.choices.length; this.paint(); Sound.sfx('ui'); }
      if (Input.take('act')) this.pick();
      else if (Input.take('menu') && this.cancel >= 0) { this.sel = this.cancel; this.pick(); }
      return;
    }
    if (!this.resolve) return;
    if (!this.done) {
      const fast = Input.held('act') ? 4 : 1;
      this.acc += dt * 34 * fast;
      let n = Math.floor(this.acc); this.acc -= n;
      while (n-- > 0 && this.shown < this.full.length) {
        if (this.full[this.shown] === '<') { const e = this.full.indexOf('>', this.shown); this.shown = e + 1; continue; }
        const ch = this.full[this.shown++];
        if (ch.trim() && this.shown % 2 === 0) Sound.voice(this.pitch, ch);
        if (this.actor) this.actor.talk();
      }
      this.render();
      if (this.shown >= this.full.length) this.finish();
      if (Input.take('act')) { this.shown = this.full.length; this.finish(); }
    } else if (Input.take('act')) this.advance();
  },
};

/** 대사 속 표시({p} 등)를 채운다. vars: { p, me, c, o, f, i, v … } */
export function fill(text, vars) {
  return text.replace(/\{(\w+)(?:\|([^}]+))?\}/g, (m, k, j) => {
    const v = vars[k];
    if (v == null) return '';
    return j ? josa(String(v), j) : String(v);
  });
}

export function itemRow(id, sub, right) {
  const it = ITEMS[id];
  const d = el('div', 'li');
  const im = el('img'); im.src = thumb(id); d.appendChild(im);
  d.appendChild(el('div', 'nm', `${it ? it.name : id}${sub ? `<span class="sub">${sub}</span>` : ''}`));
  if (right != null) d.appendChild(el('div', 'pr', right));
  return d;
}
export function slotEl(s, { sel = false, unknown = false } = {}) {
  const d = el('div', 'slot' + (s ? '' : ' empty') + (sel ? ' sel' : '') + (unknown ? ' unknown' : ''));
  if (s) { const im = el('img'); im.src = thumb(s.id); d.appendChild(im); if (s.n > 1) d.appendChild(el('span', 'n', s.n)); d.title = ITEMS[s.id] ? ITEMS[s.id].name : ''; }
  return d;
}
export const acorns = (n) => `<i class="acorn" style="width:14px;height:16px;vertical-align:-2px"></i> ${fmt(n)}`;
