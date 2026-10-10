import { MADE_WITH_AI_SHORT } from '../../shared/about';
import { Mark } from './Mark';

export function EmptyState({ onOpen, shortcut }: { onOpen: () => void; shortcut: string }) {
  return (
    <div className="empty">
      <div className="empty-card">
        <span style={{ color: 'var(--text-dim)' }}>
          <Mark size={112} horizon />
        </span>
        <h1>Drop a photo</h1>
        <p>
          or <kbd>{shortcut}</kbd> — PNG · JPG · WEBP · AVIF
        </p>
        <button type="button" className="btn" onClick={onOpen}>
          Open photo…
        </button>
        <p className="credit">{MADE_WITH_AI_SHORT} Help → About Fuga</p>
      </div>
    </div>
  );
}
