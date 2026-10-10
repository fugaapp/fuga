// Ground-truth scenes: a known camera photographs a box, we project its edges
// to pixels, hand those to the solver and check what comes back.
import {
  cross3,
  normalize3,
  projectPoint,
  type CameraSolution,
  type Mat3,
  type Segment,
  type Vec2,
  type Vec3,
} from '../src/core';

export interface TrueCamera {
  readonly cam: CameraSolution;
}

export function lookAt(opts: {
  position: Vec3;
  target: Vec3;
  rollDeg?: number;
  focalPx: number;
  principalPoint?: Vec2;
  width?: number;
  height?: number;
}): CameraSolution {
  const width = opts.width ?? 1920;
  const height = opts.height ?? 1080;
  const f = normalize3([
    opts.target[0] - opts.position[0],
    opts.target[1] - opts.position[1],
    opts.target[2] - opts.position[2],
  ]);
  let r = normalize3(cross3(f, [0, 0, 1]));
  let d = cross3(f, r);
  const roll = ((opts.rollDeg ?? 0) * Math.PI) / 180;
  if (roll) {
    const c = Math.cos(roll), s = Math.sin(roll);
    [r, d] = [
      [c * r[0] + s * d[0], c * r[1] + s * d[1], c * r[2] + s * d[2]],
      [-s * r[0] + c * d[0], -s * r[1] + c * d[1], -s * r[2] + c * d[2]],
    ];
  }
  const rotation: Mat3 = [r, d, f];
  return {
    image: { width, height },
    focalPx: opts.focalPx,
    principalPoint: opts.principalPoint ?? [width / 2, height / 2],
    rotation,
    position: opts.position,
    vanishingPoints: [],
    fovDeg: { horizontal: 0, vertical: 0 },
    warnings: [],
  };
}

/** Image segments of world lines through `starts`, each running `length` along `axis`. */
export function edges(cam: CameraSolution, starts: Vec3[], axis: Vec3, length: number): Segment[] {
  return starts.map((s) => {
    const a = projectPoint(cam, s);
    const b = projectPoint(cam, [s[0] + axis[0] * length, s[1] + axis[1] * length, s[2] + axis[2] * length]);
    if (!a || !b) throw new Error('Test edge behind camera');
    return { a, b };
  });
}

/** Deterministic PRNG (mulberry32) + Box–Muller, so noise tests never flake. */
export function gaussian(seed: number): () => number {
  let t = seed >>> 0;
  const uniform = () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  return () => Math.sqrt(-2 * Math.log(uniform() || 1e-12)) * Math.cos(2 * Math.PI * uniform());
}

export const maxAbsDiff = (a: readonly (readonly number[])[], b: readonly (readonly number[])[]) =>
  Math.max(...a.flatMap((row, i) => row.map((v, j) => Math.abs(v - b[i][j]))));
