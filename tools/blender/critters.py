"""물고기와 곤충 모델. data/fish.json, data/bugs.json의 look 값을 읽어 종마다 하나씩 만든다.
물고기: 머리가 +X, 옆모습이 정면(-Y)을 향한다.  곤충: 머리가 -Y, 바닥이 Z=0."""
import json
import math
import os
from lib import *

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BLACK, WHITE = '#2a2030', '#ffffff'


def eye(x, y, z, r=0.035):
    for s in (1, -1):
        ball((x, s * y, z), r, WHITE, (1, 0.5, 1))
        ball((x + r * 0.2, s * (y + r * 0.3), z), r * 0.55, BLACK, (1, 0.5, 1))


def tri(pts, mat):
    poly(pts, [(0, 1, 2)], mat)        # 앞면
    poly(pts, [(2, 1, 0)], mat)        # 뒷면(양쪽에서 보이게)


def quad(pts, mat):
    poly(pts, [(0, 1, 2, 3)], mat)
    poly(pts, [(3, 2, 1, 0)], mat)


# ---------------------------------------------------------------------------- 물고기
def fish(k):
    L, H = k['len'], k['len'] * k['hgt']
    top, belly, fin = k['top'], k['belly'], k['fin']
    W = H * 0.5
    ball((0, 0, 0), 1.0, top, (L * 0.5, W * 0.5, H * 0.5), sub=3)
    ball((L * 0.02, 0, -H * 0.1), 1.0, belly, (L * 0.47, W * 0.52, H * 0.4), sub=3)
    tx = -L * 0.46
    t = k.get('tail', 'fork')
    if t == 'fork':
        tri([(tx + L * 0.06, 0, 0), (tx - L * 0.2, 0, H * 0.55), (tx - L * 0.1, 0, 0)], fin)
        tri([(tx + L * 0.06, 0, 0), (tx - L * 0.1, 0, 0), (tx - L * 0.2, 0, -H * 0.55)], fin)
    elif t == 'lunate':
        tri([(tx + L * 0.05, 0, 0), (tx - L * 0.16, 0, H * 0.8), (tx - L * 0.07, 0, 0)], fin)
        tri([(tx + L * 0.05, 0, 0), (tx - L * 0.07, 0, 0), (tx - L * 0.16, 0, -H * 0.8)], fin)
    elif t == 'fan':
        for a in (-50, -17, 17, 50):
            r = math.radians(a)
            ball((tx - L * 0.2 * math.cos(r), 0, L * 0.26 * math.sin(r)), 1.0, fin, (L * 0.2, 0.012, H * 0.2), rot=(0, -a, 0))
    else:
        ball((tx - L * 0.07, 0, 0), 1.0, fin, (L * 0.12, 0.012, H * 0.42))
    # 등지느러미, 뒷지느러미, 가슴지느러미
    if k.get('longfin'):
        quad([(L * 0.25, 0, H * 0.42), (-L * 0.36, 0, H * 0.3), (-L * 0.38, 0, H * 0.58), (L * 0.2, 0, H * 0.62)], fin)
    elif k.get('spiny'):
        for i in range(5):
            x = L * (0.2 - i * 0.09)
            tri([(x, 0, H * 0.42), (x - L * 0.08, 0, H * 0.42), (x - L * 0.05, 0, H * (0.82 - i * 0.05))], fin)
    else:
        tri([(L * 0.12, 0, H * 0.44), (-L * 0.16, 0, H * 0.42), (-L * 0.1, 0, H * 0.82)], fin)
    tri([(-L * 0.12, 0, -H * 0.4), (-L * 0.3, 0, -H * 0.3), (-L * 0.26, 0, -H * 0.66)], fin)
    for s in (1, -1):
        tri([(L * 0.18, s * W * 0.5, -H * 0.12), (L * 0.02, s * W * 0.72, -H * 0.3), (L * 0.04, s * W * 0.5, -H * 0.08)], fin)
    if k.get('finlets'):
        for i in range(4):
            x = -L * (0.2 + i * 0.06)
            tri([(x, 0, H * 0.34 - i * 0.012), (x - L * 0.04, 0, H * 0.32 - i * 0.012), (x - L * 0.03, 0, H * 0.48 - i * 0.02)], fin)
    er = max(0.03, H * (0.13 if k.get('bigeye') else 0.09))
    eye(L * 0.34, W * 0.36, H * 0.1, er)
    if k.get('bigmouth'):
        box((L * 0.47, 0, -H * 0.06), (L * 0.08, W * 0.5, H * 0.04), BLACK)
    if k.get('whisk'):
        ln = L * (0.1 if k['whisk'] == 1 else 0.24)
        for s in (1, -1):
            tube((L * 0.47, s * W * 0.2, -H * 0.1), (L * 0.47 + ln * 0.5, s * (W * 0.3 + ln * 0.6), -H * 0.3), 0.012, top, seg=4)
    p, pc = k.get('pattern'), k.get('p', BLACK)
    if p == 'stripes':
        for i in range(4):
            x = L * (0.2 - i * 0.14)
            ball((x, 0, H * 0.06), 1.0, pc, (L * 0.03, W * 0.53, H * 0.42 * (1 - abs(x) / L)))
    elif p == 'spots':
        pts = [(0.2, 0.2), (0.05, 0.28), (-0.1, 0.22), (-0.22, 0.12), (0.12, 0.05), (-0.03, 0.08), (-0.3, 0.02), (0.26, 0.02)]
        for (fx, fz) in pts:
            for s in (1, -1):
                ball((L * fx, s * W * 0.47 * (1 - abs(fx) * 1.2), H * fz), max(0.018, H * 0.07), pc, (1, 0.4, 1))
    elif p in ('band', 'line'):
        th = H * (0.1 if p == 'band' else 0.045)
        for s in (1, -1):
            ball((0, s * W * 0.47, H * 0.02), 1.0, pc, (L * 0.4, 0.02, th))
    elif p == 'wavy':
        for i in range(6):
            x = L * (0.26 - i * 0.1)
            for s in (1, -1):
                box((x, s * W * 0.34, H * 0.34 * (1 - abs(x) / L * 1.3)), (L * 0.025, 0.03, H * 0.22), pc, rot=(s * -40, 0, 25))
    elif p == 'parr':
        for i in range(5):
            x = L * (0.22 - i * 0.12)
            for s in (1, -1):
                ball((x, s * W * 0.46 * (1 - abs(x) / L), H * 0.02), 1.0, pc, (L * 0.035, 0.02, H * 0.2))
    elif p == 'scales':
        for i in range(5):
            for j in range(2):
                x = L * (0.2 - i * 0.11 - j * 0.05)
                for s in (1, -1):
                    ball((x, s * W * 0.45 * (1 - abs(x) / L), H * (0.2 - j * 0.2)), H * 0.05, pc, (1, 0.4, 1))


def eel(k):
    L, r0 = k['len'], k['thick']
    n = 14
    flat = k.get('flat')
    prev = None
    for i in range(n + 1):
        t = i / n
        x = L * (0.5 - t)
        z = math.sin(t * math.pi * 2.2) * L * 0.06
        r = r0 * (1 - t * 0.75) * (0.8 if i == 0 else 1)
        sc = (1, 0.35, 1.9) if flat else (1, 1, 1)
        ball((x, 0, z), r, k['top'], sc)
        ball((x, 0, z - r * (0.9 if flat else 0.35)), r * 0.8, k['belly'], (1, 0.36 if flat else 1.02, 0.9 if flat else 0.8))
        if prev and flat:
            quad([(prev[0], 0, prev[1] + prev[2] * 1.8), (x, 0, z + r * 1.8), (x, 0, z + r * 2.6), (prev[0], 0, prev[1] + prev[2] * 2.6)], '#b8c4d0')
        prev = (x, z, r)
    eye(L * 0.47, r0 * (0.3 if flat else 0.6), r0 * 0.3, r0 * 0.3)
    if k.get('whisk'):
        for s in (1, -1):
            tube((L * 0.5, s * r0 * 0.3, -r0 * 0.3), (L * 0.56, s * r0 * 1.2, -r0 * 0.8), 0.01, k['top'], seg=4)


def flatfish(k):
    L = k['len']
    side = 1 if k['side'] == 'L' else -1
    ball((0, 0, 0), 1.0, '#5a4a32', (L * 0.5, L * 0.36, 0.035), sub=3)
    ball((0, 0, 0.012), 1.0, k['top'], (L * 0.44, L * 0.27, 0.05), sub=3)
    ball((0, 0, -0.016), 1.0, k['belly'], (L * 0.46, L * 0.3, 0.04), sub=3)
    ball((-L * 0.52, 0, 0), 1.0, '#5a4a32', (L * 0.1, L * 0.14, 0.02))
    for (fx, fy) in ((0.1, 0.1), (-0.1, -0.08), (-0.2, 0.1), (0.2, -0.06), (0.0, 0.16), (-0.3, 0.0)):
        ball((L * fx, L * fy, 0.055), L * 0.022, '#4a3a22', (1, 1, 0.3))
    for dx in (0.0, 0.08):
        ball((L * (0.3 + dx), side * L * (0.07 - dx * 0.4), 0.06), 0.045, WHITE, (1, 1, 0.7))
        ball((L * (0.3 + dx), side * L * (0.07 - dx * 0.4), 0.085), 0.025, BLACK, (1, 1, 0.5))


def puffer(k):
    ball((0, 0, 0.02), 0.3, k['top'], sub=3)
    ball((0.01, 0, -0.05), 0.285, k['belly'], (1, 1.03, 0.85), sub=3)
    for i in range(22):
        a, b = i * 2.39996, math.acos(1 - 2 * (i + 0.5) / 22)
        d = (math.sin(b) * math.cos(a), math.sin(b) * math.sin(a), math.cos(b))
        q = Vector((0, 0, 1)).rotation_difference(Vector(d)).to_euler()
        cone((d[0] * 0.27, d[1] * 0.27, d[2] * 0.27 - 0.01), 0.03, 0.08, '#f8f5e8', seg=5, rot=tuple(math.degrees(v) for v in q))
    eye(0.2, 0.17, 0.1, 0.05)
    ball((0.29, 0, -0.02), 0.035, '#e8a08a', (0.6, 1.2, 0.8))
    ball((-0.34, 0, 0), 1.0, k['top'], (0.1, 0.012, 0.11))
    for s in (1, -1):
        ball((0.02, s * 0.3, 0), 1.0, k['top'], (0.07, 0.02, 0.07))
    for (fx, fz) in ((0.1, 0.24), (-0.1, 0.22), (0.0, 0.3), (-0.2, 0.14)):
        ball((fx, 0.1, fz * 0.9), 0.035, '#4a3a22', (1, 1, 0.5))
        ball((fx, -0.1, fz * 0.9), 0.035, '#4a3a22', (1, 1, 0.5))


def squid(k):
    c = k['col']
    cone((0.05, 0, 0), 0.15, 0.55, c, seg=10, rot=(0, -90, 0))
    for s in (1, -1):
        tri([(-0.5, 0, 0), (-0.3, s * 0.22, 0), (-0.22, 0, 0)], c)
    ball((0.1, 0, 0), 0.12, c, (1, 1, 0.9))
    eye(0.13, 0.1, 0.02, 0.045)
    for i in range(8):
        a = math.radians(-70 + i * 20)
        tube((0.18, math.sin(a) * 0.05, math.cos(a) * 0.02 - 0.02), (0.42 + (i % 2) * 0.05, math.sin(a) * 0.16, -0.03), 0.022, c, r2=0.008, seg=5)
    for s in (1, -1):
        tube((0.18, s * 0.03, 0), (0.62, s * 0.2, 0.02), 0.015, c, seg=5)
        ball((0.64, s * 0.21, 0.02), 0.035, c, (1.4, 0.8, 0.6))


def octopus(k):
    c = k['col']
    ball((0, 0, 0.3), 0.26, c, (1, 1, 1.15), sub=3)
    for s in (1, -1):
        ball((0.2, s * 0.1, 0.24), 0.05, WHITE)
        ball((0.235, s * 0.105, 0.24), 0.028, BLACK)
    for i in range(8):
        a = i * math.pi / 4 + 0.39
        p0 = (math.cos(a) * 0.14, math.sin(a) * 0.14, 0.12)
        p1 = (math.cos(a) * 0.34, math.sin(a) * 0.34, 0.03)
        p2 = (math.cos(a + 0.3) * 0.46, math.sin(a + 0.3) * 0.46, 0.08)
        tube(p0, p1, 0.06, c, r2=0.04, seg=6)
        tube(p1, p2, 0.04, c, r2=0.02, seg=6)
        ball(p1, 0.04, c)
        ball(p2, 0.03, '#f0a0b0')


def seahorse(k):
    c = k['col']
    ball((0.04, 0, 0.42), 0.085, c, sub=2)
    tube((0.08, 0, 0.42), (0.22, 0, 0.39), 0.03, c, r2=0.022, seg=6)
    eye(0.07, 0.07, 0.44, 0.022)
    for i, (x, z, r) in enumerate(((0, 0.33, 0.07), (-0.02, 0.24, 0.085), (-0.01, 0.15, 0.08), (0.02, 0.07, 0.06), (0.05, 0.0, 0.045), (0.09, -0.05, 0.035), (0.12, -0.03, 0.028), (0.12, 0.01, 0.022), (0.1, 0.02, 0.018))):
        ball((x, 0, z), r, c)
    for z in (0.47, 0.5):
        cone((0.0, 0, z), 0.02, 0.05, c, seg=4)
    tri([(-0.08, 0, 0.28), (-0.17, 0, 0.22), (-0.08, 0, 0.16)], '#f5d98a')
    ball((0.03, 0, 0.2), 0.05, '#f5d98a', (0.6, 1.02, 1.3))


def ray(k):
    V = [(0.42, 0, 0.0), (0, 0.46, 0.0), (-0.36, 0, 0.0), (0, -0.46, 0.0), (0.05, 0, 0.09), (0.05, 0, -0.04)]
    poly(V, [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4)], k['top'], smooth=True)
    poly(V, [(1, 0, 5), (2, 1, 5), (3, 2, 5), (0, 3, 5)], k['belly'], smooth=True)
    tube((-0.34, 0, 0.01), (-0.9, 0, 0.01), 0.025, k['top'], r2=0.006, seg=5)
    for s in (1, -1):
        ball((0.2, s * 0.07, 0.075), 0.03, WHITE)
        ball((0.215, s * 0.07, 0.09), 0.016, BLACK)


def sunfish(k):
    ball((0, 0, 0), 1.0, k['top'], (0.42, 0.11, 0.46), sub=3)
    ball((0.02, 0, -0.1), 1.0, k['belly'], (0.4, 0.115, 0.36), sub=3)
    tri([(-0.05, 0, 0.4), (-0.3, 0, 0.36), (-0.2, 0, 0.95)], k['top'])
    tri([(-0.05, 0, -0.4), (-0.2, 0, -0.95), (-0.3, 0, -0.36)], k['top'])
    ball((-0.4, 0, 0), 1.0, '#6a7680', (0.07, 0.03, 0.4))
    eye(0.26, 0.085, 0.1, 0.04)
    ball((0.41, 0, 0.02), 0.035, '#e8a08a', (0.6, 1.2, 1))
    for s in (1, -1):
        ball((0.1, s * 0.11, -0.02), 1.0, k['top'], (0.07, 0.02, 0.05))


def shark(k):
    L = 1.7
    ball((0, 0, 0), 1.0, k['top'], (L * 0.46, 0.16, 0.2), sub=3)
    ball((0.02, 0, -0.06), 1.0, k['belly'], (L * 0.44, 0.165, 0.15), sub=3)
    cone((L * 0.3, 0, 0.0), 0.15, 0.4, k['top'], seg=10, rot=(0, 90, 0), scale=(1, 1, 0.85))
    tri([(0.12, 0, 0.17), (-0.2, 0, 0.16), (-0.14, 0, 0.56)], k['top'])
    tri([(-L * 0.42, 0, 0.02), (-L * 0.58, 0, 0.5), (-L * 0.47, 0, 0.0)], k['top'])
    tri([(-L * 0.42, 0, -0.02), (-L * 0.47, 0, 0.0), (-L * 0.54, 0, -0.26)], k['top'])
    for s in (1, -1):
        tri([(0.3, s * 0.14, -0.06), (0.02, s * 0.5, -0.16), (0.08, s * 0.14, -0.06)], k['top'])
        ball((0.6, s * 0.105, 0.03), 0.03, BLACK)
        for i in range(3):
            box((0.36 - i * 0.05, s * 0.15, -0.01), (0.012, 0.02, 0.1), '#2a3a52')
    box((0.72, 0, -0.07), (0.14, 0.2, 0.012), BLACK)


def crayfish(k):
    c = k['col']
    for i, (x, r) in enumerate(((0.1, 0.085), (0.0, 0.08), (-0.09, 0.07), (-0.17, 0.06), (-0.24, 0.05))):
        ball((x, 0, 0.06), r, c, (1.1, 1, 0.75))
    for a in (-35, 0, 35):
        ball((-0.32, math.sin(math.radians(a)) * 0.07, 0.05), 1.0, c, (0.07, 0.035, 0.012), rot=(0, 0, a))
    for s in (1, -1):
        tube((0.14, s * 0.06, 0.06), (0.26, s * 0.16, 0.06), 0.022, c, seg=5)
        ball((0.32, s * 0.19, 0.06), 0.06, c, (1.4, 0.8, 0.7), rot=(0, 0, s * 30))
        tube((0.36, s * 0.2, 0.06), (0.44, s * 0.17, 0.06), 0.02, c, r2=0.005, seg=5)
        tube((0.36, s * 0.22, 0.06), (0.43, s * 0.26, 0.06), 0.02, c, r2=0.005, seg=5)
        tube((0.17, s * 0.03, 0.09), (0.36, s * 0.1, 0.2), 0.006, c, seg=4)
        ball((0.17, s * 0.045, 0.1), 0.018, BLACK)
        for j in range(3):
            tube((0.05 - j * 0.07, s * 0.06, 0.04), (0.05 - j * 0.07, s * 0.15, 0.0), 0.01, c, seg=4)


def softshell(k):
    ball((0, 0, 0.06), 1.0, k['col'], (0.3, 0.25, 0.07), sub=3)
    ball((0, 0, 0.04), 1.0, k['belly'], (0.27, 0.22, 0.05), sub=3)
    tube((0.24, 0, 0.06), (0.42, 0, 0.1), 0.045, k['col'], seg=7)
    ball((0.44, 0, 0.1), 0.055, k['col'], (1.2, 0.9, 0.85))
    tube((0.48, 0, 0.1), (0.55, 0, 0.1), 0.014, k['col'], seg=5)
    eye(0.46, 0.045, 0.12, 0.016)
    for sx, sy in ((0.2, 0.22), (0.2, -0.22), (-0.2, 0.2), (-0.2, -0.2)):
        ball((sx, sy, 0.03), 1.0, k['col'], (0.09, 0.07, 0.025), rot=(0, 0, 40 if sx * sy > 0 else -40))
    cone((-0.28, 0, 0.04), 0.03, 0.08, k['col'], seg=5, rot=(0, -90, 0))


def can(k):
    cyl((0, 0, 0), 0.12, 0.3, '#b8bcc4', seg=12, rot=(0, 90, 0))
    cyl((0.07, 0, 0), 0.123, 0.14, '#e8574c', seg=12, rot=(0, 90, 0))
    cyl((0.3, 0, 0), 0.1, 0.01, '#8a8e96', seg=12, rot=(0, 90, 0))


def boot(k):
    box((0, 0, 0.2), (0.2, 0.18, 0.4), '#6a5a3a', bevel=0.04)
    box((0.1, 0, 0.07), (0.4, 0.18, 0.14), '#6a5a3a', bevel=0.04)
    box((0.1, 0, 0.0), (0.42, 0.2, 0.04), '#3a3024')
    box((0, 0, 0.4), (0.22, 0.2, 0.05), '#8a7a52')


FISH_FN = {'fish': fish, 'eel': eel, 'flat': flatfish, 'puffer': puffer, 'squid': squid, 'octopus': octopus, 'seahorse': seahorse,
           'ray': ray, 'sunfish': sunfish, 'shark': shark, 'crayfish': crayfish, 'turtle': softshell, 'can': can, 'boot': boot}


# ---------------------------------------------------------------------------- 곤충
def legs(c, y0, y1, n=3, spread=0.1, z=0.06, r=0.008):
    for i in range(n):
        y = y0 + (y1 - y0) * (i / max(1, n - 1))
        for s in (1, -1):
            tube((s * 0.03, y, z), (s * spread, y + (i - 1) * 0.02, z + 0.03), r, c, seg=4)
            tube((s * spread, y + (i - 1) * 0.02, z + 0.03), (s * (spread + 0.04), y + (i - 1) * 0.03, 0), r, c, seg=4)


def butterfly(m, k):
    big = 1.3 if k.get('big') else 1
    body = k['body']
    ball((0, 0, 0.1), 1.0, body, (0.035 if not k.get('fat') else 0.06, 0.13, 0.035 if not k.get('fat') else 0.055))
    ball((0, -0.13, 0.1), 0.035, body)
    for s in (1, -1):
        tube((s * 0.01, -0.15, 0.11), (s * 0.06, -0.24, 0.14), 0.005, body, seg=4)
    for nm, s in (('wing_L', 1), ('wing_R', -1)):
        with m.part(nm, (0, 0, 0.1)):
            w, tp = k['wing'], k['tip']
            quad([(s * 0.02, -0.1, 0.1), (s * 0.3 * big, -0.2 * big, 0.1), (s * 0.34 * big, 0.0, 0.1), (s * 0.02, 0.02, 0.1)], w)
            quad([(s * 0.02, 0.02, 0.1), (s * 0.3 * big, 0.02, 0.1), (s * 0.22 * big, 0.2 * big, 0.1), (s * 0.02, 0.12, 0.1)], w)
            tri([(s * 0.3 * big, -0.2 * big, 0.102), (s * 0.34 * big, 0.0, 0.102), (s * 0.22 * big, -0.1 * big, 0.102)], tp)
            if k.get('stripe'):
                for i in range(3):
                    quad([(s * (0.08 + i * 0.07) * big, -0.12 * big, 0.103), (s * (0.1 + i * 0.07) * big, -0.12 * big, 0.103),
                          (s * (0.1 + i * 0.07) * big, 0.1 * big, 0.103), (s * (0.08 + i * 0.07) * big, 0.1 * big, 0.103)], k['stripe'])
            if k.get('tailed'):
                tri([(s * 0.2 * big, 0.18 * big, 0.1), (s * 0.24 * big, 0.3 * big, 0.1), (s * 0.15 * big, 0.2 * big, 0.1)], tp)


def bee(m, k):
    big = 1.35 if k.get('big') else 1
    b, st = k['body'], k['stripe']
    ball((0, -0.1 * big, 0.12), 0.05 * big, st)
    ball((0, -0.02 * big, 0.12), 0.06 * big, b)
    ball((0, 0.09 * big, 0.12), 0.075 * big, b, (1, 1.3, 1))
    for y in (0.05, 0.11):
        torus((0, y * big, 0.12), 0.07 * big, 0.014, st, seg=10, tseg=4, rot=(90, 0, 0))
    cone((0, 0.19 * big, 0.12), 0.012, 0.05, st, seg=4, rot=(-90, 0, 0))
    for nm, s in (('wing_L', 1), ('wing_R', -1)):
        with m.part(nm, (0, -0.02, 0.17)):
            ball((s * 0.09 * big, 0.0, 0.17), 1.0, '#eaf6ff', (0.09 * big, 0.045 * big, 0.006))
    legs(st, -0.06, 0.04, 3, 0.06, 0.08, 0.006)


def ladybug(m, k):
    ball((0, 0, 0.02), 0.13, k['shell'], (1, 1.1, 0.7), sub=3)
    ball((0, -0.12, 0.05), 0.06, k['spot'], (1.2, 0.8, 0.8))
    box((0, 0.01, 0.105), (0.01, 0.24, 0.012), k['spot'])
    for (x, y) in ((0.06, -0.03), (0.07, 0.07), (0.03, 0.02)):
        for s in (1, -1):
            ball((s * x, y, 0.07 + (0.03 if x < 0.05 else 0)), 0.024, k['spot'], (1, 1, 0.4))
    for s in (1, -1):
        ball((s * 0.035, -0.16, 0.06), 0.014, WHITE)


def stinkbug(m, k):
    c = k['shell']
    poly([(0, -0.16, 0.05), (0.13, -0.08, 0.05), (0.1, 0.12, 0.05), (0, 0.17, 0.05), (-0.1, 0.12, 0.05), (-0.13, -0.08, 0.05), (0, 0, 0.11)],
         [(0, 1, 6), (1, 2, 6), (2, 3, 6), (3, 4, 6), (4, 5, 6), (5, 0, 6)], c)
    tri([(0, -0.04, 0.112), (0.05, 0.06, 0.1), (-0.05, 0.06, 0.1)], '#4a7a34')
    ball((0, -0.17, 0.06), 0.04, '#4a7a34')
    legs('#4a7a34', -0.08, 0.08, 3, 0.12, 0.04)


def mantis(m, k):
    c = k['col']
    tube((0, 0.2, 0.08), (0, -0.02, 0.18), 0.045, c, r2=0.035, seg=6)
    tube((0, -0.02, 0.18), (0, -0.14, 0.34), 0.028, c, seg=6)
    cone((0, -0.14, 0.33), 0.06, 0.07, c, seg=3, rot=(200, 0, 0))
    for s in (1, -1):
        ball((s * 0.05, -0.17, 0.38), 0.022, BLACK)
        tube((s * 0.02, -0.1, 0.3), (s * 0.09, -0.2, 0.24), 0.018, c, seg=5)
        tube((s * 0.09, -0.2, 0.24), (s * 0.07, -0.26, 0.36), 0.014, c, r2=0.004, seg=5)
        for (y, z) in ((0.04, 0.14), (0.14, 0.1)):
            tube((s * 0.03, y, z), (s * 0.14, y + 0.02, z + 0.04), 0.008, c, seg=4)
            tube((s * 0.14, y + 0.02, z + 0.04), (s * 0.18, y + 0.06, 0), 0.008, c, seg=4)


def hopper(m, k):
    c = k['col']
    fat = 1.35 if k.get('fat') else 1
    ln = 0.34 if k.get('long') else (0.2 if k.get('short') else 0.26)
    ball((0, 0.02, 0.09), 1.0, c, (0.05 * fat, ln * 0.55, 0.055 * fat), sub=3)
    if k.get('long'):
        cone((0, -ln * 0.5, 0.1), 0.045, 0.12, c, seg=6, rot=(96, 0, 0))
    else:
        ball((0, -ln * 0.5, 0.1), 0.05 * fat, c)
    for s in (1, -1):
        ball((s * 0.04, -ln * 0.5 - 0.02, 0.12), 0.016, BLACK)
        tube((s * 0.02, -ln * 0.52, 0.14), (s * 0.08, -ln * 0.5 - (0.3 if k.get('short') else 0.14), 0.2), 0.005, c, seg=4)
        tube((s * 0.05, 0.06, 0.08), (s * 0.1, 0.16, 0.2), 0.02, c, r2=0.012, seg=5)      # 뒷다리(넓적다리)
        tube((s * 0.1, 0.16, 0.2), (s * 0.13, 0.22, 0.0), 0.009, c, seg=4)
        for y in (-0.08, 0.0):
            tube((s * 0.03, y, 0.07), (s * 0.1, y - 0.02, 0.0), 0.007, c, seg=4)


def ant(m, k):
    c = k['col']
    ball((0, -0.09, 0.07), 0.04, c)
    ball((0, -0.02, 0.065), 0.03, c)
    ball((0, 0.07, 0.07), 0.05, c, (1, 1.3, 1))
    for s in (1, -1):
        tube((s * 0.015, -0.12, 0.09), (s * 0.05, -0.19, 0.13), 0.005, c, seg=4)
    legs(c, -0.05, 0.02, 3, 0.07, 0.05, 0.006)


def dragonfly(m, k):
    big = 1.25 if k.get('big') else 1
    c, t = k['col'], k.get('tail', k['col'])
    ball((0, -0.12 * big, 0.12), 0.045 * big, c, (1.3, 1, 1))
    for s in (1, -1):
        ball((s * 0.03 * big, -0.14 * big, 0.13), 0.028 * big, '#3a6a4a')
    ball((0, -0.04 * big, 0.12), 0.05 * big, c)
    tube((0, 0.0, 0.12), (0, 0.36 * big, 0.12), 0.018 * big, t, r2=0.012, seg=6)
    for nm, s in (('wing_L', 1), ('wing_R', -1)):
        with m.part(nm, (0, -0.04, 0.15)):
            ball((s * 0.18 * big, -0.07 * big, 0.15), 1.0, '#eaf6ff', (0.17 * big, 0.04, 0.005))
            ball((s * 0.17 * big, 0.03 * big, 0.15), 1.0, '#eaf6ff', (0.16 * big, 0.04, 0.005))


def cicada(m, k):
    big = 1.25 if k.get('big') else 1
    c = k['col']
    ball((0, 0.0, 0.08), 1.0, c, (0.075 * big, 0.15 * big, 0.065 * big), sub=3)
    ball((0, -0.13 * big, 0.08), 1.0, c, (0.085 * big, 0.05 * big, 0.05 * big))
    for s in (1, -1):
        ball((s * 0.075 * big, -0.14 * big, 0.09), 0.022 * big, '#8a3a2a')
        ball((s * 0.06 * big, 0.06 * big, 0.11), 1.0, k['wing'], (0.05 * big, 0.2 * big, 0.008), rot=(0, s * 35, s * -8))
    legs(c, -0.08, 0.04, 3, 0.09, 0.05)


def beetle(m, k):
    c = k['shell']
    hd = '#2a2028'
    ball((0, 0.03, 0.07), 1.0, c, (0.11, 0.15, 0.085), sub=3)
    box((0, 0.04, 0.156), (0.008, 0.22, 0.008), hd)
    ball((0, -0.1, 0.07), 1.0, c, (0.085, 0.06, 0.06))
    ball((0, -0.17, 0.065), 0.045, hd, (1.2, 0.9, 0.8))
    if k.get('rim'):
        torus((0, 0.03, 0.06), 0.115, 0.012, k['rim'], seg=12, tseg=4, scale=(1, 1.34, 1))
    h = k.get('horn')
    if h == 'rhino':
        tube((0, -0.19, 0.08), (0, -0.3, 0.2), 0.02, hd, seg=5)
        for s in (1, -1):
            tube((0, -0.3, 0.2), (s * 0.04, -0.33, 0.25), 0.012, hd, seg=4)
        tube((0, -0.1, 0.12), (0, -0.15, 0.2), 0.014, hd, r2=0.004, seg=4)
    elif h in ('stag', 'saw'):
        for s in (1, -1):
            tube((s * 0.03, -0.2, 0.07), (s * 0.09, -0.3, 0.08), 0.016, hd, seg=5)
            tube((s * 0.09, -0.3, 0.08), (s * 0.04, -0.38, 0.08), 0.012, hd, r2=0.004, seg=5)
            if h == 'saw':
                for j in range(3):
                    cone((s * (0.065 - j * 0.004), -0.25 - j * 0.03, 0.08), 0.008, 0.03, hd, seg=4, rot=(0, s * -90, 0))
    elif h == 'long':
        for s in (1, -1):
            tube((s * 0.02, -0.2, 0.09), (s * 0.12, -0.24, 0.16), 0.006, hd, seg=4)
            tube((s * 0.12, -0.24, 0.16), (s * 0.2, 0.18, 0.12), 0.005, hd, seg=4)
    legs(hd, -0.1, 0.1, 3, 0.13, 0.04, 0.009)


def firefly(m, k):
    ball((0, 0.0, 0.07), 1.0, k['col'], (0.045, 0.11, 0.04), sub=2)
    ball((0, -0.09, 0.07), 0.04, '#e8563c', (1.2, 0.8, 0.8))
    ball((0, -0.14, 0.065), 0.025, BLACK)
    with m.part('glow'):
        ball((0, 0.1, 0.065), 0.04, '#eaff8a', (1, 1.2, 0.9))


def pillbug(m, k):
    for i in range(6):
        y = -0.1 + i * 0.045
        ball((0, y, 0.03), 1.0, k['col'] if i % 2 else '#6a6a78', (0.085 - abs(i - 2.5) * 0.008, 0.035, 0.07 - abs(i - 2.5) * 0.006))
    for s in (1, -1):
        tube((s * 0.02, -0.13, 0.04), (s * 0.05, -0.19, 0.06), 0.005, k['col'], seg=4)


def snail(m, k):
    ball((0, -0.02, 0.035), 1.0, k['body'], (0.05, 0.17, 0.035))
    for s in (1, -1):
        tube((s * 0.02, -0.17, 0.05), (s * 0.04, -0.21, 0.13), 0.008, k['body'], seg=4)
        ball((s * 0.04, -0.21, 0.135), 0.013, BLACK)
    ball((0, 0.04, 0.14), 0.11, k['shell'], (0.7, 1, 1), sub=3)
    torus((0, 0.04, 0.14), 0.06, 0.012, '#8a6a3a', seg=10, tseg=4, rot=(0, 90, 0))
    ball((0.075, 0.04, 0.14), 0.02, '#8a6a3a')
    ball((-0.075, 0.04, 0.14), 0.02, '#8a6a3a')


def spider(m, k):
    c = k['col']
    ball((0, 0.06, 0.09), 0.085, c, (1, 1.15, 0.9))
    ball((0, -0.05, 0.08), 0.05, c)
    ball((0, 0.08, 0.15), 0.03, '#e8c84a', (1, 1.4, 0.5))
    for i in range(4):
        y = -0.08 + i * 0.035
        for s in (1, -1):
            tube((s * 0.03, y, 0.08), (s * 0.13, y - 0.05 + i * 0.04, 0.16), 0.007, c, seg=4)
            tube((s * 0.13, y - 0.05 + i * 0.04, 0.16), (s * 0.19, y - 0.08 + i * 0.06, 0), 0.006, c, seg=4)


def bagworm(m, k):
    cone((0, 0, 0), 0.07, 0.26, k['col'], seg=7, rot=(0, 0, 0))
    ball((0, 0, 0.02), 0.07, k['col'])
    for i in range(7):
        a = i * 2.4
        tube((math.cos(a) * 0.05, math.sin(a) * 0.05, 0.03 + i * 0.025), (math.cos(a) * 0.07, math.sin(a) * 0.07, 0.11 + i * 0.025), 0.01, '#6a4a2a' if i % 2 else '#a8845a', seg=4)
    ball((0, -0.03, 0.0), 0.03, '#3a2a1a')


def strider(m, k):
    c = k['col']
    ball((0, 0, 0.05), 1.0, c, (0.02, 0.13, 0.02))
    for s in (1, -1):
        tube((s * 0.01, -0.02, 0.05), (s * 0.22, -0.14, 0.0), 0.005, c, seg=4)
        tube((s * 0.01, 0.03, 0.05), (s * 0.24, 0.18, 0.0), 0.005, c, seg=4)
        tube((s * 0.01, -0.1, 0.05), (s * 0.06, -0.18, 0.0), 0.005, c, seg=4)


BUG_FN = {'butterfly': butterfly, 'bee': bee, 'ladybug': ladybug, 'stinkbug': stinkbug, 'mantis': mantis, 'hopper': hopper, 'ant': ant,
          'dragonfly': dragonfly, 'cicada': cicada, 'beetle': beetle, 'firefly': firefly, 'pillbug': pillbug, 'snail': snail,
          'spider': spider, 'bagworm': bagworm, 'strider': strider}


def shadows():
    """물속 물고기 그림자(크기 1~6)와 등지느러미"""
    for sz in range(1, 7):
        L = 0.3 + sz * 0.17
        with Model('fishshadow_%d' % sz):
            V = []
            n = 12
            for i in range(n):
                a = 2 * math.pi * i / n
                V.append((math.cos(a) * L * 0.5 * (1 if math.cos(a) > 0 else 0.85), math.sin(a) * L * (0.15 + sz * 0.006), 0))
            poly(V, [tuple(range(n))], '#1a2a44')
            poly([(-L * 0.4, 0, 0), (-L * 0.68, L * 0.16, 0), (-L * 0.6, 0, 0), (-L * 0.68, -L * 0.16, 0)], [(0, 1, 2), (0, 2, 3)], '#1a2a44')
    with Model('fishfin'):
        tri([(0.2, 0, 0), (-0.25, 0, 0), (-0.15, 0, 0.36)], '#2a3a52')


def build():
    for f in json.load(open(os.path.join(ROOT, 'data/fish.json'), encoding='utf-8')):
        with Model('fish_' + f['id']):
            FISH_FN[f['look']['type']](f['look'])
    for b in json.load(open(os.path.join(ROOT, 'data/bugs.json'), encoding='utf-8')):
        with Model('bug_' + b['id']) as m:
            BUG_FN[b['look']['type']](m, b['look'])
    shadows()
