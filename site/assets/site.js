// Fuga website: finds the latest release and points every download button at it.
//
// release.json is written by scripts/build-site.mjs each time the site is
// rebuilt — and the site rebuilds automatically whenever a release is
// published, so the Download page always shows the newest installers.
// If that file is missing, we ask GitHub directly. Before the first release,
// the page says so and the buttons stay disabled.

const REPO = 'fugaapp/fuga';

const PATTERNS = {
  win: /win.*\.exe$/i,
  macArm: /mac-arm64\.dmg$/i,
  macIntel: /mac-x64\.dmg$/i,
  linux: /linux.*\.AppImage$/i,
};

function detectOS() {
  const p = (navigator.userAgentData?.platform || navigator.platform || navigator.userAgent).toLowerCase();
  if (p.includes('win')) return 'windows';
  if (p.includes('mac') || p.includes('iphone') || p.includes('ipad')) return 'mac';
  if (p.includes('linux') || p.includes('x11')) return 'linux';
  return null;
}

const OS_LABEL = { windows: 'Windows', mac: 'macOS', linux: 'Linux' };

async function loadRelease() {
  try {
    const r = await fetch('release.json', { cache: 'no-cache' });
    if (r.ok) {
      const data = await r.json();
      if (data) return data;
    }
  } catch {}
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
    if (r.ok) {
      const j = await r.json();
      return {
        version: String(j.tag_name).replace(/^v/, ''),
        url: j.html_url,
        publishedAt: j.published_at,
        assets: j.assets.map((a) => ({ name: a.name, size: a.size, url: a.browser_download_url })),
      };
    }
  } catch {}
  return null;
}

const mb = (bytes) => `${Math.round(bytes / 1e6)} MB`;
const date = (iso) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

function wireButton(el, asset, release) {
  if (!release) return; // nothing published yet: buttons stay disabled
  el.removeAttribute('aria-disabled');
  if (asset) {
    el.href = asset.url;
    const size = el.querySelector('small');
    if (size) size.textContent = mb(asset.size);
  } else {
    el.href = release.url; // this file is missing from the release: show the release page
  }
}

async function main() {
  const os = detectOS();

  // Home page: "Download for <your OS>".
  for (const el of document.querySelectorAll('[data-os-label]')) {
    el.textContent = os ? `Download for ${OS_LABEL[os]}` : 'Download';
  }
  for (const el of document.querySelectorAll('[data-download-link]')) {
    el.href = os ? `download.html#${os}` : 'download.html';
  }

  // Download page: highlight your OS first.
  if (os) {
    const card = document.getElementById(os);
    if (card) {
      card.classList.add('detected');
      card.querySelector('.tag').textContent = 'Your system';
      card.parentElement.prepend(card);
    }
  }

  const release = await loadRelease();

  if (release) {
    for (const el of document.querySelectorAll('[data-version]')) el.textContent = `Version ${release.version}`;
  }
  const meta = document.querySelector('[data-release-meta]');
  if (meta && !release) meta.textContent = 'No version published yet.';
  if (meta && release) {
    meta.innerHTML = '';
    meta.append(`Version ${release.version}${release.publishedAt ? ` · released ${date(release.publishedAt)}` : ''} · `);
    const a = document.createElement('a');
    a.href = release.url;
    a.textContent = "what's new";
    meta.append(a);
  }
  const waiting = document.querySelector('[data-no-release]');
  if (waiting) waiting.hidden = !!release;

  for (const [key, re] of Object.entries(PATTERNS)) {
    const asset = release?.assets.find((a) => re.test(a.name));
    for (const el of document.querySelectorAll(`[data-asset="${key}"]`)) wireButton(el, asset, release);
  }
}

main();
