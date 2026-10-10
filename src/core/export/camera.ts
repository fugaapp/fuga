import type { Vec3 } from '../math/vec';
import type { CameraSolution } from '../solver/types';

export type UpAxis = 'z' | 'y';

/**
 * Camera placement in the convention shared by Blender, Maya, USD, Houdini…:
 * the camera looks down its local −Z with +Y up. `x`, `y`, `z` are those local
 * axes expressed in world space.
 *
 * Fuga's world is Z-up. For Y-up targets the world is rotated −90° about X
 * ((x, y, z) → (x, z, −y)), so "up" stays up and the ground plane stays the ground.
 */
export interface CameraPlacement {
  readonly x: Vec3;
  readonly y: Vec3;
  readonly z: Vec3;
  readonly position: Vec3;
}

const toYUp = (v: Vec3): Vec3 => [v[0], v[2], -v[1]];

export function cameraPlacement(cam: CameraSolution, up: UpAxis): CameraPlacement {
  const r = cam.rotation;
  // Rows of the world→camera rotation are the camera axes in world space (CV: x right, y down, z forward).
  const x: Vec3 = r[0];
  const y: Vec3 = [-r[1][0], -r[1][1], -r[1][2]];
  const z: Vec3 = [-r[2][0], -r[2][1], -r[2][2]];
  if (up === 'z') return { x, y, z, position: cam.position };
  return { x: toYUp(x), y: toYUp(y), z: toYUp(z), position: toYUp(cam.position) };
}

/**
 * Lens shift as a fraction of a reference image dimension: positive x moves the
 * frame right, positive y moves it up (Blender shift, Maya film offset and USD
 * aperture offset all share this sign).
 */
export function lensShift(cam: CameraSolution, reference: number): { x: number; y: number } {
  const { width, height } = cam.image;
  return {
    x: -(cam.principalPoint[0] - width / 2) / reference,
    y: (cam.principalPoint[1] - height / 2) / reference,
  };
}

/** Shortest decimal that round-trips to the same double; never prints "-0". */
export const num = (n: number): string => (Object.is(n, -0) || n === 0 ? '0' : String(n));

/**
 * Euler angles (degrees) in XYZ order — Blender's default — for display only.
 * Exporters write full matrices, never these.
 */
export function eulerXYZDeg(p: CameraPlacement): Vec3 {
  const deg = 180 / Math.PI;
  const ry = Math.asin(Math.max(-1, Math.min(1, -p.x[2])));
  if (Math.abs(p.x[2]) < 1 - 1e-12) {
    return [Math.atan2(p.y[2], p.z[2]) * deg, ry * deg, Math.atan2(p.x[1], p.x[0]) * deg];
  }
  // Gimbal lock: fold the whole rotation into X.
  return [Math.atan2(-p.z[1], p.y[1]) * deg, ry * deg, 0];
}
