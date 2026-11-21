// 땅과 물: 타일 지도에서 부드러운 3D 지형, 땅 그림(텍스처), 물 표면을 만든다
import * as THREE from 'three';
import { G, MAP_W, MAP_H, WK } from '../world/mapgen.js';
import { patchMaterial, CURVE } from './models.js';
import { clamp, smooth, hash01 } from '../core/util.js';
import { shoreDepth, waterPatterns } from './water.js';

export const PAD = { w: 14, n: 12, s: 18 };       // 지도 바깥으로 더 그리는 칸 수(서/동, 북, 남)
const TEX = 20;                                   // 타일 한 칸당 땅 그림 픽셀
const PW = MAP_W + PAD.w * 2, PH = MAP_H + PAD.n + PAD.s;
export const CLIFF_H = 2.4;
export const WATER_Y = -0.17;

export const GROUND_PAL = {
  spring: { g: [143, 209, 108], gd: [120, 189, 90], path: [222, 190, 136], sand: [243, 228, 173], rock: [164, 153, 142] },
  summer: { g: [104, 190, 96], gd: [84, 168, 80], path: [220, 187, 132], sand: [243, 228, 173], rock: [160, 149, 138] },
  autumn: { g: [190, 196, 104], gd: [162, 176, 86], path: [216, 181, 128], sand: [240, 224, 170], rock: [160, 149, 138] },
  winter: { g: [238, 243, 249], gd: [214, 224, 236], path: [226, 214, 196], sand: [240, 232, 200], rock: [170, 166, 162] },
};

const DET = 512, DET_TILES = 4;                   // 잔디 무늬 그림 한 장의 크기(픽셀)와 덮는 칸 수

/** 잔디 무늬: 회색(128)이 '그대로', 밝으면 밝게, 어두우면 어둡게 땅 색에 곱해진다. 이 게임만의 풀포기 무늬. */
function drawGrassDetail(cv, season) {
  const S = DET, x = cv.getContext('2d');
  let seed = 20261119;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  x.fillStyle = 'rgb(128,128,128)'; x.fillRect(0, 0, S, S);
  // 가장자리에서 끊기지 않게 3×3으로 되풀이해 그린다
  const wrap = (cx, cy, r, fn) => { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { const px = cx + ox, py = cy + oy; if (px > -r && px < S + r && py > -r && py < S + r) fn(px, py); } };
  const snow = season === 'winter';
  // 1) 큰 얼룩(풀이 짙은 곳, 옅은 곳)
  for (let i = 0; i < 30; i++) {
    const cx = rnd() * S, cy = rnd() * S, r = 46 + rnd() * 70, light = rnd() < 0.5;
    wrap(cx, cy, r, (px, py) => {
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, light ? 'rgba(156,160,146,0.34)' : 'rgba(104,112,104,0.3)'); g.addColorStop(1, light ? 'rgba(156,160,146,0)' : 'rgba(104,112,104,0)');
      x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, 6.3); x.fill();
    });
  }
  if (snow) {       // 눈밭: 잔 반짝임만
    for (let i = 0; i < 160; i++) { const cx = rnd() * S, cy = rnd() * S, r = 1 + rnd() * 1.6; wrap(cx, cy, r, (px, py) => { x.fillStyle = rnd() < 0.5 ? 'rgba(150,150,154,0.9)' : 'rgba(112,116,126,0.7)'; x.beginPath(); x.arc(px, py, r, 0, 6.3); x.fill(); }); }
    return;
  }
  // 2) 풀포기: 부채꼴로 벌어진 세 갈래 잎 + 밑동의 짙은 그늘
  x.lineCap = 'round';
  const tuft = (px, py, sz, rot, light) => {
    x.save(); x.translate(px, py); x.rotate(rot);
    x.fillStyle = 'rgba(100,110,98,0.5)'; x.beginPath(); x.ellipse(0, sz * 0.1, sz * 0.62, sz * 0.24, 0, 0, 6.3); x.fill();
    x.strokeStyle = light; x.lineWidth = sz * 0.2;
    for (const a of [-0.62, 0, 0.62]) { const l = sz * (a === 0 ? 1 : 0.78); x.beginPath(); x.moveTo(a * sz * 0.22, 0); x.quadraticCurveTo(Math.sin(a) * l * 0.4, -l * 0.6, Math.sin(a) * l, -Math.cos(a) * l); x.stroke(); }
    x.restore();
  };
  const tone = season === 'autumn' ? ['rgba(168,158,120,0.95)', 'rgba(160,160,128,0.9)'] : ['rgba(154,164,138,0.95)', 'rgba(146,156,134,0.9)'];
  for (let i = 0; i < 150; i++) {
    const cx = rnd() * S, cy = rnd() * S, sz = 11 + rnd() * 9, rot = (rnd() - 0.5) * 0.7;
    wrap(cx, cy, sz * 1.3, (px, py) => tuft(px, py, sz, rot, tone[i & 1]));
  }
  // 3) 잔 점(작은 잎, 가을에는 낙엽, 봄에는 꽃잎)
  for (let i = 0; i < 230; i++) {
    const cx = rnd() * S, cy = rnd() * S, r = 1.4 + rnd() * 1.8, k = rnd();
    let col = k < 0.5 ? 'rgba(150,158,138,0.85)' : 'rgba(108,116,104,0.7)';
    if (season === 'autumn' && k > 0.72) col = k > 0.86 ? 'rgba(190,128,84,0.95)' : 'rgba(186,150,84,0.95)';
    if (season === 'spring' && k > 0.86) col = 'rgba(178,150,160,0.95)';
    wrap(cx, cy, r * 2, (px, py) => { x.fillStyle = col; x.beginPath(); x.ellipse(px, py, r * 1.5, r, k * 6, 0, 6.3); x.fill(); });
  }
}

export class Terrain {
  constructor(village) {
    this.v = village;
    this.group = new THREE.Group();
    this.buildFields();
    this.buildGroundTexture('spring');
    this.buildDetail('spring');
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

  /** 풀밭인 정도(0~1). 길·모래·물·절벽·돌바닥에서는 0 */
  grassAt(u, v) {
    const F = this.F;
    if (this.tt(Math.floor(u), Math.floor(v)) === G.STONE) return 0;
    const k = Math.max(this.sample(F.path, u, v) * 2.2, this.sample(F.sand, u, v) * 2.2, smooth(0.2, 0.42, this.sample(F.water, u, v)), smooth(0.2, 0.5, this.sample(F.cliff, u, v)));
    return clamp(1 - k, 0, 1);
  }

  buildDetail(season) {
    if (!this.detCanvas) { this.detCanvas = document.createElement('canvas'); this.detCanvas.width = this.detCanvas.height = DET; }
    drawGrassDetail(this.detCanvas, season);
    if (!this.detTex) {
      const t = (this.detTex = new THREE.CanvasTexture(this.detCanvas));
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.flipY = false;       // 색 그대로 곱하는 값이라 색공간 변환을 하지 않는다
      // 풀밭 지도(칸당 4점): 잔디 무늬를 풀밭에만 입힌다
      const R = 4, mw = PW * R, mh = PH * R, d = new Uint8Array(mw * mh * 4);
      for (let py = 0; py < mh; py++) for (let px = 0; px < mw; px++) {
        const o = (py * mw + px) * 4;
        d[o] = this.grassAt((px + 0.5) / R - PAD.w, (py + 0.5) / R - PAD.n) * 255; d[o + 3] = 255;
      }
      const m = (this.maskTex = new THREE.DataTexture(d, mw, mh, THREE.RGBAFormat));
      m.minFilter = m.magFilter = THREE.LinearFilter; m.needsUpdate = true;
    }
    this.detTex.needsUpdate = true;
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
    const mat = new THREE.MeshLambertMaterial({ map: this.groundTex });
    // 땅 그림 위에 잔디 무늬를 곱한다(풀밭 지도가 1인 곳에만)
    const U = { tDetail: { value: this.detTex }, tGrass: { value: this.maskTex }, uOrigin: { value: new THREE.Vector2(-PAD.w, -PAD.n) }, uSize: { value: new THREE.Vector2(PW, PH) } };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = 'varying vec2 vGxz;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGxz = position.xz;');
      sh.fragmentShader = 'uniform sampler2D tDetail;\nuniform sampler2D tGrass;\nuniform vec2 uOrigin;\nuniform vec2 uSize;\nvarying vec2 vGxz;\n' +
        sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
          float gAmt = texture2D(tGrass, (vGxz - uOrigin) / uSize).r;
          vec3 gDet = texture2D(tDetail, vGxz / ${DET_TILES}.0).rgb * 2.0;
          diffuseColor.rgb *= mix(vec3(1.0), gDet, gAmt);`);
    };
    mat.userData.cacheKey = 'ground';
    patchMaterial(mat);
    this.ground = new THREE.Mesh(geo, mat);
    this.ground.receiveShadow = true;
    this.ground.frustumCulled = false;
    this.group.add(this.ground);
  }

  buildWater() {
    const R = 4, mw = PW * R, mh = PH * R;
    const d = new Uint8Array(mw*mh*4);
    for (let py = 0; py < mh; py++) for (let px = 0; px < mw; px++) {
      const u = (px + 0.5) / R - PAD.w, v = (py + 0.5) / R - PAD.n, o = (py * mw + px) * 4;
      d[o] = this.sample(this.F.water, u, v) * 255;
      d[o + 1] = this.sample(this.F.sea, u, v) * 255;
      d[o + 2] = this.sample(this.F.pond, u, v) * 255;
      d[o + 3] = 255;
    }
    shoreDepth(d,mw,mh,R);
    const mask = new THREE.DataTexture(d,mw,mh);mask.needsUpdate=true;
    mask.minFilter = mask.magFilter = THREE.LinearFilter; mask.generateMipmaps = false;
    mask.flipY = false;                            // 그림의 위쪽이 북쪽 그대로 가도록
    const geo = new THREE.PlaneGeometry(PW, PH, PW, PH);
    geo.rotateX(-Math.PI / 2);
    geo.translate(PW / 2 - PAD.w, WATER_Y, PH / 2 - PAD.n);
    this.waterU = {
      uMask: { value: mask }, uTime: { value: 0 }, uCurveZ: CURVE.z, uCurveK: CURVE.k,
      uLight: { value: new THREE.Color(1, 1, 1) },
      uShallow: { value: new THREE.Color(0x96dec9) }, uDeep: { value: new THREE.Color(0x47a7b0) }, uSea: { value: new THREE.Color(0x337fa9) },
      uWet:{value:0},uRipple:{value:new THREE.Vector3(0,0,-20)},
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
        uniform sampler2D uMask; uniform float uTime,uWet; uniform vec3 uLight, uShallow, uDeep, uSea,uRipple;
        varying vec2 vW; varying vec2 vUv;
        ${waterPatterns}
        void main() {
          vec4 m = texture2D(uMask, vUv);
          float w=m.r, sea=m.g, pond=m.b, depth=m.a;
          float lap=sea*.037*sin(uTime*.91+vW.x*.55+.45*sin(vW.x*.95));
          float th = 0.44 + lap;
          if (w < th) discard;
          float flow=uTime*mix(.68,1.,sea)*(1.-pond*.55);
          vec2 p=vW+vec2(.65*sin(vW.y*.46),0.)*(1.-sea);
          vec3 inland=mix(uDeep,vec3(.14,.46,.31),pond*.48);
          vec3 col=mix(uShallow,mix(inland,uSea,sea),smoothstep(0.,mix(.35,.95,sea),depth));
          col*=1.+currents(p*.61,flow)*.046;
          float lace=caustics(p*.91,flow)*(1.-smoothstep(.10,.48,depth))*(1.-uWet*.65);
          col=mix(col,vec3(.68,.98,.81),lace*.23);
          float shine=glints(p*vec2(1.6,1.38),flow)*.78+glints(p*vec2(2.45,2.12)+3.1,flow*.83)*.25;
          col=mix(col,vec3(.84,.98,1.),shine*mix(.22,.46,sea)*(1.-uWet*.67));
          float roll=sin(vW.x*.92+uTime*.91+.52*sin(vW.x*1.85));
          float edge=(1.-smoothstep(th,th+.057,w))*mix(.20,.88,sea);
          float surf=1.-smoothstep(.006,.021,abs(depth-(.075+.027*roll)));
          float shoreWave=1.-smoothstep(.011,.048,abs(w-(.62+.07*roll+.035*sin(vW.x*2.8-uTime*.65))));
          float foam=max(edge,max(surf*.75,shoreWave*.65)*sea*smoothstep(-.78,.4,roll));
          col=mix(col,vec3(.88,.98,.94),foam);
          float age=uTime-uRipple.z,dist=length(vW-uRipple.xy);
          float ring=(1.-smoothstep(.017,.058,abs(dist-age*.82)))*(1.-smoothstep(.12,1.6,age));
          col=mix(col,vec3(.88,.99,.98),clamp(ring,0.,1.)*.70);
          float a=max(mix(.47,.88,smoothstep(.0,.6,depth)),foam);
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
  ripple(x,z) { this.waterU.uRipple.value.set(x,z,this.waterU.uTime.value); }
  setLight(color,wet=0) { this.waterU.uLight.value.copy(color);this.waterU.uWet.value=wet; }
  setSeason(season) { if (season !== this.season) { this.buildGroundTexture(season); this.buildDetail(season); } }
}
