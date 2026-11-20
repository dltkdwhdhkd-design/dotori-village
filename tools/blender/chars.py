"""캐릭터 모델 — 꾸미는 사람 주인공과 치이카와 마을 배역.

머리가 크고 몸이 작은 인형 체형에 옷을 입힌다. 모든 캐릭터가 같은 뼈대(Char)를 쓴다.

부위 이름(게임이 이 이름을 보고 움직인다):
  body(몸통) head(머리) arm_L arm_R(팔) leg_L leg_R(다리) tail(꼬리)
  eyes(눈 — 깜박임)  mouth(다문 입)  mouth_open(말할 때 입)   ← 머리에 딸린 부위
  + 위치 표시: hand(도구를 쥐는 손), top(머리 위 말풍선 자리)
정면은 -Y, 발바닥이 Z=0, 키는 귀를 빼고 1.4 정도.
"""
import math
from lib import *
from chiikawa import RESIDENT_MODELS

INK = '#3b2b28'        # 눈·입 선
WHITE = '#ffffff'
BLUSH = '#ff9ca4'
EYE = 1.26               # 눈 크기 배율(모든 캐릭터)
BODY_K = 0.87            # 몸(목 아래) 크기 배율 — 작을수록 머리가 커 보인다
HEAD_K = 1.08            # 머리 크기 배율
CHEEK = 0.13             # 볼살: 머리 아래쪽을 옆으로 넓히는 정도
MOUTH_IN = '#8a3040'
TONGUE = '#f58a96'

# ---- 공통 치수
HIP = 0.28                       # 다리 축 높이
BODY0 = 0.25                     # 몸통 아래
NECK = 0.69                      # 머리 축 높이
HC = 1.035                       # 머리 중심 높이
HR = (0.41, 0.385, 0.345)        # 머리 반지름 (x, y, z)
SHX, SHZ = 0.2, 0.63             # 어깨
HAND = (0.33, -0.03, 0.34)       # 왼손(+x) 위치. 오른손은 x만 뒤집는다
LEGX = 0.105

SHIRT = [(0.0, 0.25), (0.15, 0.255), (0.222, 0.3), (0.236, 0.37), (0.222, 0.47), (0.195, 0.57), (0.16, 0.65), (0.11, 0.7), (0.0, 0.715)]
DRESS = [(0.0, 0.27), (0.2, 0.275), (0.285, 0.3), (0.292, 0.335), (0.25, 0.43), (0.205, 0.55), (0.163, 0.65), (0.11, 0.7), (0.0, 0.715)]
BODY_Y = 0.88                    # 몸통 앞뒤 납작한 정도


def interp(prof, z):
    """몸통 윤곽에서 높이 z의 반지름"""
    for (r0, z0), (r1, z1) in zip(prof[:-1], prof[1:]):
        if z0 <= z <= z1:
            t = 0 if z1 == z0 else (z - z0) / (z1 - z0)
            return r0 + (r1 - r0) * t
    return prof[0][0] if z < prof[0][1] else prof[-1][0]


class Char:
    """캐릭터 한 명의 뼈대. 부위를 만들어 두고, 아래 함수들로 살을 붙인다."""

    def __init__(self, m, hr=HR, hc=HC, neck=NECK):
        self.m = m
        self.hr, self.hc = hr, hc
        self.body = m.part('body', (0, 0, BODY0))
        self.head = m.part('head', (0, 0, neck))
        self.armL = m.part('arm_L', (SHX, 0, SHZ))
        self.armR = m.part('arm_R', (-SHX, 0, SHZ))
        self.legL = m.part('leg_L', (LEGX, 0, HIP))
        self.legR = m.part('leg_R', (-LEGX, 0, HIP))
        self._tail = None
        self.prof = SHIRT
        self.cheeks = CHEEK
        self.surfs = [(0, 0, hc, hr[0], hr[1], hr[2])]
        self.top = hc + hr[2]
        m.anchor('hand', (-HAND[0], HAND[1] - 0.02, HAND[2]), 'arm_R')

    def done(self, extra=0.0):
        """마무리: 몸을 줄이고 머리를 키워 비율을 맞춘 뒤, 말풍선 자리를 표시한다."""
        m = self.m
        neck = self.head.pivot.copy()
        new_neck = neck * BODY_K
        for p in m.parts:
            if p is self.head or p.parent == 'head':
                for v in p.bm.verts:
                    v.co = new_neck + (v.co - neck) * HEAD_K
                p.pivot = new_neck + (p.pivot - neck) * HEAD_K
            else:
                for v in p.bm.verts:
                    v.co = v.co * BODY_K
                p.pivot = p.pivot * BODY_K
        m.anchors = [(nm, loc * BODY_K, par) for (nm, loc, par) in m.anchors]
        top = new_neck.z + (self.top - neck.z) * HEAD_K
        m.anchor('top', (0, 0, top + 0.08 + extra))

    @property
    def tail(self):
        if self._tail is None:
            self._tail = self.m.part('tail', (0, 0.17, 0.36))
        return self._tail

    # ------------------------------------------------------------ 머리 표면
    def hp(self, x, z, out=0.0):
        """얼굴 앞면의 (x, z) 자리 점과, 그 면에 물건을 붙일 때의 회전(도)"""
        best = None
        for k, (cx, cy, cz, rx, ry, rz) in enumerate(self.surfs):
            if k == 0:
                rx = rx * self.cheek(z)
            q = 1 - ((x - cx) / rx) ** 2 - ((z - cz) / rz) ** 2
            if q <= 0:
                continue
            y = cy - ry * math.sqrt(q)
            if best is None or y < best[0]:
                n = Vector(((x - cx) / rx ** 2, (y - cy) / ry ** 2, (z - cz) / rz ** 2)).normalized()
                best = (y, n)
        if best is None:
            best = (0.0, Vector((1 if x > 0 else -1, 0, 0)))
        y, n = best
        p = Vector((x, y, z)) + n * out
        rot = (-math.degrees(math.asin(max(-1, min(1, n.z)))), 0, math.degrees(math.atan2(n.x, -n.y)))
        return p, rot

    def dot(self, x, z, mat, w, h, thick=0.012, out=0.0, roll=0):
        """얼굴에 붙이는 납작한 타원(눈, 볼, 무늬). w·h는 반지름."""
        p, rot = self.hp(x, z, out)
        ball(tuple(p), 1.0, mat, (w, thick, h), rot=(rot[0], roll, rot[2]), sub=3 if max(w, h) > 0.03 else 2)

    def bump(self, c, r):
        """얼굴에 볼록한 면을 하나 더한다(주둥이 등). 그 뒤 눈·입은 이 면 위에도 붙는다."""
        self.surfs.append((c[0], c[1], c[2], r[0], r[1], r[2]))

    # ------------------------------------------------------------ 몸
    def cheek(self, z):
        """높이 z에서 머리를 옆으로 넓히는 배율(아래쪽 볼이 통통하게)"""
        t = (z - self.hc) / self.hr[2]
        k = max(0.0, min(1.0, (0.25 - t) / 0.75))
        return 1.0 + self.cheeks * k * k * (3 - 2 * k) * (1.0 if t > -0.75 else max(0.0, (1 + t) / 0.25))

    def fit(self, faces):
        """머리에 꼭 맞게 만든 조각(머리통, 머리카락, 털 무늬)에 볼살을 똑같이 넣는다"""
        vs = set()
        for f in faces:
            for v in f.verts:
                vs.add(v)
        for v in vs:
            v.co.x *= self.cheek(v.co.z)

    def skull(self, col, sub=3):
        with self.head:
            self.fit(ball((0, 0, self.hc), 1.0, col, self.hr, sub=sub))

    def torso(self, top, bottom=None, kind='shirt', hem=None, collar=None, w=1.0):
        """옷 입은 몸통. kind: shirt(윗옷+바지) / dress(원피스). hem=밑단 색, collar=깃 색"""
        self.prof = [(r * w, z) for r, z in (DRESS if kind == 'dress' else SHIRT)]
        with self.body:
            if kind == 'dress':
                lathe(self.prof, top, seg=20, scale=(1, BODY_Y))
                if hem:
                    self.band(0.3, 0.345, hem, 0.007)
            else:
                lathe(self.prof, bottom or top, seg=20, scale=(1, BODY_Y))
                if bottom and bottom != top:
                    zs = [0.36, 0.385, 0.47, 0.57, 0.65, 0.7, 0.715]
                    es = [0.022, 0.012, 0.008, 0.008, 0.008, 0.006, 0.0]
                    lathe([(interp(self.prof, z) + e if z < 0.71 else 0.0, z + (0.004 if z > 0.71 else 0)) for z, e in zip(zs, es)], top, seg=20, scale=(1, BODY_Y), caps=False)
                    if hem:
                        self.band(0.358, 0.39, hem, 0.024, 0.014)
            if collar:
                torus((0, 0, 0.695), 0.118, 0.03, collar, seg=16, tseg=6, scale=(1, BODY_Y, 0.8))

    def band(self, z0, z1, mat, e0=0.007, e1=None, n=3):
        """몸통을 두르는 띠(줄무늬, 허리띠, 밑단)"""
        e1 = e0 if e1 is None else e1
        prof = []
        for i in range(n + 1):
            t = i / n
            z = z0 + (z1 - z0) * t
            prof.append((interp(self.prof, z) + e0 + (e1 - e0) * t, z))
        lathe(prof, mat, seg=20, scale=(1, BODY_Y), caps=False)

    def front(self, z, out=0.0, x=0.0):
        """몸통 앞면의 점(단추, 무늬 붙일 자리)"""
        r = interp(self.prof, z)
        y = -BODY_Y * math.sqrt(max(0.0, r * r - x * x)) - out
        return (x, y, z)

    def fdot(self, x, z, col, w, h, out=0.006, thick=0.4, roll=0):
        """몸통 앞면에 붙는 납작한 타원(무늬용). 면의 방향에 맞춰 돌려 붙인다."""
        r = interp(self.prof, z)
        y = -BODY_Y * math.sqrt(max(0.0, r * r - x * x))
        yaw = math.degrees(math.atan2(x / (r * r), -y / ((r * BODY_Y) ** 2)))
        ball((x, y - out, z), 1.0, col, (w, min(w, h) * thick, h), rot=(0, roll, yaw), sub=2)

    def buttons(self, col, zs=(0.6, 0.52, 0.44), r=0.017):
        with self.body:
            for z in zs:
                ball(self.front(z, 0.006), r, col, (1, 0.6, 1), sub=1)

    def emblem(self, kind, col, z=0.52, s=1.0, col2=None, x=0.0):
        """가슴 무늬: acorn(도토리) moon(반달) star leaf heart flower dot"""
        with self.body:
            if kind == 'acorn':
                self.fdot(x, z - 0.012 * s, col, 0.036 * s, 0.042 * s, 0.008)
                self.fdot(x, z + 0.022 * s, col2 or '#8a5a34', 0.041 * s, 0.025 * s, 0.012)
                self.fdot(x, z + 0.05 * s, col2 or '#8a5a34', 0.008 * s, 0.014 * s, 0.01, thick=0.8)
            elif kind == 'moon':
                n = 11
                for i in range(n):
                    t = i / (n - 1)
                    a = math.radians(205 + 130 * t)
                    k = math.sin(math.pi * t) ** 0.6
                    self.fdot(x + math.cos(a) * 0.092 * s, z + 0.05 * s + math.sin(a) * 0.092 * s, col, 0.03 * s * max(0.25, k), 0.03 * s * max(0.25, k), 0.008)
            elif kind == 'star':
                cx, y, cz = self.front(z, 0.014, x)
                for i in range(5):
                    a = math.radians(90 + i * 72)
                    tube((cx, y, cz), (cx + math.cos(a) * 0.052 * s, y + 0.004, cz + math.sin(a) * 0.052 * s), 0.021 * s, col, r2=0.004, seg=5)
            elif kind == 'heart':
                for sx in (1, -1):
                    self.fdot(x + sx * 0.02 * s, z + 0.012 * s, col, 0.028 * s, 0.028 * s, 0.01)
                self.fdot(x, z - 0.012 * s, col, 0.03 * s, 0.03 * s, 0.01, roll=45, thick=0.3)
            elif kind == 'leaf':
                self.fdot(x, z, col, 0.028 * s, 0.05 * s, 0.01, roll=30)
            elif kind == 'flower':
                for i in range(5):
                    a = math.radians(90 + i * 72)
                    self.fdot(x + math.cos(a) * 0.028 * s, z + math.sin(a) * 0.028 * s, col, 0.02 * s, 0.02 * s, 0.01)
                self.fdot(x, z, col2 or '#ffd84a', 0.015 * s, 0.015 * s, 0.016)
            else:
                self.fdot(x, z, col, 0.03 * s, 0.03 * s, 0.008)

    def dots(self, col, r=0.022, rows=((0.33, 7, 0.0), (0.43, 6, 0.5), (0.53, 5, 0.0))):
        """물방울무늬"""
        with self.body:
            for z, n, off in rows:
                rr = interp(self.prof, z) + 0.006
                for i in range(n):
                    a = 2 * math.pi * (i + off) / n
                    ball((rr * math.cos(a), rr * BODY_Y * math.sin(a), z), r, col, (1, 1, 1), sub=1)

    def arms(self, sleeve, skin, hand=None, sl=0.5, r=0.06):
        """팔. sleeve=소매 색, sl=소매가 덮는 비율(0~1). 손은 둥근 벙어리장갑 모양"""
        for part, s in ((self.armL, 1), (self.armR, -1)):
            with part:
                a = Vector((s * SHX, 0, SHZ))
                b = Vector((s * HAND[0], HAND[1], HAND[2]))
                mid = a.lerp(b, sl)
                if sl > 0.02:
                    ball(a, r + 0.016, sleeve, sub=2)
                    tube(a, mid, r + 0.014, sleeve, r2=r + 0.024, seg=10)
                else:
                    ball(a, r + 0.004, skin, sub=2)
                if sl < 0.95:
                    tube(a.lerp(b, max(0.0, sl - 0.05)), b, r, skin, r2=r - 0.004, seg=10)
                ball(b, r + 0.02, hand or skin, (1, 1, 1.05), sub=2)

    def wings(self, col, tip=None, sleeve=None, sl=0.35):
        """새의 날개(팔 자리)"""
        for part, s in ((self.armL, 1), (self.armR, -1)):
            with part:
                a = Vector((s * SHX, 0, SHZ))
                b = Vector((s * HAND[0], HAND[1], HAND[2]))
                mid = a.lerp(b, 0.55)
                ball(mid, 1.0, col, (0.068, 0.115, 0.2), rot=(0, s * 23, 0), sub=2)
                ball(b + Vector((0, 0.02, 0.01)), 1.0, tip or col, (0.05, 0.085, 0.085), rot=(0, s * 23, 0), sub=2)
                if sleeve:
                    ball(a, 0.082, sleeve, sub=2)
                    tube(a, a.lerp(b, sl), 0.078, sleeve, r2=0.09, seg=10)

    def legs(self, pants, shoe, r=0.078, sock=None):
        for part, s in ((self.legL, 1), (self.legR, -1)):
            with part:
                x = s * LEGX
                tube((x, 0, HIP + 0.03), (x, 0, 0.08), r, pants, r2=r * 0.94, seg=10)
                if sock:
                    tube((x, 0, 0.15), (x, 0, 0.08), r * 0.97, sock, seg=10)
                ball((x, -0.032, 0.066), 1.0, shoe, (0.094, 0.128, 0.066), sub=2)

    def birdlegs(self, col='#f2a03c', pants=None):
        for part, s in ((self.legL, 1), (self.legR, -1)):
            with part:
                x = s * LEGX
                if pants:
                    tube((x, 0, HIP + 0.03), (x, 0, 0.17), 0.078, pants, r2=0.07, seg=10)
                tube((x, 0, 0.2), (x, 0, 0.03), 0.03, col, seg=6)
                for a in (-28, 0, 28):
                    tube((x, 0, 0.028), (x + math.sin(math.radians(a)) * 0.1, -math.cos(math.radians(a)) * 0.11, 0.022), 0.026, col, r2=0.018, seg=5)
                    ball((x + math.sin(math.radians(a)) * 0.1, -math.cos(math.radians(a)) * 0.11, 0.022), 0.019, col, sub=1)

    # ------------------------------------------------------------ 얼굴
    def eyes(self, style='oval', x=0.15, z=None, size=1.0, col=INK, white=False, lid=None, iris=None, name='eyes'):
        """눈. style: oval(기본) big(동그랗고 큼) dot(점) pop(흰자에 작은 눈동자) sleepy(졸린) half(반쯤 감은) smile(웃는) lash(속눈썹)
        white=True면 흰자를 깐다. iris=홍채 색(얼굴이 어두운 캐릭터는 밝은 홍채를 준다).
        lid=눈꺼풀 색(sleepy에서 얼굴색을 준다)"""
        z = self.hc - 0.05 if z is None else z - 0.012
        size *= EYE
        x *= 1.05
        pc, _ = self.hp(0, z)
        P = self.m.part(name, (0, pc.y, z), parent='head')
        w, h = 0.05 * size, 0.07 * size
        if style == 'big':
            w = h = 0.066 * size
        elif style == 'dot':
            w = h = 0.036 * size
        elif style == 'pop':
            w = h = 0.027 * size
        with P:
            for s in (1, -1):
                ex = s * x
                if style == 'smile':
                    p, rot = self.hp(ex, z - 0.02 * size, 0.004)
                    arc(tuple(p), w * 1.05, 0.014 * size, col, 18, 162, seg=8, tseg=5, rot=(90 + rot[0], 0, rot[2]))
                    continue
                if style == 'half':
                    self.dot(ex, z - h * 0.2, col, w * 1.02, h * 0.6, thick=0.016, out=0.004)
                    self.dot(ex, z + h * 0.2, col, w * 1.42, 0.012 * size, thick=0.012, out=0.008)
                    self.dot(ex - 0.014 * size, z - h * 0.06, WHITE, 0.014 * size, 0.014 * size, thick=0.008, out=0.017)
                    continue
                if style == 'pop':
                    self.dot(ex, z, WHITE, 0.058 * size, 0.062 * size, thick=0.012)
                if white:
                    self.dot(ex, z, WHITE, w * 1.22, h * 1.16, thick=0.012)
                if iris:
                    self.dot(ex, z, iris, w * 1.12, h * 1.1, thick=0.014, out=0.002)
                    self.dot(ex, z - h * 0.04, col, w * 0.7, h * 0.74, thick=0.014, out=0.008)
                else:
                    self.dot(ex, z, col, w, h, thick=0.016, out=0.004)
                k = 0.7 if style == 'dot' else 0.5 if style == 'pop' else 1.0
                self.dot(ex - 0.016 * size * k, z + 0.024 * size * k, WHITE, 0.018 * size * k, 0.021 * size * k, thick=0.008, out=0.017)
                if style != 'dot' and style != 'pop':
                    self.dot(ex + 0.014 * size, z - 0.028 * size, WHITE, 0.008 * size, 0.008 * size, thick=0.006, out=0.017)
                if style == 'sleepy':
                    self.dot(ex, z + h * 0.72, lid or WHITE, w * 1.5, h * 0.66, thick=0.02, out=0.008)
                    self.dot(ex, z + h * 0.12, col, w * 1.3, 0.011 * size, thick=0.012, out=0.02)
                if style == 'lash':
                    self.dot(ex, z + h * 0.82, col, w * 1.25, 0.013 * size, thick=0.012, out=0.014, roll=-s * 10)
                    for i, (dx, dz, rl) in enumerate(((1.25, 0.95, 50), (1.5, 0.55, 72))):
                        self.dot(ex + s * w * dx, z + h * dz, col, 0.022 * size, 0.008 * size, thick=0.008, out=0.012, roll=-s * rl)

    def brows(self, col=INK, x=0.15, z=None, w=0.046, th=0.012, tilt=0):
        """눈썹. tilt>0이면 안쪽이 올라간 순한 눈썹, tilt<0이면 안쪽이 내려간 매서운 눈썹"""
        z = self.hc + 0.085 if z is None else z - 0.012
        x *= 1.05
        with self.head:
            for s in (1, -1):
                self.dot(s * x, z, col, w * 1.15, th * 1.15, thick=0.012, out=0.004, roll=s * tilt)

    def blush(self, x=0.275, z=None, col=BLUSH, r=0.056):
        z = self.hc - 0.12 if z is None else z
        with self.head:
            for s in (1, -1):
                self.dot(s * x, z, col, r * 1.15, r * 0.72, thick=0.008, out=0.0)

    def mouth(self, style='smile', z=None, w=0.05, col=INK, name='mouth', open_part=True):
        """입. style: smile(미소) cat(ω) flat(一) o(작은 동그라미) wide(넓은 미소)"""
        z = self.hc - 0.14 if z is None else z
        p, rot = self.hp(0, z, 0.004)
        P = self.m.part(name, tuple(p), parent='head')
        with P:
            if style == 'smile' or style == 'wide':
                R = w * (2.6 if style == 'wide' else 1.25)
                a = 22 if style == 'wide' else 40
                arc((p.x, p.y, p.z + R), R, 0.0135, col, 270 - a, 270 + a, seg=8, tseg=5, rot=(90, 0, 0))
            elif style == 'cat':
                for s in (1, -1):
                    arc((s * w * 0.5, p.y, p.z + w * 0.16), w * 0.5, 0.0125, col, 200, 340, seg=7, tseg=5, rot=(90, 0, 0))
            elif style == 'flat':
                self.dot(0, z, col, w * 0.8, 0.0115, thick=0.01, out=0.004)
            elif style == 'o':
                self.dot(0, z, col, w * 0.36, w * 0.42, thick=0.01, out=0.004)
        if not open_part:
            return
        O = self.m.part('mouth_open', tuple(p), parent='head')
        with O:
            self.dot(0, z - 0.004, MOUTH_IN, w * 0.78, w * 0.62, thick=0.011, out=0.005)
            self.dot(0, z - 0.03, TONGUE, w * 0.45, w * 0.26, thick=0.008, out=0.012)

    def patch(self, col, cut=0.36, aim=(0, -1, -0.75), grow=0.006):
        """머리 한쪽을 덮는 색 조각(턱의 밝은 털, 정수리 무늬 등). aim=덮을 방향"""
        v = Vector(aim).normalized()
        rx = math.degrees(math.atan2(-v.y, v.z))
        rz = math.degrees(math.atan2(v.x, -v.y)) if abs(v.y) > 1e-4 else 0
        with self.head:
            self.fit(dome((0, 0, self.hc), 1.0, col, (self.hr[0] + grow, self.hr[1] + grow, self.hr[2] + grow), aim=(rx, 0, rz), seg=24, rings=8, cut=cut))

    def muzzle(self, col, z=None, w=0.15, h=0.105, d=0.1, y=None):
        """주둥이(볼록한 입 주변). 이후 코·입은 이 위에 붙는다."""
        z = self.hc - 0.115 if z is None else z
        y = -(self.hr[1] - d * 0.62) if y is None else y
        with self.head:
            ball((0, y, z), 1.0, col, (w, d, h), sub=3)
        self.bump((0, y, z), (w, d, h))
        return z

    def nose(self, col=INK, z=None, w=0.036, h=0.026, line=0.0, linecol=INK):
        """코. line>0이면 코 밑에서 입까지 내려오는 선(인중)을 그 길이만큼 긋는다."""
        z = self.hc - 0.075 if z is None else z
        with self.head:
            p, rot = self.hp(0, z, 0.006)
            ball(tuple(p), 1.0, col, (w * 1.18, 0.022, h * 1.18), rot=rot, sub=2)
            self.dot(-w * 0.35, z + h * 0.4, WHITE, w * 0.24, h * 0.2, thick=0.006, out=0.026)      # 코의 반짝임
            if line > 0:
                self.dot(0, z - h - line * 0.5, linecol, 0.008, line * 0.6, thick=0.008, out=0.004)

    # ------------------------------------------------------------ 귀·뿔·머리카락
    def ears_round(self, col, inner, x=0.27, z=None, r=0.115):
        z = self.hc + self.hr[2] * 0.78 if z is None else z
        with self.head:
            for s in (1, -1):
                ball((s * x, 0.02, z), r, col, (1, 0.6, 1), sub=2)
                ball((s * x, -0.035, z - 0.004), r * 0.6, inner, (1, 0.45, 1), sub=2)
        self.top = max(self.top, z + r)

    def ears_point(self, col, inner, x=0.24, z=None, h=0.3, w=0.13, lean=18, tip=None):
        z = self.hc + self.hr[2] * 0.55 if z is None else z
        with self.head:
            for s in (1, -1):
                cone((s * x, 0.02, z), w, h, col, seg=10, rot=(0, s * lean, 0), scale=(1, 0.55, 1))
                cone((s * x, -0.028, z + 0.02), w * 0.6, h * 0.72, inner, seg=8, rot=(0, s * lean, 0), scale=(1, 0.4, 1))
                if tip:
                    a = math.radians(s * lean)
                    cone((s * x + math.sin(a) * h * 0.58, 0.02, z + math.cos(a) * h * 0.58), w * 0.44, h * 0.44, tip, seg=10, rot=(0, s * lean, 0), scale=(1, 0.6, 1))
        self.top = max(self.top, z + h * 0.95)

    def ears_side(self, col, inner, x=None, z=None, l=0.2, w=0.085, droop=20):
        """옆으로 뻗은 귀(염소, 양, 소, 사슴)"""
        x = self.hr[0] * 0.86 if x is None else x
        z = self.hc + 0.1 if z is None else z
        with self.head:
            for s in (1, -1):
                ball((s * (x + l * 0.5), 0.0, z - math.sin(math.radians(droop)) * l * 0.5), 1.0, col, (l * 0.62, 0.045, w), rot=(0, s * droop, 0), sub=2)
                ball((s * (x + l * 0.52), -0.03, z - math.sin(math.radians(droop)) * l * 0.5), 1.0, inner, (l * 0.4, 0.03, w * 0.55), rot=(0, s * droop, 0), sub=2)

    def ears_flop(self, col, x=None, z=None, l=0.27, w=0.11):
        """아래로 늘어진 귀(개)"""
        x = self.hr[0] * 0.9 if x is None else x
        z = self.hc + 0.16 if z is None else z
        with self.head:
            for s in (1, -1):
                ball((s * (x + 0.02), -0.01, z - l * 0.45), 1.0, col, (0.06, w, l * 0.6), rot=(0, -s * 12, 0), sub=2)

    def hair_cap(self, col, cut=0.56, tilt=-24, grow=0.02):
        """앞쪽은 이마를 드러내고 귀와 뒷목 쪽으로 길어지는 머리 윤곽."""
        with self.head:
            verts, faces = [], []
            n, rings = 48, 12
            for j in range(rings):
                for i in range(n):
                    a = 2*math.pi*i/n
                    edge = math.pi*cut - (.81-tilt*.007)*math.cos(a)
                    edge += .055*math.sin(3*a+.5)*max(0,math.cos(a))
                    t = edge*(1-j/rings)
                    rx,ry,rz = (r+grow for r in self.hr)
                    verts.append((rx*math.sin(t)*math.sin(a), -ry*math.sin(t)*math.cos(a),
                                  self.hc+.003+rz*math.cos(t)))
            for j in range(rings-1):
                for i in range(n):
                    k = (i+1)%n
                    faces.append((j*n+i,j*n+k,(j+1)*n+k,(j+1)*n+i))
            peak=len(verts)
            verts.append((0,0,self.hc+self.hr[2]+grow+.003))
            faces.extend(((rings-1)*n+i,(rings-1)*n+(i+1)%n,peak) for i in range(n))
            self.fit(poly(verts,faces,col,smooth=True))
        self.top = max(self.top, self.hc + self.hr[2] + grow)


# ============================================================ 플레이어(사람 아이)
NOSE = {'#ffdcc0': '#ed936b', '#f5cba8': '#dd825b', '#e8b890': '#cc7756'}


def human_head(c, skin, nose, modular=False):
    c.skull(skin, sub=4)
    with c.head:
        for s in (-1, 1):
            ball((s*.401, -.004, c.hc-.045), 1, skin, (.071,.065,.076), sub=3)
            ball((s*.439, -.048, c.hc-.044), 1, nose, (.028,.018,.039), sub=2)
    z = c.hc - .087
    for i in range(1,4) if modular else (1,):
        part = c.m.part('nose%d'%i,(0,0,NECK),parent='head') if modular else c.head
        with part:
            if i == 1:
                outline = [(0,.040),(-.013,.031),(-.039,-.010),(-.034,-.021),
                           (.033,-.021),(.039,-.010),(.013,.031)]
                vs = [tuple(c.hp(x,z+dz,.007)[0]) for x,dz in outline]
                vs.append(tuple(c.hp(0,z-.006,.055)[0]))
                poly(vs, [(j,(j+1)%len(outline),len(outline)) for j in range(len(outline))],nose,smooth=True)
            elif i == 2:
                c.dot(0,z,nose,.042,.033,.032,.016)
            else:
                c.dot(0,z,nose,.026,.021,.023,.010)


def human_brows(c, color, modular=False):
    for i in range(1,4) if modular else (1,):
        part = c.m.part('brow%d'%i,(0,0,NECK),parent='head') if modular else c.head
        with part:
            for side in (-1,1):
                mid = c.hc+.112
                points = [[(.133,mid),(.160,mid+.010),(.188,mid+.012),(.212,mid+.005)],
                          [(.133,mid+.014),(.165,mid+.007),(.194,mid-.002),(.213,mid-.008)],
                          [(.134,mid+.003),(.164,mid+.006),(.196,mid+.005),(.216,mid+.002)]][i-1]
                for j,((x,z),(xx,zz)) in enumerate(zip(points,points[1:])):
                    a,b = c.hp(side*x,z,.010)[0],c.hp(side*xx,zz,.010)[0]
                    tube(a,b,.013 if j<2 else .011,color,r2=.011 if j<2 else .004,seg=10)
                    if j<2: ball(a,.013,color,sub=2)


def hair_lock(c, start, end, bend, width, depth, color):
    """머리 곡면을 따라 굽고 끝으로 갈수록 가늘어지는 앞머리 한 갈래."""
    verts,faces=[],[]
    rings,sides=12,12
    for j in range(rings+1):
        t=j/rings
        x=(1-t)*start[0]+t*end[0]+math.sin(t*math.pi)*bend
        z=c.hc+(1-t)*start[1]+t*end[1]
        shape=max(.035,math.sin(math.pi*(.035+.955*t))**.68)*(1.14-.39*t)
        for i in range(sides):
            a=2*math.pi*i/sides
            sx=x+width*shape*math.cos(a)
            p,_=c.hp(sx,z)
            verts.append((sx,p.y-.012-depth*shape*math.sin(a),z))
    for j in range(rings):
        for i in range(sides):
            k=(i+1)%sides
            faces.append((j*sides+i,(j+1)*sides+i,(j+1)*sides+k,j*sides+k))
    # 정면(-Y)에서 바깥 면이 보이도록 감는다.
    poly(verts,[tuple(reversed(f)) for f in faces],color,smooth=True)


def human_eyes(c, style, color, name='eyes'):
    x,z = .177,c.hc-.041
    with c.m.part(name, tuple(c.hp(0,z)[0]), parent='head'):
        for s in (-1,1):
            ex = s*x
            if style == 'smile':
                p,rot = c.hp(ex,z-.025,.010)
                arc(tuple(p),.055,.014,color,15,165,seg=12,tseg=7,rot=(90+rot[0],0,rot[2]))
                continue
            if style == 'dot':
                c.dot(ex,z,color,.044,.054,.016,.008)
                c.dot(ex-.010,z+.014,WHITE,.012,.016,.008,.024)
                continue
            w,h = {'oval':(.073,.099),'big':(.088,.091),'lash':(.077,.090),
                   'half':(.076,.054),'pop':(.078,.083)}[style]
            c.dot(ex,z,INK,w,h,.012,.008)
            c.dot(ex,z-.005,'#fffcf1',w-.006,h-.010,.013,.017)
            pw = w*(.41 if style=='pop' else .65)
            px = ex-s*.010
            c.dot(px,z+.001,color,pw,h*.78,.015,.025)
            c.dot(px-.011,z+h*.35,WHITE,pw*.29,h*.19,.009,.038)
            if style in ('half','lash'):
                c.dot(ex,z+h*.68,INK,w*1.02,.012,.011,.027,roll=s*7)
            if style=='lash':
                for dx,dz in [(.059,.068),(.076,.048)]:
                    c.dot(ex+s*dx,z+dz,INK,.011,.024,.011,.017,roll=-s*31)


def finish_player(c):
    # 얼굴과 머리 장식은 같은 축으로 키워 안경·모자가 함께 맞게 한다.
    for p in c.m.parts:
        if p is c.head or p.parent=='head':
            for v in p.bm.verts:
                v.co.x *= 1.105
                v.co.z = NECK + (v.co.z-NECK)*1.10
            p.pivot.x *= 1.105
            p.pivot.z = NECK + (p.pivot.z-NECK)*1.10
    c.top = NECK+(c.top-NECK)*1.10
    c.done()


def sneaker(c):
    for part,s in [(c.legL,1),(c.legR,-1)]:
        x=s*LEGX
        with part:
            ball((x,-.037,.034),1,'#f5e4ce',(.102,.142,.032),sub=3)
            for y,z in [(-.096,.113),(-.072,.123)]:
                capsule((x-.034,y,z),(x+.034,y,z),.008,'#fff2d8',seg=6,sub=1)


def kid(name, skin, hair, top, bottom, style):
    with Model(name) as m:
        c = Char(m)
        human_head(c, skin, NOSE.get(skin, '#db805b'))
        human_eyes(c, {'bob':'oval','spiky':'big','pony':'lash','cap':'half'}[style], INK)
        human_brows(c,hair)
        c.mouth('wide', z=c.hc-.162, w=.060)
        c.blush(x=.283,z=c.hc-.126,r=.065,col='#f5a599')
        H = c.hr
        if style == 'bob':                 # 단발 + 도토리 모자
            c.hair_cap(hair, cut=0.62, tilt=-20)
            with c.head:
                for i in range(5):         # 앞머리
                    x = (i - 2) * 0.115
                    p, _ = c.hp(x, c.hc + 0.215 - abs(i - 2) * 0.012)
                    ball((p.x, p.y - 0.004, p.z), 1.0, hair, (0.075, 0.04, 0.085), sub=2)
                for s in (1, -1):          # 옆머리
                    ball((s * 0.375, -0.05, c.hc - 0.03), 1.0, hair, (0.085, 0.15, 0.2), sub=2)
                # 도토리 깍정이 모자
                lathe([(0.3, 0.0), (0.305, 0.03), (0.27, 0.09), (0.18, 0.14), (0.0, 0.165)], '#a8703c', center=(0, 0.05, c.hc + 0.27), seg=16, rot=(-14, 0, 0))
                lathe([(0.305, 0.0), (0.315, 0.015), (0.305, 0.03)], '#8a5a2e', center=(0, 0.05, c.hc + 0.27), seg=16, rot=(-14, 0, 0), caps=False)
                cyl((0, 0.085, c.hc + 0.42), 0.022, 0.07, '#6c4529', seg=6, rot=(-14, 0, 0))
            c.top = c.hc + 0.5
        elif style == 'spiky':             # 삐죽 머리
            c.hair_cap(hair, cut=0.5, tilt=-22)
            with c.head:
                for (x, y, z, rx, ry) in ((0, -0.2, 0.33, -55, 0), (0.15, -0.15, 0.32, -45, 25), (-0.15, -0.15, 0.32, -45, -25), (0.07, 0.0, 0.37, -15, 10), (-0.09, 0.02, 0.37, -10, -14), (0.22, 0.05, 0.3, 5, 35), (-0.22, 0.05, 0.3, 5, -35), (0, 0.2, 0.3, 40, 0)):
                    cone((x, y, c.hc + z - 0.1), 0.1, 0.2, hair, seg=7, rot=(rx, ry, 0))
            c.top = c.hc + 0.47
        elif style == 'pony':              # 양 갈래
            c.hair_cap(hair, cut=0.58, tilt=-22)
            with c.head:
                for i in range(4):
                    x = (i - 1.5) * 0.13
                    p, _ = c.hp(x, c.hc + 0.21)
                    ball((p.x, p.y - 0.004, p.z), 1.0, hair, (0.08, 0.04, 0.075), rot=(0, (i - 1.5) * 14, 0), sub=2)
                for s in (1, -1):
                    ball((s * 0.43, 0.06, c.hc + 0.08), 0.045, '#ff7a8a', sub=2)
                    ball((s * 0.5, 0.08, c.hc - 0.04), 1.0, hair, (0.1, 0.1, 0.15), rot=(0, s * 20, 0), sub=2)
        else:                              # 짧은 머리 + 챙 모자
            c.hair_cap(hair, cut=0.6, tilt=-12)
            with c.head:
                c.fit(dome((0, 0.0, c.hc + 0.012), 1.0, '#5fae62', (H[0] + 0.035, H[1] + 0.035, H[2] + 0.035), aim=(-16, 0, 0), seg=24, rings=7, cut=0.42))
                ball((0, -0.36, c.hc + 0.19), 1.0, '#4f9a52', (0.24, 0.17, 0.028), rot=(-10, 0, 0), sub=2)
                ball((0, 0.02, c.hc + 0.39), 0.035, '#fff3d6', sub=1)
            c.top = c.hc + 0.44
        if style == 'pony':
            c.torso(top, kind='dress', hem=WHITE, collar=WHITE)
            c.emblem('acorn', '#fff3d6', z=0.53, s=0.95, col2='#8a5a34')
            c.arms(top, skin, sl=0.3)
            c.legs(skin, '#e8574c', sock=WHITE)
        elif style == 'cap':
            c.torso('#fff3d6', bottom, collar='#fff3d6')
            with c.body:                   # 멜빵바지
                box(c.front(0.47, 0.012), (0.2, 0.02, 0.17), bottom, bevel=0.008)
                for s in (1, -1):
                    tube(c.front(0.55, 0.014, s * 0.08), (s * 0.115, -0.05, 0.69), 0.02, bottom, seg=6)
                    tube((s * 0.115, -0.05, 0.69), (s * 0.1, 0.13, 0.6), 0.02, bottom, seg=6)
                    ball(c.front(0.54, 0.024, s * 0.078), 0.02, '#ffd84a', (1, 0.6, 1), sub=1)
            c.emblem('acorn', '#f2c06a', z=0.455, s=0.8)
            c.arms('#fff3d6', skin, sl=0.3)
            c.legs(bottom, '#8a5a3a')
        else:
            c.torso(top, bottom, hem=WHITE if style == 'bob' else None, collar=WHITE if style == 'bob' else top)
            if style == 'spiky':
                with c.body:               # 후드 주머니와 끈
                    box(c.front(0.44, 0.014), (0.19, 0.02, 0.09), '#3a78c0', bevel=0.008)
                    for s in (1, -1):
                        tube(c.front(0.66, 0.01, s * 0.04), c.front(0.56, 0.016, s * 0.045), 0.009, WHITE, seg=4)
                    ball((0, 0.13, 0.66), 1.0, top, (0.16, 0.1, 0.09), sub=2)
            else:
                c.emblem('acorn', '#fff3d6', z=0.53, s=1.0, col2='#8a5a34')
            c.arms(top, skin, sl=0.3 if style == 'bob' else 0.72)
            c.legs(bottom, '#f7f7f2' if style == 'spiky' else '#8a5a3a', sock=WHITE)
        sneaker(c)
        finish_player(c)


# ============================================================ 꾸미는 주인공
# 부위를 갈아 끼우는 주인공 한 명(player_custom). 게임(js/game/look.js)이 고른 부위만 보이게 하고 색을 입힌다.
#   머리에 딸린 것: hair1~9(머리 모양) hairfr1~9(앞머리 — 머리를 푹 덮는 모자를 쓰면 숨긴다) hairtop1~9(윗머리 — 모자를 쓰면 숨긴다)
#                  eyes1~7 mouth1~5 blush freckle hat1~7 glass1~3
#   몸통: top1~6(옷)    팔: sls_L/R(짧은 소매) sll_L/R(긴 소매)    다리: pants_L/R(긴 바지) shorts_L/R(반바지) sock_L/R(양말)
#   색이 바뀌는 재질: p_skin p_nose p_hair p_eye p_top p_top2 p_bot p_shoe p_hat p_hat2  (models.js 의 DYNAMIC 에도 있다)
# 부위를 더하려면 여기서 같은 규칙으로 이름을 붙이고 look.js 의 표에 한 줄 넣는다.
from contextlib import contextmanager


@contextmanager
def _into(c, attr, part):
    """Char의 함수(skull, torso, blush …)가 만드는 것을 다른 부위(갈아 끼우는 조각)에 넣는다"""
    old = getattr(c, attr)
    setattr(c, attr, part)
    try:
        yield part
    finally:
        setattr(c, attr, old)


def custom(name):
    SK, NO, HA, EY, TP, TP2, BT, SH, HT, HT2 = 'p_skin', 'p_nose', 'p_hair', 'p_eye', 'p_top', 'p_top2', 'p_bot', 'p_shoe', 'p_hat', 'p_hat2'
    TIE = '#ff7a8a'
    with Model(name) as m:
        c = Char(m)
        hc, H = c.hc, c.hr
        hp = lambda n: m.part(n, (0, 0, NECK), parent='head')
        bp = lambda n: m.part(n, (0, 0, BODY0), parent='body')

        # ---------------- 얼굴
        human_head(c, SK, NO, modular=True)
        human_brows(c, HA, modular=True)
        for i, style in enumerate(('oval','big','dot','half','smile','lash','pop'),1):
            human_eyes(c, style, EY, 'eyes%d' % i)
        for i, st in enumerate(('smile', 'cat', 'flat', 'o', 'wide')):
            c.mouth(st, z=hc - 0.162, w=0.065, name='mouth%d' % (i + 1), open_part=(i == 0))
        with _into(c, 'head', hp('blush')):
            c.blush(x=.283, z=hc-.126, r=.065, col='#f5a599')
        with hp('freckle'):
            for s in (1, -1):
                for dx, dz in ((0.0, 0.0), (0.04, 0.02), (-0.036, 0.022)):
                    c.dot(s * (0.265 + dx), hc - 0.118 + dz, NO, 0.012, 0.01, thick=0.008, out=0.003)

        # ---------------- 머리 모양
        def bangs(n, z, w=0.075, hgt=0.085, sp=0.115, drop=0.012, col=HA):
            for i in range(n):
                k = i - (n - 1) / 2
                x = k*sp
                center = z-abs(k)*drop
                hair_lock(c,(x*.77+.032,center+hgt*.80),(x-.018,center-hgt*.91),
                          .014 if k<0 else -.012,w*1.23,.047,col)

        def cap(part, cut, tilt, grow=0.02):
            with _into(c, 'head', part):
                c.hair_cap(HA, cut=cut, tilt=tilt, grow=grow)

        P = hp('hair1'); cap(P, 0.62, -20)                 # 1 단발
        with hp('hairfr1'):
            bangs(5, 0.215)
        with P:
            for s in (1, -1):
                ball((s * 0.375, -0.05, hc - 0.03), 1.0, HA, (0.085, 0.15, 0.2), sub=2)
            ball((0, 0.13, hc - 0.09), 1.0, HA, (0.385, 0.285, 0.27), sub=3)      # 목덜미까지 내려오는 뒷머리

        P = hp('hair2'); cap(P, 0.5, -22)                  # 2 삐죽 머리
        with hp('hairfr2'):
            bangs(3, 0.245, w=0.07, hgt=0.055, sp=0.13)
        with hp('hairtop2'):
            for (x, y, z, rx, ry) in ((0, -0.2, 0.33, -55, 0), (0.15, -0.15, 0.32, -45, 25), (-0.15, -0.15, 0.32, -45, -25), (0.07, 0.0, 0.37, -15, 10), (-0.09, 0.02, 0.37, -10, -14), (0.22, 0.05, 0.3, 5, 35), (-0.22, 0.05, 0.3, 5, -35), (0, 0.2, 0.3, 40, 0)):
                cone((x, y, hc + z - 0.1), 0.1, 0.2, HA, seg=7, rot=(rx, ry, 0))

        P = hp('hair3'); cap(P, 0.58, -22)                 # 3 양 갈래
        with hp('hairfr3'):
            bangs(4, 0.21, w=0.08, hgt=0.075, sp=0.13, drop=0.0)
        with P:
            for s in (1, -1):
                ball((s * 0.43, 0.06, hc + 0.08), 0.045, TIE, sub=2)
                ball((s * 0.5, 0.08, hc - 0.04), 1.0, HA, (0.1, 0.1, 0.15), rot=(0, s * 20, 0), sub=2)

        P = hp('hair4'); cap(P, 0.6, -12)                  # 4 짧은 머리
        with hp('hairfr4'):
            bangs(3, 0.24, w=0.095, hgt=0.05, sp=0.14, drop=0.01)

        P = hp('hair5'); cap(P, 0.62, -20)                 # 5 긴 머리
        with hp('hairfr5'):
            bangs(5, 0.215)
        with P:
            ball((0, 0.17, hc - 0.2), 1.0, HA, (0.37, 0.22, 0.38), sub=3)
            for s in (1, -1):
                ball((s * 0.375, -0.03, hc - 0.15), 1.0, HA, (0.085, 0.14, 0.31), sub=2)

        P = hp('hair6'); cap(P, 0.56, -20)                 # 6 곱슬머리
        with P:
            for j in range(11):
                a = math.radians(-12 + j * 20.4)
                ball((math.cos(a) * 0.4, math.sin(a) * 0.37 + 0.02, hc + 0.0 + 0.04 * math.sin(j * 1.7)), 0.108, HA, sub=2)
        with hp('hairfr6'):
            for k in (-1.5, -0.5, 0.5, 1.5):
                p, _ = c.hp(k * 0.125, hc + 0.235 - abs(k) * 0.012)
                ball((p.x, p.y - 0.01, p.z), 0.082, HA, sub=2)
        with hp('hairtop6'):
            for j in range(7):
                a = math.radians(j * 360 / 7 + 12)
                ball((math.cos(a) * 0.21, math.sin(a) * 0.2 + 0.02, hc + 0.285), 0.112, HA, sub=2)
            ball((0, 0.02, hc + 0.36), 0.115, HA, sub=2)

        P = hp('hair7'); cap(P, 0.6, -18)                  # 7 올림머리
        with hp('hairfr7'):
            bangs(5, 0.215)
        with hp('hairtop7'):
            ball((0, 0.1, hc + 0.41), 0.128, HA, sub=2)
            torus((0, 0.085, hc + 0.325), 0.075, 0.02, TIE, seg=12, tseg=5, rot=(-12, 0, 0))

        P = hp('hair8'); cap(P, 0.6, -18)                  # 8 뒤로 묶은 머리
        with hp('hairfr8'):
            bangs(4, 0.21, w=0.08, hgt=0.075, sp=0.13, drop=0.0)
        with P:
            ball((0, 0.37, hc + 0.14), 1.0, TIE, (0.07, 0.06, 0.07), sub=2)
            ball((0, 0.47, hc - 0.0), 1.0, HA, (0.095, 0.105, 0.25), rot=(-20, 0, 0), sub=2)

        cap(hp('hair9'), 0.5, -16, grow=0.009)             # 9 아주 짧은 머리

        P = hp('hair10'); cap(P,.57,-19)                    # 깊은 옆가르마
        with hp('hairfr10'):
            for start,end,wide in [((.090,.288),(-.256,.092),.113),
                                   ((.127,.266),(-.083,.135),.095),
                                   ((.148,.259),(.301,.091),.080)]:
                hair_lock(c,start,end,-.024,wide,.053,HA)
        with P:
            for s in (-1,1):
                ball((s*.373,.027,hc-.020),1,HA,(.079,.145,.139),rot=(0,s*16,0),sub=3)

        P = hp('hair11'); cap(P,.58,-23)                    # 양쪽으로 땋은 머리
        with hp('hairfr11'):
            hair_lock(c,(-.013,.308),(-.225,.115),-.03,.108,.045,HA)
            hair_lock(c,(.012,.308),(.225,.115),.03,.108,.045,HA)
        with P:
            for s in (-1,1):
                for j in range(5):
                    f=1-j*.075
                    ball((s*(.385+.032*math.sin(j*1.7)),.095,hc+.035-j*.062),
                         1,HA,(.077*f,.091*f,.082*f),rot=(0,s*(25 if j%2 else -25),0),sub=3)
                ball((s*.397,.095,hc-.243),1,TIE,(.055,.061,.025),sub=2)
                ball((s*.402,.098,hc-.279),1,HA,(.047,.052,.052),sub=3)

        P = hp('hair12'); cap(P,.59,-21)                    # 웨이브 단발
        with hp('hairfr12'):
            for s in (-1,1):
                hair_lock(c,(s*.026,.302),(s*.232,.108),s*.069,.112,.054,HA)
                hair_lock(c,(s*.146,.259),(s*.307,.051),s*.046,.082,.043,HA)
        with P:
            ball((0,.13,hc-.10),1,HA,(.396,.286,.228),sub=3)
            for s in (-1,1):
                for x,y,z,r,t in [(.359,-.025,.015,.121,-14),(.385,-.022,-.094,.114,15),
                                   (.354,.005,-.163,.087,34),(.309,.139,-.159,.110,20)]:
                    ball((s*x,y,hc+z),1,HA,(r*.82,r*1.10,r*1.14),rot=(0,s*t,0),sub=3)

        # ---------------- 모자·머리 장식
        with hp('hat1'):                                   # 1 도토리 깍정이 모자
            lathe([(0.3, 0.0), (0.305, 0.03), (0.27, 0.09), (0.18, 0.14), (0.0, 0.165)], '#a8703c', center=(0, 0.05, hc + 0.27), seg=16, rot=(-14, 0, 0))
            lathe([(0.305, 0.0), (0.315, 0.015), (0.305, 0.03)], '#8a5a2e', center=(0, 0.05, hc + 0.27), seg=16, rot=(-14, 0, 0), caps=False)
            cyl((0, 0.085, hc + 0.42), 0.022, 0.07, '#6c4529', seg=6, rot=(-14, 0, 0))
        with hp('hat2'):                                   # 2 챙 모자
            c.fit(dome((0, 0.0, hc + 0.012), 1.0, HT, (H[0] + 0.035, H[1] + 0.035, H[2] + 0.035), aim=(-16, 0, 0), seg=24, rings=7, cut=0.42))
            ball((0, -0.36, hc + 0.19), 1.0, HT2, (0.24, 0.17, 0.028), rot=(-10, 0, 0), sub=2)
            ball((0, 0.02, hc + 0.39), 0.035, '#fff3d6', sub=1)
        with hp('hat3'):                                   # 3 밀짚모자(뒤로 젖혀 써서 얼굴이 보인다)
            STRAW, STRAW_D = '#ecd08a', '#d6b46a'
            cz = hc + 0.02
            c.fit(dome((0, 0.02, cz), 1.0, STRAW, (H[0] + 0.03, H[1] + 0.03, H[2] + 0.045), aim=(-16, 0, 0), seg=24, rings=7, cut=0.4))
            lathe([(0.3, 0.012), (0.52, -0.02), (0.535, -0.008), (0.52, 0.006), (0.3, 0.04)], STRAW_D, center=(0, 0.045, cz + 0.2), seg=24, scale=(1, 0.95), rot=(-16, 0, 0), caps=False)
            lathe([(0.392, 0.0), (0.398, 0.03), (0.372, 0.062)], HT, center=(0, 0.04, cz + 0.2), seg=24, scale=(1, 0.95), rot=(-16, 0, 0), caps=False)
        with hp('hat4'):                                   # 4 털모자
            cz = hc + 0.03
            c.fit(dome((0, 0.0, cz), 1.0, HT, (H[0] + 0.04, H[1] + 0.04, H[2] + 0.07), aim=(-14, 0, 0), seg=24, rings=8, cut=0.47))
            torus((0, 0.008, cz + 0.048), 0.445, 0.04, HT2, seg=24, tseg=6, rot=(-14, 0, 0), scale=(1, 0.95, 1.25))
            ball((0, 0.115, hc + 0.5), 0.09, '#fffaf0', sub=2)
        with hp('hat5'):                                   # 5 리본
            cx, cy, cz = 0.19, -0.03, hc + 0.345
            for s in (1, -1):
                ball((cx + s * 0.085, cy, cz + 0.01), 1.0, HT, (0.085, 0.04, 0.065), rot=(0, -s * 24 + 14, 0), sub=2)
            ball((cx, cy - 0.01, cz), 0.04, HT2, sub=2)
        with hp('hat6'):                                   # 6 꽃 머리핀
            x, z = 0.3, hc + 0.17
            q = max(0.0, 1 - (x / H[0]) ** 2 - ((z - hc) / H[2]) ** 2)
            y = -H[1] * math.sqrt(q)
            n = Vector((x / H[0] ** 2, y / H[1] ** 2, (z - hc) / H[2] ** 2)).normalized()
            u = n.cross(Vector((0, 0, 1))).normalized(); v = n.cross(u)
            o = Vector((x, y, z)) + n * 0.045
            for i in range(5):
                a = math.radians(90 + i * 72)
                ball(tuple(o + (u * math.cos(a) + v * math.sin(a)) * 0.05), 0.038, HT, sub=2)
            ball(tuple(o + n * 0.02), 0.03, '#ffd84a', sub=2)
        with hp('hat7'):                                   # 7 머리띠
            arc((0, -0.03, hc), 0.448, 0.024, HT, 12, 168, seg=20, tseg=6, rot=(90, 0, 0), scale=(1, 0.86, 1))

        # ---------------- 안경
        ez, ex = hc - 0.05, 0.184
        RIM = '#4a3a34'

        def bridge(out=0.034, col=RIM, r=0.009, w=0.092):
            a, _ = c.hp(w, ez + 0.012, out); b, _ = c.hp(-w, ez + 0.012, out)
            tube(tuple(a), tuple(b), r, col, seg=5)

        with hp('glass1'):                                 # 1 동그란 안경
            for s in (1, -1):
                p, rot = c.hp(s * ex, ez, 0.03)
                torus(tuple(p), 0.094, 0.0105, RIM, seg=18, tseg=5, rot=(90 + rot[0], 0, rot[2]))
            bridge()
        with hp('glass2'):                                 # 2 네모 안경
            for s in (1, -1):
                p, rot = c.hp(s * ex, ez, 0.03)
                R = Euler([math.radians(a) for a in (rot[0], 0, rot[2])], 'XYZ').to_matrix()
                ux, uz = R @ Vector((1, 0, 0)), R @ Vector((0, 0, 1))
                w, h, t = 0.098, 0.072, 0.02
                for sg in (1, -1):
                    box(tuple(p + uz * (sg * h)), (2 * w + t, 0.018, t), '#3a4a6a', rot=(rot[0], 0, rot[2]), bevel=0.004)
                    box(tuple(p + ux * (sg * w)), (t, 0.018, 2 * h + t), '#3a4a6a', rot=(rot[0], 0, rot[2]), bevel=0.004)
            bridge(col='#3a4a6a', r=0.011, w=0.088)
        with hp('glass3'):                                 # 3 색안경
            for s in (1, -1):
                c.dot(s * ex, ez, '#2a2a34', 0.105, 0.08, thick=0.016, out=0.03)
                c.dot(s * ex - 0.03, ez + 0.03, '#6a6a7a', 0.03, 0.014, thick=0.008, out=0.044, roll=-30)
            bridge(out=0.036, col='#2a2a34', r=0.012, w=0.09)

        # ---------------- 옷(몸통)
        with _into(c, 'body', bp('top1')) as P:                 # 1 반소매 티
            c.torso(TP, BT, collar='#fff1d6')
            with P:
                c.band(.385,.413,'#fff1d6',.017)
                c.band(.426,.441,TP2,.014)
            c.emblem('acorn', '#ffdfa2', z=.555, s=1.32, col2='#935a42')
        with _into(c, 'body', bp('top2')) as P:            # 2 후드티
            c.torso(TP, BT, collar=TP)
            with P:
                box(c.front(0.44, 0.014), (0.19, 0.02, 0.09), TP2, bevel=0.008)
                for s in (1, -1):
                    tube(c.front(0.66, 0.01, s * 0.04), c.front(0.56, 0.016, s * 0.045), 0.009, WHITE, seg=4)
                ball((0, 0.13, 0.66), 1.0, TP, (0.16, 0.1, 0.09), sub=2)
        with _into(c, 'body', bp('top3')):                 # 3 원피스
            c.torso(TP, kind='dress', hem=WHITE, collar=WHITE)
            c.emblem('acorn', '#fff3d6', z=0.53, s=0.95, col2='#8a5a34')
        with _into(c, 'body', bp('top4')) as P:            # 4 멜빵바지
            c.torso(TP, BT, collar=TP)
            with P:
                box(c.front(0.47, 0.012), (0.2, 0.02, 0.17), BT, bevel=0.008)
                for s in (1, -1):
                    tube(c.front(0.55, 0.014, s * 0.08), (s * 0.115, -0.05, 0.69), 0.02, BT, seg=6)
                    tube((s * 0.115, -0.05, 0.69), (s * 0.1, 0.13, 0.6), 0.02, BT, seg=6)
                    ball(c.front(0.54, 0.024, s * 0.078), 0.02, '#ffd84a', (1, 0.6, 1), sub=1)
            c.emblem('acorn', '#f2c06a', z=0.455, s=0.8)
        with _into(c, 'body', bp('top5')) as P:            # 5 줄무늬 긴소매
            c.torso(TP, BT, collar=WHITE)
            with P:
                for z0 in (0.425, 0.505, 0.585):
                    c.band(z0, z0 + 0.036, WHITE, 0.0125)
        with _into(c, 'body', bp('top6')) as P:            # 6 저고리와 치마
            c.torso(BT, kind='dress', collar=WHITE)
            with P:
                c.band(0.47, 0.7, TP, 0.014, 0.004, n=7)
                a = c.front(0.69, 0.02, -0.085); b = c.front(0.69, 0.02, 0.085)
                tube(a, c.front(0.535, 0.022, 0.045), 0.017, WHITE, seg=6)            # 깃(동정): 왼쪽이 오른쪽을 덮는다
                tube(b, c.front(0.575, 0.02, -0.005), 0.017, WHITE, seg=6)
                k = c.front(0.53, 0.03, 0.05)
                ball(k, 0.024, TP2, sub=2)                                             # 고름
                tube(k, c.front(0.385, 0.03, 0.02), 0.017, TP2, r2=0.013, seg=6)
                tube(k, c.front(0.41, 0.03, 0.105), 0.017, TP2, r2=0.013, seg=6)

        # ---------------- 팔
        r = 0.06
        for part, s, sd in ((c.armL, 1, 'L'), (c.armR, -1, 'R')):
            a = Vector((s * SHX, 0, SHZ)); b = Vector((s * HAND[0], HAND[1], HAND[2]))
            with part:
                ball(a, r + 0.004, SK, sub=2)
                tube(a, b, r, SK, r2=r - 0.004, seg=10)
                ball(b, r + 0.02, SK, (1, 1, 1.05), sub=2)
            for nm, sl in (('sls_', 0.3), ('sll_', 0.72)):
                with m.part(nm + sd, tuple(a), parent='arm_' + sd):
                    ball(a, r + 0.016, TP, sub=2)
                    tube(a, a.lerp(b, sl), r + 0.014, TP, r2=r + 0.024, seg=10)

        # ---------------- 다리
        lr = 0.078
        for part, s, sd in ((c.legL, 1, 'L'), (c.legR, -1, 'R')):
            x = s * LEGX
            piv = (x, 0, HIP)
            with part:
                tube((x, 0, HIP + 0.03), (x, 0, 0.08), lr - 0.007, SK, r2=(lr - 0.007) * 0.94, seg=10)
                ball((x, -0.032, 0.066), 1.0, SH, (0.094, 0.128, 0.066), sub=2)
            with m.part('pants_' + sd, piv, parent='leg_' + sd):
                tube((x, 0, HIP + 0.03), (x, 0, 0.08), lr, BT, r2=lr * 0.94, seg=10)
            with m.part('shorts_' + sd, piv, parent='leg_' + sd):
                tube((x, 0, HIP + 0.03), (x, 0, 0.2), lr + 0.004, BT, r2=lr + 0.01, seg=10)
            with m.part('sock_' + sd, piv, parent='leg_' + sd):
                tube((x, 0, 0.155), (x, 0, 0.08), lr - 0.002, WHITE, r2=lr * 0.92, seg=10)

        c.top = hc + 0.52
        sneaker(c)
        finish_player(c)


ALL = dict(RESIDENT_MODELS)
ALL['player_1'] = lambda n: kid(n, '#ffdcc0', '#6a4530', '#e8574c', '#40598f', 'bob')
ALL['player_2'] = lambda n: kid(n, '#f5cba8', '#2e2a36', '#4a90d9', '#7a6a52', 'spiky')
ALL['player_3'] = lambda n: kid(n, '#ffdcc0', '#b8682e', '#ffd04a', '#5fae62', 'pony')
ALL['player_4'] = lambda n: kid(n, '#e8b890', '#3a2a22', '#6fb86a', '#4f7fc0', 'cap')
ALL['player_custom'] = custom
