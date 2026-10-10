// Small, allocation-friendly vector helpers. Plain tuples keep the core
// free of classes so values serialize to JSON and compare easily in tests.

export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];

export const add3 = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub3 = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale3 = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot3 = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross3 = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const norm3 = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const normalize3 = (a: Vec3): Vec3 => scale3(a, 1 / norm3(a));

export const sub2 = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];
export const dot2 = (a: Vec2, b: Vec2): number => a[0] * b[0] + a[1] * b[1];
export const norm2 = (a: Vec2): number => Math.hypot(a[0], a[1]);
