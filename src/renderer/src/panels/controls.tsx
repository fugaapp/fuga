import { useEffect, useState, type ReactNode } from 'react';

export function Section({ index, title, children, aside }: { index: string; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="section">
      <h2>
        <span className="index">{index}</span>
        <span style={{ flex: 1 }}>{title}</span>
        {aside}
      </h2>
      {children}
    </section>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly { value: T; label: string; title?: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} title={o.title} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Numeric input that only commits valid, finite numbers (on Enter or blur),
 * so a half-typed value never reaches the solver — and never "jumps back"
 * while you type (fSpy issue #156).
 */
export function NumberField({
  value,
  onCommit,
  min,
  step = 'any',
  id,
  suffix,
}: {
  value: number;
  onCommit: (v: number) => void;
  min?: number;
  step?: number | 'any';
  id?: string;
  suffix?: string;
}) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(String(value));
  }, [value, focused]);

  const commit = () => {
    const v = Number(text.replace(',', '.'));
    if (Number.isFinite(v) && (min === undefined || v >= min) && v !== value) onCommit(v);
    else setText(String(value));
  };

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <input
        id={id}
        className="field num"
        inputMode="decimal"
        step={step}
        value={text}
        onFocus={() => setFocused(true)}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            setText(String(value));
            setFocused(false);
            (e.target as HTMLInputElement).blur();
          }
          e.stopPropagation();
        }}
      />
      {suffix && <span className="num" style={{ color: 'var(--text-dim)', width: 18 }}>{suffix}</span>}
    </span>
  );
}

export const fmt = (n: number, digits = 3) => (Number.isFinite(n) ? n.toFixed(digits) : '—');
