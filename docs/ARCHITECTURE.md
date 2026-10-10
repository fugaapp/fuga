# Architecture

## Three processes, one direction

```
┌─────────────┐   typed IPC (src/shared/ipc.ts)    ┌──────────────────────┐
│ main        │ ◀────────────────────────────────▶ │ renderer (React)     │
│ window,     │        via preload (sandbox)       │ viewport + panels    │
│ menus,      │                                    │        │             │
│ files       │                                    │        ▼             │
└─────────────┘                                    │  core (pure TS)      │
                                                   │  solver + exporters  │
                                                   └──────────────────────┘
```

- **main** (`src/main`): only what needs the operating system — dialogs,
  reading and writing files, the menu. Knows nothing about cameras.
- **preload** (`src/preload`): exposes `window.fuga` with the functions of
  the contract in `src/shared/ipc.ts`. The UI runs with `sandbox: true` and
  `contextIsolation: true`, without Node access.
- **renderer** (`src/renderer`): React for panels, Canvas 2D for the
  viewport. Calls the core directly, because the core is just math.
- **core** (`src/core`): solver, exporters and project format. Imports
  nothing from outside.

## Data flow

```
Project (JSON, immutable)
   │  toSolverInput()
   ▼
SolverInput ──solveCamera()──▶ SolveResult { ok, solution | error }
                                    │
                    ┌───────────────┼────────────────┐
                    ▼               ▼                ▼
                viewport       Camera panel      exporters
```

The document (`Project`) is the single source of truth. Every edit creates a
new object; `History` keeps the previous ones (undo/redo). The solver re-runs
on every change; it takes microseconds.

## Coordinate conventions

| Where | Convention |
| --- | --- |
| Image pixels | origin at the top-left corner, x → right, y → down |
| Inside the solver | centered on the image, long side ∈ [−1, 1] |
| Camera (`CameraSolution`) | computer vision: x right, y down, z forward. `x_cam = R · (X − C)` |
| World | right-handed, **Z-up** (same as Blender) |
| Blender | Z-up world; camera looks down local −Z, +Y up |
| Maya, USD | Y-up world: `(x, y, z)` → `(x, z, −y)`; camera looks down −Z |

Conversion to each application lives in `src/core/export/camera.ts`
(`cameraPlacement`, `lensShift`) and nowhere else.

## The solver in a few lines

1. **Vanishing point** (`vanishing.ts`): each segment becomes a homogeneous
   line `l`. The vanishing point `v` minimizes `Σ wᵢ (lᵢ · v)²` — the
   eigenvector with the smallest eigenvalue of `Σ wᵢ lᵢ lᵢᵀ`. The weights are
   then adjusted so the cost matches click error (see the code comment).
2. **Focal length** (2 VP): for perpendicular directions,
   `(v₁ − p) · (v₂ − p) + f² = 0`, where `p` is the principal point.
3. **Principal point** (3 VP): the orthocenter of the triangle formed by the
   three vanishing points.
4. **Rotation**: each axis' 3D direction is `(v − p, f)` normalized; the third
   axis is the cross product of the other two (right-handed). The matrix is
   then projected onto the nearest rotation (polar decomposition).
5. **Position**: the world origin lies on the ray through the origin's pixel.
   The distance along that ray comes from the reference distance (least
   squares) or a default value.

## Tests

`tests/synthetic.ts` builds known cameras and projects the edges of a box.
`tests/solver.test.ts` checks that the solver recovers them;
`tests/export.test.ts` checks that every exported file, read with the target
application's camera model, reproduces the same pixels.
