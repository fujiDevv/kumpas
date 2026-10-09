import { classDistance } from "./classifier";
import { FEATURE_VERSION, type Phrase } from "./types";

/** Draw a real representative enrollment sample, with the same mirror as the camera. */
export function gesturePreview(phrase: Phrase) {
  if (phrase.featureVersion !== FEATURE_VERSION) return null;
  const examples = phrase.examples.filter(
    (e) => e.features.length === 63 && e.features.every(Number.isFinite),
  );
  if (!examples.length) return null;
  const sample = [...examples].sort(
    (a, b) =>
      classDistance(a.features, examples) - classDistance(b.features, examples),
  )[0].features;
  const points = Array.from({ length: 21 }, (_, i) => ({
    x: -sample[i * 3],
    y: sample[i * 3 + 1],
  }));
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y);
  const left = Math.min(...xs),
    top = Math.min(...ys);
  const width = Math.max(...xs) - left,
    height = Math.max(...ys) - top;
  const extent = Math.max(width, height);
  if (extent < 0.001) return null;
  const scale = 96 / extent;
  return points.map((p) => ({
    x: 12 + (96 - width * scale) / 2 + (p.x - left) * scale,
    y: 12 + (96 - height * scale) / 2 + (p.y - top) * scale,
  }));
}
