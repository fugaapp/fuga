import type { Vec3 } from './vec';

/** Row-major 3x3 matrix: m[row][col]. */
export type Mat3 = readonly [Vec3, Vec3, Vec3];

export const identity3: Mat3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

export const fromColumns = (c0: Vec3, c1: Vec3, c2: Vec3): Mat3 => [
  [c0[0], c1[0], c2[0]],
  [c0[1], c1[1], c2[1]],
  [c0[2], c1[2], c2[2]],
];

export const column = (m: Mat3, j: 0 | 1 | 2): Vec3 => [m[0][j], m[1][j], m[2][j]];

export const transpose3 = (m: Mat3): Mat3 => fromColumns(m[0], m[1], m[2]);

export const mulMatVec = (m: Mat3, v: Vec3): Vec3 => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
];

export const mulMat3 = (a: Mat3, b: Mat3): Mat3 =>
  fromColumns(mulMatVec(a, column(b, 0)), mulMatVec(a, column(b, 1)), mulMatVec(a, column(b, 2)));

export const det3 = (m: Mat3): number =>
  m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
  m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
  m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

const inverse3 = (m: Mat3): Mat3 => {
  const d = det3(m);
  const [[a, b, c], [e, f, g], [h, i, j]] = m;
  return [
    [(f * j - g * i) / d, (c * i - b * j) / d, (b * g - c * f) / d],
    [(g * h - e * j) / d, (a * j - c * h) / d, (c * e - a * g) / d],
    [(e * i - f * h) / d, (b * h - a * i) / d, (a * f - b * e) / d],
  ];
};

/**
 * Nearest rotation matrix (polar decomposition) via the Newton iteration
 * R <- (R + R^-T) / 2. Converges quadratically for near-orthogonal input,
 * which is exactly what the solver produces after averaging noisy estimates.
 */
export function orthonormalize(m: Mat3): Mat3 {
  let r = m;
  for (let k = 0; k < 30; k++) {
    const invT = transpose3(inverse3(r));
    const next: Mat3 = [
      [(r[0][0] + invT[0][0]) / 2, (r[0][1] + invT[0][1]) / 2, (r[0][2] + invT[0][2]) / 2],
      [(r[1][0] + invT[1][0]) / 2, (r[1][1] + invT[1][1]) / 2, (r[1][2] + invT[1][2]) / 2],
      [(r[2][0] + invT[2][0]) / 2, (r[2][1] + invT[2][1]) / 2, (r[2][2] + invT[2][2]) / 2],
    ];
    let delta = 0;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) delta += Math.abs(next[i][j] - r[i][j]);
    r = next;
    if (delta < 1e-15) break;
  }
  return r;
}

/**
 * Eigen-decomposition of a symmetric 3x3 matrix (cyclic Jacobi).
 * Returns eigenvalues ascending with matching unit eigenvectors.
 * Jacobi is slow for big matrices but for 3x3 it is the most accurate
 * simple method available — accuracy is the point of this app.
 */
export function symmetricEigen3(m: Mat3): { values: Vec3; vectors: [Vec3, Vec3, Vec3] } {
  const a = m.map((row) => [...row]);
  const v = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  for (let sweep = 0; sweep < 50; sweep++) {
    const off = Math.abs(a[0][1]) + Math.abs(a[0][2]) + Math.abs(a[1][2]);
    if (off < 1e-300) break;
    for (let p = 0; p < 2; p++) {
      for (let q = p + 1; q < 3; q++) {
        if (a[p][q] === 0) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < 3; k++) {
          const akp = a[k][p];
          const akq = a[k][q];
          a[k][p] = c * akp - s * akq;
          a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < 3; k++) {
          const apk = a[p][k];
          const aqk = a[q][k];
          a[p][k] = c * apk - s * aqk;
          a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < 3; k++) {
          const vkp = v[k][p];
          const vkq = v[k][q];
          v[k][p] = c * vkp - s * vkq;
          v[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }
  const order = [0, 1, 2].sort((i, j) => a[i][i] - a[j][j]);
  const vec = (j: number): Vec3 => [v[0][j], v[1][j], v[2][j]];
  return {
    values: [a[order[0]][order[0]], a[order[1]][order[1]], a[order[2]][order[2]]],
    vectors: [vec(order[0]), vec(order[1]), vec(order[2])],
  };
}
