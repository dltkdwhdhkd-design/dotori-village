"""캐릭터 모델 — 전부 이 게임을 위해 새로 만든 오리지널 캐릭터.

머리가 크고 몸이 작은 인형 체형에 옷을 입힌다. 모든 캐릭터가 같은 뼈대(Char)를 쓴다.

부위 이름(게임이 이 이름을 보고 움직인다):
  body(몸통) head(머리) arm_L arm_R(팔) leg_L leg_R(다리) tail(꼬리)
  eyes(눈 — 깜박임)  mouth(다문 입)  mouth_open(말할 때 입)   ← 머리에 딸린 부위
  + 위치 표시: hand(도구를 쥐는 손), top(머리 위 말풍선 자리)
정면은 -Y, 발바닥이 Z=0, 키는 귀를 빼고 1.4 정도.
"""
import math
from lib import *

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
        ball(tuple(p), 1.0, mat, (w, thick, h), rot=(rot[0], roll, rot[2]), sub=2 if max(w, h) > 0.03 else 1)

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
    def eyes(self, style='oval', x=0.15, z=None, size=1.0, col=INK, white=False, lid=None, iris=None):
        """눈. style: oval(기본) big(동그랗고 큼) dot(점) pop(흰자에 작은 눈동자) sleepy(졸린) smile(웃는) lash(속눈썹)
        white=True면 흰자를 깐다. iris=홍채 색(얼굴이 어두운 캐릭터는 밝은 홍채를 준다).
        lid=눈꺼풀 색(sleepy에서 얼굴색을 준다)"""
        z = self.hc - 0.05 if z is None else z - 0.012
        size *= EYE
        x *= 1.05
        pc, _ = self.hp(0, z)
        P = self.m.part('eyes', (0, pc.y, z), parent='head')
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

    def mouth(self, style='smile', z=None, w=0.05, col=INK):
        """입. style: smile(미소) cat(ω) flat(一) o(작은 동그라미) wide(넓은 미소)"""
        z = self.hc - 0.14 if z is None else z
        p, rot = self.hp(0, z, 0.004)
        P = self.m.part('mouth', tuple(p), parent='head')
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
        """머리 위를 덮는 머리카락"""
        with self.head:
            self.fit(dome((0, 0.006, self.hc + 0.002), 1.0, col, (self.hr[0] + grow, self.hr[1] + grow, self.hr[2] + grow), aim=(tilt, 0, 0), seg=24, rings=8, cut=cut))
        self.top = max(self.top, self.hc + self.hr[2] + grow)


# ============================================================ 주민
def dalgom(name):       # 달곰 — 반달가슴곰, 느긋함
    fur, pale = '#463a40', '#f3e6cf'
    with Model(name) as m:
        c = Char(m)
        c.skull(fur)
        c.ears_round(fur, '#8a6a62')
        c.muzzle(pale, w=0.165, h=0.115, z=c.hc - 0.125)
        c.nose('#2a2024', w=0.044, h=0.03, z=c.hc - 0.075, line=0.03)
        c.eyes('sleepy', x=0.178, iris='#d9a05a', lid=fur, size=0.95)
        c.mouth('cat', z=c.hc - 0.172, w=0.05)
        c.blush(x=0.285, col='#d9828a')
        c.torso('#34507e', '#d9b77a', hem='#f3e6cf', collar='#f3e6cf')
        c.emblem('moon', '#fff6dc', z=0.53, s=1.0)
        c.arms('#34507e', fur, sl=0.42)
        c.legs('#d9b77a', fur)
        with c.tail:
            ball((0, 0.2, 0.36), 0.065, fur, sub=2)
        c.done()


def goran(name):        # 고란 — 고라니, 수줍음
    fur, pale = '#c99562', '#fbf0dc'
    with Model(name) as m:
        c = Char(m)
        c.skull(fur)
        with c.head:
            for s in (1, -1):     # 크고 길쭉한 귀
                ball((s * 0.33, 0.03, c.hc + 0.33), 1.0, fur, (0.1, 0.05, 0.19), rot=(0, s * 28, 0), sub=2)
                ball((s * 0.335, -0.012, c.hc + 0.33), 1.0, '#f0c9b0', (0.058, 0.03, 0.135), rot=(0, s * 28, 0), sub=2)
        c.top = c.hc + 0.5
        c.patch(pale, cut=0.3, aim=(0, -1, -1.1))
        c.muzzle(pale, w=0.125, h=0.09, d=0.085)
        c.nose('#4a3430', w=0.036, h=0.026, line=0.024)
        c.eyes('oval', x=0.182, size=1.06)
        c.brows('#8a6240', tilt=14, w=0.04, x=0.182, z=c.hc + 0.115)
        c.mouth('smile', z=c.hc - 0.165, w=0.038)
        with c.head:               # 작은 송곳니
            for s in (1, -1):
                p, _ = c.hp(s * 0.04, c.hc - 0.17, 0.004)
                cone((p.x, p.y, p.z), 0.011, 0.034, WHITE, seg=5, rot=(180, 0, 0))
        c.blush(x=0.29)
        c.torso('#f4ecd8', '#8a6a4a', hem=None, collar='#f4ecd8')
        with c.body:               # 풀빛 카디건
            c.band(0.36, 0.69, '#8fb56a', 0.016, 0.012, n=5)
            box(c.front(0.535, 0.02), (0.07, 0.02, 0.27), '#f4ecd8')
        c.buttons('#fff3c4', zs=(0.6, 0.5, 0.41), r=0.014)
        c.emblem('leaf', '#5f9a4a', z=0.57, s=0.75, x=0.1)
        c.arms('#8fb56a', fur, sl=0.62)
        c.legs('#8a6a4a', '#5a4030')
        with c.tail:
            ball((0, 0.2, 0.36), 0.05, pale, sub=2)
        c.done()


def nureong(name):      # 누렁 — 누렁이, 운동 좋아함
    fur, pale = '#e8b24a', '#fff6e2'
    with Model(name) as m:
        c = Char(m)
        c.skull(fur)
        c.ears_flop('#c98a2e')
        c.muzzle(pale, w=0.16, h=0.11, d=0.11)
        c.nose('#2f2428', w=0.046, h=0.033, line=0.028)
        c.eyes('oval', x=0.178)
        c.brows('#9a6a22', tilt=-6, w=0.05, th=0.016, x=0.178, z=c.hc + 0.115)
        c.mouth('cat', z=c.hc - 0.172, w=0.056)
        with c.head:               # 빨간 머리띠
            torus((0, 0.0, c.hc + 0.2), 0.345, 0.03, '#e8463c', seg=20, tseg=6, scale=(1, 0.94, 1.3))
        c.torso('#e8463c', '#3a4a6a', hem=WHITE)
        with c.body:
            c.band(0.56, 0.6, WHITE, 0.011)
        c.emblem('star', '#ffd84a', z=0.48, s=0.9)
        c.arms('#e8463c', fur, sl=0.25)
        c.legs('#3a4a6a', '#f7f7f2', sock=WHITE)
        with c.tail:               # 말린 꼬리
            torus((0, 0.23, 0.42), 0.06, 0.032, fur, seg=10, tseg=6, rot=(0, 90, 0))
        c.done()


def beomi(name):        # 범이 — 호랑이, 무뚝뚝함
    fur, pale, st = '#f09a3a', '#fff4e0', '#3a2a26'
    with Model(name) as m:
        c = Char(m)
        c.skull(fur)
        c.ears_round(fur, pale, r=0.1, x=0.28)
        with c.head:
            for s in (1, -1):
                ball((s * 0.28, 0.045, c.hc + 0.275), 0.085, st, (1, 0.5, 1), sub=2)       # 귀 뒤 검은 털
                ball((s * 0.27, -0.17, c.hc - 0.13), 1.0, pale, (0.12, 0.14, 0.095), sub=2)   # 볼의 흰 털
            # 이마 줄무늬(가운데 하나, 양옆 둘)
            for (x, z, w, h, rl) in ((0, 0.25, 0.022, 0.07, 0), (0.1, 0.22, 0.018, 0.055, -25), (-0.1, 0.22, 0.018, 0.055, 25)):
                c.dot(x, c.hc + z, st, w, h, thick=0.008, out=0.002, roll=rl)
            for s in (1, -1):
                for (z, w) in ((0.03, 0.06), (-0.05, 0.07)):
                    c.dot(s * 0.36, c.hc + z, st, w, 0.016, thick=0.008, out=0.002, roll=s * 8)
        c.muzzle(pale, w=0.14, h=0.095)
        c.nose('#e07a7a', w=0.04, h=0.028, line=0.026)
        c.eyes('oval', x=0.175, size=0.92)
        c.brows(st, tilt=-20, w=0.058, th=0.02, z=c.hc + 0.068, x=0.168)
        c.mouth('flat', z=c.hc - 0.172, w=0.05)
        c.torso('#f7f0dc', '#4a4640', collar='#f7f0dc')
        with c.body:               # 쪽빛 배자(조끼)
            c.band(0.35, 0.67, '#2f4e86', 0.018, 0.012, n=5)
            box(c.front(0.535, 0.02), (0.085, 0.02, 0.27), '#f7f0dc')
            ball(c.front(0.56, 0.026), 0.022, '#f2c230', (1, 0.6, 1), sub=1)
        c.arms('#f7f0dc', fur, sl=0.45)
        c.legs('#4a4640', '#2e2a2a')
        with c.tail:
            p0 = Vector((0, 0.17, 0.36))
            pts = [p0, Vector((0, 0.32, 0.4)), Vector((0, 0.4, 0.55)), Vector((0, 0.36, 0.72))]
            for i in range(3):
                tube(pts[i], pts[i + 1], 0.04, fur if i % 2 == 0 else st, seg=8)
                ball(pts[i + 1], 0.04, st if i == 2 else fur, sub=2)
        c.done()


def bird_head(c, col, beak, cheek=None):
    c.skull(col)
    if cheek:
        with c.head:
            ball((0, -0.03, c.hc - 0.07), 1.0, cheek, (0.34, 0.35, 0.25), sub=3)


def beak(c, col, z=None, w=0.07, l=0.14, h=0.05, col2=None, flat=False):
    """부리. flat=True면 오리처럼 넓적하게"""
    z = c.hc - 0.09 if z is None else z
    y0 = -(c.hr[1] - 0.05)
    with c.head:
        if flat:
            ball((0, y0 - l * 0.45, z + 0.008), 1.0, col, (w * 1.35, l * 0.9, h * 0.62), sub=2)
            ball((0, y0 - l * 0.35, z - 0.028), 1.0, col2 or col, (w * 1.1, l * 0.72, h * 0.42), sub=2)
        else:
            cone((0, y0, z + 0.012), w, l, col, seg=10, rot=(90, 0, 0), scale=(1, 0.72, 1))
            cone((0, y0, z - 0.03), w * 0.8, l * 0.72, col2 or col, seg=8, rot=(90, 0, 0), scale=(1, 0.45, 1))


def jangkki(name):      # 장끼 — 꿩, 멋 부림
    g = '#2f7f62'
    with Model(name) as m:
        c = Char(m)
        bird_head(c, g, '#f5e3a0')
        with c.head:
            for s in (1, -1):      # 눈가의 붉은 살, 뒤통수 깃
                c.dot(s * 0.184, c.hc - 0.05, '#ee5a4e', 0.1, 0.098, thick=0.01)
                cone((s * 0.16, 0.2, c.hc + 0.25), 0.04, 0.15, g, seg=6, rot=(-35, s * 14, 0))
            torus((0, 0, NECK + 0.035), 0.2, 0.04, WHITE, seg=18, tseg=6, scale=(1, 0.92, 0.8))   # 흰 목테
        c.top = c.hc + 0.45
        beak(c, '#f5e3a0', w=0.07, l=0.15, col2='#e6cf86')
        c.eyes('oval', x=0.18, size=0.9, z=c.hc - 0.035)
        c.brows('#1e4a3a', tilt=8, w=0.045, th=0.012, z=c.hc + 0.095, x=0.18)
        c.torso('#f7ecd0', '#5a3a2a', collar='#f2c230')
        with c.body:               # 자줏빛 조끼
            c.band(0.36, 0.66, '#8a2e3a', 0.016, 0.012, n=5)
            box(c.front(0.535, 0.02), (0.08, 0.02, 0.27), '#f7ecd0')
        c.buttons('#f2c230', zs=(0.56, 0.48, 0.4), r=0.014)
        c.wings('#b8743a', '#5a3a2a', sleeve='#f7ecd0', sl=0.25)
        c.birdlegs('#d9a03c', pants='#5a3a2a')
        with c.tail:               # 길고 줄무늬 진 꽁지
            pts = [Vector((0, 0.16, 0.38)), Vector((0, 0.42, 0.52)), Vector((0, 0.66, 0.74)), Vector((0, 0.84, 1.02))]
            cols = ['#c9843a', '#5a3a2a', '#c9843a']
            for i in range(3):
                tube(pts[i], pts[i + 1], 0.05 - i * 0.012, cols[i], r2=0.04 - i * 0.012, seg=6)
            ball(pts[3], 0.016, '#5a3a2a', sub=1)
        c.done()


def pongdang(name):     # 퐁당 — 개구리, 발랄함
    g, pale = '#7ccb5a', '#eaf7c8'
    with Model(name) as m:
        c = Char(m, hr=(0.43, 0.385, 0.315), hc=1.01)
        c.skull(g)
        with c.head:
            for s in (1, -1):      # 머리 위로 솟은 눈두덩
                ball((s * 0.19, -0.05, c.hc + 0.27), 0.135, g, sub=3)
        c.patch(pale, cut=0.4, aim=(0, -1, -1.6))
        c.bump((0.19, -0.05, c.hc + 0.27), (0.135, 0.135, 0.135))
        c.bump((-0.19, -0.05, c.hc + 0.27), (0.135, 0.135, 0.135))
        c.top = c.hc + 0.42
        c.eyes('big', x=0.19, z=c.hc + 0.275, size=1.0)
        c.mouth('wide', z=c.hc - 0.1, w=0.078)
        c.blush(x=0.3, z=c.hc - 0.05)
        c.torso('#ffd84a', kind='dress', hem='#f2a03c', collar='#f2a03c')
        c.dots(WHITE, r=0.02, rows=((0.4, 7, 0.0), (0.5, 6, 0.5), (0.6, 5, 0.0)))
        c.arms('#ffd84a', g, sl=0.3)
        c.legs(g, '#f2a03c')
        c.done()


def dungdung(name):     # 둥둥 — 청둥오리, 엉뚱함
    with Model(name) as m:
        c = Char(m)
        bird_head(c, '#2f8a62', '#f2c230')
        with c.head:
            torus((0, 0, NECK + 0.035), 0.2, 0.04, WHITE, seg=18, tseg=6, scale=(1, 0.92, 0.8))
        beak(c, '#f2c230', z=c.hc - 0.1, w=0.085, l=0.19, h=0.07, col2='#e0a82a', flat=True)
        c.eyes('pop', x=0.175, z=c.hc + 0.015, size=1.0)
        c.brows('#1e5a40', tilt=10, w=0.035, th=0.011, z=c.hc + 0.125, x=0.175)
        c.torso(WHITE, '#6a7a8a', hem='#3a6ab0')
        with c.body:               # 세일러 깃
            for s in (1, -1):
                ball((s * 0.09, -0.14, 0.645), 1.0, '#3a6ab0', (0.085, 0.05, 0.06), rot=(0, 0, s * 20), sub=2)
            ball((0, 0.14, 0.64), 1.0, '#3a6ab0', (0.15, 0.06, 0.07), sub=2)
            ball(c.front(0.585, 0.02), 0.03, '#e8463c', (1.3, 0.7, 0.9), sub=2)
        c.wings('#b8a890', '#3a6ab0', sleeve=WHITE, sl=0.25)
        c.birdlegs('#f29a3c', pants='#6a7a8a')
        with c.tail:
            ball((0, 0.2, 0.38), 1.0, '#6a5a4a', (0.07, 0.09, 0.05), sub=2)
            arc((0, 0.27, 0.43), 0.045, 0.016, '#2a3a3a', 0, 250, seg=8, tseg=5, rot=(90, 0, 90))
        c.done()


def sandeul(name):      # 산들 — 염소, 다정함
    fur = '#fbf5e8'
    with Model(name) as m:
        c = Char(m)
        c.skull(fur)
        c.ears_side(fur, '#f5b8b0', l=0.19, droop=24, z=c.hc + 0.12)
        with c.head:
            for s in (1, -1):      # 작은 뿔
                cone((s * 0.14, 0.06, c.hc + 0.3), 0.045, 0.17, '#cdb898', seg=8, rot=(-22, s * 12, 0))
            cone((0, -0.27, c.hc - 0.26), 0.04, 0.11, fur, seg=8, rot=(170, 0, 0))            # 턱수염
            ball((0, -0.02, c.hc + 0.32), 0.08, fur, (1.2, 1, 0.8), sub=2)
        c.top = c.hc + 0.5
        c.muzzle('#fbe6dc', w=0.125, h=0.088, d=0.085)
        c.nose('#e89a98', w=0.034, h=0.024, line=0.02, linecol='#c98a88')
        c.eyes('smile', x=0.178)
        c.mouth('smile', z=c.hc - 0.165, w=0.04, col='#c98a88')
        c.blush(x=0.285)
        c.torso('#b7a0e0', '#7a6a9a', hem='#f3ecff', collar='#f3ecff')
        with c.body:
            for z in (0.46, 0.56):
                c.band(z, z + 0.022, '#f3ecff', 0.011)
        c.emblem('flower', '#ff9fc2', z=0.61, s=0.8, x=0.085)
        c.arms('#b7a0e0', fur, sl=0.7)
        c.legs('#7a6a9a', '#5a4a6a')
        with c.tail:
            ball((0, 0.19, 0.37), 1.0, fur, (0.04, 0.06, 0.05), sub=2)
        c.done()


def dahong(name):       # 다홍 — 여우, 새침함
    fur, pale, dk = '#ee6f3c', '#fff6ea', '#3a2a28'
    with Model(name) as m:
        c = Char(m)
        c.skull(fur)
        c.ears_point(fur, pale, x=0.25, h=0.3, w=0.135, lean=20, tip=dk)
        with c.head:
            for s in (1, -1):      # 뺨의 흰 털
                cone((s * 0.36, -0.1, c.hc - 0.16), 0.085, 0.13, pale, seg=8, rot=(0, s * 105, 0), scale=(1, 0.7, 1))
                cone((s * 0.34, -0.1, c.hc - 0.09), 0.07, 0.12, pale, seg=8, rot=(0, s * 80, 0), scale=(1, 0.7, 1))
        c.patch(pale, cut=0.33, aim=(0, -1, -1.2))
        c.muzzle(pale, w=0.12, h=0.088, d=0.1)
        c.nose(dk, w=0.033, h=0.025, line=0.022)
        c.eyes('lash', x=0.176, size=0.95)
        c.mouth('smile', z=c.hc - 0.166, w=0.036)
        c.blush(x=0.3, z=c.hc - 0.08, r=0.04)
        c.torso('#8a3a6a', kind='dress', hem='#f7d8e6', collar=WHITE)
        c.buttons('#f7d8e6', zs=(0.6, 0.52), r=0.015)
        c.arms('#8a3a6a', fur, hand=dk, sl=0.55)
        c.legs(dk, '#5a2a4a')
        with c.tail:               # 탐스러운 꼬리
            ball((0, 0.3, 0.42), 1.0, fur, (0.11, 0.17, 0.11), rot=(-35, 0, 0), sub=3)
            ball((0, 0.43, 0.52), 1.0, pale, (0.085, 0.11, 0.085), rot=(-35, 0, 0), sub=2)
        c.done()


def kkokki(name):       # 꼬끼 — 수탉, 운동 좋아함
    with Model(name) as m:
        c = Char(m)
        bird_head(c, '#fffaf0', '#f2b83a')
        with c.head:
            for i, (y, z, r) in enumerate(((-0.14, 0.33, 0.075), (-0.02, 0.38, 0.09), (0.11, 0.34, 0.075))):   # 볏
                ball((0, y, c.hc + z), r, '#e8463c', (0.55, 1, 1.1), sub=2)
            for s in (1, -1):      # 턱 밑 살
                ball((s * 0.035, -0.33, c.hc - 0.2), 1.0, '#e8463c', (0.035, 0.03, 0.06), sub=2)
        c.top = c.hc + 0.5
        beak(c, '#f2b83a', w=0.062, l=0.13)
        c.eyes('oval', x=0.18, size=0.92)
        c.brows('#c0392b', tilt=-14, w=0.05, th=0.016, x=0.18, z=c.hc + 0.105)
        c.torso('#3a7ad0', '#3a4a6a', hem=WHITE, collar=WHITE)
        with c.body:               # 운동복 지퍼와 줄
            box(c.front(0.53, 0.012), (0.02, 0.016, 0.3), WHITE)
        c.wings('#fffaf0', '#fffaf0', sleeve='#3a7ad0', sl=0.5)
        c.birdlegs('#f2b83a', pants='#3a4a6a')
        with c.tail:               # 풍성한 꽁지깃
            for i, a in enumerate((-30, 0, 30)):
                arc((math.sin(math.radians(a)) * 0.05, 0.2, 0.36), 0.2, 0.035, '#2a4a4a' if i != 1 else '#3a6a5a', 80, 190, seg=8, tseg=5, rot=(90, 0, 90 + a * 0.6))
        c.done()


def dodam(name):        # 도담 — 돼지, 느긋함
    fur = '#ffc2c8'
    with Model(name) as m:
        c = Char(m)
        c.skull(fur)
        with c.head:
            for s in (1, -1):      # 앞으로 접힌 귀
                cone((s * 0.25, -0.02, c.hc + 0.24), 0.11, 0.17, '#f7a3ae', seg=8, rot=(35, s * 30, 0), scale=(1, 0.5, 1))
            cyl((0, -0.345, c.hc - 0.1), 0.085, 0.06, '#f7a3ae', seg=14, rot=(90, 0, 0), scale=(1.15, 1, 0.85))   # 코
            for s in (1, -1):
                ball((s * 0.03, -0.408, c.hc - 0.1), 1.0, '#c96a7a', (0.014, 0.008, 0.022), sub=1)
        c.top = c.hc + 0.42
        c.eyes('sleepy', x=0.185, lid=fur, z=c.hc + 0.01)
        c.mouth('smile', z=c.hc - 0.205, w=0.045, col='#b85a6a')
        c.blush(x=0.29, z=c.hc - 0.11, col='#ff8a9a')
        c.torso('#fff3d6', '#6aa35a', collar='#fff3d6')
        with c.body:               # 풀색 멜빵바지
            box(c.front(0.47, 0.012), (0.2, 0.02, 0.17), '#6aa35a', bevel=0.008)
            for s in (1, -1):
                tube(c.front(0.55, 0.014, s * 0.08), (s * 0.115, -0.05, 0.69), 0.02, '#6aa35a', seg=6)
                tube((s * 0.115, -0.05, 0.69), (s * 0.1, 0.13, 0.6), 0.02, '#6aa35a', seg=6)
                ball(c.front(0.54, 0.024, s * 0.078), 0.02, '#ffd84a', (1, 0.6, 1), sub=1)
        c.emblem('acorn', '#f2c06a', z=0.455, s=0.8)
        c.arms('#fff3d6', fur, sl=0.3)
        c.legs('#6aa35a', '#8a5a3a')
        with c.tail:
            torus((0, 0.22, 0.4), 0.035, 0.016, '#f7a3ae', seg=8, tseg=5, rot=(0, 90, 0))
        c.done()


def pogeun(name):       # 포근 — 얼굴이 검은 양, 수줍음
    face, wool = '#4a4048', '#fbf4e4'
    with Model(name) as m:
        c = Char(m)
        c.skull(face)
        c.ears_side(face, '#7a6a70', l=0.17, droop=16, z=c.hc + 0.02, x=0.37)
        with c.head:               # 몽실몽실한 털
            n = 9
            for i in range(n):
                a = math.pi * (i / (n - 1))
                ball((math.cos(a) * 0.32, -0.06, c.hc + 0.12 + math.sin(a) * 0.24), 0.125, wool, sub=2)
            for (x, y, z, r) in ((0, 0.08, 0.3, 0.2), (0.2, 0.14, 0.2, 0.19), (-0.2, 0.14, 0.2, 0.19), (0, 0.22, 0.08, 0.24), (0.24, 0.16, -0.02, 0.18), (-0.24, 0.16, -0.02, 0.18), (0, -0.1, 0.34, 0.15)):
                ball((x, y, c.hc + z), r, wool, sub=2)
        c.top = c.hc + 0.5
        c.eyes('oval', x=0.165, iris='#e6c07a', size=1.0, z=c.hc - 0.045)
        c.nose('#f0a0a8', w=0.034, h=0.022, z=c.hc - 0.135, line=0.02, linecol='#f0c0c8')
        c.mouth('smile', z=c.hc - 0.19, w=0.036, col='#f0c0c8')
        c.blush(x=0.26, z=c.hc - 0.13, col='#e8707e', r=0.042)
        c.torso('#9fd8c8', '#fbf4e4', hem=WHITE)
        with c.body:               # 분홍 목도리
            torus((0, 0, 0.675), 0.15, 0.05, '#ff9fc2', seg=16, tseg=6, scale=(1, 0.92, 0.75))
            box((0.1, -0.16, 0.56), (0.07, 0.035, 0.17), '#ff9fc2', rot=(0, -8, 0), bevel=0.01)
        c.buttons(WHITE, zs=(0.5, 0.42), r=0.015)
        c.arms('#9fd8c8', face, sl=0.6)
        c.legs(face, '#3a3238')
        with c.tail:
            ball((0, 0.21, 0.38), 0.07, wool, sub=2)
        c.done()


# ============================================================ 가게·박물관·마을회관 사람들
def kkami(name):        # 까미 — 까치 (만물상)
    bk, bl = '#33303c', '#3a5a9a'
    with Model(name) as m:
        c = Char(m)
        bird_head(c, bk, bk)
        beak(c, '#6a6672', w=0.062, l=0.15, col2='#56525e')
        c.eyes('oval', x=0.18, white=True, size=0.95)
        c.brows('#6a8ad0', tilt=8, w=0.04, th=0.011, x=0.18, z=c.hc + 0.12)
        c.blush(x=0.3, col='#c97a8a', r=0.04)
        c.torso(WHITE, bk)
        with c.body:               # 주황 앞치마
            p = c.front(0.47, 0.014)
            box(p, (0.25, 0.022, 0.25), '#f29a3c', bevel=0.01)
            box(c.front(0.62, 0.014), (0.13, 0.02, 0.07), '#f29a3c', bevel=0.006)
            for s in (1, -1):
                tube(c.front(0.64, 0.012, s * 0.055), (s * 0.1, 0.02, 0.705), 0.014, '#d9802a', seg=5)
            c.band(0.385, 0.41, '#d9802a', 0.014)
        c.emblem('acorn', '#fff3d6', z=0.47, s=1.0, col2='#8a5a34')
        c.wings(bk, bl, sleeve=None)
        with c.armL:
            ball((0.27, 0.0, 0.52), 1.0, WHITE, (0.045, 0.08, 0.075), rot=(0, 23, 0), sub=2)
        with c.armR:
            ball((-0.27, 0.0, 0.52), 1.0, WHITE, (0.045, 0.08, 0.075), rot=(0, -23, 0), sub=2)
        c.birdlegs('#4a4650', pants=bk)
        with c.tail:
            tube((0, 0.16, 0.38), (0, 0.62, 0.62), 0.05, bl, r2=0.03, seg=6)
            tube((0, 0.16, 0.38), (0, 0.5, 0.52), 0.06, bk, r2=0.04, seg=6)
        c.done()


def duru(name):         # 두루 선생 — 두루미 (박물관)
    with Model(name) as m:
        c = Char(m, hc=1.11, hr=(0.37, 0.35, 0.325))
        with c.head:               # 긴 목
            cyl((0, 0, NECK - 0.02), 0.085, 0.2, '#3a363c', seg=12)
        bird_head(c, '#fffdf6', '#8a9a7a')
        with c.head:
            c.fit(dome((0, 0.0, c.hc), 1.0, '#e8463c', (c.hr[0] + 0.006, c.hr[1] + 0.006, c.hr[2] + 0.006), aim=(-14, 0, 0), seg=20, rings=5, cut=0.24))   # 붉은 정수리
            ball((0, 0.1, c.hc - 0.12), 1.0, '#3a363c', (0.3, 0.26, 0.2), sub=2)                                          # 검은 뒷목
        beak(c, '#9aa88a', w=0.052, l=0.21, z=c.hc - 0.08, col2='#8a987a')
        c.eyes('dot', x=0.15, z=c.hc + 0.005, size=1.0)
        with c.head:               # 동그란 안경
            for s in (1, -1):
                p, rot = c.hp(s * 0.15, c.hc + 0.005, 0.02)
                torus(tuple(p), 0.085, 0.011, '#8a6a3a', seg=14, tseg=5, rot=(90 + rot[0], 0, rot[2]))
            p, _ = c.hp(0, c.hc + 0.01, 0.03)
            tube((-0.065, p.y, p.z), (0.065, p.y, p.z), 0.009, '#8a6a3a', seg=5)
        c.brows('#6a6a70', tilt=12, w=0.036, th=0.01, x=0.15, z=c.hc + 0.115)
        c.torso('#f7f0dc', '#5a4a3a', collar='#f7f0dc')
        with c.body:               # 갈색 조끼와 나비넥타이
            c.band(0.36, 0.66, '#8a6a4a', 0.016, 0.012, n=5)
            box(c.front(0.535, 0.02), (0.075, 0.02, 0.27), '#f7f0dc')
            for s in (1, -1):
                cone((s * 0.005, c.front(0.655, 0.03)[1], 0.655), 0.035, 0.06, '#c0392b', seg=6, rot=(0, s * 90, 0), scale=(1, 0.5, 1))
            ball(c.front(0.655, 0.035), 0.016, '#a02a20', sub=1)
        c.buttons('#f2e2a8', zs=(0.53, 0.44), r=0.014)
        c.wings('#fffdf6', '#3a363c', sleeve='#f7f0dc', sl=0.3)
        c.birdlegs('#5a5650', pants='#5a4a3a')
        with c.tail:
            ball((0, 0.21, 0.4), 1.0, '#3a363c', (0.09, 0.11, 0.08), rot=(-30, 0, 0), sub=2)
        c.done()


def ujik(name):         # 우직 이장 — 황소 (마을회관)
    fur, pale = '#b8763e', '#f7dcc0'
    with Model(name) as m:
        c = Char(m)
        c.skull(fur)
        c.ears_side(fur, '#e8b0a0', l=0.17, droop=10, z=c.hc + 0.1, x=0.36)
        with c.head:               # 뿔
            for s in (1, -1):
                arc((s * 0.25, 0.02, c.hc + 0.26), 0.11, 0.036, '#f5ead0', 0 if s > 0 else 90, 90 if s > 0 else 180, seg=6, tseg=6, rot=(90, 0, 0))
                p = (s * 0.25, 0.02, c.hc + 0.37)
                cone(p, 0.036, 0.07, '#f5ead0', seg=6, rot=(0, -s * 90, 0))
        c.muzzle(pale, w=0.2, h=0.115, d=0.1, z=c.hc - 0.14)
        with c.head:
            for s in (1, -1):
                p, rot = c.hp(s * 0.06, c.hc - 0.11, 0.004)
                ball(tuple(p), 1.0, '#a86a5a', (0.02, 0.01, 0.014), rot=rot, sub=1)
        c.eyes('oval', x=0.185, size=0.92, z=c.hc + 0.0)
        c.brows('#6a3e1e', tilt=-4, w=0.06, th=0.022, x=0.185, z=c.hc + 0.125)
        c.mouth('smile', z=c.hc - 0.2, w=0.055, col='#8a5040')
        with c.head:               # 밀짚모자
            lathe([(0.37, 0.0), (0.375, 0.012), (0.2, 0.035), (0.185, 0.13), (0.14, 0.17), (0.0, 0.18)], '#ecd28a', center=(0, 0.03, c.hc + 0.3), seg=18, rot=(-8, 0, 0))
            lathe([(0.2, 0.04), (0.197, 0.075)], '#c0392b', center=(0, 0.03, c.hc + 0.3), seg=18, rot=(-8, 0, 0), caps=False)
        c.top = c.hc + 0.5
        c.torso('#fff6e2', '#5a6a4a', collar='#fff6e2')
        with c.body:               # 이장님 조끼
            c.band(0.35, 0.67, '#5f8a4a', 0.018, 0.012, n=5)
            box(c.front(0.535, 0.02), (0.09, 0.02, 0.27), '#fff6e2')
            box(c.front(0.47, 0.026, 0.12), (0.07, 0.016, 0.06), '#4f7a3e', bevel=0.004)
        c.emblem('acorn', '#f2c06a', z=0.585, s=0.7, x=-0.11)
        c.arms('#fff6e2', fur, sl=0.5)
        c.legs('#5a6a4a', '#4a3a2a')
        with c.tail:
            tube((0, 0.17, 0.38), (0, 0.28, 0.24), 0.018, fur, seg=5)
            ball((0, 0.29, 0.22), 0.04, '#5a3a1e', (1, 1, 1.4), sub=2)
        c.done()


# ============================================================ 플레이어(사람 아이)
NOSE = {'#ffdcc0': '#f0b090', '#f5cba8': '#e0a482', '#e8b890': '#d09a70'}     # 살빛에 맞춘 코 색


def kid(name, skin, hair, top, bottom, style):
    with Model(name) as m:
        c = Char(m)
        c.skull(skin)
        with c.head:               # 귀
            for s in (1, -1):
                ball((s * 0.4, 0.02, c.hc - 0.03), 1.0, skin, (0.045, 0.05, 0.06), sub=2)
        c.eyes('oval', x=0.175, size=1.02)
        c.brows(hair, tilt=6, w=0.04, th=0.011, x=0.175, z=c.hc + 0.11)
        with c.head:               # 작고 동그란 코
            c.dot(0, c.hc - 0.095, NOSE.get(skin, '#e8a888'), 0.02, 0.015, thick=0.012, out=0.004)
        c.mouth('smile', z=c.hc - 0.158, w=0.045)
        c.blush(x=0.285, z=c.hc - 0.125)
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
        c.done()


ALL = {}
for _n, _f in (('dalgom', dalgom), ('goran', goran), ('nureong', nureong), ('beomi', beomi), ('jangkki', jangkki), ('pongdang', pongdang),
               ('dungdung', dungdung), ('sandeul', sandeul), ('dahong', dahong), ('kkokki', kkokki), ('dodam', dodam), ('pogeun', pogeun)):
    ALL['villager_' + _n] = _f
for _n, _f in (('kkami', kkami), ('duru', duru), ('ujik', ujik)):
    ALL['npc_' + _n] = _f
ALL['player_1'] = lambda n: kid(n, '#ffdcc0', '#6a4530', '#e8574c', '#40598f', 'bob')
ALL['player_2'] = lambda n: kid(n, '#f5cba8', '#2e2a36', '#4a90d9', '#7a6a52', 'spiky')
ALL['player_3'] = lambda n: kid(n, '#ffdcc0', '#b8682e', '#ffd04a', '#5fae62', 'pony')
ALL['player_4'] = lambda n: kid(n, '#e8b890', '#3a2a22', '#6fb86a', '#4f7fc0', 'cap')
