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
    """(t, 값) 점들을 부드러운 곡선으로 잇는 함수(점마다 꺾이거나 평평해지지 않는다. 이웃 값의 범위를 넘지 않게 한다)"""
    pts = sorted(pts)
    n = len(pts)
    ms = []
    for i in range(n):                                  # 점마다의 기울기
        if 0 < i < n - 1:
            d0 = (pts[i][1] - pts[i - 1][1]) / max(1e-6, pts[i][0] - pts[i - 1][0])
            d1 = (pts[i + 1][1] - pts[i][1]) / max(1e-6, pts[i + 1][0] - pts[i][0])
            ms.append(0.0 if d0 * d1 <= 0 else 2 * d0 * d1 / (d0 + d1))       # 봉우리에서는 평평, 아니면 조화 평균
        elif n > 1:
            j = 0 if i == 0 else n - 2
            ms.append((pts[j + 1][1] - pts[j][1]) / max(1e-6, pts[j + 1][0] - pts[j][0]))
        else:
            ms.append(0.0)

    def f(t):
        if t <= pts[0][0]:
            return pts[0][1]
        for i in range(n - 1):
            (t0, v0), (t1, v1) = pts[i], pts[i + 1]
            if t <= t1:
                h = max(1e-6, t1 - t0)
                u = (t - t0) / h
                h00, h10, h01, h11 = 2 * u ** 3 - 3 * u ** 2 + 1, u ** 3 - 2 * u ** 2 + u, -2 * u ** 3 + 3 * u ** 2, u ** 3 - u ** 2
                v = h00 * v0 + h10 * h * ms[i] + h01 * v1 + h11 * h * ms[i + 1]
                lo, hi = min(v0, v1), max(v0, v1)
                return max(lo, min(hi, v))
        return pts[-1][1]
    return f


def const(v=1.0):
    return lambda t: v


def chain(pts, r, col, r2=None, seg=6):
    """점들을 차례로 잇는 가는 관(다리, 더듬이). r에서 r2로 가늘어진다. 꺾이는 곳은 둥근 마디로 메운다."""
    n = len(pts) - 1
    r2 = r if r2 is None else r2
    seg = max(seg, 6)
    for i in range(n):
        a, b = r + (r2 - r) * i / n, r + (r2 - r) * (i + 1) / n
        tube(pts[i], pts[i + 1], a, col, r2=b, seg=seg)
        if i > 0 and a > 0.004:
            ball(pts[i], a * 1.04, col, sub=1)


def leg3(a, b, c, r, col, tarsus=0.28, foot=None):
    """마디가 있는 다리: 넓적다리(a→b, 굵다) · 종아리(b→c) · 발목마디(c에서 바깥으로 짧게). a, b, c는 (x, y, z)"""
    tube(a, b, r * 1.55, col, r2=r * 1.15, seg=6)
    ball(b, r * 1.2, col, sub=1)
    tube(b, c, r * 0.95, col, r2=r * 0.6, seg=6)
    dx, dy = c[0] - b[0], c[1] - b[1]
    d = math.hypot(dx, dy) or 1.0
    e = (c[0] + dx / d * d * tarsus, c[1] + dy / d * d * tarsus, c[2])
    tube(c, e, r * 0.55, foot or col, r2=r * 0.32, seg=5)


def limb(T, pts, rs, col, bands=None, bandc=None, sub=2):
    """그림과 3D를 함께 만드는 팔다리. pts [(x, y, z)…] 마디 위치, rs [굵기…]. 위에서 본 모습을 그림의 같은 자리에 칠한다.
    bands: 마디마다 가로띠 개수(개구리 다리의 얼룩띠)."""
    for i in range(len(pts) - 1):
        (x0, y0, _), (x1, y1, _) = pts[i], pts[i + 1]
        for j in range(9):
            f = j / 8
            r = rs[i] + (rs[i + 1] - rs[i]) * f
            T.ell((x0 + (x1 - x0) * f, y0 + (y1 - y0) * f), (r, r), col)
    if bands:
        for i in range(len(pts) - 1):
            (x0, y0, _), (x1, y1, _) = pts[i], pts[i + 1]
            d = math.hypot(x1 - x0, y1 - y0) or 1.0
            nx, ny = -(y1 - y0) / d, (x1 - x0) / d
            nb = bands[i] if i < len(bands) else 0
            for j in range(nb):
                f = (j + 0.6) / (nb + 0.3)
                r = (rs[i] + (rs[i + 1] - rs[i]) * f) * 0.98
                cx, cy = x0 + (x1 - x0) * f, y0 + (y1 - y0) * f
                T.line([(cx - nx * r, cy - ny * r), (cx + nx * r, cy + ny * r)], max(r * 0.5, d * 0.07), bandc)
    T.on()
    ball(pts[0], rs[0], T.mat, sub=sub)
    for i in range(len(pts) - 1):
        tube(pts[i], pts[i + 1], rs[i], T.mat, r2=rs[i + 1], seg=8)
        ball(pts[i + 1], rs[i + 1] * 1.02, T.mat, sub=sub)


def crableg(a, b, c, e, r, col, tipc=None):
    """게 다리: 넓적한 긴마디(a→b), 앞마디(b→c), 뾰족한 발가락마디(c→e)"""
    tube(a, b, r * 1.5, col, r2=r * 1.25, seg=7)
    ball(b, r * 1.3, col, sub=2)
    tube(b, c, r * 1.1, col, r2=r * 0.8, seg=7)
    ball(c, r * 0.82, col, sub=2)
    tube(c, e, r * 0.72, tipc or col, r2=r * 0.1, seg=6)


def flipper(T, ctr, ws, z, h, skin, scale):
    """바다거북의 지느러미발: 가운데 줄 ctr[(x, y)…]과 반폭 ws. 도톰한 판으로 만들고 그림에는 비늘 조각을 그린다."""
    n = len(ctr)
    Lf, Rt = [], []
    for i in range(n):
        a, b = ctr[max(0, i - 1)], ctr[min(n - 1, i + 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        d = math.hypot(dx, dy) or 1.0
        nx, ny = -dy / d, dx / d
        Lf.append((ctr[i][0] + nx * ws[i], ctr[i][1] + ny * ws[i]))
        Rt.append((ctr[i][0] - nx * ws[i], ctr[i][1] - ny * ws[i]))
    T.poly(Lf + list(reversed(Rt)), skin)                          # 비늘 사이로 보이는 밝은 살
    lerp = lambda p, q, f: (p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f)
    rows = 3
    for j in range(rows):                                          # 벽돌처럼 어긋나게 놓인 비늘
        for i in range(-1 if j % 2 else 0, n - 1, 2):
            i0, i1 = max(0, i), min(n - 1, i + 2)
            if i1 <= i0:
                continue
            q = [lerp(Lf[i0], Rt[i0], j / rows), lerp(Lf[i1], Rt[i1], j / rows), lerp(Lf[i1], Rt[i1], (j + 1) / rows), lerp(Lf[i0], Rt[i0], (j + 1) / rows)]
            c = (sum(v[0] for v in q) / 4, sum(v[1] for v in q) / 4)
            T.poly(smooth([lerp(c, v, 0.8) for v in q], 3, closed=True), scale)
    V = [(x, y, z) for x, y in Lf] + [(x, y, z + h * (0.35 + 0.65 * math.sin(math.pi * min(1.0, (i + 0.6) / n)))) for i, (x, y) in enumerate(ctr)] + [(x, y, z) for x, y in Rt]
    F = []
    for i in range(n - 1):
        F.append((i, i + 1, n + i + 1, n + i))
        F.append((n + i, n + i + 1, 2 * n + i + 1, 2 * n + i))
    T.on()
    fix_normals(mesh_uv(V, F, T.mat, [T.cv.uv(x, -y) for x, y, _ in V]))


CAP_MIN = 0.7          # 덩어리의 양끝을 둥글릴 때, 맨 끝의 폭이 원래의 몇 배인지


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
    def shell(self, y0, y1, wf, hf, W, H, col=None, z0=None, n=10, seg=8, px=2.0, mat=None, x0=0.0, full=False, cap=0.09):
        """위에서 본 윤곽이 wf(t)*W/2, 높이가 hf(t)*H 인 볼록한 덩어리(t: 앞 0 → 뒤 1). 단면은 반타원.
        full=True면 아래쪽도 똑같이 둥글다(헤엄치는 것: z0가 몸 가운데)."""
        z0 = self.z0 if z0 is None else z0
        # 윤곽이 각져 보이지 않게 촘촘히 나눈다(양끝 쪽이 더 촘촘한 간격). 양끝은 살짝 둥글린다.
        n = max(14, min(24, n * 2 + 4))
        seg = max(10, min(14, seg + 4))
        ts = [(1 - math.cos(math.pi * i / n)) / 2 for i in range(n + 1)]
        wf0, hf0 = wf, hf

        def rd(t):
            u = min(t, 1 - t) / cap if cap > 0 else 1.0
            return 1.0 if u >= 1 else 1 - (1 - CAP_MIN) * (1 - math.sqrt(max(0.0, 1 - (1 - u) ** 2)))
        wf = lambda t: wf0(t) * rd(t)
        hf = lambda t: hf0(t) * (0.5 + 0.5 * rd(t))
        if col is not None:
            R = [(x0 + wf(t) * W / 2, y0 + (y1 - y0) * t) for t in ts]
            L = [(x0 - wf(t) * W / 2, y0 + (y1 - y0) * t) for t in ts]
            self.poly(R + list(reversed(L)), col)
        V, F = [], []
        if full:
            k = seg * 2
            for t in ts:
                w, h, y = max(1e-4, wf(t) * W / 2), max(1e-4, hf(t) * H), y0 + (y1 - y0) * t
                for j in range(k):
                    a = 2 * math.pi * j / k
                    V.append((x0 + w * math.sin(a), y, z0 + h * math.cos(a)))
            for i in range(n):
                for j in range(k):
                    F.append((i * k + j, (i + 1) * k + j, (i + 1) * k + (j + 1) % k, i * k + (j + 1) % k))
        else:
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

    def blob(self, c, r, col=None, sub=3):
        """타원체. col을 주면 그림에도 같은 자리에 칠한다(좌우 대칭이 필요하면 both와 함께)."""
        if col is not None:
            self.ell((c[0], c[1]), (r[0], r[1]), col)
        return ball(c, 1.0, self.mat, r, sub=sub)

    def legs(self, col, pairs, r=0.006):
        """pairs: [(붙는 곳 (x, y, z), 무릎 (x, y, z), 발 (x, y))] — 오른쪽 것만 주면 좌우에 만든다"""
        for (a, b, c) in pairs:
            for s in (1, -1):
                leg3((s * a[0], a[1], a[2]), (s * b[0], b[1], b[2]), (s * c[0], c[1], 0.0), r, col)

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
    """게: kind 'blue'(꽃게: 양옆으로 긴 가시가 뻗은 넓은 등딱지, 노 같은 헤엄다리) | 'mitten'(참게: 둥근 네모 등딱지, 집게의 털뭉치)"""
    L = k.get('len', 0.5)                         # 등딱지 너비
    blue = k.get('kind', 'blue') == 'blue'
    D = L * (0.5 if blue else 0.86)               # 등딱지 앞뒤 길이
    BW = L * (0.82 if blue else 1.0)              # 가시를 뺀 등딱지 폭
    col, c2 = k['col'], k.get('col2', shade(k['col'], 0.75))
    claw = k.get('claw', col)
    legc = k.get('leg', claw if blue else mix(col, '#c9b98a', 0.25))
    T = Top(m, name, L * 0.62, L * 0.5, L * 0.5, px=208, bg=col, z0=L * 0.07)
    z = T.z0
    if blue:
        wf = via([(0, 0.5), (0.1, 0.7), (0.26, 0.93), (0.36, 1.0), (0.52, 0.84), (0.78, 0.58), (1, 0.42)])
    else:
        wf = via([(0, 0.6), (0.12, 0.84), (0.3, 0.98), (0.5, 1.0), (0.78, 0.93), (1, 0.62)])
    Y = lambda t: -D * 0.5 + D * t
    if blue:                                      # 양옆의 긴 가시(등딱지보다 먼저 그려 밑에 깔리게)
        ys = Y(0.36)
        for s in (1, -1):
            T.poly([(s * BW * 0.42, ys - D * 0.13), (s * L * 0.61, ys - D * 0.02), (s * BW * 0.42, ys + D * 0.1)], col)
    T.shell(-D * 0.5, D * 0.5, wf, via([(0, 0.35), (0.4, 1), (1, 0.5)]), BW, L * 0.2, col, n=10)
    edge = shade(col, 1.25)
    if blue:
        # 등의 흰 구름무늬(뒤쪽 절반에 많다)
        rnd = random.Random(3)
        sp = k.get('spot', '#f3ecd6')
        for (ux, t, r) in ((0.1, 0.5, 0.03), (0.24, 0.42, 0.024), (0.36, 0.5, 0.02), (0.16, 0.68, 0.034), (0.3, 0.66, 0.026), (0.07, 0.84, 0.026), (0.2, 0.86, 0.02), (0.44, 0.38, 0.016), (0.06, 0.3, 0.014)):
            for s in (1, -1):
                T.ell((s * BW * ux, Y(t)), (L * r * rnd.uniform(0.9, 1.3), L * r * rnd.uniform(0.7, 1.0)), sp)
                T.ell((s * BW * ux + L * r * 0.8, Y(t) + L * r * 0.5), (L * r * 0.6, L * r * 0.5), sp)
        T.blotch(shade(col, 0.82), L * 0.07, 0.58, alpha=0.45)
        T.line([(-BW * 0.16, Y(0.4)), (-BW * 0.06, Y(0.52)), (BW * 0.06, Y(0.52)), (BW * 0.16, Y(0.4))], L * 0.012, c2)      # 등의 홈
        T.line([(-BW * 0.06, Y(0.52)), (-BW * 0.1, Y(0.8))], L * 0.01, c2)
        T.line([(BW * 0.06, Y(0.52)), (BW * 0.1, Y(0.8))], L * 0.01, c2)
        for s in (1, -1):                         # 앞옆 가장자리의 톱니
            for i in range(7):
                t = 0.04 + 0.3 * i / 7
                x = s * wf(t) * BW * 0.5
                T.poly([(x - s * L * 0.02, Y(t) - L * 0.004), (x + s * L * 0.012, Y(t) - L * 0.022), (x - s * L * 0.008, Y(t) + L * 0.026)], edge)
        for i in range(4):                        # 두 눈 사이의 톱니
            x = (i - 1.5) * BW * 0.06
            T.poly([(x - L * 0.012, Y(0.03)), (x, Y(0) - L * 0.008), (x + L * 0.012, Y(0.03))], edge)
    else:
        T.blotch(c2, L * 0.12, 0.55, alpha=0.55)
        T.blotch(shade(col, 1.2), L * 0.06, 0.7, alpha=0.35, seed=9)
        # 등의 H 모양 홈
        T.line([(-BW * 0.14, Y(0.34)), (-BW * 0.08, Y(0.5)), (-BW * 0.14, Y(0.72))], L * 0.014, c2)
        T.line([(BW * 0.14, Y(0.34)), (BW * 0.08, Y(0.5)), (BW * 0.14, Y(0.72))], L * 0.014, c2)
        T.line([(-BW * 0.08, Y(0.5)), (BW * 0.08, Y(0.5))], L * 0.014, c2)
        for s in (1, -1):                         # 앞옆 가장자리의 톱니 네 개
            for i in range(4):
                t = 0.04 + 0.26 * i / 3
                x = s * wf(t) * BW * 0.5
                T.poly([(x - s * L * 0.025, Y(t) - L * 0.01), (x + s * L * 0.012, Y(t) - L * 0.02), (x - s * L * 0.012, Y(t) + L * 0.03)], edge)
        for i in range(4):                        # 이마의 톱니 네 개
            x = (i - 1.5) * BW * 0.075
            T.poly([(x - L * 0.018, Y(0.03)), (x, Y(0) - L * 0.006), (x + L * 0.018, Y(0.03))], edge)
    if blue:                                      # 옆 가시
        T.on()
        ys = Y(0.36)
        for s in (1, -1):
            tube((s * BW * 0.38, ys - D * 0.01, z + L * 0.06), (s * L * 0.61, ys - D * 0.02, z + L * 0.05), L * 0.05, T.mat, r2=0.002, seg=7)
    T.off()
    ex = BW * (0.13 if blue else 0.2)
    for s in (1, -1):                             # 눈자루와 눈
        tube((s * ex, -D * 0.44, z + L * 0.08), (s * ex * 1.05, -D * 0.5 - L * 0.03, z + L * 0.13), L * 0.012, col, seg=5)
        ball((s * ex * 1.05, -D * 0.5 - L * 0.035, z + L * 0.14), L * 0.022, '#1a1a1a', sub=2)
    tip = k.get('tip', '#f3ecd6')
    for s in (1, -1):
        if blue:                                  # 꽃게의 길쭉한 집게다리: 가시 돋은 긴마디, 모가 난 긴 손, 가늘고 긴 집게
            sh, el, wr = (s * BW * 0.26, -D * 0.3, z + L * 0.05), (s * L * 0.52, -D * 0.5 - L * 0.08, z + L * 0.08), (s * L * 0.47, -D * 0.5 - L * 0.2, z + L * 0.07)
            hand = (s * L * 0.36, -D * 0.5 - L * 0.4, z + L * 0.06)
            tube(sh, el, L * 0.05, claw, r2=L * 0.045, seg=7)
            ball(el, L * 0.05, claw, sub=2)
            for i in range(3):                    # 긴마디 앞쪽의 가시
                f = 0.3 + 0.25 * i
                px_, py_ = sh[0] + (el[0] - sh[0]) * f, sh[1] + (el[1] - sh[1]) * f
                tube((px_, py_ - L * 0.03, z + L * 0.07), (px_ + s * L * 0.01, py_ - L * 0.085, z + L * 0.07), L * 0.014, tip, r2=0.001, seg=4)
            tube(el, wr, L * 0.042, claw, r2=L * 0.04, seg=7)
            ball(wr, L * 0.045, claw, sub=2)
            tube(wr, hand, L * 0.05, claw, r2=L * 0.04, seg=7)
            tube(hand, (s * L * 0.22, -D * 0.5 - L * 0.6, z + L * 0.055), L * 0.032, claw, r2=L * 0.012, seg=6)                       # 움직이지 않는 손가락
            tube((hand[0] + s * L * 0.035, hand[1], hand[2] + L * 0.01), (s * L * 0.265, -D * 0.5 - L * 0.62, z + L * 0.07), L * 0.026, claw, r2=L * 0.01, seg=6)      # 움직이는 손가락
            for q in ((s * L * 0.22, -D * 0.5 - L * 0.6, z + L * 0.055), (s * L * 0.265, -D * 0.5 - L * 0.62, z + L * 0.07)):
                ball(q, L * 0.016, tip, sub=1)
            for i in range(4):                    # 손등의 흰 점
                f = 0.2 + 0.2 * i
                ball((wr[0] + (hand[0] - wr[0]) * f, wr[1] + (hand[1] - wr[1]) * f, wr[2] + L * 0.04), L * 0.012, k.get('spot', '#f3ecd6'), (1, 1, 0.5), sub=1)
        else:                                     # 참게의 굵은 집게다리: 손을 덮은 짙은 털뭉치, 흰 집게 끝
            sh, el = (s * BW * 0.3, -D * 0.34, z + L * 0.06), (s * L * 0.56, -D * 0.5 - L * 0.1, z + L * 0.09)
            hand = (s * L * 0.36, -D * 0.5 - L * 0.3, z + L * 0.08)
            tube(sh, el, L * 0.065, claw, r2=L * 0.06, seg=7)
            ball(el, L * 0.066, claw, sub=2)
            tube(el, hand, L * 0.06, claw, r2=L * 0.07, seg=7)
            lump(hand, L * 0.115, k.get('mitt', claw), (1.0, 0.95, 0.72), seed=4 + (s > 0), amp=0.1, sub=2, smooth=True)             # 털뭉치
            tube((hand[0] - s * L * 0.02, hand[1] - L * 0.06, hand[2] + L * 0.02), (s * L * 0.17, -D * 0.5 - L * 0.5, z + L * 0.075), L * 0.036, tip, r2=0.004, seg=6)
            tube((hand[0] - s * L * 0.05, hand[1] - L * 0.03, hand[2] - L * 0.02), (s * L * 0.15, -D * 0.5 - L * 0.44, z + L * 0.04), L * 0.03, tip, r2=0.004, seg=6)
        # 걷는 다리
        if blue:
            spec = [(-0.06, -8, 0.44), (0.1, 14, 0.48), (0.24, 38, 0.44)]
        else:
            spec = [(-0.14, -32, 0.7), (0.04, -6, 0.8), (0.2, 20, 0.8), (0.34, 48, 0.68)]
        r = L * (0.02 if blue else 0.03)
        for (yy, deg, reach) in spec:
            a = math.radians(deg)
            y = D * yy
            ux, uy = math.cos(a), math.sin(a)
            x0 = wf(min(1.0, max(0.0, yy + 0.5))) * BW * 0.5 * (0.9 if blue else 0.82)
            A = (s * x0, y, z + L * 0.04)
            B = (s * (x0 + ux * L * reach * 0.42), y + uy * L * reach * 0.42, z + L * (0.07 if blue else 0.17))
            C = (s * (x0 + ux * L * reach * 0.78), y + uy * L * reach * 0.78, z + L * 0.06)
            E = (s * (x0 + ux * L * reach), y + uy * L * reach + L * 0.02, 0.004)
            crableg(A, B, C, E, r, legc, shade(legc, 0.7))
        if blue:                                  # 꽃게의 헤엄다리: 끝마디가 노처럼 넓적하다
            A = (s * BW * 0.26, D * 0.36, z + L * 0.04)
            B = (s * L * 0.42, D * 0.5 + L * 0.04, z + L * 0.08)
            C = (s * L * 0.54, D * 0.5 + L * 0.14, z + L * 0.06)
            tube(A, B, r * 1.5, legc, r2=r * 1.2, seg=7)
            ball(B, r * 1.3, legc, sub=2)
            tube(B, C, r * 1.2, legc, r2=r * 1.2, seg=7)
            ball((s * L * 0.6, D * 0.5 + L * 0.22, z + L * 0.05), 1.0, k.get('paddle', shade(legc, 1.12)), (L * 0.075, L * 0.105, L * 0.014), rot=(0, 0, -s * 32), sub=2)
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
            leg3((s * L * 0.1, y, z + L * 0.04), (s * L * 0.24, y - L * 0.03 + i * L * 0.03, z + L * 0.09), (s * L * 0.32, y - L * 0.06 + i * L * 0.05, 0.004), L * 0.012, c2, tarsus=0.3)
    T.finish()


def turtle(m, name, k):
    """거북: kind 'soft'(자라: 매끈하고 납작한 등, 대롱 같은 코, 물갈퀴 발) | 'sea'(바다거북: 등판 조각 무늬, 날개 같은 지느러미발)"""
    L = k.get('len', 0.6)
    sea = k.get('kind') == 'sea'
    col, c2, skin = k['col'], k.get('col2', shade(k['col'], 0.7)), k.get('skin', shade(k['col'], 1.15))
    W = L * (0.56 if sea else 0.6)
    T = Top(m, name, L * 0.78, L * 0.7, L * 0.68, px=224, bg=skin, z0=L * 0.03)
    S0, S1 = -L * 0.32, L * 0.36                  # 등딱지 앞뒤
    z = T.z0
    # 다리(등딱지 아래에 깔리도록 먼저)
    if sea:
        for s in (1, -1):                         # 앞지느러미발은 길고 뒤로 휘었다. 뒷지느러미발은 짧고 둥글다
            fc = smooth([(s * W * 0.3, -L * 0.2), (s * W * 0.66, -L * 0.3), (s * W * 0.98, -L * 0.29), (s * W * 1.18, -L * 0.17), (s * W * 1.26, L * 0.02), (s * W * 1.24, L * 0.2)], 3)
            n = len(fc)
            ws = [L * (0.07 + 0.03 * math.sin(math.pi * min(1.0, i / (n * 0.45)) * 0.5)) * (1.0 if i < n * 0.55 else max(0.16, 1 - ((i - n * 0.55) / (n * 0.45)) ** 1.5)) for i in range(n)]
            flipper(T, fc, ws, z + L * 0.02, L * 0.03, skin, c2)
            hc = smooth([(s * W * 0.22, L * 0.26), (s * W * 0.4, L * 0.4), (s * W * 0.5, L * 0.54), (s * W * 0.5, L * 0.62)], 3)
            n = len(hc)
            ws = [L * 0.062 * (1.0 if i < n * 0.6 else max(0.3, 1 - ((i - n * 0.6) / (n * 0.4)) ** 1.6)) for i in range(n)]
            flipper(T, hc, ws, z + L * 0.015, L * 0.025, skin, c2)
    else:
        dk = shade(skin, 0.78)
        for s in (1, -1):                         # 물갈퀴가 달린 넓적한 발: 짧은 다리 끝에 부채꼴 발, 발톱 셋
            for (bx, by, deg, ln) in ((0.44, -0.2, -38, 0.2), (0.4, 0.3, 46, 0.19)):
                a = math.radians(deg)
                ux, uy = math.cos(a), math.sin(a)
                root = (s * W * bx, L * by)
                wrist = (root[0] + s * ux * L * ln * 0.5, root[1] + uy * L * ln * 0.5)
                limb(T, [(root[0], root[1], z + L * 0.03), (wrist[0], wrist[1], z + L * 0.022)], [L * 0.05, L * 0.04], skin)
                tips = []
                for i in range(5):
                    b_ = a + math.radians(-50 + 25 * i)
                    r = L * ln * (0.62 + 0.1 * math.sin(math.pi * i / 4))
                    tips.append((wrist[0] + s * math.cos(b_) * r, wrist[1] + math.sin(b_) * r))
                web = [(wrist[0] + s * uy * L * 0.035, wrist[1] - ux * L * 0.035)] + tips + [(wrist[0] - s * uy * L * 0.035, wrist[1] + ux * L * 0.035)]
                web = [web[0]] + smooth(web[1:-1], 2) + [web[-1]]
                T.poly(web, shade(skin, 0.95))
                for q in tips:
                    T.line([wrist, q], L * 0.008, dk)
                T.on()
                T.plate(web, z + L * 0.012)
                T.off()
                for i in (0, 2, 4):               # 발톱 셋
                    q = tips[i]
                    d = math.hypot(q[0] - wrist[0], q[1] - wrist[1]) or 1.0
                    tube((q[0], q[1], z + L * 0.014), (q[0] + (q[0] - wrist[0]) / d * L * 0.03, q[1] + (q[1] - wrist[1]) / d * L * 0.03, z + L * 0.008), L * 0.008, '#f0ead0', r2=0.001, seg=4)
                T.on()
    # 머리와 목
    if sea:
        T.shell(-L * 0.6, -L * 0.26, via([(0, 0.4), (0.25, 0.95), (0.5, 1.0), (0.75, 0.8), (1, 0.7)]), via([(0, 0.45), (0.35, 1), (1, 0.7)]), L * 0.19, L * 0.12, skin, z0=z + L * 0.03, n=8, seg=7)
        for (ux, uy, rx, ry) in ((0, -0.5, 0.03, 0.035), (0.045, -0.445, 0.026, 0.03), (0, -0.425, 0.022, 0.028), (0.05, -0.385, 0.026, 0.026), (0, -0.365, 0.02, 0.022), (0.035, -0.54, 0.02, 0.02)):   # 머리의 비늘판
            for s in ((1, -1) if ux else (1,)):
                T.ell((s * L * ux, L * uy), (L * rx, L * ry), c2)
        for s in (1, -1):
            T.ell((s * L * 0.075, -L * 0.5), (L * 0.014, L * 0.018), '#1a1a1a')
    else:
        T.shell(-L * 0.62, -L * 0.26, via([(0, 0.16), (0.14, 0.5), (0.34, 0.95), (0.5, 0.8), (0.7, 0.62), (1, 0.62)]), via([(0, 0.4), (0.3, 1), (1, 0.7)]), L * 0.16, L * 0.11, skin, z0=z + L * 0.03, n=8, seg=7)
        for s in (1, -1):                         # 눈 뒤로 이어지는 밝은 줄과 눈
            T.line([(s * L * 0.04, -L * 0.47), (s * L * 0.045, -L * 0.3)], L * 0.012, shade(skin, 1.3))
            T.ell((s * L * 0.04, -L * 0.5), (L * 0.014, L * 0.016), '#1a1a1a')
        T.speck(shade(skin, 0.75), 14, L * 0.006, (-L * 0.05, L * 0.05, -L * 0.5, -L * 0.3))
    # 등딱지
    wf = via([(0, 0.5), (0.2, 0.9), (0.42, 1.0), (0.75, 0.82), (1, 0.2)]) if sea else sup(2.3, 0.92)
    T.shell(S0, S1, wf, via([(0, 0.3), (0.45, 1), (1, 0.3)]), W, L * (0.16 if sea else 0.1), k.get('rim', c2) if sea else k.get('rim', shade(col, 1.2)), z0=z + L * 0.03, n=12, seg=8)
    ts = [i / 20 for i in range(21)]
    inner = [(wf(t) * W * 0.5 * 0.86, S0 + (S1 - S0) * (0.04 + 0.92 * t)) for t in ts]
    T.poly(inner + [(-x, y) for x, y in reversed(inner)], col)
    if sea:                                       # 등판 무늬: 가운데 5장, 양옆 4장씩, 가장자리의 잔 조각
        ray_c = mix(col, k.get('ray', '#e8c070'), 0.7)
        ys = [S0 + (S1 - S0) * f for f in (0.05, 0.22, 0.42, 0.62, 0.8, 0.95)]
        for i in range(5):
            w0 = W * 0.13
            hexa = [(-w0, ys[i] + L * 0.01), (0, ys[i]), (w0, ys[i] + L * 0.01), (w0, ys[i + 1] - L * 0.01), (0, ys[i + 1]), (-w0, ys[i + 1] - L * 0.01)]
            T.line(hexa + [hexa[0]], L * 0.012, c2)
            cy = (ys[i] + ys[i + 1]) / 2
            for a_ in range(6):
                T.line([(0, cy), (hexa[a_][0] * 0.8, cy + (hexa[a_][1] - cy) * 0.8)], L * 0.006, ray_c)
            if i < 4:
                for s in (1, -1):
                    yy = cy + (S1 - S0) * 0.09
                    T.line([(s * w0, ys[i + 1] - L * 0.01), (s * wf(0.1 + 0.2 * (i + 1)) * W * 0.43, yy)], L * 0.012, c2)
                    for a_ in range(4):
                        T.line([(s * W * 0.26, yy - (S1 - S0) * 0.1), (s * W * (0.18 + a_ * 0.06), yy - (S1 - S0) * 0.1 + (a_ - 1.5) * L * 0.04)], L * 0.006, ray_c)
        for i in range(1, 20):                    # 가장자리 조각을 나누는 금
            t = i / 20
            for s in (1, -1):
                x, y = s * wf(t) * W * 0.5, S0 + (S1 - S0) * t
                T.line([(x * 0.86, S0 + (S1 - S0) * (0.04 + 0.92 * t)), (x, y)], L * 0.006, shade(c2, 1.3))
    else:
        T.blotch(shade(col, 0.86), L * 0.09, 0.6, inner + [(-x, y) for x, y in reversed(inner)], alpha=0.5)
        T.speck(shade(col, 0.74), 44, L * 0.009, (-W * 0.34, W * 0.34, S0 + L * 0.06, S1 - L * 0.06))
        T.speck(shade(col, 1.25), 20, L * 0.006, (-W * 0.3, W * 0.3, S0 + L * 0.08, S1 - L * 0.08), seed=8)
        T.line([(0, S0 + L * 0.06), (0, S1 - L * 0.08)], L * 0.008, shade(col, 0.85))
    T.off()
    if not sea:                                   # 자라의 대롱 같은 코, 짧은 꼬리
        tube((0, -L * 0.6, z + L * 0.07), (0, -L * 0.675, z + L * 0.065), L * 0.013, skin, r2=L * 0.009, seg=6)
        tube((0, S1 - L * 0.02, z + L * 0.03), (0, S1 + L * 0.07, z + L * 0.02), L * 0.02, skin, r2=0.003, seg=5)
    else:
        tube((0, S1 - L * 0.03, z + L * 0.03), (0, S1 + L * 0.05, z + L * 0.02), L * 0.016, skin, r2=0.003, seg=5)
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
    """개구리(참개구리): 앉은 모습. 접은 뒷다리(넓적다리·종아리·긴 발과 물갈퀴), 안으로 모은 앞다리, 등 가운데의 밝은 줄과 양옆의 등옆융기"""
    L = k.get('len', 0.42)
    col, c2 = k['col'], k.get('col2', '#3a3a24')
    side = k.get('side', mix(col, '#d8d4a0', 0.5))            # 옆구리와 다리 안쪽의 밝은 색
    legc = mix(col, side, 0.3)
    T = Top(m, name, L * 0.8, L * 0.62, L * 0.62, px=224, bg=legc, z0=L * 0.02)
    z = T.z0

    def rot(ux, uy, deg):
        a = math.radians(deg)
        return (ux * math.cos(a) - uy * math.sin(a), ux * math.sin(a) + uy * math.cos(a))

    for s in (1, -1):
        # 뒷다리: 엉덩이 → 무릎(옆 앞쪽) → 발뒤꿈치(엉덩이 옆으로 접힘) → 발허리 → 발가락 다섯(넷째가 가장 길다)
        hip, knee, heel = (s * L * 0.1, L * 0.2, z + L * 0.09), (s * L * 0.44, L * 0.02, z + L * 0.1), (s * L * 0.22, L * 0.37, z + L * 0.045)
        base = (s * L * 0.42, L * 0.36, z + L * 0.018)
        limb(T, [heel, base], [L * 0.03, L * 0.026], legc, bands=[1], bandc=c2)
        T.off()
        ux, uy = (base[0] - heel[0]) / (L * 0.2), (base[1] - heel[1]) / (L * 0.2)
        d = math.hypot(ux, uy)
        ux, uy = ux / d, uy / d
        tips = []
        for (deg, ln) in ((-44, 0.1), (-24, 0.15), (-4, 0.2), (16, 0.25), (40, 0.17)):
            vx, vy = rot(ux, uy, deg * s)
            tips.append((base[0] + vx * L * ln, base[1] + vy * L * ln))
        web = [(base[0], base[1])]
        for i, q in enumerate(tips):
            web.append(q)
            if i < 4:                               # 발가락 사이에서 안으로 파인 물갈퀴
                q2 = tips[i + 1]
                web.append((base[0] + ((q[0] + q2[0]) / 2 - base[0]) * 0.74, base[1] + ((q[1] + q2[1]) / 2 - base[1]) * 0.74))
        T.poly(web, mix(legc, '#c9c08a', 0.45))
        for q in tips:
            T.line([(base[0], base[1]), q], L * 0.018, legc)
            T.ell(q, (L * 0.011, L * 0.011), legc)
        T.on()
        T.plate(web, 0.005)
        for q in tips:
            tube((base[0], base[1], z + L * 0.012), (q[0], q[1], L * 0.012), L * 0.011, T.mat, r2=L * 0.007, seg=5)
            ball((q[0], q[1], L * 0.012), L * 0.009, T.mat, sub=1)
        limb(T, [hip, knee], [L * 0.078, L * 0.056], legc, bands=[3], bandc=c2)
        limb(T, [knee, heel], [L * 0.052, L * 0.032], legc, bands=[3], bandc=c2)
        # 앞다리: 어깨 → 팔꿈치(옆) → 손목(앞 안쪽) → 손가락 넷
        sh, el, wr = (s * L * 0.15, -L * 0.1, z + L * 0.07), (s * L * 0.3, -L * 0.04, z + L * 0.05), (s * L * 0.215, -L * 0.2, z + L * 0.016)
        limb(T, [sh, el, wr], [L * 0.04, L * 0.032, L * 0.022], legc, bands=[1, 2], bandc=c2)
        T.off()
        for (deg, ln) in ((-48, 0.05), (-18, 0.065), (12, 0.07), (44, 0.055)):
            vx, vy = rot(-0.5 * s, -1.0, deg * s)
            dd = math.hypot(vx, vy)
            q = (wr[0] + vx / dd * L * ln, wr[1] + vy / dd * L * ln)
            T.line([(wr[0], wr[1]), q], L * 0.016, legc)
            T.on()
            tube((wr[0], wr[1], wr[2]), (q[0], q[1], L * 0.01), L * 0.009, T.mat, r2=L * 0.006, seg=5)
            ball((q[0], q[1], L * 0.01), L * 0.008, T.mat, sub=1)
            T.off()
        T.on()
    # 몸
    wf = via([(0, 0.2), (0.08, 0.56), (0.28, 0.86), (0.55, 1.0), (0.8, 0.8), (1, 0.3)])
    Y = lambda t: -L * 0.46 + L * 0.76 * t
    BW = L * 0.44
    T.shell(-L * 0.46, L * 0.3, wf, via([(0, 0.3), (0.25, 0.9), (0.55, 1), (1, 0.4)]), BW, L * 0.24, col, n=12, seg=8)
    for s in (1, -1):                             # 옆구리는 밝다
        T.line([(s * wf(t) * BW * 0.5 * 0.9, Y(t)) for t in [0.2 + 0.7 * i / 10 for i in range(11)]], L * 0.045, side)
    rnd = random.Random(9)
    for _ in range(k.get('spots', 16)):           # 등의 검은 얼룩(크기와 모양이 제각각)
        x, y = rnd.uniform(-0.19, 0.19) * L, rnd.uniform(-0.2, 0.25) * L
        if abs(x) < L * 0.03:
            continue
        rx, ry = L * rnd.uniform(0.018, 0.04), L * rnd.uniform(0.016, 0.032)
        T.ell((x, y), (rx, ry), c2)
        T.ell((x + rx * 0.7, y + ry * 0.5), (rx * 0.6, ry * 0.7), c2)
    for s in (1, -1):                             # 등옆융기(눈 뒤에서 엉덩이까지 이어지는 밝은 줄)
        T.line([(s * L * 0.1, -L * 0.24), (s * L * 0.165, -L * 0.02), (s * L * 0.15, L * 0.12), (s * L * 0.09, L * 0.25)], L * 0.02, k.get('fold', '#c9b46a'))
    if k.get('stripe'):                           # 등 가운데의 밝은 줄
        T.line([(0, -L * 0.43), (0, L * 0.27)], L * 0.026, k['stripe'])
    for s in (1, -1):
        T.ell((s * L * 0.19, -L * 0.285), (L * 0.03, L * 0.03), k.get('ear', '#7a5a34'))        # 고막
        T.ell((s * L * 0.19, -L * 0.285), (L * 0.016, L * 0.016), shade(k.get('ear', '#7a5a34'), 0.8))
        T.ell((s * L * 0.035, -L * 0.435), (L * 0.007, L * 0.007), '#1a1a12')                   # 콧구멍
    T.on()
    for s in (1, -1):                             # 눈두덩 위에 솟은 눈: 금빛 홍채에 가로로 긴 눈동자
        ball((s * L * 0.115, -L * 0.3, z + L * 0.175), L * 0.062, T.mat, sub=2)
    T.off()
    for s in (1, -1):
        ball((s * L * 0.13, -L * 0.305, z + L * 0.2), L * 0.05, k.get('eye', '#c9a23a'), sub=2)
        ball((s * L * 0.15, -L * 0.31, z + L * 0.212), 1.0, '#141410', (L * 0.034, L * 0.03, L * 0.022), sub=2)
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
    """아귀: 몸의 절반이 넘는 넓적한 머리, 머리 앞을 가로지르는 큰 입(아래턱이 더 나왔다), 머리 뒤 양옆의 팔 같은 가슴지느러미, 머리 위의 낚싯대"""
    L = k.get('len', 0.9)
    col, c2 = k['col'], k.get('col2', shade(k['col'], 0.6))
    pale = shade(col, 1.35)
    W = L * 0.76                                  # 머리 폭
    T = Top(m, name, W * 0.8, L * 0.56, L * 0.58, px=240, bg=col, z0=0.012)
    z = T.z0
    y0, y1 = -L * 0.5, L * 0.42
    Y = lambda t: y0 + (y1 - y0) * t
    wf = via([(0, 0.76), (0.05, 0.95), (0.17, 1.0), (0.36, 0.93), (0.48, 0.66), (0.58, 0.4), (0.76, 0.24), (1, 0.13)])
    for s in (1, -1):                             # 가슴지느러미: 몸에서 뻗은 굵은 자루 끝에 부채꼴
        root = (s * wf(0.5) * W * 0.5 * 0.8, Y(0.5))
        hub = (s * W * 0.42, Y(0.55))
        arc = []
        for i in range(9):
            a = math.radians(-58 + 150 * i / 8)
            r = L * (0.15 + 0.02 * math.sin(math.pi * i / 8))
            arc.append((hub[0] + s * math.cos(a) * r, hub[1] + math.sin(a) * r))
        fin = [(root[0], root[1] - L * 0.045)] + arc + [(root[0], root[1] + L * 0.06)]
        T.poly(fin, shade(col, 0.88))
        for q in arc:                             # 지느러미 살
            T.line([hub, q], L * 0.007, c2)
        for i in range(8):                        # 끝이 살짝 갈라진 가장자리
            mx_, my_ = (arc[i][0] + arc[i + 1][0]) / 2, (arc[i][1] + arc[i + 1][1]) / 2
            T.ell((mx_, my_), (L * 0.012, L * 0.012), shade(col, 1.15))
        T.plate(fin, z + L * 0.02)
        T.line([root, hub], L * 0.085, col)
    tail = [(-L * 0.04, L * 0.4), (-L * 0.1, L * 0.5), (-L * 0.07, L * 0.56), (0, L * 0.545), (L * 0.07, L * 0.56), (L * 0.1, L * 0.5), (L * 0.04, L * 0.4)]
    T.poly(tail, shade(col, 0.86))
    for x in (-0.07, -0.035, 0.0, 0.035, 0.07):
        T.line([(x * L * 0.5, L * 0.42), (x * L, L * 0.545)], L * 0.006, c2)
    T.plate(tail, z + L * 0.03)
    T.shell(y0, y1, wf, via([(0, 0.5), (0.17, 1), (0.48, 0.74), (1, 0.3)]), W, L * 0.16, col, n=16, seg=8, px=1.6)
    T.on()
    for s in (1, -1):                             # 가슴지느러미 자루
        root = (s * wf(0.5) * W * 0.5 * 0.8, Y(0.5), z + L * 0.05)
        tube(root, (s * W * 0.42, Y(0.55), z + L * 0.03), L * 0.045, T.mat, r2=L * 0.035, seg=7)
        ball((s * W * 0.42, Y(0.55), z + L * 0.03), L * 0.036, T.mat, sub=2)
    T.blotch(c2, L * 0.06, 0.56, alpha=0.55)
    T.blotch(pale, L * 0.04, 0.72, alpha=0.5, seed=11)
    T.speck(shade(col, 0.5), 50, L * 0.006, (-W * 0.42, W * 0.42, -L * 0.36, L * 0.34))
    T.speck(pale, 30, L * 0.005, (-W * 0.4, W * 0.4, -L * 0.36, L * 0.3), seed=13)
    rnd = random.Random(2)
    for i in range(26):                           # 머리 가장자리의 너덜너덜한 살갗 돌기
        t = 0.03 + 0.5 * i / 26
        for s in (1, -1):
            x, y = s * wf(t) * W * 0.5, Y(t)
            T.poly([(x - s * L * 0.012, y - L * 0.012), (x + s * L * 0.03, y + rnd.uniform(-0.012, 0.012) * L), (x - s * L * 0.012, y + L * 0.012)], shade(col, 0.8))
    # 위를 향해 벌어진 커다란 입: 머리 앞을 가로지르는 짙은 초승달과 안쪽으로 누운 뾰족한 이
    mw = W * 0.4
    my = Y(0.035)
    up_ = [(-mw + 2 * mw * i / 14, my + L * 0.045 * math.sin(math.pi * i / 14)) for i in range(15)]         # 윗입술(뒤쪽)
    lo_ = [(-mw + 2 * mw * i / 14, my - L * 0.022 * math.sin(math.pi * i / 14)) for i in range(15)]         # 아랫입술(앞쪽, 더 나왔다)
    T.poly(lo_ + list(reversed(up_)), '#2a1a18')
    T.line(lo_, L * 0.012, shade(col, 1.2))
    for i in range(1, 14):
        x = -mw + 2 * mw * i / 14
        yl = my - L * 0.022 * math.sin(math.pi * i / 14)
        T.poly([(x - L * 0.008, yl), (x + L * 0.002, yl + L * 0.03), (x + L * 0.008, yl)], '#f8f3e4')
        yu = my + L * 0.045 * math.sin(math.pi * i / 14)
        T.poly([(x - L * 0.012, yu), (x - L * 0.006, yu - L * 0.02), (x, yu)], '#f8f3e4')
    T.off()
    for s in (1, -1):                             # 머리 위로 솟은 눈
        ball((s * W * 0.13, Y(0.2), z + L * 0.15), L * 0.036, shade(col, 0.9), sub=2)
        ball((s * W * 0.135, Y(0.195), z + L * 0.168), L * 0.026, k.get('eye', '#d9c06a'), sub=2)
        ball((s * W * 0.138, Y(0.19), z + L * 0.183), 1.0, '#1a1a1a', (L * 0.016, L * 0.012, L * 0.009), sub=1)
    chain([(0, Y(0.085), z + L * 0.12), (0, Y(0.07), z + L * 0.27), (0, Y(-0.06), z + L * 0.34), (0, Y(-0.12), z + L * 0.3)], L * 0.008, c2, r2=L * 0.004)     # 낚싯대(유인 돌기)
    lump((0, Y(-0.13), z + L * 0.295), L * 0.026, k.get('lure', '#f3ecd6'), (1, 1.3, 0.8), seed=3, amp=0.2, sub=1, smooth=True)
    for i in (1, 2):                              # 낚싯대 뒤의 가시 두 개
        tube((0, Y(0.085 + i * 0.07), z + L * 0.15), (0, Y(0.1 + i * 0.07), z + L * 0.26 - i * L * 0.03), L * 0.006, c2, r2=0.002, seg=4)
    T.finish()


def squid(m, name, k):
    """오징어(살오징어): 원뿔 몸통 끝의 세모 지느러미, 다리 여덟에 긴 더듬이팔 둘. 헤엄치는 모습이라 다 만든 뒤 옆으로 눕힌다."""
    L = k.get('len', 0.9)
    col, c2 = k['col'], k.get('col2', shade(k['col'], 0.62))
    T = Top(m, name, L * 0.3, L * 0.52, L * 0.52, px=176, bg=col, z0=0.0)
    MW = L * 0.2
    fin = [(0, L * 0.19), (L * 0.2, L * 0.37), (L * 0.05, L * 0.5), (0, L * 0.5), (-L * 0.05, L * 0.5), (-L * 0.2, L * 0.37)]
    T.poly(fin, shade(col, 1.08))
    T.plate(fin, 0.0)
    # 다리: 그림에 먼저 그리고 같은 길로 관을 만든다
    arms = []
    for i in range(8):
        x0 = (i - 3.5) / 3.5 * L * 0.05
        ln = L * (0.22 + 0.04 * math.sin(i * 1.7))
        arms.append(([(x0, -L * 0.2), (x0 * 1.8, -L * 0.2 - ln * 0.5), (x0 * 2.2 + L * 0.01 * math.sin(i), -L * 0.2 - ln)], L * 0.018))
    for s in (1, -1):
        arms.append(([(s * L * 0.03, -L * 0.2), (s * L * 0.1, -L * 0.36), (s * L * 0.07, -L * 0.5)], L * 0.012))
    for pts, r in arms:
        T.line(pts, r * 2.2, shade(col, 1.15))
    for s in (1, -1):                             # 더듬이팔 끝의 넓적한 부분
        T.ell((s * L * 0.07, -L * 0.485), (L * 0.022, L * 0.04), shade(col, 1.15))
    for pts, r in arms:
        chain([(x, y, 0.0) for x, y in pts], r, T.mat, r2=r * 0.5, seg=5)
    for s in (1, -1):
        ball((s * L * 0.07, -L * 0.485, 0.0), 1.0, T.mat, (L * 0.022, L * 0.04, L * 0.012), sub=1)
    T.shell(-L * 0.22, -L * 0.08, via([(0, 0.7), (0.5, 1), (1, 0.9)]), const(1.0), L * 0.13, L * 0.06, shade(col, 1.05), n=4, seg=5, full=True)
    wf = via([(0, 0.8), (0.12, 1.0), (0.55, 0.86), (0.85, 0.5), (1, 0.06)])
    T.shell(-L * 0.1, L * 0.5, wf, wf, MW, MW * 0.5, col, n=12, seg=6, full=True)
    T.line([(0, -L * 0.08), (0, L * 0.46)], L * 0.03, c2)                       # 등 가운데의 짙은 줄
    rnd = random.Random(5)
    for _ in range(90):                           # 색소포(자잘한 점)
        y = rnd.uniform(-0.08, 0.46) * L
        x = rnd.uniform(-0.5, 0.5) * MW * wf((y + L * 0.1) / (L * 0.6)) * 0.9
        T.ell((x, y), (L * 0.005 * rnd.uniform(0.6, 1.5),) * 2, c2)
    for s in (1, -1):                             # 눈
        T.ell((s * L * 0.055, -L * 0.15), (L * 0.028, L * 0.03), '#f6f2e6')
        T.ell((s * L * 0.06, -L * 0.15), (L * 0.016, L * 0.02), '#1a1a22')
    T.on()
    for s in (1, -1):
        ball((s * L * 0.055, -L * 0.15, 0.0), 1.0, T.mat, (L * 0.03, L * 0.032, L * 0.045), sub=1)
    T.finish()
    xform(list(cur().bm.faces), Matrix.Rotation(math.radians(90), 4, 'X') @ Matrix.Rotation(math.radians(90), 4, 'Z'))      # 다리가 +X, 등이 앞(-Y)


def octopus(m, name, k):
    """문어: 둥근 몸통 주머니가 뒤에, 눈이 툭 불거진 머리, 머리 앞에서 사방으로 길게 뻗어 끝이 말린 다리 여덟"""
    L = k.get('len', 0.8)
    col, c2 = k['col'], k.get('col2', shade(k['col'], 0.66))
    pale = k.get('pale', '#f6dccf')
    T = Top(m, name, L * 0.7, L * 0.66, L * 0.62, px=256, bg=col, z0=0.012)
    z = T.z0
    cx, cy = 0.0, -L * 0.02                        # 다리가 모이는 곳
    N = 18
    rad = lambda f: L * (0.046 * (1 - f) ** 0.75 + 0.006)
    arms = []
    for s in (1, -1):                              # (앞에서 옆으로 잰 각도, 길이, 말리는 쪽, 흔들림)
        for (deg, ln, bend, sway) in ((17, 0.62, 1.0, -0.25), (55, 0.66, 1.0, 0.3), (98, 0.62, -1.0, -0.3), (140, 0.56, -1.0, 0.25)):
            a = math.radians(deg)
            hx, hy = s * math.sin(a), -math.cos(a)
            x, y = cx + hx * L * 0.06, cy + hy * L * 0.06
            th = math.atan2(hy, hx)
            pts = [(x, y)]
            step = ln * L / N
            for j in range(N):
                f = j / N
                turn = sway * 0.16 * math.cos(f * math.pi * 1.6) if f < 0.66 else bend * (0.2 + 1.5 * (f - 0.66))     # 느슨하게 굽이치다가 끝에서 말린다
                th += s * turn
                sc = 1.0 if f < 0.66 else 1 - 0.55 * (f - 0.66) / 0.34
                x, y = x + math.cos(th) * step * sc, y + math.sin(th) * step * sc
                pts.append((x, y))
            arms.append((pts, s * bend))
    for pts, _ in arms:                            # 그림: 굵은 데서 가늘어지는 다리
        for j in range(N):
            for q in range(4):
                f = (j + q / 4) / N
                T.ell((pts[j][0] + (pts[j + 1][0] - pts[j][0]) * q / 4, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * q / 4), (rad(f), rad(f)), col)
    T.blotch(c2, L * 0.045, 0.56, alpha=0.5)
    T.blotch(pale, L * 0.03, 0.76, alpha=0.35, seed=12)
    for pts, sg in arms:                           # 말린 끝의 안쪽으로 비치는 빨판
        for j in range(int(N * 0.6), N):
            f = j / N
            dx, dy = pts[j + 1][0] - pts[j][0], pts[j + 1][1] - pts[j][1]
            d = math.hypot(dx, dy) or 1.0
            r = rad(f)
            side = 1 if sg > 0 else -1
            T.ell((pts[j][0] - side * dy / d * r * 0.7, pts[j][1] + side * dx / d * r * 0.7), (max(L * 0.004, r * 0.3),) * 2, pale)
    T.on()
    for pts, _ in arms:
        for j in range(N):
            r0, r1 = rad(j / N), rad((j + 1) / N)
            tube((pts[j][0], pts[j][1], z + r0 * 0.8), (pts[j + 1][0], pts[j + 1][1], z + r1 * 0.8), r0, T.mat, r2=r1, seg=7)
            if j and (j >= N * 0.6 or j % 2 == 0):       # 굽은 곳의 틈을 메우는 마디(곧은 데서는 하나 걸러)
                ball((pts[j][0], pts[j][1], z + r0 * 0.8), r0 * 1.01, T.mat, sub=1)
    # 다리 밑동을 잇는 막, 머리, 몸통 주머니
    T.shell(cy - L * 0.12, cy + L * 0.12, sup(2.0), via([(0, 0.5), (0.5, 1), (1, 0.8)]), L * 0.25, L * 0.09, col, n=6, seg=8)
    T.shell(-L * 0.05, L * 0.13, sup(2.2), via([(0, 0.6), (0.5, 1), (1, 0.9)]), L * 0.22, L * 0.15, col, n=6, seg=8)
    T.shell(L * 0.04, L * 0.44, via([(0, 0.62), (0.25, 0.92), (0.55, 1.0), (0.85, 0.72), (1, 0.4)]), via([(0, 0.62), (0.45, 1), (1, 0.5)]), L * 0.3, L * 0.23, col, n=10, seg=10)
    T.blotch(c2, L * 0.05, 0.6, [(-L * 0.17, -L * 0.16), (L * 0.17, -L * 0.16), (L * 0.17, L * 0.46), (-L * 0.17, L * 0.46)], alpha=0.55, seed=8)
    T.speck(pale, 30, L * 0.007, (-L * 0.12, L * 0.12, -L * 0.1, L * 0.4))
    T.speck(shade(col, 0.6), 22, L * 0.006, (-L * 0.12, L * 0.12, -L * 0.1, L * 0.4), seed=6)
    T.on()
    for s in (1, -1):                              # 툭 불거진 눈두덩
        ball((s * L * 0.09, L * 0.01, z + L * 0.125), L * 0.045, T.mat, sub=2)
    T.off()
    for s in (1, -1):                              # 가로로 긴 눈동자
        ball((s * L * 0.112, -L * 0.002, z + L * 0.14), 1.0, '#f3e6b8', (L * 0.028, L * 0.026, L * 0.024), sub=2)
        ball((s * L * 0.125, -L * 0.01, z + L * 0.145), 1.0, '#1a1a1a', (L * 0.02, L * 0.011, L * 0.008), sub=1)
    T.finish()


def seahorse(m, name, k):
    """해마: 옆모습. 관처럼 긴 주둥이, 왕관 돌기, 볼록한 배, 앞으로 말린 꼬리, 몸을 두른 마디"""
    H = k.get('len', 0.6)
    col, c2 = k['col'], k.get('col2', shade(k['col'], 0.7))
    cv = Canvas(-H * 0.3, H * 0.4, -H * 0.54, H * 0.56, px=128, bg=col)
    mname = 'tx_' + name
    mat = tex_material(mname)
    register_mat(mname, mat)
    # 몸의 가운데 줄(x, z)과 굵기
    key = [((0.02, 0.33), 0.062), ((-0.03, 0.24), 0.07), ((0.03, 0.12), 0.1), ((0.06, -0.01), 0.112), ((0.01, -0.14), 0.08), ((-0.05, -0.26), 0.054),
           ((-0.04, -0.37), 0.04), ((0.03, -0.44), 0.03), ((0.1, -0.41), 0.022), ((0.11, -0.34), 0.016), ((0.07, -0.31), 0.011)]
    ctr = smooth([(x * H, z * H) for (x, z), r in key], 3)
    rad = []
    n = len(ctr)
    for i in range(n):
        f = i / (n - 1) * (len(key) - 1)
        j = min(len(key) - 2, int(f))
        rad.append((key[j][1] + (key[j + 1][1] - key[j][1]) * (f - j)) * H)
    for (x, z), r in zip(ctr, rad):               # 몸
        cv.ellipse((x, z), (r, r), col)
    for i in range(0, n - 1):                     # 배 쪽은 밝게
        cv.ellipse((ctr[i][0] + rad[i] * 0.45, ctr[i][1]), (rad[i] * 0.5, rad[i] * 0.7), shade(col, 1.18))
    for i in range(1, n - 1, 2):                  # 몸을 두른 마디
        dx, dz = ctr[i + 1][0] - ctr[i - 1][0], ctr[i + 1][1] - ctr[i - 1][1]
        d = math.hypot(dx, dz) or 1
        px_, pz_ = -dz / d * rad[i], dx / d * rad[i]
        cv.line([(ctr[i][0] - px_, ctr[i][1] - pz_), (ctr[i][0] + px_, ctr[i][1] + pz_)], H * 0.012, c2)
    # 머리와 주둥이
    hx, hz = 0.07 * H, 0.38 * H
    cv.ellipse((hx, hz), (H * 0.085, H * 0.07), col)
    cv.line([(hx + H * 0.05, hz - H * 0.015), (hx + H * 0.24, hz - H * 0.055)], H * 0.05, col)
    cv.ellipse((hx + H * 0.245, hz - H * 0.056), (H * 0.03, H * 0.03), shade(col, 0.9))
    cv.line([(hx - H * 0.02, hz + H * 0.02), (hx + H * 0.1, hz - H * 0.03)], H * 0.012, c2)
    cv.ellipse((hx + H * 0.03, hz + H * 0.012), (H * 0.03, H * 0.03), '#f6f0d8')
    cv.ellipse((hx + H * 0.034, hz + H * 0.012), (H * 0.017, H * 0.017), '#1e1a22')
    rnd = random.Random(3)
    for _ in range(26):
        i = rnd.randrange(2, n - 6)
        cv.ellipse((ctr[i][0] + rnd.uniform(-0.6, 0.6) * rad[i], ctr[i][1] + rnd.uniform(-0.3, 0.3) * rad[i]), (H * 0.007,) * 2, shade(col, 1.3))
    fin = [(-0.085 * H, 0.1 * H), (-0.2 * H, 0.12 * H), (-0.22 * H, 0.0), (-0.19 * H, -0.1 * H), (-0.06 * H, -0.08 * H)]      # 등지느러미
    fc = k.get('fin', shade(col, 1.3))
    cv.poly(fin, fc)
    for i in range(6):
        cv.line([(-0.07 * H, (0.08 - i * 0.03) * H), (-0.2 * H, (0.11 - i * 0.04) * H)], H * 0.006, shade(fc, 0.8))
    tex_image(mat, cv.finish())
    set_proj(lambda co: cv.uv(co.x, co.z))
    mesh_uv([(x, 0.0, z) for x, z in fin], [tuple(range(len(fin)))], mname, [cv.uv(x, z) for x, z in fin], smooth=False)
    for i in range(n - 1):
        tube((ctr[i][0], 0, ctr[i][1]), (ctr[i + 1][0], 0, ctr[i + 1][1]), rad[i], mname, r2=rad[i + 1], seg=8)
        ball((ctr[i][0], 0, ctr[i][1]), 1.0, mname, (rad[i], rad[i] * 0.86, rad[i]), sub=1)
    ball((hx, 0, hz), 1.0, mname, (H * 0.085, H * 0.06, H * 0.07), sub=2)
    tube((hx + H * 0.05, 0, hz - H * 0.015), (hx + H * 0.24, 0, hz - H * 0.055), H * 0.027, mname, r2=H * 0.022, seg=7)
    ball((hx + H * 0.245, 0, hz - H * 0.056), H * 0.03, mname, sub=1)
    for s in (1, -1):
        ball((hx + H * 0.03, s * H * 0.05, hz + H * 0.012), 1.0, mname, (H * 0.03, H * 0.014, H * 0.03), sub=1)
    set_proj(None)
    for dx, hh in ((-0.03, 0.05), (0.0, 0.07), (0.03, 0.05)):        # 왕관 돌기
        cone((hx - H * 0.02 + dx * H, 0, hz + H * 0.055), H * 0.014, hh * H, c2, seg=5)
    for s in (1, -1):                             # 작은 가슴지느러미
        poly([(hx - H * 0.05, s * H * 0.05, hz - H * 0.05), (hx - H * 0.1, s * H * 0.09, hz - H * 0.03), (hx - H * 0.1, s * H * 0.08, hz - H * 0.09)], [(0, 1, 2)], fc)


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


SEA_FN = {'crab': crab, 'crayfish': crayfish, 'turtle': turtle, 'ray': ray, 'frog': frog, 'tadpole': tadpole, 'angler': angler, 'jelly': jelly, 'squid': squid, 'octopus': octopus, 'seahorse': seahorse}
