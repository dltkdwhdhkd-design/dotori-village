"""위에서 본 그림을 그려 입히는 생물의 공통 틀(곤충, 게, 거북, 가오리 등).

머리가 -Y(앞), 바닥이 Z=0. 종마다 '위에서 본 그림' 한 장을 그리고(Pillow),
같은 윤곽으로 만든 3D 덩어리에 그 그림을 위에서 비춰 입힌다(평면 투영).
그래서 그림에 그린 무늬가 모델의 같은 자리에 그대로 나타난다.

  T = Top(m, name, 반폭, 앞, 뒤)        그림판을 연다(모델 좌표: x 좌우, y 앞뒤)
  T.shell(y0, y1, 윤곽, 높이, W, H, 색)  볼록한 덩어리를 만들고 같은 윤곽을 그림에도 칠한다
  T.poly / T.ell / T.line                 그림에 무늬를 그린다
  T.finish()                              그림을 재질에 넣고 마친다
"""
import math
import random
from lib import *
from paint import *


# ----------------------------------------------------------------- 윤곽 함수(t: 앞 0 → 뒤 1, 값 0~1)
def sup(p=2.0, skew=1.0):
    """타원(p=2)에서 네모(p가 클수록)까지. skew<1이면 가장 넓은 곳이 앞으로 간다."""
    def f(t):
        u = abs(2 * (t ** skew) - 1)
        return max(0.0, 1 - u ** p) ** (1 / p)
    return f


def ely(front=0.12, rear=0.55, p=2.0, fw=0.75):
    """딱지날개 윤곽: 어깨(fw)에서 시작해 곧 최대 폭이 되고, rear부터 뒤로 둥글게 좁아진다."""
    def f(t):
        if t < front:
            return fw + (1 - fw) * math.sin(math.pi / 2 * t / front)
        if t < rear:
            return 1.0
        u = (t - rear) / (1 - rear)
        return max(0.0, 1 - u ** p) ** (1 / p)
    return f


def via(pts):
    """(t, 값) 점들을 부드럽게 잇는 함수"""
    pts = sorted(pts)
    def f(t):
        if t <= pts[0][0]:
            return pts[0][1]
        for (t0, v0), (t1, v1) in zip(pts, pts[1:]):
            if t <= t1:
                u = (t - t0) / max(1e-6, t1 - t0)
                u = u * u * (3 - 2 * u)
                return v0 + (v1 - v0) * u
        return pts[-1][1]
    return f


def const(v=1.0):
    return lambda t: v


def chain(pts, r, col, r2=None, seg=4):
    """점들을 차례로 잇는 가는 관(다리, 더듬이). r에서 r2로 가늘어진다."""
    n = len(pts) - 1
    r2 = r if r2 is None else r2
    for i in range(n):
        a, b = r + (r2 - r) * i / n, r + (r2 - r) * (i + 1) / n
        tube(pts[i], pts[i + 1], a, col, r2=b, seg=seg)


class Top:
    def __init__(self, m, name, hw, front, back, px=160, bg='#808080', wing=None, z0=0.03):
        self.m, self.name, self.z0 = m, name, z0
        self.cv = Canvas(-hw, hw, -back, front, px=px, bg=bg)
        self.mat = 'tx_' + name
        self._mat = tex_material(self.mat)
        register_mat(self.mat, self._mat)
        self.wcv = None
        if wing:                                   # 비치는 날개용 그림판 (반폭, 앞, 뒤, [px])
            self.wcv = Canvas(-wing[0], wing[0], -wing[2], wing[1], px=wing[3] if len(wing) > 3 else px, bg='#ffffff', alpha=True)
            self.wmat = 'txa_' + name
            self._wmat = tex_material(self.wmat, alpha=True)
            register_mat(self.wmat, self._wmat)
        self.on()

    def on(self, wing=False):
        cv = self.wcv if wing else self.cv
        set_proj(lambda co: cv.uv(co.x, -co.y))

    def off(self):
        set_proj(None)

    def finish(self):
        self.off()
        tex_image(self._mat, self.cv.finish())
        if self.wcv:
            tex_image(self._wmat, self.wcv.finish())

    # --- 그리기 (모델 좌표: y는 꼬리 쪽이 +)
    def poly(self, pts, col, cv=None, a=255):
        (cv or self.cv).poly([(x, -y) for x, y in pts], col, a=a)

    def ell(self, c, r, col, cv=None, a=255):
        (cv or self.cv).ellipse((c[0], -c[1]), r, col, a=a)

    def line(self, pts, w, col, cv=None, a=255):
        (cv or self.cv).line([(x, -y) for x, y in pts], w, col, a=a)

    def both(self, fn):
        for s in (1, -1):
            fn(s)

    def spots(self, pts, col, r=None):
        """[(x, y, r)] 좌우 대칭으로 점을 찍는다"""
        for q in pts:
            for s in (1, -1):
                self.ell((s * q[0], q[1]), (q[2] if len(q) > 2 else r,) * 2, col)

    def mask_poly(self, pts):
        m = self.cv.mask()
        ImageDraw.Draw(m).polygon(self.cv.P([(x, -y) for x, y in pts]), fill=255)
        return m

    def blotch(self, col, scale, th, region=None, alpha=1.0, seed=3):
        """얼룩무늬. region(점 목록)을 주면 그 안에만."""
        nm = self.cv.noise_mask(scale, th, seed=seed)
        if region:
            nm = ImageChops.multiply(nm, self.mask_poly(region))
        self.cv.fill_mask(col, nm, alpha)

    def speck(self, col, n, r, region, seed=5):
        """region(x0, x1, y0, y1) 안에 자잘한 점을 뿌린다"""
        rnd = random.Random(seed)
        for _ in range(n):
            self.ell((rnd.uniform(region[0], region[1]), rnd.uniform(region[2], region[3])), (r * rnd.uniform(0.6, 1.3),) * 2, col)

    # --- 3D
    def shell(self, y0, y1, wf, hf, W, H, col=None, z0=None, n=10, seg=8, px=2.0, mat=None, x0=0.0):
        """위에서 본 윤곽이 wf(t)*W/2, 높이가 hf(t)*H 인 볼록한 덩어리(t: 앞 0 → 뒤 1). 단면은 반타원."""
        z0 = self.z0 if z0 is None else z0
        ts = [i / n for i in range(n + 1)]
        if col is not None:
            R = [(x0 + wf(t) * W / 2, y0 + (y1 - y0) * t) for t in ts]
            L = [(x0 - wf(t) * W / 2, y0 + (y1 - y0) * t) for t in ts]
            self.poly(R + list(reversed(L)), col)
        V, F = [], []
        for t in ts:
            w, h, y = max(1e-4, wf(t) * W / 2), max(1e-4, hf(t) * H), y0 + (y1 - y0) * t
            for j in range(seg + 1):
                a = -math.pi / 2 + math.pi * j / seg
                V.append((x0 + w * math.sin(a), y, z0 + h * abs(math.cos(a)) ** (2.0 / px)))
        k = seg + 1
        for i in range(n):
            for j in range(seg):
                F.append((i * k + j, (i + 1) * k + j, (i + 1) * k + j + 1, i * k + j + 1))
            F.append((i * k + seg, (i + 1) * k + seg, (i + 1) * k, i * k))
        F.append(tuple(range(0, k)))
        F.append(tuple(reversed(range(n * k, n * k + k))))
        cv = self.cv
        faces = mesh_uv(V, F, mat or self.mat, [cv.uv(x, -y) for x, y, z in V])
        fix_normals(faces)
        return faces

    def plate(self, pts, z, mat=None, cv=None):
        """평평한 판(날개, 지느러미). pts는 (x, y) 윤곽."""
        cv = cv or self.cv
        return mesh_uv([(x, y, z) for x, y in pts], [tuple(range(len(pts)))], mat or self.mat, [cv.uv(x, -y) for x, y in pts], smooth=False)

    def blob(self, c, r, col=None, sub=2):
        """타원체. col을 주면 그림에도 같은 자리에 칠한다(좌우 대칭이 필요하면 both와 함께)."""
        if col is not None:
            self.ell((c[0], c[1]), (r[0], r[1]), col)
        return ball(c, 1.0, self.mat, r, sub=sub)

    def legs(self, col, pairs, r=0.006):
        """pairs: [(붙는 곳 (x, y, z), 무릎 (x, y, z), 발 (x, y))] — 오른쪽 것만 주면 좌우에 만든다"""
        for (a, b, c) in pairs:
            for s in (1, -1):
                chain([(s * a[0], a[1], a[2]), (s * b[0], b[1], b[2]), (s * c[0], c[1], 0.0)], r, col, r2=r * 0.55)

    def legs6(self, col, ys, x0, reach, zk, r=0.006, z=None, fan=0.5):
        z = self.z0 + 0.012 if z is None else z
        self.legs(col, [((x0, y, z), (x0 + reach * 0.5, y + (i - 1) * reach * fan * 0.5, zk), (x0 + reach, y + (i - 1) * reach * fan)) for i, y in enumerate(ys)], r)

    def feelers(self, col, base, pts, r=0.004, tip=None):
        """더듬이: base(x, y, z)에서 pts(상대 위치들)를 차례로 잇는다. tip을 주면 끝에 곤봉."""
        for s in (1, -1):
            P = [(s * base[0], base[1], base[2])] + [(s * (base[0] + q[0]), base[1] + q[1], base[2] + q[2]) for q in pts]
            chain(P, r, col, r2=r * 0.6)
            if tip:
                ball(P[-1], tip, col, sub=1)


# ============================================================================ 물속 생물(위에서 본 모습이 특징인 것들)
def crab(m, name, k):
    """게: kind 'blue'(꽃게) | 'mitten'(참게)"""
    L = k.get('len', 0.5)                         # 등딱지 너비
    blue = k.get('kind', 'blue') == 'blue'
    D = L * (0.52 if blue else 0.8)               # 등딱지 앞뒤 길이
    T = Top(m, name, L * 0.95, L * 0.7, L * 0.62, px=192, bg=k['col'], z0=L * 0.07)
    col, c2 = k['col'], k.get('col2', shade(k['col'], 0.75))
    claw = k.get('claw', col)
    if blue:
        wf = via([(0, 0.5), (0.22, 0.86), (0.36, 1.0), (0.42, 0.8), (0.8, 0.5), (1, 0.3)])
    else:
        wf = via([(0, 0.62), (0.2, 0.92), (0.45, 1.0), (0.8, 0.9), (1, 0.55)])
    T.shell(-D * 0.5, D * 0.5, wf, via([(0, 0.3), (0.4, 1), (1, 0.5)]), L, L * 0.2, col, n=10)
    if blue:                                      # 옆으로 길게 뻗은 가시
        for s in (1, -1):
            T.poly([(s * L * 0.42, -D * 0.2), (s * L * 0.62, -D * 0.1), (s * L * 0.42, -D * 0.04)], col)
            mesh_uv([(s * L * 0.42, -D * 0.2, T.z0 + L * 0.06), (s * L * 0.62, -D * 0.1, T.z0 + L * 0.04), (s * L * 0.42, -D * 0.04, T.z0 + L * 0.06), (s * L * 0.42, -D * 0.12, T.z0)],
                    [(0, 1, 2), (0, 3, 1), (3, 2, 1)], T.mat, [T.cv.uv(s * L * 0.5, D * 0.12)] * 4, smooth=False)
        T.spots([(L * 0.1, -D * 0.1, L * 0.022), (L * 0.2, 0.0, L * 0.025), (L * 0.08, D * 0.12, L * 0.02), (L * 0.28, -D * 0.12, L * 0.018), (L * 0.17, D * 0.2, L * 0.016)], k.get('spot', '#f3ecd6'))
        T.line([(-L * 0.12, D * 0.02), (0, D * 0.1), (L * 0.12, D * 0.02)], L * 0.012, c2)
    else:
        T.blotch(c2, L * 0.12, 0.55, alpha=0.6)
        T.line([(-L * 0.1, -D * 0.05), (0, D * 0.06), (L * 0.1, -D * 0.05)], L * 0.012, c2)
        T.line([(0, D * 0.06), (0, D * 0.3)], L * 0.012, c2)
    for s in (1, -1):                             # 앞 가장자리의 톱니
        for i in range(3):
            T.ell((s * (L * 0.12 + i * L * 0.07), -D * 0.47 + i * D * 0.05), (L * 0.012, L * 0.012), shade(col, 1.25))
    T.off()
    z = T.z0
    for s in (1, -1):                             # 눈자루와 눈
        tube((s * L * 0.09, -D * 0.46, z + L * 0.08), (s * L * 0.1, -D * 0.56, z + L * 0.14), L * 0.012, col, seg=4)
        ball((s * L * 0.1, -D * 0.57, z + L * 0.15), L * 0.022, '#1a1a1a', sub=1)
        # 집게다리
        chain([(s * L * 0.3, -D * 0.34, z + L * 0.06), (s * L * 0.5, -D * 0.62, z + L * 0.09), (s * L * 0.34, -D * 0.92, z + L * 0.08)], L * (0.045 if blue else 0.05), claw, r2=L * 0.04, seg=6)
        hand = (s * L * 0.3, -D * 1.0, z + L * 0.08)
        ball(hand, 1.0, k.get('mitt', claw), (L * (0.075 if blue else 0.1), L * 0.09, L * 0.06), sub=2)
        tip = k.get('tip', '#f3ecd6')
        tube((s * L * 0.3, -D * 1.02, z + L * 0.1), (s * L * 0.14, -D * 1.22, z + L * 0.08), L * 0.03, tip, r2=0.004, seg=5)
        tube((s * L * 0.3, -D * 1.02, z + L * 0.05), (s * L * 0.16, -D * 1.18, z + L * 0.04), L * 0.024, tip, r2=0.004, seg=5)
        # 걷는 다리 네 쌍
        for i in range(4):
            y = -D * 0.1 + i * D * 0.17
            a = math.radians(-18 + i * 22)
            kx, ky = s * (L * 0.5 + L * 0.2 * math.cos(a)), y + L * 0.2 * math.sin(a)
            fx, fy = s * (L * 0.5 + L * 0.42 * math.cos(a)), y + L * 0.42 * math.sin(a)
            if blue and i == 3:                   # 꽃게의 헤엄다리(노처럼 납작하다)
                tube((s * L * 0.4, y, z + L * 0.05), (kx * 0.92, ky + L * 0.06, z + L * 0.06), L * 0.022, col, seg=5)
                ball((kx * 0.98, ky + L * 0.15, z + L * 0.05), 1.0, c2, (L * 0.055, L * 0.09, L * 0.012), sub=2)
            else:
                chain([(s * L * 0.42, y, z + L * 0.05), (kx, ky, z + L * 0.14), (fx, fy, 0.0)], L * 0.022, col, r2=L * 0.008, seg=5)
    T.finish()


def crayfish(m, name, k):
    L = k.get('len', 0.5)
    col, c2 = k['col'], shade(k['col'], 0.72)
    T = Top(m, name, L * 0.55, L * 0.78, L * 0.56, px=176, bg=col, z0=L * 0.04)
    T.shell(-L * 0.3, L * 0.06, via([(0, 0.25), (0.3, 0.8), (0.7, 1), (1, 0.85)]), via([(0, 0.4), (0.5, 1), (1, 0.9)]), L * 0.26, L * 0.2, col, n=8)
    T.line([(-L * 0.1, -L * 0.06), (0, -L * 0.03), (L * 0.1, -L * 0.06)], L * 0.012, c2)      # 목 홈
    T.line([(0, -L * 0.03), (0, L * 0.05)], L * 0.008, c2)
    for i in range(5):                            # 배마디
        y0 = L * 0.05 + i * L * 0.075
        w = L * (0.22 - i * 0.012)
        T.shell(y0, y0 + L * 0.085, sup(3.0), const(1.0), w, L * (0.15 - i * 0.012), mix(col, c2, 0.25 if i % 2 else 0.0), n=3, seg=6)
        T.line([(-w * 0.45, y0 + L * 0.078), (w * 0.45, y0 + L * 0.078)], L * 0.008, c2)
    fan = [(-L * 0.17, L * 0.5), (-L * 0.1, L * 0.56), (0, L * 0.57), (L * 0.1, L * 0.56), (L * 0.17, L * 0.5), (L * 0.07, L * 0.42), (-L * 0.07, L * 0.42)]
    T.poly(fan, shade(col, 0.9))
    for x in (-0.09, -0.03, 0.03, 0.09):
        T.line([(x * L * 0.6, L * 0.43), (x * L, L * 0.56)], L * 0.008, c2)
    T.plate(fan, T.z0 + L * 0.03)
    T.off()
    z = T.z0
    for s in (1, -1):
        ball((s * L * 0.05, -L * 0.27, z + L * 0.12), L * 0.02, '#1a1a1a', sub=1)
        chain([(s * L * 0.03, -L * 0.3, z + L * 0.08), (s * L * 0.2, -L * 0.5, z + L * 0.12), (s * L * 0.42, -L * 0.3, z + L * 0.02)], L * 0.008, c2, r2=L * 0.003)      # 긴 더듬이
        chain([(s * L * 0.1, -L * 0.2, z + L * 0.06), (s * L * 0.26, -L * 0.36, z + L * 0.08), (s * L * 0.2, -L * 0.52, z + L * 0.07)], L * 0.035, col, r2=L * 0.04, seg=6)
        ball((s * L * 0.19, -L * 0.6, z + L * 0.07), 1.0, col, (L * 0.075, L * 0.11, L * 0.05), sub=2)        # 집게
        tube((s * L * 0.22, -L * 0.66, z + L * 0.07), (s * L * 0.2, -L * 0.8, z + L * 0.06), L * 0.03, k.get('tip', shade(col, 1.25)), r2=0.004, seg=5)
        tube((s * L * 0.15, -L * 0.66, z + L * 0.07), (s * L * 0.15, -L * 0.78, z + L * 0.06), L * 0.022, k.get('tip', shade(col, 1.25)), r2=0.004, seg=5)
        for i in range(4):
            y = -L * 0.14 + i * L * 0.055
            chain([(s * L * 0.1, y, z + L * 0.04), (s * L * 0.24, y - L * 0.03 + i * L * 0.03, z + L * 0.08), (s * L * 0.32, y - L * 0.06 + i * L * 0.05, 0)], L * 0.012, c2, r2=L * 0.006)
    T.finish()


def turtle(m, name, k):
    """거북: kind 'soft'(자라) | 'sea'(바다거북)"""
    L = k.get('len', 0.6)
    sea = k.get('kind') == 'sea'
    col, c2, skin = k['col'], k.get('col2', shade(k['col'], 0.7)), k.get('skin', shade(k['col'], 1.15))
    W = L * (0.56 if sea else 0.6)
    T = Top(m, name, L * 0.62, L * 0.62, L * 0.6, px=192, bg=skin, z0=L * 0.03)
    S0, S1 = -L * 0.32, L * 0.36                  # 등딱지 앞뒤
    cv = T.cv
    # 다리(등딱지 아래에 깔리도록 먼저)
    if sea:
        for s in (1, -1):                         # 앞지느러미발은 길고 뒤로 휘었다
            fl = [(s * W * 0.34, -L * 0.2), (s * W * 0.9, -L * 0.34), (s * W * 1.06, -L * 0.2), (s * W * 0.98, L * 0.04), (s * W * 0.84, L * 0.12), (s * W * 0.8, -L * 0.08), (s * W * 0.4, -L * 0.06)]
            T.poly(fl, skin)
            for (ux, uy) in ((0.6, -0.2), (0.78, -0.24), (0.9, -0.12), (0.88, 0.02), (0.7, -0.14)):
                T.ell((s * W * ux, L * uy), (L * 0.022, L * 0.022), c2)
            T.plate(fl, T.z0 + L * 0.03)
            hf = [(s * W * 0.3, L * 0.26), (s * W * 0.58, L * 0.38), (s * W * 0.5, L * 0.52), (s * W * 0.3, L * 0.46), (s * W * 0.2, L * 0.34)]
            T.poly(hf, skin)
            T.ell((s * W * 0.42, L * 0.42), (L * 0.022, L * 0.022), c2)
            T.plate(hf, T.z0 + L * 0.025)
    else:
        for s in (1, -1):
            for (cx, cy) in ((0.5, -0.22), (0.48, 0.3)):
                T.blob((s * W * cx, L * cy, T.z0 + L * 0.02), (L * 0.09, L * 0.075, L * 0.025), skin)
                for i in range(3):
                    T.line([(s * W * cx + s * L * 0.04, L * cy + (i - 1) * L * 0.035), (s * W * cx + s * L * 0.1, L * cy + (i - 1) * L * 0.05)], L * 0.012, shade(skin, 0.8))
    # 머리와 목
    T.shell(-L * (0.6 if not sea else 0.56), -L * 0.28, via([(0, 0.3), (0.3, 1.0), (0.6, 0.85), (1, 0.7)]) if sea else via([(0, 0.12), (0.2, 0.55), (0.45, 1.0), (0.75, 0.7), (1, 0.62)]), via([(0, 0.4), (0.35, 1), (1, 0.7)]), L * (0.17 if sea else 0.15), L * 0.11, skin, z0=T.z0 + L * 0.03, n=8, seg=6)
    if sea:
        for (ux, uy) in ((0, -0.5), (0.03, -0.44), (0.0, -0.4), (0.045, -0.37)):
            for s in (1, -1):
                T.ell((s * L * ux, L * uy), (L * 0.02, L * 0.022), c2)
    for s in (1, -1):
        T.ell((s * L * (0.055 if sea else 0.035), -L * (0.47 if sea else 0.46)), (L * 0.016, L * 0.016), '#1a1a1a')
    # 등딱지
    wf = via([(0, 0.5), (0.2, 0.9), (0.42, 1.0), (0.75, 0.82), (1, 0.2)]) if sea else sup(2.3, 0.92)
    T.shell(S0, S1, wf, via([(0, 0.3), (0.45, 1), (1, 0.3)]), W, L * (0.16 if sea else 0.11), k.get('rim', c2) if sea else k.get('rim', shade(col, 1.2)), z0=T.z0 + L * 0.03, n=12, seg=8)
    ts = [i / 20 for i in range(21)]
    inner = [(wf(t) * W * 0.5 * 0.86, S0 + (S1 - S0) * (0.04 + 0.92 * t)) for t in ts]
    T.poly(inner + [(-x, y) for x, y in reversed(inner)], col)
    if sea:                                       # 등판 무늬: 가운데 5장, 양옆 4장씩
        ys = [S0 + (S1 - S0) * f for f in (0.05, 0.22, 0.42, 0.62, 0.8, 0.95)]
        for i in range(5):
            w0, w1 = W * 0.13, W * 0.13
            hexa = [(-w0, ys[i] + L * 0.01), (0, ys[i]), (w0, ys[i] + L * 0.01), (w1, ys[i + 1] - L * 0.01), (0, ys[i + 1]), (-w1, ys[i + 1] - L * 0.01)]
            T.poly(hexa, mix(col, c2, 0.0))
            T.line(hexa + [hexa[0]], L * 0.012, c2)
            for a in range(6):
                T.line([(0, (ys[i] + ys[i + 1]) / 2), ((hexa[a][0]) * 0.8, (ys[i] + ys[i + 1]) / 2 + (hexa[a][1] - (ys[i] + ys[i + 1]) / 2) * 0.8)], L * 0.006, mix(col, k.get('ray', '#e8c070'), 0.7))
            if i < 4:
                for s in (1, -1):
                    yy = (ys[i] + ys[i + 1]) / 2 + (S1 - S0) * 0.09
                    T.line([(s * w0, ys[i + 1] - L * 0.01), (s * wf(0.1 + 0.2 * (i + 1)) * W * 0.43, yy)], L * 0.012, c2)
                    for a in range(4):
                        T.line([(s * W * 0.26, yy - (S1 - S0) * 0.1), (s * W * (0.18 + a * 0.06), yy - (S1 - S0) * 0.1 + (a - 1.5) * L * 0.04)], L * 0.006, mix(col, k.get('ray', '#e8c070'), 0.7))
    else:
        T.speck(shade(col, 0.82), 40, L * 0.012, (-W * 0.36, W * 0.36, S0 + L * 0.06, S1 - L * 0.06))
        T.line([(0, S0 + L * 0.06), (0, S1 - L * 0.08)], L * 0.008, shade(col, 0.85))
    if not sea:                                   # 자라의 대롱 같은 코, 짧은 꼬리
        T.off()
        tube((0, -L * 0.58, T.z0 + L * 0.07), (0, -L * 0.66, T.z0 + L * 0.065), L * 0.012, skin, r2=L * 0.008, seg=5)
        tube((0, S1 - L * 0.02, T.z0 + L * 0.03), (0, S1 + L * 0.08, T.z0 + L * 0.02), L * 0.02, skin, r2=0.003, seg=5)
    T.finish()


def ray(m, name, k):
    L = k.get('len', 0.9)                         # 주둥이 끝에서 꼬리 끝까지
    D = L * 0.52                                  # 몸판 길이
    W = D * 1.12
    col, c2 = k['col'], k.get('col2', shade(k['col'], 1.2))
    T = Top(m, name, W * 0.56, L * 0.3, L * 0.72, px=192, bg=k.get('rim', c2), z0=0.012)
    wf = via([(0, 0.02), (0.15, 0.42), (0.42, 1.0), (0.6, 0.86), (0.85, 0.34), (1, 0.12)])
    T.shell(-L * 0.28, -L * 0.28 + D, wf, via([(0, 0.2), (0.35, 1), (0.7, 0.8), (1, 0.4)]), W, D * 0.11, k.get('rim', c2), n=14, seg=8, px=1.4)
    ts = [i / 20 for i in range(21)]
    inner = [(wf(t) * W * 0.5 * 0.9, -L * 0.28 + D * (0.03 + 0.94 * t)) for t in ts]
    T.poly(inner + [(-x, y) for x, y in reversed(inner)], col)
    T.blotch(shade(col, 0.82), L * 0.08, 0.6, inner + [(-x, y) for x, y in reversed(inner)], alpha=0.5)
    if k.get('spot'):
        rnd = random.Random(4)
        for _ in range(16):
            t = rnd.uniform(0.2, 0.8)
            x = rnd.uniform(0.1, 0.8) * wf(t) * W * 0.5
            T.spots([(x, -L * 0.28 + D * t, L * 0.014)], k['spot'])
    for s in (1, -1):                             # 눈과 숨구멍
        T.ell((s * D * 0.09, -L * 0.28 + D * 0.3), (D * 0.035, D * 0.04), shade(col, 0.6))
        T.ell((s * D * 0.11, -L * 0.28 + D * 0.38), (D * 0.022, D * 0.028), '#1a1a1a')
    T.on()
    for s in (1, -1):
        ball((s * D * 0.09, -L * 0.28 + D * 0.3, T.z0 + D * 0.1), 1.0, T.mat, (D * 0.04, D * 0.045, D * 0.035), sub=1)
    pel = [(D * 0.06, -L * 0.28 + D * 0.9), (D * 0.2, -L * 0.28 + D * 0.96), (D * 0.16, -L * 0.28 + D * 1.1), (D * 0.04, -L * 0.28 + D * 1.06)]
    for s in (1, -1):                             # 배지느러미
        q = [(s * x, y) for x, y in pel]
        T.poly(q, shade(col, 0.9))
        T.plate(q, T.z0 + 0.006)
    y0 = -L * 0.28 + D * 0.96
    T.line([(0, y0), (0, L * 0.7)], D * 0.04, shade(col, 0.8))
    tube((0, y0, T.z0 + D * 0.03), (0, L * 0.7, T.z0 + 0.004), D * 0.035, T.mat, r2=0.003, seg=5)
    T.finish()


def frog(m, name, k):
    L = k.get('len', 0.42)
    col, c2, belly = k['col'], k.get('col2', '#3a3a24'), k.get('belly', '#f3efd8')
    T = Top(m, name, L * 0.62, L * 0.56, L * 0.62, px=176, bg=col, z0=L * 0.02)
    # 뒷다리(접은 모습)
    for s in (1, -1):
        th = [(s * L * 0.16, L * 0.18), (s * L * 0.42, L * 0.02), (s * L * 0.52, L * 0.14), (s * L * 0.3, L * 0.34)]
        T.poly(th, col)
        T.line([(s * L * 0.34, L * 0.1), (s * L * 0.44, L * 0.2)], L * 0.03, c2)
        T.line([(s * L * 0.26, L * 0.2), (s * L * 0.36, L * 0.28)], L * 0.03, c2)
    T.on()
    for s in (1, -1):
        chain([(s * L * 0.14, L * 0.2, T.z0 + L * 0.07), (s * L * 0.46, L * 0.06, T.z0 + L * 0.1)], L * 0.075, T.mat, r2=L * 0.055, seg=6)
        chain([(s * L * 0.46, L * 0.06, T.z0 + L * 0.08), (s * L * 0.3, L * 0.34, T.z0 + L * 0.03)], L * 0.045, T.mat, r2=L * 0.03, seg=6)
        foot = [(s * L * 0.28, L * 0.32), (s * L * 0.5, L * 0.4), (s * L * 0.56, L * 0.5), (s * L * 0.44, L * 0.52), (s * L * 0.34, L * 0.56), (s * L * 0.26, L * 0.44)]
        T.poly(foot, shade(col, 0.92))
        T.plate(foot, 0.006)
    # 몸
    T.shell(-L * 0.46, L * 0.3, via([(0, 0.2), (0.16, 0.74), (0.34, 0.86), (0.6, 1.0), (0.85, 0.7), (1, 0.2)]), via([(0, 0.35), (0.3, 0.95), (0.6, 1), (1, 0.35)]), L * 0.44, L * 0.24, col, n=12, seg=8)
    if k.get('stripe'):
        T.line([(0, -L * 0.42), (0, L * 0.26)], L * 0.03, k['stripe'])
    for s in (1, -1):                             # 등 옆의 밝은 줄(등옆융기)
        T.line([(s * L * 0.1, -L * 0.24), (s * L * 0.15, 0.0), (s * L * 0.1, L * 0.24)], L * 0.016, k.get('fold', shade(col, 1.3)))
    rnd = random.Random(9)
    for _ in range(k.get('spots', 12)):
        T.ell((rnd.uniform(-0.17, 0.17) * L, rnd.uniform(-0.2, 0.24) * L), (L * rnd.uniform(0.02, 0.04), L * rnd.uniform(0.02, 0.035)), c2)
    for s in (1, -1):
        T.ell((s * L * 0.2, -L * 0.3), (L * 0.03, L * 0.03), c2)       # 고막
    T.off()
    for s in (1, -1):                             # 눈과 앞다리
        ball((s * L * 0.12, -L * 0.3, T.z0 + L * 0.2), L * 0.06, k.get('eye', '#c9a23a'), sub=2)
        ball((s * L * 0.135, -L * 0.31, T.z0 + L * 0.215), 1.0, '#1a1a1a', (L * 0.04, L * 0.03, L * 0.025), sub=1)
        chain([(s * L * 0.15, -L * 0.2, T.z0 + L * 0.06), (s * L * 0.3, -L * 0.24, T.z0 + L * 0.04), (s * L * 0.3, -L * 0.4, 0.004)], L * 0.035, col, r2=L * 0.02, seg=5)
    T.finish()


def tadpole(m, name, k):
    L = k.get('len', 0.34)
    col = k['col']
    T = Top(m, name, L * 0.3, L * 0.48, L * 0.6, px=128, bg=col, z0=0.012)
    tl = [(0, L * 0.0), (L * 0.05, L * 0.1), (L * 0.03, L * 0.36), (0, L * 0.56), (-L * 0.03, L * 0.36), (-L * 0.05, L * 0.1)]
    T.poly(tl, shade(col, 1.25))
    T.line([(0, L * 0.0), (0, L * 0.5)], L * 0.03, col)
    T.shell(-L * 0.44, L * 0.02, sup(2.2, 0.9), via([(0, 0.4), (0.5, 1), (1, 0.5)]), L * 0.34, L * 0.24, col, n=8, seg=8)
    T.speck(k.get('speck', '#c9a84a'), 26, L * 0.008, (-L * 0.12, L * 0.12, -L * 0.36, -L * 0.04))
    T.on()
    # 꼬리: 세로로 납작한 지느러미
    V = []
    for i in range(9):
        t = i / 8
        y = L * 0.0 + L * 0.56 * t
        h = L * 0.13 * math.sin(math.pi * min(1, t * 1.3 + 0.12)) ** 0.7 * (1 - t * 0.5)
        V += [(0, y, T.z0 + L * 0.1 + h), (0, y, T.z0 + L * 0.1 - h * 0.8)]
    mesh_uv(V, [(2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1) for i in range(8)], T.mat, [T.cv.uv(0, -y) for (x, y, z) in V], smooth=False)
    tube((0, -L * 0.02, T.z0 + L * 0.1), (0, L * 0.46, T.z0 + L * 0.1), L * 0.03, T.mat, r2=0.004, seg=5)
    T.off()
    for s in (1, -1):
        ball((s * L * 0.1, -L * 0.34, T.z0 + L * 0.14), L * 0.03, '#f3ecd6', sub=1)
        ball((s * L * 0.11, -L * 0.35, T.z0 + L * 0.15), L * 0.018, '#1a1a1a', sub=1)
    T.finish()


def angler(m, name, k):
    L = k.get('len', 0.9)
    col, c2 = k['col'], k.get('col2', shade(k['col'], 0.6))
    W = L * 0.62
    T = Top(m, name, W * 0.66, L * 0.56, L * 0.56, px=192, bg=col, z0=0.012)
    for s in (1, -1):                             # 팔처럼 생긴 가슴지느러미
        fin = [(s * W * 0.36, L * 0.02), (s * W * 0.62, -L * 0.02), (s * W * 0.66, L * 0.12), (s * W * 0.52, L * 0.2), (s * W * 0.34, L * 0.14)]
        T.poly(fin, shade(col, 0.88))
        for i in range(4):
            T.line([(s * W * 0.38, L * 0.08), (s * W * (0.6 - i * 0.03), L * (0.0 + i * 0.06))], L * 0.006, c2)
        T.plate(fin, T.z0 + L * 0.02)
    tail = [(-L * 0.05, L * 0.4), (-L * 0.1, L * 0.52), (0, L * 0.5), (L * 0.1, L * 0.52), (L * 0.05, L * 0.4)]
    T.poly(tail, shade(col, 0.88))
    for x in (-0.06, -0.02, 0.02, 0.06):
        T.line([(x * L * 0.6, L * 0.42), (x * L, L * 0.51)], L * 0.006, c2)
    T.plate(tail, T.z0 + L * 0.03)
    wf = via([(0, 0.62), (0.1, 0.92), (0.26, 1.0), (0.45, 0.7), (0.7, 0.3), (1, 0.14)])
    T.shell(-L * 0.5, L * 0.44, wf, via([(0, 0.5), (0.25, 1), (0.6, 0.6), (1, 0.3)]), W, L * 0.16, col, n=14, seg=8, px=1.6)
    T.blotch(c2, L * 0.07, 0.55, alpha=0.55)
    T.blotch(shade(col, 1.3), L * 0.05, 0.7, alpha=0.4, seed=11)
    T.line([(-W * 0.3, -L * 0.44), (-W * 0.16, -L * 0.485), (0, -L * 0.495), (W * 0.16, -L * 0.485), (W * 0.3, -L * 0.44)], L * 0.022, '#2a1e1a')       # 커다란 입
    for i in range(9):
        x = -W * 0.26 + W * 0.065 * i
        T.poly([(x - L * 0.008, -L * 0.47), (x, -L * 0.445), (x + L * 0.008, -L * 0.47)], '#f6f1e2')
    rnd = random.Random(2)
    for i in range(18):                           # 몸 가장자리의 너덜너덜한 살갗 돌기
        t = 0.04 + 0.5 * i / 18
        for s in (1, -1):
            x, y = s * wf(t) * W * 0.5, -L * 0.5 + L * 0.94 * t
            T.poly([(x - s * L * 0.01, y - L * 0.012), (x + s * L * 0.03, y + rnd.uniform(-0.01, 0.01) * L), (x - s * L * 0.01, y + L * 0.012)], shade(col, 0.85))
    T.off()
    for s in (1, -1):
        ball((s * W * 0.14, -L * 0.34, T.z0 + L * 0.15), L * 0.03, k.get('eye', '#d9c06a'), sub=1)
        ball((s * W * 0.145, -L * 0.345, T.z0 + L * 0.165), L * 0.016, '#1a1a1a', sub=1)
    chain([(0, -L * 0.4, T.z0 + L * 0.13), (0, -L * 0.5, T.z0 + L * 0.3), (0, -L * 0.62, T.z0 + L * 0.3)], L * 0.008, c2, r2=L * 0.004)     # 낚싯대(유인 돌기)
    ball((0, -L * 0.63, T.z0 + L * 0.3), L * 0.022, k.get('lure', '#f3ecd6'), sub=1)
    T.finish()


def jelly(m, name, k):
    """해파리(보름달물해파리): 투명한 갓에 말굽 모양 무늬 네 개"""
    R = k.get('len', 0.5) / 2
    col = k.get('col', '#dfe9ff')
    T = Top(m, name, R * 1.1, R * 1.1, R * 1.1, px=128, bg=col, wing=(R * 1.1, R * 1.1, R * 1.1, 128), z0=R * 0.5)
    cv = T.wcv
    T.ell((0, 0), (R, R), col, cv, a=120)
    T.ell((0, 0), (R * 0.9, R * 0.9), col, cv, a=90)
    for i in range(32):                           # 갓 가장자리의 술
        a = 2 * math.pi * i / 32
        T.line([(R * 0.92 * math.cos(a), R * 0.92 * math.sin(a)), (R * 1.04 * math.cos(a), R * 1.04 * math.sin(a))], R * 0.03, '#ffffff', cv, a=170)
    for i in range(4):                            # 말굽 모양 생식샘
        a0 = math.pi / 4 + i * math.pi / 2
        pts = [(R * 0.32 * math.cos(a0) + R * 0.18 * math.cos(a0 + b), R * 0.32 * math.sin(a0) + R * 0.18 * math.sin(a0 + b)) for b in [math.radians(-130 + 260 * j / 12) for j in range(13)]]
        T.line(pts, R * 0.07, k.get('ring', '#f0a8c8'), cv, a=215)
    for i in range(8):
        a = 2 * math.pi * i / 8
        T.line([(R * 0.5 * math.cos(a), R * 0.5 * math.sin(a)), (R * 0.9 * math.cos(a), R * 0.9 * math.sin(a))], R * 0.012, '#ffffff', cv, a=150)
    T.on(wing=True)
    dome((0, 0, T.z0), R, T.wmat, scale=(1, 1, 0.55), seg=16, rings=5, cut=0.5)
    for i in range(4):                            # 입 주위의 팔
        a = i * math.pi / 2
        chain([(R * 0.12 * math.cos(a), R * 0.12 * math.sin(a), T.z0), (R * 0.3 * math.cos(a), R * 0.3 * math.sin(a), T.z0 - R * 0.5), (R * 0.2 * math.cos(a), R * 0.2 * math.sin(a), T.z0 - R * 0.95)], R * 0.07, T.wmat, r2=R * 0.02, seg=5)
    T.finish()


SEA_FN = {'crab': crab, 'crayfish': crayfish, 'turtle': turtle, 'ray': ray, 'frog': frog, 'tadpole': tadpole, 'angler': angler, 'jelly': jelly}
