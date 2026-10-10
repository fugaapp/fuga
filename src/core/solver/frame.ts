import type { Vec2 } from '../math/vec';

/**
 * Image coordinates in the whole app are pixels: origin at the top-left
 * corner of the image, x to the right, y down (the way every image editor
 * shows them).
 *
 * Internally the solver works in a *normalized* frame — centered on the
 * image, scaled so the longest side spans [-1, 1]. Mixing pixel values in
 * the thousands with values near 1 in the same products is a classic way
 * to lose digits (Hartley's normalization argument); normalizing first
 * keeps every intermediate quantity near unit size.
 */
export interface ImageSize {
  readonly width: number;
  readonly height: number;
}

export const normScale = (size: ImageSize): number => Math.max(size.width, size.height) / 2;

export const toNormalized = (p: Vec2, size: ImageSize): Vec2 => {
  const s = normScale(size);
  return [(p[0] - size.width / 2) / s, (p[1] - size.height / 2) / s];
};

export const toPixels = (p: Vec2, size: ImageSize): Vec2 => {
  const s = normScale(size);
  return [p[0] * s + size.width / 2, p[1] * s + size.height / 2];
};
