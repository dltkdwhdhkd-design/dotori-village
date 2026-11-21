import { G, groundY, burst, runScript } from './game.js';
import { UI, Dialog } from '../ui/ui.js';
import { Sound } from '../core/audio.js';
import { RakkoSword, DRAW_TIME, SWING_TIME } from '../gfx/rakko.js';
import { speak } from './speech.js';

// Each resident's surprise, warning, angry reaction, and answer to an apology.
const gesture = gesture => ({ words: '', gesture });
const lines = {
  dalgom: ['앗!', '으…!', '이얏!', gesture('눈가를 쓱 닦고 조심스레 고개를 끄덕인다.')],
  goran: ['어라? 내 귀에 벌레가 있었어?', '잠깐, 이번에도 내 귀였는데…?', '이제 그만! 나도 밀어낼 거야!', '응, 괜찮아. 우리 이번엔 진짜 벌레를 찾아볼까?'],
  nureong: ['하아?!', '우라!', '우라야하!', gesture('토벌봉을 어깨에 메고 한쪽 귀를 까딱한다.')],
  beomi: ['…음? 채가 빗나갔나?', '거기까지다. 채를 내려라.', '두 번은 경고했다. 물러서라.', '알았다. 다친 덴 없나?'],
  jangkki: [gesture('잔 위를 손으로 가린다.'), gesture('잔을 내려놓고 채를 물끄러미 본다.'), gesture('도시락 뚜껑을 닫고 등을 돌린다.'), gesture('다시 도시락을 열고 옆자리를 내준다.')],
  pongdang: ['앗, 무슨 일이세요?', '저, 채는 조금만 멀리 들어 주세요.', '그만해 주세요! 깜짝 놀랐잖아요!', '네! 다음엔 먼저 불러 주세요.'],
  sandeul: [gesture('읽던 책을 꼭 끌어안는다.'), gesture('책갈피를 끼우고 고개를 가로젓는다.'), gesture('책을 등 뒤에 숨기고 손바닥을 펴 보인다.'), gesture('접혔던 책장을 펴고 옆자리를 톡톡 두드린다.')],
  dahong: ['뭐야! 내 털 헝클어졌잖아!', '채 말고 나를 보란 말이야!', '이제 안 보여 줄 거야! 흥!', '그럼 얼른 봐! 방금 털 정리한 거 귀엽지?'],
  dungdung: ['우?', '우우…!', gesture('두 팔을 벌려 동료들 앞을 막는다.'), gesture('어깨를 풀고 다시 첫 박자를 세어 준다.')],
  kkokki: ['와!', '와아…?', gesture('발을 쿵 구르고 채를 가리킨다.'), gesture('한 발 다가와 손뼉을 마주친다.')],
  dodam: [gesture('삐뚤어진 모자를 붙든다.'), gesture('모자를 꼭 쥐고 한 손으로 멈추라고 한다.'), gesture('모자를 눈까지 눌러쓰고 등을 돌린다.'), gesture('모자를 살짝 들어 눈인사를 한다.')],
  pogeun: [gesture('놀라서 한 박자를 놓친다.'), gesture('고개를 저으며 멈춤 동작을 해 보인다.'), gesture('발을 딱 붙이고 두 팔로 커다란 가위표를 만든다.'), gesture('슬그머니 같은 박자로 발을 구른다.')],
};
const gear = { beomi: 'sword', goran: 'hunt_blue', dalgom: 'hunt_fork', nureong: 'hunt_staff' };
const moodTime = 16;

export function canNetResident(n) {
  return !!n && !!lines[n.id] && n.visible && !n.staged && !n.talking && !G.player.huntGear;
}
function clearPath(p, n) {
  for (const t of [.25, .5, .75]) {
    const x = Math.floor(p.x + (n.x-p.x)*t), z = Math.floor(p.z + (n.z-p.z)*t);
    if (G.room ? !G.room.free(x,z) : G.village.solid(x,z)) return false;
  }
  return true;
}
export function netTarget(p) {
  const f = p.front(.86);
  let best = null, nearest = .72;
  for (const n of G.room?.npcs || G.npcs) {
    if (!canNetResident(n)) continue;
    const d = Math.hypot(f.x-n.x, f.z-n.z);
    if (d < nearest && clearPath(p,n)) { nearest = d; best = n; }
  }
  return best;
}
function react(n,line) {
  if (typeof line === 'string') { n.actor.talk(.36); UI.toast(n.name+'　“'+line+'”'); }
  else UI.toast(n.name+' · '+line.gesture);
}
export function tapResident(n) {
  let m = n.netMood;
  if (m?.counter) return;
  if (m?.hits === 3 && G.time < m.until) {
    n.actor.emote('angry',1.6); react(n,lines[n.id][2]); return;
  }
  if (!m || G.time >= m.until) m = n.netMood = { hits: 0 };
  m.hits++; m.until = G.time + moodTime; m.hold = m.hits === 3 ? 1.5 : .68;
  const a = n.actor;
  a.speed = 0; a.faceTo(G.player.x,G.player.z); a.play('surprise',.32);
  a.emote(['!', 'sweat', 'angry'][m.hits-1], m.hits === 3 ? 3 : 1.4);
  Sound.sfx('bonk'); burst('dust',n.x,groundY(n.x,n.z)+.95,n.z,4);
  react(n,lines[n.id][m.hits-1]);
  if (m.hits < 3 || !gear[n.id]) return;
  const rig = gear[n.id] === 'sword' && a.parts.blade_tip && a.parts.hand ? new RakkoSword(a) : null;
  if (!rig && gear[n.id] === 'sword') return;
  m.counter = { rig, time: 0, draw: rig ? DRAW_TIME : .48, swung: false, struck: false };
  if (!rig) a.hold(gear[n.id]);
}
export function clearNetMood(n) {
  const c = n.netMood?.counter;
  if (c?.rig) c.rig.pose(0);
  else if (c) n.actor.hold(null);
  if (n.netMood) n.actor.emote(null);
  n.netMood = null;
}
export function updateNetMood(n,dt) {
  const m = n.netMood;
  if (!m) return false;
  const a = n.actor, p = G.player, c = m.counter;
  if (!c && G.time >= m.until) { clearNetMood(n); return false; }
  if (!c && (m.hold <= 0 || n.talking)) return false;
  if (UI.blocking() || G.busy) return true;
  m.hold -= dt; a.speed = 0;
  if (!c || !c.swung) a.faceTo(p.x,p.z);
  if (!c) {
    if (m.hits === 3 && !gear[n.id] && m.hold < 1) a.face(Math.atan2(n.x-p.x,n.z-p.z));
    a.update(dt); return true;
  }
  c.time += dt;
  const swing = (c.time-c.draw)/SWING_TIME;
  if (!c.swung && swing >= 0) {
    c.swung = true; c.yaw = a.targetYaw;
    if (!c.rig) a.play('swing',SWING_TIME);
    Sound.sfx('swing');
  }
  a.update(dt);
  if (c.rig) c.rig.pose(Math.max(0,Math.min(1,c.time/c.draw,1-(c.time-c.draw-SWING_TIME)/c.draw)),
    Math.max(0,Math.min(1,swing)));
  if (!c.struck && swing >= .48) {
    c.struck = true;
    const dx = p.x-n.x, dz = p.z-n.z, distance = Math.hypot(dx,dz);
    if (distance < 1.6 && dx*Math.sin(c.yaw)+dz*Math.cos(c.yaw) > .35*distance && clearPath(p,n)) p.recoilFrom(n);
  }
  if (c.time >= c.draw+SWING_TIME+(c.rig ? c.draw : .20)) {
    if (!c.rig) a.hold(null);
    m.counter = null;
  }
  return true;
}
export function netTalk(n) {
  const m = n?.netMood;
  if (!m || (!m.counter && G.time >= m.until) || m.hits < 2) return false;
  if (m.counter) { UI.toast(n.name+'에게서 한 걸음 물러서세요.'); return true; }
  runScript(async () => {
    n.talking = true;
    try {
      n.actor.faceTo(G.player.x,G.player.z);
      await speak(n,gesture('잠시 멈춰 서서 이쪽을 바라본다.'));
      if (await Dialog.choose(['미안해. 이제 그만할게.','조금 뒤에 올게.'],{cancel:1}) === 0) {
        clearNetMood(n); n.actor.emote('heart',1.2);
        await speak(n,lines[n.id][3]);
      }
    } finally { n.talking = false; }
  });
  return true;
}
