// Appearance preferences: theme and user colour overrides.
// Stored in this machine's localStorage only — never sent anywhere.
import { useEffect, useLayoutEffect, useState } from 'react';

export type ThemeChoice = 'system' | 'dark' | 'light';
export type ColorKey = 'signal' | 'x' | 'y' | 'z';

export interface Appearance {
  readonly theme: ThemeChoice;
  /** Only the colours the user changed; missing keys use the theme default. */
  readonly colors: Partial<Record<ColorKey, string>>;
}

const KEY = 'fuga.appearance.v1';
const HEX = /^#[0-9a-f]{6}$/i;
const DEFAULT: Appearance = { theme: 'system', colors: {} };

export const COLOR_VARS: Record<ColorKey, string> = {
  signal: '--signal',
  x: '--axis-x',
  y: '--axis-y',
  z: '--axis-z',
};

function load(): Appearance {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Appearance> | null;
    if (!raw) return DEFAULT;
    const theme = raw.theme === 'dark' || raw.theme === 'light' ? raw.theme : 'system';
    const colors: Partial<Record<ColorKey, string>> = {};
    for (const k of Object.keys(COLOR_VARS) as ColorKey[]) {
      const v = raw.colors?.[k];
      if (typeof v === 'string' && HEX.test(v)) colors[k] = v;
    }
    return { theme, colors };
  } catch {
    return DEFAULT;
  }
}

function save(a: Appearance): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(a));
  } catch {
    // Storage unavailable: preferences just won't persist.
  }
}

/** Black or white, whichever reads better on `hex` (WCAG relative luminance). */
function inkFor(hex: string): string {
  const lin = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * lin(1) + 0.7152 * lin(3) + 0.0722 * lin(5);
  return (1.05 / (l + 0.05) > (l + 0.05) / 0.05) ? '#ffffff' : '#1a1500';
}

const prefersDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

/** Current appearance, a setter, and the resolved theme. Applies itself to <html>. */
export function useAppearance(): [Appearance, (a: Appearance) => void, 'dark' | 'light'] {
  const [appearance, setAppearance] = useState<Appearance>(load);
  const [systemDark, setSystemDark] = useState(prefersDark);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolved = appearance.theme === 'system' ? (systemDark ? 'dark' : 'light') : appearance.theme;

  // Layout effect: runs before any child's paint effect, so the canvas never reads stale colours.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolved;
    for (const [k, prop] of Object.entries(COLOR_VARS) as [ColorKey, string][]) {
      const v = appearance.colors[k];
      if (v) root.style.setProperty(prop, v);
      else root.style.removeProperty(prop);
    }
    if (appearance.colors.signal) root.style.setProperty('--signal-ink', inkFor(appearance.colors.signal));
    else root.style.removeProperty('--signal-ink');
    // Native menus, dialogs and scrollbars follow the same choice.
    window.fuga.setTheme(appearance.theme);
  }, [appearance, resolved]);

  const update = (a: Appearance) => {
    setAppearance(a);
    save(a);
  };
  return [appearance, update, resolved];
}
