// 캐릭터 한 명을 화면에 세우고 움직인다.
// 모델에 body/head/arm_L/arm_R/leg_L/leg_R/tail 부위가 있으면 걷기·휘두르기를 부위별로,
// 없으면(직접 바꿔 넣은 통짜 모델이나 그림 한 장) 몸 전체를 통통 튀게 해서 표현한다.
import * as THREE from 'three';
import { make, has, patchMaterial } from './models.js';
import { makeBlobShadow } from './stage.js';
import { lerp, TAU } from '../core/util.js';

const TARGET_H = 1.42;
const texLoader = new THREE.TextureLoader();
const IMG = {};      // 캐릭터 id -> 그림(텍스처). 그림 한 장으로 바꾼 캐릭터용

export function registerImageChar(id, url) {
  return new Promise((res) => {
    texLoader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; if (t.image.width <= 160) { t.magFilter = THREE.NearestFilter; } IMG[id] = t; res(true); }, undefined, () => res(false));
  });
}

const emoteTex = {};
function emoteTexture(kind) {
  if (emoteTex[kind]) return emoteTex[kind];
  const c = document.createElement('canvas'); c.width = c.height = 96;
  const x = c.getContext('2d');
  x.fillStyle = '#fffdf5'; x.strokeStyle = '#5a4632'; x.lineWidth = 4;
  x.beginPath(); x.arc(48, 42, 34, 0, TAU); x.fill(); x.stroke();
  x.beginPath(); x.moveTo(38, 72); x.lineTo(48, 92); x.lineTo(58, 72); x.closePath(); x.fill(); x.stroke();
  x.fillStyle = '#fffdf5'; x.fillRect(38, 66, 20, 8);
  const G = { '!': ['!', '#e8463c'], '?': ['?', '#4a82d6'], note: ['♪', '#3fa39a'], heart: ['♥', '#f0567a'], dots: ['…', '#5a4632'], zzz: ['z', '#6a7fd0'], angry: ['#', '#e8463c'], sweat: [';', '#4a90d9'], spark: ['✦', '#f2b01e'], sad: ['︵', '#6a7fd0'] }[kind] || ['!', '#e8463c'];
  x.fillStyle = G[1]; x.font = 'bold 46px "Jua","Malgun Gothic",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(G[0], 48, 44);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  emoteTex[kind] = t;
  return t;
}

export class Actor {
  constructor(id, opts = {}) {
    this.id = id;
    this.root = new THREE.Group();
    this.pivot = new THREE.Group();            // 방향을 돌리는 축
    this.root.add(this.pivot);
    this.shadow = makeBlobShadow(opts.shadow || 0.34, 0.3);
    this.root.add(this.shadow);
    this.yaw = 0; this.targetYaw = 0;
    this.speed = 0;                            // 0=서 있음, 1=걷기, 1.6=달리기
    this.phase = Math.random() * 6; this.t = Math.random() * 10;
    this.anim = null; this.held = null; this.emoteObj = null; this.emoteT = 0;
    this.sneak = false; this.sit = false;
    this.setModel(id);
  }

  setModel(id) {
    if (this.model) this.pivot.remove(this.model);
    this.billboard = null;
    if (IMG[id]) {
      const tex = IMG[id];
      const asp = tex.image.width / tex.image.height;
      const geo = new THREE.PlaneGeometry(TARGET_H * asp, TARGET_H); geo.translate(0, TARGET_H / 2, 0);
      const mat = patchMaterial(new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide }));
      this.billboard = new THREE.Mesh(geo, mat); this.billboard.frustumCulled = false;
      this.model = new THREE.Group(); this.model.add(this.billboard);
      this.root.add(this.model);               // 그림은 방향축에 붙이지 않는다(늘 카메라를 본다)
      this.parts = {};
      this.topY = TARGET_H + 0.15;
      return;
    }
    this.model = make(has(id) ? id : 'missing_char');
    this.parts = this.model.userData.parts || {};
    if (!this.parts.head && !this.model.userData.missing) {
      // 부위 이름이 없는 모델: 키를 맞춘다
      const box = new THREE.Box3().setFromObject(this.model);
      const h = box.max.y - box.min.y;
      if (h > 0.01) { const s = TARGET_H / h; this.model.scale.setScalar(s); this.model.position.y = -box.min.y * s; }
    }
    this.pivot.add(this.model);
    this.rest = {};
    for (const k of ['body', 'head', 'arm_L', 'arm_R', 'leg_L', 'leg_R', 'tail']) if (this.parts[k]) this.rest[k] = this.parts[k].position.clone();
    this.topY = this.parts.top ? this.parts.top.position.y : TARGET_H + 0.1;
  }

  setPos(x, y, z) { this.root.position.set(x, y, z); }
  get x() { return this.root.position.x; }
  get z() { return this.root.position.z; }
  face(yaw, snap = false) { this.targetYaw = yaw; if (snap) this.yaw = yaw; }
  faceTo(x, z, snap = false) { this.face(Math.atan2(x - this.x, z - this.z), snap); }

  play(name, dur = 0.45) { this.anim = { name, t: 0, dur }; }
  playing(name) { return this.anim && (!name || this.anim.name === name); }

  hold(model, tint) {
    const hand = this.parts.hand || this.pivot;
    if (this.held) { this.held.parent.remove(this.held); this.held = null; }
    if (!model) return;
    this.held = make(model, tint ? { tint } : {});
    if (!this.parts.hand) this.held.position.set(-0.4, 0.45, 0.1);
    hand.add(this.held);
  }

  emote(kind, dur = 1.6) {
    if (this.emoteObj) { this.root.remove(this.emoteObj); this.emoteObj.material.dispose(); }
    if (!kind) { this.emoteObj = null; return; }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), patchMaterial(new THREE.MeshBasicMaterial({ map: emoteTexture(kind), transparent: true, depthTest: false })));
    m.rotation.x = -0.75; m.renderOrder = 20; m.frustumCulled = false;
    m.position.set(0.05, this.topY + 0.42, 0);
    this.root.add(m);
    this.emoteObj = m; this.emoteT = dur; this.emoteDur = dur;
  }

  update(dt) {
    this.t += dt;
    // 방향을 부드럽게 돌린다
    let d = this.targetYaw - this.yaw;
    while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
    this.yaw += d * Math.min(1, dt * 14);
    this.pivot.rotation.y = this.yaw;
    const P = this.parts, sp = this.speed;
    const moving = sp > 0.02;
    if (moving) this.phase += dt * (this.sneak ? 5 : 8.5 + sp * 2.2);
    const s = Math.sin(this.phase), amt = moving ? Math.min(1, sp) : 0;
    let bob = moving ? Math.abs(s) * (this.sneak ? 0.02 : 0.055) : Math.sin(this.t * 2.2) * 0.008;
    let lean = moving ? (sp > 1.2 ? 0.16 : 0.06) : 0, armR = null, armL = null, bodyRx = 0, jump = 0, squash = 1, headRx = 0, headRz = 0;

    const a = this.anim;
    if (a) {
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      if (a.name === 'swing') { armR = lerp(-2.7, 0.9, Math.min(1, k * 1.6)); bodyRx = Math.sin(k * Math.PI) * 0.25; }
      else if (a.name === 'raise') { armR = -2.5; }
      else if (a.name === 'cast') { armR = lerp(-2.9, -0.9, Math.min(1, k * 1.5)); bodyRx = Math.sin(k * Math.PI) * 0.15; }
      else if (a.name === 'holdrod') { armR = -0.9; a.t = 0; }
      else if (a.name === 'pull') { armR = lerp(-0.9, -2.9, Math.min(1, k * 2)); bodyRx = -0.2 * Math.sin(k * Math.PI); }
      else if (a.name === 'dig') { armR = lerp(-1.8, 0.5, Math.min(1, k * 1.7)); armL = armR; bodyRx = Math.sin(k * Math.PI) * 0.35; }
      else if (a.name === 'shake') { armR = -1.5; armL = -1.5; bodyRx = Math.sin(a.t * 30) * 0.08; }
      else if (a.name === 'pick') { bodyRx = Math.sin(k * Math.PI) * 0.6; armR = -0.8 * Math.sin(k * Math.PI); armL = armR; }
      else if (a.name === 'hop') { jump = Math.sin(k * Math.PI) * 0.32; squash = 1 + Math.sin(k * Math.PI) * 0.08; }
      else if (a.name === 'joy') { jump = Math.abs(Math.sin(k * Math.PI * 2)) * 0.26; armR = -2.8; armL = -2.8; }
      else if (a.name === 'show') { armR = -2.9; armL = -2.9; headRx = -0.2; a.t = Math.min(a.t, a.dur * 0.5); }
      else if (a.name === 'nod') { headRx = Math.sin(k * Math.PI * 2) * 0.28; }
      else if (a.name === 'no') { headRz = Math.sin(k * Math.PI * 3) * 0.3; }
      else if (a.name === 'surprise') { jump = Math.sin(Math.min(1, k * 2) * Math.PI) * 0.2; squash = 1 + Math.sin(Math.min(1, k * 2) * Math.PI) * 0.12; armR = -1.9; armL = -1.9; }
      else if (a.name === 'sad') { headRx = 0.4; bodyRx = 0.15; }
      else if (a.name === 'ouch') { bodyRx = Math.sin(a.t * 40) * 0.12; headRz = Math.sin(a.t * 30) * 0.2; }
      else if (a.name === 'wave') { armR = -2.6 + Math.sin(a.t * 14) * 0.4; }
      if (a.t >= a.dur && a.name !== 'holdrod' && a.name !== 'show' && a.name !== 'raise') this.anim = null;
    }

    if (this.billboard) {
      this.model.position.y = bob * 1.6 + jump;
      this.model.rotation.x = -0.42;
      this.model.rotation.z = moving ? s * 0.06 : 0;
      const sx = Math.sin(this.yaw) < -0.15 ? -1 : 1;
      this.billboard.scale.x = sx; this.billboard.scale.y = squash;
    } else {
      this.model.position.y = (this.model.userData.baseY || 0) + bob + jump;
      this.pivot.rotation.x = 0;
      if (P.head) {
        const R = this.rest;
        P.leg_L && (P.leg_L.rotation.x = s * 0.75 * amt); P.leg_R && (P.leg_R.rotation.x = -s * 0.75 * amt);
        if (P.arm_L) P.arm_L.rotation.x = armL != null ? armL : -s * 0.6 * amt;
        if (P.arm_R) P.arm_R.rotation.x = armR != null ? armR : (this.held && !moving ? -0.35 : s * 0.6 * amt);
        if (P.body) { P.body.rotation.x = lean + bodyRx; P.body.scale.y = (moving ? 1 : 1 + Math.sin(this.t * 2.2) * 0.012) * squash; }
        P.head.rotation.x = lean * 0.4 + bodyRx * 0.7 + headRx + (moving ? 0 : Math.sin(this.t * 1.3) * 0.02);
        P.head.rotation.z = headRz + (moving ? s * 0.03 : 0);
        P.head.position.z = R.head.z + (lean + bodyRx) * 0.42;
        if (P.arm_L) P.arm_L.position.z = R.arm_L.z + (lean + bodyRx) * 0.36;
        if (P.arm_R) P.arm_R.position.z = R.arm_R.z + (lean + bodyRx) * 0.36;
        if (P.tail) P.tail.rotation.y = Math.sin(this.t * (moving ? 9 : 3)) * (moving ? 0.35 : 0.18);
      } else {
        // 통짜 모델: 걸을 때 좌우로 뒤뚱거리고 통통 튄다
        this.model.rotation.z = moving ? s * 0.09 : 0;
        this.model.rotation.x = lean + bodyRx;
      }
    }
    if (this.emoteObj) {
      this.emoteT -= dt;
      const k = 1 - this.emoteT / this.emoteDur;
      const pop = Math.min(1, k * 8);
      this.emoteObj.scale.setScalar(pop * (1 + Math.sin(this.t * 6) * 0.04));
      this.emoteObj.position.y = this.topY + 0.42 + jump;
      if (this.emoteT <= 0) { this.root.remove(this.emoteObj); this.emoteObj = null; }
    }
  }
}
