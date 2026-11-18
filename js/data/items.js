// 아이템 목록 — 도구, 과일, 조개, 물고기, 곤충, 화석, 가구, 벽지/바닥, 씨앗 등
import { FLOWER_HEX } from '../gfx/worldview.js';

export const ITEMS = {};
export const FISH = [], BUGS = [];
export const FISH_BY_ID = {}, BUG_BY_ID = {};

const def = (id, o) => { ITEMS[id] = { id, ...o }; return ITEMS[id]; };

export const FRUIT_KO = { apple: '사과', pear: '배', peach: '복숭아', persimmon: '감', mandarin: '귤' };
export const FLOWER_KO = { tulip: '튤립', cosmos: '코스모스', pansy: '팬지', mum: '국화' };
export const COLOR_KO = { red: '빨간', yellow: '노란', white: '하얀', pink: '분홍', orange: '주황', purple: '보라', blue: '파란' };

export const TOOLS = ['tool_net', 'tool_rod', 'tool_shovel', 'tool_axe', 'tool_can'];
def('tool_net', { name: '잠자리채', kind: 'tool', buy: 500, price: 125, model: 'tool_net', desc: '곤충을 잡는 채. 살금살금 다가가서 휘두르자.' });
def('tool_rod', { name: '낚싯대', kind: 'tool', buy: 500, price: 125, model: 'tool_rod', desc: '물고기 그림자 앞에 찌를 던지자.' });
def('tool_shovel', { name: '삽', kind: 'tool', buy: 500, price: 125, model: 'tool_shovel', desc: '땅을 파거나 묻힌 것을 캐낸다.' });
def('tool_axe', { name: '도끼', kind: 'tool', buy: 800, price: 200, model: 'tool_axe', desc: '나무를 벤다. 세 번 찍으면 넘어간다.' });
def('tool_can', { name: '물뿌리개', kind: 'tool', buy: 500, price: 125, model: 'tool_can', desc: '꽃에 물을 주면 다음 날 새 꽃이 필지도.' });

for (const [k, ko] of Object.entries(FRUIT_KO)) def('fruit_' + k, { name: ko, kind: 'fruit', price: 100, stack: 9, model: 'fruit_' + k, scale: 1.6, desc: '나무에서 딴 과일. 먹거나, 심으면 나무가 된다.' });

const SHELLS = [['scallop', '가리비', 120, 10], ['clam', '조개', 60, 14], ['conch', '소라', 350, 6], ['coral', '산호 조각', 250, 5], ['star', '불가사리', 500, 3], ['pearl', '진주조개', 1200, 1]];
export const SHELL_IDS = [];
for (const [k, ko, price, w] of SHELLS) { def('shell_' + k, { name: ko, kind: 'shell', price, w, model: 'shell_' + k, scale: 1.5, desc: '해변에 밀려온 것. 가게에서 사 준다.' }); SHELL_IDS.push('shell_' + k); }

for (const sp of Object.keys(FLOWER_KO)) {
  for (const col of Object.keys(COLOR_KO)) def(`flower_${sp}_${col}`, { name: `${COLOR_KO[col]} ${FLOWER_KO[sp]}`, kind: 'flower', sp, col, price: ['red', 'yellow', 'white'].includes(col) ? 40 : 240, model: 'flower_' + sp, tint: { petal: FLOWER_HEX[col] }, desc: '땅에 심을 수 있는 꽃.' });
  def('seed_' + sp, { name: FLOWER_KO[sp] + ' 씨앗', kind: 'seed', sp, buy: 80, price: 20, model: 'seedbag', tint: { petal: { tulip: 0xf0564e, cosmos: 0xff9fc2, pansy: 0xb07be0, mum: 0xffd84a }[sp] }, desc: '심으면 빨강·노랑·하양 가운데 한 가지 색으로 핀다.' });
}
def('sapling_blossom', { name: '벚나무 묘목', kind: 'sapling', tree: 'blossom', buy: 300, price: 75, model: 'sapling', scale: 1.5, desc: '심으면 며칠에 걸쳐 벚나무로 자란다.' });
def('sapling_pine', { name: '소나무 묘목', kind: 'sapling', tree: 'pine', buy: 300, price: 75, model: 'sapling', scale: 1.5, desc: '심으면 며칠에 걸쳐 소나무로 자란다.' });
def('medicine', { name: '약', kind: 'medicine', buy: 200, price: 50, model: 'medicine', desc: '벌에 쏘였을 때 먹는다.' });
def('weed', { name: '잡초', kind: 'misc', price: 10, stack: 99, model: 'weedbit', desc: '뽑아 온 잡초. 헐값이지만 팔 수는 있다.' });
def('nest', { name: '벌집', kind: 'misc', price: 300, model: 'nest', desc: '말벌이 떠난 빈 집.' });
def('coin', { name: '도토리 주머니', kind: 'coin', value: 100, model: 'bag', desc: '' });
def('parcel', { name: '꾸러미', kind: 'parcel', price: 0, model: 'bundle', desc: '부탁받은 물건. 받을 이웃에게 전해 주자.' });
def('fossil', { name: '화석', kind: 'fossil', price: 200, model: 'fossil', desc: '뭔지 알 수 없다. 박물관의 두루 선생에게 감정을 받자.' });

export const FOSSILS = [
  ['trilobite', '삼엽충', 1300, '고생대 바다에 번성했던 절지동물이에요. 몸이 세로로 세 부분으로 나뉘어 삼엽충이라 부릅니다. 고생대를 알려 주는 표준 화석이지요.'],
  ['ammonite', '암모나이트', 1100, '중생대 바다에 살던 연체동물로, 오징어나 앵무조개의 먼 친척이에요. 중생대의 표준 화석입니다.'],
  ['amber', '호박 속 곤충', 1200, '나무의 진이 굳어 돌처럼 된 것이 호박이에요. 진에 갇힌 곤충이 그대로 보존되기도 합니다.'],
  ['egg', '공룡 알', 1400, '공룡은 알을 낳았어요. 우리나라 남해안에서도 공룡 알 화석이 많이 나옵니다.'],
  ['footprint', '공룡 발자국', 1000, '몸이 아니라 생활한 흔적이 남은 흔적 화석이에요. 걸음 사이의 거리로 빠르기도 짐작할 수 있습니다.'],
  ['trex', '티라노사우루스 이빨', 5000, '중생대 백악기 말의 육식 공룡이에요. 이빨 가장자리가 톱날 같아서 고기를 자르기에 알맞았습니다.'],
  ['horn', '트리케라톱스 뿔', 4500, '뿔 셋과 커다란 목 프릴이 있던 백악기의 초식 공룡이에요.'],
  ['plate', '스테고사우루스 골판', 4000, '등에 골판이 줄지어 서 있던 쥐라기의 초식 공룡이에요. 골판의 쓰임새는 아직도 연구 중입니다.'],
  ['tusk', '매머드 상아', 3000, '신생대 빙하기에 살던 코끼리의 친척이에요. 긴 털과 굽은 상아가 특징이고, 신생대의 표준 화석으로 꼽힙니다.'],
  ['fish', '물고기 화석', 1500, '고운 진흙에 빠르게 묻히면 가시와 지느러미까지 남아요. 그곳이 옛날에 물속이었다는 증거가 됩니다.'],
  ['fern', '고사리 화석', 1200, '고사리는 따뜻하고 습한 곳에서 자라요. 그래서 화석이 나온 곳의 옛 환경을 알려 주는 시상 화석이 됩니다.'],
  ['megalodon', '메갈로돈 이빨', 3500, '신생대 바다에 살던 거대한 상어예요. 뼈가 물렁뼈라서 주로 이빨만 화석으로 남았습니다.'],
];
for (const [k, ko, price, fact] of FOSSILS) def('fossil_' + k, { name: ko, kind: 'fossilid', price, model: 'fossil_' + k, scale: 1.3, fact, desc: '감정을 마친 화석. 박물관에 기증하거나 팔 수 있다.' });

// 가구: [id, 이름, 가로, 세로, 사는 값, 시리즈, 쓰임]
export const FURNITURE = [
  ['f_log_bed', '통나무 침대', 1, 2, 1800, 'log', 'bed'], ['f_log_chair', '통나무 의자', 1, 1, 600, 'log'], ['f_log_table', '통나무 탁자', 2, 1, 1400, 'log'],
  ['f_log_dresser', '통나무 서랍장', 1, 1, 1300, 'log'], ['f_log_shelf', '통나무 책장', 1, 1, 1500, 'log'], ['f_log_stool', '통나무 걸상', 1, 1, 400, 'log'],
  ['f_soban', '소반', 1, 1, 900, 'hanok'], ['f_bangseok', '방석', 1, 1, 500, 'hanok'], ['f_jagaejang', '자개장', 2, 1, 4800, 'hanok'], ['f_byeongpung', '병풍', 2, 1, 3200, 'hanok'],
  ['f_yo', '요와 이불', 1, 2, 1600, 'hanok', 'bed'], ['f_jangdok', '장독', 1, 1, 1100, 'hanok'], ['f_deungjan', '호롱불', 1, 1, 1000, 'hanok', 'lamp'],
  ['f_pastel_bed', '파스텔 침대', 1, 2, 2200, 'pastel', 'bed'], ['f_pastel_sofa', '파스텔 소파', 2, 1, 2400, 'pastel'], ['f_pastel_table', '파스텔 탁자', 1, 1, 1000, 'pastel'],
  ['f_pastel_chair', '파스텔 의자', 1, 1, 700, 'pastel'], ['f_pastel_vanity', '파스텔 화장대', 1, 1, 1600, 'pastel'], ['f_pastel_lamp', '파스텔 스탠드', 1, 1, 1100, 'pastel', 'lamp'],
  ['f_monstera', '몬스테라', 1, 1, 800], ['f_cactus', '선인장', 1, 1, 600], ['f_tv', '텔레비전', 1, 1, 2800, '', 'tv'], ['f_radio', '라디오', 1, 1, 1500, '', 'radio'],
  ['f_fridge', '냉장고', 1, 1, 2600], ['f_stove', '가스레인지', 1, 1, 2200], ['f_desk', '책상', 2, 1, 2000], ['f_piano', '피아노', 2, 1, 5600, '', 'piano'],
  ['f_globe', '지구본', 1, 1, 1300], ['f_fishtank', '어항', 1, 1, 1700], ['f_teddy', '곰 인형', 1, 1, 900], ['f_clock', '괘종시계', 1, 1, 2400],
  ['f_bin', '휴지통', 1, 1, 300], ['f_fan', '선풍기', 1, 1, 1200], ['f_heater', '난로', 1, 1, 1400, '', 'lamp'], ['f_chest', '창고 상자', 1, 1, 1500, '', 'storage'],
  ['f_bookpile', '쌓아 둔 책', 1, 1, 500], ['f_easel', '이젤', 1, 1, 1300], ['f_guitar', '기타', 1, 1, 1900, '', 'guitar'], ['f_flowerpot', '꽃 화분', 1, 1, 500],
  ['f_wintertree', '겨울 트리', 1, 1, 2000], ['f_snowman', '눈사람 장식', 1, 1, 1200],
];
export const SERIES_KO = { log: '통나무', hanok: '한옥', pastel: '파스텔' };
for (const [id, name, w, d, buy, series, use] of FURNITURE) def(id, { name, kind: 'furniture', w, d, buy, price: Math.round(buy / 4), series: series || '', use: use || '', model: id, desc: (series ? SERIES_KO[series] + ' 시리즈. ' : '') + '집 안에 놓을 수 있는 가구.' });

// 벽지·바닥재: 무늬는 js/gfx/roomtex.js가 그린다
export const WALLS = [
  ['wall_cream', '크림색 벽지', 0, '#fff3d6'], ['wall_stripe', '줄무늬 벽지', 900, '#bfe0f2'], ['wall_dot', '물방울 벽지', 900, '#ffd9e2'], ['wall_wood', '나무 판벽', 1200, '#d9b98a'],
  ['wall_hanji', '한지 창살 벽', 1500, '#f5eeda'], ['wall_sky', '하늘 벽지', 1300, '#9fdcf7'], ['wall_brick', '벽돌 벽', 1400, '#d98a6a'], ['wall_forest', '숲속 벽지', 1600, '#8fd16c'],
];
export const FLOORS = [
  ['floor_wood', '나무 마루', 0, '#d9a868'], ['floor_jangpan', '노란 장판', 800, '#e9c46a'], ['floor_tile', '체크 타일', 1000, '#dfe8ee'], ['floor_carpet', '빨간 카펫', 1200, '#c9584a'],
  ['floor_dark', '짙은 마루', 1100, '#8a5a3a'], ['floor_pastel', '파스텔 바닥', 1200, '#c4eadc'], ['floor_stone', '돌바닥', 1300, '#b8b4ac'], ['floor_grass', '잔디 바닥', 1500, '#7fce5a'],
];
for (const [id, name, buy, col] of WALLS) def(id, { name, kind: 'wall', buy: buy || 600, price: Math.round((buy || 600) / 4), model: 'roll', tint: { roll: col }, desc: '집 벽에 바르는 벽지.' });
for (const [id, name, buy, col] of FLOORS) def(id, { name, kind: 'floor', buy: buy || 600, price: Math.round((buy || 600) / 4), model: 'roll', tint: { roll: col }, desc: '집 바닥에 까는 바닥재.' });

/** data/*.json에서 물고기·곤충을 읽어 아이템으로 등록한다 */
export async function loadData() {
  const [fish, bugs] = await Promise.all([fetch('./data/fish.json').then((r) => r.json()), fetch('./data/bugs.json').then((r) => r.json())]);
  for (const f of fish) {
    FISH.push(f); FISH_BY_ID[f.id] = f;
    def('fish_' + f.id, { name: f.name, kind: f.trash ? 'misc' : 'fish', price: f.price, model: 'fish_' + f.id, sp: f.id, scale: 1, desc: f.trash ? '쓰레기. 가게에서 치워 준다.' : '낚은 물고기. 박물관에 기증하거나 팔 수 있다.' });
  }
  for (const b of bugs) {
    BUGS.push(b); BUG_BY_ID[b.id] = b;
    def('bug_' + b.id, { name: b.name, kind: 'bug', price: b.price, model: 'bug_' + b.id, sp: b.id, scale: 1.6, desc: '잡은 곤충. 박물관에 기증하거나 팔 수 있다.' });
  }
}

export const item = (id) => ITEMS[id];
export const itemName = (id) => (ITEMS[id] ? ITEMS[id].name : id);
/** 가게에 팔 때 값. 다른 마을 과일은 비싸다. */
export function sellPrice(id, nativeFruit) {
  const it = ITEMS[id];
  if (!it) return 0;
  if (it.kind === 'fruit') return id === 'fruit_' + nativeFruit ? 100 : 500;
  return it.price || 0;
}
export const isDonatable = (id) => { const k = ITEMS[id] && ITEMS[id].kind; return k === 'fish' || k === 'bug' || k === 'fossilid'; };
