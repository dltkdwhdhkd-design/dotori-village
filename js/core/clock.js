// 실제 시계와 이어진 게임 시간 — 날짜, 계절, 날씨, 해 뜨고 지는 시각
import { hash01, clamp } from './util.js';

export const Clock = {
  offsetMin: 0,          // 설정에서 조정하는 시간(분)
  advanceMs: 0,          // 이 마을에서 보낸 추가 시간
  frozen: null,          // 테스트용: 고정 시각(Date)
  seed: 1,
  now() { return new Date((this.frozen?.getTime() ?? Date.now()) + this.offsetMin * 60000 + this.advanceMs); },
};

const DAY = 86400000;
/** 하루는 새벽 5시에 바뀐다. 날짜 번호(정수). */
export function dayKey(d = Clock.now()) {
  const calendarDay = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY);
  return calendarDay - (d.getHours() < 5 ? 1 : 0);
}
export function dateOfDay(k) { const d = new Date(k * DAY); return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12); }
export const hourF = (d = Clock.now()) => d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const SEASON_KO = { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' };
export function season(d = Clock.now()) {
  const m = d.getMonth() + 1;
  return m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter';
}
/** 화면에 쓰는 세부 계절: 벚꽃철, 단풍철, 눈 쌓인 겨울 */
export function seasonLook(d = Clock.now()) {
  const m = d.getMonth() + 1, day = d.getDate();
  const s = season(d);
  return {
    season: s,
    blossom: m === 4 && day <= 12,
    foliage: (m === 10 && day >= 15) || m === 11,
    snow: (m === 12 && day >= 8) || m === 1 || (m === 2 && day <= 24),
  };
}

const SUN = { spring: [6.0, 18.8], summer: [5.3, 19.8], autumn: [6.3, 17.9], winter: [7.5, 17.4] };
export function sunTimes(d = Clock.now()) { return SUN[season(d)]; }
/** 0=한밤, 1=한낮. 해 뜰 녘/질 녘 한 시간 남짓 동안 부드럽게 바뀐다. */
export function daylight(d = Clock.now()) {
  const [rise, set] = sunTimes(d), h = hourF(d);
  const a = clamp((h - (rise - 0.7)) / 1.4, 0, 1), b = clamp(((set + 0.7) - h) / 1.4, 0, 1);
  return Math.min(a, b);
}
/** 노을 정도(0~1) */
export function twilight(d = Clock.now()) {
  const [rise, set] = sunTimes(d), h = hourF(d);
  return Math.max(clamp(1 - Math.abs(h - rise) / 0.9, 0, 1), clamp(1 - Math.abs(h - set) / 0.9, 0, 1));
}
export const isNight = (d = Clock.now()) => daylight(d) < 0.35;

/** 날씨: 'clear' | 'cloudy' | 'rain' | 'snow' — 날짜와 마을 씨앗으로 정해진다 */
export function weatherAt(d = Clock.now()) {
  const k = dayKey(d), m = d.getMonth() + 1, day = d.getDate(), h = d.getHours();
  const r = hash01(Clock.seed, k, 11);
  let pWet = 0.2;
  if ((m === 6 && day >= 20) || (m === 7 && day <= 20)) pWet = 0.55;      // 장마
  if (m === 9 || m === 10) pWet = 0.14;
  const winter = m === 12 || m <= 2;
  let kind = 'clear';
  if (r < pWet) kind = winter ? 'snow' : 'rain';
  else if (r < pWet + 0.25) kind = 'cloudy';
  if (kind === 'rain' || kind === 'snow') {
    const start = Math.floor(hash01(Clock.seed, k, 12) * 18) + 5;            // 5~22시 사이 시작
    const len = 4 + Math.floor(hash01(Clock.seed, k, 13) * 12);
    const hh = (h + 24 - 5) % 24 + 5;                                        // 5시 기준 하루
    if (hh < start || hh >= start + len) kind = 'cloudy';
  }
  return kind;
}
export const WEATHER_KO = { clear: '맑음', cloudy: '흐림', rain: '비', snow: '눈' };

const WD = ['일', '월', '화', '수', '목', '금', '토'];
export function dateLabel(d = Clock.now()) { return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WD[d.getDay()]})`; }
export function timeLabel(d = Clock.now()) {
  const h = d.getHours(), m = d.getMinutes();
  return `${h < 12 ? '오전' : '오후'} ${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}`;
}
export function inMonths(list, d = Clock.now()) { return list === 'all' || list.includes(d.getMonth() + 1); }
export function inHours(ranges, d = Clock.now()) {
  if (ranges === 'all') return true;
  const h = d.getHours();
  return ranges.some(([a, b]) => (a <= b ? h >= a && h < b : h >= a || h < b));
}
