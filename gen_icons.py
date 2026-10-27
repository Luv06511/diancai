#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成 App 图标（点一次就够了，改设计后重跑）。"""
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'assets', 'icons')
S = 1024


def lerp(a, b, t):
    return int(round(a + (b - a) * t))


def background(size, color_top, color_bottom, radius):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / float(size - 1)
        d.line([(0, y), (size, y)],
               fill=(lerp(color_top[0], color_bottom[0], t),
                     lerp(color_top[1], color_bottom[1], t),
                     lerp(color_top[2], color_bottom[2], t), 255))
    if radius:
        mask = Image.new('L', (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
        img.putalpha(mask)
    return img


def draw_mark(draw, cx, cy, scale=1.0, ink=(255, 249, 241, 255), steam=(255, 249, 241, 200)):
    """一只碗 + 三缕热气。cx/cy 是碗口中心，scale 缩放。"""
    import math

    r = 300 * scale
    # 碗身（半圆，从碗口往下）
    draw.pieslice([cx - r, cy - r, cx + r, cy + r], 0, 180, fill=ink)
    # 碗口
    draw.rounded_rectangle([cx - 340 * scale, cy - 26 * scale, cx + 340 * scale, cy + 34 * scale],
                           radius=30 * scale, fill=ink)
    # 热气（三条上升的 S 形）
    w = max(6, int(17 * scale))
    for i, dx in enumerate((-118, 0, 118)):
        x0 = cx + dx * scale
        h = (150 + (26 if i != 1 else 0)) * scale
        amp = 15 * scale
        pts = []
        for k in range(26):
            t = k / 25.0
            pts.append((x0 + amp * math.sin(t * 3.9 + i * 1.1), cy - 64 * scale - h * t))
        draw.line(pts, fill=steam, width=w, joint='curve')
        for p in (pts[0], pts[-1]):
            draw.ellipse([p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2], fill=steam)


def build(size, radius_ratio, mark_scale, path, bg=True):
    big = S
    img = background(big, (219, 79, 50), (186, 52, 34), int(big * radius_ratio)) if bg else None
    if img is None:
        img = Image.new('RGBA', (big, big), (214, 75, 47, 255))
    d = ImageDraw.Draw(img)
    draw_mark(d, big * 0.5, big * 0.5, mark_scale)
    img = img.resize((size, size), Image.LANCZOS)
    img.save(path)
    print('  ->', os.path.basename(path), size)


def main():
    os.makedirs(OUT, exist_ok=True)
    # 普通图标：圆角、留白
    build(512, 0.23, 0.62, os.path.join(OUT, 'icon-512.png'))
    build(192, 0.23, 0.62, os.path.join(OUT, 'icon-192.png'))
    build(180, 0.23, 0.62, os.path.join(OUT, 'apple-touch-icon.png'))
    # maskable：满底、内容缩进安全区
    build(512, 0.0, 0.46, os.path.join(OUT, 'icon-maskable-512.png'))
    # App 内的小 favicon
    build(64, 0.23, 0.62, os.path.join(OUT, 'favicon.png'))


if __name__ == '__main__':
    main()
