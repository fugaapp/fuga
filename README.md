<picture>
  <source media="(prefers-color-scheme: dark)" srcset="brand/logo/fuga-lockup-dark.svg">
  <img src="brand/logo/fuga-lockup-light.svg" alt="Fuga" height="56">
</picture>

Camera calibration from a single photo, using vanishing points. You trace
parallel edges in the photo; Fuga solves the focal length, rotation and
position of the camera and exports a ready-to-use camera for **Blender**,
**Maya**, **USD** (Houdini, Cinema 4D, Unreal, Omniverse…) or **JSON**.

Inspired by [fSpy](https://github.com/stuffmatic/fSpy), written from scratch
to fix the most common complaints of its users — see
[docs/DECISIONS.md](docs/DECISIONS.md).

> The name comes from *ponto de fuga*, Portuguese for vanishing point.

## Download

Installers for Windows, macOS and Linux are on the
[Releases page](https://github.com/gln11/gln/releases). The app tells you
when a new version is out. Unsigned builds show a one-time warning on first
launch — see [docs/RELEASING.md](docs/RELEASING.md#unsigned-installers-what-users-see).

## Running from source

Requires Node 22.12 or newer.

```bash
npm install        # install dependencies (also downloads Electron)
npm run dev        # open the app with hot reload
npm test           # precision tests for the solver and exporters
npm run typecheck  # type-check the whole project
npm run dist       # build an installer for your OS (into release/)
```

Publishing a new version: [docs/RELEASING.md](docs/RELEASING.md).

To try it without a photo of your own: `npm run sample` renders
`samples/synthetic-box.png` (a box photographed by a **known** camera) and
`samples/synthetic-box.fuga` (a project with the edges already traced).
Open the `.fuga` via *File → Open Project* and compare the *Camera* panel
with `samples/synthetic-box.truth.json`: focal length 1650 px, position
(7, −9, 1.7).

## Usage

1. **Open a photo** — drop it on the window or press `Ctrl/⌘ O`.
2. **Pick a method** — 2 VP fits most architecture and interior shots. 3 VP
   when verticals converge too (shot looking up or down). 1 VP when only one
   direction converges and you know the focal length.
3. **Trace lines** — drag the endpoints onto real parallel edges. The axis
   chosen for each group is the one **receding from the camera**, toward the
   vanishing point. Use `+ line` to add more lines: every extra line reduces
   the error.
4. **Origin and scale** — drag the ◯ to the point that should be (0, 0, 0).
   Enable *Reference distance* and drag the ◇ to a point at a known distance
   along an axis (e.g. a 2.1 m door).
5. **Check** — the ground grid and horizon must sit on the photo. Each
   vanishing point's meter shows how much its lines disagree (in degrees):
   close to 0 is good.
6. **Export** — one click. Blender: *Text Editor → Open → Run Script*.
   Maya: *Script Editor → Python → Execute*.

| Shortcut | Action |
| --- | --- |
| mouse wheel / pinch | zoom around the cursor |
| drag on empty space | pan |
| `Shift` + drag | fine movement (10×) |
| arrows / `Shift` + arrows | nudge the selected point 1 / 0.1 screen px |
| `[` `]` | loupe zoom (×2 … ×32) |
| `Delete` | delete the selected line |
| `F`, `Ctrl/⌘ 0`, `Ctrl/⌘ 1` | fit photo, fit, actual pixels |
| `Ctrl/⌘ Z`, `Ctrl/⌘ Shift Z` | undo / redo |
| `Ctrl/⌘ ,` | appearance: light / dark / system theme, accent and axis colours |

## Layout

```
src/
  core/        Pure TypeScript math — no DOM, no Node, no Electron.
    math/        vectors, 3×3 matrices, eigen-decomposition
    solver/      vanishing points, 1/2/3-VP solver, projection
    export/      Blender, Maya, USD, JSON
    project/     the .fuga file format
  main/        Electron main process: window, menus, files
  preload/     Secure bridge between Electron and the UI
  shared/      IPC contract (types shared by main and UI)
  renderer/    React UI
    src/viewport/  canvas: drawing, dragging, zoom, loupe
    src/panels/    side panel
    src/state/     document + undo history
tests/         Core tests against synthetic cameras (ground truth)
scripts/       Sample image and brand asset generators
brand/         Visual identity: logos, fonts, brand guide
build/         App icon (generated; used by the installers)
docs/          Decisions, architecture, roadmap
```

More in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). What comes next is in
[docs/ROADMAP.md](docs/ROADMAP.md).

## Precision, and how it is checked

- Each test builds a **known** camera, projects the edges of a box, hands
  the pixels to the solver and compares: focal length, rotation and position
  come back with errors around 10⁻⁹.
- Exporters are round-trip tested: the exported file is parsed, the
  Blender/Maya/USD camera model is rebuilt from it, and every 3D point must
  land on the same pixel.
- An exported `.usda` was also opened with Pixar's own library (`usd-core`):
  the box corners land within 0.000001 px of the right pixels.
- Noise test: with imprecise clicks (σ = 0.7 px), 10 lines per vanishing
  point give a clearly smaller focal-length error than 2 lines.

## License

Copyright © 2026 Gelain.

Fuga is free software: you can redistribute it and/or modify it under the
terms of the [GNU General Public License](LICENSE) as published by the Free
Software Foundation, either version 3 of the License, or (at your option)
any later version. It is distributed in the hope that it will be useful, but
WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
FITNESS FOR A PARTICULAR PURPOSE.

In short: use it for anything, including commercial work. If you distribute
a modified version, share its source under the same license.
