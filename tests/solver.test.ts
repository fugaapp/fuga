import { describe, expect, it } from 'vitest';
import { det3, projectPoint, solveCamera, type Segment, type SolverInput, type Vec3 } from '../src/core';
import { edges, gaussian, lookAt, maxAbsDiff } from './synthetic';

// A 4 × 3 × 2.5 box with one corner at the world origin, seen from a corner.
const truth = lookAt({ position: [7, -9, 1.7], target: [1.5, 1.2, 0.8], rollDeg: 3, focalPx: 1650 });
const X: Vec3 = [1, 0, 0], Y: Vec3 = [0, 1, 0], Z: Vec3 = [0, 0, 1];
const xLines = edges(truth, [[0, 0, 0], [0, 0, 2.5], [0, 3, 2.5]], X, 4);
const yLines = edges(truth, [[0, 0, 0], [4, 0, 0], [4, 0, 2.5]], Y, 3);
const zLines = edges(truth, [[0, 0, 0], [4, 0, 0], [4, 3, 0]], Z, 2.5);
const origin = projectPoint(truth, [0, 0, 0])!;
const refPoint = projectPoint(truth, [4, 0, 0])!;

const base: SolverInput = {
  image: truth.image,
  mode: '2vp',
  lines: [xLines, yLines, zLines],
  // The labelled axis is the one that recedes toward its vanishing point. Seen
  // from (7, −9, 1.7), the box's x edges recede toward −x and the camera looks down.
  axes: ['-x', '+y', '-z'],
  principalPoint: null,
  origin,
  reference: { axis: 'x', distance: 4, point: refPoint },
  defaultDistance: 10,
};

function solved(input: SolverInput) {
  const r = solveCamera(input);
  if (!r.ok) throw new Error(r.error);
  return r.solution;
}

describe('2-point solve on exact data', () => {
  const s = solved(base);

  it('recovers the focal length to ~1e-9 relative', () => {
    expect(Math.abs(s.focalPx - truth.focalPx) / truth.focalPx).toBeLessThan(1e-9);
  });
  it('recovers the rotation', () => {
    expect(maxAbsDiff(s.rotation, truth.rotation)).toBeLessThan(1e-9);
    expect(det3(s.rotation)).toBeCloseTo(1, 12);
  });
  it('recovers the position at true scale from the reference distance', () => {
    expect(maxAbsDiff([s.position], [truth.position])).toBeLessThan(1e-8);
  });
  it('reports zero line disagreement and no warnings', () => {
    for (const vp of s.vanishingPoints) expect(vp.rmsDeg).toBeLessThan(1e-7);
    expect(s.warnings).toEqual([]);
  });
  it('reprojects every box corner onto its pixel', () => {
    for (const p of [[4, 3, 2.5], [0, 3, 0], [4, 0, 2.5]] as Vec3[]) {
      const a = projectPoint(s, p)!, b = projectPoint(truth, p)!;
      expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThan(1e-6);
    }
  });
  it('accepts a reference point on the negative side of the axis', () => {
    const neg = solved({ ...base, reference: { axis: 'x', distance: 2, point: projectPoint(truth, [-2, 0, 0])! } });
    expect(maxAbsDiff([neg.position], [truth.position])).toBeLessThan(1e-8);
  });
});

describe('axis assignment', () => {
  it('flipping an axis label mirrors that world axis and stays right-handed', () => {
    const s = solved({ ...base, axes: ['+x', '+y', '-z'], reference: null });
    expect(det3(s.rotation)).toBeCloseTo(1, 12);
    // World +x now points away from VP1, so column 0 flips; z = x × y flips too.
    expect(s.rotation[0][0]).toBeCloseTo(-truth.rotation[0][0], 9);
    expect(s.rotation[0][2]).toBeCloseTo(-truth.rotation[0][2], 9);
  });
  it('rejects two vanishing points on the same axis', () => {
    const r = solveCamera({ ...base, axes: ['-x', '+x', '-z'] });
    expect(r.ok).toBe(false);
  });
  it('works for any axis pair (y/z instead of x/y)', () => {
    const s = solved({ ...base, lines: [yLines, zLines, xLines], axes: ['+y', '-z', '-x'] });
    expect(maxAbsDiff(s.rotation, truth.rotation)).toBeLessThan(1e-9);
  });
});

describe('3-point solve', () => {
  // Looking down at the box so the vertical lines converge strongly.
  const shifted = lookAt({
    position: [6, -7, 6],
    target: [2, 1.5, 0],
    focalPx: 1400,
    principalPoint: [1020, 500],
  });
  const input: SolverInput = {
    ...base,
    image: shifted.image,
    mode: '3vp',
    lines: [
      edges(shifted, [[0, 0, 0], [0, 3, 0], [0, 3, 2.5]], X, 4),
      edges(shifted, [[0, 0, 0], [4, 0, 0], [4, 0, 2.5]], Y, 3),
      edges(shifted, [[0, 0, 0], [4, 0, 0], [4, 3, 0]], Z, 2.5),
    ],
    origin: projectPoint(shifted, [0, 0, 0])!,
    reference: { axis: 'z', distance: 2.5, point: projectPoint(shifted, [0, 0, 2.5])! },
  };
  const s = solved(input);

  it('solves the principal point (lens shift / cropped photos)', () => {
    expect(Math.hypot(s.principalPoint[0] - 1020, s.principalPoint[1] - 500)).toBeLessThan(1e-6);
  });
  it('solves focal, rotation and position', () => {
    expect(Math.abs(s.focalPx - 1400)).toBeLessThan(1e-6);
    expect(maxAbsDiff(s.rotation, shifted.rotation)).toBeLessThan(1e-9);
    expect(maxAbsDiff([s.position], [shifted.position])).toBeLessThan(1e-7);
  });
});

describe('1-point solve with known focal length', () => {
  // Nearly frontal view of a corridor: x edges are almost parallel in the image.
  const front = lookAt({ position: [0.3, -6, 1.6], target: [0.1, 10, 1.4], rollDeg: -2, focalPx: 1300 });
  const input: SolverInput = {
    ...base,
    image: front.image,
    mode: '1vp',
    lines: [edges(front, [[-1, 0, 0], [1, 0, 0], [-1, 0, 2.5], [1, 0, 2.5]], Y, 8), edges(front, [[-1, 2, 0]], X, 2)],
    axes: ['+y', '+x', '+z'],
    focalLengthPx: 1300,
    origin: projectPoint(front, [0, 0, 0])!,
    reference: { axis: 'x', distance: 1, point: projectPoint(front, [1, 0, 0])! },
  };
  const s = solved(input);

  it('recovers rotation and position', () => {
    expect(maxAbsDiff(s.rotation, front.rotation)).toBeLessThan(1e-9);
    expect(maxAbsDiff([s.position], [front.position])).toBeLessThan(1e-8);
  });
  it('orients the second axis by the drawn line direction', () => {
    const reversed = input.lines[1].map((l): Segment => ({ a: l.b, b: l.a }));
    const r = solved({ ...input, lines: [input.lines[0], reversed], reference: null });
    expect(r.rotation[0][0]).toBeCloseTo(-front.rotation[0][0], 9);
  });
});

describe('robustness to click noise', () => {
  // Endpoints jittered by σ = 0.7 px — a realistic careful click at 100 % zoom.
  function focalError(linesPerAxis: number, trials: number): number {
    const noise = gaussian(1234);
    const jitter = (s: Segment): Segment => ({
      a: [s.a[0] + 0.7 * noise(), s.a[1] + 0.7 * noise()],
      b: [s.b[0] + 0.7 * noise(), s.b[1] + 0.7 * noise()],
    });
    const starts = (k: number, axis: 'x' | 'y'): Vec3[] =>
      Array.from({ length: k }, (_, i) => {
        const h = (2.5 * i) / Math.max(1, k - 1);
        return axis === 'x' ? [0, (3 * (i % 2)), h] : [4 * (i % 2), 0, h];
      });
    let sum = 0;
    for (let t = 0; t < trials; t++) {
      const s = solved({
        ...base,
        lines: [
          edges(truth, starts(linesPerAxis, 'x'), X, 4).map(jitter),
          edges(truth, starts(linesPerAxis, 'y'), Y, 3).map(jitter),
          [],
        ],
        reference: null,
      });
      sum += Math.abs(s.focalPx - truth.focalPx) / truth.focalPx;
    }
    return sum / trials;
  }

  it('more lines per vanishing point give a clearly better focal length', () => {
    // Lines between the outermost edges add less information than the outer pair
    // (similar angles), so the gain is real but below the naive √n.
    const two = focalError(2, 300);
    const ten = focalError(10, 300);
    expect(ten).toBeLessThan(two * 0.7);
    expect(ten).toBeLessThan(0.008);
  });
});

describe('degenerate input is explained, not crashed on', () => {
  it('needs two lines per vanishing point', () => {
    const r = solveCamera({ ...base, lines: [xLines.slice(0, 1), yLines, []] });
    expect(r).toMatchObject({ ok: false });
  });
  it('rejects parallel lines in 2-point mode', () => {
    const parallel: Segment[] = [
      { a: [100, 100], b: [500, 100] },
      { a: [100, 300], b: [500, 300] },
    ];
    const r = solveCamera({ ...base, lines: [parallel, yLines, []] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/infinity/);
  });
  it('rejects vanishing points that cannot be perpendicular', () => {
    // Both groups converge to the same side of the image.
    const r = solveCamera({ ...base, lines: [xLines, xLines.map((l) => ({ a: l.a, b: [l.b[0], l.b[1] + 40] as const })), []] });
    expect(r.ok).toBe(false);
  });
});
