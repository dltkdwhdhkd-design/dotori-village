// 아이템 그림(아이콘): 3D 모델을 작은 화면에 한 번 그려서 그림으로 만든다
import * as THREE from 'three';
import { make, has, CURVE } from './models.js';
import { ITEMS, FISH_BY_ID, BUG_BY_ID } from '../data/items.js';
import { defaultLook, dress, MODEL } from '../game/look.js';

const SIZE = 128;
let renderer = null, scene = null, cam = null, holder = null;
const cache = new Map();

function init() {
  const cv = document.createElement('canvas'); cv.width = cv.height = SIZE;
  renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false); renderer.setClearColor(0x000000, 0);
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8e8c0, 2.3));
  const sun = new THREE.DirectionalLight(0xfff2dc, 2.0); sun.position.set(-3, 6, 5); scene.add(sun);
  cam = new THREE.PerspectiveCamera(26, 1, 0.05, 100);
  holder = new THREE.Group(); scene.add(holder);
}

/** 모델 이름으로 그림을 만든다. view: 'front'(기본, 살짝 위에서) | 'side' | 'top' | 'profile'(곤충의 옆모습, 머리가 오른쪽)   yaw: 세운 축으로 돌려 놓고 그린다 */
export function thumbOfModel(model, opts = {}) {
  const key = model + '|' + JSON.stringify(opts.tint || {}) + '|' + (opts.view || '') + '|' + (opts.yaw || 0);
  if (cache.has(key)) return cache.get(key);
  if (!renderer) init();
  if (!has(model)) { cache.set(key, ''); return ''; }
  const o = make(model, { tint: opts.tint });
  if (o.userData.parts && o.userData.parts.snow) o.userData.parts.snow.visible = false;
  if (opts.yaw) o.rotation.y = opts.yaw;
  holder.add(o);
  const box = new THREE.Box3().setFromObject(o);
  const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
  const r = Math.max(s.x, s.y, s.z) * 0.5 + 0.02;
  const dist = r / Math.tan((26 * Math.PI) / 360) * 1.12;
  const v = opts.view || 'front';
  const dir = v === 'side' ? new THREE.Vector3(0.05, 0.22, 1) : v === 'top' ? new THREE.Vector3(0.15, 1, 0.55) : v === 'profile' ? new THREE.Vector3(-1, 0.34, 0.4) : new THREE.Vector3(0.45, 0.55, 1);
  dir.normalize();
  cam.position.copy(c).addScaledVector(dir, dist);
  cam.lookAt(c);
  const k = CURVE.k.value; CURVE.k.value = 0;
  renderer.render(scene, cam);
  CURVE.k.value = k;
  const url = renderer.domElement.toDataURL('image/png');
  holder.remove(o);
  cache.set(key, url);
  return url;
}

/** 넙치·가자미를 위에서 볼 때 등지느러미가 위로 오게 놓는 각도: 눈이 왼쪽에 몰린 넙치는 머리가 왼쪽, 오른쪽에 몰린 가자미는 머리가 오른쪽 */
export function flatYaw(look) { return look && look.f === 'flat' && (look.flat || 'L') === 'L' ? Math.PI : 0; }

let portrait;
export function featureThumb(feature,value) {
  const key = 'face:' + feature + ':' + value;
  if (cache.has(key)) return cache.get(key);
  if (!has(MODEL)) return '';
  if (!renderer) init();
  const o = portrait ||= make(MODEL), parts = o.userData.parts;
  dress({ model: o, parts }, { ...defaultLook(),hat:0,hair:9,[feature]:value });
  if (parts.mouth_open) parts.mouth_open.visible = false;
  holder.add(o);
  if (feature==='hair' || feature==='face') {
    cam.position.set(.32,1.31,2.12);cam.lookAt(0,1.11,0);
  } else {
    const y=['cheek','mouth','nose'].includes(feature)?1.01:1.10;
    cam.position.set(0,y+.02,1.64);cam.lookAt(0,y,0);
  }
  const curve = CURVE.k.value;
  try {
    CURVE.k.value = 0;
    renderer.render(scene, cam);
    const url = renderer.domElement.toDataURL('image/png');
    cache.set(key, url);
    return url;
  } finally { CURVE.k.value = curve; holder.remove(o); }
}

export function thumb(id) {
  const it = ITEMS[id];
  if (!it) return '';
  const sp = it.sp && FISH_BY_ID[it.sp];
  const view = it.kind === 'fish' || (it.kind === 'misc' && it.sp) ? (sp && sp.look.view === 'top' ? 'top' : 'side') : it.kind === 'bug' ? (BUG_BY_ID[it.sp] && BUG_BY_ID[it.sp].look.view === 'side' ? 'profile' : 'top') : it.kind === 'shell' ? 'top' : 'front';
  return thumbOfModel(it.model, { tint: it.tint, view, yaw: sp ? flatYaw(sp.look) : 0 });
}
