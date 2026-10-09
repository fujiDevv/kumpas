import { distance } from "./features";
export type Capture = {
  anchor: number[] | null;
  last: number[] | null;
  since: number;
  at: number;
  sampledAt: number;
  samples: number[][];
};
export const emptyCapture = (): Capture => ({
  anchor: null,
  last: null,
  since: 0,
  at: 0,
  sampledAt: 0,
  samples: [],
});
/** Collect one continuous pose, rather than accumulating unrelated frames. */
export function collectFrame(
  state: Capture,
  f: number[] | null,
  now: number,
): Capture {
  if (!f || !Number.isFinite(distance(f, f))) return emptyCapture();
  if (
    !state.anchor ||
    now - state.at > 350 ||
    distance(state.anchor, f) > 0.045 ||
    distance(state.last!, f) > 0.035
  )
    return { ...emptyCapture(), anchor: f, last: f, since: now, at: now };
  const next = { ...state, last: f, at: now };
  if (
    now - state.since >= 400 &&
    now - state.sampledAt >= 150 &&
    state.samples.length < 8
  ) {
    next.samples = [...state.samples, f];
    next.sampledAt = now;
  }
  return next;
}
