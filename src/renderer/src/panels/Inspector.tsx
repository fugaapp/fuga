import {
  cameraPlacement,
  EXPORT_TARGETS,
  eulerXYZDeg,
  type Axis,
  type Project,
  type SignedAxis,
  type SolveMode,
  type SolveResult,
} from '../../../core';
import { addLine, setGroupAxis, type GroupIndex } from '../state/edits';
import type { History } from '../state/history';
import type { Display } from '../viewport/draw';
import { fmt, NumberField, Section, Segmented } from './controls';

const SIGNED_AXES: SignedAxis[] = ['+x', '-x', '+y', '-y', '+z', '-z'];
const SENSORS = [
  { label: 'Full frame', mm: 36 },
  { label: 'Super 35', mm: 24.89 },
  { label: 'APS-C', mm: 23.6 },
  { label: 'Micro 4/3', mm: 17.3 },
  { label: '1″ type', mm: 13.2 },
];
const MODES: { value: SolveMode; label: string; title: string }[] = [
  { value: '1vp', label: '1 VP', title: 'One vanishing point + known focal length' },
  { value: '2vp', label: '2 VP', title: 'Two vanishing points: solves focal length' },
  { value: '3vp', label: '3 VP', title: 'Three vanishing points: also solves the principal point' },
];

interface Props {
  history: History<Project>;
  project: Project;
  result: SolveResult | null;
  display: Display;
  onDisplay: (d: Display) => void;
  onOpenImage: () => void;
  onExport: (targetId: string) => void;
}

const axisVar = (a: SignedAxis) => `var(--axis-${a[1]})`;

export function Inspector({ history, project: p, result, display, onDisplay, onOpenImage, onExport }: Props) {
  const set = (fn: (p: Project) => Project) => history.update(fn);
  const cam = result?.ok ? result.solution : null;
  const groupsUsed = p.mode === '3vp' ? 3 : 2;
  const longest = p.image ? Math.max(p.image.width, p.image.height) : 1;
  const placement = cam ? cameraPlacement(cam, 'z') : null;
  const euler = placement ? eulerXYZDeg(placement) : null;

  return (
    <aside className="inspector">
      <Section index="01" title="Photo">
        {p.image ? (
          <dl className="readout">
            <dt>File</dt>
            <dd title={p.image.path ?? ''} style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 190, whiteSpace: 'nowrap' }}>
              {p.image.path?.split(/[\\/]/).pop() ?? '—'}
            </dd>
            <dt>Size</dt>
            <dd className="num">
              {p.image.width} × {p.image.height}
            </dd>
          </dl>
        ) : (
          <button type="button" className="btn" onClick={onOpenImage}>
            Open photo…
          </button>
        )}
      </Section>

      <Section index="02" title="Method">
        <Segmented label="Solve method" value={p.mode} options={MODES} onChange={(mode) => set((q) => ({ ...q, mode }))} />
      </Section>

      <Section index="03" title="Vanishing points">
        {Array.from({ length: groupsUsed }, (_, g) => {
          const group = p.groups[g];
          const vp = cam?.vanishingPoints[g];
          const secondAxis = p.mode === '1vp' && g === 1;
          // Map 0°…1° RMS onto the meter; past 0.35° the solver warns.
          const quality = vp ? Math.min(1, vp.rmsDeg / 1) : 0;
          return (
            <div className="vp" key={g} style={{ ['--axis' as string]: axisVar(group.axis) }}>
              <div className="vp-head">
                <span className="vp-swatch" />
                <span className="vp-name">{secondAxis ? 'Second axis' : `VP ${g + 1}`}</span>
                {g < 2 || p.mode !== '3vp' ? (
                  <select
                    className="field num"
                    style={{ width: 58 }}
                    aria-label={`Axis for line group ${g + 1}`}
                    value={group.axis}
                    onChange={(e) => set((q) => setGroupAxis(q, g as GroupIndex, e.target.value as SignedAxis))}
                  >
                    {SIGNED_AXES.map((a) => (
                      <option key={a} value={a}>
                        {a.toUpperCase()}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="num" style={{ color: 'var(--text-dim)' }}>
                    derived
                  </span>
                )}
                <button type="button" className="btn ghost" title="Add a line to this group" onClick={() => set((q) => addLine(q, g as GroupIndex))}>
                  + line
                </button>
              </div>
              {!secondAxis && (
                <div className="vp-meter">
                  <div className="meter" style={{ ['--quality' as string]: quality > 0.35 ? 'var(--warn)' : 'var(--ok)' }}>
                    <span style={{ width: `${Math.max(2, quality * 100)}%` }} />
                  </div>
                  <span className="num" style={{ fontSize: 'var(--text-xs)' }}>
                    {group.lines.length} lines · {vp ? `${fmt(vp.rmsDeg, 3)}° rms` : '—'}
                  </span>
                </div>
              )}
            </div>
          );
        })}
        <p className="hint">
          {p.mode === '1vp'
            ? 'The second-axis arrow points along the positive axis.'
            : 'The chosen axis is the one receding toward the vanishing point. More lines → more accuracy.'}
        </p>
      </Section>

      <Section index="04" title="Lens">
        {p.mode !== '3vp' && (
          <div className="row">
            <label htmlFor="pp-auto">Principal point at center</label>
            <input
              id="pp-auto"
              type="checkbox"
              className="toggle"
              checked={p.principalPoint.auto}
              onChange={(e) => set((q) => ({ ...q, principalPoint: { ...q.principalPoint, auto: e.target.checked } }))}
            />
          </div>
        )}
        <div className="row">
          <label htmlFor="sensor">Sensor width</label>
          <select
            id="sensor"
            className="field"
            style={{ width: 110 }}
            value={SENSORS.find((s) => s.mm === p.lens.sensorWidthMm)?.mm ?? 'custom'}
            onChange={(e) => e.target.value !== 'custom' && set((q) => ({ ...q, lens: { ...q.lens, sensorWidthMm: Number(e.target.value) } }))}
          >
            {SENSORS.map((s) => (
              <option key={s.mm} value={s.mm}>
                {s.label}
              </option>
            ))}
            <option value="custom">Custom</option>
          </select>
        </div>
        <div className="row">
          <label />
          <NumberField value={p.lens.sensorWidthMm} min={0.1} suffix="mm" onCommit={(v) => set((q) => ({ ...q, lens: { ...q.lens, sensorWidthMm: v } }))} />
        </div>
        {p.mode === '1vp' && (
          <div className="row">
            <label>Known focal length</label>
            <NumberField value={p.lens.focalMm} min={0.1} suffix="mm" onCommit={(v) => set((q) => ({ ...q, lens: { ...q.lens, focalMm: v } }))} />
          </div>
        )}
        <p className="hint">Sensor width only changes the millimetre readout, never the framing.</p>
      </Section>

      <Section index="05" title="Scale">
        <div className="row">
          <label htmlFor="ref-on">Reference distance</label>
          <input
            id="ref-on"
            type="checkbox"
            className="toggle"
            checked={p.reference.enabled}
            onChange={(e) => set((q) => ({ ...q, reference: { ...q.reference, enabled: e.target.checked } }))}
          />
        </div>
        {p.reference.enabled && (
          <>
            <div className="row">
              <label>Along axis</label>
              <Segmented<Axis>
                label="Reference axis"
                value={p.reference.axis}
                options={[
                  { value: 'x', label: 'X' },
                  { value: 'y', label: 'Y' },
                  { value: 'z', label: 'Z' },
                ]}
                onChange={(axis) => set((q) => ({ ...q, reference: { ...q.reference, axis } }))}
              />
            </div>
            <div className="row">
              <label>Length</label>
              <NumberField value={p.reference.distance} min={1e-6} suffix="u" onCommit={(v) => set((q) => ({ ...q, reference: { ...q.reference, distance: v } }))} />
            </div>
          </>
        )}
        <p className="hint">Drag the ◯ to the world origin; the ◇ slides along the chosen axis.</p>
      </Section>

      <Section index="06" title="Camera">
        {cam && placement && euler ? (
          <dl className="readout">
            <dt>Focal length</dt>
            <dd className="num">
              {fmt((cam.focalPx * p.lens.sensorWidthMm) / longest, 2)}
              <small>mm</small>
            </dd>
            <dt>Focal length</dt>
            <dd className="num">
              {fmt(cam.focalPx, 1)}
              <small>px</small>
            </dd>
            <dt>Field of view</dt>
            <dd className="num">
              {fmt(cam.fovDeg.horizontal, 2)}° × {fmt(cam.fovDeg.vertical, 2)}°
            </dd>
            <dt>Principal point</dt>
            <dd className="num">
              {fmt(cam.principalPoint[0], 1)}, {fmt(cam.principalPoint[1], 1)}
            </dd>
            <dt>Position</dt>
            <dd className="num">{placement.position.map((v) => fmt(v, 3)).join('  ')}</dd>
            <dt>Rotation XYZ</dt>
            <dd className="num">{euler.map((v) => `${fmt(v, 2)}°`).join('  ')}</dd>
          </dl>
        ) : (
          <p className="hint" style={{ marginTop: 0 }}>
            {p.image ? 'No solution yet.' : 'Open a photo to begin.'}
          </p>
        )}
        {result && !result.ok && <div className="message error">{result.error}</div>}
        {cam?.warnings.map((w) => (
          <div className="message" key={w}>
            {w}
          </div>
        ))}
      </Section>

      <Section index="07" title="Overlay">
        <div className="row">
          <label htmlFor="grid">Ground grid & horizon</label>
          <input id="grid" type="checkbox" className="toggle" checked={display.showGrid} onChange={(e) => onDisplay({ ...display, showGrid: e.target.checked })} />
        </div>
        <div className="row">
          <label htmlFor="ov">Overlay opacity</label>
          <input id="ov" type="range" min={0.1} max={1} step={0.05} value={display.overlayOpacity} onChange={(e) => onDisplay({ ...display, overlayOpacity: Number(e.target.value) })} />
        </div>
        <div className="row">
          <label htmlFor="dim">Dim photo</label>
          <input id="dim" type="range" min={0} max={0.85} step={0.05} value={display.photoDim} onChange={(e) => onDisplay({ ...display, photoDim: Number(e.target.value) })} />
        </div>
      </Section>

      <Section index="08" title="Export">
        <div className="export-grid">
          {EXPORT_TARGETS.map((t) => (
            <button key={t.id} type="button" className="btn" disabled={!cam} onClick={() => onExport(t.id)}>
              <span>{t.label}</span>
              <small>{t.hint}</small>
            </button>
          ))}
        </div>
      </Section>
    </aside>
  );
}
