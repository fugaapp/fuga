import type { CameraSolution } from '../solver/types';
import { cameraPlacement, lensShift, num } from './camera';
import type { ExportOptions } from './options';

/**
 * A plain Python script, run from Blender's Text Editor (Alt+P) or with
 * `blender --python file.py`.
 *
 * fSpy ships a Blender add-on that has to be reinstalled and has broken on
 * several Blender releases. A script that only touches long-stable API
 * (cameras, matrix_world, background_images) needs no installation and has
 * nothing to break. Tested against Blender 5.1 (Python 3.13).
 */
export function exportBlender(cam: CameraSolution, opts: ExportOptions): string {
  const { width, height } = cam.image;
  const longest = Math.max(width, height);
  // sensor_fit AUTO maps sensor_width onto the longest image side.
  const lens = (cam.focalPx * opts.sensorWidthMm) / longest;
  const shift = lensShift(cam, longest);
  const { x, y, z, position: p } = cameraPlacement(cam, 'z');
  const row = (i: 0 | 1 | 2) => `(${num(x[i])}, ${num(y[i])}, ${num(z[i])}, ${num(p[i])})`;

  return `# Camera exported by Fuga — run in Blender's Text Editor (Alt+P).
import os

import bpy
from mathutils import Matrix

NAME = ${JSON.stringify(opts.name)}
IMAGE_PATH = ${opts.imagePath ? JSON.stringify(opts.imagePath) : 'None'}

scene = bpy.context.scene
scene.render.resolution_x = ${width}
scene.render.resolution_y = ${height}
scene.render.resolution_percentage = 100
scene.render.pixel_aspect_x = 1.0
scene.render.pixel_aspect_y = 1.0

data = bpy.data.cameras.new(NAME)
data.sensor_fit = "AUTO"
data.sensor_width = ${num(opts.sensorWidthMm)}
data.lens = ${num(lens)}
data.shift_x = ${num(shift.x)}
data.shift_y = ${num(shift.y)}

camera = bpy.data.objects.new(NAME, data)
scene.collection.objects.link(camera)
# Set the full matrix instead of Euler angles: no rotation-order ambiguity.
camera.matrix_world = Matrix((
    ${row(0)},
    ${row(1)},
    ${row(2)},
    (0.0, 0.0, 0.0, 1.0),
))
scene.camera = camera

if IMAGE_PATH and os.path.exists(IMAGE_PATH):
    image = bpy.data.images.load(IMAGE_PATH, check_existing=True)
    data.show_background_images = True
    background = data.background_images.new()
    background.image = image
    background.frame_method = "STRETCH"
    background.alpha = 1.0
elif IMAGE_PATH:
    print(f"Fuga: background image not found: {IMAGE_PATH}")

print(f"Fuga: created camera '{camera.name}'")
`;
}
