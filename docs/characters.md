# 캐릭터 바꾸는 법

캐릭터는 한 명에 파일 하나입니다. `assets/chars/` 안의 파일을 **같은 이름으로 덮어쓰면** 게임 속 모습이 바뀝니다.
어떤 파일을 쓰는지는 `assets/chars/chars.json` 에 적혀 있습니다.

## 캐릭터 목록

| 파일(id) | 이름 | 종 | 성격 |
| --- | --- | --- | --- |
| player_custom | 주인공 — 머리·눈·옷·모자를 갈아 끼우는 모델(아래 '주인공 꾸미기') | 사람 | |
| player_1 ~ player_4 | 예전의 정해진 주인공 네 가지(예전 저장이 쓴다. 거울을 보면 꾸미는 모델로 바뀐다) | 사람 | |
| villager_dalgom | 치이카와 | 작고 귀여운 친구 | 느긋 |
| villager_goran | 하치와레 | 파란 귀 친구 | 수줍 |
| villager_nureong | 우사기 | 토끼 | 열혈 |
| villager_beomi | 랏코 | 해달 | 까칠 |
| villager_jangkki | 쿠리만쥬 | 밤만쥬 친구 | 멋쟁이 |
| villager_pongdang | 시사 | 시사 | 명랑 |
| villager_dungdung | 파자마 그린 | 파자마 파티즈 | 엉뚱 |
| villager_sandeul | 카니짱 | 헌책방 주인 | 다정 |
| villager_dahong | 모몽가 | 날다람쥐 | 새침 |
| villager_kkokki | 파자마 핑크 | 파자마 파티즈 | 열혈 |
| villager_dodam | 파자마 화이트 | 파자마 파티즈 | 느긋 |
| villager_pogeun | 파자마 퍼플 | 파자마 파티즈 | 수줍 |
| npc_kkami | 까미 | 포셰트 갑옷 씨 | 만물상 주인 |
| npc_duru | 두루 선생 | 라멘 갑옷 씨 | 박물관장 |
| npc_ujik | 우직 이장 | 노동 갑옷 씨 | 이장 |

이름·말버릇·성격·집 색은 `js/data/villagers.js`, 대사는 `js/data/talk.js` 에서 바꿉니다.

주민은 나가노의 치이카와 등장인물을 바탕으로 직접 만든 팬 모델입니다. 시설 담당자의 마을 이름은 퀘스트와 편지에서도 쓰입니다. [애니메이션 공식 캐릭터 소개](https://www.anime-chiikawa.jp/chara.html)

## 방법 1 — 3D 모델(.glb)로 바꾸기

1. `blend/chars/<id>.blend` 를 블렌더에서 엽니다(새로 만들어도 됩니다).
2. 고친 뒤 **File → Export → glTF 2.0** 에서 형식을 **glTF Binary (.glb)** 로 하고, `assets/chars/<id>.glb` 로 저장합니다.
3. 저장소에 올리면 끝입니다. `viewer.html?b=chars` 에서 먼저 확인할 수 있습니다.

규격:

- 발바닥이 원점(0,0,0), 정면이 블렌더의 **-Y** 방향, 위가 +Z. (내보낼 때 "+Y Up" 은 켠 그대로)
- 키는 1.3~1.5 정도(지금 캐릭터들은 귀·모자를 빼고 1.35 안팎). 부위 이름이 없는 모델은 게임이 키를 1.4로 자동으로 맞춥니다.
- 색만 쓴 재질, 그림(텍스처)을 입힌 재질 둘 다 됩니다.
- **부위 이름을 붙이면 팔다리가 따로 움직입니다.** 오브젝트 이름 끝을 아래처럼 지으면 됩니다(앞부분은 아무 이름).

| 이름 끝 | 부위 | 원점(회전축)을 둘 곳 |
| --- | --- | --- |
| `__body` | 몸통 | 골반 |
| `__head` | 머리 | 목 |
| `__arm_L`, `__arm_R` | 왼팔, 오른팔 | 어깨 |
| `__leg_L`, `__leg_R` | 왼다리, 오른다리 | 다리가 붙는 곳 |
| `__tail` | 꼬리 | 꼬리가 붙는 곳 |
| `__eyes` | 눈(깜박일 때 위아래로 납작해짐) | 머리의 자식으로, 눈높이에 |
| `__mouth` | 다문 입 | 머리의 자식으로 |
| `__mouth_open` | 벌린 입(말할 때만 보임) | 머리의 자식으로 |
| `__hand` (Empty) | 도구를 쥐는 자리(손 한가운데) | 오른팔의 자식으로 |
| `__top` (Empty) | 머리 위 말풍선 자리 | |

부위 이름이 하나도 없으면(통짜 모델) 걸을 때 몸 전체가 통통 튀고 좌우로 뒤뚱거립니다.
눈·입 부위는 없어도 됩니다(없으면 깜박이지 않고, 말할 때 고개만 살짝 끄덕입니다).
`__hand` 가 있으면 도구를 종류에 맞는 자세로 쥐고 휘두릅니다. 없으면 몸 옆에 세워 듭니다.

### 스크립트로 만들 때 (`tools/blender/chars.py`)

주인공은 `Char` 뼈대를 씁니다. 이웃의 둥근 몸체와 얼굴 무늬, 시설 담당자의 갑옷은 `tools/blender/chiikawa.py`에서 같은 게임용 부위 이름으로 만듭니다. 주인공 모델은 아래 함수들을 차례로 부르는 것으로 만들어집니다.

| 함수 | 하는 일 |
| --- | --- |
| `skull(색)` | 머리통(볼이 통통한 둥근 머리) |
| `patch(색, …)` `muzzle(색, …)` `nose(…)` | 얼굴 아래쪽 밝은 털, 주둥이, 코(+인중) |
| `eyes(모양, …)` | 눈. 모양: `oval` `big` `dot` `pop` `sleepy` `smile` `lash`. 얼굴이 어두우면 `iris=` 나 `white=True` |
| `brows(…)` `mouth(모양)` `blush()` | 눈썹, 입(`smile` `cat` `flat` `o` `wide`), 볼연지 |
| `ears_round / ears_point / ears_side / ears_flop`, `hair_cap` | 귀, 머리카락 |
| `torso(윗옷, 바지, kind=…)` | 옷 입은 몸통. `kind='dress'` 는 원피스 |
| `band()` `buttons()` `emblem()` `dots()` | 줄무늬·단추·가슴 무늬(도토리, 반달, 별 …)·물방울무늬 |
| `arms()` / `wings()`, `legs()` / `birdlegs()` | 팔(새는 날개), 다리(새는 새다리) |
| `done()` | 마무리: 머리·몸 비율을 맞추고 말풍선 자리를 표시 |

머리·몸 비율과 눈 크기는 파일 맨 위의 `HEAD_K`, `BODY_K`, `EYE`, `CHEEK` 숫자로 전체를 한꺼번에 바꿉니다.
한 명만 다시 만들려면 `python3 tools/blender/build.py chars:dalgom` 처럼 이름을 붙입니다.

## 방법 2 — 그림 한 장으로 바꾸기

1. 그림 파일(PNG, 배경 투명)을 `assets/chars/` 에 넣습니다. 예: `assets/chars/my_bear.png`
2. `assets/chars/chars.json` 에서 그 캐릭터의 `"file"` 을 그림 파일 이름으로 바꿉니다.

```json
"villager_dalgom": { "file": "my_bear.png" }
```

규격:

- 정면을 보고 서 있는 그림, 발이 그림 **맨 아래**에 닿게.
- 크기는 자유(256×256 이상 권장). 가로세로 비율대로 서고, 키는 1.4로 맞춰집니다.
- 160픽셀 이하의 작은 그림은 도트 그림으로 보고 또렷하게 확대합니다.
- 그림 캐릭터는 늘 화면을 바라보며, 걸을 때 통통 튀고 가는 방향에 따라 좌우가 뒤집힙니다.

`tools/blender/build.py` 로 모델을 다시 만들어도 `chars.json` 에서 바꿔 둔 항목은 그대로 남습니다.

## 주인공 꾸미기 (`player_custom`)

주인공은 부위를 갈아 끼우는 모델 하나(`assets/chars/player_custom.glb`)를 쓴다. 게임이 고른 부위만 보이게 하고 색을 입힌다.
시작할 때 '이사 준비' 화면에서, 그 뒤로는 집 안 **거울**(전신 거울, 파스텔 화장대) 앞에서 Space로 바꾼다.

| 고르는 것 | 가짓수 | 모델의 부위 이름 |
| --- | --- | --- |
| 얼굴형 | 기본형·동그란 얼굴·갸름한 얼굴 | 머리와 머리에 붙은 부위의 가로·세로 비율 |
| 눈썹 · 코 | 각각 3 | `brow1`~`brow3`, `nose1`~`nose3` |
| 머리 모양 | 12 | `hair1`~`hair12` (+ `hairfr1`~ 앞머리, `hairtop1`~ 윗머리) |
| 눈 | 7 | `eyes1`~`eyes7` |
| 입 | 5 | `mouth1`~`mouth5` (말할 때 입 `mouth_open` 은 함께 쓴다) |
| 볼 | 없음·발그레·주근깨·둘 다 | `blush`, `freckle` |
| 옷 | 6 | `top1`~`top6` + 소매 `sls_L/R`(짧은) `sll_L/R`(긴) + 다리 `pants_L/R` `shorts_L/R` `sock_L/R` |
| 모자·머리 장식 | 없음 + 7 | `hat1`~`hat7` |
| 안경 | 없음 + 3 | `glass1`~`glass3` |
| 색 | 피부 7, 머리색 11, 눈 색 6, 윗옷·아래옷·모자 색 13, 신발 색 6 | 재질 `p_skin p_nose p_hair p_eye p_top p_top2 p_bot p_shoe p_hat p_hat2` |

- 무엇을 고를 수 있는지(이름, 색, 어떤 옷이 긴소매인지, 어떤 모자가 머리를 덮는지)는 `js/game/look.js` 의 표에 있다. 고른 모습은 숫자 묶음으로 저장된다(`S.player.look`).
- 모델은 `tools/blender/chars.py` 의 `custom()` 이 만든다. 다시 만들기: `python3 tools/blender/build.py chars:player_custom`
- **가짓수를 늘리려면**: ① `custom()` 에 같은 규칙으로 부위를 더한다(예: `hp('hair13')` 안에 머리카락을 만든다) → ② `look.js` 의 표(`HAIR` 등)에 이름을 한 줄 더한다 → ③ 다시 만들고 `catalog.html?b=looks` 에서 확인한다.
  - 머리카락은 세 조각으로 나뉜다: 늘 보이는 `hairN`, 푹 눌러쓰는 모자(챙 모자·밀짚모자·털모자)를 쓰면 숨기는 앞머리 `hairfrN`, 모자를 쓰면 숨기는 윗머리 `hairtopN`. 이렇게 해야 모자를 뚫고 나오지 않는다.
  - 색이 바뀌어야 하는 면은 위의 `p_*` 재질로 만든다. 새 재질을 만들었으면 `tools/blender/lib.py` 의 `PALETTE` 와 `js/gfx/models.js` 의 `DYNAMIC`, `look.js` 의 `tintOf` 에 넣는다.
- **확인하는 화면**: `catalog.html?b=looks` — 머리 모양(앞·뒤), 눈, 입, 볼, 안경, 옷(앞·뒤), 모자(앞·옆), 색을 전부 늘어놓는다. `&part=hair|back|face|wear|hat|color` 로 한 갈래만 볼 수 있다.
- 주인공을 통짜 모델이나 그림 한 장으로 바꾸고 싶으면 `chars.json` 의 `player_custom` 항목을 바꾸면 된다. 그 경우 갈아 끼울 부위가 없으므로 꾸미기에서 골라도 모습은 바뀌지 않는다.
