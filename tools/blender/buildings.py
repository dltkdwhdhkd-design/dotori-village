"""건물과 마을 시설물 모델. 정면은 -Y. 건물은 차지하는 칸의 가운데가 원점.

부품(지붕·창·문 등)은 bkit.py에 있고, 여기서는 그것들을 조립한다.
주민 집은 세 가지: house_a(회벽 오두막) house_b(통나무집) house_c(기와집).
게임이 재질 roof/roof_d(지붕) wall/wall_d(벽) door/door_d(문) 색을 집주인에 맞춰 바꾼다."""
import math
from lib import *
from bkit import *

FLOWERS = ['#ff9fc2', '#ffd84a', '#f0564e', '#ffffff']


# ============================================================ 주민 집
def house_a():
    """회벽 오두막 (4×3칸): 가파른 박공지붕, 지붕창, 덧문 달린 창"""
    with Model('house_a'):
        cy, W, D, H = 0.1, 3.3, 2.25, 2.3
        fy = cy - D / 2                                   # 앞벽
        stone_base(3.62, 2.56, 0.2, cy, n=7)
        boxb((0, cy, 0.18), (W, D, H), 'wall', bevel=0.05)
        planks(F0, W - 0.14, 0.2, 2.4, fy, gap=0.36)
        for sx in (-1, 1):                                # 모서리 기둥
            box((sx * (W / 2 - 0.045), fy - 0.012, 0.18 + H / 2), (0.13, 0.07, H), 'frame')
        box((0, fy - 0.012, 0.3), (W + 0.02, 0.07, 0.2), 'frame')
        R = Frame((0, cy, 0))
        gable(R, W, D, 1.35, 2.44, over=0.34, side=0.3, rows=6)
        # 지붕창(앞 경사면 가운데)
        boxb((0, fy + 0.42, 2.6), (0.92, 0.62, 0.62), 'wall', bevel=0.03)
        gable(Frame((0, fy + 0.5, 0), 90), 0.74, 0.92, 0.42, 3.2, over=0.1, side=0.1, rows=3, t=0.06, trim='frame')
        win(F0, 0, fy + 0.11, 2.92, 0.42, 0.42, kind='round')
        door(F0, 0, fy, 0.84, 1.7, kind='arch')
        steps(F0, 0, fy, 1.3, 2)
        for sx in (-1, 1):
            win(F0, sx * 1.15, fy, 1.42, 0.5, 0.64, shutters='door', flowers=FLOWERS[:3] if sx < 0 else FLOWERS[1:4])
        chimney(1.0, cy + 0.5, 2.7, 1.25)
        bush(-1.72, fy - 0.2, 0.26, flowers=['#ff9fc2'])
        bush(1.74, fy - 0.18, 0.24)


def log_wall(w, d, cy, z0, n, r=0.135):
    """통나무를 쌓아 올린 벽. 모서리에서 통나무 끝이 엇갈려 튀어나온다."""
    boxb((0, cy, z0 - 0.05), (w - 0.1, d - 0.1, n * r * 1.9 + 0.1), 'wood_d')
    for i in range(n):
        z = z0 + r + i * r * 1.9
        for sy in (-1, 1):                 # 앞·뒤 벽(가로로 누운 통나무)
            cyl((-w / 2 - 0.16, cy + sy * (d / 2 - r * 0.6), z), r, w + 0.32, 'wood' if i % 2 == 0 else '#bd8750', seg=10, rot=(0, 90, 0))
            for sx in (-1, 1):
                disc((sx * (w / 2 + 0.162), cy + sy * (d / 2 - r * 0.6), z), r * 0.72, 'wood_l', seg=10, rot=(0, sx * 90, 0))
        zz = z + r * 0.95
        if i < n - 1:
            for sx in (-1, 1):             # 옆벽(세로로 누운 통나무)
                cyl((sx * (w / 2 - r * 0.6), cy - d / 2 - 0.16, zz), r, d + 0.32, '#bd8750' if i % 2 == 0 else 'wood', seg=10, rot=(-90, 0, 0))
                disc((sx * (w / 2 - r * 0.6), cy - d / 2 - 0.162, zz), r * 0.72, 'wood_l', seg=10, rot=(90, 0, 0))


def house_b():
    """통나무집 (4×3칸): 통나무 벽, 문 위 처마, 돌 굴뚝, 장작더미"""
    with Model('house_b'):
        cy, W, D = 0.12, 3.2, 2.2
        fy = cy - D / 2
        stone_base(3.6, 2.56, 0.22, cy, n=7)
        log_wall(W, D, cy, 0.2, 9)
        R = Frame((0, cy, 0))
        gable(R, W + 0.1, D + 0.1, 1.3, 2.5, over=0.36, side=0.34, rows=6, fill='wood_d', trim='wood_l')
        # 박공 아래 세로 널
        door(F0, 0, fy + 0.02, 0.95, 1.72, kind='plank', frame='wood_l')
        # 문 위 작은 처마와 기둥
        for sx in (-1, 1):
            cyl((sx * 0.72, fy - 0.36, 0.2), 0.06, 1.95, 'wood_l', seg=8)
        box((0, fy - 0.2, 2.2), (1.8, 0.52, 0.09), 'roof', rot=(-14, 0, 0))
        box((0, fy - 0.45, 2.13), (1.84, 0.06, 0.1), 'roof_d', rot=(-14, 0, 0))
        steps(F0, 0, fy, 1.5, 2, mat='wood', dark='wood_d', depth=0.22)
        for sx in (-1, 1):
            win(F0, sx * 1.08, fy + 0.02, 1.38, 0.56, 0.6, frame='wood_l', flowers=FLOWERS[2:4] + FLOWERS[:1] if sx < 0 else None)
        lantern(F0, -0.74, fy + 0.02, 1.7)
        # 옆에 붙은 돌 굴뚝
        for i, (w, h) in enumerate(((0.62, 1.3), (0.52, 1.3), (0.44, 1.5))):
            boxb((1.58, cy + 0.35, i * 1.28), (0.34, w, h), 'stone' if i % 2 == 0 else 'stone_d', bevel=0.04)
        boxb((1.58, cy + 0.35, 4.02), (0.44, 0.54, 0.1), 'stone_d', bevel=0.02)
        for (dx, dy, dz, c) in ((0.02, 0.1, 0.5, 'stone_l'), (0.02, -0.14, 1.1, 'stone_d'), (0.02, 0.05, 1.9, 'stone_l'), (0.02, -0.08, 2.7, 'stone_d')):
            box((1.75 + dx, cy + 0.35 + dy, dz), (0.03, 0.22, 0.16), c)
        # 장작더미
        for i, (y, z) in enumerate(((0, 0.09), (0.19, 0.09), (0.38, 0.09), (0.095, 0.25), (0.285, 0.25), (0.19, 0.41))):
            cyl((-1.9, fy - 0.2 + y - 0.1, z), 0.09, 0.42, 'bark', seg=7, rot=(0, 90, 0))
            disc((-1.9, fy - 0.2 + y - 0.1, z), 0.07, 'wood_l', seg=7, rot=(0, -90, 0))
            disc((-1.478, fy - 0.2 + y - 0.1, z), 0.07, 'wood_l', seg=7, rot=(0, 90, 0))


def giwa_roof(cx, cy, w, d, h, z0, mat='giwa', dark='giwa_d', lift=0.32, nx=14, ny=6, ribs=13, t=0.1, sag=1.45):
    """기와지붕(맞배). 처마 끝이 살짝 들리고 가운데가 처진 곡선. w×d는 처마까지 포함한 크기, z0=처마 높이."""
    def P(i, j, sgn, dz=0.0):
        u = -1 + 2 * i / nx
        tt = j / ny
        x = cx + u * w / 2
        y = cy + sgn * (d / 2) * (1 - tt) * (1 + 0.05 * u * u * (1 - tt))
        z = z0 + h * (tt ** sag) + lift * u * u * (1 - tt * 0.55) + dz
        return (x, y, z)
    for sgn in (-1, 1):
        V, Fc = [], []
        for layer, dz in ((0, 0.0), (1, -t)):
            for j in range(ny + 1):
                for i in range(nx + 1):
                    V.append(P(i, j, sgn, dz))
        n1 = (nx + 1) * (ny + 1)
        for j in range(ny):
            for i in range(nx):
                a, b, c, e = j * (nx + 1) + i, j * (nx + 1) + i + 1, (j + 1) * (nx + 1) + i + 1, (j + 1) * (nx + 1) + i
                top = (a, b, c, e) if sgn < 0 else (a, e, c, b)
                Fc.append(top)
                Fc.append(tuple(n1 + k for k in reversed(top)))
        for i in range(nx):                 # 처마 끝 마감
            a, b = i, i + 1
            Fc.append((a, n1 + a, n1 + b, b) if sgn < 0 else (a, b, n1 + b, n1 + a))
        for j in range(ny):                 # 옆 마감
            for i in (0, nx):
                a, e = j * (nx + 1) + i, (j + 1) * (nx + 1) + i
                q = (a, e, n1 + e, n1 + a)
                Fc.append(q if (i == 0) == (sgn < 0) else tuple(reversed(q)))
        poly(V, Fc, mat, smooth=True)
        # 기왓골: 경사를 따라 내려오는 둥근 줄
        for k in range(ribs):
            fi = nx * (k + 0.5) / ribs
            i0 = int(fi)
            f = fi - i0
            pts = []
            for j in range(ny + 1):
                a, b = Vector(P(i0, j, sgn, 0.035)), Vector(P(min(nx, i0 + 1), j, sgn, 0.035))
                pts.append(a.lerp(b, f))
            for j in range(ny):
                tube(pts[j], pts[j + 1], 0.05, dark, seg=5)
            ball(pts[0], 0.07, dark, sub=1)
        for i in (0, nx):                   # 내림마루(박공 쪽 굵은 줄)
            for j in range(ny):
                tube(P(i, j, sgn, 0.06), P(i, j + 1, sgn, 0.06), 0.085, dark, seg=6)
            ball(P(i, 0, sgn, 0.06), 0.11, dark, sub=2)
    # 용마루
    pts = [Vector(P(i, ny, 1, 0.1)) for i in range(nx + 1)]
    for i in range(nx):
        tube(pts[i], pts[i + 1], 0.12, dark, seg=8)
    for p in (pts[0], pts[-1]):
        ball(p + Vector((0, 0, 0.05)), 0.17, dark, (1.2, 1, 1.1), sub=2)
    return z0 + h


def lattice(F, x, y, z, w, h, nx=3, nz=4, mat='wood_d', paper='paper'):
    """창호지 문짝(문살)"""
    fbox(F, (x, y - 0.02, z), (w, 0.07, h), mat)
    fbox(F, (x, y - 0.05, z), (w - 0.12, 0.04, h - 0.12), paper)
    for i in range(1, nx):
        fbox(F, (x - (w - 0.12) / 2 + (w - 0.12) * i / nx, y - 0.072, z), (0.03, 0.02, h - 0.12), mat)
    for i in range(1, nz):
        fbox(F, (x, y - 0.072, z - (h - 0.12) / 2 + (h - 0.12) * i / nz), (w - 0.12, 0.02, 0.03), mat)


def jar(x, y, s=1.0, mat='#8a5a3e'):
    """장독"""
    lathe([(0.1 * s, 0.0), (0.2 * s, 0.1 * s), (0.22 * s, 0.26 * s), (0.16 * s, 0.4 * s), (0.13 * s, 0.43 * s)], mat, center=(x, y, 0), seg=10)
    lathe([(0.17 * s, 0.42 * s), (0.18 * s, 0.46 * s), (0.05 * s, 0.5 * s), (0.0, 0.5 * s)], '#6c4530', center=(x, y, 0), seg=10)


def house_c():
    """기와집 (4×3칸): 돌 기단, 나무 기둥과 회벽, 창호문, 장독대"""
    with Model('house_c'):
        cy, W, D, H = 0.14, 3.1, 2.1, 1.95
        fy = cy - D / 2
        stone_base(3.64, 2.6, 0.3, cy, n=8)
        boxb((0, fy - 0.3, 0), (1.2, 0.34, 0.16), 'stone_d', bevel=0.03)          # 댓돌
        boxb((0, cy, 0.3), (W, D, H), 'wall')
        for x in (-W / 2, -0.62, 0.62, W / 2):                                       # 기둥
            for y in (fy, cy + D / 2):
                cyl((x, y, 0.3), 0.1, H + 0.02, 'bark_d', seg=8)
        for y in (fy, cy + D / 2):
            box((0, y, 0.3 + H - 0.08), (W + 0.2, 0.14, 0.16), 'bark_d')
            box((0, y, 0.42), (W, 0.1, 0.1), 'bark_d')
        box((0, fy - 0.02, 0.62), (W - 0.2, 0.05, 0.42), 'stone_d')                 # 벽 아래 돌 띠
        for sx in (-1, 1):
            lattice(F0, sx * 0.29, fy - 0.03, 1.2, 0.56, 1.62, nx=2, nz=5)
            lattice(F0, sx * 1.1, fy - 0.03, 1.5, 0.72, 0.72, nx=3, nz=3, paper='window')
        for sx in (-1, 1):
            torus((sx * 0.07, fy - 0.11, 1.15), 0.035, 0.01, 'metal', seg=8, tseg=4, rot=(90, 0, 0))
        giwa_roof(0, cy, W + 0.95, D + 1.05, 1.15, 2.2, mat='roof', dark='roof_d', lift=0.3)
        prismfill = [(-W / 2, cy, 2.2), (W / 2, cy, 2.2)]
        for sx in (-1, 1):                                                           # 박공 쪽 회벽
            poly([(sx * W / 2, fy, 2.2), (sx * W / 2, cy + D / 2, 2.2), (sx * W / 2, cy, 3.25)], [(0, 1, 2) if sx > 0 else (0, 2, 1)], 'wall')
        jar(-1.62, fy - 0.2, 1.0)
        jar(-1.28, fy - 0.3, 0.75, '#9a6a48')
        jar(1.66, fy - 0.24, 0.85)


# ============================================================ 주인공 집(도토리 집)
def acorn_cap(c, r, h, steps=6, seg=20, stem=True):
    """도토리 깍정이 모양 지붕: 비늘이 층층이 겹친 둥근 지붕과 꼭지"""
    prof, rims = [], []
    for i in range(steps):
        a0, a1 = (i / steps) * math.pi / 2, ((i + 1) / steps) * math.pi / 2
        r0, z0 = r * math.cos(a0), h * math.sin(a0)
        r1, z1 = r * math.cos(a1), h * math.sin(a1)
        prof += [(r0 + 0.06, z0 - 0.04), (r0 + 0.07, z0 + 0.02), (r1 + 0.035, z1)]
        rims.append((r0 + 0.075, z0))
    prof.append((0.0, h + 0.02))
    prof = [(0.0, -0.06)] + prof
    lathe(prof, 'roof', center=c, seg=seg)
    for (rr, zz) in rims:
        lathe([(rr, zz - 0.055), (rr + 0.012, zz - 0.01), (rr, zz + 0.03)], 'roof_d', center=c, seg=seg, caps=False)
    # 비늘 무늬: 층마다 엇갈린 작은 혹
    for i in range(steps - 1):
        a = ((i + 0.5) / steps) * math.pi / 2
        rr, zz = r * math.cos(a) + 0.045, h * math.sin(a)
        n = max(6, int(rr * 9))
        for k in range(n):
            b = 2 * math.pi * (k + (i % 2) * 0.5) / n
            ball((c[0] + rr * math.cos(b), c[1] + rr * math.sin(b), c[2] + zz), 0.1, 'roof_d', (1, 1, 0.7), sub=1)
    if stem:
        p0 = Vector((c[0], c[1], c[2] + h - 0.02))
        p1 = p0 + Vector((0.05, 0.02, 0.24))
        p2 = p1 + Vector((0.14, 0.03, 0.16))
        tube(p0, p1, 0.085, 'bark_d', r2=0.07, seg=8)
        tube(p1, p2, 0.07, 'bark_d', r2=0.06, seg=8)
        ball(p1, 0.07, 'bark_d', sub=1)
        ball(p2, 0.065, 'bark', sub=1)


def round_body(c, r, h, seg=20):
    """둥근 벽(아래 돌 띠 포함)"""
    lathe([(r + 0.1, 0.0), (r + 0.1, 0.18), (r + 0.02, 0.24)], 'stone', center=c, seg=seg)
    lathe([(r * 0.96, 0.2), (r, 0.5), (r, h - 0.3), (r * 0.96, h)], 'wall', center=c, seg=seg)
    lathe([(r + 0.012, 0.52), (r + 0.012, 0.6)], 'wall_d', center=c, seg=seg, caps=False)


def acorn_sign(x, y, z, s=1.0):
    ball((x, y, z - 0.03 * s), 1.0, '#e0a050', (0.1 * s, 0.05, 0.125 * s), sub=2)
    ball((x, y - 0.005, z + 0.07 * s), 1.0, '#8a5a34', (0.115 * s, 0.06, 0.07 * s), sub=2)
    cyl((x, y - 0.005, z + 0.12 * s), 0.016 * s, 0.07 * s, '#6c4529', seg=5)


def home(level):
    """주인공 집 (5×4칸 자리). 단계가 오를수록 커지고 곁채가 붙는다."""
    with Model('home_%d' % level):
        r, h, caph = {1: (1.28, 2.05, 1.25), 2: (1.5, 2.25, 1.5), 3: (1.62, 2.5, 1.7)}[level]
        cy = {1: 0.25, 2: 0.3, 3: 0.3}[level]
        c = (0, cy, 0)
        fy = cy - r
        round_body(c, r, h)
        acorn_cap((0, cy, h - 0.08), r + 0.3, caph)
        # 현관: 둥근 벽에서 조금 튀어나온 문틀
        boxb((0, fy + 0.12, 0), (1.34, 0.5, 0.2), 'stone', bevel=0.03)
        boxb((0, fy + 0.16, 0.18), (1.24, 0.4, 1.86), 'wall', bevel=0.04)
        cyl((0, fy - 0.04, 2.0), 0.62, 0.4, 'wall', seg=18, rot=(-90, 0, 0))
        door(F0, 0, fy - 0.04, 0.9, 1.74, kind='arch', z=0.2)
        acorn_sign(0, fy - 0.1, 2.34, 1.0)
        steps(F0, 0, fy - 0.04, 1.3, 2 if level > 1 else 1)
        for sx in (-1, 1):                               # 둥근 창
            win(Frame(c, sx * (44 if level == 1 else 40)), 0, -r - 0.005, 1.38, 0.52, 0.52, kind='round')
        lantern(F0, 0.74, fy - 0.03, 1.6)
        # 굴뚝(양철 연통)
        px, py = (r * 0.55, cy + r * 0.45)
        cyl((px, py, h + caph * 0.45), 0.09, 0.75, 'metal_l', seg=8)
        cone((px, py, h + caph * 0.45 + 0.75), 0.16, 0.1, 'metal', seg=8)
        if level >= 2:                                   # 곁채(작은 도토리 방)
            sc = (1.72 if level == 2 else 1.95, cy + 0.25, 0)
            round_body(sc, 0.72, 1.45, seg=14)
            acorn_cap((sc[0], sc[1], 1.38), 0.9, 0.82, steps=4, seg=14)
            win(Frame(sc, 18), 0, -0.725, 0.98, 0.4, 0.4, kind='round')
        if level >= 3:
            sc = (-1.98, cy + 0.2, 0)
            round_body(sc, 0.8, 1.7, seg=14)
            acorn_cap((sc[0], sc[1], 1.62), 0.98, 0.9, steps=4, seg=14)
            win(Frame(sc, -18), 0, -0.805, 1.1, 0.42, 0.42, kind='round')
            # 지붕창
            cyl((0, fy + 0.2, h + caph * 0.42), 0.34, 0.5, 'wall', seg=14, rot=(-90, 0, 0))
            win(F0, 0, fy + 0.18, h + caph * 0.42, 0.4, 0.4, kind='round')
        bush(-(r + 0.25) if level < 3 else -1.3, fy + 0.1 if level < 3 else fy - 0.05, 0.24, flowers=['#ffd84a'])
        pot(1.02, fy - 0.06, 0.13, flower='#ff9fc2')


# ============================================================ 가게·박물관·마을회관
def shop():
    """까치네 만물상 (5×4칸): 큰 진열창, 줄무늬 차양, 도토리 간판"""
    with Model('shop'):
        cy, W, D, H = 0.2, 4.3, 2.9, 2.45
        fy = cy - D / 2
        stone_base(4.56, 3.16, 0.2, cy, n=9)
        boxb((0, cy, 0.18), (W, D, H), '#fff0d0', bevel=0.05)
        box((0, fy - 0.015, 0.62), (W - 0.06, 0.07, 0.88), '#e0a868')               # 아래쪽 나무 널
        for i in range(9):
            box((-W / 2 + 0.26 + i * (W - 0.52) / 8, fy - 0.055, 0.62), (0.03, 0.02, 0.84), '#c88c4c')
        box((0, fy - 0.03, 1.08), (W, 0.1, 0.07), '#fff8e8')
        for sx in (-1, 1):
            box((sx * (W / 2 - 0.05), fy - 0.02, 0.18 + H / 2), (0.14, 0.08, H), '#3fa39a')
        R = Frame((0, cy, 0))
        gable(R, W, D, 1.2, 2.6, mat='#3fa39a', dark='#2f857c', over=0.34, side=0.3, rows=6, fill='#fff0d0', trim='#fff8e8')
        # 간판을 얹은 앞 박공
        boxb((0, fy + 0.3, 2.6), (1.9, 0.7, 0.74), '#fff0d0', bevel=0.03)
        gable(Frame((0, fy + 0.42, 0), 90), 0.9, 1.9, 0.62, 3.32, mat='#3fa39a', dark='#2f857c', over=0.12, side=0.12, rows=3, t=0.06, fill='#fff0d0', trim='#fff8e8')
        box((0, fy - 0.07, 2.98), (1.5, 0.06, 0.52), '#8a5a34', bevel=0.02)
        box((0, fy - 0.1, 2.98), (1.36, 0.04, 0.4), '#fff3d6')
        acorn_sign(0, fy - 0.14, 2.97, 1.25)
        for sx in (-1, 1):
            box((sx * 0.47, fy - 0.13, 2.98), (0.26, 0.02, 0.07), '#8a5a34')
        door(F0, 0, fy, 0.98, 1.76, mat='#7fcfc2', dark='#5aa89c', kind='glass', frame='#fff8e8')
        ball((0.36, fy - 0.16, 2.0), 0.06, 'gold', sub=1)                               # 문 위 종
        cyl((0.36, fy - 0.16, 2.03), 0.012, 0.1, 'metal', seg=4)
        steps(F0, 0, fy, 1.4, 2)
        for sx in (-1, 1):                               # 진열창
            x = sx * 1.4
            box((x, fy - 0.01, 1.62), (1.36, 0.1, 1.06), '#fff8e8', bevel=0.02)
            box((x, fy - 0.045, 1.62), (1.2, 0.06, 0.9), 'window')
            box((x, fy - 0.085, 1.62), (0.045, 0.03, 0.9), '#fff8e8')
            box((x, fy - 0.07, 1.06), (1.5, 0.2, 0.08), '#fff8e8', bevel=0.02)
            for i, (dx, col) in enumerate(((-0.36, '#e8574c'), (0.0, '#ffd84a'), (0.36, '#6aa5f2'))):   # 창 안 물건
                ball((x + dx, fy + 0.0, 1.3), 0.11, col, (1, 0.5, 1 + 0.2 * (i % 2)), sub=1)
        # 줄무늬 차양(가게 앞 전체)
        n = 9
        for i in range(n):
            cx = -W / 2 + 0.1 + (W - 0.2) * (i + 0.5) / n
            col = '#f29a3c' if i % 2 == 0 else '#fff8e8'
            box((cx, fy - 0.36, 2.32), ((W - 0.2) / n, 0.78, 0.05), col, rot=(-24, 0, 0))
            cyl((cx, fy - 0.735, 2.14), (W - 0.2) / n / 2, 0.04, col, seg=10, rot=(90, 0, 0), scale=(1, 1, 1))
        # 가게 앞 물건들
        cyl((-1.9, fy - 0.3, 0), 0.25, 0.5, 'wood', r2=0.23, seg=12)
        for z in (0.12, 0.38):
            torus((-1.9, fy - 0.3, z), 0.255, 0.02, 'metal', seg=12, tseg=4)
        for (dx, dy, col) in ((-0.08, 0.05, '#e8463c'), (0.09, -0.02, '#e8463c'), (0.0, 0.1, '#f2c230'), (0.02, -0.1, '#e8463c')):
            ball((-1.9 + dx, fy - 0.3 + dy, 0.53), 0.09, col, sub=1)
        boxb((1.86, fy - 0.3, 0), (0.52, 0.42, 0.34), 'wood_l', bevel=0.02)
        for i, col in enumerate(('#ffa62e', '#ffa62e', '#84d15e')):
            ball((1.72 + i * 0.14, fy - 0.3, 0.38), 0.09, col, sub=1)
        pot(-1.3, fy - 0.28, 0.13, flower='#ffd84a')
        lantern(F0, 0.78, fy, 1.72)
        # 지붕 위 까치 풍향계
        cyl((1.2, cy, 3.86), 0.02, 0.4, 'metal', seg=5)
        ball((1.2, cy, 4.34), 1.0, '#33303c', (0.16, 0.09, 0.1), sub=2)
        ball((1.08, cy, 4.4), 0.075, '#33303c', sub=1)
        ball((1.22, cy, 4.3), 1.0, '#ffffff', (0.1, 0.092, 0.06), sub=1)
        cone((1.0, cy, 4.4), 0.03, 0.08, '#f2c230', seg=5, rot=(0, -90, 0))
        tube((1.34, cy, 4.34), (1.6, cy, 4.42), 0.03, '#3a5a9a', r2=0.012, seg=5)


def museum():
    """마을 박물관 (6×4칸): 돌 건물, 기둥 선 현관, 관측 돔"""
    with Model('museum'):
        cy, W, D, H = 0.3, 5.3, 2.8, 2.7
        fy = cy - D / 2
        for i in range(3):                               # 넓은 계단
            boxb((0, fy - 0.42 - i * 0.2, 0), (2.9 - i * 0.16, 0.3, 0.3 - i * 0.1), 'stone' if i % 2 == 0 else 'stone_l', bevel=0.02)
        boxb((0, cy, 0), (5.6, 3.1, 0.3), 'stone', bevel=0.03)
        boxb((0, cy, 0.3), (W, D, H), '#f2ead8', bevel=0.05)
        box((0, fy - 0.01, 0.62), (W - 0.04, 0.07, 0.64), '#e0d5be')                 # 아래 돌 띠
        for z in (0.94, 2.2):
            box((0, fy - 0.02, z), (W + 0.02, 0.08, 0.07), 'stone_l')
        for sx in (-1, 1):                               # 모서리 기둥
            boxb((sx * (W / 2 - 0.12), fy - 0.02, 0.3), (0.3, 0.1, H), 'stone_l', bevel=0.02)
        boxb((0, cy, 3.0), (W + 0.3, D + 0.3, 0.2), 'stone_d', bevel=0.04)            # 처마 돌림띠
        boxb((0, cy, 3.18), (W - 0.1, D - 0.1, 0.26), '#7c93b0', bevel=0.08)          # 낮은 지붕
        boxb((0, cy, 3.4), (W - 0.9, D - 0.9, 0.14), '#6c84a2', bevel=0.06)
        # 현관: 기둥 넷과 삼각 박공
        for x in (-1.2, -0.42, 0.42, 1.2):
            lathe([(0.2, 0.3), (0.2, 0.4), (0.14, 0.46), (0.13, 2.36), (0.2, 2.44), (0.2, 2.54)], '#fbf7ee', center=(x, fy - 0.42, 0), seg=12)
        boxb((0, fy - 0.3, 2.54), (3.0, 0.72, 0.2), 'stone_l', bevel=0.02)
        zt = 2.74
        poly([(-1.56, fy - 0.66, zt), (1.56, fy - 0.66, zt), (0, fy - 0.66, zt + 0.86), (-1.56, fy + 0.06, zt), (1.56, fy + 0.06, zt), (0, fy + 0.06, zt + 0.86)],
             [(0, 1, 2), (0, 2, 5, 3), (1, 4, 5, 2), (3, 5, 4), (0, 3, 4, 1)], '#f2ead8')
        for sx in (-1, 1):
            box((sx * 0.8, fy - 0.33, zt + 0.47), (1.86, 0.84, 0.1), '#7c93b0', rot=(0, -sx * 28.5, 0))
        # 암모나이트 문양
        torus((0, fy - 0.68, zt + 0.32), 0.17, 0.035, '#e0a050', seg=14, tseg=5, rot=(90, 0, 0))
        torus((0.03, fy - 0.69, zt + 0.32), 0.085, 0.03, '#e0a050', seg=10, tseg=5, rot=(90, 0, 0))
        ball((0.05, fy - 0.7, zt + 0.32), 0.035, '#c98a3c', sub=1)
        door(F0, 0, fy, 1.1, 1.95, mat='#7a6048', dark='#5f4a38', kind='arch', frame='stone_l', z=0.3, window=False)
        box((0, fy - 0.09, 1.2), (0.035, 0.03, 1.7), '#5f4a38')
        for sx in (-1, 1):
            ball((sx * 0.12, fy - 0.12, 1.2), 0.045, 'gold', sub=1)
            for x in (1.78, 2.2):
                pass
            win(F0, sx * 1.98, fy, 1.62, 0.56, 0.86, kind='arch', frame='stone_l')
            box((sx * 0.84, fy - 0.1, 1.72), (0.3, 0.03, 0.9), '#c9584a' if sx < 0 else '#4a82b8')       # 걸개
            cone((sx * 0.84, fy - 0.1, 1.27), 0.15, 0.14, '#c9584a' if sx < 0 else '#4a82b8', seg=4, rot=(180, 0, 45), scale=(1, 0.12, 1))
        # 관측 돔과 망원경
        dx, dy = 1.55, cy + 0.3
        cyl((dx, dy, 3.4), 0.86, 0.3, '#f2ead8', seg=18)
        lathe([(0.88, 3.7), (0.9, 3.76), (0.86, 3.98), (0.7, 4.3), (0.4, 4.52), (0.0, 4.6)], '#c9d3df', center=(dx, dy, 0), seg=18)
        lathe([(0.905, 3.7), (0.905, 3.78)], '#8a9ab0', center=(dx, dy, 0), seg=18, caps=False)
        box((dx, dy - 0.45, 4.2), (0.3, 0.9, 0.9), '#5a6a80', rot=(38, 0, 0))                       # 열린 틈
        tube((dx, dy - 0.3, 4.1), (dx, dy - 0.95, 4.62), 0.09, '#e8e2d2', r2=0.11, seg=10)           # 망원경
        tube((dx, dy - 0.95, 4.62), (dx, dy - 1.0, 4.66), 0.12, '#8a6a3a', seg=10)
        # 깃발
        cyl((-1.9, cy, 3.5), 0.03, 1.1, 'metal_l', seg=6)
        ball((-1.9, cy, 4.62), 0.05, 'gold', sub=1)
        poly([(-1.88, cy, 4.55), (-1.3, cy, 4.42), (-1.88, cy, 4.2)], [(0, 1, 2), (0, 2, 1)], '#e8574c')
        for sx in (-1, 1):
            pot(sx * 1.52, fy - 0.42, 0.17, mat='stone_d', plant='leaf_d')


def hall():
    """마을회관 — 기와지붕 한옥 (6×4칸): 돌 기단, 둥근 기둥, 창호문, 현판"""
    with Model('hall'):
        cy, W, D, H = 0.3, 4.9, 2.5, 1.95
        fy = cy - D / 2
        boxb((0, cy - 0.05, 0), (5.7, 3.3, 0.36), 'stone', bevel=0.03)
        for i in range(10):
            box((-2.56 + i * 0.57, cy - 0.05 - 1.652, 0.2), (0.3, 0.02, 0.2), 'stone_d' if i % 2 else 'stone_l')
        boxb((0, fy - 0.6, 0), (1.7, 0.3, 0.24), 'stone_l', bevel=0.03)
        boxb((0, fy - 0.84, 0), (1.5, 0.26, 0.12), 'stone_d', bevel=0.02)
        boxb((0, cy, 0.36), (W, D, H), 'plaster')
        for x in (-W / 2, -1.25, 1.25, W / 2):                # 둥근 기둥
            for y in (fy, cy + D / 2):
                cyl((x, y, 0.36), 0.14, H + 0.02, '#8a4a34', seg=10)
                cyl((x, y, 0.36), 0.19, 0.1, 'stone_d', seg=10)
        for y in (fy, cy + D / 2):
            box((0, y, 0.36 + H - 0.1), (W + 0.3, 0.18, 0.2), '#8a4a34')
            box((0, y, 0.5), (W, 0.12, 0.12), '#8a4a34')
        box((0, fy - 0.02, 0.36 + H - 0.26), (W - 0.2, 0.06, 0.1), '#4f8a6a')           # 단청 띠
        # 가운데 창호문 넉 짝
        for x in (-0.84, -0.28, 0.28, 0.84):
            lattice(F0, x, fy - 0.03, 1.3, 0.54, 1.56, nx=2, nz=5, mat='#7a4a34')
        for sx in (-1, 1):
            torus((sx * 0.07, fy - 0.11, 1.25), 0.04, 0.012, 'metal', seg=8, tseg=4, rot=(90, 0, 0))
            lattice(F0, sx * 1.86, fy - 0.03, 1.5, 0.92, 0.82, nx=4, nz=3, mat='#7a4a34', paper='window')
            box((sx * 1.86, fy - 0.03, 0.8), (0.92, 0.07, 0.44), '#e6dcc4')
        giwa_roof(0, cy, W + 1.35, D + 1.5, 1.4, 2.26, lift=0.42, nx=16, ribs=17)
        for sx in (-1, 1):
            poly([(sx * W / 2, fy, 2.26), (sx * W / 2, cy + D / 2, 2.26), (sx * W / 2, cy, 3.52)], [(0, 1, 2) if sx > 0 else (0, 2, 1)], 'plaster')
        # 현판
        box((0, fy - 0.16, 2.22), (1.5, 0.08, 0.48), '#5a3424', bevel=0.02)
        box((0, fy - 0.2, 2.22), (1.34, 0.04, 0.34), '#f7ecd0')
        for k in (-1.5, -0.5, 0.5, 1.5):
            box((k * 0.27, fy - 0.225, 2.22), (0.16, 0.02, 0.18), 'black', bevel=0.0)
        # 양옆 청사초롱
        for sx in (-1, 1):
            cyl((sx * 1.25, fy - 0.3, 1.5), 0.012, 0.6, 'metal', seg=4)
            lathe([(0.05, 1.18), (0.11, 1.24), (0.11, 1.38), (0.05, 1.5)], '#e8574c' if sx < 0 else '#4a82d6', center=(sx * 1.25, fy - 0.3, 0), seg=8)
            lathe([(0.112, 1.28), (0.112, 1.34)], 'lampglass', center=(sx * 1.25, fy - 0.3, 0), seg=8, caps=False)


# ============================================================ 다리·부두·시설물
def bridge_and_dock():
    for side in ('n', 's'):
        with Model('bridge_' + side):
            box((0, 0, -0.03), (1.0, 1.0, 0.14), 'wood')
            for i in range(4):
                box((-0.375 + i * 0.25, 0, 0.042), (0.22, 1.0, 0.012), 'wood_l')
            ry = 0.44 if side == 'n' else -0.44
            for x in (-0.5, 0.0):
                boxb((x, ry, 0.0), (0.11, 0.11, 0.66), 'bark', bevel=0.015)
                ball((x, ry, 0.7), 0.07, 'bark', sub=1)
            box((0, ry, 0.56), (1.0, 0.07, 0.08), 'bark')
            box((0, ry, 0.32), (1.0, 0.05, 0.05), 'bark')
            box((0, 0, -0.16), (1.0, 0.9, 0.12), 'bark_d')
    with Model('bridge_post'):
        cyl((0, 0, -0.9), 0.09, 0.85, 'bark_d', seg=8)
    with Model('dock'):
        box((0, 0, -0.03), (1.0, 1.0, 0.14), 'wood')
        for i in range(4):
            box((0, -0.375 + i * 0.25, 0.042), (1.0, 0.22, 0.012), 'wood_l')
    with Model('dock_post'):
        cyl((0, 0, -0.9), 0.1, 1.15, 'bark_d', seg=8)
        cyl((0, 0, 0.24), 0.115, 0.05, 'bark', seg=8)


def fixtures():
    with Model('lamp') as m:
        lathe([(0.17, 0.0), (0.17, 0.06), (0.09, 0.16), (0.055, 0.3), (0.05, 1.7), (0.1, 1.78)], 'metal', seg=10)
        cyl((0, 0, 1.78), 0.17, 0.05, 'metal', seg=10)
        lathe([(0.2, 2.16), (0.22, 2.2), (0.06, 2.34), (0.0, 2.38)], 'metal', seg=10)
        ball((0, 0, 2.4), 0.04, 'metal', sub=1)
        for a in (0, 90, 180, 270):
            r = math.radians(a + 45)
            cyl((math.cos(r) * 0.145, math.sin(r) * 0.145, 1.83), 0.012, 0.34, 'metal', seg=4)
        with m.part('glass'):
            lathe([(0.12, 1.83), (0.15, 2.0), (0.14, 2.17)], 'lampglass', seg=10)
    with Model('bench'):     # 두 칸짜리: 왼쪽 칸 가운데가 원점
        for i in range(3):
            box((0.5, -0.15 + i * 0.15, 0.43), (1.7, 0.13, 0.06), 'wood' if i % 2 == 0 else 'wood_l', bevel=0.015)
        for i in range(2):
            box((0.5, 0.2, 0.68 + i * 0.17), (1.7, 0.06, 0.14), 'wood' if i % 2 == 0 else 'wood_l', bevel=0.015)
        for x in (-0.25, 1.25):
            boxb((x, 0.2, 0), (0.09, 0.09, 0.95), 'bark', bevel=0.015)
            boxb((x, -0.18, 0), (0.09, 0.09, 0.42), 'bark', bevel=0.015)
            box((x, 0.0, 0.52), (0.09, 0.5, 0.06), 'bark', bevel=0.015)
    with Model('platform'):  # 평상(두 칸)
        box((0.5, 0, 0.32), (1.8, 0.9, 0.08), 'wood')
        for i in range(6):
            box((-0.25 + i * 0.3, 0, 0.365), (0.26, 0.9, 0.012), 'wood_l')
        for x in (-0.3, 1.3):
            for y in (-0.35, 0.35):
                boxb((x, y, 0), (0.1, 0.1, 0.3), 'bark')
    with Model('board'):
        for x in (-0.55, 0.55):
            boxb((x, 0, 0), (0.11, 0.11, 1.5), 'bark', bevel=0.015)
        box((0, 0, 0.95), (1.3, 0.08, 0.86), 'wood', bevel=0.02)
        box((0, -0.03, 0.95), (1.14, 0.06, 0.7), '#5f8a5a')
        gable(Frame((0, 0, 0)), 1.3, 0.3, 0.24, 1.42, mat='#c45a48', dark='#a0463a', over=0.08, side=0.08, rows=2, t=0.05, fill='wood', trim=None)
        for (x, z, w, h, c) in ((-0.32, 1.02, 0.34, 0.44, 'paper'), (0.1, 1.08, 0.3, 0.3, '#ffe9a8'), (0.36, 0.84, 0.28, 0.36, 'paper'), (0.0, 0.76, 0.3, 0.22, '#ffd0d8')):
            box((x, -0.07, z), (w, 0.02, h), c)
            ball((x, -0.09, z + h / 2 - 0.04), 0.025, 'red', sub=1)
    with Model('mailbox') as m:
        boxb((0, 0, 0), (0.11, 0.11, 0.8), 'bark', bevel=0.015)
        boxb((0, 0, 0.78), (0.44, 0.58, 0.3), 'red', bevel=0.03)
        cyl((0, -0.29, 1.08), 0.22, 0.58, 'red', seg=14, rot=(-90, 0, 0))
        box((0, -0.3, 0.97), (0.3, 0.02, 0.2), 'paper')
        acorn_sign(0, -0.31, 1.16, 0.55)
        with m.part('flag', pivot=(0.24, 0.1, 0.95)):
            box((0.24, 0.1, 1.12), (0.03, 0.04, 0.36), 'bark_d')
            box((0.24, 0.02, 1.24), (0.03, 0.2, 0.14), 'yellow')
    with Model('sign_lot'):
        boxb((0, 0, 0), (0.1, 0.1, 0.8), 'bark', bevel=0.015)
        box((0, -0.03, 0.72), (0.86, 0.07, 0.5), 'wood_l', bevel=0.02)
        box((0, -0.07, 0.8), (0.6, 0.02, 0.06), 'bark_d')
        box((-0.08, -0.07, 0.66), (0.44, 0.02, 0.06), 'bark_d')
    with Model('doormat'):
        box((0, 0, 0.015), (1.1, 0.6, 0.03), '#c9584a')
        box((0, 0, 0.02), (0.9, 0.44, 0.03), '#e58a6a')


def build():
    house_a(); house_b(); house_c()
    for lv in (1, 2, 3):
        home(lv)
    shop(); museum(); hall(); bridge_and_dock(); fixtures()
