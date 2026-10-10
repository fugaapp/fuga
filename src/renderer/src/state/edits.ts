// Pure edits on the project document. Each returns a new Project (or the
// same object when nothing changes, so History skips empty undo steps).
import type { Project, Segment, SignedAxis, Vec2 } from '../../../core';

export type GroupIndex = 0 | 1 | 2;

/** Anything the user can grab in the viewport. */
export type Handle =
  | { readonly kind: 'end'; readonly group: GroupIndex; readonly line: number; readonly end: 'a' | 'b' }
  | { readonly kind: 'line'; readonly group: GroupIndex; readonly line: number }
  | { readonly kind: 'origin' }
  | { readonly kind: 'reference' }
  | { readonly kind: 'principal' };

export const sameHandle = (a: Handle | null, b: Handle | null): boolean =>
  !!a && !!b && JSON.stringify(a) === JSON.stringify(b);

const add = (p: Vec2, d: Vec2): Vec2 => [p[0] + d[0], p[1] + d[1]];

function mapGroup(p: Project, group: GroupIndex, fn: (lines: readonly Segment[]) => readonly Segment[]): Project {
  const groups = [...p.groups] as [Project['groups'][0], Project['groups'][1], Project['groups'][2]];
  groups[group] = { ...groups[group], lines: fn(groups[group].lines) };
  return { ...p, groups };
}

export function setGroupAxis(p: Project, group: GroupIndex, axis: SignedAxis): Project {
  const groups = [...p.groups] as [Project['groups'][0], Project['groups'][1], Project['groups'][2]];
  groups[group] = { ...groups[group], axis };
  return { ...p, groups };
}

/** Move a handle by a delta in image pixels. */
export function moveHandle(p: Project, h: Handle, d: Vec2): Project {
  if (d[0] === 0 && d[1] === 0) return p;
  switch (h.kind) {
    case 'end':
      return mapGroup(p, h.group, (lines) =>
        lines.map((s, i) => (i === h.line ? { ...s, [h.end]: add(s[h.end], d) } : s)),
      );
    case 'line':
      return mapGroup(p, h.group, (lines) => lines.map((s, i) => (i === h.line ? { a: add(s.a, d), b: add(s.b, d) } : s)));
    case 'origin':
      return { ...p, origin: add(p.origin, d) };
    case 'reference':
      return { ...p, reference: { ...p.reference, point: add(p.reference.point, d) } };
    case 'principal':
      return { ...p, principalPoint: { ...p.principalPoint, point: add(p.principalPoint.point, d) } };
  }
}

export function handlePosition(p: Project, h: Handle): Vec2 {
  switch (h.kind) {
    case 'end':
      return p.groups[h.group].lines[h.line][h.end];
    case 'line': {
      const s = p.groups[h.group].lines[h.line];
      return [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2];
    }
    case 'origin':
      return p.origin;
    case 'reference':
      return p.reference.point;
    case 'principal':
      return p.principalPoint.point;
  }
}

/** Add a line to a group: a copy of its last line, offset so it is easy to grab. */
export function addLine(p: Project, group: GroupIndex): Project {
  const size = p.image ? Math.max(p.image.width, p.image.height) : 1000;
  return mapGroup(p, group, (lines) => {
    const last = lines[lines.length - 1] ?? { a: [0, 0], b: [size * 0.2, 0] };
    const dx = last.b[0] - last.a[0], dy = last.b[1] - last.a[1];
    const len = Math.hypot(dx, dy) || 1;
    // Offset perpendicular to the line by 4 % of the image.
    const o: Vec2 = [(-dy / len) * size * 0.04, (dx / len) * size * 0.04];
    return [...lines, { a: add(last.a, o), b: add(last.b, o) }];
  });
}

/** Lines can be removed down to the minimum the solver needs (2, or 1 for the 1vp second axis). */
export function removeLine(p: Project, group: GroupIndex, line: number): Project {
  const min = p.mode === '1vp' && group === 1 ? 1 : 2;
  if (p.groups[group].lines.length <= min) return p;
  return mapGroup(p, group, (lines) => lines.filter((_, i) => i !== line));
}
