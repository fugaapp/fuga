import type { UpdateInfo } from './release';

// The one contract between the Electron main process and the UI.
// The renderer is sandboxed (no Node), so every file-system touch goes through here.

export interface OpenedImage {
  readonly path: string;
  readonly bytes: ArrayBuffer;
  readonly mime: string;
}

export interface OpenedProject {
  readonly path: string;
  readonly text: string;
}

export type MenuCommand =
  | 'open-image'
  | 'open-project'
  | 'save'
  | 'save-as'
  | 'undo'
  | 'redo'
  | 'zoom-fit'
  | 'zoom-100'
  | 'check-updates'
  | 'appearance';

export interface FugaApi {
  readonly platform: string;
  readonly version: string;
  openImage(): Promise<OpenedImage | null>;
  readImage(path: string): Promise<OpenedImage>;
  openProject(): Promise<OpenedProject | null>;
  /** path null → "Save As" dialog. Resolves to the saved path, or null if cancelled. */
  saveProject(text: string, path: string | null): Promise<string | null>;
  exportFile(content: string, defaultName: string, extension: string): Promise<string | null>;
  /** Absolute path of a dropped file (Electron's webUtils). */
  pathForFile(file: File): string;
  /**
   * Latest release on GitHub if newer than this build, else null.
   * `auto` checks respect the user's "Check for Updates Automatically" switch.
   */
  checkForUpdate(auto: boolean): Promise<UpdateInfo | null>;
  /** Make native menus/dialogs follow the app theme. */
  setTheme(theme: 'system' | 'dark' | 'light'): void;
  /** Open an https URL in the default browser. */
  openExternal(url: string): void;
  onMenu(listener: (command: MenuCommand) => void): () => void;
}

export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'avif', 'bmp', 'gif'] as const;

export const Channels = {
  openImage: 'fuga:open-image',
  readImage: 'fuga:read-image',
  openProject: 'fuga:open-project',
  saveProject: 'fuga:save-project',
  exportFile: 'fuga:export-file',
  checkUpdate: 'fuga:check-update',
  openExternal: 'fuga:open-external',
  setTheme: 'fuga:set-theme',
  version: 'fuga:version',
  menu: 'fuga:menu',
} as const;
