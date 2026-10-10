"""Render a synthetic photo with a known camera, for checking Fuga end to end.

Writes samples/synthetic-box.png and samples/synthetic-box.truth.json.
The camera matches tests/solver.test.ts, so the solved numbers should agree
with the JSON to within your clicking accuracy.

    python3 scripts/make_sample.py
"""

import json
import math
from pathlib import Path

from PIL import Image, ImageDraw

W, H, SS = 1920, 1080, 3  # SS: supersampling factor for clean edges
POSITION = (7.0, -9.0, 1.7)
TARGET = (1.5, 1.2, 0.8)
ROLL_DEG = 3.0
FOCAL_PX = 1650.0


def sub(a, b):
    return tuple(x - y for x, y in zip(a, b))


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def norm(a):
    n = math.sqrt(sum(x * x for x in a))
    return tuple(x / n for x in a)


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


# Same construction as tests/synthetic.ts (computer-vision camera: x right, y down, z forward).
f = norm(sub(TARGET, POSITION))
r = norm(cross(f, (0, 0, 1)))
d = cross(f, r)
c, s = math.cos(math.radians(ROLL_DEG)), math.sin(math.radians(ROLL_DEG))
r, d = (
    tuple(c * a + s * b for a, b in zip(r, d)),
    tuple(-s * a + c * b for a, b in zip(r, d)),
)
R = (r, d, f)


def project(p):
    v = sub(p, POSITION)
    x, y, z = (dot(row, v) for row in R)
    return ((W / 2 + FOCAL_PX * x / z) * SS, (H / 2 + FOCAL_PX * y / z) * SS)


img = Image.new("RGB", (W * SS, H * SS), (196, 202, 210))
draw = ImageDraw.Draw(img)

# Sky / wall gradient above the horizon is left flat; floor: 1 m checker tiles.
for i in range(-6, 12):
    for j in range(-6, 12):
        quad = [(i, j, 0), (i + 1, j, 0), (i + 1, j + 1, 0), (i, j + 1, 0)]
        shade = (128, 120, 108) if (i + j) % 2 else (150, 142, 128)
        draw.polygon([project(p) for p in quad], fill=shade)

# A 4 × 3 × 2.5 box with one corner at the world origin.
X, Y, Z = 4.0, 3.0, 2.5
faces = {
    "front (y=0)": ([(0, 0, 0), (X, 0, 0), (X, 0, Z), (0, 0, Z)], (0, -1, 0), (212, 98, 72)),
    "right (x=X)": ([(X, 0, 0), (X, Y, 0), (X, Y, Z), (X, 0, Z)], (1, 0, 0), (168, 74, 56)),
    "top (z=Z)": ([(0, 0, Z), (X, 0, Z), (X, Y, Z), (0, Y, Z)], (0, 0, 1), (232, 150, 120)),
}
for name, (quad, normal, color) in faces.items():
    centre = tuple(sum(p[k] for p in quad) / 4 for k in range(3))
    if dot(normal, sub(POSITION, centre)) > 0:  # facing the camera
        draw.polygon([project(p) for p in quad], fill=color)
        draw.line([project(p) for p in quad + [quad[0]]], fill=(40, 30, 26), width=SS)

out = Path(__file__).resolve().parent.parent / "samples"
out.mkdir(exist_ok=True)
img.resize((W, H), Image.LANCZOS).save(out / "synthetic-box.png")
(out / "synthetic-box.truth.json").write_text(
    json.dumps(
        {
            "comment": "Ground truth. World Z-up; box corner at origin, box spans 4 (x) by 3 (y) by 2.5 (z).",
            "image": [W, H],
            "focalLengthPx": FOCAL_PX,
            "focalLengthMm_fullFrame": FOCAL_PX * 36 / W,
            "cameraPosition": POSITION,
            "worldToCameraRotationOpenCV": R,
            "axesRecedingTowardVanishingPoints": {"box x edges": "-x", "box y edges": "+y"},
        },
        indent=2,
    )
    + "\n"
)


def px(p):
    u, v = project(p)
    return [u / SS, v / SS]


def edge(start, axis, length):
    end = tuple(a + b * length for a, b in zip(start, axis))
    return {"a": px(start), "b": px(end)}


# A ready-made project with the box edges traced exactly: open it in Fuga and
# compare the Camera panel with the truth file.
project_doc = {
    "format": "fuga-project",
    "version": 1,
    "image": {"path": "synthetic-box.png", "width": W, "height": H},
    "mode": "2vp",
    "groups": [
        {"axis": "-x", "lines": [edge((0, 0, 0), (1, 0, 0), X), edge((0, 0, Z), (1, 0, 0), X), edge((0, Y, Z), (1, 0, 0), X)]},
        {"axis": "+y", "lines": [edge((X, 0, 0), (0, 1, 0), Y), edge((X, 0, Z), (0, 1, 0), Y), edge((0, 0, Z), (0, 1, 0), Y)]},
        {"axis": "+z", "lines": [edge((0, 0, 0), (0, 0, 1), Z), edge((X, 0, 0), (0, 0, 1), Z)]},
    ],
    "principalPoint": {"auto": True, "point": [W / 2, H / 2]},
    "lens": {"sensorWidthMm": 36, "focalMm": 35},
    "origin": px((0, 0, 0)),
    "reference": {"enabled": True, "axis": "x", "distance": X, "point": px((X, 0, 0))},
}
(out / "synthetic-box.fuga").write_text(json.dumps(project_doc, indent=2) + "\n")
print(f"wrote {out / 'synthetic-box.png'} and synthetic-box.fuga")
