// Main-process preferences, kept in the OS's per-user app-data folder.
// Contains no personal data: just switches.
import { app } from 'electron';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Preferences {
  /** Ask GitHub for a newer release on launch. Manual checks always work. */
  autoUpdateCheck: boolean;
}

const DEFAULTS: Preferences = { autoUpdateCheck: true };
const file = () => join(app.getPath('userData'), 'preferences.json');

export function loadPreferences(): Preferences {
  try {
    const raw = JSON.parse(readFileSync(file(), 'utf8')) as Partial<Preferences>;
    return { autoUpdateCheck: typeof raw.autoUpdateCheck === 'boolean' ? raw.autoUpdateCheck : DEFAULTS.autoUpdateCheck };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePreferences(p: Preferences): void {
  try {
    writeFileSync(file(), JSON.stringify(p, null, 2));
  } catch {
    // Read-only profile: the switch simply won't persist.
  }
}
