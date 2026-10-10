// Process-wide hardening, applied before any window exists.
// Follows https://www.electronjs.org/docs/latest/tutorial/security
import { app, session, shell, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

/** Only ever hand https links to the OS — never file:// or custom schemes. */
export function openHttps(url: unknown): void {
  if (typeof url === 'string' && /^https:\/\/[^\s]+$/i.test(url)) void shell.openExternal(url);
}

/** The only host the app itself talks to (release check). */
const UPDATE_HOST = 'https://api.github.com/';

const devUrl = process.env.ELECTRON_RENDERER_URL ? new URL(process.env.ELECTRON_RENDERER_URL) : null;
const rendererDir = pathToFileURL(join(import.meta.dirname, '../renderer')).href;

/** True if an IPC message comes from our own UI, not from some other frame. */
export function trustedSender(e: IpcMainEvent | IpcMainInvokeEvent): boolean {
  const url = e.senderFrame?.url;
  if (!url) return false;
  if (devUrl && url.startsWith(devUrl.origin)) return true;
  return url.startsWith(rendererDir);
}

/** Is a renderer request local (bundled files, in-memory images, dev server)? */
function isLocal(url: string): boolean {
  if (/^(file|blob|data|devtools|chrome-extension):/i.test(url)) return true;
  if (!devUrl) return false;
  const u = new URL(url);
  return u.hostname === devUrl.hostname && u.port === devUrl.port;
}

/** Call before app 'ready'. */
export function hardenBeforeReady(): void {
  // Renderers are sandboxed per window (sandbox: true, Electron's default).
  // We deliberately do NOT call app.enableSandbox(): it also forces the sandbox
  // where the OS cannot provide it (e.g. AppImages on Ubuntu 24.04+), and then
  // removes the user's only workaround, --no-sandbox.

  app.on('web-contents-created', (_, contents) => {
    contents.on('will-attach-webview', (e) => e.preventDefault());
    contents.on('will-navigate', (e) => e.preventDefault());
    contents.on('will-redirect', (e) => e.preventDefault());
    contents.setWindowOpenHandler(({ url }) => {
      openHttps(url);
      return { action: 'deny' };
    });
  });
}

/** Call once app is 'ready' (sessions do not exist before), before any window. */
export function hardenSession(): void {
  const ses = session.defaultSession;

  // Chromium's spellchecker downloads dictionaries from Google; Fuga has no free text to check.
  ses.setSpellCheckerEnabled(false);

  // No camera, microphone, location, notifications, MIDI, clipboard reads… ever.
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);

  // Network firewall. The UI may only load local content; the main process may
  // only reach the GitHub releases API. Nothing else can leave the machine,
  // whatever a bug or a dependency tries to do.
  ses.webRequest.onBeforeRequest((details, callback) => {
    const fromRenderer = details.webContentsId !== undefined;
    const allowed = fromRenderer ? isLocal(details.url) : details.url.startsWith(UPDATE_HOST);
    callback({ cancel: !allowed });
  });
}
