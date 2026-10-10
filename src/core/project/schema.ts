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
  return { ...createProject(d.image ?? null), ...d } as Project;
}
