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
| `blend/critters.blend` | 물고기, 곤충 | `assets/models/critters.glb` |
| `blend/chars/<id>.blend` | 캐릭터(한 명씩) | `assets/chars/<id>.glb` |

- 모델은 바둑판처럼 늘어서 있습니다. **맨 위 오브젝트의 이름이 게임이 찾는 이름**이니 바꾸지 마세요(예: `tree_fruit`, `house_a`, `f_log_bed`).
- 내보내기: **File → Export → glTF 2.0**, 형식 **glTF Binary (.glb)**. 묶음 파일은 전체를 한 번에 내보냅니다(늘어놓은 위치는 게임이 무시합니다).
- 단위는 1 = 타일 한 칸. 위는 +Z, 정면은 -Y.
- 건물과 가구는 차지하는 칸의 가운데가 원점입니다.

### 게임이 이름을 보고 다루는 것

- **부위**: `모델이름__부위` 꼴의 자식 오브젝트. 예) `tree_fruit__canopy`(겨울에 벚나무는 이 부위를 숨김), `…__snow`(눈 쌓이는 철에만 보임), `mailbox__flag`(편지가 오면 세움), `lamp__glass`.
- **자리 표시(Empty)**: `tree_fruit__fruit1~3`(열매가 달리는 자리).
- **재질 이름**: 게임이 색을 바꿔 쓰는 재질들.
  - 계절: `leaf`, `leaf_d`, `leaf_l`(과일나무), `bloom…`(벚나무), `pine…`, `big…`(큰 나무), `weed`
  - 주민 집: `roof`, `roof_d`, `wall`, `door`, `door_d`
  - 꽃잎 `petal`, 두루마리 `roll`
  - 밤에 빛남: `window`, `lampglass`

## 2. 스크립트로 다시 만들기

모델은 `tools/blender/*.py` 가 코드로 만든 것입니다. 스크립트를 고치고 실행하면 `.glb` 와 `.blend` 가 함께 다시 만들어집니다.

```bash
pip install bpy            # 블렌더를 파이썬 모듈로 설치(한 번만)
python3 tools/blender/build.py              # 전부
python3 tools/blender/build.py nature       # 한 묶음만
python3 tools/blender/build.py chars        # 캐릭터만
```

- `lib.py` — 도형을 만드는 공통 함수(`ball`, `cyl`, `box`, `tube`, `torus`, `poly` …)와 내보내기
- `nature.py`, `buildings.py`, `furniture.py`, `items.py`, `critters.py`, `chars.py` — 모델 정의
- 물고기·곤충은 `data/fish.json`, `data/bugs.json` 의 `look` 값으로 만들어집니다. 종을 추가하면 모델도 생깁니다.

주의: 블렌더에서 직접 고친 `.blend` 는 스크립트를 다시 돌리면 덮어써집니다. 한쪽 길을 정해 쓰세요.
