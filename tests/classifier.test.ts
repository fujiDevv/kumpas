import { describe, it, expect } from "vitest";
import { predict, calibrate, overlaps } from "../lib/classifier";
import type { Phrase } from "../lib/types";
import { phrase } from "./fixtures";

describe("personal classifier", () => {
  it("accepts a known class and rejects distant observations", () => {
    expect(predict(Array(63).fill(0.005), "Right", [phrase()])?.id).toBe("a");
    expect(predict(Array(63).fill(1), "Right", [phrase()])).toBeNull();
  });
  it("rejects wrong hand and incompatible feature version", () => {
    expect(predict(Array(63).fill(0), "Left", [phrase()])).toBeNull();
    expect(
      predict(Array(63).fill(0), "Right", [{ ...phrase(), featureVersion: 1 }]),
    ).toBeNull();
  });
  it("rejects ties and overlapping enrolled poses", () => {
    expect(
      predict(Array(63).fill(0.005), "Right", [phrase("a"), phrase("b")]),
    ).toBeNull();
    expect(overlaps(phrase("a"), [phrase("b")])).toBe(true);
  });
  it("supports separate classes and one-class enrollment", () => {
    expect(overlaps(phrase("a"), [phrase("b", 1)])).toBe(false);
    expect(
      predict(Array(63).fill(1), "Right", [phrase("a"), phrase("b", 1)])?.id,
    ).toBe("b");
  });
  it("requires distinct enrollment sessions for calibration", () => {
    expect(() =>
      calibrate(phrase().examples.map((e) => ({ ...e, session: 0 }))),
    ).toThrow();
    expect(calibrate(phrase().examples)).toBeGreaterThan(0);
  });
});

describe("strict unknown rejection", () => {
  it("cannot enlarge its boundary with an old broad threshold", () => {
    expect(
      predict(Array(63).fill(0.22), "Right", [
        { ...phrase(), maxDistance: 0.9 },
      ]),
    ).toBeNull();
  });
  it("rejects a pose supported by only one capture attempt", () => {
    const p = phrase();
    p.examples = p.examples.map((e) => ({
      ...e,
      features: Array(63).fill(e.session === 0 ? 0 : 0.8),
    }));
    expect(predict(Array(63).fill(0), "Right", [p])).toBeNull();
    expect(() => calibrate(p.examples)).toThrow(/differ too much/);
  });
  it("does not mistake inconsistent examples for overlap with a distant phrase", () => {
    const p = phrase();
    p.examples = p.examples.map((e) => ({
      ...e,
      features: Array(63).fill(e.session === 0 ? 0 : 0.5),
    }));
    expect(overlaps(p, [phrase("b", 2)])).toBe(false);
  });
  it("rejects a neutral pose captured during enrollment", () => {
    const p = { ...phrase(), negatives: [Array(63).fill(0.035)] };
    expect(predict(Array(63).fill(0.035), "Right", [p])).toBeNull();
    expect(predict(Array(63).fill(0.005), "Right", [p])?.id).toBe("a");
  });
  it("rejects near ties using relative separation, even with an absolute margin", () => {
    const a = { ...phrase("a", 0), maxDistance: 0.18, minMargin: 0.02 };
    const b = { ...phrase("b", 0.32), maxDistance: 0.18, minMargin: 0.02 };
    expect(predict(Array(63).fill(0.153), "Right", [a, b])).toBeNull();
  });
});
