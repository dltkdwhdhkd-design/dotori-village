// 벽지와 바닥재 무늬를 그려서 텍스처로 만든다
import * as THREE from 'three';

const cache = new Map();
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }

const DRAW = {
  wall_cream(x, w, h) { x.fillStyle = '#fff3d6'; x.fillRect(0, 0, w, h); x.fillStyle = '#f6e6bd'; for (let i = 0; i < 40; i++) x.fillRect((i * 37) % w, (i * 53) % h, 3, 3); },
  wall_stripe(x, w, h) { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#dff0fa' : '#bfe0f2'; x.fillRect(i * w / 8, 0, w / 8, h); } },
  wall_dot(x, w, h) { x.fillStyle = '#ffe6ec'; x.fillRect(0, 0, w, h); x.fillStyle = '#ffc2d0'; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(i * w / 4 + (j % 2 ? w / 8 : 0) + w / 16, j * h / 4 + h / 8, w / 22, 0, 7); x.fill(); } },
  wall_wood(x, w, h) { for (let i = 0; i < 6; i++) { x.fillStyle = i % 2 ? '#d9b98a' : '#cfab78'; x.fillRect(i * w / 6, 0, w / 6, h); x.fillStyle = '#b8935e'; x.fillRect(i * w / 6, 0, 2, h); } },
  wall_hanji(x, w, h) { x.fillStyle = '#f7f1e0'; x.fillRect(0, 0, w, h); x.strokeStyle = '#8a5a3a'; x.lineWidth = 5; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * w / 4, 0); x.lineTo(i * w / 4, h); x.stroke(); } for (let j = 0; j <= 4; j++) { x.beginPath(); x.moveTo(0, j * h / 4); x.lineTo(w, j * h / 4); x.stroke(); } },
  wall_sky(x, w, h) { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#7fcdf5'); g.addColorStop(1, '#d6f1fd'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = '#ffffff'; for (const [cx, cy, r] of [[40, 50, 22], [66, 46, 18], [160, 110, 24], [190, 104, 18], [100, 180, 20]]) { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); } },
  wall_brick(x, w, h) { x.fillStyle = '#e2c9b0'; x.fillRect(0, 0, w, h); for (let j = 0; j < 8; j++) for (let i = -1; i < 4; i++) { x.fillStyle = (i + j) % 3 ? '#d98a6a' : '#cf7a5a'; x.fillRect(i * w / 4 + (j % 2 ? w / 8 : 0) + 2, j * h / 8 + 2, w / 4 - 4, h / 8 - 4); } },
  wall_forest(x, w, h) { x.fillStyle = '#cfeebd'; x.fillRect(0, 0, w, h); for (let i = 0; i < 5; i++) { const cx = i * w / 5 + w / 10; x.fillStyle = '#8a5a3a'; x.fillRect(cx - 4, h * 0.55, 8, h * 0.45); x.fillStyle = i % 2 ? '#5fae62' : '#7fce5a'; x.beginPath(); x.arc(cx, h * 0.45, w / 9, 0, 7); x.fill(); } },
  floor_wood(x, w, h) { for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? '#d9a868' : '#cf9c5a'; x.fillRect(0, i * h / 4, w, h / 4); x.fillStyle = '#b8864a'; x.fillRect(0, i * h / 4, w, 2); x.fillRect(((i * 97) % w), i * h / 4, 2, h / 4); } },
  floor_jangpan(x, w, h) { x.fillStyle = '#e9c46a'; x.fillRect(0, 0, w, h); x.fillStyle = '#dcb458'; x.fillRect(0, 0, w, 3); x.fillRect(0, 0, 3, h); x.fillStyle = '#f2d484'; for (let i = 0; i < 30; i++) x.fillRect((i * 41) % w, (i * 67) % h, 4, 2); },
  floor_tile(x, w, h) { for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { x.fillStyle = (i + j) % 2 ? '#dfe8ee' : '#9fc4dc'; x.fillRect(i * w / 2, j * h / 2, w / 2, h / 2); } },
  floor_carpet(x, w, h) { x.fillStyle = '#c9584a'; x.fillRect(0, 0, w, h); x.fillStyle = '#b84a3e'; for (let i = 0; i < 200; i++) x.fillRect((i * 31) % w, (i * 47) % h, 2, 2); x.strokeStyle = '#f2c230'; x.lineWidth = 4; x.strokeRect(10, 10, w - 20, h - 20); },
  floor_dark(x, w, h) { for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? '#8a5a3a' : '#7e5032'; x.fillRect(0, i * h / 4, w, h / 4); x.fillStyle = '#5e3a24'; x.fillRect(0, i * h / 4, w, 2); x.fillRect(((i * 83 + 20) % w), i * h / 4, 2, h / 4); } },
  floor_pastel(x, w, h) { for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { x.fillStyle = (i + j) % 2 ? '#c4eadc' : '#fff0f4'; x.fillRect(i * w / 2, j * h / 2, w / 2, h / 2); } },
  floor_stone(x, w, h) { x.fillStyle = '#b8b4ac'; x.fillRect(0, 0, w, h); x.strokeStyle = '#8f8a82'; x.lineWidth = 3; x.strokeRect(1, 1, w / 2, h / 2); x.strokeRect(w / 2, 1, w / 2, h / 2); x.strokeRect(-w / 4, h / 2, w / 2, h / 2); x.strokeRect(w / 4, h / 2, w / 2, h / 2); x.strokeRect(w * 3 / 4, h / 2, w / 2, h / 2); },
  wall_tent(x, w, h) { x.fillStyle = '#f0c877'; x.fillRect(0, 0, w, h); x.strokeStyle = '#d8a850'; x.lineWidth = 4; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * w / 4, 0); x.lineTo(i * w / 4 + (i % 2 ? 10 : -10), h); x.stroke(); } x.fillStyle = '#fff3d6'; x.fillRect(0, h - 22, w, 8); },
  floor_mat(x, w, h) { x.fillStyle = '#b8a070'; x.fillRect(0, 0, w, h); for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { x.fillStyle = (i + j) % 2 ? '#c4ac7c' : '#ac9464'; x.fillRect(i * w / 8 + 1, j * h / 8 + 1, w / 8 - 2, h / 8 - 2); } },
  floor_grass(x, w, h) { x.fillStyle = '#7fce5a'; x.fillRect(0, 0, w, h); x.fillStyle = '#6ab84a'; for (let i = 0; i < 120; i++) x.fillRect((i * 29) % w, (i * 71) % h, 2, 5); x.fillStyle = '#ffffff'; for (let i = 0; i < 6; i++) x.fillRect((i * 97 + 20) % w, (i * 59 + 30) % h, 4, 4); },
};

/** 벽지/바닥재 텍스처. repeat는 쓰는 쪽에서 정한다. */
export function roomTexture(id) {
  if (cache.has(id)) return cache.get(id);
  const [c, x] = canvas(256, 256);
  (DRAW[id] || DRAW.wall_cream)(x, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  cache.set(id, t);
  return t;
}
