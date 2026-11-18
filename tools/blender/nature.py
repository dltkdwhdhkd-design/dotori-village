"""자연물 모델: 나무, 꽃, 돌, 과일, 조개 등."""
import math
from lib import *


def trunk(r=0.2, h=1.3, r2=0.14):
    cyl((0, 0, 0), r * 1.35, 0.18, 'bark', r2=r, seg=10)
    cyl((0, 0, 0.16), r, h - 0.16, 'bark', r2=r2, seg=10)


def tree_fruit():
    with Model('tree_fruit') as m:
        trunk()
        with m.part('canopy'):
            ball((0, 0, 2.05), 0.98, 'leaf', (1, 1, 0.9))
            ball((-0.66, 0.05, 1.72), 0.64, 'leaf_d')
            ball((0.66, -0.05, 1.72), 0.64, 'leaf_d')
            ball((0.05, -0.56, 1.66), 0.6, 'leaf_d')
            ball((0, 0.55, 1.8), 0.62, 'leaf_d')
            ball((0.08, -0.05, 2.66), 0.62, 'leaf_l')
            ball((-0.4, -0.3, 2.35), 0.42, 'leaf_l')
        with m.part('snow'):
            ball((0.08, -0.05, 2.95), 0.5, 'snow', (1, 1, 0.42))
            ball((-0.5, -0.25, 2.5), 0.36, 'snow', (1, 1, 0.42))
            ball((0.55, 0.1, 2.32), 0.36, 'snow', (1, 1, 0.42))
        m.anchor('fruit1', (-0.62, -0.62, 1.5))
        m.anchor('fruit2', (0.1, -0.98, 1.95))
        m.anchor('fruit3', (0.68, -0.6, 1.52))


def tree_blossom():
    with Model('tree_blossom') as m:
        cyl((0, 0, 0), 0.25, 0.18, 'bark', r2=0.18, seg=10)
        cyl((0, 0, 0.16), 0.18, 1.0, 'bark', r2=0.13, seg=10)
        tips = [(-0.6, 0.0, 1.95), (0.62, 0.05, 1.9), (0.0, 0.5, 2.1), (0.05, -0.45, 2.0), (0.0, 0.0, 2.55)]
        for t in tips:
            tube((0, 0, 1.1), t, 0.09, 'bark', r2=0.04, seg=6)
        with m.part('canopy'):
            ball((-0.62, 0.0, 2.0), 0.72, 'bloom_d')
            ball((0.64, 0.05, 1.95), 0.72, 'bloom_d')
            ball((0.0, 0.5, 2.15), 0.7, 'bloom_d')
            ball((0.05, -0.45, 2.05), 0.72, 'bloom')
            ball((0.0, 0.0, 2.6), 0.78, 'bloom')
            ball((-0.25, -0.2, 2.95), 0.42, 'bloom_l')
            ball((0.4, -0.3, 2.6), 0.36, 'bloom_l')
        with m.part('snow'):
            for t in tips:
                ball((t[0], t[1], t[2] + 0.04), 0.17, 'snow', (1, 1, 0.5))
            ball((0, 0, 1.2), 0.2, 'snow', (1, 1, 0.4))


def tree_pine():
    with Model('tree_pine') as m:
        cyl((0, 0, 0), 0.2, 0.16, 'bark', r2=0.15, seg=8)
        cyl((0, 0, 0.14), 0.15, 0.7, 'bark', r2=0.12, seg=8)
        tiers = [(0.62, 1.05, 1.15, 'pine_d'), (1.3, 0.86, 1.05, 'pine'), (1.95, 0.66, 0.95, 'pine'), (2.55, 0.44, 0.85, 'pine_l')]
        with m.part('canopy'):
            for (z, r, h, mt) in tiers:
                cone((0, 0, z), r, h, mt, seg=10)
        with m.part('snow'):
            for (z, r, h, mt) in tiers:
                cone((0, 0, z + h * 0.52), r * 0.56, h * 0.5, 'snow', seg=10)


def bigtree():
    with Model('bigtree') as m:
        cyl((0, 0, 0), 0.75, 0.3, 'bark', r2=0.52, seg=12)
        cyl((0, 0, 0.28), 0.52, 1.6, 'bark', r2=0.4, seg=12)
        for (x, y) in ((0.55, 0.2), (-0.5, 0.3), (0.1, -0.6), (-0.3, -0.45), (0.45, -0.35)):
            tube((x * 0.5, y * 0.5, 0.4), (x * 1.5, y * 1.5, 0.0), 0.2, 'bark', r2=0.08, seg=6)
        tips = [(-1.4, 0.2, 3.0), (1.45, 0.1, 3.0), (0.0, 1.2, 3.3), (0.2, -1.1, 3.0), (0.0, 0.0, 3.9), (-0.9, -0.8, 3.3), (1.0, 0.9, 3.4)]
        for t in tips:
            tube((0, 0, 1.8), (t[0] * 0.6, t[1] * 0.6, t[2] - 0.4), 0.2, 'bark', r2=0.1, seg=6)
        torus((0, 0, 1.05), 0.5, 0.045, 'cream', seg=14, tseg=5)
        box((0.18, -0.5, 0.9), (0.08, 0.03, 0.26), 'cream')
        box((-0.12, -0.5, 0.92), (0.08, 0.03, 0.2), 'cream')
        with m.part('canopy'):
            ball((-1.45, 0.2, 3.0), 1.15, 'big_d')
            ball((1.5, 0.1, 3.0), 1.15, 'big_d')
            ball((0.0, 1.25, 3.2), 1.2, 'big_d')
            ball((0.2, -1.15, 2.95), 1.1, 'big_d')
            ball((-0.95, -0.85, 3.4), 1.0, 'big')
            ball((1.0, 0.9, 3.5), 1.05, 'big')
            ball((0.0, 0.0, 3.9), 1.5, 'big')
            ball((0.9, -0.7, 3.9), 0.9, 'big')
            ball((-0.3, -0.2, 4.9), 0.95, 'big_l')
            ball((-1.0, 0.3, 4.2), 0.8, 'big_l')
            ball((0.7, 0.1, 4.6), 0.7, 'big_l')
        with m.part('snow'):
            ball((-0.3, -0.2, 5.5), 0.7, 'snow', (1, 1, 0.4))
            ball((-1.2, 0.3, 4.75), 0.55, 'snow', (1, 1, 0.4))
            ball((0.9, 0.1, 5.05), 0.5, 'snow', (1, 1, 0.4))
            ball((1.5, 0.1, 3.95), 0.6, 'snow', (1, 1, 0.4))


def small_things():
    with Model('sapling'):
        cyl((0, 0, 0), 0.03, 0.3, 'stem', seg=6)
        ball((-0.09, 0, 0.26), 0.1, 'leaf_l', (1, 0.5, 0.45), rot=(0, 30, 0))
        ball((0.09, 0, 0.3), 0.1, 'leaf', (1, 0.5, 0.45), rot=(0, -30, 0))
        ball((0, 0, 0.38), 0.08, 'leaf_l', (0.6, 0.5, 1))
    with Model('stump') as m:
        cyl((0, 0, 0), 0.28, 0.14, 'bark', r2=0.22, seg=10)
        cyl((0, 0, 0.12), 0.22, 0.16, 'bark', r2=0.21, seg=10)
        disc((0, 0, 0.285), 0.19, 'wood_l', seg=10)
        disc((0, 0, 0.29), 0.1, 'wood', seg=10)
        with m.part('snow'):
            cyl((0, 0, 0.28), 0.21, 0.05, 'snow', r2=0.15, seg=10)
    for i, (sc, sd) in enumerate((((0.44, 0.4, 0.32), 1), ((0.5, 0.36, 0.28), 5))):
        with Model('rock%d' % (i + 1)) as m:
            lump((0, 0, sc[2] * 0.8), 1.0, 'rock', sc, seed=sd, amp=0.22)
            lump((0.3, -0.15, 0.12), 1.0, 'rock_d', (0.2, 0.18, 0.15), seed=sd + 2, amp=0.2)
            with m.part('snow'):
                lump((0, 0, sc[2] * 1.5), 1.0, 'snow', (sc[0] * 0.75, sc[1] * 0.75, 0.08), seed=sd, amp=0.1)
    for i, sd in enumerate((3, 8)):
        with Model('boulder%d' % (i + 1)):
            lump((0, 0, 0.5), 1.0, 'rock', (0.85, 0.75, 0.7), seed=sd, amp=0.25)
            lump((0.6, -0.3, 0.25), 1.0, 'rock_d', (0.45, 0.4, 0.35), seed=sd + 1, amp=0.25)
            lump((-0.55, 0.3, 0.3), 1.0, 'rock_l', (0.4, 0.4, 0.4), seed=sd + 4, amp=0.25)
    for v in (1, 2):
        with Model('weed%d' % v):
            n = 5 if v == 1 else 4
            for i in range(n):
                a = 2 * math.pi * i / n + v
                tube((0, 0, 0), (math.cos(a) * 0.16, math.sin(a) * 0.16, 0.22 + 0.06 * (i % 2)), 0.035, 'weed', r2=0.004, seg=5)
            tube((0, 0, 0), (0, 0, 0.32), 0.035, 'weed', r2=0.004, seg=5)
            if v == 2:
                ball((0, 0, 0.33), 0.045, 'petal_c')
    with Model('digspot'):
        for a in (0, 45, 90, 135):
            box((0, 0, 0.012), (0.42, 0.05, 0.012), 'dirt_d', rot=(0, 0, a))
        disc((0, 0, 0.02), 0.07, 'dirt_d', seg=8)
    with Model('hole'):
        torus((0, 0, 0.02), 0.3, 0.07, 'dirt', seg=12, tseg=5, scale=(1, 1, 0.6))
        disc((0, 0, 0.01), 0.3, 'dirt_d', seg=12)
    with Model('buried'):   # 무언가 묻힌 자리(덮인 흙)
        ball((0, 0, 0), 0.26, 'dirt', (1, 1, 0.22))


def flower(species):
    with Model('flower_' + species):
        spots = [(-0.2, 0.12, 0.3), (0.2, 0.08, 0.34), (0.0, -0.16, 0.26)]
        for (x, y, h) in spots:
            cyl((x, y, 0), 0.02, h, 'stem', seg=5)
            ball((x - 0.07, y, h * 0.45), 0.07, 'stem', (1, 0.45, 0.3), rot=(0, 25, 0))
            ball((x + 0.07, y, h * 0.6), 0.07, 'stem', (1, 0.45, 0.3), rot=(0, -25, 0))
            z = h + 0.03
            if species == 'tulip':
                ball((x, y, z + 0.03), 0.085, 'petal', (0.9, 0.9, 1.2))
                for a in (0, 120, 240):
                    r = math.radians(a)
                    cone((x + math.cos(r) * 0.04, y + math.sin(r) * 0.04, z + 0.06), 0.045, 0.1, 'petal', seg=5)
            elif species == 'cosmos':
                for i in range(8):
                    r = 2 * math.pi * i / 8
                    ball((x + math.cos(r) * 0.085, y + math.sin(r) * 0.085, z + 0.02), 0.05, 'petal', (1.1, 0.6, 0.25), rot=(0, 0, math.degrees(r)))
                ball((x, y, z + 0.035), 0.045, 'petal_c', (1, 1, 0.6))
            elif species == 'pansy':
                for i, (dx, dy) in enumerate(((-0.05, 0.03), (0.05, 0.03), (-0.06, -0.03), (0.06, -0.03), (0, -0.07))):
                    ball((x + dx, y + dy, z + 0.02 + (0.01 if i < 2 else 0)), 0.065, 'petal', (1, 1, 0.3))
                ball((x, y - 0.01, z + 0.04), 0.03, 'petal_c', (1, 1, 0.5))
            else:  # mum
                ball((x, y, z + 0.04), 0.095, 'petal', (1, 1, 0.8))
                ball((x, y, z + 0.09), 0.05, 'petal_c', (1, 1, 0.5))


def fruits():
    with Model('fruit_apple'):
        ball((0, 0, 0.15), 0.15, '#e8463c', (1, 1, 0.92), sub=2)
        cyl((0, 0, 0.27), 0.012, 0.07, 'bark', seg=5)
        ball((0.05, 0, 0.32), 0.05, 'leaf', (1, 0.5, 0.3), rot=(0, -20, 0))
    with Model('fruit_pear'):
        ball((0, 0, 0.14), 0.15, '#d9d36a', sub=2)
        ball((0, 0, 0.27), 0.1, '#d9d36a', (1, 1, 1.1), sub=2)
        cyl((0, 0, 0.36), 0.012, 0.07, 'bark', seg=5)
    with Model('fruit_peach'):
        ball((0, 0, 0.15), 0.15, '#ffa9b8', (1, 1, 0.95), sub=2)
        ball((0, 0.04, 0.17), 0.13, '#ff8fa6', (1, 1, 0.95), sub=2)
        ball((0.06, 0, 0.3), 0.06, 'leaf', (1.2, 0.5, 0.3), rot=(0, -25, 0))
    with Model('fruit_persimmon'):
        ball((0, 0, 0.13), 0.16, '#f08a2e', (1, 1, 0.78), sub=2)
        for a in (0, 90, 180, 270):
            r = math.radians(a)
            ball((math.cos(r) * 0.06, math.sin(r) * 0.06, 0.25), 0.055, '#5f8a3e', (1.2, 0.7, 0.3), rot=(0, 0, a))
        cyl((0, 0, 0.25), 0.014, 0.04, 'bark', seg=5)
    with Model('fruit_mandarin'):
        ball((0, 0, 0.13), 0.145, '#ffa62e', (1, 1, 0.88), sub=2)
        ball((0, 0, 0.255), 0.022, '#5f8a3e')
        ball((0.05, 0, 0.27), 0.045, 'leaf', (1.2, 0.5, 0.3), rot=(0, -15, 0))
    with Model('acorn'):
        ball((0, 0, 0.11), 0.1, '#c98a4a', (0.9, 0.9, 1.15), sub=2)
        ball((0, 0, 0.19), 0.105, '#8a5a3a', (1, 1, 0.55), sub=2)
        cyl((0, 0, 0.23), 0.012, 0.05, 'bark_d', seg=5)
    with Model('bag'):       # 도토리 주머니
        ball((0, 0, 0.14), 0.17, '#e9c46a', (1, 1, 0.9), sub=2)
        cyl((0, 0, 0.25), 0.07, 0.07, '#e9c46a', r2=0.1, seg=8)
        torus((0, 0, 0.26), 0.07, 0.018, 'red', seg=8, tseg=4)
    with Model('bundle'):    # 보따리(바닥에 내려놓은 가구)
        ball((0, 0, 0.17), 0.22, 'cloth', (1, 1, 0.8), sub=2)
        ball((-0.06, 0, 0.36), 0.07, 'cloth', (1.4, 0.6, 0.5), rot=(0, 30, 0))
        ball((0.06, 0, 0.36), 0.07, 'cloth', (1.4, 0.6, 0.5), rot=(0, -30, 0))
        ball((0, 0, 0.34), 0.045, '#d67a92')
    with Model('gift'):      # 선물 상자
        boxb((0, 0, 0), (0.34, 0.34, 0.26), '#ffd0d8', bevel=0.02)
        boxb((0, 0, 0), (0.08, 0.36, 0.27), 'red')
        boxb((0, 0, 0), (0.36, 0.08, 0.27), 'red')
        ball((-0.06, 0, 0.3), 0.06, 'red', (1.3, 0.6, 0.6))
        ball((0.06, 0, 0.3), 0.06, 'red', (1.3, 0.6, 0.6))
    with Model('nest'):      # 벌집
        for i, (z, r) in enumerate(((0.08, 0.13), (0.17, 0.17), (0.27, 0.15), (0.35, 0.1))):
            ball((0, 0, z), r, '#d9b25a' if i % 2 else '#c49a44', (1, 1, 0.45), sub=2)
        disc((0, -0.15, 0.17), 0.04, 'black', seg=6, rot=(90, 0, 0))


def shells():
    with Model('shell_scallop'):
        for i in range(7):
            a = math.radians(-60 + i * 20)
            tube((0, 0.1, 0.03), (math.sin(a) * 0.2, 0.1 - math.cos(a) * 0.24, 0.03), 0.035, '#ffd9c8' if i % 2 else '#ffb9a8', r2=0.05, seg=5)
        ball((0, 0.1, 0.03), 0.05, '#ffb9a8', (1.4, 0.7, 0.7))
    with Model('shell_conch'):
        for i in range(6):
            t = i / 5
            ball((-0.14 + t * 0.3, 0, 0.09 - t * 0.03), 0.11 - t * 0.085, '#ffe2b8' if i % 2 else '#f3bf8a', sub=2)
        ball((-0.12, -0.07, 0.07), 0.07, '#ffa9b8', (1, 0.5, 0.8))
    with Model('shell_clam'):
        ball((0, 0, 0.05), 0.17, '#f5f0e6', (1, 0.85, 0.42), sub=2)
        for i in range(3):
            torus((0, 0.02, 0.05), 0.07 + i * 0.035, 0.012, '#d9d0c0', seg=10, tseg=4, scale=(1, 0.85, 1))
    with Model('shell_star'):
        for i in range(5):
            a = math.radians(90 + i * 72)
            tube((0, 0, 0.035), (math.cos(a) * 0.2, math.sin(a) * 0.2, 0.025), 0.06, '#ff8a5a', r2=0.02, seg=6)
        ball((0, 0, 0.04), 0.07, '#ffa77a', (1, 1, 0.6))
    with Model('shell_coral'):
        tube((0, 0, 0), (0, 0, 0.18), 0.04, '#ff7a8a', r2=0.03, seg=6)
        for (x, y, z) in ((0.12, 0, 0.3), (-0.1, 0.04, 0.32), (0.02, -0.1, 0.28), (0.0, 0.08, 0.36)):
            tube((0, 0, 0.14), (x, y, z), 0.03, '#ff7a8a', r2=0.018, seg=6)
            ball((x, y, z), 0.028, '#ffa9b0')
    with Model('shell_pearl'):
        ball((0, 0, 0.05), 0.15, '#c9d0e0', (1, 0.9, 0.4), sub=2)
        ball((0, -0.02, 0.1), 0.06, '#fff6fa', sub=2)


def build():
    tree_fruit(); tree_blossom(); tree_pine(); bigtree(); small_things()
    for sp in ('tulip', 'cosmos', 'pansy', 'mum'):
        flower(sp)
    fruits(); shells()
