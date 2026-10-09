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
export function predict(
  f: number[],
  hand: Hand,
  phrases: Phrase[],
): Prediction {
  const ranked = phrases
    .filter((p) => p.hand === hand && p.featureVersion === FEATURE_VERSION)
    .map((p) => ({ phrase: p, d: classDistance(f, p.examples) }))
    .sort((a, b) => a.d - b.d);
  if (!ranked.length) return null;
  const best = ranked[0],
    runner = ranked[1]?.d ?? Infinity;
  const margin = runner - best.d;
  if (
    !Number.isFinite(best.d) ||
    best.d > Math.min(best.phrase.maxDistance, MAX_DISTANCE) ||
    margin < Math.max(best.phrase.minMargin, MIN_MARGIN) ||
    (Number.isFinite(runner) && best.d > runner * 0.8)
  )
    return null;
  const negatives = best.phrase.negatives ?? [];
  const negativeDistance = Math.min(...negatives.map((n) => distance(f, n)));
  if (negativeDistance <= best.d + 0.015) return null;
  return { id: best.phrase.id, distance: best.d, margin };
}
/** Test separation without mistaking poor self-recognition for a class collision. */
export function overlaps(candidate: Phrase, others: Phrase[]): boolean {
  return others
    .filter(
      (p) => p.hand === candidate.hand && p.featureVersion === FEATURE_VERSION,
    )
    .some((p) => {
      const ambiguous = (a: Phrase, b: Phrase) =>
        a.examples.filter((e) => {
          const own = classDistance(
            e.features,
            a.examples.filter((x) => x.session !== e.session),
          );
          const other = classDistance(e.features, b.examples);
          return (
            other <= Math.min(b.maxDistance, MAX_DISTANCE) &&
            (other - own < MIN_MARGIN || own > other * 0.8)
          );
        }).length / a.examples.length;
      return ambiguous(candidate, p) > 0.1 || ambiguous(p, candidate) > 0.1;
    });
}
