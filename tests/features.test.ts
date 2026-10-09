import { describe, it, expect } from "vitest";
import { features, distance } from "../lib/features";
const hand = Array.from({ length: 21 }, (_, i) => ({
  x: 0.3 + Math.sin(i) * 0.05,
  y: 0.3 + i * 0.015,
}));
describe("hand geometry", () => {
  it("rejects missing and degenerate landmarks", () => {
    expect(features([], 640, 480)).toBeNull();
    expect(features(Array(21).fill({ x: 0.2, y: 0.2 }), 640, 480)).toBeNull();
  });
  it("is invariant to image translation and scale", () => {
    const a = features(hand, 640, 480)!;
    const b = features(
      hand.map((p) => ({ x: p.x * 1.5 + 0.1, y: p.y * 1.5 - 0.2 })),
      640,
      480,
    )!;
    expect(distance(a, b)).toBeLessThan(1e-10);
  });
  it("corrects aspect ratio before normalization", () => {
    const a = features(hand, 640, 480)!;
    const b = features(
      hand.map((p) => ({ ...p, x: p.x / 2 })),
      1280,
      480,
    )!;
    expect(distance(a, b)).toBeLessThan(1e-10);
  });
  it("normalizes in-plane rotation", () => {
    const rotated = hand.map((p) => ({
      x: (-p.y * 480) / 640,
      y: (p.x * 640) / 480,
    }));
    expect(
      distance(features(hand, 640, 480)!, features(rotated, 640, 480)!),
    ).toBeLessThan(1e-10);
  });
  it("rejects invalid feature distances", () => {
    expect(distance([1], [1])).toBe(Infinity);
    expect(distance(Array(42).fill(NaN), Array(42).fill(0))).toBe(Infinity);
  });
});
