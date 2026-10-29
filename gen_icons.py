#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成可爱风的 App 图标：粉底 + 白碗 + 三颗小爱心。"""
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'assets', 'icons')
S = 1024


def lerp(a, b, t):
    return int(round(a + (b - a) * t))


def background(size, top, bottom, radius):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / float(size - 1)
        d.line([(0, y), (size, y)],
               fill=(lerp(top[0], bottom[0], t),
                     lerp(top[1], bottom[1], t),
                     lerp(top[2], bottom[2], t), 255))
    if radius:
        mask = Image.new('L', (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
        img.putalpha(mask)
    return img


def heart(draw, cx, cy, s, color):
    r = s * 0.30
    draw.ellipse([cx - r * 1.62, cy - r * 1.55, cx + r * 0.38, cy + r * 0.45], fill=color)
    draw.ellipse([cx - r * 0.38, cy - r * 1.55, cx + r * 1.62, cy + r * 0.45], fill=color)
    draw.polygon([(cx - r * 1.60, cy - r * 0.05),
                  (cx + r * 1.60, cy - r * 0.05),
                  (cx, cy + r * 1.85)], fill=color)


def draw_mark(draw, cx, cy, scale=1.0, ink=(255, 255, 255, 255), love=(255, 236, 242, 235)):
    r = 300 * scale
    # 碗身
    draw.pieslice([cx - r, cy - r, cx + r, cy + r], 0, 180, fill=ink)
    # 碗口
    draw.rounded_rectangle([cx - 340 * scale, cy - 26 * scale, cx + 340 * scale, cy + 34 * scale],
                           radius=30 * scale, fill=ink)
    # 三颗小爱心
    for i, dx in enumerate((-120, 0, 120)):
        size = (98 if i == 1 else 78) * scale
        heart(draw, cx + dx * scale, cy - 168 * scale - (16 if i == 1 else 0) * scale, size, love)


def build(size, radius_ratio, mark_scale, path):
    big = S
    img = background(big, (255, 173, 197), (255, 111, 152), int(big * radius_ratio))
    draw_mark(ImageDraw.Draw(img), big * 0.5, big * 0.45, mark_scale)
    img = img.resize((size, size), Image.LANCZOS)
    img.save(path)
    print('  ->', os.path.basename(path), size)


def main():
    os.makedirs(OUT, exist_ok=True)
    build(512, 0.23, 0.72, os.path.join(OUT, 'icon-512.png'))
    build(192, 0.23, 0.72, os.path.join(OUT, 'icon-192.png'))
    build(180, 0.23, 0.72, os.path.join(OUT, 'apple-touch-icon.png'))
    build(512, 0.0, 0.50, os.path.join(OUT, 'icon-maskable-512.png'))
    build(64, 0.23, 0.72, os.path.join(OUT, 'favicon.png'))


if __name__ == '__main__':
    main()
