"""곤충 모델: 종마다 위에서 본 그림을 그려 입힌다(topkit 참고).

data/bugs.json 의 look.f 로 무리(만드는 틀)를 고르고, 나머지 값으로 그 종의 생김새를 정한다.
  butterfly  나비·나방(날개 윤곽 틀 w, 무늬 pat)      dragonfly  잠자리·실잠자리
  cicada     매미·풀잠자리(비치는 날개)               bee        벌       ant  개미
  beetle     딱정벌레 무리(뿔·큰턱·더듬이·무늬)        hopper     메뚜기·여치·귀뚜라미
  mantis     사마귀      stick  대벌레                shield     노린재
  waterbug   물장군·장구애비·송장헤엄치게·소금쟁이     pill  공벌레   spider  거미   hermit  소라게
머리가 -Y, 바닥 Z=0. 날개가 있는 것은 wing_L / wing_R 부위로 따로 두어 게임에서 퍼덕이게 한다.
"""
from topkit import *


def _curve(vals):
    n = len(vals) - 1
    def f(a):
        x = min(1.0, max(0.0, a)) * n
        i = min(n - 1, int(x))
        t = x - i
        p0, p1, p2, p3 = vals[max(0, i - 1)], vals[i], vals[i + 1], vals[min(n, i + 2)]
        return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t)
    return f


# ============================================================================ 나비·나방
# 날개 윤곽: 밑동에서 본 방향(도, 옆이 0·앞이 +)에 따른 길이. fw 앞날개 [앞 가장자리 방향, 뒤 가장자리 방향, 길이들], hw 뒷날개.
WING = {
    'pierid': dict(fw=[66, -14, [0.9, 1.0, 0.96, 0.84, 0.68, 0.5]], hw=[10, -96, [0.5, 0.68, 0.76, 0.74, 0.64, 0.42]]),
    'papilio': dict(fw=[64, -10, [0.95, 1.0, 0.9, 0.74, 0.6, 0.48]], hw=[8, -100, [0.46, 0.62, 0.72, 0.76, 0.68, 0.4]], scal=[5, 0.08], tail=[0.66, 0.34, 0.06]),
    'nymph': dict(fw=[62, -12, [0.9, 1.0, 0.9, 0.8, 0.68, 0.52]], hw=[10, -98, [0.5, 0.68, 0.76, 0.76, 0.66, 0.44]], scal=[6, 0.05]),
    'lycaen': dict(fw=[62, -16, [0.86, 1.0, 0.96, 0.86, 0.7, 0.52]], hw=[8, -96, [0.52, 0.7, 0.78, 0.76, 0.64, 0.42]]),
    'skipper': dict(fw=[56, 0, [0.9, 1.0, 0.8, 0.6, 0.46]], hw=[12, -74, [0.44, 0.6, 0.66, 0.6, 0.4]]),
    'moth': dict(fw=[46, -34, [0.86, 1.0, 0.94, 0.82, 0.64, 0.46]], hw=[-8, -100, [0.4, 0.56, 0.62, 0.6, 0.5, 0.36]]),
    'hawk': dict(fw=[40, -8, [0.9, 1.0, 0.7, 0.46, 0.34, 0.26]], hw=[-2, -62, [0.3, 0.42, 0.46, 0.4, 0.28]]),
    'saturn': dict(fw=[56, -20, [0.9, 1.0, 0.9, 0.78, 0.66, 0.5]], hw=[0, -108, [0.44, 0.6, 0.7, 0.72, 0.6, 0.4]]),
    'lantern': dict(fw=[14, -52, [0.8, 1.0, 0.98, 0.9, 0.66, 0.4]], hw=[-34, -84, [0.5, 0.7, 0.74, 0.6, 0.4]]),
}


class Wing:
    def __init__(self, base, th0, th1, vals, S, scal=None, tails=()):
        self.base, self.th0, self.th1, self.S, self.scal, self.tails = base, th0, th1, S, scal, tails
        self.c = _curve(vals)

    def R(self, a):
        r = self.c(a)
        if self.scal:
            r *= 1 - self.scal[1] * abs(math.sin(self.scal[0] * math.pi * a))
        for (ac, ln, wd) in self.tails:
            r += ln * math.exp(-((a - ac) / wd) ** 2)
        return r

    def pt(self, a, r):
        th = math.radians(self.th0 + (self.th1 - self.th0) * a)
        d = self.R(a) * r * self.S
        return (self.base[0] + d * math.cos(th), self.base[1] - d * math.sin(th))

    def outline(self, n=44):
        return [self.base] + [self.pt(i / n, 1.0) for i in range(n + 1)]

    def sector(self, a0, a1, r0, r1, n=20):
        return [self.pt(a0 + (a1 - a0) * i / n, r1) for i in range(n + 1)] + [self.pt(a0 + (a1 - a0) * i / n, r0) for i in reversed(range(n + 1))]


def wing_patterns(T, W, key, pats, S, seed=1):
    """날개 무늬. 자리(a, r): a는 앞 가장자리 0 → 뒤 가장자리 1, r은 밑동 0 → 바깥 가장자리 1.
      ['sector', 날개, 색, a0, a1, r0, r1, [진하기]]   부채꼴 영역(가장자리 띠, 날개 끝, 밑동 등)
      ['spots', 날개, 색, [[a, r, 크기]…], [테두리색]]  점            ['row', 날개, 색, r, 개수, 크기, [a0, a1]]  가장자리를 따라 늘어선 점
      ['cells', 날개, 색, r0, r1, 칸 수, 틈, [a0, a1]]  맥 사이 칸     ['veins', 날개, 색, 굵기, 줄 수, [r0]]      날개맥
      ['eye', 날개, a, r, 크기, [색…]]                  눈알 무늬      ['edge', 날개, 색, 굵기]                    가장자리 선
      ['wave', 날개, 색, r, 흔들림, 굽이 수, 굵기]      물결 줄         ['speck', 날개, 색, 개수, 크기]             자잘한 점
      ['dust', 날개, 색, r1, 진하기]                    밑동의 흐린 물듦   ['lune', 날개, a, r, 크기, [색…], 각도]    초승달 무늬
    날개: 'F' 앞, 'H' 뒤, 'FH' 둘 다."""
    cv = T.cv
    P = lambda pts: cv.P([(x, -y) for x, y in pts])
    rnd = random.Random(seed)
    for p in pats:
        kind = p[0]
        if key not in p[1]:
            continue
        m = cv.mask()
        d = ImageDraw.Draw(m)
        col, alpha = p[2], 1.0
        lw = lambda v: max(1, int(cv.px(v * S)))
        dot = lambda a, r, sz: d.ellipse([cv.X(W.pt(a, r)[0]) - cv.px(sz * S), cv.Y(-W.pt(a, r)[1]) - cv.px(sz * S), cv.X(W.pt(a, r)[0]) + cv.px(sz * S), cv.Y(-W.pt(a, r)[1]) + cv.px(sz * S)], fill=255)
        if kind == 'sector':
            d.polygon(P(W.sector(p[3], p[4], p[5], p[6])), fill=255)
            alpha = p[7] if len(p) > 7 else 1.0
        elif kind == 'spots':
            if len(p) > 4:
                m2 = cv.mask()
                d2 = ImageDraw.Draw(m2)
                for (a, r, sz) in p[3]:
                    x, y = W.pt(a, r)
                    d2.ellipse([cv.X(x) - cv.px(sz * S * 1.6), cv.Y(-y) - cv.px(sz * S * 1.6), cv.X(x) + cv.px(sz * S * 1.6), cv.Y(-y) + cv.px(sz * S * 1.6)], fill=255)
                cv.fill_mask(p[4], ImageChops.multiply(m2, W.mask))
            for (a, r, sz) in p[3]:
                dot(a, r, sz)
        elif kind == 'row':
            a0, a1 = (p[6], p[7]) if len(p) > 7 else (0.08, 0.92)
            for i in range(p[4]):
                dot(a0 + (a1 - a0) * (i + 0.5) / p[4], p[3], p[5])
        elif kind == 'cells':
            a0, a1 = (p[7], p[8]) if len(p) > 8 else (0.03, 0.97)
            n, gap = p[5], p[6]
            for i in range(n):
                aa = a0 + (a1 - a0) * i / n
                d.polygon(P(W.sector(aa, aa + (a1 - a0) / n * (1 - gap), p[3], p[4], 5)), fill=255)
        elif kind == 'veins':
            r0 = p[5] if len(p) > 5 else 0.15
            for i in range(p[4]):
                a = (i + 0.5) / p[4]
                d.line(P([W.pt(a, r0), W.pt(a, 1.0)]), fill=255, width=lw(p[3]))
        elif kind == 'eye':
            a, r, sz, cols = p[2], p[3], p[4], p[5]
            for i, c in enumerate(cols):
                mm = cv.mask()
                x, y = W.pt(a, r)
                rr = cv.px(sz * S * (1 - i / len(cols)))
                ImageDraw.Draw(mm).ellipse([cv.X(x) - rr, cv.Y(-y) - rr, cv.X(x) + rr, cv.Y(-y) + rr], fill=255)
                cv.fill_mask(c, ImageChops.multiply(mm, W.mask))
            continue
        elif kind == 'lune':                      # ['lune', 날개, a, r, 크기, [테두리색, 속 색], 벌어진 쪽(도)] 초승달 무늬
            a, r, sz, cols = p[2], p[3], p[4], p[5]
            ang = math.radians(p[6] if len(p) > 6 else 0)
            x, y = W.pt(a, r)
            for i, c in enumerate(cols):
                rr = cv.px(sz * S * (1 - 0.3 * i))
                mm = cv.mask()
                dd = ImageDraw.Draw(mm)
                dd.ellipse([cv.X(x) - rr, cv.Y(-y) - rr, cv.X(x) + rr, cv.Y(-y) + rr], fill=255)
                ox, oy = cv.X(x) + math.cos(ang) * rr * 0.62, cv.Y(-y) + math.sin(ang) * rr * 0.62      # 한쪽을 둥글게 파내 초승달로
                dd.ellipse([ox - rr * 0.95, oy - rr * 0.95, ox + rr * 0.95, oy + rr * 0.95], fill=0)
                cv.fill_mask(c, ImageChops.multiply(mm, W.mask))
            continue
        elif kind == 'edge':
            d.line(P(W.outline(60)[1:]), fill=255, width=lw(p[3]))
        elif kind == 'wave':
            r, amp, n = p[3], p[4], p[5]
            d.line(P([W.pt(i / 40, r + amp * math.sin(n * math.pi * i / 40)) for i in range(41)]), fill=255, width=lw(p[6]), joint='curve')
        elif kind == 'speck':
            for _ in range(p[3]):
                dot(rnd.uniform(0.05, 0.95), rnd.uniform(0.2, 0.95), p[4] * rnd.uniform(0.6, 1.3))
        elif kind == 'dust':
            d.polygon(P(W.sector(0, 1, 0, p[3])), fill=255)
            m = cv.blur(m, S * 0.06)
            alpha = p[4]
        cv.fill_mask(col, ImageChops.multiply(m, W.mask), alpha)


def butterfly(m, name, k):
    S = k.get('span', 0.6) * 0.5                  # 앞날개 길이
    w = dict(WING[k.get('w', 'pierid')])
    for q in ('fw', 'hw', 'scal', 'tail', 'fscal'):
        if q in k:
            w[q] = k[q]
    bs = S / 0.3
    fat = k.get('fat', 0.0)
    bw = (0.014 + 0.02 * fat) * bs                # 몸 반폭
    by = -0.03 * bs
    tails = w.get('tail') or []
    if tails and not isinstance(tails[0], (list, tuple)):
        tails = [tails]
    F = Wing((bw * 0.5, by), w['fw'][0], w['fw'][1], w['fw'][2], S, w.get('fscal'))
    H = Wing((bw * 0.5, by + 0.035 * bs), w['hw'][0], w['hw'][1], w['hw'][2], S, w.get('scal'), tails)
    ext = F.outline() + H.outline(70)
    hw = max(p[0] for p in ext) + 0.02
    front = max(-min(p[1] for p in ext), 0.14 * bs) + 0.02
    back = max(max(p[1] for p in ext), 0.2 * bs) + 0.02
    base = k.get('base', '#ffffff')
    T = Top(m, name, hw, front, back, px=k.get('px', 176), bg=base, z0=0.06)
    for key, W in (('H', H), ('F', F)):           # 뒷날개를 먼저 그리고 앞날개를 그 위에
        W.mask = T.mask_poly(W.outline(70))
        T.cv.fill_mask(k.get('hbase', base) if key == 'H' else base, W.mask)
        wing_patterns(T, W, key, k.get('pat', []), S)
    T.cv.mirror()
    ucv = None
    if k.get('under'):                            # 날개 아랫면: 앉아서 날개를 접거나 날갯짓할 때 보인다. 따로 그려 아래쪽만 향하는 판에 입힌다
        u = k['under']
        ucv = Canvas(-hw, hw, -back, front, px=int(k.get('px', 176) * 0.75), bg=u.get('base', base))
        cv0, T.cv = T.cv, ucv
        for key, W in (('H', H), ('F', F)):
            W.mask = T.mask_poly(W.outline(70))
            if 'wash' in u:                       # 윗면 무늬를 그대로 그리고 흐리게 덮은 뒤 아랫면에만 있는 무늬를 더한다
                T.cv.fill_mask(k.get('hbase', base) if key == 'H' else base, W.mask)
                wing_patterns(T, W, key, k.get('pat', []), S)
                T.cv.fill_mask(u['wash'][0], W.mask, u['wash'][1])
                wing_patterns(T, W, key, u.get('add', []), S, seed=4)
            else:
                T.cv.fill_mask(u.get('hbase', u.get('base', base)) if key == 'H' else u.get('base', base), W.mask)
                wing_patterns(T, W, key, u.get('pat', []), S, seed=4)
        T.cv.mirror()
        T.cv = cv0
        umat = 'txu_' + name
        _um = tex_material(umat)
        _um.use_backface_culling = True           # 아래에서 볼 때만 보이게
        register_mat(umat, _um)
    # 몸
    body = k.get('body', '#3a3430')
    zb = T.z0 + bw
    al = (0.17 + 0.05 * fat) * bs                 # 배 길이
    T.shell(by + 0.02 * bs, by + 0.02 * bs + al, via([(0, 0.7), (0.3, 1), (1, 0.25)]), via([(0, 0.8), (0.3, 1), (1, 0.4)]), bw * 2, bw * 1.7, k.get('abd', body), n=6, seg=6)
    if k.get('abdband'):
        for i in range(1, 6):
            y = by + 0.02 * bs + al * i / 6.5
            T.line([(-bw, y), (bw, y)], al * 0.05, k['abdband'])
    if k.get('fan'):                              # 박각시의 부채 같은 꼬리털
        yf = by + 0.02 * bs + al
        fan = [(-bw * 1.5, yf - al * 0.1), (-bw * 1.8, yf + al * 0.2), (0, yf + al * 0.12), (bw * 1.8, yf + al * 0.2), (bw * 1.5, yf - al * 0.1)]
        T.poly(fan, k['fan'])
        T.plate(fan, zb)
    T.blob((0, by, zb), (bw * 1.25, 0.05 * bs, bw * 1.2), k.get('thorax', body))
    T.blob((0, by - 0.06 * bs, zb), (bw * 0.95, 0.022 * bs, bw * 0.9), k.get('head', body), sub=2)
    for nm, s in (('wing_L', 1), ('wing_R', -1)):
        with m.part(nm, (0, by, zb + 0.004)):
            T.plate([(s * x, y) for x, y in H.outline(70)], zb + 0.001)
            T.plate([(s * x, y) for x, y in F.outline(44)], zb + 0.005)
            if ucv:
                for pts, zz in ((F.outline(44), zb + 0.0035), (H.outline(70), zb - 0.0005)):
                    q = [(s * x, y) for x, y in pts]
                    if sum(q[i][0] * q[(i + 1) % len(q)][1] - q[(i + 1) % len(q)][0] * q[i][1] for i in range(len(q))) > 0:
                        q.reverse()               # 면이 아래(-Z)를 보게 감는 방향을 맞춘다
                    T.plate(q, zz, mat=umat, cv=ucv)
    T.off()
    if ucv:
        tex_image(_um, ucv.finish())
    ac = k.get('antc', body)
    kind = k.get('ant', 'club')
    if kind == 'feather':
        T.feelers(ac, (bw * 0.5, by - 0.07 * bs, zb + 0.004), [(0.03 * bs, -0.04 * bs, 0.01), (0.07 * bs, -0.07 * bs, 0.012)], r=0.007 * bs)
    else:
        T.feelers(ac, (bw * 0.5, by - 0.075 * bs, zb + 0.004), [(0.02 * bs, -0.06 * bs, 0.014), (0.045 * bs, -0.13 * bs, 0.02)], r=0.0032 * bs, tip=0.0075 * bs if kind == 'club' else None)
    for s in (1, -1):
        ball((s * bw * 0.8, by - 0.065 * bs, zb + bw * 0.2), bw * 0.5, k.get('eye', '#1a1a1a'), sub=2)
    T.finish()


# ============================================================================ 잠자리
def dragonfly(m, name, k):
    L = k.get('len', 0.5)
    wl = k.get('span', L * 1.3) / 2
    damsel = k.get('damsel', 0)
    col = k['col']
    bw = L * (0.045 if damsel else 0.07)          # 가슴 반폭
    aw = L * (0.016 if damsel else 0.032)         # 배 반폭
    ya0, ya1 = L * 0.08, L * 0.86
    angs = ((-64, -74) if damsel else (7, -9))
    wwf, wwh = (0.15, 0.15) if damsel else (k.get('fww', 0.2), k.get('hww', 0.27))
    def wing_pts(yb, ang, length, ww, p, q, n=20):
        a = math.radians(ang)
        dx, dy = math.cos(a), -math.sin(a)        # 뻗는 방향
        px_, py_ = math.sin(a), math.cos(a)       # 뒤 가장자리 쪽
        sh = lambda t: math.sin(math.pi * min(1.0, max(0.0, t)) ** p) ** q
        lead = [(bw * 0.5 + dx * t * length - px_ * 0.05 * length * math.sin(math.pi * t) ** 0.6, yb + dy * t * length - py_ * 0.05 * length * math.sin(math.pi * t) ** 0.6) for t in [i / n for i in range(n + 1)]]
        trail = [(bw * 0.5 + dx * t * length + px_ * ww * length * sh(t), yb + dy * t * length + py_ * ww * length * sh(t)) for t in [i / n for i in reversed(range(n + 1))]]
        return lead, trail
    wings = [wing_pts(-L * 0.035, angs[0], wl, wwf, 0.85 if not damsel else 1.5, 0.5 if not damsel else 0.8),
             wing_pts(L * 0.05, angs[1], wl * 0.96, wwh, 0.62 if not damsel else 1.5, 0.45 if not damsel else 0.8)]
    allp = [q for (a, b) in wings for q in a + b]
    T = Top(m, name, bw * 1.7, L * 0.2, L * 0.9, px=64, bg=col,
            wing=(max(p[0] for p in allp) + 0.02, max(0.02, -min(p[1] for p in allp)) + 0.02, max(p[1] for p in allp) + 0.02, 192), z0=0.06)
    # --- 날개 그림
    cv = T.wcv
    vein = k.get('vein', '#3a3a3a')
    for i, (lead, trail) in enumerate(wings):
        for s in (1, -1):
            L_ = [(s * x, y) for x, y in lead]
            R_ = [(s * x, y) for x, y in trail]
            T.poly(L_ + R_, k.get('wingc', '#e8f2fa'), cv, a=k.get('wa', 80))
            n = len(L_) - 1
            Rr = list(reversed(R_))
            mid = lambda j, f: (L_[j][0] + (Rr[j][0] - L_[j][0]) * f, L_[j][1] + (Rr[j][1] - L_[j][1]) * f)
            for wp in k.get('wpat', []):          # ['base'|'tip'|'band'|'all', 색, 진하기, t0, t1, 날개('f','h','fh')]
                which = wp[5] if len(wp) > 5 else 'fh'
                if 'fh'[i] not in which:
                    continue
                t0, t1 = (0, wp[3]) if wp[0] == 'base' else (wp[3], 1) if wp[0] == 'tip' else (0, 1) if wp[0] == 'all' else (wp[3], wp[4])
                j0, j1 = int(round(t0 * n)), int(round(t1 * n))
                T.poly(L_[j0:j1 + 1] + list(reversed(Rr[j0:j1 + 1])), wp[1], cv, a=wp[2])
            T.line(L_, wl * 0.016, vein, cv, a=235)
            for f in (0.3, 0.62):
                T.line([mid(j, f) for j in range(n + 1)], wl * 0.008, vein, cv, a=170)
            for j in range(2, n, 2):
                T.line([L_[j], Rr[j]], wl * 0.006, vein, cv, a=110)
            T.line(R_, wl * 0.008, vein, cv, a=150)
            j = int(n * 0.86)                     # 날개 끝의 짙은 무늬(연문)
            T.poly([L_[j], L_[j + 2], mid(j + 2, 0.2), mid(j, 0.2)], k.get('stigma', '#2a2a2a'), cv, a=255)
    # --- 몸 그림과 모양
    tc = k.get('thorax', col)
    T.shell(ya0, ya1, via([(0, 1), (0.12, 0.8), (0.75, 0.62), (1, 0.42)]) if not damsel else via([(0, 1), (0.1, 0.7), (0.9, 0.7), (1, 0.5)]), const(1.0), aw * 2, aw * 1.5, col, z0=T.z0 + bw * 0.5, n=10, seg=6)
    for (c, t0, t1) in k.get('abd', []):          # 배의 색: [색, 시작, 끝]
        T.poly([(-aw * 1.2, ya0 + (ya1 - ya0) * t0), (aw * 1.2, ya0 + (ya1 - ya0) * t0), (aw * 1.2, ya0 + (ya1 - ya0) * t1), (-aw * 1.2, ya0 + (ya1 - ya0) * t1)], c)
    if k.get('rings'):
        for i in range(1, 10):
            y = ya0 + (ya1 - ya0) * i / 10
            T.line([(-aw * 1.2, y), (aw * 1.2, y)], L * (0.03 if k.get('ringw') else 0.012), k['rings'])
    if k.get('dline'):
        T.line([(0, ya0), (0, ya1)], aw * 0.5, k['dline'])
    T.shell(-L * 0.1, L * 0.1, sup(2.2), via([(0, 0.6), (0.4, 1), (1, 0.7)]), bw * 2, bw * 1.5, tc, z0=T.z0 + bw * 0.2, n=6, seg=8)
    if k.get('tstripe'):
        for s in (1, -1):
            T.line([(s * bw * 0.5, -L * 0.08), (s * bw * 0.75, L * 0.06)], bw * 0.3, k['tstripe'])
    T.blob((0, -L * 0.115, T.z0 + bw * 0.8), (bw * 0.75, L * 0.035, bw * 0.6), k.get('head', tc), sub=2)
    zw = T.z0 + bw * 1.5
    for nm, s in (('wing_L', 1), ('wing_R', -1)):
        with m.part(nm, (0, 0, zw)):
            for i, (lead, trail) in enumerate(wings):
                T.plate([(s * x, y) for x, y in lead + trail], zw + i * 0.003, T.wmat, cv)
    T.off()
    ec = k.get('eye', '#4a8a5a')
    for s in (1, -1):
        if damsel:
            ball((s * bw * 0.85, -L * 0.125, T.z0 + bw * 0.9), bw * 0.5, ec, sub=2)
        else:
            ball((s * bw * 0.42, -L * 0.135, T.z0 + bw * 0.95), 1.0, ec, (bw * 0.5, bw * 0.55, bw * 0.5), sub=2)
    T.legs(k.get('leg', '#2a2a2a'), [((bw * 0.5, -L * 0.06 + i * L * 0.04, T.z0 + bw * 0.4), (bw * 1.3, -L * 0.12 + i * L * 0.05, T.z0 + bw * 0.6), (bw * 1.1, -L * 0.2 + i * L * 0.07)) for i in range(3)], r=L * 0.007)
    T.finish()


# ============================================================================ 매미(풀잠자리도 이 틀)
def cicada(m, name, k):
    L = k.get('len', 0.36)
    col = k['col']
    slim = k.get('slim', 0)
    W = L * (0.17 if slim else k.get('w', 0.42))
    wl = L * k.get('wl', 1.05)
    wk = k.get('ww', 0.3 if not slim else 0.26)   # 날개 폭(길이에 대한 비)
    wb = (W * 0.4, -L * 0.24)                     # 날개 밑동
    shape = [(0.0, 0.0), (0.5, 0.1), (0.95, 0.36), (1.0, 0.68), (0.62, 0.95), (0.16, 1.0), (-0.3, 0.8), (-0.26, 0.36)]
    wp = smooth([(wb[0] + px_ * wl * wk, wb[1] + py_ * wl) for px_, py_ in shape], 5, closed=True)
    T = Top(m, name, W * 0.62, L * 0.54, L * 0.56, px=96, bg=col,
            wing=(max(p[0] for p in wp) + 0.02, L * 0.3, max(p[1] for p in wp) + 0.02, 176), z0=0.02)
    cv = T.wcv
    vein = k.get('vein', '#4a4a3a')
    for s in (1, -1):
        Q = [(s * x, y) for x, y in wp]
        T.poly(Q, k.get('wingc', '#eef4f0'), cv, a=k.get('wa', 75))
        if k.get('wmottle'):                      # 불투명한 얼룩 날개(유지매미)
            wm = cv.mask()
            ImageDraw.Draw(wm).polygon(cv.P([(x, -y) for x, y in Q]), fill=255)
            cv.fill_mask(k['wmottle'], ImageChops.multiply(cv.noise_mask(L * 0.09, 0.5, seed=7), wm), a=245)
        tip = lambda fx, fy: (s * (wb[0] + fx * wl * wk), wb[1] + fy * wl)
        for (fx, fy) in ((0.86, 0.5), (0.7, 0.86), (0.3, 0.97), (-0.1, 0.9), (-0.24, 0.6)):
            T.line([tip(0.05, 0.03), tip(fx * 0.5, fy * 0.5 + 0.02), tip(fx, fy)], wl * 0.01, vein, cv, a=200)
        T.line([tip(0.46, 0.5), tip(0.1, 0.6), tip(-0.2, 0.52)], wl * 0.008, vein, cv, a=170)
        T.line([tip(0, 0), tip(0.5, 0.1), tip(0.95, 0.36), tip(1.0, 0.68)], wl * 0.02, k.get('costa', vein), cv, a=240)
        for (fx, fy, r) in k.get('wspots', []):
            T.ell(tip(fx, fy), (r * wl, r * wl), k.get('wspotc', '#3a3a3a'), cv, a=230)
    # 몸
    hz = W * (0.5 if not slim else 0.8)
    T.shell(-L * 0.02, L * 0.5, via([(0, 0.92), (0.2, 1), (0.7, 0.6), (1, 0.12)]), via([(0, 0.9), (0.3, 1), (1, 0.3)]), W * 0.96, hz, k.get('abd', col), n=8, seg=8)
    if k.get('seg'):
        for i in range(1, 6):
            y = L * 0.02 + L * 0.42 * i / 6
            T.line([(-W * 0.5, y), (W * 0.5, y)], L * 0.012, k['seg'])
    T.shell(-L * 0.26, L * 0.02, sup(2.6), via([(0, 0.8), (0.5, 1), (1, 0.95)]), W, hz * 1.05, k.get('meso', col), n=5, seg=8)
    T.shell(-L * 0.4, -L * 0.22, sup(3.0), const(1.0), W * 0.94, hz * 0.95, k.get('pro', col), n=4, seg=8)
    T.shell(-L * 0.5, -L * 0.37, via([(0, 0.5), (0.5, 1), (1, 0.95)]), via([(0, 0.6), (1, 1)]), W * (0.9 if not slim else 1.0), hz * 0.8, k.get('head', col), n=4, seg=6)
    for (x, y, r, c) in k.get('marks', []):       # 무늬 점: [x, y, 크기, 색] (몸길이에 대한 비, 좌우 대칭)
        T.spots([(x * L, y * L, r * L)], c)
    for (pts, wd, c) in k.get('lines', []):       # 무늬 선: [[(x, y)…], 굵기, 색]
        for s in (1, -1):
            T.line([(s * x * L, y * L) for x, y in pts], wd * L, c)
    zt = T.z0 + hz * 0.95
    for nm, s in (('wing_L', 1), ('wing_R', -1)):
        with m.part(nm, (0, wb[1], zt)):
            fs = T.plate([(s * x, y) for x, y in wp], zt + 0.004, T.wmat, cv)
            rot_about(fs, (s * W * 0.2, 0, zt + 0.004), 'Y', s * k.get('roof', 24))
    T.off()
    for s in (1, -1):
        ball((s * W * (0.42 if not slim else 0.5), -L * 0.43, T.z0 + hz * 0.6), W * (0.11 if not slim else 0.22), k.get('eye', '#2a2a2a'), sub=2)
    if slim:
        T.feelers(col, (W * 0.2, -L * 0.48, T.z0 + hz * 0.6), [(L * 0.1, -L * 0.2, 0.01), (L * 0.22, -L * 0.34, 0.0)], r=L * 0.006)
    T.legs6(k.get('leg', shade(col, 0.7)), [-L * 0.3, -L * 0.18, -L * 0.06], W * 0.3, W * 0.5, T.z0 + hz * 0.3, r=L * 0.012, z=T.z0 + 0.01)
    T.finish()


# ============================================================================ 벌
def bee(m, name, k):
    L = k.get('len', 0.3)
    fat = k.get('fat', 0.0)
    col = k['col']
    AW = L * (0.3 + 0.14 * fat)                   # 배 너비
    TR = L * (0.13 + 0.035 * fat)                 # 가슴 반지름
    wl = L * k.get('wl', 0.72)
    wb = (TR * 0.5, -L * 0.2)
    a = math.radians(-k.get('sweep', 48))
    dx, dy = math.cos(a), -math.sin(a)
    px_, py_ = math.sin(a), math.cos(a)
    sh = lambda t: math.sin(math.pi * t ** 0.9) ** 0.55
    wp = [(wb[0] + dx * t * wl - px_ * 0.05 * wl * math.sin(math.pi * t), wb[1] + dy * t * wl - py_ * 0.05 * wl * math.sin(math.pi * t)) for t in [i / 14 for i in range(15)]] + \
         [(wb[0] + dx * t * wl + px_ * 0.26 * wl * sh(t), wb[1] + dy * t * wl + py_ * 0.26 * wl * sh(t)) for t in [i / 14 for i in reversed(range(15))]]
    T = Top(m, name, AW * 0.62, L * 0.54, L * 0.56, px=96, bg=col,
            wing=(max(p[0] for p in wp) + 0.02, L * 0.3, max(p[1] for p in wp) + 0.02, 128), z0=0.03)
    cv = T.wcv
    for s in (1, -1):
        Q = [(s * x, y) for x, y in wp]
        T.poly(Q, k.get('wingc', '#eef2f6'), cv, a=k.get('wa', 85))
        T.line(Q[:15], wl * 0.022, k.get('vein', '#5a4a3a'), cv, a=230)
        T.line([Q[0], ((Q[7][0] + Q[21][0]) / 2, (Q[7][1] + Q[21][1]) / 2), Q[14]], wl * 0.012, k.get('vein', '#5a4a3a'), cv, a=170)
        T.line([Q[5], Q[24]], wl * 0.01, k.get('vein', '#5a4a3a'), cv, a=140)
        T.line([Q[10], Q[19]], wl * 0.01, k.get('vein', '#5a4a3a'), cv, a=140)
    y0 = -L * (0.05 if not k.get('waist') else 0.0)
    T.shell(y0, L * 0.5, via([(0, 0.4 if k.get('waist') else 0.7), (0.3, 1), (0.7, 0.8), (1, 0.1 if k.get('point', 1) else 0.5)]), via([(0, 0.7), (0.3, 1), (1, 0.3)]), AW, AW * 0.5, col, n=8, seg=8)
    for (t0, t1, c) in k.get('bands', []):        # 배의 띠: [시작, 끝, 색]
        T.poly([(-AW, y0 + (L * 0.5 - y0) * t0), (AW, y0 + (L * 0.5 - y0) * t0), (AW, y0 + (L * 0.5 - y0) * t1), (-AW, y0 + (L * 0.5 - y0) * t1)], c)
    T.blob((0, -L * 0.17, T.z0 + TR), (TR, TR * 1.05, TR * 0.95), k.get('thorax', col))
    for (x, y, r, c) in k.get('marks', []):
        T.spots([(x * L, y * L, r * L)], c)
    hr = L * (0.1 + 0.02 * fat)
    T.blob((0, -L * 0.37, T.z0 + TR * 0.9), (hr * 1.15, hr * 0.8, hr * 0.9), k.get('head', col))
    for s in (1, -1):
        T.ell((s * hr * 0.8, -L * 0.38), (hr * 0.4, hr * 0.55), k.get('eye', '#2a2018'))
    zt = T.z0 + TR * 1.8
    for nm, s in (('wing_L', 1), ('wing_R', -1)):
        with m.part(nm, (0, wb[1], zt)):
            T.plate([(s * x, y) for x, y in wp], zt, T.wmat, cv)
    T.off()
    lc = k.get('leg', '#2a2018')
    T.feelers(lc, (hr * 0.4, -L * 0.43, T.z0 + TR), [(L * 0.04, -L * 0.07, 0.012), (L * 0.1, -L * 0.1, 0.0)], r=L * 0.012)
    T.legs6(lc, [-L * 0.24, -L * 0.17, -L * 0.1], TR * 0.6, L * 0.2, T.z0 + TR * 0.5, r=L * 0.014, z=T.z0 + TR * 0.5)
    if k.get('sting'):
        tube((0, L * 0.49, T.z0 + AW * 0.2), (0, L * 0.56, T.z0 + AW * 0.16), L * 0.012, lc, r2=0.001, seg=4)
    T.finish()


def ant(m, name, k):
    L = k.get('len', 0.2)
    c = k['col']
    z = L * 0.2
    ball((0, -L * 0.36, z + L * 0.05), 1.0, c, (L * 0.14, L * 0.15, L * 0.12), sub=3)          # 머리
    ball((0, -L * 0.12, z), 1.0, c, (L * 0.085, L * 0.15, L * 0.09), sub=3)                    # 가슴
    ball((0, -L * 0.0, z - L * 0.005), 1.0, c, (L * 0.065, L * 0.08, L * 0.07), sub=2)
    ball((0, L * 0.09, z + L * 0.03), 1.0, c, (L * 0.035, L * 0.04, L * 0.055), sub=2)         # 허리 마디(배자루)
    ball((0, L * 0.31, z + L * 0.03), 1.0, c, (L * 0.15, L * 0.2, L * 0.14), sub=3)            # 배
    for i in range(3):                                                                        # 배마디의 윤기
        ball((0, L * (0.22 + i * 0.07), z + L * 0.03), 1.0, shade(c, 1.25), (L * 0.151, L * 0.012, L * 0.141), sub=2)
    lc = shade(c, 0.85)
    for s in (1, -1):
        ball((s * L * 0.1, -L * 0.4, z + L * 0.09), 1.0, '#141414', (L * 0.028, L * 0.038, L * 0.03), sub=2)
        tube((s * L * 0.04, -L * 0.49, z + L * 0.02), (s * L * 0.07, -L * 0.56, z - L * 0.01), L * 0.014, shade(c, 0.7), r2=L * 0.004, seg=5)    # 큰턱
        chain([(s * L * 0.06, -L * 0.46, z + L * 0.08), (s * L * 0.17, -L * 0.54, z + L * 0.16), (s * L * 0.2, -L * 0.72, z + L * 0.08)], L * 0.013, lc, r2=L * 0.008)
        for i in range(3):
            y = -L * 0.2 + i * L * 0.09
            leg3((s * L * 0.06, y, z), (s * L * 0.24, y + (i - 1) * L * 0.13, z + L * 0.15), (s * L * 0.36, y + (i - 1) * L * 0.27, 0), L * 0.012, lc)


# ============================================================================ 딱정벌레 무리
def _surface_pat(T, M, pats, W, L, seed=2):
    """등판 무늬. M(u, v) → (x, y): u는 가운데 0 → 가장자리 1, v는 앞 0 → 뒤 1. 좌우 대칭으로 그린다.
      ['spots', 색, [[u, v, 크기]…]]      ['stripes', 색, [u…], 굵기, [v0, v1]]     ['bands', 색, [[v0, v1]…], [u0, u1]]
      ['rim', 색, 폭]   ['suture', 색, 굵기]   ['sheen', 색, u, 폭, 진하기]   ['speck', 색, 개수, 크기]
      ['grooves', 색, 줄 수, 진하기]   ['grad', 색, v0, 진하기]   ['blotch', 색, 크기, 문턱, 진하기]   ['arc', 색, v, 굵기, 휨, [u0, u1]]"""
    cv = T.cv
    rnd = random.Random(seed)
    P = lambda pts: cv.P([(x, -y) for x, y in pts])
    region = [M(1, v / 16) for v in range(17)] + [(-x, y) for x, y in reversed([M(1, v / 16) for v in range(17)])]
    rm = T.mask_poly(region)
    for p in pats:
        kind, col = p[0], p[1]
        m = cv.mask()
        d = ImageDraw.Draw(m)
        alpha = 1.0
        for s in (1, -1):
            Q = lambda u, v: (s * M(u, v)[0], M(u, v)[1])
            if kind == 'spots':
                for (u, v, r) in p[2]:
                    x, y = Q(u, v)
                    d.ellipse([cv.X(x) - cv.px(r * W), cv.Y(-y) - cv.px(r * W), cv.X(x) + cv.px(r * W), cv.Y(-y) + cv.px(r * W)], fill=255)
            elif kind == 'stripes':
                v0, v1 = (p[4], p[5]) if len(p) > 5 else (0.03, 0.97)
                for u in p[2]:
                    d.line(P([Q(u, v0 + (v1 - v0) * i / 14) for i in range(15)]), fill=255, width=max(1, int(cv.px(p[3] * W))), joint='curve')
            elif kind == 'bands':
                u0, u1 = (p[3], p[4]) if len(p) > 4 else (0.0, 1.0)
                for (v0, v1) in p[2]:
                    d.polygon(P([Q(u0 + (u1 - u0) * i / 8, v0) for i in range(9)] + [Q(u0 + (u1 - u0) * i / 8, v1) for i in reversed(range(9))]), fill=255)
            elif kind == 'arc':                   # ['arc', 색, 가운데 v, 굵기, 휨, [u0, u1]] 가로로 굽은 띠(가장자리 쪽이 뒤로 처지거나 앞으로 들린다)
                u0, u1 = (p[5], p[6]) if len(p) > 6 else (0.0, 1.0)
                top = [Q(u0 + (u1 - u0) * i / 10, p[2] - p[3] / 2 + p[4] * (i / 10) ** 2) for i in range(11)]
                bot = [Q(u0 + (u1 - u0) * i / 10, p[2] + p[3] / 2 + p[4] * (i / 10) ** 2) for i in reversed(range(11))]
                d.polygon(P(top + bot), fill=255)
            elif kind == 'rim':
                d.polygon(P([Q(1, i / 16) for i in range(17)] + [Q(1 - p[2], i / 16) for i in reversed(range(17))]), fill=255)
            elif kind == 'suture':
                d.line(P([Q(0, 0), Q(0, 1)]), fill=255, width=max(1, int(cv.px(p[2] * W))))
            elif kind == 'sheen':
                d.polygon(P([Q(p[2] + p[3] / 2, 0.06 + 0.86 * i / 12) for i in range(13)] + [Q(p[2] - p[3] / 2, 0.06 + 0.86 * i / 12) for i in reversed(range(13))]), fill=255)
                alpha = p[4]
            elif kind == 'speck':
                for _ in range(p[2]):
                    x, y = Q(rnd.uniform(0.05, 0.92), rnd.uniform(0.05, 0.95))
                    r = p[3] * W * rnd.uniform(0.6, 1.4)
                    d.ellipse([cv.X(x) - cv.px(r), cv.Y(-y) - cv.px(r), cv.X(x) + cv.px(r), cv.Y(-y) + cv.px(r)], fill=255)
            elif kind == 'grooves':
                for i in range(p[2]):
                    u = (i + 0.7) / (p[2] + 0.4)
                    d.line(P([Q(u, 0.04 + 0.92 * j / 12) for j in range(13)]), fill=255, width=max(1, int(cv.px(0.012 * W))), joint='curve')
                alpha = p[3] if len(p) > 3 else 0.5
            elif kind == 'grad':
                d.polygon(P([Q(1, p[2]), Q(0, p[2]), Q(0, 1), Q(1, 1)] + [Q(1, p[2] + (1 - p[2]) * i / 8) for i in reversed(range(9))]), fill=255)
                alpha = p[3]
        if kind == 'sheen':
            m = cv.blur(m, W * 0.03)
        elif kind == 'arc':
            m = cv.blur(m, W * 0.012)
        elif kind == 'grad':
            m = cv.blur(m, L * 0.06)
        elif kind == 'blotch':
            m = cv.noise_mask(p[2] * L, p[3], seed=seed + 5)
            alpha = p[4] if len(p) > 4 else 1.0
        cv.fill_mask(col, ImageChops.multiply(m, rm), alpha)


MANDIBLE = {     # 큰턱: 뻗는 길(몸길이에 대한 비), 굵기, 안쪽 이 [자리(0~1), 길이]
    'stag': dict(path=[(0.07, 0.0), (0.17, -0.1), (0.21, -0.24), (0.15, -0.37), (0.1, -0.42)], r=0.03, teeth=[(0.5, 0.07), (0.88, 0.05)], fork=1),
    'saw': dict(path=[(0.07, 0.0), (0.18, -0.1), (0.22, -0.25), (0.15, -0.4), (0.07, -0.46)], r=0.026, teeth=[(0.3, 0.035), (0.45, 0.04), (0.6, 0.04), (0.75, 0.035), (0.88, 0.03)]),
    'flat': dict(path=[(0.08, 0.0), (0.11, -0.14), (0.11, -0.28), (0.05, -0.37)], r=0.036, teeth=[(0.28, 0.06), (0.7, 0.025)]),
    'king': dict(path=[(0.08, 0.0), (0.15, -0.09), (0.16, -0.21), (0.08, -0.3)], r=0.04, teeth=[(0.55, 0.075)]),
    'sickle': dict(path=[(0.06, 0.0), (0.13, -0.07), (0.1, -0.17), (0.02, -0.2)], r=0.02, teeth=[(0.55, 0.035)]),
}


def beetle(m, name, k):
    L = k.get('len', 0.34)
    W = L * k.get('w', 0.5)
    hd, pr = k.get('hd', 0.13), k.get('pr', 0.24)
    col = k['col']
    pc, hc = k.get('pc', col), k.get('hc', k.get('pc', col))
    lc = k.get('leg', shade(col, 0.6))
    y0 = -L / 2
    yp0, yp1 = y0 + hd * L * 0.8, y0 + (hd + pr) * L
    ye0, ye1 = yp1 - L * 0.02, L / 2
    hz, pz = W * k.get('hz', 0.42), W * k.get('pz', 0.3)
    hwf, pwf = k.get('hwf', 0.5), k.get('pwf', 0.86)
    gear = k.get('horn')
    front = L * (0.56 + (0.5 if gear in MANDIBLE else 0.0))
    T = Top(m, name, W * 0.6, L * 0.56, L * 0.56, px=k.get('px', 128), bg=col, z0=L * 0.06)
    e = k.get('ely', [0.12, 0.55, 2.0, 0.78])
    ef = ely(*e)
    T.shell(ye0, ye1, ef, via([(0, 0.7), (0.3, 1), (0.75, 0.85), (1, 0.25)]), W, hz, col, n=10, seg=10, px=k.get('ex', 2.0))
    E = lambda u, v: (u * ef(v) * W / 2, ye0 + (ye1 - ye0) * v)
    _surface_pat(T, E, k.get('pat', []) + ([] if k.get('nosuture') else [['suture', k.get('sut', shade(col, 0.6)), 0.03]]), W, L)
    pf = via(k['pshape']) if k.get('pshape') else via([(0, 0.62), (0.45, 1.0), (1, 0.94)])
    T.shell(yp0, yp1, pf, via([(0, 0.7), (0.5, 1), (1, 0.9)]), W * pwf, pz, pc, n=5, seg=8)
    Pm = lambda u, v: (u * pf(v) * W * pwf / 2, yp0 + (yp1 - yp0) * v)
    if k.get('ppat'):
        _surface_pat(T, Pm, k['ppat'], W, L, seed=4)
    T.shell(y0, y0 + hd * L * 1.25, via([(0, 0.6), (0.5, 1), (1, 0.9)]), via([(0, 0.6), (1, 1)]), W * hwf, pz * 0.75, hc, n=3, seg=6)
    if k.get('hpat'):
        Hm = lambda u, v: (u * W * hwf / 2 * 0.9, y0 + hd * L * 1.25 * v)
        _surface_pat(T, Hm, k['hpat'], W, L, seed=6)
    T.off()
    z = T.z0
    er = L * k.get('eyer', 0.022)
    for s in (1, -1):
        ball((s * W * hwf * 0.46, y0 + hd * L * 0.6, z + pz * 0.4), er, k.get('eye', '#141414'), sub=2)
    # 다리
    reach = L * k.get('reach', 0.2)
    legs = k.get('legs', 'normal')
    lr = L * k.get('legr', 0.016)
    yl = [yp0 + (yp1 - yp0) * 0.6, ye0 + L * 0.06, ye0 + L * 0.2]
    P3 = []
    for i, y in enumerate(yl):
        fy = (-0.9, 0.2, 1.0)[i]
        if legs == 'oar' and i == 2:              # 물방개의 헤엄다리
            for s in (1, -1):
                chain([(s * W * 0.3, y, z + 0.01), (s * (W * 0.5 + reach * 0.5), y + reach * 0.6, z + 0.01)], lr * 1.3, lc)
                ball((s * (W * 0.5 + reach * 0.75), y + reach * 0.95, z + 0.01), 1.0, lc, (lr * 2.2, reach * 0.45, lr * 0.8), sub=2)
            continue
        if k.get('ball') and i == 2:
            continue
        P3.append(((W * 0.3, y, z + 0.012), (W * 0.5 + reach * 0.35, y + fy * reach * 0.35, z + pz * 0.55), (W * 0.5 + reach * 0.75, y + fy * reach * 0.75)))
    T.legs(lc, P3, r=lr)
    # 더듬이
    at = k.get('ant', 'club')
    ab = (W * hwf * 0.3, y0 + hd * L * 0.2, z + pz * 0.4)
    al = L * k.get('antlen', 1.0)
    if at in ('long', 'banded'):
        path = [(0.08, -0.12, 0.05), (0.24, -0.14, 0.07), (0.38, 0.02, 0.06), (0.45, 0.26, 0.04), (0.44, 0.52, 0.02)]
        for s in (1, -1):
            pts = [(s * ab[0], ab[1], ab[2])] + [(s * (ab[0] + q[0] * al), ab[1] + q[1] * al, ab[2] + q[2] * al) for q in path]
            fine = []
            for i in range(len(pts) - 1):
                for j in range(2):
                    fine.append(tuple(pts[i][c] + (pts[i + 1][c] - pts[i][c]) * j / 2 for c in range(3)))
            fine.append(pts[-1])
            for i in range(len(fine) - 1):
                c = lc if at == 'long' or i % 2 == 0 else k.get('antc', '#dfe8f0')
                tube(fine[i], fine[i + 1], L * 0.012 * (1 - 0.05 * i), c, seg=4)
    elif at != 'none':
        T.feelers(lc, ab, [(L * 0.05, -L * 0.06, 0.01), (L * 0.1, -L * 0.08, 0.0)], r=L * 0.01, tip=L * 0.02 if at in ('club', 'fan') else None)
    # 뿔과 큰턱
    hcol = k.get('hornc', shade(hc, 0.8))
    if gear in MANDIBLE:
        md = MANDIBLE[gear]
        sc = k.get('jaw', 1.0)
        zj = z + pz * 0.3
        for s in (1, -1):
            pts = [(s * q[0] * L * (0.6 + 0.4 * sc), y0 + L * 0.03 + q[1] * L * sc, zj) for q in md['path']]
            chain(pts, md['r'] * L, hcol, r2=md['r'] * L * 0.45, seg=5)
            for (f, ln) in md['teeth']:           # 안쪽으로 난 이
                x = f * (len(pts) - 1)
                i = min(len(pts) - 2, int(x))
                p_ = tuple(pts[i][c] + (pts[i + 1][c] - pts[i][c]) * (x - i) for c in range(3))
                tube(p_, (p_[0] - s * ln * L * sc, p_[1] - ln * L * 0.4 * sc, zj), md['r'] * L * 0.6, hcol, r2=0.002, seg=4)
            if md.get('fork'):
                tube(pts[-1], (pts[-1][0] + s * L * 0.03, pts[-1][1] - L * 0.05 * sc, zj), md['r'] * L * 0.4, hcol, r2=0.002, seg=4)
    elif gear == 'rhino':
        zb = z + pz * 0.6
        chain([(0, y0 + L * 0.05, zb), (0, y0 - L * 0.12, zb + L * 0.1), (0, y0 - L * 0.26, zb + L * 0.26)], L * 0.04, hcol, r2=L * 0.028, seg=6)
        for s in (1, -1):
            tip = (s * L * 0.07, y0 - L * 0.33, zb + L * 0.32)
            tube((0, y0 - L * 0.26, zb + L * 0.26), tip, L * 0.026, hcol, r2=L * 0.02, seg=5)
            tube(tip, (s * L * 0.11, y0 - L * 0.35, zb + L * 0.36), L * 0.02, hcol, r2=0.003, seg=4)
            tube(tip, (s * L * 0.05, y0 - L * 0.38, zb + L * 0.35), L * 0.02, hcol, r2=0.003, seg=4)
        chain([(0, yp0 + L * 0.06, z + pz), (0, yp0 - L * 0.04, z + pz + L * 0.12)], L * 0.03, hcol, r2=L * 0.02, seg=5)
        for s in (1, -1):
            tube((0, yp0 - L * 0.04, z + pz + L * 0.12), (s * L * 0.03, yp0 - L * 0.08, z + pz + L * 0.15), L * 0.016, hcol, r2=0.003, seg=4)
    elif gear == 'antler':                        # 사슴풍뎅이 수컷의 사슴뿔
        zb = z + pz * 0.5
        for s in (1, -1):
            pts = [(s * W * 0.14, y0 + L * 0.04, zb), (s * W * 0.3, y0 - L * 0.1, zb + L * 0.1), (s * W * 0.36, y0 - L * 0.2, zb + L * 0.22), (s * W * 0.2, y0 - L * 0.26, zb + L * 0.3)]
            chain(pts, L * 0.024, hcol, r2=L * 0.01, seg=5)
            tube(pts[2], (s * W * 0.56, y0 - L * 0.24, zb + L * 0.26), L * 0.014, hcol, r2=0.002, seg=4)
    elif gear == 'snout':                         # 바구미의 긴 주둥이
        zb = z + pz * 0.5
        chain([(0, y0 + L * 0.04, zb), (0, y0 - L * 0.14, zb + L * 0.01), (0, y0 - L * 0.3, zb - L * 0.06)], L * 0.026, hc, r2=L * 0.016, seg=6)
        for s in (1, -1):
            chain([(s * L * 0.01, y0 - L * 0.16, zb), (s * L * 0.09, y0 - L * 0.2, zb + L * 0.03), (s * L * 0.14, y0 - L * 0.3, zb + L * 0.02)], L * 0.01, lc)
            ball((s * L * 0.14, y0 - L * 0.3, zb + L * 0.02), L * 0.018, lc, sub=2)
    if k.get('glow'):                             # 반딧불이의 불빛
        with m.part('glow'):
            ball((0, ye1 - L * 0.06, z + hz * 0.3), 1.0, '#eaff8a', (W * 0.36, L * 0.1, hz * 0.6), sub=2)
    if k.get('ball'):                             # 쇠똥구리의 경단: 뒷다리로 받치고 뒷걸음질로 굴린다(게임에서 굴릴 수 있게 따로 둔 부위)
        br = L * 0.3
        bc = Vector((0, ye1 + br * 0.92, br))
        T.off()
        with m.part('ball', tuple(bc)):
            ball(tuple(bc), br, k['ball'], sub=3)
            rnd = random.Random(7)
            for i in range(30):                   # 겉에 박힌 흙 알갱이와 짚 부스러기
                a, b_ = rnd.uniform(0, 2 * math.pi), math.acos(rnd.uniform(-0.95, 0.95))
                n_ = Vector((math.cos(a) * math.sin(b_), math.sin(a) * math.sin(b_), math.cos(b_)))
                q = bc + n_ * br * 0.97
                if i % 4 == 0:
                    tube(tuple(q), tuple(q + (n_.cross(Vector((0, 0, 1))).normalized() if abs(n_.z) < 0.95 else Vector((1, 0, 0))) * br * 0.3 + n_ * br * 0.04), br * 0.022, '#c8b070', seg=4)
                else:
                    ball(tuple(q), br * rnd.uniform(0.05, 0.11), shade(k['ball'], rnd.uniform(0.72, 1.18)), (1, 1, 0.6), sub=1)
        for s in (1, -1):                         # 경단을 받친 뒷다리
            chain([(s * W * 0.3, ye1 - L * 0.12, z + 0.012), (s * W * 0.52, ye1 + L * 0.02, z + hz * 0.9), (s * br * 0.72, bc.y - br * 0.25, br * 1.3)], lr * 1.3, lc, r2=lr * 0.7)
    T.finish()


# ============================================================================ 메뚜기·여치·귀뚜라미
def hopper(m, name, k):
    L = k.get('len', 0.4)
    fat = k.get('fat', 0.0)
    col = k['col']
    wc = k.get('wingc', col)
    W = L * (0.2 + 0.1 * fat)
    H = W * k.get('tall', 1.05)
    pointy = k.get('head') == 'cone'
    T = Top(m, name, W * k.get('wingw', 1.0) * 0.62 + 0.01, L * 0.56, L * 0.58, px=96, bg=col, z0=L * 0.07)
    wend = -L * 0.2 + L * 0.7 * k.get('wing', 1.0)
    yab = L * (0.44 if k.get('wing', 1.0) >= 0.95 else 0.5)
    # 배(날개 아래)
    T.shell(-L * 0.2, yab, via([(0, 0.9), (0.4, 1), (1, 0.3)]), via([(0, 0.9), (0.5, 0.9), (1, 0.4)]), W, H * 0.8, k.get('abd', col), n=6, seg=6)
    if k.get('seg'):
        for i in range(1, 7):
            y = -L * 0.1 + (yab + L * 0.1) * i / 7
            T.line([(-W, y), (W, y)], L * 0.01, k['seg'])
    # 앞날개(등 위를 지붕처럼 덮는다)
    ww = W * k.get('wingw', 1.0)
    T.shell(-L * 0.22, wend, via([(0, 0.85), (0.3, 1), (0.75, 0.8), (1, 0.2)]), via([(0, 0.95), (0.5, 1), (1, 0.5)]), ww, H * (1.0 if k.get('wingw', 1.0) < 1.2 else 0.6), wc, n=7, seg=6, z0=T.z0 + H * 0.12)
    if k.get('stripe'):                           # 등 가운데 줄
        T.line([(0, -L * 0.48), (0, wend)], W * 0.26, k['stripe'])
    if k.get('wspeck'):
        T.speck(k['wspeck'], 22, L * 0.012, (-ww * 0.4, ww * 0.4, -L * 0.18, wend - L * 0.04))
    if k.get('wveins'):
        for s in (1, -1):
            for u in (0.25, 0.6):
                T.line([(s * ww * 0.5 * u, -L * 0.2), (s * ww * 0.4 * u, wend - L * 0.06)], L * 0.008, k['wveins'])
    # 앞가슴
    T.shell(-L * 0.38, -L * 0.19, sup(3.0), via([(0, 0.9), (1, 1)]), W * 0.98, H * 1.05, k.get('pro', col), n=4, seg=6)
    if k.get('side'):                             # 눈 뒤에서 앞가슴 옆으로 이어지는 짙은 줄
        for s in (1, -1):
            T.line([(s * W * 0.36, -L * 0.46), (s * W * 0.4, -L * 0.2)], W * 0.2, k['side'])
    # 머리
    if pointy:
        T.shell(-L * 0.6, -L * 0.36, via([(0, 0.15), (0.6, 0.7), (1, 0.95)]), via([(0, 0.3), (1, 1)]), W * 0.9, H, k.get('headc', col), n=5, seg=6)
    else:
        T.shell(-L * 0.5, -L * 0.36, via([(0, 0.55), (0.5, 1), (1, 0.95)]), via([(0, 0.7), (0.5, 1), (1, 1)]), W * 0.92 * k.get('headw', 1.0), H * 1.02, k.get('headc', col), n=4, seg=6)
    T.off()
    z = T.z0
    hw_ = W * 0.92 * k.get('headw', 1.0)
    for s in (1, -1):                             # 겹눈: 머리 양옆 위쪽에 불룩하게
        ball((s * (W * 0.34 if pointy else hw_ * 0.4), -L * (0.44 if pointy else 0.445), z + H * (0.72 if pointy else 0.78)), 1.0, k.get('eye', '#2a2018'), (L * 0.024, L * 0.034, L * 0.03), sub=2)
    if not pointy:                                  # 입(큰턱): 얼굴 아래
        ball((0, -L * 0.488, z + H * 0.2), 1.0, shade(k.get('headc', col), 0.62), (hw_ * 0.26, L * 0.02, H * 0.2), sub=2)
    # 더듬이
    al = L * k.get('ant', 0.3)
    ac = k.get('antc', shade(col, 0.7))
    yb_ = -L * (0.56 if pointy else 0.48)
    if al > L * 0.6:
        T.feelers(ac, (W * 0.15, yb_, z + H * 0.85), [(al * 0.15, -al * 0.2, 0.03), (al * 0.4, -al * 0.2, 0.05), (al * 0.62, al * 0.1, 0.03), (al * 0.7, al * 0.5, 0.0)], r=L * 0.006)
    else:
        T.feelers(ac, (W * 0.15, yb_, z + H * 0.85), [(al * 0.3, -al * 0.6, 0.02), (al * 0.5, -al, 0.03)], r=L * (0.014 if pointy else 0.008))
    # 다리
    lc = k.get('leg', shade(col, 0.82))
    hc = k.get('hind', col)
    hs = k.get('hsize', 1.0)
    for s in (1, -1):
        # 뒷다리: 굵은 넓적다리가 무릎에서 위로 꺾이고, 가는 종아리가 땅을 짚는다
        hip = Vector((s * W * 0.44, -L * 0.03, z + H * 0.4))
        knee = Vector((s * (W * 0.5 + L * 0.13 * hs), L * 0.22 * hs, z + H * 0.95 + L * 0.11 * hs))
        foot = Vector((s * (W * 0.5 + L * 0.19 * hs), L * 0.42 * hs, 0.0))
        p1 = hip.lerp(knee, 0.3)
        fr = L * 0.05 * hs * (0.75 if pointy else 1.0)
        tube(tuple(hip), tuple(p1), fr * 0.72, hc, r2=fr, seg=8)
        tube(tuple(p1), tuple(knee), fr, hc, r2=L * 0.017, seg=8)
        ball(tuple(knee), L * 0.021, k.get('knee', shade(hc, 0.6)), sub=2)
        tb = k.get('tibia', lc)
        tube(tuple(knee), tuple(foot), L * 0.014, tb, r2=L * 0.009, seg=6)
        tube(tuple(foot), (foot.x + s * L * 0.01, foot.y - L * 0.085, 0.0), L * 0.011, tb, r2=L * 0.005, seg=5)     # 발목마디
        for i, y in enumerate((-L * 0.3, -L * 0.17)):
            if k.get('dig') and i == 0:           # 땅강아지의 삽 같은 앞다리
                tube((s * W * 0.4, y, z + H * 0.3), (s * (W * 0.5 + L * 0.06), y - L * 0.08, z + H * 0.2), L * 0.034, lc, seg=8)
                ball((s * (W * 0.5 + L * 0.09), y - L * 0.13, z + H * 0.15), 1.0, lc, (L * 0.055, L * 0.065, L * 0.032), sub=2)
                for j in range(4):                # 삽날의 발톱
                    a = math.radians(-30 + j * 28)
                    cone((s * (W * 0.5 + L * 0.09 + math.sin(a) * L * 0.05), y - L * 0.13 - math.cos(a) * L * 0.055, z + H * 0.1), L * 0.012, L * 0.035, shade(lc, 0.7), seg=5, rot=(90 + 10, 0, -s * math.degrees(a)))
            else:
                leg3((s * W * 0.4, y, z + H * 0.3), (s * (W * 0.5 + L * 0.08), y - L * 0.04 + i * L * 0.06, z + H * 0.62), (s * (W * 0.5 + L * 0.13), y - L * 0.1 + i * L * 0.13, 0.0), L * 0.0105, lc)
        if k.get('cerci'):
            tube((s * W * 0.15, yab - L * 0.02, z + H * 0.3), (s * W * 0.5, yab + L * 0.16, z + H * 0.3), L * 0.01, lc, r2=0.002, seg=5)
    T.finish()


def mantis(m, name, k):
    L = k.get('len', 0.5)
    col = k['col']
    wc = k.get('wingc', col)
    T = Top(m, name, L * 0.2, L * 0.6, L * 0.58, px=96, bg=col, z0=L * 0.13)
    AW = L * k.get('w', 0.2)
    # 배와 그 위를 덮은 날개
    T.shell(-L * 0.04, L * 0.5, via([(0, 0.5), (0.35, 1), (0.8, 0.8), (1, 0.2)]), via([(0, 0.8), (0.4, 1), (1, 0.4)]), AW, AW * 0.62, k.get('abd', col), n=7, seg=6)
    T.shell(-L * 0.06, L * 0.5, via([(0, 0.5), (0.35, 0.86), (0.8, 0.7), (1, 0.15)]), via([(0, 0.8), (0.4, 1), (1, 0.4)]), AW, AW * 0.62, wc, n=7, seg=6, z0=T.z0 + AW * 0.08)
    if k.get('edge'):                             # 날개 가장자리의 밝은 줄
        for s in (1, -1):
            T.line([(s * AW * 0.2, -L * 0.04), (s * AW * 0.4, L * 0.14), (s * AW * 0.3, L * 0.4)], L * 0.012, k['edge'])
    T.line([(0, -L * 0.02), (0, L * 0.46)], L * 0.006, shade(wc, 0.75))
    for i in range(5):                            # 날개맥
        for s in (1, -1):
            T.line([(s * AW * 0.08 * (i + 1) / 3, L * 0.02), (s * AW * 0.1 * (i + 1) / 3, L * 0.42)], L * 0.003, shade(wc, 0.86))
    # 긴 앞가슴과 세모난 머리(나중에 함께 치켜세운다)
    pc = k.get('pro', col)
    f1 = T.shell(-L * 0.4, L * 0.0, via([(0, 0.7), (0.22, 1), (1, 0.7)]), const(1.0), L * 0.07, L * 0.05, pc, n=5, seg=6, z0=T.z0 + AW * 0.12)
    hc = k.get('headc', col)
    f2 = T.shell(-L * 0.5, -L * 0.385, via([(0, 0.12), (0.45, 0.72), (0.8, 1), (1, 0.55)]), via([(0, 0.5), (0.7, 1), (1, 0.9)]), L * 0.17, L * 0.06, hc, n=5, seg=6, z0=T.z0 + AW * 0.12)
    pv = (0, L * 0.0, T.z0 + AW * 0.25)
    lift = k.get('lift', 34)
    rot_about(f1 + f2, pv, 'X', -lift)            # 앞가슴과 머리를 세운다
    T.off()
    lc = k.get('leg', shade(col, 0.85))
    R = Matrix.Translation(Vector(pv)) @ Matrix.Rotation(math.radians(-lift), 4, 'X') @ Matrix.Translation(-Vector(pv))
    up = lambda p: tuple(R @ Vector(p))
    z = T.z0 + AW * 0.12
    ec = k.get('eye', '#6a9a3a')
    for s in (1, -1):
        ball(up((s * L * 0.07, -L * 0.42, z + L * 0.035)), 1.0, ec, (L * 0.028, L * 0.034, L * 0.03), sub=2)      # 머리 양 끝의 큰 겹눈
        ball(up((s * L * 0.076, -L * 0.43, z + L * 0.04)), L * 0.008, '#1e1a14', sub=2)                          # 눈동자처럼 보이는 검은 점
        chain([up((s * L * 0.02, -L * 0.47, z + L * 0.05)), up((s * L * 0.06, -L * 0.6, z + L * 0.09)), up((s * L * 0.1, -L * 0.74, z + L * 0.08))], L * 0.004, lc, r2=L * 0.002, seg=5)   # 더듬이
        # 낫 같은 앞다리: 밑마디(아래로) → 굵은 넓적다리(앞으로 치켜듦) → 접힌 종아리(낫)
        c0 = up((s * L * 0.03, -L * 0.33, z + L * 0.0))
        c1 = up((s * L * 0.075, -L * 0.3, z - L * 0.1))
        f_ = up((s * L * 0.085, -L * 0.5, z - L * 0.03))
        t_ = up((s * L * 0.06, -L * 0.36, z - L * 0.075))
        arm = k.get('arm', col)
        tube(c0, c1, L * 0.017, arm, r2=L * 0.02, seg=6)
        ball(c1, L * 0.022, arm, sub=2)
        tube(c1, f_, L * 0.03, arm, r2=L * 0.022, seg=8)
        ball(f_, L * 0.022, arm, sub=2)
        tube(f_, t_, L * 0.016, shade(arm, 0.9), r2=L * 0.004, seg=6)
        cv, fv = Vector(c1), Vector(f_)
        for j in range(5):                        # 넓적다리 안쪽의 가시
            q = cv.lerp(fv, 0.25 + j * 0.15)
            cone((q.x - s * L * 0.012, q.y, q.z - L * 0.02), L * 0.006, L * 0.03, shade(arm, 0.7), seg=4, rot=(180, 0, 0))
        for i, y in enumerate((L * 0.02, L * 0.12)):     # 걷는 다리 두 쌍
            leg3((s * L * 0.03, y, T.z0 + AW * 0.25), (s * L * 0.2, y - L * 0.05 + i * L * 0.16, T.z0 + L * 0.12), (s * L * 0.28, y - L * 0.1 + i * L * 0.3, 0.0), L * 0.0085, lc, tarsus=0.2)
    T.finish()


def stick(m, name, k):
    L = k.get('len', 0.6)
    col = k['col']
    T = Top(m, name, L * 0.06, L * 0.56, L * 0.56, px=48, bg=col, z0=L * 0.09)
    T.shell(-L * 0.5, L * 0.5, via([(0, 0.6), (0.06, 1), (0.3, 0.8), (0.8, 0.8), (1, 0.4)]), const(1.0), L * 0.045, L * 0.04, col, n=10, seg=6)
    for i in range(1, 9):
        y = -L * 0.4 + L * 0.85 * i / 9
        T.line([(-L * 0.03, y), (L * 0.03, y)], L * 0.008, shade(col, 0.75))
    T.off()
    lc = shade(col, 0.9)
    z = T.z0 + L * 0.02
    for s in (1, -1):
        ball((s * L * 0.016, -L * 0.47, z + L * 0.012), L * 0.008, '#2a2018', sub=2)
        chain([(s * L * 0.01, -L * 0.5, z), (s * L * 0.03, -L * 0.6, z + 0.01)], L * 0.004, lc)
        chain([(s * L * 0.02, -L * 0.36, z), (s * L * 0.1, -L * 0.6, z + L * 0.08), (s * L * 0.14, -L * 0.82, 0.0)], L * 0.008, lc, r2=L * 0.005)
        chain([(s * L * 0.02, -L * 0.2, z), (s * L * 0.2, -L * 0.22, z + L * 0.1), (s * L * 0.36, -L * 0.12, 0.0)], L * 0.008, lc, r2=L * 0.005)
        chain([(s * L * 0.02, -L * 0.04, z), (s * L * 0.18, L * 0.08, z + L * 0.1), (s * L * 0.3, L * 0.3, 0.0)], L * 0.008, lc, r2=L * 0.005)
    T.finish()


# ============================================================================ 노린재와 물에 사는 노린재 무리
def shield(m, name, k):
    L = k.get('len', 0.3)
    W = L * k.get('w', 0.64)
    col = k['col']
    oval = k.get('oval')
    T = Top(m, name, W * 0.62, L * 0.56, L * 0.56, px=128, bg=col, z0=L * 0.06)
    wf = sup(2.2, 0.9) if oval else via([(0, 0.18), (0.1, 0.36), (0.22, 0.56), (0.3, 1.0), (0.42, 0.88), (0.76, 0.84), (0.92, 0.5), (1, 0.24)])
    T.shell(-L / 2, L / 2, wf, via([(0, 0.4), (0.4, 1), (1, 0.5)]), W, W * (0.5 if oval else 0.3), col, n=12, seg=8)
    Y = lambda t: -L / 2 + L * t
    if k.get('edge'):                             # 배 가장자리의 얼룩(결합판)
        for i in range(6):
            t0, t1 = 0.46 + i * 0.07, 0.46 + i * 0.07 + 0.035
            for s in (1, -1):
                T.poly([(s * wf(t0) * W * 0.5, Y(t0)), (s * wf(t1) * W * 0.5, Y(t1)), (s * wf(t1) * W * 0.4, Y(t1)), (s * wf(t0) * W * 0.4, Y(t0))], k['edge'])
    if not oval:
        T.poly([(-W * 0.2, Y(0.84)), (0, Y(0.66)), (W * 0.2, Y(0.84)), (W * 0.1, Y(0.98)), (-W * 0.1, Y(0.98))], k.get('mem', shade(col, 0.6)))      # 막질 날개 끝
        T.poly([(-W * 0.24, Y(0.33)), (W * 0.24, Y(0.33)), (0, Y(0.7))], k.get('scu', shade(col, 0.9)))       # 작은방패판
        T.line([(-W * 0.24, Y(0.33)), (0, Y(0.7)), (W * 0.24, Y(0.33))], L * 0.01, shade(col, 0.65))
        T.line([(-W * 0.46, Y(0.31)), (W * 0.46, Y(0.31))], L * 0.01, shade(col, 0.7))
    for q in k.get('polys', []):                  # 무늬 조각: [[(x, y)…], 색] (몸길이·너비에 대한 비, 좌우 대칭)
        for s in (1, -1):
            T.poly([(s * x * W, Y(y)) for x, y in q[0]], q[1])
    for q in k.get('marks', []):                  # 무늬 선: [[(x, y)…], 굵기, 색]
        for s in (1, -1):
            T.line([(s * x * W, Y(y)) for x, y in q[0]], q[1] * L, q[2])
    for (x, y, r, c) in k.get('spots', []):
        T.spots([(x * W, Y(y), r * L)], c)
    T.off()
    lc = k.get('leg', shade(col, 0.6))
    z = T.z0
    for s in (1, -1):
        ball((s * W * 0.1, Y(0.06), z + L * 0.03), L * 0.02, '#3a1e1a', sub=2)
        chain([(s * W * 0.05, Y(0.02), z + L * 0.02), (s * W * 0.3, Y(-0.12), z + L * 0.05), (s * W * 0.5, Y(-0.3), z + L * 0.03)], L * 0.01, k.get('antc', lc))
    T.legs6(lc, [Y(0.28), Y(0.42), Y(0.56)], W * 0.25, L * 0.3, z + L * 0.1, r=L * 0.012)
    T.finish()


def waterbug(m, name, k):
    """kind: 'giant'(물장군) | 'scorpion'(장구애비) | 'back'(송장헤엄치게) | 'strider'(소금쟁이)"""
    L = k.get('len', 0.4)
    kind = k.get('kind', 'giant')
    col = k['col']
    c2 = k.get('col2', shade(col, 0.7))
    W = L * {'giant': 0.5, 'scorpion': 0.38, 'back': 0.36, 'strider': 0.14}[kind]
    T = Top(m, name, W * 0.62, L * 0.56, L * 0.56, px=96, bg=col, z0=L * (0.02 if kind != 'giant' else 0.03))
    Y = lambda t: -L / 2 + L * t
    wf = {'giant': sup(2.4, 0.85), 'scorpion': via([(0, 0.3), (0.2, 0.8), (0.5, 1), (0.85, 0.8), (1, 0.3)]), 'back': via([(0, 0.6), (0.25, 1), (0.6, 0.86), (1, 0.2)]), 'strider': via([(0, 0.5), (0.2, 1), (0.6, 0.8), (1, 0.3)])}[kind]
    T.shell(-L / 2, L / 2, wf, via([(0, 0.5), (0.4, 1), (1, 0.5)]), W, W * (0.24 if kind in ('giant', 'scorpion') else 0.5), col, n=10, seg=8)
    lc = k.get('leg', shade(col, 0.75))
    z = T.z0
    if kind in ('giant', 'scorpion'):
        T.poly([(-W * 0.34, Y(0.62)), (0, Y(0.5)), (W * 0.34, Y(0.62)), (W * 0.2, Y(0.97)), (-W * 0.2, Y(0.97))], c2)        # 막질부
        T.line([(-W * 0.44, Y(0.3)), (W * 0.44, Y(0.3))], L * 0.012, c2)
        T.poly([(-W * 0.2, Y(0.31)), (W * 0.2, Y(0.31)), (0, Y(0.5))], shade(col, 0.88))
        T.line([(-W * 0.2, Y(0.31)), (0, Y(0.5)), (W * 0.2, Y(0.31))], L * 0.01, c2)
        for s in (1, -1):
            T.line([(s * W * 0.2, Y(0.33)), (s * W * 0.4, Y(0.7))], L * 0.008, c2)
            T.line([(s * W * 0.1, Y(0.12)), (s * W * 0.26, Y(0.28))], L * 0.01, c2)
            T.ell((s * W * 0.22, Y(0.07)), (L * 0.03, L * 0.035), '#1e1a16')
    elif kind == 'back':
        T.poly([(-W * 0.4, Y(0.5)), (W * 0.4, Y(0.5)), (W * 0.2, Y(0.98)), (-W * 0.2, Y(0.98))], c2)
        T.poly([(-W * 0.16, Y(0.28)), (W * 0.16, Y(0.28)), (0, Y(0.5))], k.get('scu', '#2a2a2a'))
        for s in (1, -1):
            T.ell((s * W * 0.26, Y(0.1)), (L * 0.05, L * 0.06), k.get('eye', '#8a3a2a'))
    T.off()
    if kind == 'giant':
        for s in (1, -1):                         # 갈고리 같은 앞다리
            chain([(s * W * 0.3, Y(0.16), z + 0.01), (s * W * 0.7, Y(-0.02), z + 0.02), (s * W * 0.5, Y(-0.22), z + 0.01), (s * W * 0.2, Y(-0.2), z)], L * 0.035, lc, r2=L * 0.01, seg=5)
            chain([(s * W * 0.4, Y(0.4), z), (s * W * 0.9, Y(0.5), z + 0.01), (s * W * 1.0, Y(0.72), z)], L * 0.022, lc, r2=L * 0.014)
            chain([(s * W * 0.4, Y(0.52), z), (s * W * 0.86, Y(0.74), z + 0.01), (s * W * 0.8, Y(0.98), z)], L * 0.022, lc, r2=L * 0.014)
    elif kind == 'scorpion':
        for s in (1, -1):
            chain([(s * W * 0.2, Y(0.08), z + 0.01), (s * W * 0.6, Y(-0.2), z + 0.02), (s * W * 0.3, Y(-0.46), z + 0.01)], L * 0.022, lc, r2=L * 0.008, seg=5)
            chain([(s * W * 0.4, Y(0.36), z), (s * W * 1.0, Y(0.34), z + 0.01), (s * W * 1.3, Y(0.5), z)], L * 0.012, lc, r2=L * 0.006)
            chain([(s * W * 0.4, Y(0.5), z), (s * W * 0.96, Y(0.66), z + 0.01), (s * W * 1.1, Y(0.9), z)], L * 0.012, lc, r2=L * 0.006)
            tube((s * L * 0.008, Y(0.98), z + 0.01), (s * L * 0.012, Y(1.6), z + 0.01), L * 0.006, c2, seg=4)        # 숨관
    elif kind == 'back':
        for s in (1, -1):
            chain([(s * W * 0.3, Y(0.46), z + 0.01), (s * W * 1.5, Y(0.4), z + 0.01)], L * 0.018, lc)                # 노 같은 뒷다리
            ball((s * W * 1.9, Y(0.44), z + 0.01), 1.0, lc, (W * 0.5, L * 0.03, L * 0.008), sub=2)
            chain([(s * W * 0.3, Y(0.2), z), (s * W * 0.7, Y(0.06), z + 0.01), (s * W * 0.6, Y(-0.08), z)], L * 0.012, lc)
    else:                                         # 소금쟁이: 물 위에 뜬 긴 다리
        for s in (1, -1):
            ball((s * W * 0.34, Y(0.08), z + W * 0.3), L * 0.02, '#1a1a1a', sub=2)
            chain([(s * W * 0.3, Y(0.16), z + 0.01), (s * W * 0.9, Y(0.02), z + 0.03), (s * W * 0.8, Y(-0.14), 0.0)], L * 0.01, lc)
            chain([(s * W * 0.3, Y(0.36), z + 0.01), (s * W * 2.6, Y(0.2), z + 0.05), (s * W * 5.0, Y(0.02), 0.0)], L * 0.008, lc)
            chain([(s * W * 0.3, Y(0.5), z + 0.01), (s * W * 2.2, Y(0.74), z + 0.05), (s * W * 3.8, Y(1.2), 0.0)], L * 0.008, lc)
    T.finish()


# ============================================================================ 그 밖의 작은 동물
def pill(m, name, k):
    L = k.get('len', 0.26)
    W = L * 0.56
    col = k['col']
    T = Top(m, name, W * 0.62, L * 0.56, L * 0.56, px=96, bg=col, z0=L * 0.03)
    T.shell(-L / 2, L / 2, sup(2.6), via([(0, 0.5), (0.3, 1), (0.7, 1), (1, 0.5)]), W, W * 0.5, col, n=10, seg=8)
    for i in range(1, 9):
        y = -L / 2 + L * i / 9
        T.line([(-W * 0.5, y), (W * 0.5, y)], L * 0.016, shade(col, 0.62))
        T.line([(-W * 0.5, y + L * 0.02), (W * 0.5, y + L * 0.02)], L * 0.012, shade(col, 1.3))
    T.off()
    lc = shade(col, 0.7)
    for s in (1, -1):
        chain([(s * W * 0.12, -L * 0.48, T.z0 + L * 0.04), (s * W * 0.4, -L * 0.62, T.z0 + L * 0.06), (s * W * 0.6, -L * 0.7, T.z0)], L * 0.012, lc)
        for i in range(5):
            y = -L * 0.3 + i * L * 0.15
            tube((s * W * 0.4, y, T.z0), (s * W * 0.62, y, 0.0), L * 0.012, lc, seg=4)
    T.finish()


def spider(m, name, k):
    """무당거미: 길쭉한 배에 노랑·청회색 가로띠, 긴 다리에도 띠"""
    L = k.get('len', 0.34)
    col = k['col']
    T = Top(m, name, L * 0.2, L * 0.56, L * 0.56, px=80, bg=col, z0=L * 0.12)
    T.shell(-L * 0.12, L * 0.5, sup(2.3, 0.9), via([(0, 0.6), (0.4, 1), (1, 0.6)]), L * 0.26, L * 0.2, col, n=9, seg=8)
    for i, c in enumerate(k.get('bands', [])):
        y = -L * 0.06 + L * 0.52 * i / max(1, len(k.get('bands', [])))
        T.poly([(-L * 0.2, y), (L * 0.2, y), (L * 0.2, y + L * 0.045), (-L * 0.2, y + L * 0.045)], c)
    if k.get('tip'):
        T.ell((0, L * 0.47), (L * 0.07, L * 0.05), k['tip'])
    T.shell(-L * 0.42, -L * 0.1, sup(2.2, 1.1), via([(0, 0.6), (0.5, 1), (1, 0.8)]), L * 0.17, L * 0.09, k.get('head', '#c9ccd0'), n=5, seg=6)
    T.off()
    lc, l2 = k.get('leg', '#1e1e1e'), k.get('leg2', '#e8c030')
    z = T.z0 + L * 0.04
    ends = [(-0.62, -0.5), (-0.74, -0.14), (-0.72, 0.2), (-0.56, 0.6)] if False else [(0.36, -0.84), (0.6, -0.5), (0.62, 0.34), (0.42, 0.86)]
    for s in (1, -1):
        for i, (ex, ey) in enumerate(ends):
            a = (s * L * 0.07, -L * 0.3 + i * L * 0.05, z)
            b = (s * L * ex * 0.55, L * ey * 0.5 - L * 0.1, z + L * 0.22)
            c = (s * L * ex, L * ey, 0.0)
            mid = tuple((b[j] + c[j]) / 2 for j in range(3))
            tube(a, b, L * 0.012, lc, seg=4)
            tube(b, mid, L * 0.011, l2, seg=4)
            tube(mid, c, L * 0.009, lc, r2=L * 0.005, seg=4)
        ball((s * L * 0.03, -L * 0.4, z + L * 0.03), L * 0.012, '#141414', sub=2)
    T.finish()


def spiral_shell(apex_dir, mouth, r0, turns=4.2, k=0.62, cols=('#e8d9b8', '#b8845a'), stripes=(2, 6), seg=12, per=16):
    """고둥 껍데기: 점점 가늘어지는 관이 축을 감아 올라가는 나선. mouth=입구(관이 시작하는 곳)의 가운데, apex_dir=뾰족한 끝이 향하는 쪽.
    입구는 앞(-Y) 쪽으로 열린다. stripes: 단면에서 둘째 색을 칠할 칸(나선을 따라 띠가 된다)."""
    Z = Vector(apex_dir).normalized()
    Y = (Vector((0, 1, 0)) - Z * Z.y).normalized()          # 입구의 반대쪽(뒤)
    X = Y.cross(Z)
    R0 = r0 * 0.5
    H = r0 * 2.3
    org = Vector(mouth) - X * R0
    n = int(turns * per)
    V = []
    for i in range(n + 1):
        th = 2 * math.pi * i / per
        g = k ** (i / per)
        er = X * math.cos(th) + Y * math.sin(th)
        c = org + er * (R0 * g) + Z * (H * (1 - g))
        for j in range(seg):
            ph = 2 * math.pi * j / seg
            V.append(c + (er * math.cos(ph) + Z * math.sin(ph)) * (r0 * g))
    FA, FB = [], []
    for i in range(n):
        for j in range(seg):
            f = (i * seg + j, i * seg + (j + 1) % seg, (i + 1) * seg + (j + 1) % seg, (i + 1) * seg + j)
            (FB if j in stripes else FA).append(f)
    FA.append(tuple(range(n * seg, n * seg + seg)))          # 뾰족한 끝을 막는다
    fa = poly([tuple(v) for v in V], FA, cols[0], smooth=True)
    fb = poly([tuple(v) for v in V], FB, cols[1], smooth=True)
    fix_normals(list(fa) + list(fb))
    lip = [V[j] for j in range(seg)]                         # 입구의 두툼한 입술
    for j in range(seg):
        tube(tuple(lip[j]), tuple(lip[(j + 1) % seg]), r0 * 0.07, shade(cols[0], 1.08), seg=5)
    return org


def hermit(m, name, k):
    """소라게: 나선으로 감긴 고둥 껍데기를 짊어지고, 입구로 몸 앞쪽과 집게·다리만 내민다(오른쪽 집게가 더 크다)"""
    L = k.get('len', 0.34)
    sh, s2 = k.get('shell', '#e8d9b8'), k.get('shell2', '#b8845a')
    col = k['col']
    mouth = (0, -L * 0.02, L * 0.2)
    spiral_shell((0.3, 0.72, 0.62), mouth, L * 0.2, cols=(sh, s2))
    ball((0, -L * 0.02, L * 0.19), 1.0, '#3a2a22', (L * 0.17, L * 0.05, L * 0.17), sub=2)        # 입구 안쪽의 어두운 속
    ball((0, -L * 0.17, L * 0.12), 1.0, col, (L * 0.12, L * 0.13, L * 0.09), sub=3)             # 내민 몸(머리가슴)
    lc = shade(col, 0.85)
    tipc = k.get('tip', shade(col, 1.3))
    for s in (1, -1):
        tube((s * L * 0.04, -L * 0.25, L * 0.16), (s * L * 0.06, -L * 0.33, L * 0.26), L * 0.012, lc, seg=5)        # 눈자루
        ball((s * L * 0.06, -L * 0.34, L * 0.27), L * 0.024, '#141414', sub=2)
        chain([(s * L * 0.03, -L * 0.28, L * 0.13), (s * L * 0.18, -L * 0.52, L * 0.2), (s * L * 0.28, -L * 0.72, L * 0.1)], L * 0.006, lc, r2=L * 0.003)      # 긴 더듬이
        cl = 1.3 if s > 0 else 0.9               # 오른쪽 집게가 더 크다
        a_, b_ = (s * L * 0.1, -L * 0.22, L * 0.09), (s * L * 0.24, -L * 0.36, L * 0.1)
        tube(a_, b_, L * 0.04 * cl, col, r2=L * 0.045 * cl, seg=7)
        ball(b_, L * 0.046 * cl, col, sub=2)
        hand = (s * L * 0.2, -L * 0.47, L * 0.08)
        ball(hand, 1.0, col, (L * 0.07 * cl, L * 0.095 * cl, L * 0.055 * cl), sub=3)
        tube((hand[0] + s * L * 0.02 * cl, hand[1] - L * 0.05 * cl, hand[2]), (s * L * 0.15, -L * 0.47 - L * 0.17 * cl, L * 0.06), L * 0.026 * cl, tipc, r2=0.003, seg=6)
        tube((hand[0] - s * L * 0.03 * cl, hand[1] - L * 0.05 * cl, hand[2]), (s * L * 0.11, -L * 0.47 - L * 0.15 * cl, L * 0.05), L * 0.02 * cl, tipc, r2=0.003, seg=6)
        for i in range(2):                        # 걷는 다리 두 쌍(나머지 두 쌍은 껍데기 속에서 껍데기를 붙든다)
            crableg((s * L * 0.11, -L * 0.14 + i * L * 0.06, L * 0.08), (s * L * 0.3, -L * 0.2 + i * L * 0.12, L * 0.16), (s * L * 0.4, -L * 0.25 + i * L * 0.2, L * 0.06), (s * L * 0.46, -L * 0.29 + i * L * 0.25, 0.004), L * 0.016, col, shade(col, 0.7))


def snail(m, name, k):
    """달팽이: 등에 진 둥근 껍데기에 갈색 띠가 소용돌이로 감겨 있다"""
    L = k.get('len', 0.3)
    body, sh, band = k.get('body', '#e8d8b8'), k.get('shell', '#c9a06a'), k.get('band', '#7a5232')
    T = Top(m, name, L * 0.36, L * 0.62, L * 0.5, px=128, bg=body, z0=0.004)
    T.shell(-L * 0.5, L * 0.42, via([(0, 0.5), (0.2, 0.9), (0.6, 1.0), (1, 0.3)]), via([(0, 0.6), (0.3, 1), (1, 0.4)]), L * 0.2, L * 0.09, body, n=8, seg=6)
    T.speck(shade(body, 0.86), 20, L * 0.006, (-L * 0.07, L * 0.07, -L * 0.42, L * -0.2))
    cx, cy, R = L * 0.02, L * 0.1, L * 0.22
    T.ell((cx, cy), (R, R), sh)
    for i in range(14):                           # 성장선
        a = i * math.tau / 14
        T.line([(cx + math.cos(a) * R * 0.3, cy + math.sin(a) * R * 0.3), (cx + math.cos(a) * R, cy + math.sin(a) * R)], L * 0.006, shade(sh, 0.9))
    pts = []
    for i in range(70):                           # 소용돌이
        f = i / 69
        a = f * math.pi * 5.4 + 0.5
        r = R * (0.9 - 0.8 * f)
        pts.append((cx + R * 0.16 * f + math.cos(a) * r, cy - R * 0.08 * f + math.sin(a) * r))
    T.line(pts, L * 0.04, band)
    T.line(pts, L * 0.012, shade(band, 0.65))
    T.on()
    ball((cx, cy, T.z0 + L * 0.06 + R * 0.7), 1.0, T.mat, (R, R, R * 0.78), sub=3)
    T.off()
    for s in (1, -1):                             # 눈자루와 작은 더듬이
        tube((s * L * 0.035, -L * 0.44, L * 0.07), (s * L * 0.09, -L * 0.58, L * 0.2), L * 0.012, body, r2=L * 0.008, seg=5)
        ball((s * L * 0.09, -L * 0.58, L * 0.2), L * 0.016, '#2a2420', sub=2)
        tube((s * L * 0.03, -L * 0.48, L * 0.04), (s * L * 0.06, -L * 0.57, L * 0.05), L * 0.008, body, seg=4)
    T.finish()


def bagworm(m, name, k):
    """도롱이벌레(주머니나방 애벌레): 잔가지를 붙여 만든 주머니가 실에 매달려 있다. 세로로 선 모양."""
    L = k.get('len', 0.34)
    col = k.get('col', '#8a6a42')
    lathe([(0.012, 0.0), (L * 0.15, L * 0.16), (L * 0.2, L * 0.5), (L * 0.14, L * 0.84), (0.02, L * 1.0)], col, center=(0, 0, 0), seg=10)
    rnd = random.Random(4)
    twig = ['#6a4a2a', '#9a7a4a', '#7a5a34', '#b08a5a']
    for i in range(18):                           # 세로로 붙인 잔가지
        a = i * math.tau / 18 + rnd.uniform(-0.15, 0.15)
        z0 = L * rnd.uniform(0.04, 0.62)
        r = L * 0.2 * math.sin(math.pi * min(1, z0 / L + 0.12)) ** 0.7
        ln = L * rnd.uniform(0.24, 0.4)
        tube((math.cos(a) * r, math.sin(a) * r, z0), (math.cos(a) * (r + L * 0.02), math.sin(a) * (r + L * 0.02), z0 + ln), L * 0.024, twig[i % 4], seg=5)
        cyl((math.cos(a) * (r + L * 0.02), math.sin(a) * (r + L * 0.02), z0 + ln), L * 0.02, 0.004, '#d9b98a', seg=5)
    tube((0, 0, L * 0.98), (0, 0, L * 1.6), 0.004, '#f3f0e6', seg=4)           # 매달린 실
    ball((0, -L * 0.03, L * 0.03), L * 0.05, '#3a2a1e', sub=2)                  # 아래로 빼꼼 내민 머리


BUG_FN = {'snail': snail, 'bagworm': bagworm, 'butterfly': butterfly, 'dragonfly': dragonfly, 'cicada': cicada, 'bee': bee, 'ant': ant, 'beetle': beetle, 'hopper': hopper,
          'mantis': mantis, 'stick': stick, 'shield': shield, 'waterbug': waterbug, 'pill': pill, 'spider': spider, 'hermit': hermit}
