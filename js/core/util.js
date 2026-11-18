// 작은 도구 모음
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const TAU = Math.PI * 2;

export function hash32(...n) {
  let h = 0x9e3779b9 | 0;
  for (let v of n) {
    if (typeof v === 'string') { for (let i = 0; i < v.length; i++) { h = Math.imul(h ^ v.charCodeAt(i), 0x85ebca6b); h ^= h >>> 13; } continue; }
    h = Math.imul(h ^ (v | 0), 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  }
  return h >>> 0;
}
export const hash01 = (...n) => hash32(...n) / 4294967296;

/** 씨앗으로 정해지는 난수 생성기 */
export function RNG(seed) {
  let a = (seed >>> 0) || 1;
  const f = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.int = (a2, b2) => a2 + Math.floor(f() * (b2 - a2 + 1));
  f.range = (a2, b2) => a2 + f() * (b2 - a2);
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.chance = (p) => f() < p;
  f.shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  return f;
}
export const rand = RNG((Date.now() ^ (Math.random() * 1e9)) >>> 0);   // 저장과 무관한 그때그때 난수

export function weighted(list, wf, r = rand) {
  let sum = 0; for (const e of list) sum += wf(e);
  if (sum <= 0) return null;
  let v = r() * sum;
  for (const e of list) { v -= wf(e); if (v <= 0) return e; }
  return list[list.length - 1];
}

export const fmt = (n) => Math.round(n).toLocaleString('ko-KR');

/** 받침 유무에 따른 조사 고르기: josa('사과','을/를') */
export function josa(word, pair) {
  const [a, b] = pair.split('/');
  const ch = word.charCodeAt(word.length - 1);
  if (ch < 0xac00 || ch > 0xd7a3) return word + (/[0-9]/.test(word.slice(-1)) ? ('136780'.includes(word.slice(-1)) ? a : b) : b);
  const jong = (ch - 0xac00) % 28;
  if (pair === '으로/로') return word + (jong === 0 || jong === 8 ? '로' : '으로');
  return word + (jong ? a : b);
}

export const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
