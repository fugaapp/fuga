// The Fuga mark.
// Edges take the current text colour; the point takes the signal colour.

const EDGES: [number, number, number, number][] = [
  [4, 8, 24.94, 17.77],
  [4, 30, 24.34, 24.58],
  [4, 44, 25.94, 27.91],
];

export function Mark({ size = 16, horizon = false }: { size?: number; horizon?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="mark">
      {horizon && (
        <g stroke="var(--text-faint)" strokeWidth="1" strokeLinecap="round">
          <line x1="2" y1="22" x2="24" y2="22" />
          <line x1="41.4" y1="22" x2="46" y2="22" />
        </g>
      )}
      <g stroke="currentColor" strokeWidth={size < 24 ? 3.6 : 2.6} strokeLinecap="round">
        {EDGES.map(([x1, y1, x2, y2]) => (
          <line key={y1} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
      <path d="M34 17.6L38.4 22L34 26.4L29.6 22Z" fill="none" stroke="var(--signal)" strokeWidth={size < 24 ? 3.2 : 2.2} />
    </svg>
  );
}
