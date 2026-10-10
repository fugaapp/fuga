import type { Vec2 } from '../math/vec';
import type { ImageSize } from '../solver/frame';
import type { Axis, SignedAxis, SolveMode, SolverInput } from '../solver/types';
import type { Segment } from '../solver/vanishing';

export interface LineGroup {
  readonly axis: SignedAxis;
  readonly lines: readonly Segment[];
}

/**
 * The saved document. Plain JSON, versioned, image referenced by path —
 * readable in a text editor and diffable in git, unlike fSpy's binary format.
 */
export interface Project {
  readonly format: 'fuga-project';
  readonly version: 1;
  readonly image: (ImageSize & { readonly path: string | null }) | null;
  readonly mode: SolveMode;
  /** Always three groups; the mode decides how many are used. */
  readonly groups: readonly [LineGroup, LineGroup, LineGroup];
  readonly principalPoint: { readonly auto: boolean; readonly point: Vec2 };
  readonly lens: { readonly sensorWidthMm: number; readonly focalMm: number };
  readonly origin: Vec2;
  readonly reference: {
    readonly enabled: boolean;
    readonly axis: Axis;
    readonly distance: number;
    readonly point: Vec2;
  };
}

const seg = (ax: number, ay: number, bx: number, by: number, w: number, h: number): Segment => ({
  a: [ax * w, ay * h],
  b: [bx * w, by * h],
});

/** A fresh project with lines laid out as a starting guess for a typical corner shot. */
export function createProject(image: Project['image']): Project {
  const w = image?.width ?? 1600;
  const h = image?.height ?? 1000;
  return {
    format: 'fuga-project',
    version: 1,
    image,
    mode: '2vp',
    groups: [
      { axis: '+x', lines: [seg(0.52, 0.62, 0.86, 0.5, w, h), seg(0.52, 0.78, 0.86, 0.72, w, h)] },
      { axis: '+y', lines: [seg(0.48, 0.62, 0.14, 0.5, w, h), seg(0.48, 0.78, 0.14, 0.72, w, h)] },
      { axis: '+z', lines: [seg(0.3, 0.85, 0.32, 0.2, w, h), seg(0.7, 0.85, 0.68, 0.2, w, h)] },
    ],
    principalPoint: { auto: true, point: [w / 2, h / 2] },
    lens: { sensorWidthMm: 36, focalMm: 35 },
    origin: [w * 0.5, h * 0.8],
    reference: { enabled: false, axis: 'x', distance: 1, point: [w * 0.62, h * 0.77] },
  };
}

export function toSolverInput(p: Project): SolverInput | null {
  if (!p.image) return null;
  const longest = Math.max(p.image.width, p.image.height);
  return {
    image: p.image,
    mode: p.mode,
    lines: p.groups.map((g) => g.lines),
    axes: p.groups.map((g) => g.axis),
    principalPoint: p.principalPoint.auto ? null : p.principalPoint.point,
    focalLengthPx: (p.lens.focalMm / p.lens.sensorWidthMm) * longest,
    origin: p.origin,
    reference: p.reference.enabled ? p.reference : null,
    defaultDistance: 10,
  };
}

const SIGNED_AXES = new Set(['+x', '-x', '+y', '-y', '+z', '-z']);
const MAX_LINES_PER_GROUP = 500;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPoint = (v: unknown): v is Vec2 => Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1]);

/**
 * Check every field of an untrusted project, so a damaged or hostile file
 * can only produce an error message — never NaN geometry, a frozen UI or a
 * crash. Returns the first problem found, or null.
 */
function problem(d: Record<string, unknown>): string | null {
  const img = d.image as Record<string, unknown> | null;
  if (img !== null) {
    if (typeof img !== 'object') return 'image';
    if (img.path !== null && typeof img.path !== 'string') return 'image.path';
    for (const k of ['width', 'height'] as const) {
      const v = img[k];
      if (!Number.isInteger(v) || (v as number) < 1 || (v as number) > 100_000) return `image.${k}`;
    }
  }
  if (d.mode !== '1vp' && d.mode !== '2vp' && d.mode !== '3vp') return 'mode';
  const groups = d.groups as unknown[];
  for (let g = 0; g < 3; g++) {
    const group = groups[g] as Record<string, unknown> | undefined;
    if (!group || !SIGNED_AXES.has(group.axis as string)) return `groups[${g}].axis`;
    const lines = group.lines;
    if (!Array.isArray(lines) || lines.length > MAX_LINES_PER_GROUP) return `groups[${g}].lines`;
    for (const l of lines as Record<string, unknown>[]) {
      if (!l || !isPoint(l.a) || !isPoint(l.b)) return `groups[${g}].lines`;
    }
  }
  const pp = d.principalPoint as Record<string, unknown> | undefined;
  if (!pp || typeof pp.auto !== 'boolean' || !isPoint(pp.point)) return 'principalPoint';
  const lens = d.lens as Record<string, unknown> | undefined;
  if (!lens || !isNum(lens.sensorWidthMm) || lens.sensorWidthMm <= 0 || !isNum(lens.focalMm) || lens.focalMm <= 0) return 'lens';
  if (!isPoint(d.origin)) return 'origin';
  const ref = d.reference as Record<string, unknown> | undefined;
  if (!ref || typeof ref.enabled !== 'boolean' || !['x', 'y', 'z'].includes(ref.axis as string)) return 'reference';
  if (!isNum(ref.distance) || ref.distance <= 0 || !isPoint(ref.point)) return 'reference';
  return null;
}

/** Parse a saved file. Throws with a human-readable message on anything unexpected. */
export function parseProject(text: string): Project {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  const d = data as Partial<Project>;
  if (d?.format !== 'fuga-project') throw new Error('This is not a Fuga project.');
  if (d.version !== 1) throw new Error(`Unsupported project version ${String(d.version)}. Update Fuga.`);
  if (!Array.isArray(d.groups) || d.groups.length !== 3) throw new Error('Project has a malformed line list.');
  // Future versions migrate here, one step at a time (v1 → v2 → …).
  const bad = problem(d as unknown as Record<string, unknown>);
  if (bad) throw new Error(`This project file is damaged (${bad}).`);
  const p = d as Project;
  // Rebuild from known fields only: unknown keys in the file are dropped.
  return {
    format: 'fuga-project',
    version: 1,
    image: p.image ? { path: p.image.path, width: p.image.width, height: p.image.height } : null,
    mode: p.mode,
    groups: p.groups.map((g) => ({ axis: g.axis, lines: g.lines.map((l) => ({ a: [l.a[0], l.a[1]], b: [l.b[0], l.b[1]] })) })) as unknown as Project['groups'],
    principalPoint: { auto: p.principalPoint.auto, point: [p.principalPoint.point[0], p.principalPoint.point[1]] },
    lens: { sensorWidthMm: p.lens.sensorWidthMm, focalMm: p.lens.focalMm },
    origin: [p.origin[0], p.origin[1]],
    reference: {
      enabled: p.reference.enabled,
      axis: p.reference.axis,
      distance: p.reference.distance,
      point: [p.reference.point[0], p.reference.point[1]],
    },
  };
}
