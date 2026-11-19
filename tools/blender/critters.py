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


def can(k):
    cyl((0, 0, 0), 0.12, 0.3, '#b8bcc4', seg=12, rot=(0, 90, 0))
    cyl((0.07, 0, 0), 0.123, 0.14, '#e8574c', seg=12, rot=(0, 90, 0))
    cyl((0.3, 0, 0), 0.1, 0.01, '#8a8e96', seg=12, rot=(0, 90, 0))


def boot(k):
    box((0, 0, 0.2), (0.2, 0.18, 0.4), '#6a5a3a', bevel=0.04)
    box((0.1, 0, 0.07), (0.4, 0.18, 0.14), '#6a5a3a', bevel=0.04)
    box((0.1, 0, 0.0), (0.42, 0.2, 0.04), '#3a3024')
    box((0, 0, 0.4), (0.22, 0.2, 0.05), '#8a7a52')


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
OLD_FISH = {'can': can, 'boot': boot}


def build_fish():
    for f in json.load(open(os.path.join(ROOT, 'data/fish.json'), encoding='utf-8')):
        lk = f['look']
        t = lk['f']
        with Model('fish_' + f['id']) as m:
            if t in topkit.SEA_FN:              # 게·거북·가오리·문어처럼 따로 틀이 있는 것
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
            bugkit.BUG_FN[lk['f']](m, b['id'], lk)
