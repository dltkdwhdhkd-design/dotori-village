// 무대: 렌더러, 카메라, 조명, 하늘 — 시간대와 날씨에 따라 빛이 바뀐다
import * as THREE from 'three';
import { CURVE, FX, patchMaterial } from './models.js';
import { clamp, lerp } from '../core/util.js';

const C = (h) => new THREE.Color(h);
const CAM_OUT = [0, 12.3, 13.3], LOOK_OUT = [0, 0.9, -1.0];   // 마을에서의 카메라(초점 기준 위치, 바라보는 곳)
const SHADOW_R = 23;                                           // 그림자를 드리우는 범위(초점에서 사방으로)
const _v = new THREE.Vector3(), _d = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3();
const SKY = { day: C(0x9bdcf8), dusk: C(0xf6a878), night: C(0x1d2756), cloud: C(0xb9c6d2), cloudNight: C(0x20263c) };
const HEMI = { daySky: C(0xffffff), dayGround: C(0xc8e6a8), nightSky: C(0x7f93d8), nightGround: C(0x39457a) };
const SUN = { day: C(0xfff3dc), dusk: C(0xffb07a), night: C(0x9fb4f0) };

export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene = new THREE.Scene();
    this.scene.background = SKY.day.clone();
    this.camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 400);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0xc8e6a8, 2.0);
    this.sun = new THREE.DirectionalLight(0xfff3dc, 2.0);
    this.sun.position.set(-5, 10, 6);
    this.scene.add(this.hemi, this.sun, this.sun.target);
    // 해 그림자: 주인공 둘레 넓은 범위에 그림자 지도 한 장을 드리운다
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    const sh = this.sun.shadow, sc = sh.camera;
    sh.mapSize.set(2048, 2048);
    sc.left = -SHADOW_R; sc.right = SHADOW_R; sc.top = SHADOW_R; sc.bottom = -SHADOW_R; sc.near = 1; sc.far = 100; sc.updateProjectionMatrix();
    sh.bias = -0.0005; sh.normalBias = 0.04;
    this.sun.castShadow = true;
    this.shadows = true;
    this.sunOff = new THREE.Vector3(-5, 10, 6);         // 초점에서 해 쪽으로의 방향
    this.zoom = 1; this.zoomT = 1;                       // 대화할 때 살짝 다가간다
    this.focus = new THREE.Vector3();
    this.camOff = new THREE.Vector3(...CAM_OUT);          // 마을에서의 카메라 위치(초점 기준)
    this.lookOff = new THREE.Vector3(...LOOK_OUT);
    this.curveK = 0.0105;
    this.light = { day: 1, tw: 0, wet: 0 };
    this.waterLight = new THREE.Color(1, 1, 1);
    this.indoor = false;
    this.shake = 0;
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
    this.camera.aspect = w / h;
    // 화면이 세로로 길면 조금 더 넓게 본다
    this.camera.fov = w / h > 1.5 ? 30 : lerp(44, 30, clamp((w / h - 0.6) / 0.9, 0, 1));
    this.camera.updateProjectionMatrix();
  }

  /** 실내/실외에 따라 카메라와 굽은 세계 정도를 바꾼다 */
  setMode(indoor, roomDepth = 6) {
    this.indoor = indoor; this._roomDepth = roomDepth;
    if (indoor) {
      const k = 0.78 + roomDepth * 0.045;
      this.camOff.set(0, 11.5 * k, 9.6 * k); this.lookOff.set(0, 0.6, -0.6); CURVE.k.value = 0;
    } else { this.camOff.set(...CAM_OUT); this.lookOff.set(...LOOK_OUT); CURVE.k.value = this.curveK; }
    this.camera.layers.enable(1);
    if (this.shadows && !indoor) this.camera.layers.disable(1);     // 해 그림자가 있으면 둥근 그림자(1번 층)는 끈다
    this.sun.castShadow = this.shadows && !indoor;
  }

  /** 해 그림자를 켜고 끈다(느린 컴퓨터에서는 끄면 가볍다). 끄면 발밑의 둥근 그림자로 대신한다. */
  setShadows(on) { this.shadows = !!on; this.setMode(this.indoor, this._roomDepth || 6); }

  setFocus(x, y, z, snap = false) {
    if (snap) this.focus.set(x, y, z);
    else { this.focus.x += (x - this.focus.x) * 0.14; this.focus.y += (y - this.focus.y) * 0.14; this.focus.z += (z - this.focus.z) * 0.14; }
  }

  /** day: 0(밤)~1(낮), tw: 노을 0~1, weather: clear|cloudy|rain|snow, hour: 지금 시각(0~24) */
  setLighting(day, tw, weather, hour = 12) {
    const wet = weather === 'rain' || weather === 'snow' ? 1 : weather === 'cloudy' ? 0.6 : 0;
    this.light = { day, tw, wet };
    FX.rim.value = this.indoor ? 0.22 : lerp(0.12, 0.4, day) * (1 - wet * 0.3);
    if (this.indoor) {
      this.sunOff.set(-3, 10, 7);
      this.scene.background.set(0x2a1f18);
      this.hemi.color.set(0xfff6e6); this.hemi.groundColor.set(0xd9c2a0); this.hemi.intensity = lerp(1.7, 2.0, day);
      this.sun.color.set(0xfff0d8); this.sun.intensity = lerp(1.1, 1.6, day);
      return;
    }
    const sky = SKY.night.clone().lerp(SKY.day, day).lerp(SKY.dusk, tw * 0.75);
    sky.lerp(day > 0.5 ? SKY.cloud : SKY.cloudNight, wet * 0.75);
    this.scene.background.copy(sky);
    this.hemi.color.copy(HEMI.nightSky).lerp(HEMI.daySky, day);
    this.hemi.groundColor.copy(HEMI.nightGround).lerp(HEMI.dayGround, day);
    this.hemi.intensity = lerp(1.25, 2.0, day) * (1 - wet * 0.14);
    this.sun.color.copy(SUN.night).lerp(SUN.day, day).lerp(SUN.dusk, tw * 0.8);
    this.sun.intensity = lerp(0.55, 2.0, day) * (1 - wet * 0.45);
    // 해는 아침에 동쪽(+x), 저녁에 서쪽(-x), 늘 남쪽(+z) 하늘에 있다. 밤에는 달빛이 왼쪽 위에서 비춘다.
    const a = clamp((hour - 6) / 12, 0, 1) * Math.PI;
    _v.set(Math.cos(a) * 7, 4.5 + Math.sin(a) * 6.5, 4.5);
    this.sunOff.set(-4, 10, 5).lerp(_v, clamp(day * 1.6, 0, 1));
    this.sun.shadow.intensity = lerp(0.55, 0.9, day) * (1 - wet * 0.45);
    this.waterLight.setRGB(lerp(0.2, 1, day), lerp(0.27, 1, day), lerp(0.48, 1, day)).lerp(new THREE.Color(1, 0.8, 0.7), tw * 0.35);
    this.waterLight.multiplyScalar(1 - wet * 0.12);
  }

  /** 해(그림자 카메라)를 초점 위에 놓는다. 그림자가 일렁이지 않게 그림자 지도의 한 칸 단위로 맞춘다. */
  placeSun() {
    const dir = _d.copy(this.sunOff).normalize();
    _r.set(0, 1, 0).cross(dir).normalize();            // 그림자 지도의 가로축
    _u.copy(dir).cross(_r);                            // 세로축
    const texel = (SHADOW_R * 2) / this.sun.shadow.mapSize.x;
    const c = _v.copy(this.focus); c.z -= 7;           // 화면은 초점보다 북쪽(-z)을 더 많이 보여 준다
    const fx = Math.round(c.dot(_r) / texel) * texel, fy = Math.round(c.dot(_u) / texel) * texel, fz = c.dot(dir);
    const t = this.sun.target.position;
    t.set(0, 0, 0).addScaledVector(_r, fx).addScaledVector(_u, fy).addScaledVector(dir, fz);
    this.sun.position.copy(t).addScaledVector(dir, 45);
    this.sun.target.updateMatrixWorld();
  }

  render() {
    const f = this.focus;
    let sx = 0, sy = 0;
    if (this.shake > 0) { sx = (Math.random() - 0.5) * this.shake; sy = (Math.random() - 0.5) * this.shake; this.shake *= 0.86; if (this.shake < 0.004) this.shake = 0; }
    this.zoom += (this.zoomT - this.zoom) * 0.08;
    const z = this.zoom;
    this.camera.position.set(f.x + this.camOff.x * z + sx, f.y + this.camOff.y * z + sy, f.z + this.camOff.z * z);
    this.camera.lookAt(f.x + this.lookOff.x + sx, f.y + this.lookOff.y + sy, f.z + this.lookOff.z);
    CURVE.z.value = f.z;
    this.placeSun();
    this.renderer.render(this.scene, this.camera);
  }
}

/** 둥근 그림자 한 장(캐릭터 발밑 등). 해 그림자를 켠 동안에는 보이지 않는다(카메라의 1번 층). */
let shadowTex = null;
export function blobShadowMaterial(opacity = 0.32) {
  if (!shadowTex) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 4, 32, 32, 31);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.6, 'rgba(0,0,0,0.75)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    shadowTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity, depthWrite: false, color: 0x1a2a20 });
  m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2;
  return patchMaterial(m);
}
let shadowGeo = null;
export function makeBlobShadow(r = 0.4, opacity = 0.32) {
  if (!shadowGeo) { shadowGeo = new THREE.PlaneGeometry(1, 1); shadowGeo.rotateX(-Math.PI / 2); }
  const m = new THREE.Mesh(shadowGeo, blobShadowMaterial(opacity));
  m.scale.set(r * 2, 1, r * 2);
  m.position.y = 0.03;
  m.renderOrder = 1;
  m.frustumCulled = false;
  m.layers.set(1);
  return m;
}
