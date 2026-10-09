import { advance, type Activation } from "./activation";
import { inspectPose } from "./classifier";
import type { Observation, Phrase } from "./types";

/** Hold a continuously accepted phrase; natural pose variation is handled by the classifier. */
export function recognize(
  state: Activation,
  observation: Observation,
  phrases: Phrase[],
  now: number,
) {
  const match = observation
    ? inspectPose(observation.features, observation.hand, phrases)
    : { prediction: null, reason: "no-hand" as const };
  return {
    ...advance(state, match.prediction?.id ?? null, now),
    reason: match.reason,
  };
}
