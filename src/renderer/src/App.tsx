import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createProject, EXPORT_TARGETS, parseProject, solveCamera, toSolverInput, type Project, type Vec2 } from '../../core';
import type { MenuCommand, OpenedImage } from '../../shared/ipc';
import type { UpdateInfo } from '../../shared/release';
import { EmptyState } from './EmptyState';
import { Mark } from './Mark';
import { AppearancePanel } from './panels/AppearancePanel';
import { Inspector } from './panels/Inspector';
import { useAppearance } from './state/appearance';
import { removeLine, type Handle } from './state/edits';
import { History, useHistory } from './state/history';
import type { Display } from './viewport/draw';
import { Viewport, type ViewportApi } from './viewport/Viewport';

const api = window.fuga;
const LOUPE_STEPS = [2, 4, 8, 16, 32];

/** Image paths in a project may be relative to the project file (portable folders). */
function resolveFrom(projectPath: string, imagePath: string): string {
  if (/^([a-zA-Z]:[\\/]|[\\/])/.test(imagePath)) return imagePath;
  const sep = projectPath.includes('\\') && !projectPath.includes('/') ? '\\' : '/';
  return projectPath.replace(/[^\\/]*$/, '') + imagePath.replace(/[\\/]/g, sep);
}

const baseName = (path: string | null | undefined) => path?.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? null;

/** Decode image bytes into an element we can draw, and read its true pixel size. */
async function decode(opened: OpenedImage): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(new Blob([opened.bytes], { type: opened.mime }));
  const img = new Image();
  img.src = url;
  await img.decode();
  return img;
}

export function App() {
  const history = useMemo(() => new History<Project>(createProject(null)), []);
  const project = useHistory(history);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [display, setDisplay] = useState<Display>({ photoDim: 0.15, overlayOpacity: 0.8, showGrid: true });
  const [loupeZoom, setLoupeZoom] = useState(4);
  const [selected, setSelected] = useState<Handle | null>(null);
  const [cursor, setCursor] = useState<Vec2 | null>(null);
  const [zoom, setZoom] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [appearance, setAppearance, theme] = useAppearance();
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const viewport = useRef<ViewportApi>(null);

  const result = useMemo(() => {
    const input = toSolverInput(project);
    return input ? solveCamera(input) : null;
  }, [project]);

  const flash = useCallback((text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice((n) => (n === text ? null : n)), 4000);
  }, []);

  const showImage = useCallback((img: HTMLImageElement) => {
    setImage((old) => {
      if (old) URL.revokeObjectURL(old.src);
      return img;
    });
  }, []);

  const loadPhoto = useCallback(
    async (opened: OpenedImage) => {
      const img = await decode(opened);
      showImage(img);
      setSelected(null);
      setProjectPath(null);
      history.reset(createProject({ path: opened.path, width: img.naturalWidth, height: img.naturalHeight }));
    },
    [history, showImage],
  );

  const run = useCallback(
    (task: () => Promise<void>) => {
      task().catch((e: unknown) => flash(e instanceof Error ? e.message : String(e)));
    },
    [flash],
  );

  const openPhoto = useCallback(() => run(async () => {
    const opened = await api.openImage();
    if (opened) await loadPhoto(opened);
  }), [run, loadPhoto]);

  const openProject = useCallback(() => run(async () => {
    const file = await api.openProject();
    if (!file) return;
    const loaded = parseProject(file.text);
    history.reset(loaded);
    setProjectPath(file.path);
    setSelected(null);
    if (loaded.image?.path) {
      const imagePath = resolveFrom(file.path, loaded.image.path);
      try {
        showImage(await decode(await api.readImage(imagePath)));
        // Keep the absolute path in memory so exports can reference the photo.
        history.reset({ ...loaded, image: { ...loaded.image, path: imagePath } });
      } catch {
        flash(`Photo not found: ${imagePath}`);
      }
    }
  }), [run, history, showImage, flash]);

  const save = useCallback((as: boolean) => run(async () => {
    const path = await api.saveProject(JSON.stringify(history.value, null, 2) + '\n', as ? null : projectPath);
    if (!path) return;
    setProjectPath(path);
    history.markSaved();
    flash(`Saved ${path}`);
  }), [run, history, projectPath, flash]);

  const exportTo = useCallback((id: string) => run(async () => {
    const target = EXPORT_TARGETS.find((t) => t.id === id);
    if (!target || !result?.ok) return;
    const name = baseName(project.image?.path) ?? 'Fuga Camera';
    const content = target.write(result.solution, {
      name: `${name}_camera`,
      sensorWidthMm: project.lens.sensorWidthMm,
      imagePath: project.image?.path ?? null,
    });
    const path = await api.exportFile(content, `${name}_${target.id}`, target.extension);
    if (path) flash(`Exported ${path}`);
  }), [run, result, project]);

  const checkUpdates = useCallback(
    (manual: boolean) =>
      run(async () => {
        const found = await api.checkForUpdate(!manual);
        setUpdate(found);
        if (manual && !found) flash(`Fuga ${api.version} is the latest version.`);
      }),
    [run, flash],
  );

  // Check once shortly after launch; quietly does nothing when offline.
  useEffect(() => {
    const t = window.setTimeout(() => checkUpdates(false), 3000);
    return () => window.clearTimeout(t);
  }, [checkUpdates]);

  // Menu commands from the main process. A ref keeps the subscription stable.
  const commands = useRef<Record<MenuCommand, () => void>>(null!);
  commands.current = {
    'open-image': openPhoto,
    'open-project': openProject,
    save: () => save(false),
    'save-as': () => save(true),
    undo: () => history.undo(),
    redo: () => history.redo(),
    'zoom-fit': () => viewport.current?.fit(),
    'zoom-100': () => viewport.current?.actualPixels(),
    'check-updates': () => checkUpdates(true),
    appearance: () => setAppearanceOpen((o) => !o),
  };
  useEffect(() => api.onMenu((cmd) => commands.current[cmd]()), []);

  // Keyboard: editing keys that are not menu accelerators.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const step = e.shiftKey ? 0.1 : 1;
      const arrows: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (arrows[e.key]) {
        e.preventDefault();
        viewport.current?.nudge(...arrows[e.key]);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected && (selected.kind === 'line' || selected.kind === 'end')) {
        history.update((p) => removeLine(p, selected.group, selected.line));
        setSelected(null);
      } else if (e.key === ']' || e.key === '[') {
        setLoupeZoom((z) => {
          const i = LOUPE_STEPS.indexOf(z) + (e.key === ']' ? 1 : -1);
          return LOUPE_STEPS[Math.max(0, Math.min(LOUPE_STEPS.length - 1, i))];
        });
      } else if (e.key === 'f' && !e.metaKey && !e.ctrlKey) {
        viewport.current?.fit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, history]);

  // Drop a photo anywhere on the window.
  useEffect(() => {
    const over = (e: DragEvent) => e.preventDefault();
    const drop = (e: DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer?.files[0];
      if (file) run(async () => loadPhoto(await api.readImage(api.pathForFile(file))));
    };
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, [run, loadPhoto]);

  const title = projectPath ? baseName(projectPath) : project.image ? `${baseName(project.image.path) ?? 'untitled'} (unsaved)` : 'No project';
  const stateColor = !result ? 'var(--text-faint)' : !result.ok ? 'var(--error)' : result.solution.warnings.length ? 'var(--warn)' : 'var(--ok)';
  const stateText = !result ? 'idle' : !result.ok ? 'no solution' : result.solution.warnings.length ? 'solved · check warnings' : 'solved';

  return (
    <div className="shell">
      <header className="topbar">
        <span className="wordmark">
          <Mark size={16} />
          FUGA
        </span>
        <span className="doc-title" data-dirty={history.dirty && !!project.image}>
          {title}
        </span>
        <span className="spacer" />
        {update && (
          <button type="button" className="update-pill" onClick={() => api.openExternal(update.url)} title="Open the release page to download">
            Fuga {update.version} available
          </button>
        )}
        <button type="button" className="btn ghost" aria-expanded={appearanceOpen} onClick={() => setAppearanceOpen((o) => !o)}>
          Appearance
        </button>
        <button type="button" className="btn ghost" disabled={!history.canUndo} onClick={() => history.undo()} title="Undo">
          Undo
        </button>
        <button type="button" className="btn ghost" disabled={!history.canRedo} onClick={() => history.redo()} title="Redo">
          Redo
        </button>
        {appearanceOpen && (
          <AppearancePanel
            appearance={appearance}
            resolved={theme}
            onChange={setAppearance}
            onClose={() => setAppearanceOpen(false)}
          />
        )}
      </header>

      <Viewport
        ref={viewport}
        history={history}
        project={project}
        result={result}
        image={image}
        display={display}
        loupeZoom={loupeZoom}
        selected={selected}
        onSelect={setSelected}
        onCursor={setCursor}
        onZoom={setZoom}
        paletteKey={`${theme}:${JSON.stringify(appearance.colors)}`}
      />
      {!project.image && (
        <div style={{ gridArea: 'view', position: 'relative' }}>
          <EmptyState onOpen={openPhoto} shortcut={api.platform === 'darwin' ? '⌘O' : 'Ctrl+O'} />
        </div>
      )}

      <Inspector
        history={history}
        project={project}
        result={result}
        display={display}
        onDisplay={setDisplay}
        onOpenImage={openPhoto}
        onExport={exportTo}
      />

      <footer className="statusbar">
        <span>
          x <span className="num">{cursor ? cursor[0].toFixed(1) : '—'}</span>
        </span>
        <span>
          y <span className="num">{cursor ? cursor[1].toFixed(1) : '—'}</span>
        </span>
        <span>
          zoom <span className="num">{Math.round(zoom * 100)}%</span>
        </span>
        <span>
          loupe <span className="num">×{loupeZoom}</span> <kbd>[</kbd> <kbd>]</kbd>
        </span>
        <span>
          <kbd>Shift</kbd> precise drag
        </span>
        {notice && <span style={{ color: 'var(--text)' }}>{notice}</span>}
        <span className="state" style={{ color: stateColor }}>
          <span className="num" style={{ color: 'var(--text-dim)', fontSize: 'var(--text-xs)', marginRight: 10 }}>
            v{api.version}
          </span>
          <span className="dot" />
          <span>{stateText}</span>
        </span>
      </footer>
    </div>
  );
}
