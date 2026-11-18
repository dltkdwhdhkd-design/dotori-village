// 모델 불러오기 · 재질 변환 · "굽은 세계" 셰이더
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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

export function patchMaterial(m) {
  if (m.userData.curved) return m;
  m.userData.curved = true;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (shader, r) => {
    if (prev) prev(shader, r);
    shader.uniforms.uCurveZ = CURVE.z;
    shader.uniforms.uCurveK = CURVE.k;
    shader.vertexShader = 'uniform float uCurveZ;\nuniform float uCurveK;\n' +
      shader.vertexShader.replace('#include <project_vertex>', PROJECT);
  };
  const key = m.customProgramCacheKey ? m.customProgramCacheKey() : '';
  m.customProgramCacheKey = () => 'curved' + (m.userData.cacheKey || '');
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
    patchMaterial(m);
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
    patchMaterial(m);
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

function convert(root) {
  root.traverse((n) => {
    if (!n.isMesh) return;
    const src = n.material;
    const name = src.name || 'mat';
    n.frustumCulled = false;
    // 그림(텍스처)이나 꼭짓점 색을 쓰는 재질은 그대로 살린다(직접 만든 모델용)
    if (src.map || (n.geometry.attributes.color && src.vertexColors)) {
      const m = new THREE.MeshLambertMaterial({ map: src.map || null, color: src.color ? src.color.clone() : 0xffffff, vertexColors: !!src.vertexColors, transparent: src.transparent, alphaTest: src.alphaTest, side: src.side });
      m.name = name; m.userData.base = name;
      n.material = patchMaterial(m);
      return;
    }
    const m = sharedMat(name, src.color ? src.color.getHex() : 0xffffff);
    if (!m.userData.inited) { m.color.copy(src.color); m.side = src.side; m.userData.inited = true; }
    n.material = m;
    if (src.dispose) src.dispose();
  });
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
  convert(g.scene);
  for (const root of [...g.scene.children]) {
    root.position.set(0, 0, 0);
    MODELS[root.name] = root;
  }
  return g;
}

/** 캐릭터처럼 파일 하나에 모델 하나인 경우. */
export async function loadSingle(url, name) {
  const g = await loadGLB(url);
  convert(g.scene);
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
