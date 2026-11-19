"""물고기와 곤충 모델. data/fish.json, data/bugs.json의 look 값을 읽어 종마다 하나씩 만든다.
물고기: 머리가 +X, 옆모습이 정면(-Y)을 향한다.  곤충: 머리가 -Y, 바닥이 Z=0."""
import json
import math
import os
from lib import *
import fishkit
import topkit
import bugkit

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


def can(k):
    cyl((0, 0, 0), 0.12, 0.3, '#b8bcc4', seg=12, rot=(0, 90, 0))
    cyl((0.07, 0, 0), 0.123, 0.14, '#e8574c', seg=12, rot=(0, 90, 0))
    cyl((0.3, 0, 0), 0.1, 0.01, '#8a8e96', seg=12, rot=(0, 90, 0))


def boot(k):
    box((0, 0, 0.2), (0.2, 0.18, 0.4), '#6a5a3a', bevel=0.04)
    box((0.1, 0, 0.07), (0.4, 0.18, 0.14), '#6a5a3a', bevel=0.04)
    box((0.1, 0, 0.0), (0.42, 0.2, 0.04), '#3a3024')
    box((0, 0, 0.4), (0.22, 0.2, 0.05), '#8a7a52')


def snail(m, k):
    ball((0, -0.02, 0.035), 1.0, k['body'], (0.05, 0.17, 0.035))
    for s in (1, -1):
        tube((s * 0.02, -0.17, 0.05), (s * 0.04, -0.21, 0.13), 0.008, k['body'], seg=4)
        ball((s * 0.04, -0.21, 0.135), 0.013, BLACK)
    ball((0, 0.04, 0.14), 0.11, k['shell'], (0.7, 1, 1), sub=3)
    torus((0, 0.04, 0.14), 0.06, 0.012, '#8a6a3a', seg=10, tseg=4, rot=(0, 90, 0))
    ball((0.075, 0.04, 0.14), 0.02, '#8a6a3a')
    ball((-0.075, 0.04, 0.14), 0.02, '#8a6a3a')


def bagworm(m, k):
    cone((0, 0, 0), 0.07, 0.26, k['col'], seg=7, rot=(0, 0, 0))
    ball((0, 0, 0.02), 0.07, k['col'])
    for i in range(7):
        a = i * 2.4
        tube((math.cos(a) * 0.05, math.sin(a) * 0.05, 0.03 + i * 0.025), (math.cos(a) * 0.07, math.sin(a) * 0.07, 0.11 + i * 0.025), 0.01, '#6a4a2a' if i % 2 else '#a8845a', seg=4)
    ball((0, -0.03, 0.0), 0.03, '#3a2a1a')


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


# ---------------------------------------------------------------------------- 묶음 만들기
# 종의 생김새는 data/fish.json, data/bugs.json 의 look 에 적는다. look.f 가 만드는 틀(무리)을 정한다.
OLD_FISH = {'squid': squid, 'octopus': octopus, 'seahorse': seahorse, 'can': can, 'boot': boot}
OLD_BUG = {'snail': snail, 'bagworm': bagworm}


def build_fish():
    for f in json.load(open(os.path.join(ROOT, 'data/fish.json'), encoding='utf-8')):
        lk = f['look']
        t = lk['f']
        with Model('fish_' + f['id']) as m:
            if t in topkit.SEA_FN:              # 게·거북·가오리처럼 위에서 본 모습이 특징인 것
                topkit.SEA_FN[t](m, f['id'], lk)
            elif t in OLD_FISH:
                OLD_FISH[t](lk)
            else:                               # 옆모습 그림을 입히는 물고기
                fishkit.make_fish(f['id'], lk)
    shadows()


def build_bugs():
    for b in json.load(open(os.path.join(ROOT, 'data/bugs.json'), encoding='utf-8')):
        lk = b['look']
        with Model('bug_' + b['id']) as m:
            if lk['f'] in OLD_BUG:
                OLD_BUG[lk['f']](m, lk)
            else:
                bugkit.BUG_FN[lk['f']](m, b['id'], lk)
