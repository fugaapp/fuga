/** Where releases are published. Keep in sync with `publish` in electron-builder.yml. */
export const GITHUB_REPO = 'fugaapp/fuga';

/** Beginner-friendly download page (site/download.html on GitHub Pages); always lists the newest installers. */
export const DOWNLOAD_PAGE = 'https://fugaapp.github.io/fuga/download.html';

export interface UpdateInfo {
  readonly version: string;
  /** Where the update notice sends people: the download page, which picks their system. */
  readonly url: string;
}

/**
 * True if `candidate` (e.g. "v0.3.0") is a newer release than `current`
 * ("0.2.1"). Plain major.minor.patch; pre-release tags never count as newer,
 * so a test build never nags stable users.
 */
export function isNewerVersion(candidate: string, current: string): boolean {
  const parse = (v: string) => {
    const m = /^v?(\d+)\.(\d+)\.(\d+)(-.+)?$/.exec(v.trim());
    return m ? { nums: [Number(m[1]), Number(m[2]), Number(m[3])], pre: !!m[4] } : null;
  };
  const a = parse(candidate);
  const b = parse(current);
  if (!a || !b || a.pre) return false;
  for (let i = 0; i < 3; i++) {
    if (a.nums[i] !== b.nums[i]) return a.nums[i] > b.nums[i];
  }
  // Same numbers: a stable release is newer than a pre-release of it.
  return b.pre;
}
