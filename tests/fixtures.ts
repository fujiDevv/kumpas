import { FEATURE_VERSION, type Phrase } from "../lib/types";
export function phrase(id = "a", value = 0): Phrase {
  return {
    id,
    text: "Tubig",
    audio: new Blob(["voice"]),
    mime: "audio/webm",
    durationMs: 1000,
    hand: "Right",
    examples: Array.from({ length: 24 }, (_, i) => ({
      features: Array(63).fill(value + i * 0.0005),
      session: Math.floor(i / 8),
    })),
    negatives: Array.from({ length: 8 }, () => Array(63).fill(value + 3)),
    maxDistance: 0.085,
    minMargin: 0.035,
    featureVersion: FEATURE_VERSION,
    createdAt: 0,
    updatedAt: 0,
  };
}
