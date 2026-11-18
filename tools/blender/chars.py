"""캐릭터 모델 — 전부 이 게임을 위해 새로 만든 오리지널 캐릭터.

부위 이름(게임이 이 이름을 보고 움직인다):
  body(몸통) head(머리) arm_L arm_R(팔) leg_L leg_R(다리) tail(꼬리)
  + 위치 표시: hand(도구를 쥐는 손), top(머리 위 말풍선 자리)
정면은 -Y, 발바닥이 Z=0, 키는 1.3~1.5 정도.
"""
import math
from lib import *

BLACK, WHITE, PINK = '#2a2030', '#ffffff', '#ff9aa8'


class Body:
    """기본 몸: 부위를 만들어 두고 그 안에 도형을 더해 넣는다."""

    def __init__(self, m):
        self.m = m
        self.body = m.part('body', (0, 0, 0.2))
        self.head = m.part('head', (0, 0, 0.64))
        self.armL = m.part('arm_L', (0.27, 0, 0.57))
        self.armR = m.part('arm_R', (-0.27, 0, 0.57))
        self.legL = m.part('leg_L', (0.12, 0, 0.2))
        self.legR = m.part('leg_R', (-0.12, 0, 0.2))
        self.tail = m.part('tail', (0, 0.24, 0.32))
        m.anchor('hand', (-0.37, -0.04, 0.3), 'arm_R')
        m.anchor('top', (0, 0, 1.5))


def base(b, fur, belly=None, feet=None, arm=None, head=(1, 0.95, 0.92), hz=0.95, hr=0.43, body=(1, 0.88, 1.08)):
    feet = feet or fur
    arm = arm or fur
    with b.body:
        ball((0, 0, 0.42), 0.31, fur, body, sub=3)
        if belly:
            ball((0, -0.09, 0.4), 0.24, belly, (0.88, 0.72, 0.98), sub=3)
    with b.head:
        ball((0, 0, hz), hr, fur, head, sub=3)
    for part, s in ((b.armL, 1), (b.armR, -1)):
        with part:
            capsule((s * 0.27, 0, 0.56), (s * 0.36, -0.02, 0.31), 0.078, arm)
    for part, s in ((b.legL, 1), (b.legR, -1)):
        with part:
            tube((s * 0.12, 0, 0.22), (s * 0.12, 0, 0.08), 0.085, fur)
            ball((s * 0.12, -0.03, 0.065), 0.105, feet, (1, 1.3, 0.62))


def face(b, muzzle=None, nose=BLACK, eye_y=0.98, eye_x=0.16, eye_r=0.05, cheeks=True, mz=0.86, msize=0.15, mouth=True, depth=0.385):
    with b.head:
        for s in (1, -1):
            ball((s * eye_x, -depth, eye_y), eye_r, BLACK, (1, 0.5, 1.25))
            ball((s * eye_x - 0.014, -depth - 0.022, eye_y + 0.022), eye_r * 0.34, WHITE)
            if cheeks:
                ball((s * 0.27, -0.31, mz - 0.02), 0.06, PINK, (1, 0.4, 0.7))
        if muzzle:
            ball((0, -0.35, mz), msize, muzzle, (1.12, 0.72, 0.8), sub=3)
            ball((0, -0.35 - msize * 0.66, mz + 0.045), 0.04, nose, (1.25, 0.7, 0.8))
            if mouth:
                ball((0, -0.35 - msize * 0.68, mz - 0.05), 0.022, '#7a4a4a', (1.6, 0.6, 0.7))


def ears_round(b, fur, inner, x=0.3, z=1.3, r=0.13):
    with b.head:
        for s in (1, -1):
            ball((s * x, 0.02, z), r, fur, (1, 0.6, 1))
            ball((s * x, -0.04, z), r * 0.62, inner, (1, 0.5, 1))


def ears_point(b, fur, inner, x=0.26, z=1.22, h=0.3, r=0.13, tip=None):
    with b.head:
        for s in (1, -1):
            cone((s * x, 0.02, z), r, h, fur, seg=8, rot=(0, s * 14, 0), scale=(1, 0.6, 1))
            cone((s * x, -0.035, z + 0.03), r * 0.6, h * 0.66, inner, seg=8, rot=(0, s * 14, 0), scale=(1, 0.5, 1))
            if tip:
                cone((s * (x + 0.045), 0.02, z + h * 0.6), r * 0.42, h * 0.42, tip, seg=8, rot=(0, s * 14, 0), scale=(1, 0.62, 1))


def scarf(b, col, z=0.63):
    with b.body:
        torus((0, 0, z), 0.2, 0.06, col, seg=12, tseg=6, scale=(1.05, 0.95, 0.8))
        box((0.1, -0.2, z - 0.13), (0.11, 0.05, 0.22), col, rot=(8, 0, -8))


# ------------------------------------------------------------------ 주민
def dalgom(name):       # 달곰 — 반달가슴곰
    with Model(name) as m:
        b = Body(m); fur = '#463f52'
        base(b, fur)
        ears_round(b, fur, '#8a7f9a')
        face(b, '#e3c79a', cheeks=False)
        with b.body:  # 가슴의 흰 반달 무늬
            for i in range(7):
                a = math.radians(-60 + i * 20)
                ball((math.sin(a) * 0.17, -0.265 + abs(math.sin(a)) * 0.05, 0.47 - math.cos(a) * 0.06 + 0.07), 0.04, '#fff3d6', (1, 0.5, 1))
        scarf(b, '#f2c230')
        with b.tail:
            ball((0, 0.27, 0.34), 0.08, fur)


def goran(name):        # 고란 — 고라니
    with Model(name) as m:
        b = Body(m); fur = '#cf9a62'
        base(b, fur, belly='#fff0d4')
        with b.head:
            for s in (1, -1):
                ball((s * 0.3, 0.02, 1.4), 0.1, fur, (0.8, 0.5, 2.1), rot=(0, s * 18, 0))
                ball((s * 0.3, -0.03, 1.4), 0.06, '#f7b9b0', (0.8, 0.4, 2.0), rot=(0, s * 18, 0))
                cone((s * 0.06, -0.47, 0.8), 0.018, 0.07, WHITE, seg=5, rot=(180, 0, 0))   # 작은 송곳니
        face(b, '#fff0d4', nose='#4a3028', eye_r=0.058)
        with b.body:
            torus((0, 0, 0.63), 0.2, 0.05, '#6aa5f2', seg=12, tseg=6, scale=(1.05, 0.95, 0.8))
            cone((0, -0.22, 0.62), 0.09, 0.16, '#6aa5f2', seg=4, rot=(180, 0, 0), scale=(1, 0.4, 1))
        with b.tail:
            ball((0, 0.27, 0.36), 0.07, WHITE)


def nureong(name):      # 누렁 — 누렁이
    with Model(name) as m:
        b = Body(m); fur = '#e6b45e'
        base(b, fur, belly='#fff3d8')
        ears_point(b, fur, '#f7d9a8')
        face(b, '#fff3d8', msize=0.16)
        with b.head:
            ball((0, -0.44, 0.78), 0.035, '#f27a8a', (1.1, 0.6, 1.3))           # 혀
            torus((0, 0, 1.2), 0.345, 0.04, '#e8574c', seg=14, tseg=5, scale=(1, 0.95, 1))   # 머리띠
        with b.tail:
            torus((0, 0.36, 0.5), 0.1, 0.05, fur, seg=10, tseg=6, rot=(0, 90, 0))


def beomi(name):        # 범이 — 호랑이
    with Model(name) as m:
        b = Body(m); fur = '#f29b3c'; st = '#3d2a24'
        base(b, fur, belly='#fff3d8')
        ears_round(b, fur, WHITE, r=0.12)
        face(b, '#fff8ea', nose='#e0607a', msize=0.16, cheeks=False)
        with b.head:
            for s in (1, -1):                                                  # 찌푸린 눈썹
                box((s * 0.17, -0.4, 1.08), (0.13, 0.03, 0.035), st, rot=(0, s * 22, 0))
                for k in range(3):                                             # 볼 줄무늬
                    box((s * 0.38, -0.12, 0.84 + k * 0.1), (0.1, 0.16, 0.035), st, rot=(0, 0, s * 20))
            for k in (-1, 0, 1):                                               # 이마 줄무늬
                box((k * 0.09, -0.3, 1.31 - abs(k) * 0.02), (0.045, 0.2, 0.04), st, rot=(35, 0, 0))
        with b.body:
            for s in (1, -1):
                for k in range(2):
                    box((s * 0.27, 0, 0.36 + k * 0.13), (0.08, 0.3, 0.035), st, rot=(0, s * 10, 0))
        with b.tail:
            tube((0, 0.24, 0.32), (0, 0.5, 0.45), 0.05, fur, seg=6)
            tube((0, 0.5, 0.45), (0, 0.56, 0.68), 0.05, fur, seg=6)
            ball((0, 0.56, 0.7), 0.06, st)
            ball((0, 0.5, 0.45), 0.055, st)


def bird_base(b, body, head, wing, beak, feet, hz=0.95, hr=0.38):
    with b.body:
        ball((0, 0, 0.44), 0.33, body, (1, 0.92, 1.05), sub=3)
    with b.head:
        ball((0, 0, hz), hr, head, (1, 0.96, 0.94), sub=3)
    for part, s in ((b.armL, 1), (b.armR, -1)):
        with part:
            ball((s * 0.32, 0.02, 0.44), 0.19, wing, (0.42, 0.9, 1.15), rot=(0, s * -12, 0), sub=3)
    for part, s in ((b.legL, 1), (b.legR, -1)):
        with part:
            tube((s * 0.11, 0, 0.2), (s * 0.11, 0, 0.04), 0.03, feet, seg=6)
            ball((s * 0.11, -0.05, 0.03), 0.08, feet, (1, 1.4, 0.4))


def bird_face(b, beak, eye_x=0.15, eye_z=0.99, depth=0.34, blen=0.16, bw=0.07, bz=0.9, cheeks=False):
    with b.head:
        for s in (1, -1):
            ball((s * eye_x, -depth, eye_z), 0.048, BLACK, (1, 0.5, 1.2))
            ball((s * eye_x - 0.013, -depth - 0.02, eye_z + 0.02), 0.016, WHITE)
            if cheeks:
                ball((s * 0.25, -0.27, bz - 0.02), 0.055, PINK, (1, 0.4, 0.7))
        cone((0, -0.33, bz), bw, blen, beak, seg=6, rot=(90, 0, 0), scale=(1.2, 1, 0.8))


def jangkki(name):      # 장끼 — 꿩
    with Model(name) as m:
        b = Body(m)
        bird_base(b, '#c9722f', '#1f7a5e', '#a85a24', '#f3e2a4', '#e8a83c')
        bird_face(b, '#f3e2a4', blen=0.14)
        with b.head:
            for s in (1, -1):
                ball((s * 0.17, -0.31, 0.97), 0.1, '#e24b3c', (1, 0.5, 1))    # 붉은 눈가
                cone((s * 0.1, 0.1, 1.27), 0.035, 0.16, '#1f7a5e', seg=5, rot=(-20, s * 20, 0))
        with b.body:
            torus((0, 0, 0.7), 0.2, 0.045, WHITE, seg=12, tseg=5, scale=(1.05, 1, 0.7))
            for (x, z) in ((-0.1, 0.5), (0.1, 0.5), (0, 0.38), (-0.14, 0.3), (0.14, 0.3)):
                ball((x, -0.29 + abs(x) * 0.25, z), 0.03, '#6e3a1a', (1, 0.4, 1))
        with b.tail:
            for k, (dx, c) in enumerate(((-0.07, '#d9a05a'), (0.07, '#d9a05a'), (0, '#8a5a2a'))):
                tube((dx * 0.4, 0.24, 0.36), (dx * 1.6, 0.8 + (k == 2) * 0.12, 0.72 + (k == 2) * 0.1), 0.05, c, r2=0.015, seg=6)


def pongdang(name):     # 퐁당 — 개구리
    with Model(name) as m:
        b = Body(m); fur = '#84d15e'
        base(b, fur, belly='#eef8c2', feet='#5fb04a', head=(1.12, 0.95, 0.8), hz=0.9, hr=0.42)
        with b.head:
            for s in (1, -1):
                ball((s * 0.21, -0.08, 1.24), 0.15, fur, sub=3)
                ball((s * 0.21, -0.17, 1.26), 0.105, WHITE, sub=3)
                ball((s * 0.21, -0.255, 1.26), 0.05, BLACK, (1, 0.5, 1.15))
                ball((s * 0.3, -0.34, 0.86), 0.06, PINK, (1, 0.4, 0.7))
            for i in range(9):                                                 # 커다란 웃는 입
                a = math.radians(-64 + i * 16)
                ball((math.sin(a) * 0.3, -0.41 + (1 - math.cos(a)) * 0.2, 0.82 + (1 - math.cos(a)) * 0.07), 0.02, '#2f6a2c')
            for i in range(5):                                                 # 꽃 머리핀
                a = math.radians(i * 72)
                ball((0.36 + math.cos(a) * 0.05, -0.2, 1.02 + math.sin(a) * 0.05), 0.035, '#ff9fc2')
            ball((0.36, -0.22, 1.02), 0.03, '#ffd84a')


def dungdung(name):     # 둥둥 — 청둥오리
    with Model(name) as m:
        b = Body(m)
        bird_base(b, '#d5d9de', '#2f9870', '#b9bec6', '#f5c93a', '#f08a2e')
        with b.body:
            ball((0, -0.1, 0.5), 0.25, '#8f5e3d', (0.95, 0.75, 0.75), sub=3)
            torus((0, 0, 0.7), 0.2, 0.045, WHITE, seg=12, tseg=5, scale=(1.05, 1, 0.7))
        with b.head:
            for s in (1, -1):
                ball((s * 0.15, -0.34, 1.0), 0.048, BLACK, (1, 0.5, 1.2))
                ball((s * 0.15 - 0.013, -0.36, 1.02), 0.016, WHITE)
            ball((0, -0.44, 0.88), 0.14, '#f5c93a', (1.25, 1.0, 0.38), sub=3)   # 납작한 부리
            # 빨간 털모자
            ball((0, 0.02, 1.24), 0.3, '#e8574c', (1, 1, 0.62), sub=3)
            torus((0, 0.02, 1.2), 0.3, 0.05, '#fff3d6', seg=14, tseg=5)
            ball((0, 0.02, 1.46), 0.075, WHITE)
        with b.tail:
            cone((0, 0.26, 0.4), 0.1, 0.18, '#d5d9de', seg=6, rot=(-60, 0, 0))


def sandeul(name):      # 산들 — 염소
    with Model(name) as m:
        b = Body(m); fur = '#dccfb8'
        base(b, fur, belly='#fbf5e6', feet='#5a4a3c')
        with b.head:
            for s in (1, -1):
                ball((s * 0.47, 0.0, 1.0), 0.12, fur, (1.5, 0.5, 0.7), rot=(0, s * 20, 0))        # 옆으로 누운 귀
                tube((s * 0.16, 0.05, 1.3), (s * 0.24, 0.2, 1.5), 0.05, '#8a7a66', r2=0.03, seg=6)  # 뿔
                tube((s * 0.24, 0.2, 1.5), (s * 0.3, 0.36, 1.46), 0.03, '#8a7a66', r2=0.012, seg=6)
            cone((0, -0.36, 0.76), 0.07, 0.18, '#fbf5e6', seg=6, rot=(180, 0, 0), scale=(1, 0.6, 1))  # 수염
        face(b, '#fbf5e6', nose='#c98a8a', cheeks=False)
        with b.head:                                                           # 동그란 안경
            for s in (1, -1):
                torus((s * 0.16, -0.41, 0.98), 0.085, 0.014, '#6a5038', seg=12, tseg=4, rot=(90, 0, 0))
            box((0, -0.42, 0.98), (0.16, 0.014, 0.018), '#6a5038')
        with b.body:                                                           # 초록 숄
            ball((0, 0, 0.56), 0.33, '#6fb86a', (1.05, 0.95, 0.36), sub=3)
            torus((0, 0, 0.52), 0.33, 0.035, '#4f9a52', seg=14, tseg=5, scale=(1.05, 0.95, 1))
        with b.tail:
            ball((0, 0.27, 0.36), 0.06, fur)


def dahong(name):       # 다홍 — 여우
    with Model(name) as m:
        b = Body(m); fur = '#ea6c3c'
        base(b, fur, belly='#fff6ea', feet='#3a2a2a')
        ears_point(b, fur, '#fff3e0', tip='#3a2a2a', h=0.34)
        face(b, '#fff6ea', msize=0.17, cheeks=False)
        with b.head:
            for s in (1, -1):
                ball((s * 0.25, -0.28, 0.85), 0.14, '#fff6ea', (1, 0.6, 0.75), sub=3)     # 흰 볼
                tube((s * 0.2, -0.39, 1.02), (s * 0.27, -0.37, 1.07), 0.012, BLACK, seg=4)   # 속눈썹
        with b.body:                                                           # 보라 리본
            for s in (1, -1):
                cone((s * 0.02, -0.27, 0.62), 0.07, 0.13, '#b07be0', seg=4, rot=(0, s * 90, 0), scale=(1, 0.5, 1))
            ball((0, -0.28, 0.62), 0.035, '#8a56c0')
        with b.tail:
            ball((0, 0.44, 0.48), 0.19, fur, (0.85, 1.2, 1.5), rot=(-35, 0, 0), sub=3)
            ball((0, 0.56, 0.68), 0.11, WHITE, (0.85, 1.0, 1.2), rot=(-35, 0, 0), sub=3)


def kkokki(name):       # 꼬끼 — 수탉
    with Model(name) as m:
        b = Body(m)
        bird_base(b, '#b9552f', '#d98a3c', '#96421f', '#f5c93a', '#f2c230')
        bird_face(b, '#f5c93a', blen=0.13, bw=0.065)
        with b.head:
            for (y, z, r) in ((-0.12, 1.3, 0.085), (0.0, 1.35, 0.1), (0.13, 1.3, 0.085)):  # 볏
                ball((0, y, z), r, '#e8463c', (0.5, 1, 1))
            ball((0, -0.33, 0.78), 0.055, '#e8463c', (0.8, 0.6, 1.3))
        with b.tail:
            for k, (dx, c) in enumerate(((-0.1, '#2f5a4a'), (0.1, '#2f5a4a'), (0, '#24443a'))):
                tube((dx * 0.5, 0.24, 0.4), (dx * 1.2, 0.5, 0.86 + (k == 2) * 0.08), 0.07, c, r2=0.03, seg=6)
                ball((dx * 1.2, 0.56, 0.84 + (k == 2) * 0.08), 0.06, c)


def dodam(name):        # 도담 — 돼지
    with Model(name) as m:
        b = Body(m); fur = '#f8b6bb'
        base(b, fur, belly='#fde0e0', feet='#c97a86')
        with b.head:
            for s in (1, -1):
                cone((s * 0.27, 0.0, 1.2), 0.12, 0.2, '#f09aa8', seg=6, rot=(40, s * 30, 0), scale=(1, 0.5, 1))
            ball((0, -0.4, 0.86), 0.12, '#f28a9a', (1.15, 0.6, 0.85), sub=3)
            for s in (1, -1):
                ball((s * 0.045, -0.47, 0.87), 0.022, '#b0566a', (1, 0.5, 1.3))
        face(b, None, eye_y=1.0)
        with b.body:                                                           # 요리사 두건
            torus((0, 0, 0.64), 0.2, 0.05, WHITE, seg=12, tseg=6, scale=(1.05, 0.95, 0.8))
            cone((0, -0.22, 0.63), 0.1, 0.17, WHITE, seg=4, rot=(180, 0, 0), scale=(1, 0.4, 1))
        with b.tail:
            torus((0, 0.3, 0.38), 0.05, 0.02, '#f09aa8', seg=8, tseg=4, rot=(0, 90, 0))


def pogeun(name):       # 포근 — 얼굴이 검은 양
    with Model(name) as m:
        b = Body(m); wool = '#f3ecd9'; skin = '#4d423e'
        with b.body:
            ball((0, 0, 0.42), 0.3, wool, (1, 0.9, 1.05), sub=3)
            for i in range(8):
                a = math.radians(i * 45)
                ball((math.cos(a) * 0.24, math.sin(a) * 0.2, 0.36 + (i % 2) * 0.12), 0.14, wool)
        with b.head:
            ball((0, 0, 0.94), 0.38, skin, (1, 0.95, 0.94), sub=3)
            for (x, y, z, r) in ((0, 0.05, 1.27, 0.2), (-0.2, 0.05, 1.2, 0.16), (0.2, 0.05, 1.2, 0.16), (0, -0.16, 1.26, 0.14), (-0.3, 0.1, 1.05, 0.13),
                                 (0.3, 0.1, 1.05, 0.13), (0, 0.26, 1.1, 0.2)):
                ball((x, y, z), r, wool)
            for s in (1, -1):
                ball((s * 0.42, 0.0, 0.98), 0.1, skin, (1.4, 0.5, 0.7), rot=(0, s * 25, 0))
                ball((s * 0.15, -0.34, 0.97), 0.06, WHITE, (1, 0.5, 1.2))
                ball((s * 0.15, -0.37, 0.96), 0.03, BLACK, (1, 0.5, 1.3))
            ball((0, -0.36, 0.84), 0.03, '#f28a9a', (1.3, 0.6, 0.8))
            for s in (1, -1):                                                  # 분홍 리본
                cone((0.22 + s * 0.01, -0.2, 1.3), 0.06, 0.1, '#ff8fb8', seg=4, rot=(0, s * 90, 0), scale=(1, 0.5, 1))
            ball((0.22, -0.21, 1.3), 0.03, '#e0609a')
        for part, s in ((b.armL, 1), (b.armR, -1)):
            with part:
                capsule((s * 0.27, 0, 0.56), (s * 0.36, -0.02, 0.31), 0.07, skin)
        for part, s in ((b.legL, 1), (b.legR, -1)):
            with part:
                tube((s * 0.12, 0, 0.22), (s * 0.12, 0, 0.08), 0.08, skin)
                ball((s * 0.12, -0.03, 0.065), 0.1, skin, (1, 1.3, 0.62))
        with b.tail:
            ball((0, 0.28, 0.36), 0.1, wool)


# ------------------------------------------------------------------ 시설 담당
def kkami(name):        # 까미 — 까치 (만물상)
    with Model(name) as m:
        b = Body(m)
        bird_base(b, '#f5f5f0', '#2e2e3c', '#3f6fd6', '#4a4a58', '#4a4a58')
        with b.head:
            for s in (1, -1):
                ball((s * 0.15, -0.34, 0.99), 0.055, WHITE, (1, 0.5, 1.2))
                ball((s * 0.15, -0.365, 0.985), 0.028, BLACK, (1, 0.5, 1.2))
            cone((0, -0.33, 0.9), 0.07, 0.17, '#4a4a58', seg=6, rot=(90, 0, 0), scale=(1.1, 1, 0.8))
        with b.body:                                                           # 주황 앞치마
            ball((0, -0.06, 0.4), 0.3, '#f29a3c', (0.9, 0.82, 0.95), sub=3)
            box((0, -0.3, 0.42), (0.22, 0.03, 0.14), '#ffc777')
            torus((0, 0, 0.66), 0.2, 0.03, '#f29a3c', seg=12, tseg=4, scale=(1.05, 1, 0.7))
        with b.tail:
            tube((0, 0.24, 0.38), (0, 0.78, 0.66), 0.06, '#3f6fd6', r2=0.02, seg=6)


def duru(name):         # 두루 — 두루미 (박물관)
    with Model(name) as m:
        b = Body(m)
        with b.body:
            ball((0, 0.02, 0.62), 0.3, '#f7f7f2', (0.95, 1.05, 0.9), sub=3)
            tube((0, -0.02, 0.8), (0, -0.04, 1.08), 0.075, '#2e2e3c', seg=8)                 # 검은 목
        with b.head:
            ball((0, -0.04, 1.22), 0.25, '#f7f7f2', sub=3)
            ball((0, -0.04, 1.4), 0.12, '#e8463c', (1, 1, 0.5))                              # 붉은 정수리
            ball((0, -0.18, 1.14), 0.14, '#2e2e3c', (1.1, 0.6, 0.9))
            cone((0, -0.24, 1.18), 0.045, 0.3, '#8a8a7a', seg=6, rot=(96, 0, 0))             # 긴 부리
            for s in (1, -1):
                ball((s * 0.1, -0.245, 1.27), 0.03, BLACK, (1, 0.5, 1.2))
                torus((s * 0.1, -0.265, 1.27), 0.06, 0.011, '#c9a23a', seg=12, tseg=4, rot=(90, 0, 0))
            box((0, -0.27, 1.27), (0.09, 0.012, 0.014), '#c9a23a')
            cyl((0, -0.04, 1.44), 0.34, 0.02, '#24242e', seg=14)                             # 갓
            cyl((0, -0.04, 1.45), 0.15, 0.16, '#34343e', r2=0.13, seg=10)
        for part, s in ((b.armL, 1), (b.armR, -1)):
            with part:
                ball((s * 0.29, 0.04, 0.62), 0.2, '#ececdf', (0.38, 1.0, 1.0), rot=(0, s * -10, 0), sub=3)
                ball((s * 0.3, 0.2, 0.52), 0.1, '#2e2e3c', (0.4, 1.2, 0.8))
        for part, s in ((b.legL, 1), (b.legR, -1)):
            with part:
                tube((s * 0.09, 0, 0.4), (s * 0.09, 0, 0.03), 0.022, '#5a5a66', seg=6)
                ball((s * 0.09, -0.05, 0.025), 0.07, '#5a5a66', (1, 1.5, 0.35))
        with b.tail:
            ball((0, 0.3, 0.6), 0.14, '#2e2e3c', (0.9, 1.2, 0.8))


def ujik(name):         # 우직 — 황소 (이장)
    with Model(name) as m:
        b = Body(m); fur = '#bd7c42'
        base(b, fur, feet='#4a3426')
        with b.head:
            for s in (1, -1):
                ball((s * 0.46, 0.0, 1.02), 0.11, fur, (1.4, 0.5, 0.7), rot=(0, s * 20, 0))
                tube((s * 0.3, 0.02, 1.2), (s * 0.44, 0.02, 1.34), 0.05, '#f3ead0', r2=0.015, seg=6)
            ball((0, -0.36, 0.84), 0.19, '#f3dcc0', (1.15, 0.7, 0.8), sub=3)
            for s in (1, -1):
                ball((s * 0.07, -0.49, 0.87), 0.025, '#8a5a4a', (1, 0.5, 1.3))
            torus((0, -0.49, 0.78), 0.045, 0.014, '#e8b83c', seg=10, tseg=4, rot=(90, 0, 0))   # 코뚜레
            cyl((0, 0, 1.26), 0.58, 0.03, '#ecd48a', seg=16)                                   # 밀짚모자
            ball((0, 0, 1.29), 0.3, '#f5e2a0', (1, 1, 0.7), sub=3)
            torus((0, 0, 1.31), 0.285, 0.03, '#c9584a', seg=14, tseg=4)
        face(b, None, eye_y=1.0, cheeks=False)
        with b.body:                                                           # 파란 조끼
            for s in (1, -1):
                ball((s * 0.15, -0.03, 0.44), 0.26, '#4a82d6', (0.62, 0.95, 1.02), sub=3)
        with b.tail:
            tube((0, 0.24, 0.36), (0, 0.42, 0.2), 0.025, fur, seg=5)
            ball((0, 0.43, 0.18), 0.05, '#4a3426')


# ------------------------------------------------------------------ 주인공(사람 아이)
def kid(name, hair, shirt, pants, style):
    skin = '#ffdcbc'
    with Model(name) as m:
        b = Body(m)
        with b.body:
            cyl((0, 0, 0.2), 0.27, 0.42, shirt, r2=0.2, seg=12)
            ball((0, 0, 0.62), 0.2, shirt, (1, 0.9, 0.5), sub=2)
            cyl((0, 0, 0.17), 0.275, 0.1, pants, r2=0.27, seg=12)
        with b.head:
            ball((0, 0, 0.98), 0.42, skin, (1, 0.94, 0.94), sub=3)
            ball((0, 0.06, 1.06), 0.44, hair, (1.02, 0.98, 0.9), sub=3)                      # 머리카락
            for i in range(7):                                                               # 앞머리
                x = -0.27 + i * 0.09
                ball((x, -0.33 + abs(x) * 0.25, 1.19 - (0.03 if i % 2 else 0)), 0.085, hair, (1, 0.7, 1.15))
            for s in (1, -1):
                ball((s * 0.15, -0.375, 0.97), 0.05, BLACK, (1, 0.5, 1.3))
                ball((s * 0.135, -0.4, 0.995), 0.017, WHITE)
                ball((s * 0.26, -0.31, 0.85), 0.06, PINK, (1, 0.4, 0.7))
            ball((0, -0.4, 0.82), 0.028, '#d97a6a', (1.5, 0.6, 0.7))
            if style == 'pony':
                ball((0, 0.44, 1.1), 0.16, hair, (0.9, 1, 1.4), rot=(-30, 0, 0))
                torus((0, 0.38, 1.2), 0.07, 0.03, '#ff8fb8', seg=8, tseg=4, rot=(60, 0, 0))
            elif style == 'twin':
                for s in (1, -1):
                    ball((s * 0.44, 0.08, 0.86), 0.13, hair, (0.9, 0.9, 1.5))
                    ball((s * 0.4, 0.08, 1.05), 0.04, '#ffd84a')
            elif style == 'spiky':
                for (x, y) in ((-0.2, 0), (0, -0.08), (0.2, 0), (-0.1, 0.18), (0.1, 0.18)):
                    cone((x, y, 1.36), 0.1, 0.2, hair, seg=5, rot=(-10, x * 60, 0))
            elif style == 'bob':
                for s in (1, -1):
                    ball((s * 0.36, 0.04, 0.84), 0.15, hair, (0.7, 1.1, 1.3))
            elif style == 'cap':
                ball((0, 0.02, 1.2), 0.43, '#4a90d9', (1, 1, 0.62), sub=3)
                box((0, -0.38, 1.14), (0.42, 0.26, 0.04), '#4a90d9', rot=(-8, 0, 0))
        for part, s in ((b.armL, 1), (b.armR, -1)):
            with part:
                tube((s * 0.25, 0, 0.57), (s * 0.34, -0.02, 0.4), 0.075, shirt, seg=8)
                ball((s * 0.25, 0, 0.57), 0.075, shirt)
                ball((s * 0.36, -0.02, 0.33), 0.07, skin)
        for part, s in ((b.legL, 1), (b.legR, -1)):
            with part:
                tube((s * 0.12, 0, 0.22), (s * 0.12, 0, 0.09), 0.08, skin)
                ball((s * 0.12, -0.04, 0.065), 0.1, '#7a4a3a', (1, 1.35, 0.62))


VILLAGERS = {'dalgom': dalgom, 'goran': goran, 'nureong': nureong, 'beomi': beomi, 'jangkki': jangkki, 'pongdang': pongdang,
             'dungdung': dungdung, 'sandeul': sandeul, 'dahong': dahong, 'kkokki': kkokki, 'dodam': dodam, 'pogeun': pogeun}
NPCS = {'kkami': kkami, 'duru': duru, 'ujik': ujik}

ALL = {}
for _k, _f in VILLAGERS.items():
    ALL['villager_' + _k] = _f
for _k, _f in NPCS.items():
    ALL['npc_' + _k] = _f
ALL['player_1'] = lambda n: kid(n, '#5a3a2a', '#e8574c', '#4a6ab0', 'bob')
ALL['player_2'] = lambda n: kid(n, '#2e2a36', '#4a90d9', '#5a4a3a', 'spiky')
ALL['player_3'] = lambda n: kid(n, '#a8622e', '#ffd84a', '#5fae62', 'pony')
ALL['player_4'] = lambda n: kid(n, '#3a2a22', '#6fb86a', '#8a5a3a', 'cap')
