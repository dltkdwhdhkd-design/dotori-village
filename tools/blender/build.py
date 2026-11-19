"""모든 모델을 다시 만든다:  python3 tools/blender/build.py [분류...]   (예: build.py buildings chars:dalgom,player)
결과: assets/models/*.glb (게임용), blend/*.blend (블렌더에서 열어 고치는 원본)"""
import sys, os, importlib
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
import lib

CATS = ['nature', 'buildings', 'furniture', 'items', 'critters']


def build_cat(cat):
    lib.reset()
    mod = importlib.import_module(cat)
    importlib.reload(mod)
    mod.build()
    lib.export(os.path.join(ROOT, 'assets/models', cat + '.glb'), os.path.join(ROOT, 'blend', cat + '.blend'))


def build_chars(only=None):
    import chars
    importlib.reload(chars)
    import json
    manifest = {}
    for name, fn in chars.ALL.items():
        if only and not any(k in name for k in only):
            continue
        lib.reset()
        fn(name)
        lib.export(os.path.join(ROOT, 'assets/chars', name + '.glb'), os.path.join(ROOT, 'blend/chars', name + '.blend'))
        manifest[name] = {'file': name + '.glb'}
    mp = os.path.join(ROOT, 'assets/chars/chars.json')
    old = {}
    if os.path.exists(mp):
        old = json.load(open(mp, encoding='utf-8'))
    for k, v in manifest.items():       # 사용자가 바꿔 둔 항목(그림 교체 등)은 건드리지 않는다
        old.setdefault(k, v)
    json.dump(old, open(mp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    want = sys.argv[1:] or CATS + ['chars']
    for c in want:
        if c.startswith('chars'):          # chars 또는 chars:이름,이름 (일부만 다시 만들기)
            build_chars(c.split(':')[1].split(',') if ':' in c else None)
        elif os.path.exists(os.path.join(HERE, c + '.py')):
            print('[%s]' % c)
            build_cat(c)
