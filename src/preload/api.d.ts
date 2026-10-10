import type { FugaApi } from '../shared/ipc';

declare global {
  interface Window {
    readonly fuga: FugaApi;
  }
}
