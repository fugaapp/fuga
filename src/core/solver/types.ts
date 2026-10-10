import type { Mat3 } from '../math/mat3';
import type { Vec2, Vec3 } from '../math/vec';
import type { ImageSize } from './frame';
import type { Segment, VanishingPoint } from './vanishing';

export type Axis = 'x' | 'y' | 'z';
export type SignedAxis = '+x' | '-x' | '+y' | '-y' | '+z' | '-z';
export type SolveMode = '1vp' | '2vp' | '3vp';

/**
 * Everything the solver needs, in pixel coordinates.
 *
 * Axis convention: the world is right-handed and Z-up (same as Blender).
 * `axes[i]` names the world axis that points *toward* vanishing point i,
 * i.e. away from the viewer along the drawn lines.
 */
export interface SolverInput {
  readonly image: ImageSize;
  readonly mode: SolveMode;
  /**
   * Line groups. 2vp/3vp: one group per vanishing point.
   * 1vp: group 0 converges to the single VP; group 1 holds one or more lines
   * along a second axis — their drawn direction (a → b) is the positive one.
   */
  readonly lines: readonly (readonly Segment[])[];
  readonly axes: readonly SignedAxis[];
  /** Pixels. null = image center. Ignored in 3vp, where it is solved for. */
  readonly principalPoint: Vec2 | null;
  /** Required in 1vp; with one VP the focal length cannot be recovered. */
  readonly focalLengthPx?: number;
  /** Pixel position of the world origin. */
  readonly origin: Vec2;
  /** Optional scale: `point` is the image of origin + distance · axis. */
  readonly reference?: { readonly axis: Axis; readonly distance: number; readonly point: Vec2 } | null;
  /** Origin-to-camera distance used when there is no reference. */
  readonly defaultDistance: number;
}

/**
 * Pinhole camera in the computer-vision convention:
 * x_cam = rotation · (X_world − position), camera x right, y down, z forward.
 * Exporters convert to each application's convention; nothing else should.
 */
export interface CameraSolution {
  readonly image: ImageSize;
  readonly focalPx: number;
  readonly principalPoint: Vec2;
  /** World → camera rotation; column k is world axis k expressed in camera space. */
  readonly rotation: Mat3;
  /** Camera center in world space. */
  readonly position: Vec3;
  readonly vanishingPoints: readonly VanishingPoint[];
  readonly fovDeg: { readonly horizontal: number; readonly vertical: number };
  readonly warnings: readonly string[];
}

export type SolveResult =
  | { readonly ok: true; readonly solution: CameraSolution }
  | { readonly ok: false; readonly error: string };
