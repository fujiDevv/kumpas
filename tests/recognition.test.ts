import { describe, expect, it } from "vitest";
import { initialActivation } from "../lib/activation";
import { recognize } from "../lib/recognition";
import type { Observation } from "../lib/types";
import { phrase } from "./fixtures";

const observation = (
  value = 0.01,
  hand: "Right" | "Left" = "Right",
): Observation => ({
  features: Array(63).fill(value),
  hand,
  points: [],
  ms: 10,
});

describe("communication recognition", () => {
  it("recognizes a held phrase despite natural variation inside its accepted boundary", () => {
    let state = initialActivation();
    let fires = 0;
    for (let now = 100; now <= 2000; now += 100) {
      // Both poses match; their movement exceeded the old additional stillness gate.
      const next = recognize(
        state,
        observation(now % 200 ? 0.01 : 0.07),
        [phrase()],
        now,
      );
      state = next.state;
      if (next.fire) fires++;
    }
    expect(fires).toBe(1);
    expect(state.phase).toBe("waiting");
  });

  it("resets the hold when the hand disappears or the pose is rejected", () => {
    for (const rejected of [null, observation(1), observation(0.01, "Left")]) {
      let state = initialActivation();
      for (let now = 100; now <= 600; now += 100)
        state = recognize(state, observation(), [phrase()], now).state;
      const reset = recognize(state, rejected, [phrase()], 700);
      expect(reset.progress).toBe(0);
      expect(reset.state.phase).toBe("listening");
      expect(
        recognize(reset.state, observation(), [phrase()], 800).fire,
      ).toBeNull();
    }
  });

  it("explains wrong-hand, distant, ambiguous, and relaxed-pose rejections", () => {
    const state = initialActivation();
    expect(
      recognize(state, observation(0.01, "Left"), [phrase()], 100).reason,
    ).toBe("wrong-hand");
    expect(recognize(state, observation(1), [phrase()], 100).reason).toBe(
      "different-pose",
    );
    expect(
      recognize(state, observation(), [phrase("a"), phrase("b")], 100).reason,
    ).toBe("ambiguous");
    expect(
      recognize(
        state,
        observation(0.035),
        [{ ...phrase(), negatives: [Array(63).fill(0.035)] }],
        100,
      ).reason,
    ).toBe("relaxed-pose");
  });

  it("requires release after activation, then allows the next held phrase", () => {
    let state = initialActivation();
    for (let now = 100; now <= 800; now += 100)
      state = recognize(state, observation(), [phrase()], now).state;
    expect(state.phase).toBe("waiting");
    for (let now = 900; now <= 1300; now += 100)
      state = recognize(state, null, [phrase()], now).state;
    expect(state.phase).toBe("listening");
    let fire: string | null = null;
    for (let now = 1400; now <= 2100; now += 100) {
      const next = recognize(state, observation(), [phrase()], now);
      state = next.state;
      fire = next.fire;
    }
    expect(fire).toBe("a");
  });
});
