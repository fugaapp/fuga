import {
  cross3,
  projectDirection,
  projectSegment,
  type CameraSolution,
  type Project,
  type SignedAxis,
  type SolveResult,
  type Vec2,
  type Vec3,
} from '../../../core';
import { sameHandle, type GroupIndex, type Handle } from '../state/edits';

export interface View {
  readonly scale: number;
  readonly x: number;
  readonly y: number;
}

export const toScreen = (v: View, p: Vec2): Vec2 => [p[0] * v.scale + v.x, p[1] * v.scale + v.y];
export const toImage = (v: View, p: Vec2): Vec2 => [(p[0] - v.x) / v.scale, (p[1] - v.y) / v.scale];

export interface Palette {
  readonly x: string;
  readonly y: string;
  readonly z: string;
  readonly signal: string;
  readonly text: string;
  readonly viewport: string;
  readonly numFont: string;
}

export function readPalette(el: Element): Palette {
  const s = getComputedStyle(el);
  const v = (n: string) => s.getPropertyValue(n).trim();
  return {
    x: v('--axis-x'),
    y: v('--axis-y'),
    z: v('--axis-z'),
    signal: v('--signal'),
    text: v('--text'),
    viewport: v('--bg-viewport'),
    numFont: v('--font-num'),
  };
}

export interface Display {
  readonly photoDim: number;
  readonly overlayOpacity: number;
  readonly showGrid: boolean;
}

export interface Scene {
  readonly project: Project;
  readonly result: SolveResult | null;
  readonly image: HTMLImageElement | null;
  readonly display: Display;
  readonly hover: Handle | null;
  readonly active: Handle | null;
  readonly selected: Handle | null;
}

const axisColor = (pal: Palette, axis: SignedAxis): string => pal[axis[1] as 'x' | 'y' | 'z'];
const UNIT: Record<'x' | 'y' | 'z', Vec3> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

export const groupCount = (p: Project): number => (p.mode === '3vp' ? 3 : 2);

/** Paint the whole scene for one view. Line widths are in screen pixels at any zoom. */
export function drawScene(ctx: CanvasRenderingContext2D, view: View, scene: Scene, pal: Palette, dpr: number): void {
  const { project: p, result, image, display } = scene;
  const S = (pt: Vec2) => toScreen(view, pt);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (image && p.image) {
    // Crisp pixels when zoomed in: you are placing points on real pixels.
    ctx.imageSmoothingEnabled = view.scale < 2;
    ctx.drawImage(image, view.x, view.y, p.image.width * view.scale, p.image.height * view.scale);
    if (display.photoDim > 0) {
      ctx.fillStyle = `rgba(0,0,0,${display.photoDim})`;
      ctx.fillRect(view.x, view.y, p.image.width * view.scale, p.image.height * view.scale);
    }
  }

  const cam = result?.ok ? result.solution : null;
  if (cam && display.showGrid && p.image) {
    // The grid describes the photo, so it stays inside the photo.
    ctx.save();
    ctx.beginPath();
    ctx.rect(view.x, view.y, p.image.width * view.scale, p.image.height * view.scale);
    ctx.clip();
    ctx.globalAlpha = display.overlayOpacity;
    drawGrid(ctx, cam, p, S, pal);
    ctx.restore();
  }

  // Line groups
  const groups = groupCount(p);
  for (let g = 0 as GroupIndex; g < groups; g = (g + 1) as GroupIndex) {
    const group = p.groups[g];
    const color = axisColor(pal, group.axis);
    const vp = cam?.vanishingPoints[g]?.pixel ?? null;
    const directional = p.mode === '1vp' && g === 1;
    group.lines.forEach((seg, i) => {
      const a = S(seg.a), b = S(seg.b);
      const lineHandle: Handle = { kind: 'line', group: g, line: i };
      const hot = sameHandle(scene.hover, lineHandle) || sameHandle(scene.active, lineHandle) || sameHandle(scene.selected, lineHandle);

      if (vp && !directional) {
        // Faint extension from the nearer endpoint to the vanishing point.
        const v = S(vp);
        const near = Math.hypot(a[0] - v[0], a[1] - v[1]) < Math.hypot(b[0] - v[0], b[1] - v[1]) ? a : b;
        ctx.save();
        ctx.setLineDash([2, 4]);
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.45 * display.overlayOpacity;
        ctx.lineWidth = 1;
        line(ctx, near, v);
        ctx.restore();
      }
      ctx.strokeStyle = hot ? pal.signal : color;
      ctx.lineWidth = hot ? 2 : 1.5;
      line(ctx, a, b);
      if (directional) arrowHead(ctx, a, b, hot ? pal.signal : color);
      for (const end of ['a', 'b'] as const) {
        const h: Handle = { kind: 'end', group: g, line: i, end };
        drawEndHandle(ctx, S(seg[end]), color, pal, sameHandle(scene.hover, h) || sameHandle(scene.active, h), sameHandle(scene.selected, h));
      }
    });
    if (vp && !directional) drawVanishingPoint(ctx, S(vp), color, `VP${g + 1}`, pal);
  }

  // Principal point: draggable when manual, a readout of the solve otherwise.
  const pp = cam && (p.mode === '3vp' || p.principalPoint.auto) ? cam.principalPoint : p.principalPoint.point;
  const ppEditable = p.mode !== '3vp' && !p.principalPoint.auto;
  drawCross(ctx, S(pp), ppEditable ? pal.text : 'rgba(233,229,220,0.45)', 6, sameHandle(scene.hover, { kind: 'principal' }) && ppEditable ? pal.signal : null);

  // Reference distance
  if (p.reference.enabled) {
    const o = S(p.origin), r = S(p.reference.point);
    ctx.save();
    ctx.strokeStyle = axisColor(pal, `+${p.reference.axis}` as SignedAxis);
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 3]);
    line(ctx, o, r);
    ctx.restore();
    const hot = sameHandle(scene.hover, { kind: 'reference' }) || sameHandle(scene.active, { kind: 'reference' });
    drawDiamond(ctx, r, hot ? pal.signal : pal.text);
    label(ctx, `${p.reference.distance}`, [(o[0] + r[0]) / 2 + 8, (o[1] + r[1]) / 2 - 8], pal.text, pal);
  }

  // Origin
  const hotOrigin = sameHandle(scene.hover, { kind: 'origin' }) || sameHandle(scene.active, { kind: 'origin' });
  drawOrigin(ctx, S(p.origin), hotOrigin ? pal.signal : pal.text);
}

function drawGrid(ctx: CanvasRenderingContext2D, cam: CameraSolution, p: Project, S: (v: Vec2) => Vec2, pal: Palette): void {
  const cell = p.reference.enabled ? p.reference.distance : 1;
  const n = 10;
  ctx.lineWidth = 1;
  for (let i = -n; i <= n; i++) {
    for (const [a, b, axis] of [
      [[i * cell, -n * cell, 0], [i * cell, n * cell, 0], 'y'],
      [[-n * cell, i * cell, 0], [n * cell, i * cell, 0], 'x'],
    ] as [Vec3, Vec3, 'x' | 'y'][]) {
      const seg = projectSegment(cam, a, b);
      if (!seg) continue;
      ctx.strokeStyle = i === 0 ? pal[axis] : 'rgba(233,229,220,0.32)';
      ctx.lineWidth = i === 0 ? 1.5 : 1;
      line(ctx, S(seg[0]), S(seg[1]));
    }
  }
  // Vertical axis: a short Z gizmo at the origin.
  const z = projectSegment(cam, [0, 0, 0], [0, 0, cell * 2]);
  if (z) {
    ctx.strokeStyle = pal.z;
    ctx.lineWidth = 1.5;
    line(ctx, S(z[0]), S(z[1]));
  }
  // Horizon: the image of the ground plane's line at infinity.
  const h = cross3(projectDirection(cam, UNIT.x), projectDirection(cam, UNIT.y));
  if (Math.hypot(h[0], h[1]) > 1e-12) {
    const w = cam.image.width;
    const y0 = -(h[2] + h[0] * -w) / h[1];
    const y1 = -(h[2] + h[0] * 2 * w) / h[1];
    if (Number.isFinite(y0) && Number.isFinite(y1)) {
      ctx.save();
      ctx.setLineDash([10, 6]);
      ctx.strokeStyle = pal.text;
      ctx.lineWidth = 1;
      line(ctx, S([-w, y0]), S([2 * w, y1]));
      ctx.restore();
      const at = S([0, -(h[2]) / h[1]]);
      label(ctx, 'HORIZON', [Math.max(at[0], 8) + 4, at[1] - 6], pal.text, pal);
    }
  }
}

function line(ctx: CanvasRenderingContext2D, a: Vec2, b: Vec2): void {
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}

function drawEndHandle(ctx: CanvasRenderingContext2D, p: Vec2, color: string, pal: Palette, hot: boolean, selected: boolean): void {
  const r = hot ? 5 : 4;
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = hot || selected ? pal.signal : color;
  ctx.fillStyle = selected ? pal.signal : pal.viewport;
  ctx.fillRect(p[0] - r, p[1] - r, r * 2, r * 2);
  ctx.strokeRect(p[0] - r, p[1] - r, r * 2, r * 2);
  // One-pixel dot: the exact point that is being placed.
  ctx.fillStyle = hot || selected ? pal.viewport : color;
  ctx.fillRect(p[0] - 0.75, p[1] - 0.75, 1.5, 1.5);
}

function arrowHead(ctx: CanvasRenderingContext2D, a: Vec2, b: Vec2, color: string): void {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const m: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  ctx.save();
  ctx.translate(m[0], m[1]);
  ctx.rotate(ang);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-6, -5);
  ctx.lineTo(0, 0);
  ctx.lineTo(-6, 5);
  ctx.stroke();
  ctx.restore();
}

function drawVanishingPoint(ctx: CanvasRenderingContext2D, p: Vec2, color: string, text: string, pal: Palette): void {
  if (!Number.isFinite(p[0]) || Math.abs(p[0]) > 1e6 || Math.abs(p[1]) > 1e6) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(p[0], p[1], 5, 0, Math.PI * 2);
  ctx.stroke();
  label(ctx, text, [p[0] + 9, p[1] - 8], color, pal);
}

function drawCross(ctx: CanvasRenderingContext2D, p: Vec2, color: string, r: number, ring: string | null): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  line(ctx, [p[0] - r, p[1]], [p[0] + r, p[1]]);
  line(ctx, [p[0], p[1] - r], [p[0], p[1] + r]);
  if (ring) {
    ctx.strokeStyle = ring;
    ctx.beginPath();
    ctx.arc(p[0], p[1], r + 3, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawOrigin(ctx: CanvasRenderingContext2D, p: Vec2, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(p[0], p[1], 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1;
  line(ctx, [p[0] - 11, p[1]], [p[0] - 3, p[1]]);
  line(ctx, [p[0] + 3, p[1]], [p[0] + 11, p[1]]);
  line(ctx, [p[0], p[1] - 11], [p[0], p[1] - 3]);
  line(ctx, [p[0], p[1] + 3], [p[0], p[1] + 11]);
}

function drawDiamond(ctx: CanvasRenderingContext2D, p: Vec2, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(p[0], p[1] - 6);
  ctx.lineTo(p[0] + 6, p[1]);
  ctx.lineTo(p[0], p[1] + 6);
  ctx.lineTo(p[0] - 6, p[1]);
  ctx.closePath();
  ctx.stroke();
}

function label(ctx: CanvasRenderingContext2D, text: string, p: Vec2, color: string, pal: Palette): void {
  ctx.font = `500 10px ${pal.numFont}`;
  ctx.fillStyle = color;
  ctx.fillText(text, p[0], p[1]);
}

/** Circular magnifier showing pixels *and* the overlay under the cursor. */
export function drawLoupe(
  ctx: CanvasRenderingContext2D,
  view: View,
  scene: Scene,
  pal: Palette,
  dpr: number,
  focus: Vec2,
  at: Vec2,
  zoom: number,
): void {
  const R = 72;
  const scale = view.scale * zoom;
  const loupeView: View = { scale, x: at[0] - focus[0] * scale, y: at[1] - focus[1] * scale };
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.beginPath();
  ctx.arc(at[0], at[1], R, 0, Math.PI * 2);
  ctx.fillStyle = pal.viewport;
  ctx.fill();
  ctx.clip();
  drawScene(ctx, loupeView, { ...scene, hover: null }, pal, dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Crosshair with a gap so the target pixel itself stays visible.
  ctx.strokeStyle = pal.signal;
  ctx.lineWidth = 1;
  const gap = Math.max(4, scale / 2 + 2);
  line(ctx, [at[0] - R, at[1]], [at[0] - gap, at[1]]);
  line(ctx, [at[0] + gap, at[1]], [at[0] + R, at[1]]);
  line(ctx, [at[0], at[1] - R], [at[0], at[1] - gap]);
  line(ctx, [at[0], at[1] + gap], [at[0], at[1] + R]);
  ctx.restore();
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.strokeStyle = pal.text;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(at[0], at[1], R + 0.5, 0, Math.PI * 2);
  ctx.stroke();
  label(ctx, `×${zoom}`, [at[0] + R * 0.62, at[1] + R * 0.86], pal.text, pal);
  ctx.restore();
}
