import { app, net } from 'electron';
import { GITHUB_REPO, isNewerVersion, type UpdateInfo } from '../shared/release';

/**
 * Ask GitHub for the latest published release. Free, no server of our own,
 * no signing certificate needed: the app only *tells* the user and opens the
 * release page; it never downloads or runs anything by itself.
 *
 * Returns null when up to date, offline, or rate-limited — an update check
 * must never get in the way of using the app.
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const res = await net.fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': `Fuga/${app.getVersion()}` },
    });
    if (!res.ok) return null;
    const release = (await res.json()) as { tag_name?: string; html_url?: string; draft?: boolean };
    if (!release.tag_name || !release.html_url || release.draft) return null;
    if (!isNewerVersion(release.tag_name, app.getVersion())) return null;
    return { version: release.tag_name.replace(/^v/, ''), url: release.html_url };
  } catch {
    return null;
  }
}
