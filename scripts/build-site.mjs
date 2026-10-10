// Build the website into _site/ for GitHub Pages.
//   node scripts/build-site.mjs
// Copies site/ plus the brand assets, fonts, screenshot and user guide, and
// writes release.json with the latest published release so the Download page
// links straight to the newest installers. CI reruns this whenever a release
// is published (.github/workflows/pages.yml).
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '_site');
const REPO = 'fugaapp/fuga';

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, 'site'), out, { recursive: true });

const copy = (from, to) => cpSync(join(root, from), join(out, 'assets', to), { recursive: true });
copy('brand/fonts', 'fonts');
copy('brand/logo/fuga-favicon.svg', 'fuga-favicon.svg');
copy('brand/social-preview.png', 'social-preview.png');
copy('docs/guide/shots/main-dark.png', 'screenshot.png');
copy('docs/guide/Fuga-User-Guide.pdf', 'Fuga-User-Guide.pdf');

async function latestRelease() {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'fuga-site-build' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers });
  if (res.status === 404) return null; // nothing published yet
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const r = await res.json();
  return {
    version: String(r.tag_name).replace(/^v/, ''),
    url: r.html_url,
    publishedAt: r.published_at,
    assets: r.assets
      .filter((a) => /\.(exe|dmg|AppImage)$/.test(a.name))
      .map((a) => ({ name: a.name, size: a.size, url: a.browser_download_url })),
  };
}

let release = null;
try {
  release = await latestRelease();
} catch (e) {
  // Offline or rate-limited: the page asks GitHub itself at view time instead.
  console.warn(`Could not read the latest release (${e.message}); the page will look it up live.`);
}
writeFileSync(join(out, 'release.json'), JSON.stringify(release, null, 2) + '\n');
// Serve files as-is (no Jekyll processing on GitHub Pages).
writeFileSync(join(out, '.nojekyll'), '');
console.log(`Built _site/ — latest release: ${release ? release.version : 'none yet'}`);
