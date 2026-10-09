import { memo } from "react";
import { gesturePreview } from "../lib/gesture-preview";
import { handConnections } from "../lib/hand-connections";
import type { Phrase } from "../lib/types";

export const GesturePreview = memo(function GesturePreview({
  phrase,
}: {
  phrase: Phrase;
}) {
  const points = gesturePreview(phrase);
  if (!points)
    return (
      <span className="gesture-preview unavailable">
        Reteach
        <br />
        to preview
      </span>
    );
  return (
    <svg
      className="gesture-preview"
      viewBox="0 0 120 120"
      role="img"
      aria-label={`Saved ${phrase.hand.toLowerCase()} hand shape for ${phrase.text}`}
    >
      <title>{phrase.hand} hand · taught finger shape</title>
      <g stroke="#98452a" strokeWidth="2.5" strokeLinecap="round">
        {handConnections.map(([a, b]) => (
          <line
            key={`${a}-${b}`}
            x1={points[a].x}
            y1={points[a].y}
            x2={points[b].x}
            y2={points[b].y}
          />
        ))}
      </g>
      {points.map((point, i) => (
        <circle
          key={i}
          cx={point.x}
          cy={point.y}
          r={[4, 8, 12, 16, 20].includes(i) ? 3.6 : 2.5}
          fill="#b84318"
        />
      ))}
    </svg>
  );
});
