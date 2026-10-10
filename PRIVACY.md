# Privacy

**Fuga collects nothing.** No analytics, no telemetry, no crash reports, no
accounts, no cookies, no ads. Your photos and projects never leave your
computer.

This is enforced in code, not just promised: the app's network layer
([`src/main/security.ts`](src/main/security.ts)) blocks every request except
one, described below. Anyone can verify this — the source is public.

## The one network request

To tell you when a new version exists, Fuga asks GitHub's public API
(`api.github.com/repos/gln11/gln/releases/latest`) a few seconds after launch
and when you choose *Help → Check for Updates…*.

- What is sent: a standard HTTPS request with `User-Agent: Fuga/<version>`.
  Nothing about you, your files or your usage.
- Who sees it: GitHub, which like any web server sees your IP address. See
  [GitHub's privacy statement](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement).
  The Fuga author receives nothing.
- How to turn it off: *Help → Check for Updates Automatically* (uncheck).
  Manual checks still work when you ask for them.

Everything else is blocked, including Chromium features that would otherwise
phone home (the spell-checker's dictionary downloads are disabled).

## What stays on your computer

| Data | Where | Why |
| --- | --- | --- |
| Photos you open | Wherever they already are | Fuga reads them; it never copies or uploads them |
| `.fuga` projects | Where you save them | The photo is referenced by a path **relative** to the project, so a shared project does not reveal your user name or folder layout |
| Exported cameras (`.py`, `.usda`, `.json`) | Where you save them | Blender/Maya/JSON exports contain the photo's **full path**, so the 3D app can load it as a background. Check it before sharing an export publicly |
| Theme and colours | The app's local storage | Your appearance choice |
| `preferences.json` | Your OS's per-user app-data folder | The automatic-update-check switch |

Fuga asks for no system permissions: camera, microphone, location,
notifications and similar requests are refused automatically.

## Downloads

Installers come only from this repository's
[Releases page](https://github.com/gln11/gln/releases), built by GitHub
Actions from the public source. Each release carries a signed
[build provenance attestation](https://docs.github.com/actions/security-for-github-actions/using-artifact-attestations)
proving which commit and workflow produced it:

```bash
gh attestation verify Fuga-0.2.0-win-x64.exe --repo gln11/gln
```
