"""건물 부품 모음: 지붕·창문·문·굴뚝 등. buildings.py가 이것들을 조립해 건물을 만든다.
정면은 -Y. Frame으로 부품을 돌려 놓을 수 있다(옆으로 난 지붕, 옆벽의 창 등)."""
import math
from lib import *


class Frame:
    """부품을 놓는 기준틀. origin을 중심으로 yaw(도)만큼 돌린 자리에 놓는다."""

    def __init__(self, origin=(0, 0, 0), yaw=0):
        self.o, self.yaw = Vector(origin), yaw
        a = math.radians(yaw)
        self.c, self.s = math.cos(a), math.sin(a)

    def p(self, x, y, z):
        return (self.o.x + x * self.c - y * self.s, self.o.y + x * self.s + y * self.c, self.o.z + z)

    def r(self, rx=0, ry=0, rz=0):
        return (rx, ry, rz + self.yaw)


F0 = Frame()


def fbox(F, c, size, mat, rot=(0, 0, 0), bevel=0.0):
    return box(F.p(*c), size, mat, rot=F.r(*rot), bevel=bevel)


# ----------------------------------------------------------------- 지붕
def gable(F, w, d, h, z0, mat='roof', dark='roof_d', over=0.3, side=0.28, rows=6, fill='wall', trim='frame', t=0.085, ridge=True):
    """박공지붕. 용마루가 가로(x) 방향이고 앞뒤로 경사진다. w×d=건물 크기, h=지붕 높이, z0=처마 높이.
    기와(널)를 층층이 겹쳐 얹은 모양으로 만든다."""
    k = h / (d / 2)
    D = d / 2 + over
    ze, zr = z0 - over * k, z0 + h
    th = math.degrees(math.atan2(h, d / 2))
    L = math.hypot(D, zr - ze)
    W = w + side * 2
    if fill:
        prism(F.p(0, 0, z0 - 0.01), w, d, h, fill, rot=F.r())
    ny, nz = math.sin(math.radians(th)), math.cos(math.radians(th))       # 앞 경사면의 바깥 방향 = (0, -ny, nz)
    for sgn in (-1, 1):                # -1 앞, +1 뒤
        for i in range(rows):
            s = (i + 0.5) / rows
            y = sgn * D * (1 - s)
            z = ze + (zr - ze) * s
            lift = t * 0.5 + 0.012
            fbox(F, (0, y + sgn * ny * lift, z + nz * lift), (W, L / rows * 1.16, t), mat if i % 2 == 0 else mat, rot=(-sgn * (th - 5.5), 0, 0))
            # 층마다 아래 끝에 짙은 띠
            s0 = i / rows
            fbox(F, (0, sgn * D * (1 - s0) + sgn * ny * (lift + 0.02), ze + (zr - ze) * s0 + nz * (lift + 0.02) + 0.02), (W + 0.02, 0.05, t * 0.9), dark, rot=(-sgn * th, 0, 0))
        if trim:                       # 박공널(옆에서 본 지붕 테두리)
            for sx in (-1, 1):
                fbox(F, (sx * (W / 2 - 0.03), sgn * D / 2, (ze + zr) / 2 + 0.01), (0.07, L + 0.06, 0.16), trim, rot=(-sgn * th, 0, 0))
    if ridge:
        rr = t * 1.15
        cyl(F.p(-W / 2 - 0.03, 0, zr + rr * 0.6), rr, W + 0.06, dark, seg=8, rot=F.r(0, 90, 0))
        for sx in (-1, 1):
            ball(F.p(sx * (W / 2 + 0.03), 0, zr + rr * 0.6), rr * 1.2, dark, sub=2)
    return zr


def cone_roof(c, r, h, mat='roof', dark='roof_d', steps=5, lip=0.05, seg=16, top=None):
    """둥근 지붕(층층이 내려오는 삿갓 모양)."""
    prof = []
    for i in range(steps):
        a0, a1 = i / steps, (i + 1) / steps
        r0, r1 = r * (1 - a0), r * (1 - a1)
        z0, z1 = h * (1 - (1 - a0) ** 1.5), h * (1 - (1 - a1) ** 1.5)
        prof += [(r0 + lip, z0 - 0.02), (r0 + lip, z0 + 0.03), (max(r1 + lip * 0.5, 0.0), z1)]
    prof.append((0.0, h + 0.02))
    lathe(prof, mat, center=c, seg=seg)
    for i in range(steps):
        a0 = i / steps
        r0, z0 = r * (1 - a0), h * (1 - (1 - a0) ** 1.5)
        lathe([(r0 + lip + 0.012, z0 - 0.03), (r0 + lip + 0.012, z0 + 0.012)], dark, center=c, seg=seg, caps=False)
    if top:
        ball((c[0], c[1], c[2] + h + 0.06), 0.12, top, sub=2)


# ----------------------------------------------------------------- 창문·문
def win(F, x, y, z, w=0.62, h=0.7, kind='cross', frame='frame', glass='window', shutters=None, flowers=None, sill=True, awn=None):
    """창문. (x, z)=가운데, y=벽면. kind: cross(십자 창살) arch(위가 둥근 창) round(동그란 창)
    shutters=덧문 색, flowers=[꽃 색...]이면 창 아래 화분 상자, awn=차양 색"""
    if kind == 'round':
        cyl(F.p(x, y + 0.04, z), w / 2 + 0.085, 0.1, frame, seg=18, rot=F.r(90, 0, 0))
        cyl(F.p(x, y + 0.01, z), w / 2, 0.1, glass, seg=18, rot=F.r(90, 0, 0))
        fbox(F, (x, y - 0.1, z), (0.045, 0.04, w), frame)
        fbox(F, (x, y - 0.1, z), (w, 0.04, 0.045), frame)
        return
    fbox(F, (x, y - 0.01, z), (w + 0.17, 0.1, h + 0.17), frame, bevel=0.02)
    fbox(F, (x, y - 0.045, z), (w, 0.06, h), glass)
    if kind == 'arch':
        cyl(F.p(x, y + 0.04, z + h / 2), w / 2 + 0.085, 0.1, frame, seg=16, rot=F.r(90, 0, 0))
        cyl(F.p(x, y + 0.015, z + h / 2), w / 2, 0.1, glass, seg=16, rot=F.r(90, 0, 0))
        fbox(F, (x, y - 0.085, z + h * 0.25), (0.045, 0.04, h * 1.5), frame)
    else:
        fbox(F, (x, y - 0.085, z), (0.045, 0.04, h), frame)
    fbox(F, (x, y - 0.085, z), (w, 0.04, 0.045), frame)
    if sill:
        fbox(F, (x, y - 0.07, z - h / 2 - 0.1), (w + 0.3, 0.2, 0.07), frame, bevel=0.015)
    if shutters:
        for sx in (-1, 1):
            cx = x + sx * (w / 2 + 0.085 + w * 0.26)
            fbox(F, (cx, y - 0.03, z), (w * 0.46, 0.06, h + 0.12), shutters, bevel=0.012)
            for k in range(4):
                fbox(F, (cx, y - 0.066, z - h * 0.36 + k * h * 0.24), (w * 0.34, 0.02, 0.035), 'door_d')
    if flowers:
        zb = z - h / 2 - 0.25
        fbox(F, (x, y - 0.17, zb), (w + 0.26, 0.2, 0.17), 'wood_d', bevel=0.02)
        n = len(flowers)
        for i, c in enumerate(flowers):
            fx = x - (w + 0.1) / 2 + (w + 0.1) * (i + 0.5) / n
            ball(F.p(fx, y - 0.17, zb + 0.1), 0.085, 'leaf_d', (1.1, 1, 0.7), sub=1)
            ball(F.p(fx, y - 0.19, zb + 0.17), 0.065, c, sub=1)
    if awn:
        for i in range(4):
            fbox(F, (x - (w + 0.3) / 2 + (w + 0.3) * (i + 0.5) / 4, y - 0.2, z + h / 2 + 0.2), ((w + 0.3) / 4, 0.42, 0.045), awn if i % 2 == 0 else '#fff8e8', rot=(-28, 0, 0))


def door(F, x, y, w=0.95, h=1.75, mat='door', dark='door_d', kind='plank', frame='frame', z=0.12, window=True, knob='gold'):
    """문. x=가운데, y=벽면, z=문지방 높이. kind: plank(널문) arch(위가 둥근 문) glass(유리문)"""
    zc = z + h / 2
    if kind == 'arch':
        fbox(F, (x, y, z + (h - w / 2) / 2), (w + 0.2, 0.12, h - w / 2), frame, bevel=0.02)
        cyl(F.p(x, y + 0.06, z + h - w / 2), w / 2 + 0.1, 0.12, frame, seg=18, rot=F.r(90, 0, 0))
        fbox(F, (x, y - 0.04, z + (h - w / 2) / 2), (w, 0.08, h - w / 2), mat)
        cyl(F.p(x, y, z + h - w / 2), w / 2, 0.08, mat, seg=18, rot=F.r(90, 0, 0))
        top = h - w / 2
    else:
        fbox(F, (x, y, zc + 0.04), (w + 0.2, 0.12, h + 0.1), frame, bevel=0.02)
        fbox(F, (x, y - 0.04, zc), (w, 0.08, h), mat)
        top = h
    if kind == 'glass':
        fbox(F, (x, y - 0.075, z + h * 0.55), (w * 0.72, 0.03, h * 0.62), 'window')
        fbox(F, (x, y - 0.09, z + h * 0.55), (0.04, 0.03, h * 0.62), frame)
        fbox(F, (x, y - 0.075, z + h * 0.13), (w * 0.72, 0.03, h * 0.14), dark)
    else:
        for i in (-1, 0, 1):          # 널 사이 홈
            fbox(F, (x + i * w * 0.25, y - 0.078, z + top / 2), (0.022, 0.02, top * 0.94), dark)
        fbox(F, (x, y - 0.085, z + 0.2), (w * 0.94, 0.03, 0.07), dark)
        fbox(F, (x, y - 0.085, z + top - 0.16), (w * 0.94, 0.03, 0.07), dark)
        if window:
            cyl(F.p(x, y - 0.05, z + h * 0.7), 0.16, 0.06, frame, seg=14, rot=F.r(90, 0, 0))
            cyl(F.p(x, y - 0.065, z + h * 0.7), 0.115, 0.06, 'window', seg=14, rot=F.r(90, 0, 0))
    if knob:
        ball(F.p(x + w * 0.33, y - 0.11, z + h * 0.45), 0.055, knob, sub=2)


def steps(F, x, y, w=1.3, n=2, mat='stone', dark='stone_d', depth=0.24, hstep=0.1):
    """문 앞 디딤돌 계단. y=벽면"""
    for i in range(n):
        fbox(F, (x, y - depth * (i + 0.5) - 0.02, hstep * (n - i) / 2), (w - i * 0.0, depth + 0.04, hstep * (n - i)), mat if i % 2 == 0 else dark, bevel=0.02)


def chimney(x, y, z0, h=0.9, w=0.42, mat='#c98a6a', cap='stone_d', smoke=False):
    boxb((x, y, z0), (w, w, h), mat, bevel=0.02)
    for i in range(int(h / 0.22)):
        box((x, y, z0 + 0.14 + i * 0.22), (w + 0.012, w + 0.012, 0.02), '#a86e52')
    boxb((x, y, z0 + h - 0.02), (w + 0.12, w + 0.12, 0.1), cap, bevel=0.02)
    boxb((x, y, z0 + h + 0.06), (w - 0.1, w - 0.1, 0.07), '#5a4a44')


def lantern(F, x, y, z, glass='lampglass'):
    """벽에 거는 등"""
    fbox(F, (x, y - 0.07, z + 0.2), (0.05, 0.16, 0.04), 'metal')
    cyl(F.p(x, y - 0.14, z - 0.02), 0.07, 0.17, glass, r2=0.085, seg=8)
    cone(F.p(x, y - 0.14, z + 0.15), 0.11, 0.08, 'metal', seg=8)
    cyl(F.p(x, y - 0.14, z - 0.04), 0.075, 0.025, 'metal', seg=8)


def bush(x, y, r=0.32, mat='leaf', top='leaf_l', flowers=None):
    ball((x, y, r * 0.62), r, mat, (1.1, 1, 0.8), sub=2)
    ball((x - r * 0.5, y + 0.03, r * 0.45), r * 0.68, 'leaf_d', (1, 1, 0.8), sub=2)
    ball((x + r * 0.45, y - 0.03, r * 0.5), r * 0.7, mat, (1, 1, 0.8), sub=2)
    ball((x + r * 0.1, y - r * 0.3, r * 1.0), r * 0.42, top, (1, 1, 0.7), sub=1)
    if flowers:
        for i, (dx, dz) in enumerate(((-0.5, 0.7), (0.3, 1.05), (0.7, 0.5), (-0.1, 0.45))):
            ball((x + dx * r, y - r * 0.82 + abs(dx) * r * 0.3, dz * r), r * 0.16, flowers[i % len(flowers)], sub=1)


def pot(x, y, r=0.16, mat='#c9744a', plant='leaf', flower=None):
    lathe([(r * 0.7, 0.0), (r, r * 1.3), (r * 1.08, r * 1.36), (r * 1.08, r * 1.6), (r * 0.9, r * 1.6)], mat, center=(x, y, 0), seg=10)
    ball((x, y, r * 2.1), r * 1.05, plant, (1, 1, 0.85), sub=2)
    if flower:
        for a in (0, 120, 240):
            ball((x + math.cos(math.radians(a)) * r * 0.55, y + math.sin(math.radians(a)) * r * 0.55, r * 2.75), r * 0.34, flower, sub=1)


def stone_base(w, d, h=0.2, y=0.0, mat='stone', dark='stone_d', n=0):
    boxb((0, y, 0), (w, d, h), mat, bevel=0.03)
    for i in range(n):               # 군데군데 색이 다른 돌
        x = -w / 2 + w * (i + 0.5) / n
        box((x, y - d / 2 - 0.004, h * 0.5), (w / n * 0.55, 0.02, h * 0.55), dark if i % 2 else 'stone_l' if 'stone_l' in PALETTE else dark, bevel=0.0)


def planks(F, w, z0, z1, y, mat='wall_d', gap=0.3, t=0.022):
    """벽에 가로로 그은 널 이음선"""
    z = z0 + gap
    while z < z1 - 0.05:
        fbox(F, (0, y - 0.005, z), (w, 0.02, t), mat)
        z += gap


def timber(F, w, y, z0, z1, mat='door_d', posts=(-1, 1), mid=True, t=0.11):
    """회벽에 덧댄 나무 뼈대(기둥과 가로대)"""
    for sx in posts:
        fbox(F, (sx * (w / 2 - t / 2), y - 0.01, (z0 + z1) / 2), (t, 0.06, z1 - z0), mat)
    fbox(F, (0, y - 0.01, z1 - t / 2), (w, 0.06, t), mat)
    if mid:
        fbox(F, (0, y - 0.01, z0 + t / 2), (w, 0.06, t), mat)
