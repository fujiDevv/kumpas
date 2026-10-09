import { describe, expect, it } from "vitest";
import { gesturePreview } from "../lib/gesture-preview";
import { phrase } from "./fixtures";

const saved = () => ({
  ...phrase(),
  examples: phrase().examples.map((e) => ({
    ...e,
    features: Array.from({ length: 21 }, (_, i) => [i / 20, -i / 10, 0]).flat(),
  })),
});

describe("saved gesture diagrams", () => {
  it("fits all 21 dots without distorting their proportions and mirrors like the camera", () => {
    const points = gesturePreview(saved())!;
    expect(points).toHaveLength(21);
    expect(
      points.every((p) => p.x >= 12 && p.x <= 108 && p.y >= 12 && p.y <= 108),
    ).toBe(true);
    expect(points[0].x).toBeGreaterThan(points[20].x);
    expect(points[0].y).toBeGreaterThan(points[20].y);
    expect(
      Math.abs((points[20].x - points[0].x) / (points[20].y - points[0].y)),
    ).toBeCloseTo(0.5);
  });
  it("does not invent a diagram for old, missing, invalid, or degenerate examples", () => {
    expect(gesturePreview({ ...saved(), featureVersion: 1 })).toBeNull();
    expect(gesturePreview({ ...saved(), examples: [] })).toBeNull();
    expect(
      gesturePreview({
        ...saved(),
        examples: [{ session: 0, features: Array(63).fill(NaN) }],
      }),
    ).toBeNull();
    expect(
      gesturePreview({
        ...saved(),
        examples: [{ session: 0, features: Array(63).fill(0) }],
      }),
    ).toBeNull();
  });
});
