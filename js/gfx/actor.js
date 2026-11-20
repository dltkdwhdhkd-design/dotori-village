// 캐릭터 한 명을 화면에 세우고 움직인다.
// 모델에 body/head/arm_L/arm_R/leg_L/leg_R/tail 부위가 있으면 걷기·휘두르기를 부위별로,
// 없으면(직접 바꿔 넣은 통짜 모델이나 그림 한 장) 몸 전체를 통통 튀게 해서 표현한다.
import * as THREE from 'three';
import { make, has, patchMaterial } from './models.js';
import { makeBlobShadow } from './stage.js';
import { lerp, TAU } from '../core/util.js';

const TARGET_H = 1.42;
const D = Math.PI / 180;

// ---------------------------------------------------------------- 도구를 쥔 자세
// 자세 하나는 아래 값들로 이루어진다(각은 모두 도).
//   a = 오른팔을 앞으로 든 각            b = 도구가 가리키는 방향(0 아래 · 90 앞 · 180 위 · 그보다 크면 등 뒤로 넘어감)
//   s = 오른팔을 옆으로 벌린 각          t = 도구를 바깥쪽으로 기울인 각
//   l = 왼팔을 앞으로 든 각(두 손으로 쥔 느낌)
//   g = 자루의 어디를 쥐는지(0 = 자루 끝, 클수록 날 쪽)
//   y = 도구를 옆으로 돌린 각(0 = 정면, 음수 = 오른쪽 뒤)   r = 자루를 축으로 돌린 각(도끼날이 휘두르는 쪽을 보게)
//   w = 몸을 비튼 각(음수 = 오른쪽으로)
const P = (a, b, o = {}) => ({ a: a * D, b: b * D, s: (o.s ?? 10) * D, t: (o.t || 0) * D, l: (o.l || 0) * D, g: o.g || 0, y: (o.y || 0) * D, r: (o.r || 0) * D, w: (o.w || 0) * D });
// 동작은 [진행도 0~1, 자세, 'in'(점점 빠르게)] 목록. 사이는 부드럽게 잇는다.
// 도구마다 몸짓이 다르다: 잠자리채는 머리 위에서 내려찍고, 삽은 두 손으로 땅에 꽂아 퍼 올리고, 도끼는 옆으로 휘두른다.
const TOOL = {
  net: {
    scale: 0.92,
    idle: P(30, 174, { s: 20, t: 26 }),
    raise: P(118, 222, { s: 36, t: 4, l: 34, w: -8 }),
    swing: [[0, P(118, 222, { s: 36, t: 4, l: 34, w: -8 })], [0.16, P(130, 238, { s: 38, t: 2, l: 38, w: -16 })], [0.42, P(58, 79, { s: 6, l: 46, w: 8 }), 'in'], [0.5, P(54, 73, { s: 6, l: 46, w: 8 })], [0.62, P(56, 79, { s: 6, l: 46, w: 6 })], [1, P(56, 79, { s: 6, l: 44, w: 4 })]],
  },
  shovel: {
    scale: 0.86,
    idle: P(50, 2, { s: 14, t: 14, g: 0.6 }),                                // 날을 땅에 짚고 지팡이처럼 든다
    dig: [[0, P(84, 6, { s: 8, l: 76, g: 0.55 })], [0.14, P(104, 2, { s: 10, l: 96, g: 0.55 })], [0.34, P(40, 14, { s: 6, l: 40, g: 0.55 }), 'in'], [0.52, P(38, 16, { s: 6, l: 38, g: 0.55 })], [0.78, P(64, 60, { s: 8, l: 60, g: 0.5 })], [1, P(56, 30, { s: 10, l: 30, g: 0.55 })]],
  },
  axe: {
    scale: 0.9,
    idle: P(30, 172, { s: 20, t: 24 }),
    swing: [[0, P(40, 100, { s: 62, l: 20, y: -118, r: 90, w: -34 })], [0.14, P(38, 104, { s: 66, l: 18, y: -128, r: 90, w: -40 })], [0.42, P(72, 96, { s: 6, l: 60, y: 18, r: 90, w: 28 }), 'in'], [0.56, P(70, 96, { s: 8, l: 58, y: 4, r: 90, w: 18 })], [1, P(70, 98, { s: 8, l: 56, y: 10, r: 90, w: 20 })]],
  },
  rod: {
    scale: 0.95,
    idle: P(40, 148, { s: 10, t: 8 }),
    cast: [[0, P(126, 232, { s: 28, l: 30, w: -14 })], [0.6, P(72, 126, { s: 8, l: 30, w: 8 }), 'in'], [1, P(68, 122, { s: 8, l: 24 })]],
    holdrod: P(66, 122, { s: 6, l: 26 }),
    pull: [[0, P(66, 122, { s: 6, l: 26 })], [0.45, P(110, 198, { s: 24, l: 50, w: -8 }), 'in'], [1, P(106, 190, { s: 24, l: 50, w: -6 })]],
  },
  can: {
    scale: 1,
    idle: P(38, 180, { s: 10 }),
    pour: [[0, P(38, 180, { s: 10 })], [0.25, P(68, 124, { s: 8, l: 36 })], [0.82, P(68, 120, { s: 8, l: 36 })], [1, P(46, 172, { s: 10 })]],
  },
};
const POSE_KEYS = ['a', 'b', 's', 't', 'l', 'g', 'y', 'r', 'w'];
function keyPose(list, k, out) {
  let i = 1;
  while (i < list.length - 1 && k > list[i][0]) i++;
  const A = list[i - 1], B = list[i];
  let u = B[0] > A[0] ? Math.min(1, Math.max(0, (k - A[0]) / (B[0] - A[0]))) : 1;
  u = B[2] === 'in' ? u * u : u * u * (3 - 2 * u);
  for (const f of POSE_KEYS) out[f] = A[1][f] + (B[1][f] - A[1][f]) * u;
  return out;
}
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _e = new THREE.Euler(), _Z = new THREE.Vector3(0, 0, 1), _Y = new THREE.Vector3(0, 1, 0);
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
    this.anim = null; this.held = null; this.grip = null; this.style = null; this.emoteObj = null; this.emoteT = 0;
    this.sneak = false; this.sit = false;
    this.cur = null; this._tp = {};            // 도구 자세(지금 값 / 목표 값)
    this.blinkT = 1 + Math.random() * 4; this.talkT = 0;
    this.setModel(id);
  }

  setModel(id) {
    if (this.model) this.model.parent.remove(this.model);
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
      this.shadow.layers.set(0);               // 그림 캐릭터는 해 그림자가 없으니 둥근 그림자를 늘 보인다
      return;
    }
    this.shadow.layers.set(1);
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
    if (this.parts.mouth_open) this.parts.mouth_open.visible = false;
    this.topY = this.parts.top ? this.parts.top.position.y : TARGET_H + 0.1;
  }

  setPos(x, y, z) { this.root.position.set(x, y, z); }
  get x() { return this.root.position.x; }
  get z() { return this.root.position.z; }
  face(yaw, snap = false) { this.targetYaw = yaw; if (snap) this.yaw = yaw; }
  faceTo(x, z, snap = false) { this.face(Math.atan2(x - this.x, z - this.z), snap); }

  play(name, dur = 0.45) { this.anim = { name, t: 0, dur }; }
  playing(name) { return this.anim && (!name || this.anim.name === name); }

  /** 손에 물건을 쥔다. 도구(tool_net 등)는 종류에 맞는 자세로 든다. */
  hold(model, tint) {
    if (this.grip) { this.grip.parent.remove(this.grip); this.grip = null; this.held = null; }
    this.style = null; this.cur = null;
    if (!model) return;
    this.held = make(model, tint ? { tint } : {});
    this.grip = new THREE.Group();
    this.grip.add(this.held);
    const hand = this.parts.hand;
    if (hand) {
      hand.add(this.grip);
      const st = model.replace('tool_', '');
      this.style = TOOL[st] ? st : 'net';
      this.cur = { ...TOOL[this.style].idle };
      this.held.scale.setScalar(TOOL[this.style].scale || 1);
    } else {                                   // 손 위치가 없는 모델(직접 바꾼 모델·그림): 몸 옆에 세워 든다
      this.grip.position.set(-0.42, 0.45, 0.12);
      this.pivot.add(this.grip);
    }
  }

  /** 말하는 동안 입을 움직인다(대화창이 글자를 찍을 때마다 부른다) */
  talk(sec = 0.18) { this.talkT = sec; }

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
    let bob = moving ? Math.abs(s) * (this.sneak ? 0.02 : 0.05) : Math.sin(this.t * 2.2) * 0.006;
    let lean = moving ? (sp > 1.2 ? 0.17 : 0.06) : 0, bodyRx = 0, jump = 0, squash = 1, headRx = 0, headRz = 0;
    // 팔: x=앞뒤로 흔드는 각(음수가 앞), z=옆으로 벌린 각
    let rxR = s * 0.62 * amt, rxL = -s * 0.62 * amt, rzR = 0, rzL = 0, armsSet = false;
    const both = (x, z = 0) => { rxR = rxL = x; rzR = rzL = z; armsSet = true; };

    const a = this.anim;
    const tool = this.cur ? TOOL[this.style] : null;
    let tp = tool ? tool.idle : null, hard = false, k = 0;
    if (a) {
      a.t += dt;
      k = Math.min(1, a.t / a.dur);
      const def = tool && tool[a.name];
      if (def) { tp = Array.isArray(def) ? keyPose(def, k, this._tp) : def; hard = true; }
      const sty = def ? this.style : null;
      if (a.name === 'swing' && sty === 'axe') { bodyRx = 0.1 + Math.sin(Math.min(1, k * 2.2) * Math.PI) * 0.08; if (k > 0.4 && k < 0.6) squash = 1 - Math.sin((k - 0.4) * 5 * Math.PI) * 0.04; }
      else if (a.name === 'swing') {           // 잠자리채: 뒤로 젖혔다가 폴짝 내려찍는다
        bodyRx = k < 0.2 ? -0.16 * (k / 0.2) : k < 0.42 ? lerp(-0.16, 0.34, (k - 0.2) / 0.22) : lerp(0.34, 0.22, Math.min(1, (k - 0.42) / 0.3));
        jump = k > 0.14 && k < 0.44 ? Math.sin((k - 0.14) / 0.3 * Math.PI) * 0.12 : 0;
        if (k > 0.42 && k < 0.62) squash = 1 - Math.sin((k - 0.42) * 5 * Math.PI) * 0.07;
        if (!def) { rxR = lerp(-2.4, 0.3, Math.min(1, k * 2)); rzR = 0.4; armsSet = true; }
      }
      else if (a.name === 'raise') { bodyRx = -0.06; if (!def) { rxR = -2.3; rzR = 0.5; armsSet = true; } }
      else if (a.name === 'cast') { bodyRx = Math.sin(k * Math.PI) * 0.15; if (!def) { rxR = lerp(-2.4, -0.9, k); rzR = 0.4; armsSet = true; } }
      else if (a.name === 'holdrod') { a.t = 0; bodyRx = 0.04; if (!def) { rxR = -0.9; armsSet = true; } }
      else if (a.name === 'pull') { bodyRx = -0.22 * Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5); if (!def) { rxR = lerp(-0.9, -2.3, k); rzR = 0.4; armsSet = true; } }
      else if (a.name === 'dig') {             // 삽: 들어 올렸다가 몸을 숙여 꽂고, 젖히며 퍼 올린다
        bodyRx = k < 0.12 ? -0.05 : k < 0.34 ? lerp(-0.05, 0.42, (k - 0.12) / 0.22) : k < 0.52 ? 0.42 : lerp(0.42, -0.06, Math.min(1, (k - 0.52) / 0.3));
        jump = k > 0.3 && k < 0.56 ? -0.05 * Math.sin((k - 0.3) / 0.26 * Math.PI) : 0;
        if (k > 0.3 && k < 0.5) squash = 1 - Math.sin((k - 0.3) * 5 * Math.PI) * 0.06;
        if (!def) both(lerp(-1.8, 0.2, Math.min(1, k * 1.7)));
      }
      else if (a.name === 'pour') { bodyRx = Math.sin(k * Math.PI) * 0.12; if (!def) both(-0.9); }
      else if (a.name === 'shake') { both(-1.5, 0.1); bodyRx = Math.sin(a.t * 30) * 0.08; }
      else if (a.name === 'pick') { bodyRx = Math.sin(k * Math.PI) * 0.6; both(-0.8 * Math.sin(k * Math.PI)); }
      else if (a.name === 'hop') { jump = Math.sin(k * Math.PI) * 0.32; squash = 1 + Math.sin(k * Math.PI) * 0.08; }
      else if (a.name === 'joy') { jump = Math.abs(Math.sin(k * Math.PI * 2)) * 0.26; both(-2.7, 0.7); }
      else if (a.name === 'show') { both(-2.75, 0.62); headRx = -0.16; a.t = Math.min(a.t, a.dur * 0.5); }
      else if (a.name === 'nod') { headRx = Math.sin(k * Math.PI * 2) * 0.28; }
      else if (a.name === 'no') { headRz = Math.sin(k * Math.PI * 3) * 0.3; }
      else if (a.name === 'surprise') { jump = Math.sin(Math.min(1, k * 2) * Math.PI) * 0.2; squash = 1 + Math.sin(Math.min(1, k * 2) * Math.PI) * 0.12; both(-1.9, 0.55); }
      else if (a.name === 'sad') { headRx = 0.4; bodyRx = 0.15; }
      else if (a.name === 'ouch') { bodyRx = Math.sin(a.t * 40) * 0.12; headRz = Math.sin(a.t * 30) * 0.2; }
      else if (a.name === 'wave') { rxR = -2.5; rzR = 0.75 + Math.sin(a.t * 14) * 0.3; armsSet = true; }
      if (a.t >= a.dur && a.name !== 'holdrod' && a.name !== 'show' && a.name !== 'raise') this.anim = null;
    }

    // 도구를 쥔 팔: 목표 자세로 부드럽게(휘두르는 동안은 바로) 따라간다
    const c = this.cur;
    if (c && tp) {
      const r = Math.min(1, dt * (hard ? 36 : 11));
      for (const f of POSE_KEYS) c[f] += (tp[f] - c[f]) * r;
      if (!armsSet || hard) {
        const sway = moving && !hard ? s * 0.07 : 0;
        rxR = -(c.a + sway); rzR = c.s;
        if (c.l > 0.02) { const w = Math.min(1, c.l / 0.35); rxL = lerp(rxL, -c.l, w); rzL = 0.06 * w; }
      }
    }
    if (this.held) this.held.visible = !(a && a.name === 'show');

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
        const R = this.rest, tilt = lean + bodyRx;
        const sway = moving ? s * (sp > 1.2 ? 0.05 : 0.07) : 0;          // 걸을 때 좌우로 뒤뚱
        P.leg_L && (P.leg_L.rotation.x = s * 0.78 * amt); P.leg_R && (P.leg_R.rotation.x = -s * 0.78 * amt);
        if (P.arm_L) P.arm_L.rotation.set(rxL, 0, rzL);
        if (P.arm_R) P.arm_R.rotation.set(rxR, 0, -rzR);
        if (P.body) { P.body.rotation.x = tilt; P.body.rotation.z = sway; P.body.scale.y = (moving ? 1 : 1 + Math.sin(this.t * 2.2) * 0.012) * squash; }
        const hb = R.body ? R.body.y : 0.25, fwd = Math.sin(tilt);
        const talking = this.talkT > 0;
        P.head.rotation.x = tilt * 0.4 + headRx + (moving ? 0 : Math.sin(this.t * 1.3) * 0.02) + (talking && !P.mouth_open ? Math.sin(this.t * 17) * 0.035 : 0);
        P.head.rotation.z = headRz + sway * 0.6 + (moving ? 0 : Math.sin(this.t * 0.7) * 0.015);
        P.head.position.z = R.head.z + fwd * (R.head.y - hb);
        P.head.position.x = R.head.x - sway * 0.3;
        if (P.arm_L) P.arm_L.position.z = R.arm_L.z + fwd * (R.arm_L.y - hb);
        if (P.arm_R) P.arm_R.position.z = R.arm_R.z + fwd * (R.arm_R.y - hb);
        if (P.tail) P.tail.rotation.y = Math.sin(this.t * (moving ? 9 : 3)) * (moving ? 0.35 : 0.18);
        // 눈 깜박임, 말할 때 입
        if (P.eyes) {
          this.blinkT -= dt;
          if (this.blinkT < 0) this.blinkT = 2.4 + Math.random() * 3.6;
          // 닫을 때는 빠르게, 다시 뜰 때는 조금 천천히.
          const lid = this.blinkT > .105 ? (.17 - this.blinkT) / .065 : this.blinkT / .105;
          P.eyes.scale.y = 1 - .90 * Math.max(0, Math.min(1, lid));
        }
        if (talking) this.talkT -= dt;
        if (P.mouth_open) {
          P.mouth_open.visible = talking; if (P.mouth) P.mouth.visible = !talking;
          if (talking) P.mouth_open.scale.y = 0.4 + Math.abs(Math.sin(this.t * 17)) * 0.8;
        }
        // 쥔 도구의 방향: 팔이 어떻게 돌든 몸 기준으로 정한 각(b, t)을 가리키게 한다
        if (this.grip && c && P.arm_R) {
          _q1.setFromEuler(_e.set(Math.PI - c.b, 0, 0));
          _q2.setFromAxisAngle(_Z, c.t);
          _q3.setFromAxisAngle(_Y, c.y);
          this.grip.quaternion.copy(P.arm_R.quaternion).invert().multiply(_q3).multiply(_q2).multiply(_q1);
          if (c.r) this.grip.quaternion.multiply(_q3.setFromAxisAngle(_Y, c.r));      // 자루를 축으로(날의 방향)
          this.held.position.y = -c.g * this.held.scale.y;                             // 자루의 어디를 쥐는지
        }
        this.model.rotation.y = c ? c.w : 0;                                           // 몸 비틀기
      } else {
        // 통짜 모델: 걸을 때 좌우로 뒤뚱거리고 통통 튄다
        this.model.rotation.z = moving ? s * 0.09 : 0;
        this.model.rotation.x = lean + bodyRx;
      }
    }
    if (this.emoteObj) {
      this.emoteT -= dt;
      const k2 = 1 - this.emoteT / this.emoteDur;
      const pop = Math.min(1, k2 * 8);
      this.emoteObj.scale.setScalar(pop * (1 + Math.sin(this.t * 6) * 0.04));
      this.emoteObj.position.y = this.topY + 0.42 + jump;
      if (this.emoteT <= 0) { this.root.remove(this.emoteObj); this.emoteObj = null; }
    }
  }
}
