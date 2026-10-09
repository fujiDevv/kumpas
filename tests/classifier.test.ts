import { describe, it, expect } from "vitest";
import { predict, calibrate, overlaps } from "../lib/classifier";
import type { Phrase } from "../lib/types";
import { phrase } from "./fixtures";

describe("personal classifier", () => {
  it("accepts a known class and rejects distant observations", () => {
    expect(predict(Array(42).fill(0.005), "Right", [phrase()])?.id).toBe("a");
    expect(predict(Array(42).fill(1), "Right", [phrase()])).toBeNull();
  });
  it("rejects wrong hand and incompatible feature version", () => {
    expect(predict(Array(42).fill(0), "Left", [phrase()])).toBeNull();
    expect(
      predict(Array(42).fill(0), "Right", [{ ...phrase(), featureVersion: 2 }]),
    ).toBeNull();
  });
  it("rejects ties and overlapping enrolled poses", () => {
    expect(
      predict(Array(42).fill(0.005), "Right", [phrase("a"), phrase("b")]),
    ).toBeNull();
    expect(overlaps(phrase("a"), [phrase("b")])).toBe(true);
  });
  it("supports separate classes and one-class enrollment", () => {
    expect(overlaps(phrase("a"), [phrase("b", 1)])).toBe(false);
    expect(
      predict(Array(42).fill(1), "Right", [phrase("a"), phrase("b", 1)])?.id,
    ).toBe("b");
  });
  it("requires distinct enrollment sessions for calibration", () => {
    expect(() =>
      calibrate(phrase().examples.map((e) => ({ ...e, session: 0 }))),
    ).toThrow();
    expect(calibrate(phrase().examples)).toBeGreaterThan(0);
  });
});
