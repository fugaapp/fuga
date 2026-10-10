import { mulMatVec } from '../math/mat3';
import { sub3, type Vec2, type Vec3 } from '../math/vec';
import type { CameraSolution } from './types';

/** Pixel position of a world point, or null if it is behind the camera. */
export function projectPoint(cam: CameraSolution, world: Vec3): Vec2 | null {
  const c = mulMatVec(cam.rotation, sub3(world, cam.position));
  if (c[2] <= 1e-12) return null;
  return [cam.principalPoint[0] + (cam.focalPx * c[0]) / c[2], cam.principalPoint[1] + (cam.focalPx * c[1]) / c[2]];
}

/** Homogeneous pixel image of a world direction (its vanishing point). w ≤ 0: behind or at infinity. */
export function projectDirection(cam: CameraSolution, dir: Vec3): Vec3 {
  const d = mulMatVec(cam.rotation, dir);
  return [cam.focalPx * d[0] + cam.principalPoint[0] * d[2], cam.focalPx * d[1] + cam.principalPoint[1] * d[2], d[2]];
}

/**
 * Closest point to `p` on the image line through pixel `a` and homogeneous pixel `h`.
 * Used to keep the reference-distance handle on the axis through the origin.
 */
export function closestOnLine(p: Vec2, a: Vec2, h: Vec3): Vec2 {
  // Direction from a toward h works for finite and infinite h alike.
  const dx = h[0] - a[0] * h[2];
  const dy = h[1] - a[1] * h[2];
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-24) return p;
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  return [a[0] + t * dx, a[1] + t * dy];
}

/**
 * Pixel segment for the world segment a→b, clipped against a near plane so
 * grid lines that pass behind the camera still draw correctly. null if fully behind.
 */
export function projectSegment(cam: CameraSolution, a: Vec3, b: Vec3, near = 1e-3): [Vec2, Vec2] | null {
  let ca = mulMatVec(cam.rotation, sub3(a, cam.position));
  let cb = mulMatVec(cam.rotation, sub3(b, cam.position));
  if (ca[2] < near && cb[2] < near) return null;
  const lerp = (p: Vec3, q: Vec3, t: number): Vec3 => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  if (ca[2] < near) ca = lerp(ca, cb, (near - ca[2]) / (cb[2] - ca[2]));
  else if (cb[2] < near) cb = lerp(cb, ca, (near - cb[2]) / (ca[2] - cb[2]));
  const px = (c: Vec3): Vec2 => [cam.principalPoint[0] + (cam.focalPx * c[0]) / c[2], cam.principalPoint[1] + (cam.focalPx * c[1]) / c[2]];
  return [px(ca), px(cb)];
}
