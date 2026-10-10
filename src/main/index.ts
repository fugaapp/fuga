import { app, BrowserWindow, dialog, ipcMain, Menu, shell, type MenuItemConstructorOptions } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { Channels, IMAGE_EXTENSIONS, type MenuCommand, type OpenedImage } from '../shared/ipc';
import { GITHUB_REPO } from '../shared/release';
import { checkForUpdate } from './updates';

/** Only ever hand https links to the OS — never file:// or custom schemes. */
function openHttps(url: string): void {
  if (/^https:\/\//i.test(url)) void shell.openExternal(url);
}

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  gif: 'image/gif',
};

let window: BrowserWindow | null = null;

function createWindow(): void {
  window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: '#121212',
    title: 'Fuga',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  window.once('ready-to-show', () => window?.show());
  // Never navigate away from the app; open external links in the browser.
  window.webContents.setWindowOpenHandler(({ url }) => {
    openHttps(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (e) => e.preventDefault());

  if (process.env.ELECTRON_RENDERER_URL) void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void window.loadFile(join(import.meta.dirname, '../renderer/index.html'));
}

async function readImage(path: string): Promise<OpenedImage> {
  const ext = extname(path).slice(1).toLowerCase();
  if (!(IMAGE_EXTENSIONS as readonly string[]).includes(ext)) throw new Error(`Unsupported image type: .${ext}`);
  const buffer = await readFile(path);
  // Copy into a standalone ArrayBuffer: Node buffers can be views into a shared pool.
  const bytes = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  return { path, bytes, mime: MIME[ext] };
}

function registerIpc(): void {
  ipcMain.handle(Channels.openImage, async () => {
    const r = await dialog.showOpenDialog(window!, {
      title: 'Open photo',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: [...IMAGE_EXTENSIONS] }],
    });
    return r.canceled ? null : readImage(r.filePaths[0]);
  });

  ipcMain.handle(Channels.checkUpdate, () => checkForUpdate());
  ipcMain.on(Channels.openExternal, (_, url: string) => openHttps(url));
  ipcMain.on(Channels.version, (e) => {
    e.returnValue = app.getVersion();
  });

  ipcMain.handle(Channels.readImage, (_, path: string) => readImage(path));

  ipcMain.handle(Channels.openProject, async () => {
    const r = await dialog.showOpenDialog(window!, {
      title: 'Open project',
      properties: ['openFile'],
      filters: [{ name: 'Fuga project', extensions: ['fuga'] }],
    });
    if (r.canceled) return null;
    return { path: r.filePaths[0], text: await readFile(r.filePaths[0], 'utf8') };
  });

  ipcMain.handle(Channels.saveProject, async (_, text: string, path: string | null) => {
    let target = path;
    if (!target) {
      const r = await dialog.showSaveDialog(window!, {
        title: 'Save project',
        defaultPath: 'untitled.fuga',
        filters: [{ name: 'Fuga project', extensions: ['fuga'] }],
      });
      if (r.canceled || !r.filePath) return null;
      target = r.filePath;
    }
    await writeFile(target, text, 'utf8');
    window?.setRepresentedFilename(target);
    window?.setTitle(`${basename(target)} — Fuga`);
    return target;
  });

  ipcMain.handle(Channels.exportFile, async (_, content: string, defaultName: string, extension: string) => {
    const r = await dialog.showSaveDialog(window!, {
      title: 'Export camera',
      defaultPath: `${defaultName}.${extension}`,
      filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
    });
    if (r.canceled || !r.filePath) return null;
    await writeFile(r.filePath, content, 'utf8');
    return r.filePath;
  });
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
        { label: 'Release Notes', click: () => openHttps(`https://github.com/${GITHUB_REPO}/releases`) },
        { label: 'Report a Problem', click: () => openHttps(`https://github.com/${GITHUB_REPO}/issues`) },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
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
