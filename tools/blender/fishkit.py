"""물고기 모델: 종마다 옆모습 그림을 그리고, 같은 윤곽으로 3D 몸을 만들어 그 그림을 입힌다.

머리가 +X, 옆모습이 정면(-Y)을 향한다. 몸은 둥글게 부풀린 덩어리이고 지느러미는 얇은 판이다.
종의 생김새는 data/fish.json 의 look 에 적는다(아래 KEYS 참고). 값이 없으면 FAMILY 의 기본값을 쓴다.

look 의 주요 값
  f    무리(기본 틀): minnow carp trout catfish loach perch bream snake goby eel ribbon herring mackerel tuna
                      flat puffer file cod shark jack needle …
  len  모델 길이(칸),  dep 몸높이/길이,  peak 가장 높은 곳(0~1),  back 등 쪽 비율,  snout 주둥이 뭉툭함,  ped 꼬리자루 굵기
  wr   몸 두께/높이,   nose 주둥이 끝의 높낮이(음수면 아래로 향한 입)
  col  [등, 옆구리, 배] 색,  fin 지느러미 색,  tailc 꼬리 색,  iris 눈 색
  d d2 a  등지느러미·둘째 등지느러미·뒷지느러미 [시작, 끝, 높이, 모양],  ad 기름지느러미 위치,  v 배지느러미 [위치, 길이],  p 가슴지느러미 [위치, 길이]
  c    꼬리 [모양, 폭, 파인 정도]  모양: fork lunate round trunc emarg point shark
  pat  무늬 목록: ["bars", 개수, 색, …] 등(PATTERNS 참고)
"""
import math
import random
from lib import *
from paint import *

XB = 0.8          # 몸통이 차지하는 길이(나머지는 꼬리지느러미)

FAMILY = {
    'minnow': dict(dep=0.2, peak=0.36, back=0.5, snout=0.16, ph=0.7, pt=1.3, ped=0.36, wr=0.5, d=[0.42, 0.58, 0.55, 'tri'], a=[0.66, 0.8, 0.45, 'tri'], v=[0.46, 0.3], p=[0.2, 0.42], c=['fork', 1.15, 0.55]),
    'carp': dict(dep=0.3, peak=0.36, back=0.56, snout=0.18, ph=0.72, pt=1.2, ped=0.36, wr=0.5, d=[0.34, 0.8, 0.42, 'long'], a=[0.7, 0.82, 0.42, 'tri'], v=[0.46, 0.34], p=[0.22, 0.42], c=['fork', 1.0, 0.42]),
    'trout': dict(dep=0.22, peak=0.38, back=0.5, snout=0.14, ph=0.7, pt=1.25, ped=0.36, wr=0.52, d=[0.4, 0.56, 0.55, 'tri'], ad=0.8, a=[0.68, 0.82, 0.45, 'tri'], v=[0.5, 0.3], p=[0.2, 0.42], c=['emarg', 1.05, 0.22]),
    'catfish': dict(dep=0.2, peak=0.22, back=0.5, snout=0.5, ph=0.6, pt=1.0, ped=0.4, wr=0.75, d=[0.26, 0.34, 0.4, 'tri'], a=[0.46, 0.99, 0.5, 'low'], v=[0.4, 0.26], p=[0.18, 0.4], c=['round', 0.9, 0], barb=[2, 0.45]),
    'loach': dict(dep=0.11, peak=0.3, back=0.5, snout=0.3, ph=0.6, pt=0.9, ped=0.6, wr=0.85, d=[0.5, 0.62, 0.6, 'round'], a=[0.76, 0.86, 0.5, 'round'], v=[0.54, 0.3], p=[0.14, 0.5], c=['round', 1.2, 0], barb=[3, 0.12]),
    'perch': dict(dep=0.3, peak=0.34, back=0.56, snout=0.16, ph=0.75, pt=1.2, ped=0.34, wr=0.46, d=[0.3, 0.56, 0.5, 'spiny'], d2=[0.58, 0.8, 0.55, 'round'], a=[0.64, 0.8, 0.45, 'round'], v=[0.36, 0.34], p=[0.26, 0.4], c=['emarg', 1.0, 0.18]),
    'bream': dict(dep=0.42, peak=0.36, back=0.6, snout=0.2, ph=0.8, pt=1.15, ped=0.26, wr=0.36, d=[0.28, 0.84, 0.38, 'spiny'], a=[0.62, 0.84, 0.36, 'round'], v=[0.36, 0.3], p=[0.26, 0.5], c=['fork', 1.0, 0.45]),
    'snake': dict(dep=0.14, peak=0.3, back=0.5, snout=0.4, ph=0.6, pt=0.9, ped=0.6, wr=0.85, d=[0.3, 0.97, 0.5, 'low'], a=[0.5, 0.97, 0.45, 'low'], v=[0.34, 0.25], p=[0.2, 0.5], c=['round', 1.0, 0]),
    'goby': dict(dep=0.18, peak=0.2, back=0.52, snout=0.5, ph=0.6, pt=1.0, ped=0.42, wr=0.8, d=[0.24, 0.4, 0.55, 'round'], d2=[0.46, 0.8, 0.5, 'round'], a=[0.52, 0.8, 0.4, 'round'], v=[0.24, 0.26], p=[0.2, 0.5], c=['round', 1.0, 0]),
    'eel': dict(dep=0.065, peak=0.18, back=0.5, snout=0.45, ph=0.6, pt=0.7, ped=0.3, wr=0.9, fringe=[0.3, 0.45, 0.34], p=[0.12, 0.6], c=None, wave=0.035),
    'ribbon': dict(dep=0.085, peak=0.2, back=0.5, snout=0.2, ph=0.8, pt=0.9, ped=0.05, wr=0.3, d=[0.14, 0.99, 0.5, 'low'], p=[0.13, 0.5], c=None, tailpoint=True),
    'herring': dict(dep=0.22, peak=0.4, back=0.46, snout=0.14, ph=0.7, pt=1.3, ped=0.3, wr=0.4, d=[0.44, 0.58, 0.5, 'tri'], a=[0.72, 0.86, 0.3, 'low'], v=[0.5, 0.25], p=[0.2, 0.4], c=['fork', 1.2, 0.65]),
    'mackerel': dict(dep=0.21, peak=0.36, back=0.5, snout=0.1, ph=0.8, pt=1.5, ped=0.16, wr=0.6, d=[0.28, 0.42, 0.5, 'tri'], d2=[0.62, 0.72, 0.36, 'tri'], a=[0.64, 0.74, 0.34, 'tri'], finlets=5, v=[0.34, 0.26], p=[0.24, 0.36], c=['fork', 1.3, 0.75]),
    'tuna': dict(dep=0.28, peak=0.36, back=0.52, snout=0.1, ph=0.8, pt=1.5, ped=0.1, wr=0.68, d=[0.28, 0.5, 0.42, 'spiny'], d2=[0.56, 0.66, 0.6, 'sail'], a=[0.6, 0.7, 0.55, 'sail'], finlets=7, v=[0.34, 0.24], p=[0.26, 0.55], c=['lunate', 1.7, 0.9]),
    'jack': dict(dep=0.26, peak=0.36, back=0.52, snout=0.14, ph=0.8, pt=1.4, ped=0.14, wr=0.5, d=[0.3, 0.44, 0.36, 'spiny'], d2=[0.46, 0.92, 0.4, 'sail'], a=[0.56, 0.92, 0.34, 'sail'], v=[0.34, 0.26], p=[0.26, 0.5], c=['fork', 1.4, 0.75]),
    'flat': dict(dep=0.5, peak=0.42, back=0.5, snout=0.12, ph=0.9, pt=1.1, ped=0.22, wr=0.16, d=[0.1, 0.95, 0.3, 'low'], a=[0.26, 0.95, 0.3, 'low'], p=[0.24, 0.3], c=['round', 0.8, 0], flat='L'),
    'puffer': dict(dep=0.36, peak=0.36, back=0.56, snout=0.3, ph=0.6, pt=1.1, ped=0.28, wr=0.78, d=[0.7, 0.8, 0.4, 'round'], a=[0.72, 0.82, 0.38, 'round'], p=[0.34, 0.4], c=['trunc', 0.8, 0]),
    'file': dict(dep=0.52, peak=0.44, back=0.52, snout=0.1, ph=1.0, pt=1.1, ped=0.2, wr=0.26, d=[0.5, 0.88, 0.3, 'low'], a=[0.56, 0.88, 0.3, 'low'], p=[0.34, 0.3], c=['round', 0.75, 0], spine=0.3),
    'cod': dict(dep=0.22, peak=0.3, back=0.5, snout=0.22, ph=0.7, pt=1.2, ped=0.24, wr=0.6, d=[0.26, 0.42, 0.5, 'tri'], d2=[0.45, 0.64, 0.42, 'tri'], d3=[0.67, 0.84, 0.36, 'tri'], a=[0.46, 0.64, 0.38, 'round'], a2=[0.67, 0.84, 0.32, 'round'], v=[0.26, 0.26], p=[0.24, 0.4], c=['trunc', 0.9, 0.05], barb=[1, 0.1]),
    'shark': dict(dep=0.2, peak=0.34, back=0.5, snout=0.05, ph=0.9, pt=1.3, ped=0.14, wr=0.8, d=[0.36, 0.5, 0.8, 'sail'], d2=[0.76, 0.82, 0.3, 'tri'], a=[0.76, 0.82, 0.25, 'tri'], v=[0.62, 0.3], p=[0.3, 0.8], pect3d=50, c=['shark', 1.6, 0.6]),
    'sturgeon': dict(dep=0.15, peak=0.32, back=0.52, snout=0.03, ph=1.15, pt=0.9, ped=0.2, wr=0.9, d=[0.74, 0.86, 0.6, 'tri'], a=[0.78, 0.88, 0.5, 'tri'], v=[0.62, 0.3], p=[0.2, 0.5], c=['shark', 1.5, 0.6], barb=[2, 0.05]),
    'mola': dict(dep=0.66, peak=0.5, back=0.5, snout=0.3, ph=0.7, pt=0.45, ped=0.78, wr=0.28, d=[0.62, 0.82, 0.72, 'sail'], a=[0.62, 0.82, 0.72, 'sail'], p=[0.4, 0.16], c=['round', 1.45, 0]),
    'bill': dict(dep=0.17, peak=0.3, back=0.52, snout=0.08, ph=0.9, pt=1.3, ped=0.1, wr=0.6, bill=0.2, d=[0.1, 0.72, 1.5, 'sailfin'], d2=[0.8, 0.86, 0.3, 'tri'], a=[0.7, 0.8, 0.5, 'tri'], v=[0.3, 0.9], p=[0.22, 0.6], c=['lunate', 2.3, 0.9]),
    'flying': dict(dep=0.17, peak=0.36, back=0.5, snout=0.14, ph=0.8, pt=1.3, ped=0.24, wr=0.75, d=[0.72, 0.84, 0.4, 'tri'], a=[0.74, 0.84, 0.3, 'tri'], v=[0.56, 0.9], p=[0.24, 2.3], pect3d=12, c=['fork', 1.5, 0.7]),
    'stickle': dict(dep=0.24, peak=0.36, back=0.52, snout=0.1, ph=0.8, pt=1.4, ped=0.13, wr=0.45, spines=[0.3, 0.4, 0.5], d=[0.56, 0.8, 0.5, 'round'], a=[0.6, 0.8, 0.4, 'round'], v=[0.42, 0.5], p=[0.26, 0.5], c=['trunc', 1.0, 0.05]),
    'needle': dict(dep=0.085, peak=0.4, back=0.5, snout=0.05, ph=1.2, pt=1.2, ped=0.4, wr=0.7, d=[0.78, 0.9, 0.6, 'tri'], a=[0.78, 0.9, 0.6, 'tri'], v=[0.6, 0.3], p=[0.26, 0.5], c=['fork', 1.5, 0.6]),
}


def fam(sp):
    k = dict(FAMILY[sp.get('f', 'minnow')])
    k.update(sp)
    return k


class Fish:
    def __init__(self, name, sp):
        self.name = name
        k = self.k = fam(sp)
        self.L = L = k.get('len', 0.6)
        self.bill = k.get('bill', 0.0) * L               # 주둥이 앞으로 뻗은 부리(새치류)
        self.Lb = L - self.bill                          # 부리를 뺀 몸길이
        self.xh = L / 2 - self.bill
        self.dep = k['dep'] * self.Lb
        self.col = k.get('col', ['#6f8f9a', '#cfdfe2', '#f4f7f6'])
        self.fin = k.get('fin', mix(self.col[0], self.col[1], 0.5))
        d = self.dep
        fh = lambda keys: max([k[q][2] * d for q in keys if k.get(q)] + [0.0])
        tail = (k['c'][1] * d * 0.56) if k.get('c') else 0.0
        nz = abs(k.get('nose', 0)) * d
        up = max(d * k['back'] + k.get('hump', 0) * d + max(fh(('d', 'd2', 'd3')) * 1.05, k.get('spine', 0) * d, 0.2 * d), tail) + nz
        dn = max(d * (1 - k['back']) + max(fh(('a', 'a2')) * 1.05, (k['v'][1] * d * 0.8 if k.get('v') else 0), 0.2 * d), tail) + nz
        self.cv = Canvas(-L / 2 - 0.02, L / 2 + 0.03, -dn - 0.02, up + 0.02, px=k.get('px', 256), bg=self.col[1])
        self.polys = []          # 3D로 만들 지느러미 [(점 목록)]

    # ---------------------------------------------------------- 윤곽
    def f(self, u, peak):
        k = self.k
        u = min(1.0, max(0.0, u))
        if u <= peak:
            return k['snout'] + (1 - k['snout']) * math.sin(math.pi / 2 * (u / peak)) ** k['ph']
        v = (u - peak) / (1 - peak)
        return k['ped'] + (1 - k['ped']) * max(0.0, math.cos(math.pi / 2 * v)) ** k['pt']

    def mid(self, u):
        """몸의 가운데 줄 높이(주둥이가 위·아래로 향한 정도)"""
        return self.k.get('nose', 0.0) * self.dep * max(0.0, 1 - u / 0.3) ** 2

    def top(self, u):
        k = self.k
        return self.mid(u) + self.dep * k['back'] * self.f(u, k['peak']) + k.get('hump', 0) * self.dep * math.exp(-((u - 0.3) / 0.12) ** 2)

    def bot(self, u):
        k = self.k
        return self.mid(u) - self.dep * (1 - k['back']) * self.f(u, k.get('peak2', k['peak']))

    def x(self, u):
        return self.xh - u * XB * self.Lb

    def pt(self, u, t):
        """몸 위의 점: u=머리에서 꼬리 쪽(0~1), t=배에서 등 쪽(0~1)"""
        b, tp = self.bot(u), self.top(u)
        return (self.x(u), b + (tp - b) * t)

    def outline(self, n=40):
        us = [i / n for i in range(n + 1)]
        return [(self.x(u), self.top(u)) for u in us] + [(self.x(u), self.bot(u)) for u in reversed(us)]

    # ---------------------------------------------------------- 지느러미
    def fin_poly(self, spec, upper=True, n=14):
        u0, u1, h, shape = spec
        H = h * self.dep
        pts = []
        for i in range(n + 1):
            s = i / n
            u = u0 + (u1 - u0) * s
            if shape == 'tri':
                p = min(s / 0.2, 1.0) * (1 - 0.82 * max(0.0, (s - 0.2) / 0.8))
            elif shape == 'round':
                p = math.sin(math.pi * min(1, s * 1.08)) ** 0.55 if s < 0.93 else math.sin(math.pi * 0.93 * 1.0) ** 0.55 * (1 - (s - 0.93) / 0.07)
                p = max(0.0, math.sin(math.pi * s) ** 0.5)
            elif shape == 'long':
                p = min(s / 0.1, 1.0) * (1 - 0.55 * s)
            elif shape == 'sail':
                p = min(s / 0.14, 1.0) * (1 - 0.86 * max(0.0, (s - 0.14) / 0.86) ** 0.6)
            elif shape == 'sailfin':
                p = min(s / 0.07, 1.0) * (0.72 + 0.28 * math.sin(math.pi * s)) * min((1 - s) / 0.22, 1.0)
            elif shape == 'spiny':
                p = min(s / 0.16, 1.0) * (1 - 0.5 * s) * (1 - 0.2 * (0.5 + 0.5 * math.cos(s * n * math.pi)))
            else:   # low
                p = min(s / 0.06, 1.0) * min((1 - s) / 0.06, 1.0)
            base = self.top(u) if upper else self.bot(u)
            lean = (0.16 if shape in ('tri', 'sail', 'spiny', 'long') else 0.05) * H * p        # 뒤로 누운 느낌
            pts.append((self.x(u) - lean, base + (H * p if upper else -H * p)))
        base_pts = [(self.x(u0 + (u1 - u0) * i / n), (self.top if upper else self.bot)(u0 + (u1 - u0) * i / n) + (-1 if upper else 1) * self.dep * 0.04) for i in range(n + 1)]
        return pts, base_pts

    def draw_fin(self, pts, base_pts, col, rays=True):
        cv = self.cv
        poly = pts + list(reversed(base_pts))
        cv.poly(poly, col)
        k = self.k
        if k.get('finpat'):                              # 지느러미의 띠무늬 [색, 줄 수]
            fc, n = k['finpat']
            for i in range(1, n + 1):
                f = i / (n + 1)
                cv.line([(b[0] + (q[0] - b[0]) * f, b[1] + (q[1] - b[1]) * f) for b, q in zip(base_pts, pts)], self.L * 0.011, fc)
        if rays:
            dk = shade(col, 0.78)
            for i in range(0, len(pts), 2):
                cv.line([base_pts[i], pts[i]], self.L * 0.006, dk)
        if k.get('finedge'):
            cv.line(pts, self.L * 0.012, k['finedge'])
        self.polys.append((pts, base_pts))

    def caudal(self):
        k, cv = self.k, self.cv
        c = k.get('c')
        col = k.get('tailc', self.fin)
        xb = self.x(1.0)
        tb, bb = self.top(1.0), self.bot(1.0)
        if not c:
            return
        kind, span, fork = c
        S = span * self.dep * 0.5
        xe = -self.L / 2
        mid = (tb + bb) / 2
        if kind in ('fork', 'lunate', 'emarg', 'trunc'):
            depth = fork * (xb - xe)
            lobe = 0.5 if kind == 'lunate' else 0.9
            up = smooth([(xb + 0.01, tb), (xb - (xb - xe) * 0.45, mid + S * lobe), (xe, mid + S)], 5)
            lo = smooth([(xe, mid - S), (xb - (xb - xe) * 0.45, mid - S * lobe), (xb + 0.01, bb)], 5)
            notch = [(xe + depth * 0.5, mid + S * 0.45), (xe + depth, mid), (xe + depth * 0.5, mid - S * 0.45)] if fork > 0.02 else []
            pts = up + notch + lo
        elif kind == 'shark':
            pts = [(xb + 0.01, tb), (xe + (xb - xe) * 0.2, mid + S), (xe, mid + S * 1.05), (xe + (xb - xe) * 0.42, mid + S * 0.1), (xe + (xb - xe) * 0.3, mid - S * 0.5), (xe + (xb - xe) * 0.2, mid - S * 0.55), (xb + 0.01, bb)]
        elif kind == 'point':
            pts = [(xb + 0.01, tb), (xe, mid), (xb + 0.01, bb)]
        else:   # round
            pts = [(xb + 0.01, tb)] + [(xe + (xb - xe) * (0.5 - 0.5 * math.cos(a)) * 0.0 + (xb - (xb - xe) * math.sin(a)), mid + S * math.cos(a)) for a in [math.pi * i / 10 for i in range(1, 10)]] + [(xb + 0.01, bb)]
        cv.poly(pts, col)
        dk = shade(col, 0.78)
        for i in range(1, len(pts) - 1):
            cv.line([(xb, mid + (pts[i][1] - mid) * 0.25), pts[i]], self.L * 0.006, dk)
        if k.get('tailedge'):
            cv.line(pts[1:-1], self.L * 0.014, k['tailedge'])
        self.tail = pts

    def fins(self):
        k, cv = self.k, self.cv
        fc = self.fin
        for key, upper in (('d', True), ('d2', True), ('d3', True), ('a', False), ('a2', False)):
            if k.get(key):
                pts, base = self.fin_poly(k[key], upper)
                self.draw_fin(pts, base, k.get(key + 'c', fc))
        if k.get('ad') is not None:                    # 기름지느러미
            u = k['ad']
            x0, z0 = self.x(u), self.top(u)
            pts = [(x0, z0 - 0.002), (x0 - self.L * 0.035, z0 + self.dep * 0.16), (x0 - self.L * 0.05, z0 + self.dep * 0.1), (x0 - self.L * 0.03, z0 - 0.004)]
            cv.poly(pts, fc)
            self.polys.append((pts[:3], [pts[3]] * 3))
        if k.get('finlets'):
            n = k['finlets']
            for i in range(n):
                u = 0.75 + 0.2 * i / n
                for up in (1, -1):
                    z0 = self.top(u) if up > 0 else self.bot(u)
                    pts = [(self.x(u), z0), (self.x(u) - self.L * 0.022, z0 + up * self.dep * 0.1), (self.x(u) - self.L * 0.026, z0)]
                    cv.poly(pts, k.get('finletc', fc))
                    self.polys.append((pts, [pts[2]] * 3))
        if k.get('fringe'):                            # 뱀장어처럼 등에서 꼬리를 돌아 배까지 이어진 지느러미
            u0, u1, h = k['fringe']
            H = h * self.dep
            up = [(self.x(u0 + (1 - u0) * i / 16), self.top(u0 + (1 - u0) * i / 16) + H * min(1, i / 3)) for i in range(17)]
            tip = [(-self.L / 2, 0)]
            lo = [(self.x(u1 + (1 - u1) * i / 16), self.bot(u1 + (1 - u1) * i / 16) - H * min(1, i / 3)) for i in reversed(range(17))]
            cv.poly(up + tip + lo, fc)
            self.fringe_pts = up + tip + lo
        if k.get('v'):                                 # 배지느러미
            u, ln = k['v']
            x0, z0 = self.x(u), self.bot(u)
            ln *= self.dep
            pts = [(x0 + ln * 0.2, z0 + self.dep * 0.03), (x0 - ln * 0.5, z0 - ln * 0.75), (x0 - ln * 0.85, z0 - ln * 0.5), (x0 - ln * 0.5, z0 + self.dep * 0.03)]
            cv.poly(pts, k.get('vc', fc))
            self.polys.append((pts[:3], [pts[3]] * 3))
        for u in k.get('spines', []):                  # 큰가시고기의 등 가시
            x0, z0 = self.x(u), self.top(u)
            pts = [(x0 + self.L * 0.012, z0), (x0 - self.L * 0.035, z0 + self.dep * 0.3), (x0 - self.L * 0.02, z0)]
            cv.poly(pts, shade(self.col[0], 0.75))
            self.polys.append((pts, [pts[2]] * 3))
        if k.get('spine'):                             # 쥐치의 등 가시
            u = 0.26
            x0, z0 = self.x(u), self.top(u)
            pts = [(x0 + self.L * 0.01, z0), (x0 - self.L * 0.03, z0 + self.dep * k['spine']), (x0 - self.L * 0.03, z0)]
            cv.poly(pts, shade(self.col[0], 0.8))
            self.polys.append((pts, [pts[2]] * 3))

    def pectoral(self):
        k, cv = self.k, self.cv
        if not k.get('p'):
            return
        u, ln = k['p']
        ln *= self.dep
        x0, z0 = self.pt(u, 0.36)
        ang = math.radians(k.get('pang', 28))
        pts = [(x0, z0 + ln * 0.14)]
        for i in range(7):
            a = -ang - math.radians(48) * (i / 6 - 0.5)
            r = ln * (0.86 + 0.14 * math.sin(math.pi * i / 6))
            pts.append((x0 - math.cos(a) * r, z0 + math.sin(a) * r))
        pts.append((x0, z0 - ln * 0.14))
        col = k.get('pc', mix(self.fin, self.col[1], 0.35))
        cv.poly(pts, col)
        dk = shade(col, 0.8)
        for q in pts[1:-1]:
            cv.line([(x0, z0), q], self.L * 0.005, dk)
        self.pect = pts

    # ---------------------------------------------------------- 몸 색과 무늬
    def body(self):
        k, cv = self.k, self.cv
        back, side, belly = [np.array(rgb(c), dtype=np.float32) for c in self.col]
        W, H = cv.W, cv.H
        xs = cv.h0 + (np.arange(W) + 0.5) / cv.sx
        us = np.clip((self.xh - xs) / (XB * self.Lb), 0, 1)
        tp = np.array([self.top(float(u)) for u in us], dtype=np.float32)
        bt = np.array([self.bot(float(u)) for u in us], dtype=np.float32)
        zs = cv.v1 - (np.arange(H) + 0.5) / cv.sy
        T = (zs[:, None] - bt[None, :]) / np.maximum(1e-5, (tp - bt)[None, :])
        g = k.get('g', [0.2, 0.44, 0.56, 0.8])
        a1 = np.clip((T - g[0]) / max(1e-4, g[1] - g[0]), 0, 1)[..., None]
        a2 = np.clip((T - g[2]) / max(1e-4, g[3] - g[2]), 0, 1)[..., None]
        img = belly * (1 - a1) + side * a1
        img = img * (1 - a2) + back * a2
        if k.get('head'):                              # 머리 쪽 색
            hc = np.array(rgb(k['head']), dtype=np.float32)
            ah = np.clip((0.2 - us) / 0.08, 0, 1)[None, :, None] * 0.75
            img = img * (1 - ah) + hc * ah
        self.T, self.us = T, us
        grad = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGB')
        self.mask = cv.mask()
        ImageDraw.Draw(self.mask).polygon(cv.P(smooth(self.outline(), 2, closed=True)), fill=255)
        return grad

    def region(self, u0=0, u1=1, t0=0, t1=1, soft=0.0):
        """몸 좌표의 직사각형 영역 마스크"""
        cv = self.cv
        us = self.us[None, :]
        T = self.T
        if soft > 0:
            m = np.clip((us - u0) / soft, 0, 1) * np.clip((u1 - us) / soft, 0, 1) * np.clip((T - t0) / soft, 0, 1) * np.clip((t1 - T) / soft, 0, 1)
        else:
            m = ((us >= u0) & (us <= u1) & (T >= t0) & (T <= t1)).astype(np.float32)
        return Image.fromarray((np.broadcast_to(m, T.shape) * 255).astype(np.uint8), 'L')

    def apply(self, col, m, alpha=1.0):
        m = ImageChops.multiply(m, self.mask)
        self.cv.fill_mask(col, m, alpha)

    def patterns(self):
        k, cv, L = self.k, self.cv, self.L
        rnd = random.Random(hash(self.name) % 10007)
        for p in k.get('pat', []):
            kind, a = p[0], p[1:]
            m = cv.mask()
            d = ImageDraw.Draw(m)
            if kind == 'bars':          # n, 색, [폭, t0, t1, u0, u1, 기울기, 가늘어짐]
                n, col = a[0], a[1]
                w, t0, t1, u0, u1, slant, taper = (list(a[2:9]) + [0.4, 0.3, 1.0, 0.18, 0.95, 0.0, 0.0][len(a[2:9]):])
                for i in range(n):
                    uc = u0 + (u1 - u0) * (i + 0.5) / n
                    hw = (u1 - u0) / n * w * 0.5
                    lft, rgt = [], []
                    for j in range(7):
                        t = t0 + (t1 - t0) * j / 6
                        kk = 1 - taper * (1 - j / 6)
                        lft.append(self.pt(uc - hw * kk + slant * (t - 0.6), t))
                        rgt.append(self.pt(uc + hw * kk + slant * (t - 0.6), t))
                    d.polygon(cv.P(lft + list(reversed(rgt))), fill=255)
                self.apply(col, m, a[9] if len(a) > 9 else 1.0)
            elif kind == 'spots':       # n, 색, 크기, [t0, t1, u0, u1, 테두리색]
                n, col, size = a[0], a[1], a[2]
                t0, t1, u0, u1 = (list(a[3:7]) + [0.3, 1.0, 0.1, 0.98][len(a[3:7]):])
                ring = a[7] if len(a) > 7 else None
                pts = [(rnd.uniform(u0, u1), rnd.uniform(t0, t1), size * L * rnd.uniform(0.7, 1.25)) for _ in range(n)]
                if ring:
                    mr = cv.mask()
                    dr = ImageDraw.Draw(mr)
                    for (u, t, r) in pts:
                        cv.ellipse(self.pt(u, t), (r * 1.7, r * 1.7), 255, dr)
                    self.apply(ring, mr)
                for (u, t, r) in pts:
                    cv.ellipse(self.pt(u, t), (r, r), 255, d)
                self.apply(col, m)
            elif kind == 'stripe':      # 색, 가운데 t, 폭, [u0, u1, 흐림, 진하기]
                col, tc, w = a[0], a[1], a[2]
                u0, u1, soft, alpha = (list(a[3:7]) + [0.15, 1.0, 0.0, 1.0][len(a[3:7]):])
                up = [self.pt(u0 + (u1 - u0) * i / 20, tc + w / 2) for i in range(21)]
                lo = [self.pt(u0 + (u1 - u0) * i / 20, tc - w / 2) for i in reversed(range(21))]
                d.polygon(cv.P(up + lo), fill=255)
                if soft:
                    m = cv.blur(m, soft * L)
                self.apply(col, m, alpha)
            elif kind == 'wavy':        # n, 색, [t0, 굵기]: 고등어 등의 물결무늬
                n, col = a[0], a[1]
                t0 = a[2] if len(a) > 2 else 0.55
                lw = (a[3] if len(a) > 3 else 0.012) * L
                for i in range(n):
                    uc = 0.2 + 0.74 * i / (n - 1)
                    pts = [self.pt(uc + 0.022 * math.sin(j * 1.7 + i) - 0.03 * (j / 6), 1.0 - (1.0 - t0) * j / 6) for j in range(7)]
                    d.line(cv.P(pts), fill=255, width=max(1, int(cv.px(lw))), joint='curve')
                self.apply(col, m)
            elif kind == 'blotch':      # 색, 크기, 문턱, [t0, t1, u0, u1, 진하기]
                col, scale, th = a[0], a[1], a[2]
                t0, t1, u0, u1, alpha = (list(a[3:8]) + [0.0, 1.0, 0.0, 1.0, 1.0][len(a[3:8]):])
                nm = cv.noise_mask(scale * L, th, seed=hash(self.name + str(col)) % 9973, stretch=(1.3, 1.0))
                self.apply(col, ImageChops.multiply(nm, self.region(u0, u1, t0, t1, 0.06)), alpha)
            elif kind == 'scales':      # 색, 크기, [진하기]
                col, size = a[0], a[1] * L
                nu = int(XB * L / size)
                for i in range(2, nu):
                    for j in range(1, 9):
                        u = (i + (0.5 if j % 2 else 0)) / nu
                        t = 0.12 + 0.8 * j / 9
                        x0, z0 = self.pt(u, t)
                        bb = [cv.X(x0) - cv.px(size) * 0.6, cv.Y(z0) - cv.px(size) * 0.6, cv.X(x0) + cv.px(size) * 0.6, cv.Y(z0) + cv.px(size) * 0.6]
                        d.arc(bb, 100, 260, fill=255, width=max(1, int(cv.px(size * 0.16))))
                self.apply(col, ImageChops.multiply(m, self.region(0.2, 1.0, 0, 1)), a[2] if len(a) > 2 else 0.5)
            elif kind == 'parr':        # n, 색, 크기: 옆구리의 타원 무늬(산천어)
                n, col, size = a[0], a[1], a[2] * L
                for i in range(n):
                    u = 0.24 + 0.68 * i / (n - 1)
                    cv.ellipse(self.pt(u, 0.5), (size * 0.55, size), 255, d)
                self.apply(col, m, a[3] if len(a) > 3 else 1.0)
            elif kind == 'tint':        # 색, u0, u1, t0, t1, [진하기]: 은은하게 물든 곳
                col, u0, u1, t0, t1 = a[:5]
                self.apply(col, self.region(u0, u1, t0, t1, 0.1), a[5] if len(a) > 5 else 0.8)
            elif kind == 'ocellus':     # u, t, 크기, 색, [테두리색]
                u, t, size, col = a[:4]
                if len(a) > 4:
                    mr = cv.mask()
                    cv.ellipse(self.pt(u, t), (size * L * 1.6, size * L * 1.6), 255, ImageDraw.Draw(mr))
                    self.apply(a[4], mr)
                cv.ellipse(self.pt(u, t), (size * L, size * L), 255, d)
                self.apply(col, m)
            elif kind == 'line':        # 색, [t, 굵기]: 옆줄
                col = a[0]
                t = a[1] if len(a) > 1 else 0.52
                lw = (a[2] if len(a) > 2 else 0.006) * L
                d.line(cv.P([self.pt(0.22 + 0.76 * i / 20, t) for i in range(21)]), fill=255, width=max(1, int(cv.px(lw))))
                self.apply(col, m)
            elif kind == 'bstripes':    # n, 색: 배 쪽의 세로줄(가다랑어)
                n, col = a[0], a[1]
                for i in range(n):
                    t = 0.12 + 0.3 * i / max(1, n - 1)
                    d.line(cv.P([self.pt(0.34 + 0.6 * j / 14, t + 0.05 * (j / 14)) for j in range(15)]), fill=255, width=max(1, int(cv.px(0.012 * L))))
                self.apply(col, m)
            elif kind == 'scutes':      # 색, [u0, u1, 개수, t, 크기]: 옆줄의 모비늘(전갱이), 철갑상어의 굳비늘
                u0, u1, nn, tt, ss = (list(a[1:6]) + [0.55, 0.97, 12, 0.5, 0.013][len(a[1:6]):])
                for i in range(nn):
                    x0, z0 = self.pt(u0 + (u1 - u0) * i / (nn - 1), tt)
                    s = L * ss
                    d.polygon(cv.P([(x0 + s, z0), (x0, z0 + s * 1.4), (x0 - s, z0), (x0, z0 - s * 1.4)]), fill=255)
                self.apply(a[0], m)
            elif kind == 'lines':       # n, 색, [t0, t1, 진하기]: 비늘 줄을 따라 난 가는 가로줄
                n, col = a[0], a[1]
                t0, t1 = (a[2] if len(a) > 2 else 0.35), (a[3] if len(a) > 3 else 0.9)
                for i in range(n):
                    t = t0 + (t1 - t0) * i / max(1, n - 1)
                    d.line(cv.P([self.pt(0.22 + 0.74 * j / 14, t) for j in range(15)]), fill=255, width=max(1, int(cv.px(0.006 * L))))
                self.apply(col, m, a[4] if len(a) > 4 else 0.6)
            elif kind == 'dotrows':     # 줄 수, 색, 크기, [t0, t1, u0, u1]: 줄지어 난 점
                rows, col, size = a[0], a[1], a[2] * L
                t0, t1, u0, u1 = (list(a[3:7]) + [0.4, 0.95, 0.2, 0.96][len(a[3:7]):])
                for i in range(rows):
                    t = t0 + (t1 - t0) * i / max(1, rows - 1)
                    nn = int((u1 - u0) * XB * L / (size * 3.2))
                    for j in range(nn):
                        cv.ellipse(self.pt(u0 + (u1 - u0) * (j + 0.5 * (i % 2)) / nn, t), (size, size), 255, d)
                self.apply(col, m)
            elif kind == 'grid':        # 색, 줄 수: 고래상어의 점과 줄
                col, n = a[0], a[1]
                for i in range(n):
                    u = 0.12 + 0.84 * i / n
                    d.line(cv.P([self.pt(u, 0.5), self.pt(u, 1.0)]), fill=255, width=max(1, int(cv.px(0.004 * L))))
                    for j in range(5):
                        cv.ellipse(self.pt(u + 0.42 / n, 0.55 + 0.42 * j / 5), (L * 0.008, L * 0.008), 255, d)
                self.apply(col, m)

    def face(self):
        """아가미뚜껑, 입"""
        k, cv, L = self.k, self.cv, self.L
        dk = shade(self.col[1], 0.72)
        ug = k.get('gill', 0.2)
        pts = [self.pt(ug - 0.03 * math.sin(math.pi * j / 8), 0.14 + 0.72 * j / 8) for j in range(9)]
        cv.line(pts, L * 0.006, dk)
        mz = k.get('mouth', 0.34)
        ml = k.get('mouthlen', 0.07)
        cv.line([self.pt(0.005, mz), self.pt(ml, mz - 0.1)], L * 0.007, shade(self.col[1], 0.55))
        if self.bill:
            zc = (self.top(0) + self.bot(0)) / 2
            cv.poly([(self.xh - L * 0.03, zc + self.dep * 0.14), (L / 2, zc + self.dep * 0.05), (self.xh - L * 0.03, zc - self.dep * 0.06)], k.get('billc', self.col[0]))
        for (ex, ez, er) in self.eye_pos():
            iris = k.get('iris', '#f2e6c4')
            cv.ellipse((ex, ez), (er * 1.12, er * 1.12), shade(iris, 0.8))
            cv.ellipse((ex, ez), (er * 0.98, er * 0.98), iris)
            cv.ellipse((ex + er * 0.06, ez), (er * 0.56, er * 0.56), '#241c2a')
            cv.ellipse((ex + er * 0.3, ez + er * 0.3), (er * 0.2, er * 0.2), '#ffffff')

    def eye_pos(self):
        k = self.k
        ue, te = k.get('eyeu', 0.1), k.get('eyet', 0.62)
        ex, ez = self.pt(ue, te)
        er = min(k.get('eye', 0.03) * self.Lb, 0.24 * self.dep)
        out = [(ex, ez, er)]
        if k.get('flat'):                                # 넙치·가자미: 두 눈이 한쪽에 몰려 있다
            out.append((ex - er * 1.3, ez - er * 2.5, er))
        return out

    # ---------------------------------------------------------- 그림 완성
    def paint(self):
        self.fins()
        self.caudal()
        grad = self.body()
        self.cv.paste(grad, self.mask)
        self.patterns()
        self.pectoral()
        self.face()
        return self.cv.finish()

    # ---------------------------------------------------------- 3D
    def width(self, u, h):
        return h * self.k['wr'] * (1 - 0.45 * u * u) * (0.62 + 0.38 * min(1, u / 0.12))

    def build(self):
        k, cv, L = self.k, self.cv, self.L
        img = self.paint()
        mname = 'tx_' + self.name
        register_mat(mname, tex_material(mname, img))
        N, R = 20, 10
        sides = k.get('flat')
        blind = '#f4f1ea'
        V, UV = [], []
        for i in range(N + 1):
            u = i / N
            x = self.x(u)
            tp, bt = self.top(u), self.bot(u)
            c, h = (tp + bt) / 2, (tp - bt) / 2
            w = self.width(u, h)
            for j in range(R):
                a = 2 * math.pi * (j + 0.5) / R
                V.append((x, w * math.sin(a), c + h * math.cos(a)))
                UV.append(cv.uv(x, c + h * math.cos(a) * 0.93))
        n0 = len(V)                                    # 주둥이 끝과 꼬리자루 끝을 막는다
        V.append((self.x(0) + self.dep * 0.05, 0, (self.top(0) + self.bot(0)) / 2))
        UV.append(cv.uv(self.x(0), (self.top(0) + self.bot(0)) / 2))
        V.append((self.x(1) - 0.004, 0, (self.top(1) + self.bot(1)) / 2))
        UV.append(cv.uv(self.x(1), (self.top(1) + self.bot(1)) / 2))
        FA, FB = [], []                                # FB: 넙치류의 눈 없는 쪽(흰 면)
        hide = lambda j: sides and (math.sin(2 * math.pi * (j + 1.0) / R) > 0.01) != (sides == 'L')
        for j in range(R):
            T = FB if hide(j) else FA
            for i in range(N):
                T.append((i * R + j, i * R + (j + 1) % R, (i + 1) * R + (j + 1) % R, (i + 1) * R + j))
            T.append((n0, (j + 1) % R, j))
            T.append((n0 + 1, N * R + j, N * R + (j + 1) % R))
        faces = mesh_uv(V, FA, mname, UV)
        if FB:
            faces += mesh_uv(V, FB, blind, UV)
            bmesh.ops.remove_doubles(cur().bm, verts=list({v for f in faces for v in f.verts}), dist=1e-6)
            faces = [f for f in faces if f.is_valid]
        fix_normals(faces)
        # 지느러미: 가운데 면에 선 얇은 판
        def plate(pts):
            q = []
            for p_ in pts:
                if not q or math.hypot(p_[0] - q[-1][0], p_[1] - q[-1][1]) > 1e-5:
                    q.append(p_)
            if len(q) >= 3:
                mesh_uv([(a, 0.0, b) for a, b in q], [tuple(range(len(q)))], mname, [cv.uv(a, b) for a, b in q], smooth=False)
        for (pts, base) in self.polys:
            plate(pts + [b for b in reversed(base) if b not in pts])
        if getattr(self, 'tail', None):
            plate(self.tail)
        if getattr(self, 'fringe_pts', None):
            plate(self.fringe_pts)
        if k.get('pect3d') and getattr(self, 'pect', None):       # 옆으로 뻗은 가슴지느러미
            ang = math.radians(k['pect3d'])
            x0, z0 = self.pect[0][0], (self.pect[0][1] + self.pect[-1][1]) / 2
            wy = self.dep * 0.5 * k['wr'] * 0.8
            for s in (1, -1):
                vs, uv = [], []
                for (px, pz) in self.pect:
                    dx, dz = px - x0, pz - z0
                    r = math.hypot(dx, dz)
                    vs.append((x0 + dx * 0.8, s * (wy + r * math.cos(ang)), z0 + dz * 0.3 - r * math.sin(ang) * 0.5))
                    uv.append(cv.uv(px, pz))
                mesh_uv(vs, [tuple(range(len(vs)))], mname, uv, smooth=False)
        # 눈: 그림에 그려 둔 눈 위로 볼록한 알을 올린다
        set_proj(lambda co: cv.uv(co.x, co.z))
        for n_, (ex, ez, er) in enumerate(self.eye_pos()):
            ue = (self.xh - ex) / (XB * self.Lb)
            tp, bt = self.top(ue), self.bot(ue)
            c, h = (tp + bt) / 2, (tp - bt) / 2
            ey = self.width(ue, h) * math.sqrt(max(0.05, 1 - min(1, abs(ez - c) / h) ** 2)) * 0.96
            for s in ((1, -1) if not sides else ((1,) if sides == 'L' else (-1,))):
                ball((ex, s * ey, ez), 1.0, mname, (er, er * 0.5, er), sub=1)
        if self.bill:
            zc = (self.top(0) + self.bot(0)) / 2
            tube((self.xh - L * 0.03, 0, zc + self.dep * 0.04), (L / 2, 0, zc + self.dep * 0.05), self.dep * 0.09, mname, r2=0.002, seg=5)
        set_proj(None)
        # 수염
        ue = k.get('eyeu', 0.1)
        wloc = self.width(ue, (self.top(ue) - self.bot(ue)) / 2)
        if k.get('barb'):
            n, ln = k['barb']
            bc = shade(self.col[0], 0.85)
            for i in range(n):
                for s in (1, -1):
                    x0, z0 = self.pt(0.02 + i * 0.012, 0.3)
                    tube((x0, s * wloc * 0.3, z0), (x0 + L * ln * (0.5 - i * 0.3), s * (wloc * 0.5 + L * ln * (0.4 + i * 0.25)), z0 - L * ln * (0.5 + 0.2 * i)), L * 0.008, bc, r2=L * 0.003, seg=4)
        # 가시복의 가시
        if k.get('spikes'):
            rnd = random.Random(7)
            for _ in range(k['spikes']):
                u, a = rnd.uniform(0.15, 0.8), rnd.uniform(0, 2 * math.pi)
                tp, bt = self.top(u), self.bot(u)
                c, h = (tp + bt) / 2, (tp - bt) / 2
                w = h * k['wr'] * (1 - 0.45 * u * u)
                p0 = Vector((self.x(u), w * math.sin(a), c + h * math.cos(a)))
                nrm = Vector((0, math.sin(a) / max(w, 1e-3), math.cos(a) / max(h, 1e-3))).normalized()
                tube(p0, p0 + nrm * L * 0.05 + Vector((-L * 0.02, 0, 0)), L * 0.012, '#f3ead2', r2=0.001, seg=3)
        return self


def post(part_bm, k, L):
    """몸 전체에 주는 변형: 넙치는 눕히고, 뱀장어는 구불거리게"""
    bm = part_bm
    if k.get('wave'):
        A, n = k['wave'] * L * 6, 1.6
        for v in bm.verts:
            v.co.y += A * math.sin((v.co.x / L) * math.pi * 2 * n) * (0.3 + 0.7 * (0.5 - v.co.x / L))
    if k.get('flat'):
        ang = math.radians(90 if k['flat'] == 'L' else -90)
        for v in bm.verts:
            y, z = v.co.y, v.co.z
            v.co.y = y * math.cos(ang) - z * math.sin(ang)
            v.co.z = y * math.sin(ang) + z * math.cos(ang) + L * k['dep'] * k['wr'] * 0.5


def make_fish(name, sp):
    """현재 열려 있는 모델 안에 물고기 한 마리를 만든다."""
    f = Fish(name, sp).build()
    post(cur().bm, f.k, f.L)
    return f
