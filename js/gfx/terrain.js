// 땅과 물: 타일 지도에서 부드러운 3D 지형, 땅 그림(텍스처), 물 표면을 만든다
import * as THREE from 'three';
import { G, MAP_W, MAP_H, WK } from '../world/mapgen.js';
import { patchMaterial, CURVE } from './models.js';
import { clamp, smooth, hash01 } from '../core/util.js';

export const PAD = { w: 14, n: 12, s: 18 };       // 지도 바깥으로 더 그리는 칸 수(서/동, 북, 남)
const TEX = 20;                                   // 타일 한 칸당 땅 그림 픽셀
const PW = MAP_W + PAD.w * 2, PH = MAP_H + PAD.n + PAD.s;
export const CLIFF_H = 2.4;
export const WATER_Y = -0.17;

export const GROUND_PAL = {
  spring: { g: [143, 209, 108], gd: [120, 189, 90], path: [222, 190, 136], sand: [243, 228, 173], rock: [164, 153, 142] },
  summer: { g: [104, 190, 96], gd: [84, 168, 80], path: [220, 187, 132], sand: [243, 228, 173], rock: [160, 149, 138] },
  autumn: { g: [194, 185, 96], gd: [172, 162, 80], path: [216, 181, 128], sand: [240, 224, 170], rock: [160, 149, 138] },
  winter: { g: [238, 243, 249], gd: [214, 224, 236], path: [226, 214, 196], sand: [240, 232, 200], rock: [170, 166, 162] },
};

export class Terrain {
  constructor(village) {
    this.v = village;
    this.group = new THREE.Group();
    this.buildFields();
    this.buildGroundTexture('spring');
    this.buildMesh();
    this.buildWater();
  }

  // 지도 밖은 가장자리 칸을 그대로 이어 붙인다
  tt(x, y) {
    const cx = clamp(x, 0, MAP_W - 1), cy = clamp(y, 0, MAP_H - 1);
    return this.v.terrain[cy * MAP_W + cx];
  }
  wk(x, y) {
    const cx = clamp(x, 0, MAP_W - 1), cy = clamp(y, 0, MAP_H - 1);
    return this.v.waterKind[cy * MAP_W + cx];
  }

  buildFields() {
    const n = PW * PH;
    const F = (this.F = { water: new Float32Array(n), sea: new Float32Array(n), sand: new Float32Array(n), path: new Float32Array(n), cliff: new Float32Array(n), forest: new Float32Array(n), pond: new Float32Array(n) });
    for (let j = 0; j < PH; j++) for (let i = 0; i < PW; i++) {
      const x = i - PAD.w, y = j - PAD.n, k = j * PW + i;
      const t = this.tt(x, y), w = this.wk(x, y);
      const isWater = t === G.WATER || t === G.SEA || t === G.BRIDGE || t === G.DOCK || (t === G.CLIFF && w === WK.RIVER);
      F.water[k] = isWater ? 1 : 0;
      F.sea[k] = t === G.SEA || t === G.DOCK ? 1 : 0;
      F.sand[k] = t === G.SAND ? 1 : 0;
      F.path[k] = t === G.PATH ? 1 : 0;
      F.cliff[k] = t === G.CLIFF && !isWater ? 1 : 0;
      F.forest[k] = t === G.FOREST || t === G.CLIFF ? 1 : 0;
      F.pond[k] = w === WK.POND ? 1 : 0;
    }
  }

  /** 필드를 타일 좌표(u,v)에서 부드럽게 읽는다 */
  sample(f, u, v) {
    const x = u + PAD.w - 0.5, y = v + PAD.n - 0.5;
    let i = Math.floor(x), j = Math.floor(y);
    const fx = x - i, fy = y - j;
    const i0 = clamp(i, 0, PW - 1), i1 = clamp(i + 1, 0, PW - 1), j0 = clamp(j, 0, PH - 1), j1 = clamp(j + 1, 0, PH - 1);
    const a = f[j0 * PW + i0], b = f[j0 * PW + i1], c = f[j1 * PW + i0], d = f[j1 * PW + i1];
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
  }

  heightAt(u, v) {
    const F = this.F;
    let h = 0;
    const w = this.sample(F.water, u, v);
    h -= smooth(0.36, 0.74, w) * 0.5;
    const sea = this.sample(F.sea, u, v);
    h -= smooth(0.55, 1, sea) * 0.45;
    h -= this.sample(F.sand, u, v) * 0.05;
    const c = this.sample(F.cliff, u, v);
    h += smooth(0.3, 0.66, c) * CLIFF_H;
    return h;
  }

  buildGroundTexture(season) {
    const pal = GROUND_PAL[season];
    const cw = PW * TEX, ch = PH * TEX;
    if (!this.canvas) { this.canvas = document.createElement('canvas'); this.canvas.width = cw; this.canvas.height = ch; }
    const ctx = this.canvas.getContext('2d');
    const img = ctx.createImageData(cw, ch);
    const d = img.data, F = this.F;
    const snow = season === 'winter';
    const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const bedRiver = [86, 150, 190], bedSea = [70, 140, 196], bedDeep = [44, 104, 170];
    const earth = snow ? [150, 140, 130] : [150, 118, 78], wet = [214, 196, 140];
    const stone = [211, 202, 188], stoneD = [176, 166, 150], stoneL = [226, 219, 207];
    for (let py = 0; py < ch; py++) {
      const v = py / TEX - PAD.n;
      const ty = Math.floor(v);
      for (let px = 0; px < cw; px++) {
        const u = px / TEX - PAD.w;
        const tx = Math.floor(u);
        const o = (py * cw + px) * 4;
        const n1 = hash01(px, py, 7);
        const low = Math.sin(u * 0.9 + Math.sin(v * 0.7) * 1.3) * Math.sin(v * 1.1 + u * 0.3);
        let c = mixc(pal.g, pal.gd, 0.25 + low * 0.25);
        if (n1 < 0.05) c = mixc(c, pal.gd, 0.9); else if (n1 > 0.965) c = mixc(c, [255, 255, 255], snow ? 0.6 : 0.22);
        const fo = this.sample(F.forest, u, v);
        if (fo > 0.02) c = mixc(c, snow ? [200, 214, 228] : [50, 110, 70], Math.min(1, fo) * 0.34);
        const t = this.tt(tx, ty);
        if (t === G.STONE) {
          const lx = (u - tx) * TEX, ly = (v - ty) * TEX, half = TEX / 2;
          const row = ly < half ? 0 : 1;
          const bx = (lx + (row ? half / 2 : 0)) % half, by = ly % half;
          c = bx < 1.2 || by < 1.2 ? stoneD : by < 2.6 ? stoneL : stone;
          if (n1 < 0.06) c = mixc(c, stoneD, 0.5);
        } else {
          const pth = this.sample(F.path, u, v);
          if (pth > 0.5) { c = mixc(pal.path, [190, 152, 100], n1 < 0.08 ? 0.5 : 0); if (n1 > 0.96) c = mixc(c, [255, 240, 210], 0.5); }
          else if (pth > 0.4) c = mixc(c, pal.path, 0.55);
          const sd = this.sample(F.sand, u, v);
          if (sd > 0.5) { c = mixc(pal.sand, [225, 205, 140], n1 < 0.07 ? 0.6 : 0); if (n1 > 0.96) c = [253, 246, 214]; }
          else if (sd > 0.42) c = mixc(c, pal.sand, 0.5);
        }
        const cl = this.sample(F.cliff, u, v);
        if (cl > 0.3 && cl < 0.7) {
          const streak = hash01(px >> 1, 3, 9);
          c = mixc(pal.rock, [110, 100, 92], streak * 0.45 + (cl - 0.3) * 0.5);
        }
        const w = this.sample(F.water, u, v);
        if (w > 0.34) {
          const sea = this.sample(F.sea, u, v), sd2 = this.sample(F.sand, u, v);
          const onSand = sd2 > 0.25 || sea > 0.3;
          let bed = mixc(bedRiver, bedSea, clamp(sea * 1.5, 0, 1));
          bed = mixc(bed, bedDeep, smooth(0.9, 1, sea) * clamp((v - 56) / 6, 0, 1));
          if (w < 0.47) c = mixc(c, onSand ? wet : earth, smooth(0.34, 0.42, w));
          else c = mixc(onSand ? wet : earth, bed, smooth(0.47, 0.62, w));
        }
        d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    if (!this.groundTex) {
      this.groundTex = new THREE.CanvasTexture(this.canvas);
      this.groundTex.colorSpace = THREE.SRGBColorSpace;
      this.groundTex.anisotropy = 4;
    }
    this.groundTex.needsUpdate = true;
    this.season = season;
  }

  buildMesh() {
    const S = 2;                                    // 타일 한 칸을 2×2로 나눈다
    const nx = PW * S, nz = PH * S;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array((nx + 1) * (nz + 1) * 3), uv = new Float32Array((nx + 1) * (nz + 1) * 2);
    let p = 0, q = 0;
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const u = i / S - PAD.w, v = j / S - PAD.n;
      pos[p++] = u; pos[p++] = this.heightAt(u, v); pos[p++] = v;
      uv[q++] = i / nx; uv[q++] = 1 - j / nz;
    }
    const idx = new Uint32Array(nx * nz * 6);
    let k = 0;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, e = c + 1;
      idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = e;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    const mat = patchMaterial(new THREE.MeshLambertMaterial({ map: this.groundTex }));
    this.ground = new THREE.Mesh(geo, mat);
    this.ground.frustumCulled = false;
    this.group.add(this.ground);
  }

  buildWater() {
    const R = 4, mw = PW * R, mh = PH * R;
    const cv = document.createElement('canvas'); cv.width = mw; cv.height = mh;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(mw, mh), d = img.data;
    for (let py = 0; py < mh; py++) for (let px = 0; px < mw; px++) {
      const u = (px + 0.5) / R - PAD.w, v = (py + 0.5) / R - PAD.n, o = (py * mw + px) * 4;
      d[o] = this.sample(this.F.water, u, v) * 255;
      d[o + 1] = this.sample(this.F.sea, u, v) * 255;
      d[o + 2] = this.sample(this.F.pond, u, v) * 255;
      d[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const mask = new THREE.CanvasTexture(cv);
    mask.minFilter = mask.magFilter = THREE.LinearFilter; mask.generateMipmaps = false;
    mask.flipY = false;                            // 그림의 위쪽이 북쪽 그대로 가도록
    const geo = new THREE.PlaneGeometry(PW, PH, PW, PH);
    geo.rotateX(-Math.PI / 2);
    geo.translate(PW / 2 - PAD.w, WATER_Y, PH / 2 - PAD.n);
    this.waterU = {
      uMask: { value: mask }, uTime: { value: 0 }, uCurveZ: CURVE.z, uCurveK: CURVE.k,
      uLight: { value: new THREE.Color(1, 1, 1) },
      uShallow: { value: new THREE.Color(0x7fd0f2) }, uDeep: { value: new THREE.Color(0x3f9fe0) }, uSea: { value: new THREE.Color(0x2f8fd6) },
      uOrigin: { value: new THREE.Vector2(-PAD.w, -PAD.n) }, uSize: { value: new THREE.Vector2(PW, PH) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.waterU, transparent: true, depthWrite: false,
      vertexShader: `
        uniform float uCurveZ; uniform float uCurveK; uniform vec2 uOrigin; uniform vec2 uSize;
        varying vec2 vW; varying vec2 vUv;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vW = wp.xz; vUv = (wp.xz - uOrigin) / uSize;
          float dz = wp.z - uCurveZ; wp.y -= dz * dz * uCurveK;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `
        uniform sampler2D uMask; uniform float uTime; uniform vec3 uLight, uShallow, uDeep, uSea;
        varying vec2 vW; varying vec2 vUv;
        void main() {
          vec4 m = texture2D(uMask, vUv);
          float w = m.r, sea = m.g;
          float lap = sea * 0.035 * sin(uTime * 0.7 + vW.x * 0.45);
          float th = 0.44 + lap;
          if (w < th) discard;
          vec3 col = mix(uShallow, uDeep, smoothstep(0.55, 0.95, w));
          col = mix(col, uSea, smoothstep(0.3, 1.0, sea) * 0.75);
          float r1 = sin(vW.x * 2.1 + uTime * 0.9 + sin(vW.y * 1.3 + uTime * 0.2) * 1.6) * sin(vW.y * 2.7 - uTime * 1.2 + vW.x * 0.4);
          float r2 = sin(vW.x * 5.3 - uTime * 0.6) * sin(vW.y * 4.1 + uTime * 0.8);
          col += smoothstep(0.82, 0.98, r1) * 0.22 + smoothstep(0.9, 1.0, r2) * 0.12;
          float edge = 1.0 - smoothstep(th, th + 0.085, w);
          float foam = edge * (0.75 + 0.25 * sin(uTime * 1.6 + vW.x * 3.0 + vW.y * 2.2));
          col = mix(col, vec3(1.0), clamp(foam, 0.0, 1.0) * 0.85);
          float a = mix(0.62, 0.86, smoothstep(th, 0.9, w));
          a = max(a, clamp(foam, 0.0, 1.0));
          gl_FragColor = vec4(col * uLight, a);
          #include <colorspace_fragment>
        }`,
    });
    this.water = new THREE.Mesh(geo, mat);
    this.water.frustumCulled = false;
    this.water.renderOrder = 2;
    this.group.add(this.water);
  }

  update(time) { this.waterU.uTime.value = time; }
  setLight(color) { this.waterU.uLight.value.copy(color); }
  setSeason(season) { if (season !== this.season) this.buildGroundTexture(season); }
}
