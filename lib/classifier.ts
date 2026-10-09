import { distance } from "./features";
import {
  FEATURE_VERSION,
  type Example,
  type Hand,
  type Phrase,
  type Prediction,
} from "./types";
export function classDistance(f: number[], examples: Example[]) {
  const ds = examples
    .map((e) => distance(f, e.features))
    .sort((a, b) => a - b)
    .slice(0, 3);
  return ds.length ? ds.reduce((a, b) => a + b, 0) / ds.length : Infinity;
}
export function calibrate(examples: Example[]): number {
  const errors = examples
    .map((e) =>
      classDistance(
        e.features,
        examples.filter((p) => p.session !== e.session),
      ),
    )
    .filter(Number.isFinite);
  if (!errors.length)
    throw new Error("Collect separate attempts before testing.");
  errors.sort((a, b) => a - b);
  return Math.min(
    0.3,
    Math.max(0.085, errors[Math.floor((errors.length - 1) * 0.95)] * 1.6),
  );
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
    margin = ranked.length > 1 ? ranked[1].d - best.d : Infinity;
  if (best.d > best.phrase.maxDistance || margin < best.phrase.minMargin)
    return null;
  return { id: best.phrase.id, distance: best.d, margin };
}
export function overlaps(candidate: Phrase, others: Phrase[]): boolean {
  return (
    candidate.examples.some(
      (e) =>
        predict(e.features, candidate.hand, [candidate, ...others])?.id !==
        candidate.id,
    ) ||
    others
      .filter((p) => p.hand === candidate.hand)
      .some((p) =>
        p.examples.some(
          (e) => predict(e.features, p.hand, [p, candidate])?.id !== p.id,
        ),
      )
  );
}
