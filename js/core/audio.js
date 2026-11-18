// 소리: 효과음과 배경음을 전부 그 자리에서 합성한다(음원 파일 없음). 곡은 이 게임용으로 만든 것.
let ctx = null, master = null, bgmG = null, sfxG = null, noiseBuf = null;
let vol = { bgm: 0.5, sfx: 0.7 };
let mood = null, timer = null, nextT = 0, step = 0;

function ensure() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  try {
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    bgmG = ctx.createGain(); bgmG.gain.value = vol.bgm * 0.5; bgmG.connect(master);
    sfxG = ctx.createGain(); sfxG.gain.value = vol.sfx; sfxG.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { ctx = null; return false; }
  return true;
}

function tone(freq, t, dur, { type = 'sine', gain = 0.2, to = null, dest = null, attack = 0.005 } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest || sfxG);
  o.start(t); o.stop(t + dur + 0.02);
}
function noise(t, dur, { gain = 0.2, f0 = 2000, f1 = null, q = 1, type = 'bandpass' } = {}) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t);
  if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(sfxG);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}

const SFX = {
  step: (t, o) => noise(t, 0.07, { gain: 0.05, f0: o.sand ? 900 : o.wood ? 400 : 1700, q: 0.8 }),
  ui: (t) => tone(880, t, 0.06, { type: 'triangle', gain: 0.12 }),
  open: (t) => { tone(520, t, 0.08, { type: 'triangle', gain: 0.12 }); tone(780, t + 0.06, 0.1, { type: 'triangle', gain: 0.12 }); },
  close: (t) => { tone(700, t, 0.07, { type: 'triangle', gain: 0.1 }); tone(480, t + 0.05, 0.09, { type: 'triangle', gain: 0.1 }); },
  pick: (t) => tone(500, t, 0.12, { type: 'sine', gain: 0.2, to: 1000 }),
  drop: (t) => tone(420, t, 0.12, { type: 'sine', gain: 0.18, to: 200 }),
  swing: (t) => noise(t, 0.22, { gain: 0.16, f0: 600, f1: 3200, q: 1.2 }),
  dig: (t) => { noise(t, 0.14, { gain: 0.24, f0: 500, f1: 150, q: 0.9 }); tone(110, t, 0.12, { gain: 0.2, to: 60 }); },
  chop: (t) => { noise(t, 0.08, { gain: 0.3, f0: 1400, q: 1.5 }); tone(180, t, 0.1, { type: 'square', gain: 0.1, to: 90 }); },
  shake: (t) => { for (let i = 0; i < 4; i++) noise(t + i * 0.07, 0.09, { gain: 0.1, f0: 3000 + i * 300, q: 0.7 }); },
  plop: (t) => { tone(300, t, 0.14, { gain: 0.2, to: 110 }); noise(t, 0.2, { gain: 0.08, f0: 1200, f1: 500 }); },
  nibble: (t) => tone(1300, t, 0.05, { type: 'triangle', gain: 0.1, to: 900 }),
  bite: (t) => { tone(220, t, 0.25, { gain: 0.3, to: 80 }); noise(t, 0.35, { gain: 0.22, f0: 1600, f1: 500 }); tone(1200, t + 0.02, 0.12, { type: 'square', gain: 0.07 }); },
  reel: (t) => { for (let i = 0; i < 5; i++) tone(700 + i * 90, t + i * 0.05, 0.05, { type: 'square', gain: 0.05 }); },
  catch: (t) => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, t + i * 0.08, 0.3, { type: 'triangle', gain: 0.17 })),
  fanfare: (t) => [392, 523, 659, 784, 659, 1047].forEach((f, i) => tone(f, t + i * 0.11, 0.34, { type: 'triangle', gain: 0.16 })),
  fail: (t) => { tone(330, t, 0.16, { type: 'triangle', gain: 0.15, to: 250 }); tone(220, t + 0.14, 0.24, { type: 'triangle', gain: 0.15, to: 160 }); },
  coin: (t) => { tone(1318, t, 0.08, { type: 'square', gain: 0.07 }); tone(1760, t + 0.07, 0.22, { type: 'square', gain: 0.07 }); },
  door: (t) => { tone(190, t, 0.14, { type: 'triangle', gain: 0.2, to: 140 }); noise(t + 0.1, 0.12, { gain: 0.1, f0: 500, q: 0.6 }); },
  alert: (t) => { tone(988, t, 0.09, { type: 'square', gain: 0.09 }); tone(1319, t + 0.09, 0.16, { type: 'square', gain: 0.09 }); },
  sting: (t) => { tone(620, t, 0.3, { type: 'sawtooth', gain: 0.12, to: 180 }); tone(655, t, 0.3, { type: 'sawtooth', gain: 0.1, to: 200 }); },
  buzz: (t) => tone(210, t, 0.5, { type: 'sawtooth', gain: 0.06 }),
  water: (t) => { for (let i = 0; i < 3; i++) noise(t + i * 0.09, 0.14, { gain: 0.08, f0: 2400 - i * 300, q: 2 }); },
  flutter: (t) => noise(t, 0.12, { gain: 0.07, f0: 4200, q: 3 }),
  bonk: (t) => { tone(160, t, 0.12, { type: 'square', gain: 0.14, to: 110 }); noise(t, 0.05, { gain: 0.2, f0: 2600, q: 2 }); },
  save: (t) => [659, 784, 988].forEach((f, i) => tone(f, t + i * 0.09, 0.24, { type: 'sine', gain: 0.14 })),
  letter: (t) => { tone(784, t, 0.1, { type: 'triangle', gain: 0.13 }); tone(1047, t + 0.1, 0.2, { type: 'triangle', gain: 0.13 }); },
};

// ---------------------------------------------------------------- 배경음
// 5음 음계(도레미솔라) 위에서 직접 지은 짧은 가락들. 숫자는 음계의 몇 번째 음인지, null은 쉼.
const SCALE = [0, 2, 4, 7, 9];
const deg = (n, oct = 0) => 261.63 * Math.pow(2, (SCALE[((n % 5) + 5) % 5] + 12 * (Math.floor(n / 5) + oct)) / 12);
const MOODS = {
  morning: { bpm: 96, bass: [0, 3, 2, 4], mel: [2, null, 4, 5, 7, null, 5, 4, 2, 4, null, 2, 1, null, 0, null, 3, null, 5, 7, 8, null, 7, 5, 4, null, 5, 4, 2, null, null, null], wave: 'triangle' },
  day: { bpm: 108, bass: [0, 2, 3, 4], mel: [5, 4, 2, 4, 5, null, 7, null, 8, 7, 5, 4, 5, null, null, 2, 4, 5, 7, 5, 4, null, 2, null, 0, 2, 4, 2, 0, null, null, null], wave: 'triangle' },
  evening: { bpm: 84, bass: [0, 4, 2, 3], mel: [4, null, null, 5, 4, null, 2, null, 1, null, 2, 4, null, null, null, null, 5, null, null, 7, 5, null, 4, null, 2, null, 4, 2, 0, null, null, null], wave: 'sine' },
  night: { bpm: 66, bass: [0, 2, 4, 2], mel: [7, null, null, null, 5, null, 4, null, null, null, 2, null, 4, null, null, null, 5, null, null, null, 4, null, 2, null, 0, null, null, null, null, null, null, null], wave: 'sine' },
  indoor: { bpm: 92, bass: [0, 3, 4, 3], mel: [0, 2, 4, null, 2, 4, 5, null, 4, 2, 0, null, 2, null, null, null, 4, 5, 7, null, 5, 4, 2, null, 4, 2, 0, null, null, null, null, null], wave: 'triangle' },
};
function schedule() {
  if (!ctx || !mood) return;
  const m = MOODS[mood];
  const spb = 60 / m.bpm / 2;                           // 8분음표 길이
  while (nextT < ctx.currentTime + 0.35) {
    const i = step % 32;
    const n = m.mel[i];
    if (n != null) tone(deg(n, 1), nextT, spb * 2.4, { type: m.wave, gain: 0.11, dest: bgmG, attack: 0.01 });
    if (i % 8 === 0) {
      const b = m.bass[(i / 8) | 0];
      tone(deg(b, -1), nextT, spb * 7, { type: 'sine', gain: 0.13, dest: bgmG, attack: 0.03 });
      tone(deg(b + 2, 0), nextT, spb * 7, { type: 'sine', gain: 0.045, dest: bgmG, attack: 0.08 });
    }
    if (i % 4 === 2) tone(deg(m.bass[(i / 8) | 0] + 4, 0), nextT, spb * 1.5, { type: 'sine', gain: 0.035, dest: bgmG, attack: 0.01 });
    nextT += spb; step++;
  }
}

export const Sound = {
  /** 처음 키를 누르거나 클릭할 때 한 번 부른다 */
  unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); },
  setVolume(bgm, sfx) { vol = { bgm, sfx }; if (ctx) { bgmG.gain.value = bgm * 0.5; sfxG.gain.value = sfx; } },
  sfx(name, opts = {}) {
    if (!ctx || ctx.state !== 'running' || vol.sfx <= 0) return;
    const f = SFX[name]; if (f) f(ctx.currentTime + 0.001, opts);
  },
  /** 말소리: 글자마다 짧게 울린다 */
  voice(pitch = 1, ch = '') {
    if (!ctx || ctx.state !== 'running' || vol.sfx <= 0) return;
    const code = ch ? ch.charCodeAt(0) : 0;
    const f = 300 * pitch * (1 + ((code % 7) - 3) * 0.045);
    tone(f, ctx.currentTime, 0.055, { type: 'triangle', gain: 0.07, to: f * 0.92 });
  },
  music(m) {
    if (m === mood) return;
    mood = m;
    if (!ctx) return;
    step = 0; nextT = ctx.currentTime + 0.4;
    if (!timer) timer = setInterval(schedule, 120);
  },
  tick() { if (ctx && mood && !timer) { nextT = ctx.currentTime + 0.2; timer = setInterval(schedule, 120); } },
};
