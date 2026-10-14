#!/usr/bin/env python3
"""
Super Job Agent — brand mark generator.

Draws the app icon vectorially at high resolution and downsamples with LANCZOS
for crisp anti-aliasing, then emits the Chrome icon sizes (16/48/128) plus a
512 store icon. The mark: a rounded gradient tile (indigo -> violet, matching
the in-app brand) carrying a white paper-plane "send / application sent" glyph
with an AI spark. Deterministic, no external assets.

Run:  python packages/extension/scripts/gen-logo.py
"""
from __future__ import annotations
import math
import os
from PIL import Image, ImageDraw, ImageFilter

# ---- brand tokens -----------------------------------------------------------
INDIGO = (99, 102, 241)   # #6366F1  (from-indigo-500)
VIOLET = (124, 58, 237)   # #7C3AED  (to-violet-600)
WHITE = (255, 255, 255)

SS = 8  # supersample factor
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "public", "icon")


def lerp(a: int, b: int, t: float) -> int:
    return round(a + (b - a) * t)


def rounded_mask(size: int, radius: int) -> Image.Image:
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m


def diagonal_gradient(size: int, c0, c1) -> Image.Image:
    """Diagonal (top-left -> bottom-right) gradient tile."""
    grad = Image.new("RGB", (size, size), c0)
    px = grad.load()
    maxd = (size - 1) * 2
    for y in range(size):
        for x in range(size):
            t = (x + y) / maxd
            px[x, y] = (lerp(c0[0], c1[0], t), lerp(c0[1], c1[1], t), lerp(c0[2], c1[2], t))
    return grad


def make_icon(px_size: int) -> Image.Image:
    S = px_size * SS
    radius = round(S * 0.235)  # squircle-ish rounded corner

    # Base gradient tile clipped to a rounded square.
    tile = diagonal_gradient(S, INDIGO, VIOLET).convert("RGBA")
    tile.putalpha(rounded_mask(S, radius))

    # Soft top-left sheen for depth.
    sheen = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sheen)
    sd.ellipse([-S * 0.35, -S * 0.5, S * 0.75, S * 0.55], fill=(255, 255, 255, 40))
    sheen = sheen.filter(ImageFilter.GaussianBlur(S * 0.05))
    sheen.putalpha(Image.composite(sheen.getchannel("A"), Image.new("L", (S, S), 0), rounded_mask(S, radius)))
    tile = Image.alpha_composite(tile, sheen)

    # ---- paper-plane "send / applied" glyph, pointing up-right ----
    # Coordinates in a 0..100 design box, then scaled to the padded content area.
    pad = S * 0.20
    span = S - pad * 2

    def P(x: float, y: float):
        return (pad + x / 100 * span, pad + y / 100 * span)

    glyph = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glyph)

    # Upper wing (full white).
    upper = [P(6, 58), P(94, 8), P(46, 52)]
    gd.polygon(upper, fill=(255, 255, 255, 255))
    # Lower wing / fold (slightly dimmed white for origami depth).
    lower = [P(46, 52), P(94, 8), P(60, 96), P(46, 66)]
    gd.polygon(lower, fill=(236, 238, 255, 255))
    # Center crease shadow to separate the two folds.
    gd.line([P(94, 8), P(46, 66)], fill=(124, 58, 237, 90), width=max(2, round(S * 0.008)))

    tile = Image.alpha_composite(tile, glyph)

    # ---- AI spark (four-point sparkle) top-left of the plane ----
    spark = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    kd = ImageDraw.Draw(spark)
    cx, cy = P(22, 24)
    r1 = span * 0.085   # long points
    r2 = span * 0.03    # waist
    pts = []
    for i in range(8):
        ang = math.pi / 2 * (i // 2) + (math.pi / 4 if i % 2 else 0)
        rr = r1 if i % 2 == 0 else r2
        pts.append((cx + rr * math.cos(ang), cy - rr * math.sin(ang)))
    kd.polygon(pts, fill=(255, 255, 255, 235))
    tile = Image.alpha_composite(tile, spark)

    return tile.resize((px_size, px_size), Image.LANCZOS)


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    for size in (16, 32, 48, 128, 512):
        img = make_icon(size)
        img.save(os.path.join(OUT_DIR, f"{size}.png"))
        print(f"wrote icon/{size}.png")
    # Also drop a large preview next to the script for review.
    make_icon(512).save(os.path.join(os.path.dirname(__file__), "logo-preview.png"))
    print("wrote scripts/logo-preview.png")


if __name__ == "__main__":
    main()
