"""도토리 마을 — 블렌더 모델 제작용 공통 도구.

모든 모델은 이 파일의 함수로 '코드에서' 만든다. (블렌더 5.x, bpy 모듈)
- 단위: 1 = 타일 한 칸.  Z가 위, 정면은 -Y (glTF로 내보내면 +Z가 정면)
- 모델 하나 = 이름 붙은 루트. 움직여야 하는 부위는 Part로 나눈다(이름: 모델__부위).
- 재질은 색만 쓴다(텍스처 없음). 게임이 재질 '이름'을 보고 계절 색 등을 바꾼다.
"""
import math
import os
import bpy
import bmesh
from mathutils import Matrix, Vector, Euler, noise

# ----------------------------------------------------------------- 재질
PALETTE = {
    # 자연
    'bark': '#8d5c3b', 'bark_d': '#6c4529', 'wood': '#c8925a', 'wood_d': '#a4764a', 'wood_l': '#e0b47c',
    'leaf': '#5fb858', 'leaf_d': '#459a4c', 'leaf_l': '#84d26e',          # 과일나무 잎(계절 따라 게임이 색을 바꿈)
    'bloom': '#6cc25a', 'bloom_d': '#4fa551', 'bloom_l': '#93da76',      # 벚나무 잎/꽃
    'pine': '#3a9862', 'pine_d': '#2a7b52', 'pine_l': '#57b877',
    'big': '#58b256', 'big_d': '#3f934a', 'big_l': '#80d06c',            # 당산나무
    'snow': '#ffffff', 'rock': '#a8a199', 'rock_d': '#8a837b', 'rock_l': '#c4beb6',
    'stem': '#4f9a52', 'weed': '#5fb04a', 'petal': '#f0564e', 'petal_c': '#ffd84a',
    'dirt': '#8a6238', 'dirt_d': '#4a3020',
    # 건물
    'wall': '#fff3d6', 'wall_d': '#e6d3a8', 'roof': '#d9584a', 'roof_d': '#b8443a', 'door': '#9b6a44', 'door_d': '#7a5030',
    'window': '#9fd4f2', 'frame': '#fffaf0', 'stone': '#cfc6b8', 'stone_d': '#b3a998', 'metal': '#5a6674', 'metal_l': '#8a96a4',
    'gold': '#f2c230', 'glass': '#dff2ff', 'lampglass': '#fff3a8', 'giwa': '#4a5568', 'giwa_d': '#394252', 'plaster': '#f7f3ea',
    'red': '#e8574c', 'orange': '#f29a3c', 'yellow': '#ffd84a', 'green': '#5fae62', 'teal': '#3fa39a', 'blue': '#4a90d9',
    'purple': '#9a6bd0', 'pink': '#ff9fc2', 'white': '#ffffff', 'black': '#2a2030', 'cream': '#fff3d6', 'gray': '#b8bcc4',
    'paper': '#fff8e0', 'cloth': '#e9a3b4', 'roll': '#e9c46a',
}
_mats = {}


def srgb2lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexlin(h):
    h = h.lstrip('#')
    return tuple(srgb2lin(int(h[i:i + 2], 16) / 255.0) for i in (0, 2, 4)) + (1.0,)


def get_mat(name):
    """이름으로 재질을 얻는다. '#rrggbb'를 주면 그 색의 재질(이름 c_rrggbb)을 만든다."""
    if name.startswith('#'):
        key, col = 'c_' + name[1:].lower(), name
    else:
        key, col = name, PALETTE[name]
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(key)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = hexlin(col)
    bsdf.inputs['Roughness'].default_value = 0.9
    m.diffuse_color = hexlin(col)
    _mats[key] = m
    return m


# ----------------------------------------------------------------- 변환 도우미
def TRS(loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    if isinstance(scale, (int, float)):
        scale = (scale, scale, scale)
    r = Euler([math.radians(a) for a in rot], 'XYZ').to_matrix().to_4x4()
    return Matrix.Translation(Vector(loc)) @ r @ Matrix.Diagonal((scale[0], scale[1], scale[2], 1.0))


# ----------------------------------------------------------------- 모델/부위
_current = []          # 현재 열려 있는 Part 스택
MODELS = []            # 만들어진 모델 루트 목록(순서대로)


class Part:
    """모델의 한 부위. 여기에 도형을 계속 더한 뒤 메시 하나로 만든다."""

    def __init__(self, name, pivot=(0, 0, 0)):
        self.name = name
        self.pivot = Vector(pivot)
        self.bm = bmesh.new()
        self.mats = []
        self.sharp = 50.0

    def mi(self, mat):
        m = get_mat(mat)
        if m not in self.mats:
            self.mats.append(m)
        return self.mats.index(m)

    def __enter__(self):
        _current.append(self)
        return self

    def __exit__(self, *a):
        _current.pop()

    def build(self, objname):
        bm = self.bm
        if self.pivot.length > 0:
            bmesh.ops.translate(bm, verts=bm.verts, vec=-self.pivot)
        bm.normal_update()
        ang = math.radians(self.sharp)
        for e in bm.edges:
            if len(e.link_faces) == 2:
                if not (e.link_faces[0].smooth and e.link_faces[1].smooth) or e.calc_face_angle(0) > ang:
                    e.smooth = False
        me = bpy.data.meshes.new(objname)
        bm.to_mesh(me)
        bm.free()
        for m in self.mats:
            me.materials.append(m)
        ob = bpy.data.objects.new(objname, me)
        ob.location = self.pivot
        bpy.context.scene.collection.objects.link(ob)
        return ob


class Model:
    """with Model('이름'): 안에서 도형을 만들면 그 모델에 들어간다."""

    def __init__(self, name):
        self.name = name
        self.main = Part(name)
        self.parts = []
        self.anchors = []

    def __enter__(self):
        global _model
        _model = self
        _current.append(self.main)
        return self

    def part(self, name, pivot=(0, 0, 0)):
        p = Part(name, pivot)
        self.parts.append(p)
        return p

    def anchor(self, name, loc, parent=None):
        self.anchors.append((name, Vector(loc), parent))

    def __exit__(self, *a):
        _current.pop()
        has_main = len(self.main.bm.verts) > 0
        if not self.parts and not self.anchors:
            root = self.main.build(self.name)
        else:
            root = bpy.data.objects.new(self.name, None)
            root.empty_display_size = 0.2
            bpy.context.scene.collection.objects.link(root)
            if has_main:
                ob = self.main.build(self.name + '__main')
                ob.parent = root
            built = {}
            for p in self.parts:
                ob = p.build(self.name + '__' + p.name)
                ob.parent = root
                built[p.name] = ob
            for (nm, loc, parent) in self.anchors:
                e = bpy.data.objects.new(self.name + '__' + nm, None)
                e.empty_display_size = 0.08
                bpy.context.scene.collection.objects.link(e)
                if parent and parent in built:
                    e.parent = built[parent]
                    e.location = loc - built[parent].location
                else:
                    e.parent = root
                    e.location = loc
        MODELS.append(root)


def cur():
    return _current[-1]


def _finish(new_verts, mat, smooth):
    p = cur()
    idx = p.mi(mat)
    faces = set()
    for v in new_verts:
        for f in v.link_faces:
            faces.add(f)
    for f in faces:
        f.material_index = idx
        f.smooth = smooth
    return list(faces)


# ----------------------------------------------------------------- 도형
def ball(loc, r, mat, scale=(1, 1, 1), rot=(0, 0, 0), sub=2, smooth=True):
    """정이십면체 구. r=반지름, scale로 찌그러뜨린다."""
    if isinstance(scale, (int, float)):
        scale = (scale, scale, scale)
    M = TRS(loc, rot, (r * scale[0], r * scale[1], r * scale[2]))
    res = bmesh.ops.create_icosphere(cur().bm, subdivisions=sub, radius=1.0, matrix=M)
    return _finish(res['verts'], mat, smooth)


def uvball(loc, r, mat, scale=(1, 1, 1), rot=(0, 0, 0), seg=12, rings=8, smooth=True):
    if isinstance(scale, (int, float)):
        scale = (scale, scale, scale)
    M = TRS(loc, rot, (r * scale[0], r * scale[1], r * scale[2]))
    res = bmesh.ops.create_uvsphere(cur().bm, u_segments=seg, v_segments=rings, radius=1.0, matrix=M)
    return _finish(res['verts'], mat, smooth)


def cyl(base, r, h, mat, r2=None, seg=12, rot=(0, 0, 0), smooth=True, caps=True, scale=(1, 1, 1)):
    """원기둥/원뿔대. base=밑면 중심, r=밑 반지름, r2=윗 반지름(없으면 r), h=높이. rot은 밑면 중심 기준."""
    if r2 is None:
        r2 = r
    M = TRS(base, rot, scale) @ Matrix.Translation((0, 0, h / 2))
    res = bmesh.ops.create_cone(cur().bm, cap_ends=caps, cap_tris=False, segments=seg, radius1=r, radius2=max(r2, 1e-4),
                                depth=h, matrix=M)
    return _finish(res['verts'], mat, smooth)


def cone(base, r, h, mat, seg=12, rot=(0, 0, 0), smooth=True, scale=(1, 1, 1)):
    return cyl(base, r, h, mat, r2=0.0, seg=seg, rot=rot, smooth=smooth, scale=scale)


def box(center, size, mat, rot=(0, 0, 0), bevel=0.0, seg=1):
    """상자. center=중심, size=(x,y,z) 크기. bevel>0이면 모서리를 둥글린다."""
    M = TRS(center, rot, size)
    bm = cur().bm
    res = bmesh.ops.create_cube(bm, size=1.0, matrix=M)
    verts = res['verts']
    if bevel > 0:
        edges = set()
        for v in verts:
            for e in v.link_edges:
                edges.add(e)
        r2 = bmesh.ops.bevel(bm, geom=list(edges), offset=bevel, segments=seg, affect='EDGES', profile=0.5)
        verts = r2['verts']
        return _finish(verts, mat, True)
    return _finish(verts, mat, False)


def boxb(base, size, mat, rot=(0, 0, 0), bevel=0.0, seg=1):
    """밑면 중심을 기준으로 놓는 상자."""
    M = TRS(base, rot, (1, 1, 1)) @ Matrix.Translation((0, 0, size[2] / 2))
    c = M.to_translation()
    return box(tuple(c), size, mat, rot, bevel, seg)


def poly(verts, faces, mat, smooth=False):
    """직접 꼭짓점과 면을 줘서 만든다."""
    bm = cur().bm
    vs = [bm.verts.new(v) for v in verts]
    for f in faces:
        try:
            bm.faces.new([vs[i] for i in f])
        except ValueError:
            pass
    bm.normal_update()
    return _finish(vs, mat, smooth)


def prism(base, w, d, h, mat, rot=(0, 0, 0), over=0.0):
    """박공지붕 모양 삼각기둥. 용마루가 X축 방향. base=밑면 중심."""
    x, y = w / 2 + over, d / 2 + over
    V = [(-x, -y, 0), (x, -y, 0), (x, y, 0), (-x, y, 0), (-x, 0, h), (x, 0, h)]
    M = TRS(base, rot)
    V = [tuple(M @ Vector(v)) for v in V]
    F = [(0, 1, 5, 4), (2, 3, 4, 5), (0, 4, 3), (1, 2, 5), (0, 3, 2, 1)]
    return poly(V, F, mat)


def disc(center, r, mat, seg=14, rot=(0, 0, 0), scale=(1, 1, 1)):
    M = TRS(center, rot, scale)
    res = bmesh.ops.create_circle(cur().bm, cap_ends=True, cap_tris=False, segments=seg, radius=r, matrix=M)
    return _finish(res['verts'], mat, False)


def torus(center, R, r, mat, seg=14, tseg=6, rot=(0, 0, 0), scale=(1, 1, 1)):
    M = TRS(center, rot, scale)
    V, F = [], []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        for j in range(tseg):
            b = 2 * math.pi * j / tseg
            V.append(tuple(M @ Vector(((R + r * math.cos(b)) * math.cos(a), (R + r * math.cos(b)) * math.sin(a), r * math.sin(b)))))
    for i in range(seg):
        for j in range(tseg):
            a, b = i * tseg + j, i * tseg + (j + 1) % tseg
            c, d = ((i + 1) % seg) * tseg + (j + 1) % tseg, ((i + 1) % seg) * tseg + j
            F.append((a, d, c, b))
    return poly(V, F, mat, smooth=True)


def lump(loc, r, mat, scale=(1, 1, 1), seed=0, amp=0.18, sub=2, smooth=False, rot=(0, 0, 0)):
    """울퉁불퉁한 덩어리(돌 등)."""
    faces = ball(loc, r, mat, scale, rot, sub, smooth)
    vs = set()
    for f in faces:
        for v in f.verts:
            vs.add(v)
    c = Vector(loc)
    for v in vs:
        d = v.co - c
        n = noise.noise(d * (1.7 / max(r, 1e-3)) + Vector((seed * 3.1, seed * 1.7, seed * 0.9)))
        v.co = c + d * (1.0 + n * amp)
    return faces


def tube(p0, p1, r, mat, r2=None, seg=8, smooth=True):
    """두 점을 잇는 원기둥(가지, 다리 등)."""
    a, b = Vector(p0), Vector(p1)
    d = b - a
    h = d.length
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    M = Matrix.Translation(a) @ q.to_matrix().to_4x4() @ Matrix.Translation((0, 0, h / 2))
    res = bmesh.ops.create_cone(cur().bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r,
                                radius2=max(r if r2 is None else r2, 1e-4), depth=h, matrix=M)
    return _finish(res['verts'], mat, smooth)


def capsule(p0, p1, r, mat, seg=8, sub=2):
    tube(p0, p1, r, mat, seg=seg)
    ball(p0, r, mat, sub=sub)
    ball(p1, r, mat, sub=sub)


# ----------------------------------------------------------------- 저장/내보내기
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _mats.clear()
    MODELS.clear()


def layout_grid(spacing=4.0, cols=8):
    """블렌더에서 열어 보기 좋게 모델을 바둑판으로 늘어놓는다."""
    for i, root in enumerate(MODELS):
        root.location = Vector(((i % cols) * spacing, -(i // cols) * spacing, 0))


def export(glb_path, blend_path=None, spacing=4.0, cols=8):
    os.makedirs(os.path.dirname(glb_path), exist_ok=True)
    for root in MODELS:
        root.location = Vector((0, 0, 0))
    bpy.ops.object.select_all(action='DESELECT')
    for ob in bpy.context.scene.collection.all_objects:
        ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=glb_path, export_format='GLB', use_selection=True, export_yup=True,
                              export_apply=False, export_texcoords=False, export_normals=True,
                              export_materials='EXPORT', export_cameras=False, export_lights=False,
                              export_animations=False, export_extras=False)
    if blend_path:
        os.makedirs(os.path.dirname(blend_path), exist_ok=True)
        layout_grid(spacing, cols)
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(blend_path), compress=True)
    n = len(MODELS)
    print('  -> %s (%d개 모델, %.0f KB)' % (os.path.basename(glb_path), n, os.path.getsize(glb_path) / 1024))
