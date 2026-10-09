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
    points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
  )
    return null;
  const origin = points[0];
  const xy = points.map((p) => [
    (p.x - origin.x) * width,
    (p.y - origin.y) * height,
  ]);
  const [px, py] = xy[9];
  const scale = Math.hypot(px, py);
  if (scale < 5) return null;
  const angle = Math.atan2(py, px) + Math.PI / 2;
  const c = Math.cos(angle),
    s = Math.sin(angle);
  return xy.flatMap(([x, y]) => [
    (x * c + y * s) / scale,
    (-x * s + y * c) / scale,
  ]);
}
export function distance(a: number[], b: number[]): number {
  if (
    a.length !== 42 ||
    b.length !== a.length ||
    [...a, ...b].some((v) => !Number.isFinite(v))
  )
    return Infinity;
  return Math.sqrt(
    a.reduce((sum, v, i) => sum + (v - b[i]) ** 2, 0) / a.length,
  );
}
