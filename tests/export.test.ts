// Round-trip tests: parse the numbers out of each exported file, rebuild the
// target application's own camera model from them and check that world
// points land on the same pixels as in Fuga.
import { describe, expect, it } from 'vitest';
import { EXPORT_TARGETS, projectPoint, type CameraSolution, type Vec3 } from '../src/core';
import { lookAt } from './synthetic';

const opts = { name: 'Shot 010', sensorWidthMm: 36, imagePath: '/photos/shot "010".jpg' };
const target = (id: string) => EXPORT_TARGETS.find((t) => t.id === id)!;
const nums = (s: string) => (s.match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi) ?? []).map(Number);
const grab = (text: string, re: RegExp) => {
  const m = text.match(re);
  if (!m) throw new Error(`missing ${re}`);
  return Number(m[1]);
};
const yUp = (p: Vec3): Vec3 => [p[0], p[2], -p[1]];

/** Project with a "camera looks −Z, +Y up" matrix (columns x, y, z, position). */
function projectWithMatrix(cols: number[][], world: Vec3) {
  const [x, y, z, t] = cols;
  const d = [world[0] - t[0], world[1] - t[1], world[2] - t[2]];
  const local = [x, y, z].map((a) => a[0] * d[0] + a[1] * d[1] + a[2] * d[2]);
  return { u: local[0] / -local[2], v: local[1] / -local[2] };
}

const cameras: [string, CameraSolution][] = [
  ['landscape, centered', lookAt({ position: [7, -9, 1.7], target: [1.5, 1.2, 0.8], rollDeg: 3, focalPx: 1650 })],
  [
    'portrait, shifted principal point',
    lookAt({ position: [-3, -6, 2.5], target: [0, 0, 1], focalPx: 2100, width: 3000, height: 4000, principalPoint: [1400, 2150] }),
  ],
];
const points: Vec3[] = [[0, 0, 0], [4, 3, 2.5], [-2, 5, 0.3]];

describe.each(cameras)('%s', (_, cam) => {
  const { width: W, height: H } = cam.image;
  const L = Math.max(W, H);

  it('Blender script reprojects exactly', () => {
    const py = target('blender').write(cam, opts);
    const lens = grab(py, /data\.lens = (\S+)/);
    const sx = grab(py, /data\.shift_x = (\S+)/);
    const sy = grab(py, /data\.shift_y = (\S+)/);
    const rows = py.split('Matrix((')[1].split('))')[0].trim().split('\n').slice(0, 3).map(nums);
    const cols = [0, 1, 2, 3].map((j) => rows.map((r) => r[j]));
    const F = (lens / 36) * L;
    for (const p of points) {
      const { u, v } = projectWithMatrix(cols, p);
      const expected = projectPoint(cam, p)!;
      expect(W / 2 + F * u - sx * L).toBeCloseTo(expected[0], 6);
      expect(H / 2 - F * v + sy * L).toBeCloseTo(expected[1], 6);
    }
  });

  it('Maya script reprojects exactly (Y-up, inches)', () => {
    const py = target('maya').write(cam, opts);
    const focal = grab(py, /focalLength", (\S+)\)/);
    const hfa = grab(py, /horizontalFilmAperture", (\S+)\)/);
    const vfa = grab(py, /verticalFilmAperture", (\S+)\)/);
    const hfo = grab(py, /horizontalFilmOffset", (\S+)\)/);
    const vfo = grab(py, /verticalFilmOffset", (\S+)\)/);
    const m = nums(py.split('matrix=[')[1].split(']')[0]);
    const cols = [0, 1, 2, 3].map((r) => m.slice(r * 4, r * 4 + 3));
    expect(hfa / vfa).toBeCloseTo(W / H, 12);
    for (const p of points) {
      const { u, v } = projectWithMatrix(cols, yUp(p));
      const expected = projectPoint(cam, p)!;
      // Film-back plane in inches, then to pixels.
      const fx = (focal / 25.4) * u - hfo, fy = (focal / 25.4) * v - vfo;
      expect(W / 2 + (fx / hfa) * W).toBeCloseTo(expected[0], 6);
      expect(H / 2 - (fy / vfa) * H).toBeCloseTo(expected[1], 6);
    }
  });

  it('USD reprojects exactly (Y-up, row-vector matrix)', () => {
    const usda = target('usd').write(cam, opts);
    const focal = grab(usda, /focalLength = (\S+)/);
    const ha = grab(usda, /horizontalAperture = (\S+)/);
    const va = grab(usda, /verticalAperture = (\S+)/);
    const ho = grab(usda, /horizontalApertureOffset = (\S+)/);
    const vo = grab(usda, /verticalApertureOffset = (\S+)/);
    const m = nums(usda.split('xformOp:transform = (')[1].split('\n')[0]);
    const cols = [0, 1, 2, 3].map((r) => m.slice(r * 4, r * 4 + 3));
    for (const p of points) {
      const { u, v } = projectWithMatrix(cols, yUp(p));
      const expected = projectPoint(cam, p)!;
      expect(W / 2 + ((focal * u - ho) / ha) * W).toBeCloseTo(expected[0], 6);
      expect(H / 2 - ((focal * v - vo) / va) * H).toBeCloseTo(expected[1], 6);
    }
  });

  it('JSON round-trips through JSON.parse with the K matrix intact', () => {
    const doc = JSON.parse(target('json').write(cam, opts));
    expect(doc.intrinsics.K[0][0]).toBe(cam.focalPx);
    expect(doc.intrinsics.principalPointPx).toEqual([...cam.principalPoint]);
  });
});

describe('escaping', () => {
  const cam = cameras[0][1];
  it('quotes paths safely for Python', () => {
    expect(target('blender').write(cam, opts)).toContain('IMAGE_PATH = "/photos/shot \\"010\\".jpg"');
  });
  it('makes a valid USD prim name', () => {
    expect(target('usd').write(cam, { ...opts, name: '10 shot-a' })).toContain('def Camera "_10_shot_a"');
  });
});

describe('euler readout', () => {
  it('rebuilds the same rotation as Blender (R = Rz · Ry · Rx)', async () => {
    const { cameraPlacement, eulerXYZDeg } = await import('../src/core');
    const cam = cameras[0][1];
    const p = cameraPlacement(cam, 'z');
    const [ex, ey, ez] = eulerXYZDeg(p).map((d) => (d * Math.PI) / 180);
    const [cx, sx, cy, sy, cz, sz] = [Math.cos(ex), Math.sin(ex), Math.cos(ey), Math.sin(ey), Math.cos(ez), Math.sin(ez)];
    // First column of Rz·Ry·Rx is the camera's local x axis in world space.
    expect(cz * cy).toBeCloseTo(p.x[0], 12);
    expect(sz * cy).toBeCloseTo(p.x[1], 12);
    expect(-sy).toBeCloseTo(p.x[2], 12);
    // Third column: local z.
    expect(cz * sy * cx + sz * sx).toBeCloseTo(p.z[0], 12);
    expect(sz * sy * cx - cz * sx).toBeCloseTo(p.z[1], 12);
    expect(cy * cx).toBeCloseTo(p.z[2], 12);
  });
});
