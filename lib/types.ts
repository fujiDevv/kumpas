export const FEATURE_VERSION = 2;
export type Hand = "Left" | "Right";
export type Point = { x: number; y: number; z?: number };
export type Example = { features: number[]; session: number };
export type Phrase = {
  id: string;
  text: string;
  audio: Blob;
  mime: string;
  durationMs: number;
  hand: Hand;
  examples: Example[];
  negatives?: number[][];
  maxDistance: number;
  minMargin: number;
  featureVersion: number;
  createdAt: number;
  updatedAt: number;
};
export type Observation = {
  features: number[];
  hand: Hand;
  points: Point[];
  ms: number;
} | null;
export type Prediction = {
  id: string;
  distance: number;
  margin: number;
} | null;
