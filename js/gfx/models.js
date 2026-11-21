// 모델 불러오기 · 재질 변환 · "굽은 세계" 셰이더
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// 멀리 있는 땅이 아래로 굽어 내려가 보이게 하는 값(모든 재질이 함께 쓴다)
export const CURVE = { z: { value: 0 }, k: { value: 0 } };

const PROJECT = `
vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
vec4 cwPos = modelMatrix * mvPosition;
float cwD = cwPos.z - uCurveZ;
cwPos.y -= cwD * cwD * uCurveK;
mvPosition = viewMatrix * cwPos;
gl_Position = projectionMatrix * mvPosition;
`;

// 모든 재질이 함께 쓰는 값: 시간(풀이 흔들림), 윤곽 빛
export const FX = { time: { value: 0 }, rim: { value: 0.3 }, rimColor: { value: new THREE.Color(1, 0.97, 0.88) } };

// 풀포기가 바람에 살랑이게(위쪽일수록 많이)
const SWAY = `
#ifdef USE_INSTANCING
	float swPh = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 1.3;
	float swK = max(0.0, transformed.y);
	transformed.x += sin(uTime * 1.9 + swPh) * 0.16 * swK;
	transformed.z += cos(uTime * 1.3 + swPh * 0.7) * 0.08 * swK;
#endif
`;
// 가장자리에 살짝 도는 빛(봉제 인형 같은 부드러운 느낌)
const RIM = `
{
	float rimF = 1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0);
	outgoingLight += uRimColor * (uRim * rimF * rimF * rimF) * (0.3 + 0.7 * diffuseColor.rgb);
}
`;

/** 재질에 '굽은 세계'를 넣는다. fx: { rim: 윤곽 빛, sway: 바람에 흔들림 } */
export function patchMaterial(m, fx = null) {
  if (m.userData.curved) return m;
  m.userData.curved = true;
  fx = fx || {};
  const rim = !!fx.rim && !!m.isMeshLambertMaterial, sway = !!fx.sway;
  m.userData.fx = { rim, sway };
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (shader, r) => {
    if (prev) prev(shader, r);
    shader.uniforms.uCurveZ = CURVE.z;
    shader.uniforms.uCurveK = CURVE.k;
    let vs = shader.vertexShader.replace('#include <project_vertex>', PROJECT), head = 'uniform float uCurveZ;\nuniform float uCurveK;\n';
    if (sway) { shader.uniforms.uTime = FX.time; head += 'uniform float uTime;\n'; vs = vs.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + SWAY); }
    shader.vertexShader = head + vs;
    if (rim) {
      shader.uniforms.uRim = FX.rim; shader.uniforms.uRimColor = FX.rimColor;
      shader.fragmentShader = 'uniform float uRim;\nuniform vec3 uRimColor;\n' + shader.fragmentShader.replace('#include <opaque_fragment>', RIM + '#include <opaque_fragment>');
    }
  };
  m.customProgramCacheKey = () => 'curved' + (rim ? 'R' : '') + (sway ? 'S' : '') + (m.userData.cacheKey || '');
  return m;
}

// ---------------------------------------------------------------- 재질
const MATS = new Map();      // 이름 -> 공용 재질
const TINTS = new Map();     // 이름#색 -> 색만 바꾼 재질

export function sharedMat(name, color) {
  let m = MATS.get(name);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color: color ?? 0xffffff });
    m.name = name;
    m.userData.base = name;
    patchMaterial(m, { rim: true, sway: name.startsWith('tuft') });
    MATS.set(name, m);
  }
  return m;
}

export function tinted(name, color) {
  const c = new THREE.Color(color);
  const key = name + '#' + c.getHexString();
  let m = TINTS.get(key);
  if (!m) {
    const src = sharedMat(name);
    m = src.clone();
    m.userData = { base: name, tint: true };
    m.color.copy(c);
    m.onBeforeCompile = null;
    m.customProgramCacheKey = THREE.Material.prototype.customProgramCacheKey;
    patchMaterial(m, src.userData.fx);
    TINTS.set(key, m);
  }
  return m;
}

export function setMatColor(name, color) {
  const m = MATS.get(name);
  if (m) m.color.set(color);
}
export function getMat(name) { return MATS.get(name); }
export function allMats() { return MATS; }

// 게임 도중 색이나 빛이 바뀌는 재질(계절 잎, 집주인마다 다른 지붕·벽·문, 밤에 켜지는 창). 이것들은 따로 둔다.
const DYNAMIC = new Set(['leaf', 'leaf_d', 'leaf_l', 'bloom', 'bloom_d', 'bloom_l', 'pine', 'pine_d', 'pine_l', 'big', 'big_d', 'big_l', 'weed', 'tuft', 'tuft_l',
  'roof', 'roof_d', 'wall', 'wall_d', 'door', 'door_d', 'petal', 'roll', 'window', 'lampglass', 'c_eaff8a', 'c_1a2a44', 'missing',
  'p_skin', 'p_nose', 'p_hair', 'p_eye', 'p_top', 'p_top2', 'p_bot', 'p_shoe', 'p_hat', 'p_hat2']);      // p_*: 꾸미는 주인공(look.js)
let VCOL = null;
/** 색이 고정된 면들을 한 덩어리로 그릴 때 쓰는 재질(색은 꼭짓점에 들어 있다) */
export function vcolMat() {
  if (!VCOL) { VCOL = new THREE.MeshLambertMaterial({ vertexColors: true }); VCOL.name = 'vcol'; VCOL.userData.base = 'vcol'; patchMaterial(VCOL, { rim: true }); }
  return VCOL;
}

/**
 * 한 부위가 여러 색(재질)으로 나뉘어 있으면 그만큼 따로 그려야 해서 느리다.
 * 색이 바뀌지 않는 조각들은 꼭짓점 색으로 구워 한 덩어리로 합친다(그리는 횟수가 크게 준다).
 */
function mergeStatic(root, assoc) {
  const groups = [];
  root.traverse((n) => { if (n.children.length > 1) groups.push(n); });
  for (const g of groups) {
    // glTF에서 재질이 여럿인 메시는 '조각 메시'들을 자식으로 가진 묶음으로 들어온다. 부위(노드)가 아닌 조각만 고른다.
    const prims = g.children.filter((c) => {
      if (!c.isMesh || c.children.length) return false;
      const a = assoc && assoc.get(c);
      if (!a || a.nodes !== undefined) return false;
      const m = c.material;
      return m && !m.map && !m.vertexColors && !DYNAMIC.has(m.name) && !m.name.startsWith('p_blush') && c.geometry.attributes.normal;
    });
    if (prims.length < 2) continue;
    const geos = prims.map((c) => {
      const src = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', src.attributes.position);
      geo.setAttribute('normal', src.attributes.normal);
      const n = src.attributes.position.count, col = new Float32Array(n * 3), k = c.material.color;
      for (let i = 0; i < n; i++) { col[i * 3] = k.r; col[i * 3 + 1] = k.g; col[i * 3 + 2] = k.b; }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return geo;
    });
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, vcolMat());
    mesh.name = g.name + '_m';
    mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = true;
    for (const c of prims) { g.remove(c); c.geometry.dispose(); }
    g.add(mesh);
  }
}

function convert(root, assoc) {
  root.traverse((n) => {
    if (!n.isMesh) return;
    const src = n.material;
    const name = src.name || 'mat';
    n.frustumCulled = false;
    n.castShadow = true; n.receiveShadow = true;
    // 그림(텍스처)이나 꼭짓점 색을 쓰는 재질은 그대로 살린다(직접 만든 모델용)
    if (src.map || (n.geometry.attributes.color && src.vertexColors)) {
      const m = new THREE.MeshLambertMaterial({ map: src.map || null, color: src.color ? src.color.clone() : 0xffffff, vertexColors: !!src.vertexColors, transparent: src.transparent, alphaTest: src.alphaTest, side: src.side });
      m.name = name; m.userData.base = name;
      if (m.transparent) { m.depthWrite = false; n.castShadow = false; n.renderOrder = 2; }   // 비치는 날개
      n.material = patchMaterial(m, { rim: true });
      return;
    }
    const m = sharedMat(name, src.color ? src.color.getHex() : 0xffffff);
    if (!m.userData.inited) { m.color.copy(src.color); m.side = src.side; m.userData.inited = true; }
    n.material = m;
    if (src.dispose) src.dispose();
  });
  mergeStatic(root, assoc);
}

// ---------------------------------------------------------------- 불러오기
export const MODELS = {};
const loader = new GLTFLoader();

export function loadGLB(url) {
  return new Promise((res, rej) => loader.load(url, (g) => res(g), undefined, (e) => rej(e)));
}

/** 여러 모델이 든 묶음 파일을 불러와 이름별로 등록한다. */
export async function loadBundle(url) {
  const g = await loadGLB(url);
  convert(g.scene, g.parser.associations);
  for (const root of [...g.scene.children]) {
    root.position.set(0, 0, 0);
    MODELS[root.name] = root;
  }
  return g;
}

/** 캐릭터처럼 파일 하나에 모델 하나인 경우. */
export async function loadSingle(url, name) {
  const g = await loadGLB(url);
  convert(g.scene, g.parser.associations);
  const root = g.scene.children.length === 1 ? g.scene.children[0] : g.scene;
  root.position.set(0, 0, 0);
  root.name = name;
  MODELS[name] = root;
  return root;
}

function indexParts(o) {
  const parts = {};
  o.traverse((n) => {
    const i = n.name.indexOf('__');
    if (i > 0 && n !== o) { const k = n.name.slice(i + 2); if (!(k in parts)) parts[k] = n; }
  });
  if (parts.blade && parts.sword) parts.blade.visible = false;
  o.userData.parts = parts;
  return o;
}

/** 등록된 모델의 복제본을 만든다. tint: { 재질이름: 색 } */
export function make(name, opts = {}) {
  const src = MODELS[name];
  if (!src) {
    const ph = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), sharedMat('missing', 0xff66cc));
    ph.position.y = 0.2;
    const g = new THREE.Group(); g.add(ph); g.userData.parts = {}; g.userData.missing = name;
    return g;
  }
  const o = src.clone(true);
  if (opts.tint) {
    o.traverse((n) => {
      if (!n.isMesh) return;
      const t = opts.tint[n.material.userData.base];
      if (t !== undefined) n.material = tinted(n.material.userData.base, t);
    });
  }
  return indexParts(o);
}

export function has(name) { return !!MODELS[name]; }
