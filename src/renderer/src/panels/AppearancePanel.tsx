import { useEffect, useRef } from 'react';
import type { Appearance, ColorKey, ThemeChoice } from '../state/appearance';
import { Segmented } from './controls';

// Theme defaults, mirrored from styles/tokens.css, so the pickers can show
// the colour you get when nothing is overridden.
const DEFAULTS: Record<'dark' | 'light', Record<ColorKey, string>> = {
  dark: { signal: '#f5c518', x: '#ec5f5a', y: '#8ccf55', z: '#5a9bf0' },
  light: { signal: '#8a6800', x: '#c93a33', y: '#3b8a2a', z: '#2e66c4' },
};

const ROWS: { key: ColorKey; label: string; hint: string }[] = [
  { key: 'signal', label: 'Accent', hint: 'Handles under the cursor, toggles, focus' },
  { key: 'x', label: 'X axis', hint: 'Lines, grid and readouts for X' },
  { key: 'y', label: 'Y axis', hint: 'Lines, grid and readouts for Y' },
  { key: 'z', label: 'Z axis', hint: 'Lines, grid and readouts for Z' },
];

interface Props {
  appearance: Appearance;
  resolved: 'dark' | 'light';
  onChange: (a: Appearance) => void;
  onClose: () => void;
}

export function AppearancePanel({ appearance, resolved, onChange, onClose }: Props) {
  const panel = useRef<HTMLDivElement>(null);

  // Close on Escape or a click outside.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const onDown = (e: PointerEvent) => {
      if (panel.current && !panel.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, [onClose]);

  const setColor = (key: ColorKey, value: string | null) => {
    const colors = { ...appearance.colors };
    if (value) colors[key] = value;
    else delete colors[key];
    onChange({ ...appearance, colors });
  };

  const customized = Object.keys(appearance.colors).length > 0;

  return (
    <div ref={panel} className="popover" role="dialog" aria-label="Appearance">
      <div className="popover-head">
        <span>Appearance</span>
        <button type="button" className="btn ghost" onClick={onClose} aria-label="Close">
          Close
        </button>
      </div>

      <div className="row">
        <span className="label">Theme</span>
        <Segmented<ThemeChoice>
          label="Theme"
          value={appearance.theme}
          options={[
            { value: 'system', label: 'SYSTEM' },
            { value: 'light', label: 'LIGHT' },
            { value: 'dark', label: 'DARK' },
          ]}
          onChange={(theme) => onChange({ ...appearance, theme })}
        />
      </div>

      <div className="popover-rule" />

      {ROWS.map(({ key, label, hint }) => {
        const value = appearance.colors[key] ?? DEFAULTS[resolved][key];
        const custom = key in appearance.colors;
        return (
          <div className="color-row" key={key}>
            <input
              type="color"
              className="swatch"
              aria-label={`${label} colour`}
              value={value}
              onChange={(e) => setColor(key, e.target.value)}
            />
            <div className="color-text">
              <span>{label}</span>
              <small>{hint}</small>
            </div>
            <span className="num">{value.toUpperCase()}</span>
            <button type="button" className="btn ghost" disabled={!custom} onClick={() => setColor(key, null)} title="Back to the theme default">
              Reset
            </button>
          </div>
        );
      })}

      <div className="popover-foot">
        <span>Saved on this computer only.</span>
        <button type="button" className="btn" disabled={!customized} onClick={() => onChange({ ...appearance, colors: {} })}>
          Reset colours
        </button>
      </div>
    </div>
  );
}
