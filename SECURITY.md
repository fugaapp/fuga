# Security

## Reporting a vulnerability

Please **do not open a public issue** for a security problem. Report it
privately through GitHub: *Security* tab → *Report a vulnerability*
([direct link](https://github.com/fuga-app/fuga/security/advisories/new)).
You will get a reply as soon as possible; fixes ship as a new release and
the app tells every user about it.

Only the latest release is supported.

## How Fuga protects its users

Fuga is a desktop app built on Electron. It follows the
[Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security):

| Measure | Where |
| --- | --- |
| Renderer sandboxed, context isolation on, no Node.js in the UI | `src/main/index.ts` |
| Strict Content-Security-Policy: only the app's own scripts, no remote code, no plugins, no frames | `src/renderer/index.html` |
| Network firewall: the UI can only load local files; the app can only reach the GitHub releases API | `src/main/security.ts` |
| All permission requests (camera, mic, location, notifications…) refused | `src/main/security.ts` |
| No navigation, no new windows, no `<webview>`; external links open in your browser and only if `https://` | `src/main/security.ts` |
| Every IPC message checked to come from the app's own UI; arguments type- and size-checked | `src/main/index.ts` |
| The UI cannot write files where you have not chosen to: any new location goes through a native Save dialog | `src/main/index.ts` |
| Project files are fully validated; a damaged or hostile `.fuga` can only produce an error message | `src/core/project/schema.ts` (+ tests) |
| Exported scripts embed names and paths as escaped string literals — a crafted file name cannot inject code into Blender or Maya | `src/core/export/*` (+ tests) |
| Electron fuses: no run-as-Node, no `NODE_OPTIONS` / `--inspect` injection, app code only from the integrity-checked archive | `electron-builder.yml` |
| DevTools disabled in released builds | `src/main/index.ts` |
| Spell-checker and other Chromium phone-home features off | `src/main/security.ts` |

Known, accepted limits: installers are not code-signed with a paid
certificate (see [docs/RELEASING.md](docs/RELEASING.md)), and the UI is
loaded from `file://` rather than a custom protocol.

## How the project protects itself (supply chain)

- **Pinned dependencies.** Exact versions plus `package-lock.json`; CI installs with `npm ci`.
- **Audited.** CI fails if a shipped dependency has a high-severity advisory (`npm audit --omit=dev`).
- **Automatic updates.** Dependabot opens weekly grouped PRs for npm packages and GitHub Actions.
- **Pinned CI actions.** Every GitHub Action is pinned to a full commit SHA.
- **Least-privilege CI.** The token is read-only except in the job that publishes releases, and checkout leaves no credentials on disk.
- **Provenance.** Release installers carry a signed attestation linking them to the exact commit and workflow.
- **No secrets in the repo.** `.gitignore` blocks `.env` files and certificate files; publishing uses only GitHub's short-lived automatic token.

## Maintainer checklist (GitHub settings)

These are account and repository settings, so they can only be switched on
by the owner, in the GitHub web interface:

- [ ] Two-factor authentication on the GitHub account (*Settings → Password and authentication*).
- [ ] Keep your email private: *Settings → Emails* → "Keep my email addresses private" and "Block command line pushes that expose my email". Then commit with your `…@users.noreply.github.com` address.
- [ ] *Repository → Settings → Code security*: enable **Private vulnerability reporting**, **Dependabot alerts**, **Secret scanning** and **Push protection** (all free for public repositories).
- [ ] *Settings → Branches*: protect the default branch (require the *Build* check to pass, block force pushes).
- [ ] *Settings → Actions → General*: "Read repository contents permission" as the default workflow permission.
