import { describe, expect, it } from "vitest";
import { collectFrame, emptyCapture } from "../lib/capture";
const pose = (v: number) => Array(63).fill(v);
describe("continuous enrollment capture", () => {
  it("waits for settling before collecting eight spaced frames", () => {
    let s = emptyCapture();
    for (let t = 0; t <= 300; t += 100) s = collectFrame(s, pose(0), t);
    expect(s.samples).toHaveLength(0);
    for (let t = 400; t <= 1800; t += 100) s = collectFrame(s, pose(0), t);
    expect(s.samples).toHaveLength(8);
  });
  it("discards a partial attempt on movement, missing hand or frame gaps", () => {
    let s = emptyCapture();
    for (let t = 0; t <= 900; t += 100) s = collectFrame(s, pose(0), t);
    expect(s.samples.length).toBeGreaterThan(0);
    expect(collectFrame(s, pose(0.2), 1000).samples).toHaveLength(0);
    expect(collectFrame(s, null, 1000).samples).toHaveLength(0);
    expect(collectFrame(s, pose(0), 1400).samples).toHaveLength(0);
  });
  it("restarts if gradual drift leaves the original pose", () => {
    let s = emptyCapture();
    for (let t = 0; t <= 700; t += 100) s = collectFrame(s, pose(t / 10000), t);
    expect(s.samples).toHaveLength(0);
  });
});
