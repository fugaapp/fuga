# Roadmap

Ordered by how much each item improves precision and trust in the result.

## Next

- [ ] **Visible uncertainty.** Simulate click noise (Monte Carlo over the
      current lines) and show the focal length as `31.2 ± 0.4 mm`. Tells the
      user *when* to add more lines.
- [ ] **EXIF.** Read the photo's 35 mm-equivalent focal length and use it as
      a cross-check ("solver says 28 mm, EXIF says 26 mm") and as the
      starting value in 1-VP mode. Sensor database by camera model.
- [ ] **Edge snapping.** When an endpoint is released, snap it to the
      strongest nearby image edge (sub-pixel gradient). fSpy request #157.
- [ ] **Automatic line detection** (LSD) to suggest line groups.
- [ ] **Warn on close** with unsaved changes; **relink** the photo when its
      path changed.

## Later

- [ ] **Lens distortion.** Brown–Conrady model (k1, k2) estimated from lines
      that should be straight ("plumb-line"). fSpy does not handle strongly
      distorting lenses.
- [ ] Native exporters: Nuke (`.nk`), After Effects (`.jsx`), Cinema 4D,
      Houdini (`.hip` via Python), FBX.
- [ ] Extra guides: cylinder with a selectable axis, more than one guide,
      scalable guides (fSpy #154).
- [ ] Several photos sharing one camera / one space.
- [ ] 360° panoramas (fSpy #139).
- [ ] UI translations (strings are concentrated in the panels).

## To validate in real applications

Exports are tested against the documented camera models and the USD output
against Pixar's library, but each still needs opening in its application:

- [ ] Blender 5.1: run the exported script for `samples/synthetic-box.fuga`.
- [ ] Maya: confirm the `imagePlane` follows the film offset when the
      principal point is off-center (3-VP or manual mode).
- [ ] Houdini / C4D / Unreal: import the `.usda`.
