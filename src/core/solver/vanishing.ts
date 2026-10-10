import { symmetricEigen3, type Mat3 } from '../math/mat3';
import { cross3, type Vec2, type Vec3 } from '../math/vec';
import { toNormalized, toPixels, type ImageSize } from './frame';

export interface Segment {
  readonly a: Vec2;
  readonly b: Vec2;
}

export interface VanishingPoint {
  /** Unit homogeneous point in the normalized frame. w ≈ 0 means "at infinity". */
  readonly homogeneous: Vec3;
  /** Pixel position, or null when the lines are parallel in the image. */
  readonly pixel: Vec2 | null;
  /** Per segment: angle (deg) between the segment and the ray from its midpoint to the VP. */
  readonly residualsDeg: readonly number[];
  readonly rmsDeg: number;
}

/** Homogeneous line through two normalized points, scaled so l·(x, y, 1) is a signed distance. */
export function lineThrough(a: Vec2, b: Vec2): Vec3 {
  const l = cross3([a[0], a[1], 1], [b[0], b[1], 1]);
  const n = Math.hypot(l[0], l[1]);
  return [l[0] / n, l[1] / n, l[2] / n];
}

/**
 * Least-squares vanishing point of any number (>= 2) of segments.
 *
 * fSpy intersects exactly two lines per axis, so one sloppy endpoint moves
 * the whole camera. Here every segment votes.
 *
 * Step 1 — algebraic fit: minimise Σ wᵢ (lᵢ·v)² over unit vectors v, i.e.
 * the eigenvector of Σ wᵢ lᵢ lᵢᵀ with the smallest eigenvalue.
 *
 * Step 2 — reweighting toward the statistically right cost. A click error
 * tilts a segment by an angle ~σ/L, and that tilt moves its line at the VP
 * by ~D·σ/L (D = distance from the segment to the VP). So the distance
 * lᵢ·v is noisier for short segments far from the VP; weighting by
 * L² / (D² + L²/4) turns the sum into Σ L² sin²θᵢ — the click-error cost
 * — and stays well defined when the VP is at infinity.
 *
 * With exactly two segments both steps reduce to their plain intersection.
 */
export function estimateVanishingPoint(segments: readonly Segment[], size: ImageSize): VanishingPoint {
  if (segments.length < 2) throw new Error('A vanishing point needs at least two lines.');

  const normalized = segments.map((s) => {
    const a = toNormalized(s.a, size);
    const b = toNormalized(s.b, size);
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 1e-9) throw new Error('A line has zero length.');
    return { a, b, length, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as Vec2, line: lineThrough(a, b) };
  });

  const fit = (weight: (s: (typeof normalized)[number]) => number): Vec3 => {
    const m = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    for (const s of normalized) {
      const w = weight(s);
      const l = s.line;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m[i][j] += w * l[i] * l[j];
    }
    const v = symmetricEigen3(m as unknown as Mat3).vectors[0];
    return v[2] < 0 ? [-v[0], -v[1], -v[2]] : v;
  };

  let h = fit((s) => s.length);
  if (normalized.length > 2) {
    for (let iter = 0; iter < 8; iter++) {
      const prev = h;
      h = fit((s) => {
        const dx = h[0] - s.mid[0] * h[2];
        const dy = h[1] - s.mid[1] * h[2];
        return (s.length * s.length) / (dx * dx + dy * dy + ((s.length * h[2]) / 2) ** 2);
      });
      if (Math.abs(prev[0] - h[0]) + Math.abs(prev[1] - h[1]) + Math.abs(prev[2] - h[2]) < 1e-15) break;
    }
  }

  const residualsDeg = normalized.map(({ a, b, mid }) => {
    const toVp: Vec2 = [h[0] - mid[0] * h[2], h[1] - mid[1] * h[2]];
    const dir: Vec2 = [b[0] - a[0], b[1] - a[1]];
    // Lines have no orientation here, so fold the angle into [0°, 90°]. atan2 instead
    // of acos: acos(1 − ε) throws away half the digits exactly where residuals are small.
    const cross = Math.abs(toVp[0] * dir[1] - toVp[1] * dir[0]);
    const dot = Math.abs(toVp[0] * dir[0] + toVp[1] * dir[1]);
    return (Math.atan2(cross, dot) * 180) / Math.PI;
  });
  const rmsDeg = Math.sqrt(residualsDeg.reduce((sum, r) => sum + r * r, 0) / residualsDeg.length);

  const isFinite = Math.abs(h[2]) > 1e-12;
  return {
    homogeneous: h,
    pixel: isFinite ? toPixels([h[0] / h[2], h[1] / h[2]], size) : null,
    residualsDeg,
    rmsDeg,
  };
}
