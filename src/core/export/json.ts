import type { CameraSolution } from '../solver/types';
import { cameraPlacement } from './camera';
import type { ExportOptions } from './options';

/**
 * Everything, unopinionated, for custom pipelines (Nuke, Unreal, Houdini
 * Python, photogrammetry tools). Both conventions are spelled out so nobody
 * has to guess which one a matrix is in.
 */
export function exportJson(cam: CameraSolution, opts: ExportOptions): string {
  const { width, height } = cam.image;
  const longest = Math.max(width, height);
  const [cx, cy] = cam.principalPoint;
  const placement = (up: 'z' | 'y') => {
    const { x, y, z, position } = cameraPlacement(cam, up);
    return {
      // Column-vector convention: world = M · local. Row-major nested arrays.
      matrix: [
        [x[0], y[0], z[0], position[0]],
        [x[1], y[1], z[1], position[1]],
        [x[2], y[2], z[2], position[2]],
        [0, 0, 0, 1],
      ],
    };
  };
  const doc = {
    format: 'fuga-camera',
    version: 1,
    name: opts.name,
    image: { width, height, path: opts.imagePath },
    intrinsics: {
      focalLengthPx: cam.focalPx,
      principalPointPx: [cx, cy],
      K: [
        [cam.focalPx, 0, cx],
        [0, cam.focalPx, cy],
        [0, 0, 1],
      ],
      fovDeg: cam.fovDeg,
      sensorWidthMm: opts.sensorWidthMm,
      sensorAppliesTo: width >= height ? 'width' : 'height',
      focalLengthMm: (cam.focalPx * opts.sensorWidthMm) / longest,
    },
    extrinsics: {
      openCv: {
        comment: 'x_cam = R · (X_world − C); camera x right, y down, z forward; world Z-up',
        R: cam.rotation,
        C: cam.position,
      },
      cameraToWorldZUp: { comment: 'camera looks −Z, +Y up (Blender)', ...placement('z') },
      cameraToWorldYUp: { comment: 'camera looks −Z, +Y up (Maya, USD, Houdini)', ...placement('y') },
    },
    quality: {
      vanishingPointRmsDeg: cam.vanishingPoints.map((v) => v.rmsDeg),
      warnings: cam.warnings,
    },
  };
  return JSON.stringify(doc, null, 2) + '\n';
}
