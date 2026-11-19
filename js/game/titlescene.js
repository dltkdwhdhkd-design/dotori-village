// 첫 화면 뒤에 보이는 작은 풍경: 도토리 집 앞에 주인공과 이웃들이 서 있다
import * as THREE from 'three';
import { make, patchMaterial, CURVE } from '../gfx/models.js';
import { Actor } from '../gfx/actor.js';

const WHO = [['player_1', -1.75, 2.0, 0.18], ['villager_dalgom', 1.95, 2.1, -0.22], ['villager_pongdang', -3.55, 1.3, 0.4], ['villager_goran', 3.7, 1.25, -0.42], ['npc_kkami', 5.2, 0.3, -0.6]];
const TINT_HOME = { roof: 0xb8763c, roof_d: 0x94592a, wall: 0xfff1d2, wall_d: 0xe6cfa2 };

export class TitleScene {
  constructor(stage, look) {
    this.stage = stage; this.t = 0; this.next = 2.5;
    this.root = new THREE.Group();
    stage.scene.add(this.root);
    const snow = !!(look && look.snow);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 40), patchMaterial(new THREE.MeshLambertMaterial({ color: snow ? 0xf2f6fb : look && look.season === 'autumn' ? 0xbcc66a : 0x8fd46e })));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.frustumCulled = false;
    this.root.add(ground);
    const put = (name, x, z, o = {}) => {
      const m = make(name, o.tint ? { tint: o.tint } : {});
      m.position.set(x, 0, z); if (o.s) m.scale.setScalar(o.s); if (o.ry) m.rotation.y = o.ry;
      const sp = m.userData.parts && m.userData.parts.snow; if (sp) sp.visible = snow;
      if (name === 'tree_blossom' && look && look.season === 'winter' && m.userData.parts.canopy) m.userData.parts.canopy.visible = false;
      this.root.add(m);
      return m;
    };
    put('home_1', 0, -1.4, { tint: TINT_HOME });
    put('mailbox', 1.9, 0.5, { ry: -0.2 });
    put('tree_fruit', -4.0, -1.6, { ry: 0.3 }); put('tree_blossom', 4.3, -2.4);
    for (const [x, z, s] of [[-6.6, -4.2, 1.35], [6.9, -5.2, 1.45], [-2.4, -6.2, 1.5], [2.6, -6.6, 1.45], [-9.5, -6.5, 1.6], [10, -7.5, 1.6], [0.2, -8.5, 1.7], [-5.4, -8.6, 1.6], [5.6, -9.2, 1.7]]) put('tree_pine', x, z, { s, ry: x });
    put('rock1', -5.2, 0.9, { ry: 1 }); put('lamp', -1.9, 0.4);
    if (!snow) {
      for (let i = 0; i < 70; i++) { const a = i * 2.399, r = 1.6 + Math.sqrt(i) * 1.15; const x = Math.cos(a) * r * 1.5, z = Math.sin(a) * r * 0.75 - 0.6; if (Math.hypot(x, z + 1.4) < 1.9) continue; put(i % 5 === 0 ? 'grass_a' : 'grass_b', x, z, { s: 1.1 + (i % 3) * 0.2, ry: i }); }
      const cols = [0xf0564e, 0xffd84a, 0xffffff, 0xff9fc2];
      [[-3.2, 2.6, 'cosmos'], [3.6, 2.9, 'tulip'], [-5.0, 2.2, 'pansy'], [5.6, 1.9, 'cosmos'], [0.3, 3.4, 'mum'], [-1.9, 3.2, 'tulip']].forEach(([x, z, sp], i) => put('flower_' + sp, x, z, { tint: { petal: cols[i % 4] }, ry: i }));
    }
    this.actors = WHO.map(([id, x, z, yaw]) => { const a = new Actor(id); a.setPos(x, 0, z); a.face(yaw, true); this.root.add(a.root); return a; });
    // 카메라: 집 앞을 살짝 올려다보듯
    this.keep = { cam: stage.camOff.clone(), look: stage.lookOff.clone(), k: CURVE.k.value };
    stage.camOff.set(0, 3.1, 12.6); stage.lookOff.set(0, 1.95, 0); CURVE.k.value = 0;
    stage.setFocus(0, 0, 0, true);
  }

  update(dt) {
    this.t += dt;
    this.stage.setFocus(Math.sin(this.t * 0.22) * 0.5, 0, 0);
    this.next -= dt;
    if (this.next <= 0) {                       // 가끔 누군가 손을 흔들거나 폴짝 뛴다
      this.next = 2.2 + Math.random() * 2.5;
      const a = this.actors[Math.floor(Math.random() * this.actors.length)];
      a.play(Math.random() < 0.6 ? 'wave' : 'joy', 0.9);
    }
    for (const a of this.actors) a.update(dt);
  }

  /** 이사 준비 화면에서 고른 모습으로 주인공을 바꿔 세운다 */
  setPlayer(id) { this.actors[0].setModel(id); this.actors[0].play('hop', 0.4); }

  dispose() {
    this.stage.scene.remove(this.root);
    this.stage.camOff.copy(this.keep.cam); this.stage.lookOff.copy(this.keep.look); CURVE.k.value = this.keep.k;
  }
}
