import type { Point } from "./types";
/** Isotropic coordinates, wrist origin, palm scale, in-plane rotation. */
export function features(
  points: Point[],
  width: number,
  height: number,
): number[] | null {
  if (
    points.length !== 21 ||
    width <= 0 ||
    height <= 0 ||
    points.some(
      (p) =>
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        !Number.isFinite(p.z ?? 0),
    )
  )
    return null;
  const origin = points[0];
  const xy = points.map((p) => [
    (p.x - origin.x) * width,
    (p.y - origin.y) * height,
  ]);
  const [px, py] = xy[9];
  const scale = Math.hypot(px, py);
  if (scale < 25) return null;
  const angle = Math.atan2(py, px) + Math.PI / 2;
  const c = Math.cos(angle),
    s = Math.sin(angle);
  return xy.flatMap(([x, y], i) => [
    (x * c + y * s) / scale,
    (-x * s + y * c) / scale,
    (((points[i].z ?? 0) - (origin.z ?? 0)) * width) / scale,
  ]);
}
export function distance(a: number[], b: number[]): number {
  if (
    a.length !== 63 ||
    b.length !== a.length ||
    [...a, ...b].some((v) => !Number.isFinite(v))
  )
    return Infinity;
  // A changed finger must not disappear in the average over all 21 landmarks.
  const rms = (indices: number[]) =>
    Math.sqrt(
      indices.reduce((sum, i) => sum + (a[i] - b[i]) ** 2, 0) / indices.length,
    );
  const fingers = Array.from({ length: 5 }, (_, finger) =>
    Array.from({ length: 12 }, (_, i) => (1 + finger * 4) * 3 + i),
  );
  return Math.max(
    rms(Array.from({ length: 63 }, (_, i) => i)),
    ...fingers.map(rms),
  );
}
