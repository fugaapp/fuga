"""Draw the app icon: edges receding to a vanishing point, in Fuga's palette.

Writes build/icon.png (1024 px); electron-builder derives .ico/.icns from it.

    python3 scripts/make_icon.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

S, SS = 1024, 4  # final size, supersampling
N = S * SS
GRAPHITE = (23, 23, 22, 255)
LINE = (233, 229, 220, 255)
SIGNAL = (245, 197, 24, 255)

img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# macOS-style squircle-ish tile with a small margin.
m = int(N * 0.08)
d.rounded_rectangle([m, m, N - m, N - m], radius=int(N * 0.2), fill=GRAPHITE)

vp = (N * 0.70, N * 0.42)
r = N * 0.045  # diamond half-size
horizon_y = vp[1]
w = int(N * 0.012)
d.line([(m * 1.9, horizon_y), (vp[0] - r * 1.7, horizon_y)], fill=(95, 91, 84, 255), width=w // 2)
d.line([(vp[0] + r * 1.7, horizon_y), (N - m * 1.9, horizon_y)], fill=(95, 91, 84, 255), width=w // 2)
for y in (0.24, 0.52, 0.66, 0.80):
    # Stop short of the diamond so the point itself stays clear.
    sx, sy = N * 0.20, N * y
    dx, dy = vp[0] - sx, vp[1] - sy
    k = 1 - (r * 1.7) / (dx * dx + dy * dy) ** 0.5
    d.line([(sx, sy), (sx + dx * k, sy + dy * k)], fill=LINE, width=w)

d.polygon([(vp[0], vp[1] - r), (vp[0] + r, vp[1]), (vp[0], vp[1] + r), (vp[0] - r, vp[1])], outline=SIGNAL, width=w)

out = Path(__file__).resolve().parent.parent / "build"
out.mkdir(exist_ok=True)
img.resize((S, S), Image.LANCZOS).save(out / "icon.png")
print(f"wrote {out / 'icon.png'}")
