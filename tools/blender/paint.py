"""생물의 겉모습을 '그림'으로 그려 모델에 입히기 위한 도구.

물고기는 옆모습, 곤충은 위에서 본 모습을 종마다 한 장씩 그린다(Pillow).
그림은 모델과 같은 좌표로 그려지므로, 모델의 꼭짓점 위치가 곧 그림 위의 위치다(평면 투영).
"""
import math
import os
import random
import numpy as np
import bpy
from PIL import Image, ImageDraw, ImageFilter, ImageChops

SS = 3                       # 곱게 그리기 위해 크게 그렸다가 줄인다
TEX_DIR = '/tmp/dotori_tex'


def rgb(c):
    """'#rrggbb' → (r, g, b)"""
    if isinstance(c, (tuple, list)):
        return tuple(int(v) for v in c[:3])
    c = c.lstrip('#')
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def mix(a, b, t):
    a, b = rgb(a), rgb(b)
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def shade(c, k):
    """k>1 밝게, k<1 어둡게"""
    c = rgb(c)
    if k >= 1:
        return tuple(int(min(255, v + (255 - v) * (k - 1))) for v in c)
    return tuple(int(v * k) for v in c)


class Canvas:
    """모델 좌표(가로 h, 세로 v) 직사각형을 그림 한 장에 대응시킨다.
    alpha=True면 투명도가 있는 그림(RGBA). 이때 바탕은 완전히 투명하고, 그릴 때 a(0~255)로 비치는 정도를 준다."""

    def __init__(self, h0, h1, v0, v1, px=256, bg='#808080', alpha=False):
        self.h0, self.h1, self.v0, self.v1 = h0, h1, v0, v1
        self.w = px
        self.h = max(16, int(round(px * (v1 - v0) / (h1 - h0) / 4)) * 4)
        self.W, self.H = self.w * SS, self.h * SS
        self.alpha = alpha
        self.img = Image.new('RGBA' if alpha else 'RGB', (self.W, self.H), rgb(bg) + ((0,) if alpha else ()))
        self.d = ImageDraw.Draw(self.img)
        self.sx = self.W / (h1 - h0)
        self.sy = self.H / (v1 - v0)

    # --- 좌표
    def X(self, h):
        return (h - self.h0) * self.sx

    def Y(self, v):
        return (self.v1 - v) * self.sy            # 그림은 위가 0

    def P(self, pts):
        return [(self.X(a), self.Y(b)) for a, b in pts]

    def uv(self, h, v):
        """모델 좌표 → 텍스처 좌표(0~1, 아래가 0)"""
        return ((h - self.h0) / (self.h1 - self.h0), (v - self.v0) / (self.v1 - self.v0))

    def px(self, length):
        return length * self.sx

    def c(self, col, a=255):
        return rgb(col) + ((a,) if self.alpha else ())

    # --- 그리기 (d를 주면 마스크 등 다른 그림판에 그린다. 이때 col은 0~255 값)
    def poly(self, pts, col, d=None, a=255):
        (d or self.d).polygon(self.P(pts), fill=self.c(col, a) if d is None else col)

    def ellipse(self, c, r, col, d=None, a=255):
        x, y = self.X(c[0]), self.Y(c[1])
        rx, ry = r[0] * self.sx, r[1] * self.sy
        (d or self.d).ellipse([x - rx, y - ry, x + rx, y + ry], fill=self.c(col, a) if d is None else col)

    def line(self, pts, w, col, d=None, a=255):
        (d or self.d).line(self.P(pts), fill=self.c(col, a) if d is None else col, width=max(1, int(round(w * self.sx))), joint='curve')

    def mask(self):
        return Image.new('L', (self.W, self.H), 0)

    def layer(self, col, a=255):
        return Image.new(self.img.mode, (self.W, self.H), self.c(col, a))

    def paste(self, layer, mask):
        """layer를 mask(L)가 흰 곳에만 입힌다"""
        self.img.paste(layer, (0, 0), mask)
        self.d = ImageDraw.Draw(self.img)

    def fill_mask(self, col, mask, alpha=1.0, a=255):
        if alpha < 1:
            mask = mask.point(lambda v: int(v * alpha))
        self.paste(self.layer(col, a), mask)

    def blur(self, mask, r):
        return mask.filter(ImageFilter.GaussianBlur(r * self.sx))

    def mirror(self):
        """오른쪽 절반(h>0)을 뒤집어 왼쪽에 그대로 옮긴다(좌우 대칭인 생물용). 그림판 가운데가 h=0이어야 한다."""
        half = self.img.crop((self.W // 2, 0, self.W, self.H)).transpose(Image.FLIP_LEFT_RIGHT)
        self.img.paste(half, (0, 0))
        self.d = ImageDraw.Draw(self.img)

    def noise_mask(self, scale, thresh, seed=1, soft=0.02, stretch=(1, 1)):
        """얼룩무늬용: 뭉게뭉게한 잡음에서 thresh보다 큰 곳이 흰 마스크"""
        rnd = np.random.RandomState(seed)
        gw = max(2, int((self.h1 - self.h0) / (scale * stretch[0])))
        gh = max(2, int((self.v1 - self.v0) / (scale * stretch[1])))
        small = (rnd.rand(gh + 2, gw + 2) * 255).astype(np.uint8)
        im = Image.fromarray(small, 'L').resize((self.W, self.H), Image.BICUBIC)
        a = np.asarray(im).astype(np.float32) / 255.0
        lo, hi = thresh - soft * 5, thresh + soft * 5
        m = np.clip((a - lo) / max(1e-4, hi - lo), 0, 1)
        return Image.fromarray((m * 255).astype(np.uint8), 'L')

    def finish(self):
        return self.img.resize((self.w, self.h), Image.LANCZOS)


def smooth(pts, n=6, closed=False):
    """점들을 부드러운 곡선(캐트멀-롬)으로 잇는다"""
    out = []
    m = len(pts)
    for i in range(m if closed else m - 1):
        p0 = pts[(i - 1) % m] if (closed or i > 0) else pts[i]
        p1, p2 = pts[i], pts[(i + 1) % m]
        p3 = pts[(i + 2) % m] if (closed or i + 2 < m) else pts[(i + 1) % m]
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in (0, 1)))
    if not closed:
        out.append(tuple(pts[-1]))
    return out


# ----------------------------------------------------------------- 블렌더 재질
def tex_material(name, image=None, alpha=False):
    """그림을 입힌 재질을 만든다. 재질 이름이 곧 게임에서의 이름.
    image를 나중에 줄 수도 있다(tex_image). alpha=True면 그림의 투명도를 살린다(잠자리 날개 등)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value = 0.9
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.name = 'tex'
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    if alpha:
        nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
        for attr, val in (('blend_method', 'BLEND'), ('surface_render_method', 'BLENDED')):
            try:
                setattr(m, attr, val)
            except Exception:
                pass
    if image is not None:
        tex_image(m, image)
    return m


def tex_image(mat, image, fname=None):
    """재질에 그림(PIL Image)을 넣는다."""
    os.makedirs(TEX_DIR, exist_ok=True)
    path = os.path.join(TEX_DIR, (fname or mat.name) + '.png')
    image.save(path)
    img = bpy.data.images.load(path)
    img.pack()
    mat.node_tree.nodes['tex'].image = img
    return img
