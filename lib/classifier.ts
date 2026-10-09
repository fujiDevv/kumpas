import { distance } from "./features";
import {
  FEATURE_VERSION,
  type Example,
  type Hand,
  type Phrase,
  type Prediction,
} from "./types";

export const MIN_MARGIN = 0.02;
export const MAX_DISTANCE = 0.18;
/** Each separate attempt gets one vote; adjacent frames are not independent votes. */
export function classDistance(f: number[], examples: Example[]) {
  const sessions = [...new Set(examples.map((e) => e.session))];
  const scores = sessions
    .map((session) => {
      const ds = examples
        .filter((e) => e.session === session)
        .map((e) => distance(f, e.features))
        .sort((a, b) => a - b)
        .slice(0, 3);
      return ds.reduce((a, b) => a + b, 0) / ds.length;
    })
    .sort((a, b) => a - b);
  // Require support from at least two independently collected attempts.
  return scores.length >= 2 ? scores[1] : Infinity;
}
export function calibrate(examples: Example[]): number {
  if (new Set(examples.map((e) => e.session)).size < 3)
    throw new Error("Collect three separate attempts before testing.");
  const errors = examples.map((e) =>
    classDistance(
      e.features,
      examples.filter((p) => p.session !== e.session),
    ),
  );
  errors.sort((a, b) => a - b);
  const q95 = errors[Math.floor((errors.length - 1) * 0.95)];
  if (!Number.isFinite(q95) || q95 > 0.12)
    throw new Error(
      "Your three attempts differ too much. Collect the same steady pose each time, with the same palm direction.",
    );
  return Math.min(MAX_DISTANCE, Math.max(0.025, q95 * 1.35 + 0.01));
}
export type MatchReason =
  | "matched"
  | "no-phrases"
  | "reteach"
  | "wrong-hand"
  | "different-pose"
  | "ambiguous"
  | "relaxed-pose";
export function inspectPose(
  f: number[],
  hand: Hand,
  phrases: Phrase[],
): { prediction: Prediction; reason: MatchReason } {
  const ranked = phrases
    .filter((p) => p.hand === hand && p.featureVersion === FEATURE_VERSION)
    .map((p) => ({ phrase: p, d: classDistance(f, p.examples) }))
    .sort((a, b) => a.d - b.d);
  if (!ranked.length)
    return {
      prediction: null,
      reason: !phrases.length
        ? "no-phrases"
        : !phrases.some((p) => p.featureVersion === FEATURE_VERSION)
          ? "reteach"
          : "wrong-hand",
    };
  const best = ranked[0],
    runner = ranked[1]?.d ?? Infinity;
  const margin = runner - best.d;
  if (
    !Number.isFinite(best.d) ||
    best.d > Math.min(best.phrase.maxDistance, MAX_DISTANCE)
  )
    return { prediction: null, reason: "different-pose" };
  if (
    margin < Math.max(best.phrase.minMargin, MIN_MARGIN) ||
    (Number.isFinite(runner) && best.d > runner * 0.8)
  )
    return { prediction: null, reason: "ambiguous" };
  const negatives = best.phrase.negatives ?? [];
  const negativeDistance = Math.min(...negatives.map((n) => distance(f, n)));
  if (negativeDistance <= best.d + 0.015)
    return { prediction: null, reason: "relaxed-pose" };
  return {
    prediction: { id: best.phrase.id, distance: best.d, margin },
    reason: "matched",
  };
}
export function predict(
  f: number[],
  hand: Hand,
  phrases: Phrase[],
): Prediction {
  return inspectPose(f, hand, phrases).prediction;
}
/** Use the same classifier as communication. A collision must persist across attempts. */
export function overlaps(candidate: Phrase, others: Phrase[]): boolean {
  const compatible = others.filter(
    (p) => p.hand === candidate.hand && p.featureVersion === FEATURE_VERSION,
  );
  const conflicts = (a: Phrase, b: Phrase) => {
    const sessions = [...new Set(a.examples.map((e) => e.session))];
    const conflictingSessions = sessions.filter((session) => {
      const examples = a.examples.filter((e) => e.session === session);
      const usable = examples.filter(
        (e) => predict(e.features, a.hand, [a])?.id === a.id,
      );
      if (!usable.length) return false;
      const ambiguous = usable.filter(
        (e) => predict(e.features, a.hand, [a, b])?.id !== a.id,
      );
      return ambiguous.length / usable.length >= 0.5;
    });
    // One unusual attempt should lead to the fresh live test, not a blanket rejection.
    return conflictingSessions.length >= 2;
  };
  return compatible.some(
    (p) => conflicts(candidate, p) || conflicts(p, candidate),
  );
}

/** A neutral example must not disable any previously accepted positive attempt. */
export function negativesPreserveGesture(
  phrase: Phrase,
  negatives: number[][],
  testedFeatures: number[][] = [],
): boolean {
  const baseline = { ...phrase, negatives: [] };
  const updated = { ...phrase, negatives };
  if (
    testedFeatures.some(
      (f) => predict(f, phrase.hand, [updated])?.id !== phrase.id,
    )
  )
    return false;
  const sessions = [...new Set(phrase.examples.map((e) => e.session))];
  return sessions.every((session) => {
    const accepted = phrase.examples.filter(
      (e) =>
        e.session === session &&
        predict(e.features, phrase.hand, [baseline])?.id === phrase.id,
    );
    return (
      accepted.length > 0 &&
      accepted.every(
        (e) => predict(e.features, phrase.hand, [updated])?.id === phrase.id,
      )
    );
  });
}
