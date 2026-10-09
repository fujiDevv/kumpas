export type Activation = {
  phase: "listening" | "holding" | "waiting";
  id: string | null;
  since: number;
  last: number;
  release: number | null;
};
export const initialActivation = (): Activation => ({
  phase: "listening",
  id: null,
  since: 0,
  last: 0,
  release: null,
});
export function advance(
  state: Activation,
  id: string | null,
  now: number,
  holdMs = 700,
  releaseMs = 400,
): { state: Activation; fire: string | null; progress: number } {
  const gap = state.last > 0 && now - state.last > 350;
  let s = { ...state, last: now };
  if (s.phase === "waiting") {
    if (id !== null || gap) s.release = null;
    if (id === null) {
      if (s.release === null) s.release = now;
      if (now - s.release >= releaseMs)
        s = { ...initialActivation(), last: now };
    }
    return { state: s, fire: null, progress: 0 };
  }
  if (!id)
    return {
      state: { ...initialActivation(), last: now },
      fire: null,
      progress: 0,
    };
  if (gap || s.id !== id || s.phase !== "holding")
    s = { ...s, phase: "holding", id, since: now };
  const progress = Math.min(1, (now - s.since) / holdMs);
  if (progress >= 1)
    return {
      state: { ...s, phase: "waiting", release: null },
      fire: id,
      progress: 1,
    };
  return { state: s, fire: null, progress };
}
export function waitForRelease(now: number): Activation {
  return { phase: "waiting", id: null, since: now, last: now, release: null };
}
