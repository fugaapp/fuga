export function EmptyState({ onOpen, shortcut }: { onOpen: () => void; shortcut: string }) {
  // Four edges of an unseen box receding to one point on a horizon: the whole app in one drawing.
  const vp = { x: 236, y: 40 };
  const starts = [
    [0, 8],
    [0, 70],
    [0, 112],
    [0, 150],
  ];
  return (
    <div className="empty">
      <div className="empty-card">
        <svg width="260" height="160" viewBox="0 0 260 160" aria-hidden="true">
          <line x1="0" y1={vp.y} x2="260" y2={vp.y} stroke="var(--hairline-strong)" strokeDasharray="6 4" />
          {starts.map(([x, y], i) => (
            <line key={i} x1={x} y1={y} x2={vp.x} y2={vp.y} stroke="var(--text-faint)" strokeWidth="1" />
          ))}
          <rect x={vp.x - 3.5} y={vp.y - 3.5} width="7" height="7" fill="none" stroke="var(--signal)" transform={`rotate(45 ${vp.x} ${vp.y})`} />
        </svg>
        <h1>Drop a photo</h1>
        <p>
          or <kbd>{shortcut}</kbd> — PNG · JPG · WEBP · AVIF
        </p>
        <button type="button" className="btn" onClick={onOpen}>
          Open photo…
        </button>
      </div>
    </div>
  );
}
