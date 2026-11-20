// 주인공 꾸미기: 무엇을 고를 수 있는지(표)와, 고른 모습을 캐릭터 모델에 입히는 일.
//
// 모습 하나는 숫자 묶음이다(저장의 S.player.look, 같이 하기에서 주고받는 것도 이것).
//   { skin, hair, hairc, eyes, eyec, mouth, cheek, outfit, top, bot, shoe, hat, hatc, glass }
//   - hair, eyes, mouth, outfit 은 1부터(모델의 부위 이름 hair1, eyes1 … 과 같다)
//   - hat, glass, cheek 는 0이 '없음'
//   - skin, hairc, eyec, top, bot, shoe, hatc 는 아래 색 표의 번호(0부터)
// 모델은 assets/chars/player_custom.glb (tools/blender/chars.py 의 custom()). 부위를 더했으면 여기 표에 한 줄 넣는다.
import * as THREE from 'three';
import { tinted } from '../gfx/models.js';

export const MODEL = 'player_custom';

export const SKIN = ['#ffe6d2', '#ffdcc0', '#f5cba8', '#e8b890', '#cf9c78', '#b07c58', '#8c5c42'];
export const HAIRC = ['#2e2a36', '#4a3324', '#6a4530', '#b8682e', '#e8c060', '#c8503c', '#f08aa8', '#8a6fd0', '#4a8fd8', '#5fae62', '#e9e7ee'];
export const EYEC = ['#3b2b28', '#6a4526', '#2f4f8f', '#2f6a44', '#6a3f8a', '#55555e'];
export const CLOTH = ['#e8574c', '#f08a3c', '#ffd04a', '#6fb86a', '#3fa39a', '#4a90d9', '#40598f', '#8a6fd0', '#f08aa8', '#fff3d6', '#9aa0aa', '#3a3a44', '#7a6a52'];
export const SHOE = ['#8a5a3a', '#e8574c', '#f7f7f2', '#3a3a44', '#4a90d9', '#ffd04a'];

export const HAIR = ['단발', '삐죽 머리', '양 갈래', '짧은 머리', '긴 머리', '곱슬머리', '올림머리', '묶은 머리', '아주 짧은 머리', '옆가르마', '양 갈래 땋기', '웨이브 단발'];
export const FACE = [
  { ko: '기본형', width: 1, height: 1 }, { ko: '동그란 얼굴', width: 1.095, height: .94 },
  { ko: '갸름한 얼굴', width: .93, height: 1.055 },
];
export const BROW = ['부드러운 곡선', '처진 눈썹', '일자 눈썹'];
export const NOSE = ['삼각 코', '동그란 코', '작은 코'];
export const EYES = ['또렷한 눈', '동그란 눈', '콩알 눈', '졸린 눈', '웃는 눈', '속눈썹', '놀란 눈'];
export const MOUTH = ['미소', '고양이 입', '일자 입', '오므린 입', '활짝 웃음'];
export const CHEEK = ['없음', '발그레', '주근깨', '둘 다'];
// sl: 소매(sls 짧은 · sll 긴)   leg: pants 긴 바지 · shorts 반바지와 양말 · sock 맨다리와 양말
export const OUTFIT = [
  { ko: '반소매 티', sl: 'sls', leg: 'pants' }, { ko: '후드티', sl: 'sll', leg: 'pants' }, { ko: '원피스', sl: 'sls', leg: 'sock' },
  { ko: '멜빵바지', sl: 'sls', leg: 'pants' }, { ko: '줄무늬 옷', sl: 'sll', leg: 'shorts' }, { ko: '저고리와 치마', sl: 'sll', leg: 'sock' },
];
// cover: 'top' 머리 꼭대기에 얹는 모자(윗머리 hairtop 을 숨긴다) · 'dome' 푹 눌러쓰는 모자(앞머리 hairfr 도 숨긴다)   color: 모자 색을 고를 수 있다
export const HAT = [
  { ko: '없음' }, { ko: '도토리 모자', cover: 'top' }, { ko: '챙 모자', cover: 'dome', color: true }, { ko: '밀짚모자', cover: 'dome', color: true },
  { ko: '털모자', cover: 'dome', color: true }, { ko: '리본', color: true }, { ko: '꽃 머리핀', color: true }, { ko: '머리띠', color: true },
];
export const GLASS = ['없음', '동그란 안경', '네모 안경', '색안경'];

/** 처음 고를 수 있는 본보기 네 가지 */
export const PRESETS = [
  { skin: 1, hair: 1, hairc: 2, eyes: 1, eyec: 0, mouth: 1, cheek: 1, outfit: 1, top: 0, bot: 6, shoe: 0, hat: 1, hatc: 3, glass: 0 },
  { skin: 2, hair: 2, hairc: 0, eyes: 1, eyec: 0, mouth: 1, cheek: 1, outfit: 2, top: 5, bot: 12, shoe: 2, hat: 0, hatc: 0, glass: 0 },
  { skin: 1, hair: 3, hairc: 3, eyes: 6, eyec: 1, mouth: 1, cheek: 1, outfit: 3, top: 2, bot: 3, shoe: 1, hat: 0, hatc: 8, glass: 0 },
  { skin: 3, hair: 4, hairc: 1, eyes: 2, eyec: 0, mouth: 5, cheek: 1, outfit: 4, top: 9, bot: 5, shoe: 0, hat: 2, hatc: 3, glass: 0 },
];
export const defaultLook = () => ({ ...PRESETS[0], face: 0, brow: 0, nose: 0 });

const LIMIT = { skin: [0, SKIN.length - 1], hair: [1, HAIR.length], hairc: [0, HAIRC.length - 1], eyes: [1, EYES.length], eyec: [0, EYEC.length - 1], mouth: [1, MOUTH.length],
  cheek: [0, CHEEK.length - 1], outfit: [1, OUTFIT.length], top: [0, CLOTH.length - 1], bot: [0, CLOTH.length - 1], shoe: [0, SHOE.length - 1], hat: [0, HAT.length - 1], hatc: [0, CLOTH.length - 1], glass: [0, GLASS.length - 1],
  // 새 필드는 뒤에 붙여 예전 같이 하기 코드의 순서를 유지한다.
  face: [0, FACE.length - 1], brow: [0, BROW.length - 1], nose: [0, NOSE.length - 1] };
export const LOOK_KEYS = Object.keys(LIMIT);

/** 빠졌거나 범위를 벗어난 값을 기본값으로 채운다(예전 저장, 다른 사람이 보낸 값) */
export function cleanLook(look) {
  const d = defaultLook(), o = {};
  for (const k of LOOK_KEYS) {
    const v = look && Number.isInteger(look[k]) ? look[k] : d[k], [a, b] = LIMIT[k];
    o[k] = v < a || v > b ? d[k] : v;
  }
  return o;
}
export function randomLook(rand = Math.random) {
  const o = {};
  for (const k of LOOK_KEYS) { const [a, b] = LIMIT[k]; o[k] = a + Math.floor(rand() * (b - a + 1)); }
  if (rand() < 0.45) o.hat = 0;
  if (rand() < 0.7) o.glass = 0;
  if (rand() < 0.6) o.eyec = Math.floor(rand() * 2);
  if (o.top === o.bot) o.bot = (o.bot + 5) % CLOTH.length;
  return o;
}
/** 예전의 정해진 모습(player_1~4)을 가장 비슷한 꾸미기 값으로 */
export function lookOfModel(model) {
  const i = /^player_([1-4])$/.exec(model || '');
  return { ...PRESETS[i ? +i[1] - 1 : 0] };
}

const mix = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
const shade = (c, k) => { const q = new THREE.Color(c); const l = 0.299 * q.r + 0.587 * q.g + 0.114 * q.b; return l < 0.12 ? mix(c, '#ffffff', 0.22) : mix(c, '#000000', 1 - k); };

/** 보여야 하는 부위 이름들 */
export function partsOf(L) {
  const of = OUTFIT[L.outfit - 1], hat = HAT[L.hat], on = new Set();
  on.add('hair' + L.hair); if (hat.cover !== 'dome') on.add('hairfr' + L.hair); if (!hat.cover) on.add('hairtop' + L.hair);
  on.add('eyes' + L.eyes); on.add('mouth' + L.mouth);
  on.add('brow' + ((L.brow ?? 0) + 1)); on.add('nose' + ((L.nose ?? 0) + 1));
  if (L.cheek === 1 || L.cheek === 3) on.add('blush');
  if (L.cheek === 2 || L.cheek === 3) on.add('freckle');
  if (L.hat) on.add('hat' + L.hat);
  if (L.glass) on.add('glass' + L.glass);
  on.add('top' + L.outfit);
  for (const s of ['L', 'R']) {
    on.add(of.sl + '_' + s);
    if (of.leg === 'pants') on.add('pants_' + s);
    else { on.add('sock_' + s); if (of.leg === 'shorts') on.add('shorts_' + s); }
  }
  return on;
}
/** 재질 이름 → 색 */
export function tintOf(L) {
  const skin = SKIN[L.skin], top = CLOTH[L.top], hat = CLOTH[L.hatc];
  return { p_skin: skin, p_nose: mix(skin, '#d56343', 0.56), p_hair: HAIRC[L.hairc], p_eye: EYEC[L.eyec], p_top: top, p_top2: shade(top, 0.8), p_bot: CLOTH[L.bot], p_shoe: SHOE[L.shoe], p_hat: hat, p_hat2: shade(hat, 0.82) };
}

const VARIANT = /^(hair|hairfr|hairtop|eyes|mouth|brow|nose|hat|glass|top)\d+$|^(blush|freckle)$|^(sls|sll|pants|shorts|sock)_[LR]$/;

/** 고른 모습을 캐릭터(Actor)에 입힌다. 갈아 끼우는 부위가 없는 모델(직접 바꿔 넣은 모델·그림)이면 아무 일도 하지 않고 false */
export function dress(actor, look) {
  const P = actor.parts;
  if (!P || !P.hair1) return false;
  const L = cleanLook(look), on = partsOf(L);
  if (P.head) P.head.scale.set(FACE[L.face].width, FACE[L.face].height, 1);
  for (const k of Object.keys(P)) {
    if (!VARIANT.test(k)) continue;
    P[k].visible = on.has(k);
    if (k.startsWith('eyes')) P[k].scale.y = 1;
  }
  P.eyes = P['eyes' + L.eyes] || null;           // 깜박임과 말할 때 입은 고른 조각으로
  P.mouth = P['mouth' + L.mouth] || null;
  const tint = tintOf(L);
  actor.model.traverse((n) => {
    if (!n.isMesh || !n.material || !n.material.userData) return;
    const t = tint[n.material.userData.base];
    if (t !== undefined) n.material = tinted(n.material.userData.base, t);
  });
  actor.look = L;
  return true;
}

/** 모습을 짧은 글자로(같이 하기에서 주고받을 때). 풀 때는 unpackLook */
export const packLook = (L) => LOOK_KEYS.map((k) => (L[k] || 0).toString(36)).join('');
export function unpackLook(s) {
  const o = {};
  LOOK_KEYS.forEach((k, i) => { o[k] = parseInt((s || '')[i] || '0', 36); });
  return cleanLook(o);
}
