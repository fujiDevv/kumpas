import { describe, it, expect } from "vitest";
import {
  advance,
  initialActivation,
  waitForRelease,
  type Activation,
} from "../lib/activation";
function hold(s: Activation, id: string, start: number, end: number) {
  let fire: string | null = null;
  for (let now = start; now <= end; now += 100) {
    const r = advance(s, id, now);
    s = r.state;
    if (r.fire) fire = r.fire;
  }
  return { s, fire };
}
describe("intentional speech gating", () => {
  it("requires a continuous hold", () => {
    expect(hold(initialActivation(), "a", 100, 600).fire).toBeNull();
    expect(hold(initialActivation(), "a", 100, 800).fire).toBe("a");
  });
  it("never repeats while a pose stays visible", () => {
    const first = hold(initialActivation(), "a", 100, 800);
    expect(hold(first.s, "a", 900, 3000).fire).toBeNull();
    expect(hold(first.s, "b", 900, 3000).fire).toBeNull();
  });
  it("requires sustained release before a repeated phrase", () => {
    let s = waitForRelease(800);
    for (let n = 900; n <= 1300; n += 100) s = advance(s, null, n).state;
    expect(s.phase).toBe("listening");
    expect(hold(s, "a", 1400, 2100).fire).toBe("a");
  });
  it("resets a hold on unknown, class changes, or stale frames", () => {
    let s = hold(initialActivation(), "a", 100, 600).s;
    expect(advance(s, "a", 1100).fire).toBeNull();
    s = advance(s, null, 700).state;
    expect(s.phase).toBe("listening");
    s = hold(initialActivation(), "a", 100, 600).s;
    expect(advance(s, "b", 700).progress).toBe(0);
  });
  it("cannot count a long missing gap as release", () => {
    let s = advance(waitForRelease(100), null, 200).state;
    s = advance(s, null, 1000).state;
    expect(s.phase).toBe("waiting");
  });
});
