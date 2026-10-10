import type { CameraSolution } from '../solver/types';
import { cameraPlacement, lensShift, num } from './camera';
import type { ExportOptions } from './options';

const MM_PER_INCH = 25.4;

/**
 * Python for Maya's Script Editor (maya.cmds only — works from Maya 2022 on).
 * Maya is Y-up and its film back is in inches. The transform is written as a
 * full world matrix, so rotation order never matters.
 */
export function exportMaya(cam: CameraSolution, opts: ExportOptions): string {
  const { width, height } = cam.image;
  const longest = Math.max(width, height);
  const sensorIn = opts.sensorWidthMm / MM_PER_INCH;
  const focalMm = (cam.focalPx * opts.sensorWidthMm) / longest;
  const shift = lensShift(cam, longest);
  const { x, y, z, position: p } = cameraPlacement(cam, 'y');
  const matrix = [...x, 0, ...y, 0, ...z, 0, ...p, 1].map(num).join(', ');

  return `# Camera exported by Fuga — paste into Maya's Script Editor (Python tab) and run.
import os

import maya.cmds as cmds

NAME = ${JSON.stringify(opts.name)}
IMAGE_PATH = ${opts.imagePath ? JSON.stringify(opts.imagePath) : 'None'}

transform, shape = cmds.camera(name=NAME)
cmds.setAttr(shape + ".focalLength", ${num(focalMm)})
cmds.setAttr(shape + ".horizontalFilmAperture", ${num((sensorIn * width) / longest)})
cmds.setAttr(shape + ".verticalFilmAperture", ${num((sensorIn * height) / longest)})
cmds.setAttr(shape + ".horizontalFilmOffset", ${num(shift.x * sensorIn)})
cmds.setAttr(shape + ".verticalFilmOffset", ${num(shift.y * sensorIn)})
cmds.setAttr(shape + ".filmFit", ${width >= height ? 1 : 2})  # 1 horizontal, 2 vertical

# Row-vector world matrix: camera X, Y, Z axes, then position.
cmds.xform(transform, worldSpace=True, matrix=[${matrix}])

cmds.setAttr("defaultResolution.width", ${width})
cmds.setAttr("defaultResolution.height", ${height})
cmds.setAttr("defaultResolution.deviceAspectRatio", ${num(width / height)})
cmds.setAttr("defaultResolution.pixelAspect", 1)

if IMAGE_PATH and os.path.exists(IMAGE_PATH):
    cmds.imagePlane(camera=shape, fileName=IMAGE_PATH)
elif IMAGE_PATH:
    print("Fuga: background image not found: " + IMAGE_PATH)

print("Fuga: created camera " + transform)
`;
}
