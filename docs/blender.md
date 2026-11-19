# 블렌더 작업 안내

게임 속 3D 모델은 전부 블렌더로 만듭니다. 길은 두 가지입니다.

## 1. 블렌더에서 열어 고치기

`blend/` 폴더의 파일을 블렌더(5.x)에서 엽니다.

| 파일 | 내용 | 내보낼 곳 |
| --- | --- | --- |
| `blend/nature.blend` | 나무, 꽃, 돌, 과일, 조개 | `assets/models/nature.glb` |
| `blend/buildings.blend` | 집, 가게, 박물관, 마을회관, 다리, 시설물 | `assets/models/buildings.glb` |
| `blend/furniture.blend` | 가구, 실내 소품 | `assets/models/furniture.glb` |
| `blend/items.blend` | 도구, 화석, 잡동사니 | `assets/models/items.glb` |
| `blend/fish.blend` | 물고기와 물속 생물 80종, 물고기 그림자 | `assets/models/fish.glb` |
| `blend/bugs.blend` | 곤충 80종 | `assets/models/bugs.glb` |
| `blend/chars/<id>.blend` | 캐릭터(한 명씩) | `assets/chars/<id>.glb` |

- 모델은 바둑판처럼 늘어서 있습니다. **맨 위 오브젝트의 이름이 게임이 찾는 이름**이니 바꾸지 마세요(예: `tree_fruit`, `house_a`, `f_log_bed`).
- 내보내기: **File → Export → glTF 2.0**, 형식 **glTF Binary (.glb)**. 묶음 파일은 전체를 한 번에 내보냅니다(늘어놓은 위치는 게임이 무시합니다).
- 단위는 1 = 타일 한 칸. 위는 +Z, 정면은 -Y.
- 건물과 가구는 차지하는 칸의 가운데가 원점입니다.

### 게임이 이름을 보고 다루는 것

- **부위**: `모델이름__부위` 꼴의 자식 오브젝트. 예) `tree_fruit__canopy`(겨울에 벚나무는 이 부위를 숨김), `…__snow`(눈 쌓이는 철에만 보임), `mailbox__flag`(편지가 오면 세움), `lamp__glass`.
- **자리 표시(Empty)**: `tree_fruit__fruit1~3`(열매가 달리는 자리), `tool_rod__tip`(낚싯줄이 나가는 낚싯대 끝).
- **재질 이름**: 게임이 색을 바꿔 쓰는 재질들.
  - 계절: `leaf`, `leaf_d`, `leaf_l`(과일나무), `bloom…`(벚나무), `pine…`, `big…`(큰 나무), `weed`, `tuft`, `tuft_l`(풀포기)
  - 주민 집: `roof`, `roof_d`, `wall`, `wall_d`, `door`, `door_d`
  - 꽃잎 `petal`, 두루마리 `roll`
  - 밤에 빛남: `window`, `lampglass`
  - 이 이름들 말고는 색이 고정된 것으로 보고, 게임이 불러올 때 한 덩어리로 합쳐 그립니다. 새로 '색이 바뀌는 재질'을 만들면 `js/gfx/models.js` 의 `DYNAMIC` 목록에 이름을 넣으세요.
- **도구**(`tool_net` 등): 쥐는 곳이 원점, 자루는 위(+Z)로, 일하는 쪽(날·주둥이·그물 입구)은 -Y. 게임이 종류별 자세로 쥡니다.
- **풀포기**(`grass_a`, `grass_b`, `grass_f`): 게임이 풀밭 곳곳에 수천 개를 흩뿌립니다. 작고 단순하게 유지하세요.

## 2. 스크립트로 다시 만들기

모델은 `tools/blender/*.py` 가 코드로 만든 것입니다. 스크립트를 고치고 실행하면 `.glb` 와 `.blend` 가 함께 다시 만들어집니다.

```bash
pip install bpy            # 블렌더를 파이썬 모듈로 설치(한 번만)
python3 tools/blender/build.py              # 전부
python3 tools/blender/build.py nature       # 한 묶음만
python3 tools/blender/build.py chars        # 캐릭터만
python3 tools/blender/build.py chars:dalgom,player   # 이름에 그 글자가 든 캐릭터만
```

- `lib.py` — 도형을 만드는 공통 함수(`ball`, `cyl`, `box`, `tube`, `torus`, `poly`, 회전체 `lathe`, 반구 `dome`, 고리 조각 `arc` …)와 내보내기. `m.part(이름, 축, parent='head')` 처럼 부위에 부모를 줄 수 있습니다.
- `bkit.py` — 건물 부품: 겹쳐 얹은 박공지붕 `gable`, 창 `win`(십자·아치·둥근 창, 덧문, 화분 상자), 문 `door`, 계단, 굴뚝, 벽등, 덤불, 화분. `Frame` 으로 부품을 돌려 놓습니다(옆으로 난 지붕, 둥근 벽의 창).
- `nature.py`, `buildings.py`, `furniture.py`, `items.py`, `critters.py`, `chars.py` — 모델 정의
  - `buildings.py`: 주민 집 `house_a`(회벽 오두막)·`house_b`(통나무집)·`house_c`(기와집), 주인공의 도토리 집 `home_1~3`, `shop`, `museum`, `hall`, 다리·부두·시설물. 기와지붕은 `giwa_roof`, 도토리 지붕은 `acorn_cap`.
  - `chars.py`: 캐릭터. 만드는 법은 [characters.md](characters.md) 참고.
- 물고기·곤충은 `data/fish.json`, `data/bugs.json` 의 `look` 값으로 만들어집니다. 종을 추가하면 모델도 생깁니다.

주의: 블렌더에서 직접 고친 `.blend` 는 스크립트를 다시 돌리면 덮어써집니다. 한쪽 길을 정해 쓰세요.


## 생물(물고기·곤충): 종마다 그림을 그려 입힌다

물고기와 곤충은 손으로 모양을 하나하나 깎지 않고, **종마다 그림 한 장을 그려서 같은 윤곽의 몸에 입히는** 방식으로 만든다.
그림은 Pillow로 그리고(`paint.py`), 몸의 꼭짓점 위치를 그대로 그림 위의 자리로 쓴다(평면 투영). 그래서 그림에 그린 무늬가 모델의 같은 자리에 나타난다.

| 파일 | 하는 일 |
| --- | --- |
| `paint.py` | 그림판 `Canvas`(모델 좌표로 그리기, 투명도, 좌우 대칭), 그림 재질 `tex_material` |
| `fishkit.py` | 옆모습 물고기. `FAMILY` 에 무리별 기본 체형(피라미형, 잉어형, 송어형, 농어형, 돔형, 고등어형, 다랑어형, 넙치형, 상어형 …)이 있고, 종의 `look` 이 그 값을 덮어쓴다 |
| `topkit.py` | 위에서 본 그림을 입히는 공통 틀 `Top` 과, 게·가재·거북·가오리·개구리·올챙이·아귀·해파리 |
| `bugkit.py` | 곤충. 나비(`WING` 날개 윤곽 + 무늬), 잠자리, 매미, 벌, 딱정벌레(뿔·큰턱·더듬이·등판 무늬), 메뚜기, 사마귀, 노린재, 물속 노린재, 거미 … |
| `critters.py` | `data/fish.json`, `data/bugs.json` 을 읽어 종마다 `look.f`(틀 이름)에 맞는 함수로 모델을 만든다 |

종을 더하거나 고치는 법
1. `data/fish.json` (또는 `bugs.json`)에 한 줄을 더한다. 철·시간·값은 다른 줄을 본뜨고, 생김새는 `look` 에 적는다.
2. `python3 tools/blender/build.py fish` (또는 `bugs`). 그림은 `/tmp/dotori_tex/` 에도 저장되니 열어서 바로 확인할 수 있다.
3. `catalog.html?b=fish` (곤충은 `?b=bugs`)로 모든 종을 한 칸씩 늘어놓고 확인한다. 한 종만 볼 때는 `&m=<id>`.
   **종을 고치면 반드시 이 화면으로 확인할 것.** 그림(텍스처)만 보고 넘어갔다가 둥근 꼬리지느러미가 엉뚱한 자리에 그려지는 오류를 놓친 적이 있다.

물고기 `look` 의 주요 값: `f` 무리, `len` 길이(칸), `dep` 몸높이, `col` [등, 옆구리, 배], `fin` 지느러미 색, `d/d2/a` 지느러미 [시작, 끝, 높이, 모양], `c` 꼬리 [모양, 폭, 파임],
`pat` 무늬 목록(`bars` 세로띠, `spots` 점, `stripe` 가로줄, `wavy` 물결, `blotch` 얼룩, `scales` 비늘, `parr` 타원 무늬, `ocellus` 눈알 무늬, `dotrows` 점줄, `lines`, `scutes`, `grid` …). 값의 뜻은 `fishkit.py` 맨 위와 `patterns()` 의 주석에 있다.

나비 `look`: `w` 날개 윤곽 틀, `span` 편 날개 길이, `base`/`hbase` 앞·뒷날개 바탕색, `pat` 무늬(자리는 `a` 앞가장자리 0→뒷가장자리 1, `r` 밑동 0→바깥 1 로 적는다. `bugkit.py` 의 `wing_patterns` 주석 참고).
딱정벌레 `look`: `len`, `w` 폭, `col`/`pc`/`hc` 딱지날개·앞가슴·머리 색, `horn` (`rhino`, `stag`, `saw`, `flat`, `king`, `antler`, `snout`), `ant` 더듬이, `pat`/`ppat` 등판 무늬(`_surface_pat` 주석 참고).

비치는 날개(잠자리·매미·벌)는 투명도가 있는 둘째 그림(`txa_<id>`)을 쓴다. 날개는 `wing_L` / `wing_R` 부위로 따로 두어 게임에서 퍼덕인다.
