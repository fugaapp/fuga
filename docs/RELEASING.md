# Releasing a new version

Everything here is free: GitHub Actions builds the installers, GitHub
Releases hosts them, and the app asks GitHub's public API whether a newer
release exists.

## How it fits together

```
you: npm version 0.2.0 ──▶ git push --follow-tags
                                   │
GitHub Actions (build.yml): tests → builds Windows / macOS / Linux installers
                                   │
                         draft GitHub Release with the installers
                                   │
you: review the draft, write notes, click "Publish release"
                                   │
every installed Fuga: "Fuga 0.2.0 available" pill in the top bar
                      → opens fugaapp.github.io/fuga/download.html
the website rebuilds itself, so its Download page lists the new installers
```

The app only *tells* the user; it never downloads or runs anything by itself.
It checks once, a few seconds after launch, and on *Help → Check for
Updates…*. Offline or rate-limited, it silently does nothing.

## Steps

1. Make sure the default branch is green (Actions tab).
2. Bump the version — this edits `package.json`, commits and tags:
   ```bash
   npm version patch   # 0.1.0 → 0.1.1  bug fixes
   npm version minor   # 0.1.0 → 0.2.0  new features
   npm version major   # 0.1.0 → 1.0.0  breaking changes (e.g. project format)
   ```
3. Push the commit and the tag:
   ```bash
   git push --follow-tags
   ```
4. Wait for the *Build* workflow (≈10 min). It refuses to run if the tag and
   `package.json` disagree.
5. On GitHub → *Releases*, open the new **draft**, write what changed, and
   click **Publish release**. Publishing also rebuilds the website
   (`.github/workflows/pages.yml`), so the Download page updates by itself. Only published releases trigger the update
   notice; drafts and pre-releases never do, so you can test safely.

## The website

`site/` is published to https://fugaapp.github.io/fuga/ by
`.github/workflows/pages.yml`. One-time setup: *Settings → Pages → Build and
deployment → Source: **GitHub Actions***. After that it redeploys on every
change to `site/`, `brand/` or the guide, and on every published release.

## Test builds without releasing

Every push builds installers too. Open the *Actions* tab → the latest
*Build* run → *Artifacts* at the bottom → `Fuga-windows-latest`,
`Fuga-macos-latest` or `Fuga-ubuntu-latest`. They are kept 14 days. (You
must be signed in to GitHub to download artifacts.)

## Unsigned installers: what users see

Code-signing certificates cost money, so the installers are unsigned (macOS
gets a free *ad-hoc* signature, which Apple Silicon needs to launch the app).
The first launch shows a warning once:

- **Windows** — "Windows protected your PC": click *More info → Run anyway*.
- **macOS** — "Fuga can't be opened…": open *System Settings → Privacy &
  Security*, scroll down and click *Open Anyway* (on older macOS: right-click
  the app → *Open*).
- **Linux** — make the AppImage executable (`chmod +x Fuga-*.AppImage`) and run it.

Free options to remove the Windows warning later: the
[SignPath Foundation](https://signpath.org/) signs open-source projects at no
cost. On macOS, removing the warning and enabling silent auto-install both
need the paid Apple Developer Program.
