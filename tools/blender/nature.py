"""자연물 모델: 나무, 꽃, 돌, 과일, 조개 등."""
import math
from lib import *


def trunk(r=0.2, h=1.3, r2=0.14, roots=3, seg=12):
    """뿌리 쪽이 넓게 퍼진 줄기"""
    lathe([(r * 1.75, 0.0), (r * 1.3, 0.07), (r * 1.05, 0.22), (r, 0.5), (r2, h)], 'bark', seg=seg)
    for i in range(roots):
        a = math.radians(25 + i * 360 / roots)
        tube((math.cos(a) * r * 0.7, math.sin(a) * r * 0.7, 0.2), (math.cos(a) * r * 2.3, math.sin(a) * r * 2.3, 0.0), r * 0.42, 'bark', r2=r * 0.2, seg=6)
    lathe([(r * 1.03, 0.62), (r * 1.0, 0.66)], 'bark_d', seg=seg, caps=False)      # 줄기 무늬
    lathe([(r * 0.96, 0.9), (r * 0.93, 0.94)], 'bark_d', seg=seg, caps=False)


def puffs(spec):
    """잎 뭉치: [(x, y, z, 반지름, 재질, 세밀함), ...]"""
    big = sorted((q[3] for q in spec), reverse=True)[:3]
    for (x, y, z, r, mt, sub) in spec:
        lean = .10*math.sin(x*4+y*2)
        ball((x+lean, y, z), r, mt, (1.08,.93,.86), rot=(5,lean*74,13),sub=3)
        if r >= big[-1]:
            for k in range(4):
                a = k*1.57+x*3.1
                ball((x+.66*r*math.cos(a),y+.59*r*math.sin(a),z+r*.41),r*.45,mt,
                     (1.12,.94,.67),rot=(8,10,k*43),sub=2)


def tree_fruit():
    with Model('tree_fruit') as m:
        trunk()
        for (x, y, z) in ((-0.5, 0.0, 1.55), (0.5, 0.05, 1.5)):
            tube((0, 0, 1.05), (x, y, z), 0.085, 'bark', r2=0.05, seg=6)
        with m.part('canopy'):
            puffs([
                (0.0, 0.02, 2.12, 1.0, 'leaf', 3),
                (-0.72, 0.08, 1.78, 0.66, 'leaf_d', 3), (0.72, -0.02, 1.76, 0.66, 'leaf_d', 3),
                (0.02, -0.62, 1.7, 0.62, 'leaf_d', 3), (0.0, 0.62, 1.86, 0.64, 'leaf_d', 2),
                (-0.42, -0.42, 1.98, 0.6, 'leaf', 2), (0.46, -0.4, 2.0, 0.58, 'leaf', 2),
                (0.1, -0.06, 2.72, 0.64, 'leaf_l', 3), (-0.46, -0.3, 2.42, 0.44, 'leaf_l', 2), (0.5, 0.1, 2.5, 0.42, 'leaf_l', 2),
                (-0.2, -0.75, 2.2, 0.3, 'leaf_l', 2),
            ])
        with m.part('snow'):
            ball((0.1, -0.06, 3.02), 0.52, 'snow', (1, 1, 0.42), sub=2)
            ball((-0.52, -0.28, 2.6), 0.38, 'snow', (1, 1, 0.42), sub=2)
            ball((0.56, 0.1, 2.66), 0.36, 'snow', (1, 1, 0.42), sub=2)
        m.anchor('fruit1', (-0.66, -0.66, 1.5))
        m.anchor('fruit2', (0.08, -1.02, 1.92))
        m.anchor('fruit3', (0.72, -0.62, 1.5))


def tree_blossom():
    with Model('tree_blossom') as m:
        trunk(r=0.18, h=1.1, r2=0.13)
        tips = [(-0.62, 0.0, 1.95), (0.64, 0.05, 1.9), (0.0, 0.52, 2.1), (0.05, -0.47, 2.0), (0.0, 0.0, 2.55)]
        for t in tips:
            tube((0, 0, 1.05), t, 0.095, 'bark', r2=0.04, seg=6)
        with m.part('canopy'):
            puffs([
                (-0.66, 0.0, 2.02, 0.74, 'bloom_d', 3), (0.68, 0.05, 1.97, 0.74, 'bloom_d', 3),
                (0.0, 0.54, 2.17, 0.72, 'bloom_d', 2), (0.05, -0.5, 2.07, 0.74, 'bloom', 3),
                (0.0, 0.0, 2.62, 0.8, 'bloom', 3),
                (-0.3, -0.24, 2.98, 0.44, 'bloom_l', 2), (0.44, -0.3, 2.66, 0.4, 'bloom_l', 2), (-0.7, -0.4, 2.3, 0.36, 'bloom_l', 2),
                (0.36, 0.3, 3.0, 0.34, 'bloom_l', 2),
            ])
        with m.part('snow'):
            for t in tips:
                ball((t[0], t[1], t[2] + 0.04), 0.17, 'snow', (1, 1, 0.5))
            ball((0, 0, 1.2), 0.2, 'snow', (1, 1, 0.4))


def tree_pine():
    with Model('tree_pine') as m:
        lathe([(0.3, 0.0), (0.2, 0.08), (0.15, 0.3), (0.12, 0.85)], 'bark', seg=8)
        tiers = [(0.6, 1.08, 1.15, 'pine_d'), (1.28, 0.88, 1.05, 'pine'), (1.92, 0.68, 0.95, 'pine'), (2.52, 0.46, 0.9, 'pine_l')]
        with m.part('canopy'):
            for (z, r, h, mt) in tiers:      # 아랫단이 둥글게 말린 층
                lathe([(0.0, z + 0.06), (r * 0.8, z), (r, z + 0.07), (r * 0.9, z + 0.18), (r * 0.42, z + h * 0.6), (0.0, z + h)], mt, seg=12)
        with m.part('snow'):
            for (z, r, h, mt) in tiers:
                lathe([(r * 0.62, z + h * 0.42), (r * 0.42, z + h * 0.62), (0.0, z + h + 0.02)], 'snow', seg=12, caps=False)


def bigtree():
    with Model('bigtree') as m:
        lathe([(1.05, 0.0), (0.74, 0.14), (0.56, 0.42), (0.5, 1.0), (0.42, 1.9)], 'bark', seg=14)
        for (x, y) in ((0.55, 0.2), (-0.5, 0.3), (0.1, -0.6), (-0.3, -0.45), (0.45, -0.35)):
            tube((x * 0.5, y * 0.5, 0.4), (x * 1.7, y * 1.7, 0.0), 0.2, 'bark', r2=0.07, seg=6)
        tips = [(-1.4, 0.2, 3.0), (1.45, 0.1, 3.0), (0.0, 1.2, 3.3), (0.2, -1.1, 3.0), (0.0, 0.0, 3.9), (-0.9, -0.8, 3.3), (1.0, 0.9, 3.4)]
        for t in tips:
            tube((0, 0, 1.8), (t[0] * 0.6, t[1] * 0.6, t[2] - 0.4), 0.2, 'bark', r2=0.1, seg=6)
        torus((0, 0, 1.05), 0.52, 0.05, 'cream', seg=16, tseg=6)                  # 금줄
        for (x, rl) in ((0.2, 6), (-0.14, -5), (0.0, 0)):
            box((x, -0.52, 0.9), (0.08, 0.03, 0.26 - abs(x) * 0.3), 'cream', rot=(0, rl, 0))
        with m.part('canopy'):
            puffs([
                (-1.45, 0.2, 3.0, 1.15, 'big_d', 3), (1.5, 0.1, 3.0, 1.15, 'big_d', 3), (0.0, 1.25, 3.2, 1.2, 'big_d', 2),
                (0.2, -1.15, 2.95, 1.1, 'big_d', 3), (-0.95, -0.85, 3.4, 1.0, 'big', 3), (1.0, 0.9, 3.5, 1.05, 'big', 2),
                (0.0, 0.0, 3.9, 1.5, 'big', 3), (0.9, -0.7, 3.9, 0.9, 'big', 3),
                (-0.3, -0.2, 4.9, 0.95, 'big_l', 3), (-1.0, 0.3, 4.2, 0.8, 'big_l', 2), (0.7, 0.1, 4.6, 0.7, 'big_l', 2),
                (-1.6, -0.5, 3.5, 0.5, 'big_l', 2), (1.5, -0.6, 3.6, 0.5, 'big_l', 2),
            ])
        with m.part('snow'):
            ball((-0.3, -0.2, 5.5), 0.7, 'snow', (1, 1, 0.4))
            ball((-1.2, 0.3, 4.75), 0.55, 'snow', (1, 1, 0.4))
            ball((0.9, 0.1, 5.05), 0.5, 'snow', (1, 1, 0.4))
            ball((1.5, 0.1, 3.95), 0.6, 'snow', (1, 1, 0.4))


def blade(x, y, a, lean, h, w, mat):
    """풀잎 한 가닥(납작한 잎). a=벌어지는 방향(도), lean=눕는 정도(도)"""
    cone((x, y, 0), w, h, mat, seg=4, rot=(0, lean, a), scale=(0.45, 1, 1))


def grass():
    """땅에 깔리는 풀포기(게임이 수천 개를 한꺼번에 그린다)"""
    with Model('grass_a'):
        for i, (a, ln, h) in enumerate(((0, 40, 0.2), (62, 46, 0.17), (128, 38, 0.21), (190, 48, 0.16), (250, 42, 0.19), (312, 46, 0.17))):
            blade(math.cos(math.radians(a)) * 0.02, math.sin(math.radians(a)) * 0.02, a, ln, h, 0.05, 'tuft' if i % 2 else 'tuft_l')
        blade(0, 0, 0, 6, 0.2, 0.045, 'tuft_l')
    with Model('grass_b'):
        for i, (a, ln, h) in enumerate(((30, 44, 0.14), (150, 40, 0.16), (268, 46, 0.13))):
            blade(math.cos(math.radians(a)) * 0.02, math.sin(math.radians(a)) * 0.02, a, ln, h, 0.045, 'tuft' if i % 2 else 'tuft_l')
        blade(0, 0, 90, 8, 0.13, 0.04, 'tuft_l')
    with Model('grass_f'):               # 작은 들꽃이 섞인 풀
        for i, (a, ln, h) in enumerate(((10, 42, 0.15), (130, 46, 0.14), (250, 42, 0.16))):
            blade(math.cos(math.radians(a)) * 0.02, math.sin(math.radians(a)) * 0.02, a, ln, h, 0.045, 'tuft')
        for (x, y, h) in ((0.08, -0.05, 0.14), (-0.07, 0.06, 0.11), (0.0, -0.11, 0.09)):
            cyl((x, y, 0), 0.008, h, 'tuft', seg=4)
            for k in range(5):
                r = 2 * math.pi * k / 5
                ball((x + math.cos(r) * 0.026, y + math.sin(r) * 0.026, h + 0.005), 0.02, 'tuft_f', (1, 1, 0.5), sub=1)
            ball((x, y, h + 0.012), 0.015, 'petal_c', sub=1)


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
            lump((0, 0, sc[2] * 0.8), 1.0, 'rock', sc, seed=sd, amp=0.2, sub=3, smooth=True)
            lump((0.3, -0.15, 0.12), 1.0, 'rock_d', (0.2, 0.18, 0.15), seed=sd + 2, amp=0.18, smooth=True)
            lump((-0.12, -0.1, sc[2] * 1.25), 1.0, 'rock_l', (sc[0] * 0.55, sc[1] * 0.5, sc[2] * 0.45), seed=sd + 5, amp=0.15, smooth=True)
            with m.part('snow'):
                lump((0, 0, sc[2] * 1.5), 1.0, 'snow', (sc[0] * 0.75, sc[1] * 0.75, 0.08), seed=sd, amp=0.1)
    for i, sd in enumerate((3, 8)):
        with Model('boulder%d' % (i + 1)):
            lump((0, 0, 0.5), 1.0, 'rock', (0.85, 0.75, 0.7), seed=sd, amp=0.22, sub=3, smooth=True)
            lump((0.6, -0.3, 0.25), 1.0, 'rock_d', (0.45, 0.4, 0.35), seed=sd + 1, amp=0.22, smooth=True)
            lump((-0.55, 0.3, 0.3), 1.0, 'rock_l', (0.4, 0.4, 0.4), seed=sd + 4, amp=0.22, smooth=True)
    for v in (1, 2):
        with Model('weed%d' % v):
            n = 5 if v == 1 else 4
            for i in range(n):
                a = 2 * math.pi * i / n + v
                tube((0, 0, 0), (math.cos(a) * 0.16, math.sin(a) * 0.16, 0.22 + 0.06 * (i % 2)), 0.035, 'weed', r2=0.004, seg=5)
            tube((0, 0, 0), (0, 0, 0.32), 0.035, 'weed', r2=0.004, seg=5)
            if v == 2:
                ball((0, 0, 0.33), 0.045, 'petal_c')
    with Model('digspot'):   # 무언가 묻힌 자리: 살짝 솟은 흙과 갈라진 금
        ball((0, 0, 0), 0.24, 'dirt', (1, 1, 0.16), sub=2)
        for a in (35, 125):
            box((0, 0, 0.036), (0.3, 0.05, 0.012), 'dirt_d', rot=(0, 0, a))
        ball((0.12, -0.1, 0.02), 0.035, 'dirt_d', (1, 1, 0.5), sub=1)
    with Model('hole'):
        torus((0, 0, 0.02), 0.3, 0.07, 'dirt', seg=12, tseg=5, scale=(1, 1, 0.6))
        disc((0, 0, 0.01), 0.3, 'dirt_d', seg=12)
    with Model('buried'):   # 무언가 묻힌 자리(덮인 흙)
        ball((0, 0, 0), 0.26, 'dirt', (1, 1, 0.22))


def flower(species):
    with Model('flower_' + species):
        spots = [(-0.2, 0.12, 0.3), (0.2, 0.08, 0.34), (0.0, -0.16, 0.26)]
        for (x, y, h) in spots:
            bx,by=x-.035,y+.026
            tube((bx,by,0),(x-.025,y+.015,h*.51),.014,'stem',r2=.012,seg=7)
            tube((x-.025,y+.015,h*.51),(x,y,h+.02),.012,'stem',r2=.009,seg=7)
            ball((x - 0.07, y, h * 0.45), 0.07, 'stem', (1, 0.45, 0.3), rot=(0, 25, 0))
            ball((x + 0.07, y, h * 0.6), 0.07, 'stem', (1, 0.45, 0.3), rot=(0, -25, 0))
            z = h + 0.03
            if species == 'tulip':
                ball((x, y, z + 0.03), 0.085, 'petal', (0.9, 0.9, 1.2))
                for a in (0, 120, 240):
                    r = math.radians(a)
                    ball((x+math.cos(r)*.048,y+math.sin(r)*.048,z+.061),1,'petal',(.044,.045,.074),rot=(10,14,a),sub=3)
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


def field_wisp():
    with Model('field_wisp'):
        ball((0,0,.38),1,'#b69ab9',(.49,.40,.37),sub=3)
        for s in (-1,1):
            ball((s*.37,.04,.43),1,'#d4bed4',(.22,.22,.24),sub=3)
            ball((s*.21,-.07,.62),1,'#ddd1e6',(.24,.24,.23),sub=3)
            ball((s*.14,-.366,.39),1,'#513e51',(.032,.028,.046),sub=3)
            ball((s*.235,-.315,.32),1,'#eaa6b8',(.053,.025,.028),sub=2)
            ball((s*.21,-.03,.09),1,'#876e96',(.125,.15,.08),sub=3)
        tube((-.045,-.395,.30),(.04,-.395,.30),.012,'#614763',seg=7)

def build():
    field_wisp()
    tree_fruit(); tree_blossom(); tree_pine(); bigtree(); grass(); small_things()
    for sp in ('tulip', 'cosmos', 'pansy', 'mum'):
        flower(sp)
    fruits(); shells()
