import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react';
import { closestOnLine, projectDirection, type Project, type SolveResult, type Vec2, type Vec3 } from '../../../core';
import { handlePosition, moveHandle, type GroupIndex, type Handle } from '../state/edits';
import type { History } from '../state/history';
import { drawLoupe, drawScene, groupCount, readPalette, toImage, toScreen, type Display, type View } from './draw';

export interface ViewportApi {
  fit(): void;
  actualPixels(): void;
  /** Nudge the selected handle by screen pixels (arrow keys). */
  nudge(dx: number, dy: number): void;
}

interface Props {
  ref?: Ref<ViewportApi>;
  history: History<Project>;
  project: Project;
  result: SolveResult | null;
  image: HTMLImageElement | null;
  display: Display;
  loupeZoom: number;
  selected: Handle | null;
  onSelect: (h: Handle | null) => void;
  onCursor: (image: Vec2 | null) => void;
  onZoom: (scale: number) => void;
  /** Changes whenever theme or colours change, so the canvas repaints with them. */
  paletteKey: string;
}

const HIT_RADIUS = 8;
const AXIS: Record<'x' | 'y' | 'z', Vec3> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

type Drag =
  | { kind: 'handle'; handle: Handle; virtual: Vec2; last: Vec2 }
  | { kind: 'pan'; last: Vec2 };

function hitTest(p: Project, view: View, pt: Vec2): Handle | null {
  const near = (q: Vec2, r = HIT_RADIUS) => {
    const s = toScreen(view, q);
    return Math.hypot(s[0] - pt[0], s[1] - pt[1]) <= r;
  };
  const groups = groupCount(p);
  for (let g = 0; g < groups; g++) {
    const lines = p.groups[g].lines;
    for (let i = lines.length - 1; i >= 0; i--) {
      for (const end of ['a', 'b'] as const) {
        if (near(lines[i][end])) return { kind: 'end', group: g as GroupIndex, line: i, end };
      }
    }
  }
  if (p.reference.enabled && near(p.reference.point)) return { kind: 'reference' };
  if (near(p.origin, 12)) return { kind: 'origin' };
  if (p.mode !== '3vp' && !p.principalPoint.auto && near(p.principalPoint.point)) return { kind: 'principal' };
  for (let g = 0; g < groups; g++) {
    const lines = p.groups[g].lines;
    for (let i = lines.length - 1; i >= 0; i--) {
      const a = toScreen(view, lines[i].a), b = toScreen(view, lines[i].b);
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
      if (Math.hypot(a[0] + t * dx - pt[0], a[1] + t * dy - pt[1]) <= 5) return { kind: 'line', group: g as GroupIndex, line: i };
    }
  }
  return null;
}

export function Viewport({ ref, history, project, result, image, display, loupeZoom, selected, onSelect, onCursor, onZoom, paletteKey }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const [hover, setHover] = useState<Handle | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [pointer, setPointer] = useState<Vec2 | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const fit = useCallback(() => {
    if (!project.image || size.w === 0) return;
    const margin = 40;
    const scale = Math.min((size.w - margin * 2) / project.image.width, (size.h - margin * 2) / project.image.height);
    setView({ scale, x: (size.w - project.image.width * scale) / 2, y: (size.h - project.image.height * scale) / 2 });
  }, [project.image, size]);

  const zoomAt = useCallback((factor: number, at: Vec2) => {
    setView((v) => {
      const scale = Math.min(64, Math.max(0.02, v.scale * factor));
      const k = scale / v.scale;
      return { scale, x: at[0] - (at[0] - v.x) * k, y: at[1] - (at[1] - v.y) * k };
    });
  }, []);

  /** The reference handle slides along the image of its axis through the origin. */
  const constrain = useCallback(
    (h: Handle, pos: Vec2): Vec2 => {
      if (h.kind !== 'reference' || !result?.ok) return pos;
      return closestOnLine(pos, project.origin, projectDirection(result.solution, AXIS[project.reference.axis]));
    },
    [project.origin, project.reference.axis, result],
  );

  const moveTo = useCallback(
    (h: Handle, target: Vec2) => {
      history.update((p) => {
        const cur = handlePosition(p, h);
        return moveHandle(p, h, [target[0] - cur[0], target[1] - cur[1]]);
      });
    },
    [history],
  );

  useImperativeHandle(
    ref,
    () => ({
      fit,
      actualPixels: () => zoomAt(1 / view.scale, [size.w / 2, size.h / 2]),
      nudge: (dx, dy) => {
        if (!selected) return;
        const pos = handlePosition(project, selected);
        moveTo(selected, constrain(selected, [pos[0] + dx / view.scale, pos[1] + dy / view.scale]));
      },
    }),
    [fit, zoomAt, view.scale, size, selected, project, moveTo, constrain],
  );

  // Track the canvas size (CSS pixels).
  useLayoutEffect(() => {
    const el = host.current!;
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Re-fit whenever a different photo arrives.
  const imageKey = project.image ? `${project.image.path}:${project.image.width}x${project.image.height}` : '';
  useEffect(() => {
    fit();
  }, [imageKey, size.w > 0]);

  useEffect(() => onZoom(view.scale), [view.scale, onZoom]);

  // Paint.
  useEffect(() => {
    const c = canvas.current;
    if (!c || !host.current || size.w === 0) return;
    // Read colours on every paint: theme and user colours can change at any time.
    const pal = readPalette(host.current);
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(size.w * dpr) || c.height !== Math.round(size.h * dpr)) {
      c.width = Math.round(size.w * dpr);
      c.height = Math.round(size.h * dpr);
    }
    const ctx = c.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    if (!project.image) return;
    const active = drag?.kind === 'handle' ? drag.handle : null;
    const scene = { project, result, image, display, hover, active, selected };
    drawScene(ctx, view, scene, pal, dpr);
    if (active && pointer) {
      const focus = handlePosition(project, active);
      // Place the loupe up-left of the cursor, flipping when it would leave the view.
      const off = 110;
      const at: Vec2 = [pointer[0] - off < 80 ? pointer[0] + off : pointer[0] - off, pointer[1] - off < 80 ? pointer[1] + off : pointer[1] - off];
      drawLoupe(ctx, view, scene, pal, dpr, focus, at, loupeZoom);
    }
  }, [project, result, image, display, hover, drag, selected, view, size, pointer, loupeZoom, paletteKey]);

  const local = (e: { clientX: number; clientY: number }): Vec2 => {
    const r = canvas.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const pt = local(e);
    canvas.current!.setPointerCapture(e.pointerId);
    const hit = e.button === 0 && !e.altKey ? hitTest(project, view, pt) : null;
    if (hit) {
      history.beginGesture();
      onSelect(hit);
      setDrag({ kind: 'handle', handle: hit, virtual: handlePosition(project, hit), last: pt });
    } else {
      if (e.button === 0) onSelect(null);
      setDrag({ kind: 'pan', last: pt });
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const pt = local(e);
    setPointer(pt);
    onCursor(project.image ? toImage(view, pt) : null);
    if (!drag) {
      setHover(project.image ? hitTest(project, view, pt) : null);
      return;
    }
    const dx = pt[0] - drag.last[0], dy = pt[1] - drag.last[1];
    if (drag.kind === 'pan') {
      setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
      setDrag({ ...drag, last: pt });
      return;
    }
    // Precision is read from *this* event, so it can never get stuck on (fSpy bug #141).
    const k = (e.shiftKey ? 0.1 : 1) / view.scale;
    const virtual: Vec2 = [drag.virtual[0] + dx * k, drag.virtual[1] + dy * k];
    moveTo(drag.handle, constrain(drag.handle, virtual));
    setDrag({ ...drag, virtual, last: pt });
  };

  const endDrag = () => {
    if (drag?.kind === 'handle') history.endGesture();
    setDrag(null);
  };

  const onWheel = (e: React.WheelEvent) => {
    // Trackpad pinch arrives as ctrl+wheel with small deltas; mouse wheels as large steps.
    zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), local(e));
  };

  const cursor = drag?.kind === 'pan' ? 'grabbing' : drag ? 'none' : hover ? (hover.kind === 'line' ? 'move' : 'crosshair') : 'default';

  return (
    <div
      ref={host}
      className="viewport"
      data-dragover={dragOver}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={() => setDragOver(false)}
    >
      <canvas
        ref={canvas}
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => {
          setHover(null);
          onCursor(null);
        }}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}
