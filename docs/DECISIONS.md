# Decisions: from fSpy's pain points to Fuga's design

Researched in [fSpy's GitHub issues](https://github.com/stuffmatic/fSpy/issues)
and forums (Blender Artists, McNeel/Rhino). fSpy is great and free, but it is
essentially unmaintained and the same complaints keep coming back.

## What users ask for / complain about

| Pain point (source) | Fuga's answer |
| --- | --- |
| Only two lines per vanishing point: one sloppy click ruins the camera; requests for "more correction lines" and a way to judge vanishing-point quality (#152) | Any number of lines per group, combined by least squares reweighted toward angular error. Per-VP disagreement meter (RMS degrees) and automatic warnings. |
| No undo/redo (#154) | Full history from day one; a whole drag is one undo step. |
| Weak zoom; loupe too shallow and slow; line invisible inside the loupe (#152, #154) | Free zoom around the cursor up to 6400 %, crisp pixels when zoomed in, ×2…×32 loupe that draws the photo **and** the lines. |
| `Shift` gets stuck in precision mode (#141) | Fine mode is read on every mouse move, never stored. |
| Reference distance "jumps back" to 4 (#156) | Numeric fields only apply on confirm (Enter / leaving the field) and never overwrite what you are typing. |
| No overlay opacity slider (#135) | Adjustable overlay opacity and photo dimming. |
| AVIF (#134) | PNG, JPG, WEBP, AVIF, BMP, GIF (whatever Chromium decodes). |
| The Blender add-on breaks with each release (4.0, …) and must be installed; cameras imported upside down (#138, #143, forums) | Exports a **plain Python script** that only uses stable Blender API (lens, sensor, shift, matrix_world), written for Blender 5.1. Nothing to install. A full matrix instead of Euler angles: no rotation-order ambiguity. |
| Only a Blender importer exists; Rhino/Maya/others are left out (forums) | Blender, Maya, **USD** (opens in Houdini, C4D, Unreal, Omniverse, Blender, Maya) and JSON with everything spelled out. |
| "Weird units", sensor size not exposed (forums) | Focal length in mm **and** px, selectable sensor; JSON includes the K matrix and both axis conventions written out. |
| App won't launch on recent macOS / Ubuntu / Windows (#142, #144, #146–149, #153, #155, #159) | Current Electron, CI building and testing on every commit, installers produced by `electron-builder`. |
| Install for all users (#150) | NSIS installer with a choice of folder and per-machine install. |
| Binary project file | `.fuga` is readable, versioned JSON; the photo path may be relative to the project file. |

## Architecture opinions

**Electron rather than Tauri.** Tauri produces much smaller binaries but uses
the system WebView: WebKitGTK on Linux, WebKit on macOS. Canvas rendering and
fonts then vary from system to system, and WebKitGTK has a history of GPU
issues on Linux. For a visual precision tool I want the same engine
(Chromium) everywhere. The cost is download size (~100 MB). Because the core
(`src/core`) does not depend on Electron, moving to Tauri later stays
possible.

**The core is pure, isolated TypeScript.** No DOM, no Node. It runs the same
in the app, in tests and in a future command-line tool. It is the part that
must be right, so it is the most tested.

**One internal convention, converted only on output.** The solver works in the
computer-vision convention (x right, y down, z forward; world Z-up). Each
exporter converts to its target application's convention, and only there.
Half of all "upside-down camera" bugs come from conversions scattered through
a codebase.

**Matrices, not Euler angles, in exports.** Euler angles only appear in the
panel, for reading.

**Normalized coordinates inside the solver.** Pixels are mapped to a centered
frame whose long side spans [−1, 1] before any arithmetic (Hartley
normalization). This avoids losing digits when mixing values in the
thousands with values near 1.

**No dependencies in the math.** 3×3 eigen-decomposition by Jacobi, written by
hand and tested. A linear-algebra library would be bigger than the whole
solver.
