import { det3, fromColumns, mulMatVec, orthonormalize, transpose3 } from '../math/mat3';
import { cross3, dot3, norm3, normalize3, scale3, type Vec2, type Vec3 } from '../math/vec';
import { normScale, toNormalized, toPixels } from './frame';
import type { Axis, CameraSolution, SignedAxis, SolveResult, SolverInput } from './types';
import { estimateVanishingPoint, lineThrough, type Segment, type VanishingPoint } from './vanishing';

const AXIS_INDEX: Record<Axis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };
const parseAxis = (a: SignedAxis) => ({ index: AXIS_INDEX[a[1] as Axis], sign: a[0] === '-' ? -1 : 1 });

/** Above this RMS line disagreement (deg) a VP is reported as suspicious. */
const RESIDUAL_WARN_DEG = 0.35;
/** VPs further than this (in half-image units) leave the focal length poorly constrained. */
const FAR_VP = 40;

class SolveError extends Error {}

/**
 * Camera-space direction (unit) pointing toward a vanishing point.
 * Everything is in the normalized frame: principal point p, focal f.
 */
function directionToward(vp: VanishingPoint, p: Vec2, f: number, lines: readonly Segment[]): Vec3 {
  const [x, y, w] = vp.homogeneous;
  let d: Vec3 = [x - p[0] * w, y - p[1] * w, f * w];
  if (Math.abs(w) < 1e-12) {
    // VP at infinity: "toward" is ambiguous, so follow the drawn direction of the first line.
    const s = lines[0];
    if ((s.b[0] - s.a[0]) * d[0] + (s.b[1] - s.a[1]) * d[1] < 0) d = scale3(d, -1);
  }
  return normalize3(d);
}

/** Rotation whose columns are the world axes in camera space, from two or three axis directions. */
function rotationFromAxes(known: { axis: SignedAxis; dir: Vec3 }[]): CameraSolution['rotation'] {
  const cols: (Vec3 | undefined)[] = [undefined, undefined, undefined];
  for (const { axis, dir } of known.slice(0, 2)) {
    const { index, sign } = parseAxis(axis);
    if (cols[index]) throw new SolveError('Two vanishing points are assigned to the same world axis.');
    cols[index] = scale3(dir, sign);
  }
  const k = cols.findIndex((c) => !c);
  // Right-handed completion: x = y × z, y = z × x, z = x × y.
  const derived = cross3(cols[(k + 1) % 3]!, cols[(k + 2) % 3]!);
  if (known[2]) {
    // 3vp: the third VP measures this axis too. Keep its sign consistent with the
    // right-handed completion and let the polar decomposition average both.
    cols[k] = scale3(known[2].dir, Math.sign(dot3(known[2].dir, derived)) || 1);
  } else {
    cols[k] = derived;
  }
  return orthonormalize(fromColumns(cols[0]!, cols[1]!, cols[2]!));
}

function focalFromPair(v1: Vec2, v2: Vec2, p: Vec2): number {
  const f2 = -((v1[0] - p[0]) * (v2[0] - p[0]) + (v1[1] - p[1]) * (v2[1] - p[1]));
  if (!(f2 > 0)) {
    throw new SolveError(
      'These vanishing points cannot come from perpendicular directions: seen from the principal point they lie less than 90° apart. Check that each line group follows one real-world direction.',
    );
  }
  return Math.sqrt(f2);
}

const finite = (vp: VanishingPoint, i: number): Vec2 => {
  const [x, y, w] = vp.homogeneous;
  if (Math.abs(w) < 1e-12) {
    throw new SolveError(
      `Vanishing point ${i + 1} is at infinity (its lines are parallel in the image). Use 1-point mode or lines with visible convergence.`,
    );
  }
  return [x / w, y / w];
};

/** Orthocenter of the triangle (a, b, c): the principal point implied by three orthogonal VPs. */
function orthocenter(a: Vec2, b: Vec2, c: Vec2): Vec2 {
  // (p − a)·(b − c) = 0 and (p − b)·(a − c) = 0
  const m00 = b[0] - c[0], m01 = b[1] - c[1];
  const m10 = a[0] - c[0], m11 = a[1] - c[1];
  const r0 = a[0] * m00 + a[1] * m01;
  const r1 = b[0] * m10 + b[1] * m11;
  const det = m00 * m11 - m01 * m10;
  if (Math.abs(det) < 1e-12) throw new SolveError('The three vanishing points are collinear.');
  return [(r0 * m11 - m01 * r1) / det, (m00 * r1 - r0 * m10) / det];
}

function solveInternal(input: SolverInput): CameraSolution {
  const { image, mode, lines, axes } = input;
  const warnings: string[] = [];
  const vpCount = mode === '3vp' ? 3 : mode === '2vp' ? 2 : 1;

  const vps: VanishingPoint[] = [];
  for (let i = 0; i < vpCount; i++) {
    vps.push(estimateVanishingPoint(lines[i] ?? [], image));
    if (vps[i].rmsDeg > RESIDUAL_WARN_DEG) {
      warnings.push(`Lines of vanishing point ${i + 1} disagree by ${vps[i].rmsDeg.toFixed(2)}° RMS — check their placement.`);
    }
    const [x, y, w] = vps[i].homogeneous;
    if (Math.hypot(x, y) > FAR_VP * Math.abs(w) && mode !== '1vp') {
      warnings.push(`Vanishing point ${i + 1} is very far from the image; focal length is weakly constrained.`);
    }
  }

  let p: Vec2 = input.principalPoint ? toNormalized(input.principalPoint, image) : [0, 0];
  let f: number;
  const known: { axis: SignedAxis; dir: Vec3 }[] = [];

  if (mode === '1vp') {
    if (!input.focalLengthPx || input.focalLengthPx <= 0) {
      throw new SolveError('1-point mode needs a known focal length.');
    }
    f = input.focalLengthPx / normScale(image);
    const d1 = directionToward(vps[0], p, f, lines[0]);
    known.push({ axis: axes[0], dir: d1 });

    // Each second-axis line back-projects to a plane with normal n = Kᵀ l. The axis
    // lies in all those planes and is perpendicular to d1: minimise Σ (nᵢ·d)² on the
    // circle d ⊥ d1. With one line this is simply d1 × n.
    const second = lines[1] ?? [];
    if (second.length < 1) throw new SolveError('1-point mode needs a line along a second axis.');
    const u = normalize3(Math.abs(d1[0]) < 0.9 ? cross3(d1, [1, 0, 0]) : cross3(d1, [0, 1, 0]));
    const v = cross3(d1, u);
    let a = 0, b = 0, c = 0;
    for (const s of second) {
      const l = lineThrough(toNormalized(s.a, image), toNormalized(s.b, image));
      const n = normalize3([f * l[0], f * l[1], l[0] * p[0] + l[1] * p[1] + l[2]]);
      const nu = dot3(n, u), nv = dot3(n, v);
      a += nu * nu; b += nu * nv; c += nv * nv;
    }
    // Smallest-eigenvalue direction of [[a, b], [b, c]].
    const theta = 0.5 * Math.atan2(2 * b, a - c) + Math.PI / 2;
    let d2 = normalize3([
      u[0] * Math.cos(theta) + v[0] * Math.sin(theta),
      u[1] * Math.cos(theta) + v[1] * Math.sin(theta),
      u[2] * Math.cos(theta) + v[2] * Math.sin(theta),
    ]);
    // Orient d2 with the drawn direction of the first line (image-space derivative of the projection).
    const s0 = second[0];
    const mid = toNormalized([(s0.a[0] + s0.b[0]) / 2, (s0.a[1] + s0.b[1]) / 2], image);
    const mu = (mid[0] - p[0]) / f, mv = (mid[1] - p[1]) / f;
    const img: Vec2 = [d2[0] - mu * d2[2], d2[1] - mv * d2[2]];
    if (img[0] * (s0.b[0] - s0.a[0]) + img[1] * (s0.b[1] - s0.a[1]) < 0) d2 = scale3(d2, -1);
    known.push({ axis: axes[1], dir: d2 });
  } else {
    const v1 = finite(vps[0], 0);
    const v2 = finite(vps[1], 1);
    if (mode === '3vp') {
      const v3 = finite(vps[2], 2);
      p = orthocenter(v1, v2, v3);
      const f2s = [focalFromPair(v1, v2, p), focalFromPair(v1, v3, p), focalFromPair(v2, v3, p)];
      f = Math.sqrt(f2s.reduce((s, x) => s + x * x, 0) / 3);
      if (Math.hypot(p[0], p[1]) > 0.3) {
        warnings.push('The solved principal point is far from the image center. Fine for cropped or shifted images; otherwise refine the third line group.');
      }
    } else {
      f = focalFromPair(v1, v2, p);
    }
    for (let i = 0; i < vpCount; i++) known.push({ axis: axes[i], dir: directionToward(vps[i], p, f, lines[i]) });
  }

  const rotation = rotationFromAxes(known);
  if (det3(rotation) < 0) throw new SolveError('Internal error: rotation is not right-handed.');

  // Position. The world origin sits somewhere on the viewing ray r0 through its pixel.
  const o = toNormalized(input.origin, image);
  const r0: Vec3 = [o[0] - p[0], o[1] - p[1], f];
  let depth = input.defaultDistance / norm3(r0);
  if (input.reference) {
    const { axis, distance, point } = input.reference;
    const q = toNormalized(point, image);
    const r1: Vec3 = [q[0] - p[0], q[1] - p[1], f];
    const dk: Vec3 = [rotation[0][AXIS_INDEX[axis]], rotation[1][AXIS_INDEX[axis]], rotation[2][AXIS_INDEX[axis]]];
    // depth·r0 + distance·dk must be parallel to r1. Least squares on cross(r1, ·) = 0.
    // abs(): a point on either side of the origin along the axis gives the same scale.
    const a = cross3(r1, r0);
    const denom = dot3(a, a);
    if (denom < 1e-18) throw new SolveError('The reference point coincides with the origin.');
    depth = Math.abs((-distance * dot3(cross3(r1, dk), a)) / denom);
    if (!(depth > 0) || !Number.isFinite(depth)) throw new SolveError('The reference point does not constrain the scale.');
  }
  const originCam = scale3(r0, depth);
  const position = scale3(mulMatVec(transpose3(rotation), originCam), -1);

  const s = normScale(image);
  const focalPx = f * s;
  const pp = toPixels(p, image);
  return {
    image,
    focalPx,
    principalPoint: pp,
    rotation,
    position,
    vanishingPoints: vps,
    fovDeg: {
      horizontal: (2 * Math.atan(image.width / 2 / focalPx) * 180) / Math.PI,
      vertical: (2 * Math.atan(image.height / 2 / focalPx) * 180) / Math.PI,
    },
    warnings,
  };
}

export function solveCamera(input: SolverInput): SolveResult {
  try {
    return { ok: true, solution: solveInternal(input) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
