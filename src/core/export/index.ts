import type { CameraSolution } from '../solver/types';
import { exportBlender } from './blender';
import { exportJson } from './json';
import { exportMaya } from './maya';
import type { ExportOptions } from './options';
import { exportUsd } from './usd';

export interface ExportTarget {
  readonly id: string;
  readonly label: string;
  readonly extension: string;
  readonly hint: string;
  readonly write: (cam: CameraSolution, opts: ExportOptions) => string;
}

export const EXPORT_TARGETS: readonly ExportTarget[] = [
  { id: 'blender', label: 'Blender', extension: 'py', hint: 'Text Editor → Run Script', write: exportBlender },
  { id: 'maya', label: 'Maya', extension: 'py', hint: 'Script Editor → Python', write: exportMaya },
  { id: 'usd', label: 'USD', extension: 'usda', hint: 'Houdini · C4D · Unreal', write: exportUsd },
  { id: 'json', label: 'JSON', extension: 'json', hint: 'Raw intrinsics + extrinsics', write: exportJson },
];

export type { ExportOptions };
