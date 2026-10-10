import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, type MenuItemConstructorOptions } from 'electron';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { Channels, IMAGE_EXTENSIONS, type MenuCommand, type OpenedImage } from '../shared/ipc';
import { MADE_WITH_AI } from '../shared/about';
import { DOWNLOAD_PAGE, GITHUB_REPO } from '../shared/release';
import { loadPreferences, savePreferences } from './preferences';
import { hardenBeforeReady, hardenSession, openHttps, trustedSender } from './security';
import { checkForUpdate } from './updates';

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  gif: 'image/gif',
};
const MAX_IMAGE_BYTES = 512 * 1024 * 1024;
const MAX_TEXT_BYTES = 16 * 1024 * 1024;

let window: BrowserWindow | null = null;
const preferences = loadPreferences();

/**
 * Files the UI may write to without asking: only ones the user picked in a
 * native Open/Save dialog. A compromised renderer therefore cannot overwrite
 * arbitrary files — every new location goes through a dialog the user sees.
 */
const writable = new Set<string>();

function createWindow(): void {
  window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#171716' : '#f4f2ed',
    title: 'Fuga',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      // Chromium's spellchecker downloads dictionaries from Google; we have no free text to check.
      spellcheck: false,
      devTools: !app.isPackaged,
    },
  });
  window.once('ready-to-show', () => window?.show());
  if (process.env.ELECTRON_RENDERER_URL) void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void window.loadFile(join(import.meta.dirname, '../renderer/index.html'));
}

const isString = (v: unknown, max = 4096): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;

async function readImage(path: unknown): Promise<OpenedImage> {
  if (!isString(path) || !isAbsolute(path)) throw new Error('Invalid image path.');
  const ext = extname(path).slice(1).toLowerCase();
  if (!(IMAGE_EXTENSIONS as readonly string[]).includes(ext)) throw new Error(`Unsupported image type: .${ext}`);
  const info = await stat(path);
  if (!info.isFile()) throw new Error('Not a file.');
  if (info.size > MAX_IMAGE_BYTES) throw new Error('Image is larger than 512 MB.');
  const buffer = await readFile(path);
  // Copy into a standalone ArrayBuffer: Node buffers can be views into a shared pool.
  const bytes = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  return { path, bytes, mime: MIME[ext] };
}

/**
 * Store the photo path relative to the project file when both live on the
 * same drive: the project keeps working when the folder moves, and a shared
 * .fuga file does not reveal your user name or folder layout.
 */
function portableProject(text: string, target: string): string {
  try {
    const doc = JSON.parse(text) as { image?: { path?: unknown } };
    const p = doc.image?.path;
    if (typeof p === 'string' && isAbsolute(p) && parse(p).root === parse(target).root) {
      doc.image!.path = relative(dirname(target), p).split(sep).join('/');
      return JSON.stringify(doc, null, 2) + '\n';
    }
  } catch {
    // Not JSON we understand: save as given.
  }
  return text;
}

/** Register an IPC handler that ignores messages not coming from our own UI. */
function handle(channel: string, fn: (...args: unknown[]) => unknown): void {
  ipcMain.handle(channel, (e, ...args) => {
    if (!trustedSender(e)) throw new Error('Untrusted sender.');
    return fn(...args);
  });
}

function registerIpc(): void {
  handle(Channels.openImage, async () => {
    const r = await dialog.showOpenDialog(window!, {
      title: 'Open photo',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: [...IMAGE_EXTENSIONS] }],
    });
    return r.canceled ? null : readImage(r.filePaths[0]);
  });

  handle(Channels.readImage, (path) => readImage(path));

  handle(Channels.openProject, async () => {
    const r = await dialog.showOpenDialog(window!, {
      title: 'Open project',
      properties: ['openFile'],
      filters: [{ name: 'Fuga project', extensions: ['fuga'] }],
    });
    if (r.canceled) return null;
    const path = r.filePaths[0];
    if ((await stat(path)).size > MAX_TEXT_BYTES) throw new Error('Project file is too large.');
    writable.add(resolve(path));
    return { path, text: await readFile(path, 'utf8') };
  });

  handle(Channels.saveProject, async (text, path) => {
    if (!isString(text, MAX_TEXT_BYTES)) throw new Error('Invalid project data.');
    let target = isString(path) && writable.has(resolve(path)) ? resolve(path) : null;
    if (!target) {
      const r = await dialog.showSaveDialog(window!, {
        title: 'Save project',
        defaultPath: 'untitled.fuga',
        filters: [{ name: 'Fuga project', extensions: ['fuga'] }],
      });
      if (r.canceled || !r.filePath) return null;
      target = resolve(r.filePath);
      writable.add(target);
    }
    await writeFile(target, portableProject(text, target), 'utf8');
    window?.setRepresentedFilename(target);
    window?.setTitle(`${basename(target)} — Fuga`);
    return target;
  });

  handle(Channels.exportFile, async (content, defaultName, extension) => {
    if (!isString(content, MAX_TEXT_BYTES) || !isString(defaultName, 200) || !isString(extension, 10) || !/^[a-z]+$/.test(extension)) {
      throw new Error('Invalid export request.');
    }
    const r = await dialog.showSaveDialog(window!, {
      title: 'Export camera',
      defaultPath: `${defaultName.replace(/[\\/:*?"<>|]/g, '_')}.${extension}`,
      filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
    });
    if (r.canceled || !r.filePath) return null;
    await writeFile(r.filePath, content, 'utf8');
    return r.filePath;
  });

  handle(Channels.checkUpdate, (auto) => (auto === true && !preferences.autoUpdateCheck ? null : checkForUpdate()));

  ipcMain.on(Channels.openExternal, (e, url) => trustedSender(e) && openHttps(url));
  ipcMain.on(Channels.setTheme, (e, theme: unknown) => {
    if (trustedSender(e) && (theme === 'system' || theme === 'dark' || theme === 'light')) nativeTheme.themeSource = theme;
  });
  ipcMain.on(Channels.version, (e) => {
    e.returnValue = trustedSender(e) ? app.getVersion() : '';
  });
}

async function showAbout(): Promise<void> {
  const { response } = await dialog.showMessageBox(window!, {
    type: 'info',
    title: 'About Fuga',
    message: `Fuga ${app.getVersion()}`,
    detail:
      'Camera matching from a single photo. Free and open source (GPL-3.0-or-later).\n\n' +
      `${MADE_WITH_AI}\n\n` +
      'Inspired by fSpy by Per Gantelius.',
    buttons: ['OK', 'Website', 'Source code'],
    defaultId: 0,
    cancelId: 0,
  });
  if (response === 1) openHttps(DOWNLOAD_PAGE.replace(/download\.html$/, ''));
  if (response === 2) openHttps(`https://github.com/${GITHUB_REPO}`);
}

function buildMenu(): void {
  const send = (command: MenuCommand) => () => window?.webContents.send(Channels.menu, command);
  const isMac = process.platform === 'darwin';
  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Open Photo…', accelerator: 'CmdOrCtrl+O', click: send('open-image') },
        { label: 'Open Project…', accelerator: 'CmdOrCtrl+Shift+O', click: send('open-project') },
        { type: 'separator' },
        { label: 'Save Project', accelerator: 'CmdOrCtrl+S', click: send('save') },
        { label: 'Save Project As…', accelerator: 'CmdOrCtrl+Shift+S', click: send('save-as') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        // Undo lives in the document store, not in a text field, so route it ourselves.
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: send('undo') },
        { label: 'Redo', accelerator: isMac ? 'Cmd+Shift+Z' : 'Ctrl+Y', click: send('redo') },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Appearance…', accelerator: 'CmdOrCtrl+,', click: send('appearance') },
        { type: 'separator' },
        { label: 'Fit Photo', accelerator: 'CmdOrCtrl+0', click: send('zoom-fit') },
        { label: 'Actual Pixels', accelerator: 'CmdOrCtrl+1', click: send('zoom-100') },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(app.isPackaged ? [] : [{ role: 'toggleDevTools' as const }]),
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Check for Updates…', click: send('check-updates') },
        {
          label: 'Check for Updates Automatically',
          type: 'checkbox',
          checked: preferences.autoUpdateCheck,
          click: (item) => {
            preferences.autoUpdateCheck = item.checked;
            savePreferences(preferences);
          },
        },
        { type: 'separator' },
        { label: 'Release Notes', click: () => openHttps(`https://github.com/${GITHUB_REPO}/releases`) },
        { label: 'Privacy', click: () => openHttps(`https://github.com/${GITHUB_REPO}/blob/HEAD/PRIVACY.md`) },
        { label: 'Report a Problem', click: () => openHttps(`https://github.com/${GITHUB_REPO}/issues`) },
        { type: 'separator' },
        { label: 'About Fuga', click: () => void showAbout() },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

hardenBeforeReady();

app.whenReady().then(() => {
  hardenSession();
  registerIpc();
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
