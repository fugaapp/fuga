"""Fuga visual identity — one source of truth for every logo asset.

The mark is a perspective drawing reduced to its rules: four edges recede
toward a single vanishing point (the diamond) sitting on the horizon. One
edge above the horizon, two below (a ceiling and a floor), and all of them
stop short of the point: the eye completes the convergence, exactly what the
app does with your lines.

Generates, into brand/:
  logo/fuga-mark.svg            mark, colour, for dark backgrounds
  logo/fuga-mark-light.svg      mark, colour, for light backgrounds
  logo/fuga-mark-mono.svg       mark, single colour (currentColor)
  logo/fuga-lockup-dark.svg     mark + wordmark, for dark backgrounds
  logo/fuga-lockup-light.svg    mark + wordmark, for light backgrounds
  logo/fuga-wordmark.svg        wordmark only (currentColor)
  logo/fuga-icon.svg            app icon tile
  logo/fuga-favicon.svg         simplified mark for 16–32 px
and build/icon.png (1024 px) for the installers.

Requires: pip install fonttools brotli pillow
    python3 scripts/brand.py
"""

import math
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "brand" / "logo"

# ── Palette ──────────────────────────────────────────────────────────────
GRAPHITE = "#171716"  # dark ground
PAPER = "#F4F2ED"  # light ground
INK_ON_DARK = "#E9E5DC"
INK_ON_LIGHT = "#1C1B19"
MUTED_ON_DARK = "#5F5B54"
MUTED_ON_LIGHT = "#B4AFA4"
SIGNAL = "#F5C518"  # survey-tape yellow, on dark
SIGNAL_DEEP = "#8A6800"  # same hue, 4.6:1 on paper (WCAG AA), for light grounds

# ── Mark geometry (48-unit grid) ─────────────────────────────────────────
GRID = 48
HORIZON = 22.0
VP = (34.0, HORIZON)
START_X = 4.0
EDGES_Y = [8.0, 30.0, 44.0]  # ceiling, floor, floor
STROKE = 2.6
DIAMOND = 4.4  # half-diagonal
DIAMOND_STROKE = 2.2
GAP = 10.0  # edges stop this far from the point
HAIRLINE = 1.0


def _shorten(x0, y0, x1, y1, gap):
    dx, dy = x1 - x0, y1 - y0
    k = 1 - gap / math.hypot(dx, dy)
    return x0, y0, x0 + dx * k, y0 + dy * k


def mark_svg_body(ink, muted, signal, edges=EDGES_Y, horizon=True, ox=0.0, oy=0.0, s=1.0):
    """SVG elements for the mark at offset (ox, oy) and scale s."""
    T = lambda x, y: (ox + x * s, oy + y * s)  # noqa: E731
    parts = []
    if horizon:
        a, b = T(2, HORIZON), T(VP[0] - GAP, HORIZON)
        c, d = T(VP[0] + DIAMOND + 3, HORIZON), T(GRID - 2, HORIZON)
        for p, q in ((a, b), (c, d)):
            parts.append(
                f'<line x1="{p[0]:.2f}" y1="{p[1]:.2f}" x2="{q[0]:.2f}" y2="{q[1]:.2f}" '
                f'stroke="{muted}" stroke-width="{HAIRLINE * s:.2f}" stroke-linecap="round"/>'
            )
    for y in edges:
        x0, y0, x1, y1 = _shorten(START_X, y, VP[0], VP[1], GAP)
        p, q = T(x0, y0), T(x1, y1)
        parts.append(
            f'<line x1="{p[0]:.2f}" y1="{p[1]:.2f}" x2="{q[0]:.2f}" y2="{q[1]:.2f}" '
            f'stroke="{ink}" stroke-width="{STROKE * s:.2f}" stroke-linecap="round"/>'
        )
    cx, cy = T(*VP)
    r = DIAMOND * s
    parts.append(
        f'<path d="M{cx:.2f} {cy - r:.2f}L{cx + r:.2f} {cy:.2f}L{cx:.2f} {cy + r:.2f}L{cx - r:.2f} {cy:.2f}Z" '
        f'fill="none" stroke="{signal}" stroke-width="{DIAMOND_STROKE * s:.2f}" stroke-linejoin="miter"/>'
    )
    return "\n  ".join(parts)


def svg(width, height, body, title):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:g} {height:g}" '
        f'width="{width:g}" height="{height:g}" role="img" aria-label="{title}">\n'
        f"  <title>{title}</title>\n  {body}\n</svg>\n"
    )


# ── Wordmark ─────────────────────────────────────────────────────────────
FONT = ROOT / "node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2"
WORD = "FUGA"
# Visible (ink-to-ink) gaps between letters, in em. Uniform by default; the
# brand guide explains why the converging variant was rejected.
INK_GAPS = [0.2, 0.2, 0.2]


def wordmark_paths(cap_height, gaps=None):
    """Outlined wordmark scaled so capitals are `cap_height` tall. Returns (svg_paths, width).

    Letters are placed by their ink, not their advance width: monospaced
    capitals have very uneven side bearings (F, for one), so equal advances
    look unequal.
    """
    gaps = gaps or INK_GAPS
    font = TTFont(FONT)
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    upm = font["head"].unitsPerEm
    k = cap_height / font["OS/2"].sCapHeight
    paths = []
    pen_x = 0.0  # left edge of the next letter's ink, in font units
    for i, ch in enumerate(WORD):
        g = glyphs[cmap[ord(ch)]]
        bounds = BoundsPen(glyphs)
        g.draw(bounds)
        xmin, _, xmax, _ = bounds.bounds
        pen = SVGPathPen(glyphs)
        # Flip y (font units go up) and put the baseline at cap_height.
        g.draw(TransformPen(pen, (k, 0, 0, -k, (pen_x - xmin) * k, cap_height)))
        paths.append(pen.getCommands())
        pen_x += (xmax - xmin) + (gaps[i] * upm if i < len(gaps) else 0)
    return paths, pen_x * k


def lockup_svg(ink, muted, signal, title):
    cap = 16.0
    paths, word_w = wordmark_paths(cap)
    mark_h = 40.0
    s = mark_h / GRID
    gap = 14.0
    # Align the wordmark's baseline-to-cap band on the mark's horizon.
    horizon_y = HORIZON * s
    word_y = horizon_y - cap / 2 + 0.5
    width = mark_h + gap + word_w
    body = mark_svg_body(ink, muted, signal, s=s)
    word = "".join(f'<path d="{d}"/>' for d in paths)
    body += f'\n  <g fill="{ink}" transform="translate({mark_h + gap:.2f} {word_y:.2f})">{word}</g>'
    return svg(round(width, 2), mark_h, body, title)


def wordmark_svg():
    cap = 32.0
    paths, w = wordmark_paths(cap)
    word = "".join(f'<path d="{d}"/>' for d in paths)
    return svg(round(w, 2), cap, f'<g fill="currentColor">{word}</g>', "Fuga")


# ── App icon ─────────────────────────────────────────────────────────────
TILE_RADIUS = 0.225  # of tile size, close to the macOS squircle
TILE_MARGIN = 0.085  # transparent margin around the tile (macOS icon grid)


def icon_svg():
    size = 1024
    m = size * TILE_MARGIN
    tile = size - 2 * m
    body = (
        f'<rect x="{m:.1f}" y="{m:.1f}" width="{tile:.1f}" height="{tile:.1f}" '
        f'rx="{tile * TILE_RADIUS:.1f}" fill="{GRAPHITE}"/>\n  '
    )
    s = tile * 0.78 / GRID
    ox = m + (tile - GRID * s) / 2
    oy = m + (tile - GRID * s) / 2 + tile * 0.02
    body += mark_svg_body(INK_ON_DARK, MUTED_ON_DARK, SIGNAL, ox=ox, oy=oy, s=s)
    return svg(size, size, body, "Fuga")


def icon_png(path, size=1024, ss=4):
    """Raster twin of icon_svg (Pillow, so the build needs no SVG renderer)."""
    N = size * ss
    img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    m = N * TILE_MARGIN
    tile = N - 2 * m
    d.rounded_rectangle([m, m, N - m, N - m], radius=int(tile * TILE_RADIUS), fill=GRAPHITE)
    s = tile * 0.78 / GRID
    ox = m + (tile - GRID * s) / 2
    oy = m + (tile - GRID * s) / 2 + tile * 0.02
    T = lambda x, y: (ox + x * s, oy + y * s)  # noqa: E731

    def stroke(p, q, color, width):
        d.line([p, q], fill=color, width=round(width))
        for c in (p, q):  # round caps
            d.ellipse([c[0] - width / 2, c[1] - width / 2, c[0] + width / 2, c[1] + width / 2], fill=color)

    stroke(T(2, HORIZON), T(VP[0] - GAP, HORIZON), MUTED_ON_DARK, HAIRLINE * s)
    stroke(T(VP[0] + DIAMOND + 3, HORIZON), T(GRID - 2, HORIZON), MUTED_ON_DARK, HAIRLINE * s)
    for y in EDGES_Y:
        x0, y0, x1, y1 = _shorten(START_X, y, VP[0], VP[1], GAP)
        stroke(T(x0, y0), T(x1, y1), INK_ON_DARK, STROKE * s)
    cx, cy = T(*VP)
    r = DIAMOND * s
    d.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], outline=SIGNAL, width=round(DIAMOND_STROKE * s))
    img.resize((size, size), Image.LANCZOS).save(path)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    files = {
        "fuga-mark.svg": svg(GRID, GRID, mark_svg_body(INK_ON_DARK, MUTED_ON_DARK, SIGNAL), "Fuga"),
        "fuga-mark-light.svg": svg(GRID, GRID, mark_svg_body(INK_ON_LIGHT, MUTED_ON_LIGHT, SIGNAL_DEEP), "Fuga"),
        "fuga-mark-mono.svg": svg(GRID, GRID, mark_svg_body("currentColor", "currentColor", "currentColor"), "Fuga"),
        # Small sizes: no horizon, three edges, thicker relative strokes come from the smaller grid.
        "fuga-favicon.svg": svg(
            GRID, GRID, mark_svg_body(INK_ON_DARK, MUTED_ON_DARK, SIGNAL, horizon=False), "Fuga"
        ),
        "fuga-lockup-dark.svg": lockup_svg(INK_ON_DARK, MUTED_ON_DARK, SIGNAL, "Fuga"),
        "fuga-lockup-light.svg": lockup_svg(INK_ON_LIGHT, MUTED_ON_LIGHT, SIGNAL_DEEP, "Fuga"),
        "fuga-wordmark.svg": wordmark_svg(),
        "fuga-icon.svg": icon_svg(),
    }
    for name, text in files.items():
        (OUT / name).write_text(text)
    (ROOT / "build").mkdir(exist_ok=True)
    icon_png(ROOT / "build" / "icon.png")
    print(f"wrote {len(files)} SVGs to {OUT.relative_to(ROOT)} and build/icon.png")


if __name__ == "__main__":
    main()
