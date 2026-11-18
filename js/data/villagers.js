// 주민과 시설 담당 캐릭터 — 전부 이 게임의 오리지널 캐릭터
// 이름·말버릇·성격은 여기서 바꿀 수 있다. 모습은 assets/chars/<id>.glb
export const PERSONALITY = {
  lazy: { ko: '느긋', wake: 9, sleep: 23.5, pitch: 0.78 },
  shy: { ko: '수줍', wake: 7, sleep: 22.5, pitch: 1.3 },
  jock: { ko: '열혈', wake: 6, sleep: 24.5, pitch: 0.98 },
  cranky: { ko: '까칠', wake: 10, sleep: 27, pitch: 0.62 },
  smug: { ko: '멋쟁이', wake: 8, sleep: 26, pitch: 0.9 },
  peppy: { ko: '명랑', wake: 7.5, sleep: 25, pitch: 1.5 },
  odd: { ko: '엉뚱', wake: 9.5, sleep: 25.5, pitch: 1.1 },
  kind: { ko: '다정', wake: 6.5, sleep: 23, pitch: 1.18 },
  snooty: { ko: '새침', wake: 9, sleep: 26.5, pitch: 1.36 },
};

export const VILLAGERS = {
  dalgom: { name: '달곰', species: '반달곰', p: 'lazy', catch: '곰곰', bday: [2, 14], house: 'house_a', roof: '#f2c230', wall: '#fff3d6', door: '#8a5a3a', set: 'log', likes: ['fruit', 'fish'] },
  goran: { name: '고란', species: '고라니', p: 'shy', catch: '고란', bday: [5, 8], house: 'house_b', roof: '#6aa5f2', wall: '#fffaf0', door: '#c98a5a', set: 'pastel', likes: ['flower', 'shell'] },
  nureong: { name: '누렁', species: '누렁이', p: 'jock', catch: '멍', bday: [8, 15], house: 'house_a', roof: '#e8574c', wall: '#fff3d6', door: '#7a5030', set: 'log', likes: ['fish', 'bug'] },
  beomi: { name: '범이', species: '호랑이', p: 'cranky', catch: '어흥', bday: [11, 3], house: 'house_a', roof: '#5a4a3a', wall: '#ecdcb8', door: '#3a2a22', set: 'hanok', likes: ['fish', 'furniture'] },
  jangkki: { name: '장끼', species: '꿩', p: 'smug', catch: '꿩', bday: [4, 1], house: 'house_b', roof: '#1f7a5e', wall: '#fff3d6', door: '#8a5a3a', set: 'hanok', likes: ['furniture', 'flower'] },
  pongdang: { name: '퐁당', species: '개구리', p: 'peppy', catch: '퐁', bday: [6, 21], house: 'house_b', roof: '#84d15e', wall: '#fffbe8', door: '#e88aa8', set: 'pastel', likes: ['flower', 'bug'] },
  dungdung: { name: '둥둥', species: '청둥오리', p: 'odd', catch: '둥', bday: [9, 9], house: 'house_a', roof: '#3fa39a', wall: '#f0f6f4', door: '#e8a83c', set: 'pastel', likes: ['shell', 'fish'] },
  sandeul: { name: '산들', species: '염소', p: 'kind', catch: '매', bday: [3, 12], house: 'house_a', roof: '#6fb86a', wall: '#fff3d6', door: '#8a6a4a', set: 'hanok', likes: ['flower', 'fruit'] },
  dahong: { name: '다홍', species: '여우', p: 'snooty', catch: '홍', bday: [10, 25], house: 'house_b', roof: '#b07be0', wall: '#fff0f4', door: '#7a4a8a', set: 'pastel', likes: ['furniture', 'shell'] },
  kkokki: { name: '꼬끼', species: '수탉', p: 'jock', catch: '꼬꼬', bday: [1, 1], house: 'house_a', roof: '#d98a3c', wall: '#fff3d6', door: '#96421f', set: 'log', likes: ['bug', 'fruit'] },
  dodam: { name: '도담', species: '돼지', p: 'lazy', catch: '꿀', bday: [7, 7], house: 'house_b', roof: '#f8a6b8', wall: '#fff8f0', door: '#c97a86', set: 'log', likes: ['fruit', 'furniture'] },
  pogeun: { name: '포근', species: '양', p: 'shy', catch: '메', bday: [12, 12], house: 'house_b', roof: '#e9a3b4', wall: '#fffaf0', door: '#8a6a5a', set: 'pastel', likes: ['flower', 'fruit'] },
};
export const VILLAGER_IDS = Object.keys(VILLAGERS);

export const NPCS = {
  kkami: { name: '까미', species: '까치', role: '만물상 주인', pitch: 1.25, model: 'npc_kkami' },
  duru: { name: '두루 선생', species: '두루미', role: '박물관장', pitch: 0.85, model: 'npc_duru' },
  ujik: { name: '우직 이장', species: '황소', role: '이장', pitch: 0.6, model: 'npc_ujik' },
};

/** 주민 집 안에 놓이는 가구(시리즈별 기본 배치). [가구 id, x, y] — 방은 6×5칸 */
export const HOME_LAYOUT = {
  log: [['f_log_bed', 0, 0], ['f_log_dresser', 1, 0], ['f_log_shelf', 5, 0], ['f_log_table', 2, 2], ['f_log_chair', 4, 2], ['f_log_stool', 1, 3], ['f_monstera', 5, 4], ['f_radio', 3, 0]],
  hanok: [['f_yo', 0, 0], ['f_jagaejang', 2, 0], ['f_byeongpung', 4, 0], ['f_soban', 3, 2], ['f_bangseok', 2, 2], ['f_bangseok', 4, 2], ['f_jangdok', 5, 4], ['f_deungjan', 1, 0]],
  pastel: [['f_pastel_bed', 5, 0], ['f_pastel_vanity', 0, 0], ['f_pastel_lamp', 4, 0], ['f_pastel_sofa', 1, 2], ['f_pastel_table', 3, 3], ['f_pastel_chair', 4, 3], ['f_flowerpot', 0, 4], ['f_tv', 2, 0]],
};
export const HOME_STYLE = { log: ['wall_wood', 'floor_wood'], hanok: ['wall_hanji', 'floor_jangpan'], pastel: ['wall_dot', 'floor_pastel'] };
