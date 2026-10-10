import type { CameraSolution } from '../solver/types';
import { cameraPlacement, lensShift, num } from './camera';
import type { ExportOptions } from './options';

/**
 * ASCII USD. One file that Houdini, Blender, Maya (mayaUSD), Cinema 4D,
 * Unreal and Omniverse all open — the most portable target we have.
 * Written Y-up because that is what most USD consumers expect.
 */
export function exportUsd(cam: CameraSolution, opts: ExportOptions): string {
  const { width, height } = cam.image;
  const longest = Math.max(width, height);
  const shift = lensShift(cam, longest);
  const { x, y, z, position: p } = cameraPlacement(cam, 'y');
  const row = (v: readonly number[], w: number) => `(${[...v, w].map(num).join(', ')})`;
  const primName = opts.name.replace(/[^A-Za-z0-9_]/g, '_').replace(/^(\d)/, '_$1') || 'Camera';

  // Apertures and focal length share one unit (mm), so the field of view is exact
  // whatever "tenths of a scene unit" convention the consumer applies.
  return `#usda 1.0
(
    defaultPrim = "${primName}"
    doc = "Camera exported by Fuga (${width}x${height})"
    metersPerUnit = 1
    upAxis = "Y"
)

def Camera "${primName}"
{
    float focalLength = ${num((cam.focalPx * opts.sensorWidthMm) / longest)}
    float horizontalAperture = ${num((opts.sensorWidthMm * width) / longest)}
    float verticalAperture = ${num((opts.sensorWidthMm * height) / longest)}
    float horizontalApertureOffset = ${num(shift.x * opts.sensorWidthMm)}
    float verticalApertureOffset = ${num(shift.y * opts.sensorWidthMm)}
    token projection = "perspective"
    float2 clippingRange = (0.01, 100000)
    matrix4d xformOp:transform = ( ${row(x, 0)}, ${row(y, 0)}, ${row(z, 0)}, ${row(p, 1)} )
    uniform token[] xformOpOrder = ["xformOp:transform"]
}
`;
}
