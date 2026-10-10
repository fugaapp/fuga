import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { Channels, type FugaApi, type MenuCommand } from '../shared/ipc';

const api: FugaApi = {
  platform: process.platform,
  // Synchronous once at startup, so the UI can show it without waiting.
  version: ipcRenderer.sendSync(Channels.version) as string,
  openImage: () => ipcRenderer.invoke(Channels.openImage),
  readImage: (path) => ipcRenderer.invoke(Channels.readImage, path),
  openProject: () => ipcRenderer.invoke(Channels.openProject),
  saveProject: (text, path) => ipcRenderer.invoke(Channels.saveProject, text, path),
  exportFile: (content, defaultName, extension) => ipcRenderer.invoke(Channels.exportFile, content, defaultName, extension),
  checkForUpdate: () => ipcRenderer.invoke(Channels.checkUpdate),
  openExternal: (url) => ipcRenderer.send(Channels.openExternal, url),
  setTheme: (theme) => ipcRenderer.send(Channels.setTheme, theme),
  pathForFile: (file) => webUtils.getPathForFile(file),
  onMenu: (listener) => {
    const handler = (_: unknown, command: MenuCommand) => listener(command);
    ipcRenderer.on(Channels.menu, handler);
    return () => ipcRenderer.off(Channels.menu, handler);
  },
};

contextBridge.exposeInMainWorld('fuga', api);
