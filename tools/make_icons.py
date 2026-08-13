#!/usr/bin/env python3
"""Generate the app's home-screen icons.

Draws the gate arch mark on an emerald field and writes real PNGs with nothing
but the standard library — the Mac has no Pillow, and adding a dependency for
four images that change roughly never isn't worth it.

Swap this out the moment the church's own logo lands in Drive: export it at
1024px square and resize with `sips -Z <size>` instead.

    python3 tools/make_icons.py
"""

import math
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "docs" / "icons"

TOP = (10, 122, 68)      # emerald, lighter at the top
BOTTOM = (3, 61, 33)     # deep forest at the bottom
INK = (255, 255, 255)
SS = 4                   # supersample factor — 4x4 samples per pixel


def png(path, width, height, pixels):
    """pixels: flat list of (r, g, b) in row-major order."""
    raw = bytearray()
    i = 0
    for _ in range(height):
        raw.append(0)  # filter type 0 (None) for each scanline
        for _ in range(width):
            raw += bytes(pixels[i])
            i += 1

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )


def seg_dist(px, py, ax, ay, bx, by):
    """Distance from a point to a line segment."""
    dx, dy = bx - ax, by - ay
    span = dx * dx + dy * dy
    t = 0.0 if span == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / span))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def mark_distance(x, y, cx, shoulder, base, r):
    """Distance to the arch centreline: two posts, a semicircular top, and the
    centre post — the same shape as the SVG mark in the header."""
    d = min(
        seg_dist(x, y, cx - r, shoulder, cx - r, base),
        seg_dist(x, y, cx + r, shoulder, cx + r, base),
        seg_dist(x, y, cx, shoulder, cx, base),
    )
    if y <= shoulder:  # the arc only spans the upper half
        d = min(d, abs(math.hypot(x - cx, y - shoulder) - r))
    return d


def render(size, inset=1.0):
    """inset < 1 shrinks the mark so a maskable icon survives being cropped."""
    cx = size / 2
    r = 0.235 * size * inset
    shoulder = cx - 0.04 * size * inset
    base = cx + 0.30 * size * inset
    half_stroke = 0.038 * size * inset

    pixels = []
    for py in range(size):
        # Gradient is computed per row, so it costs nothing per sample.
        f = py / max(1, size - 1)
        bg = tuple(round(TOP[i] + (BOTTOM[i] - TOP[i]) * f) for i in range(3))
        for px in range(size):
            hits = 0
            for sy in range(SS):
                for sx in range(SS):
                    x = px + (sx + 0.5) / SS
                    y = py + (sy + 0.5) / SS
                    if mark_distance(x, y, cx, shoulder, base, r) <= half_stroke:
                        hits += 1
            if not hits:
                pixels.append(bg)
            else:
                a = hits / (SS * SS)
                pixels.append(tuple(round(bg[i] + (INK[i] - bg[i]) * a) for i in range(3)))
    return pixels


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    jobs = [
        ("icon-192.png", 192, 1.0),
        ("icon-512.png", 512, 1.0),
        ("apple-touch-icon.png", 180, 1.0),
        # Android may crop a maskable icon to a circle; keep the mark well inside.
        ("maskable-512.png", 512, 0.72),
    ]
    for name, size, inset in jobs:
        png(OUT / name, size, size, render(size, inset))
        print(f"  wrote icons/{name} ({size}×{size})")


if __name__ == "__main__":
    main()
