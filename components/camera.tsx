"use client";
import { useEffect, useRef, useState } from "react";
import { startVision, type CameraSession } from "../lib/vision";
import type { Observation } from "../lib/types";
import { handConnections } from "../lib/hand-connections";
export function Camera({
  onObservation,
  onError,
  onReady,
  onStart,
}: {
  onObservation: (o: Observation) => void;
  onError: (message: string) => void;
  onReady?: (ready: boolean) => void;
  onStart?: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const callback = useRef(onObservation),
    error = useRef(onError);
  const readyCallback = useRef(onReady);
  readyCallback.current = onReady;
  callback.current = onObservation;
  error.current = onError;
  const [enabled, setEnabled] = useState(false),
    [status, setStatus] = useState("Camera paused"),
    [loading, setLoading] = useState(false);
  const [ms, setMs] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled || !video.current) return;
    let canceled = false,
      session: CameraSession | undefined;
    const controller = new AbortController();
    setLoading(true);
    setStatus("Starting camera…");
    startVision(
      video.current,
      (o) => {
        if (canceled) return;
        const cv = canvas.current,
          ctx = cv?.getContext("2d");
        if (cv && ctx) {
          ctx.clearRect(0, 0, cv.width, cv.height);
          if (o) {
            ctx.strokeStyle = "#f4ad79";
            ctx.fillStyle = "#fff3dc";
            ctx.lineWidth = 3;
            for (const [a, b] of handConnections) {
              ctx.beginPath();
              ctx.moveTo(o.points[a].x * cv.width, o.points[a].y * cv.height);
              ctx.lineTo(o.points[b].x * cv.width, o.points[b].y * cv.height);
              ctx.stroke();
            }
            for (const p of o.points) {
              ctx.beginPath();
              ctx.arc(p.x * cv.width, p.y * cv.height, 4, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
        if (o) setMs(Math.round(o.ms));
        callback.current(o);
      },
      (s) => {
        if (!canceled) setStatus(s);
      },
      (message) => {
        if (!canceled) {
          error.current(message);
          setEnabled(false);
        }
      },
      controller.signal,
    )
      .then((s) => {
        if (canceled) s.stop();
        else {
          session = s;
          setLoading(false);
          readyCallback.current?.(true);
        }
      })
      .catch((e) => {
        if (!canceled) {
          setEnabled(false);
          setLoading(false);
          error.current(e instanceof Error ? e.message : "Camera unavailable.");
        }
      });
    return () => {
      canceled = true;
      readyCallback.current?.(false);
      controller.abort();
      session?.stop();
      callback.current(null);
      setLoading(false);
      setMs(null);
    };
  }, [enabled]);
  return (
    <section className="camera-panel" aria-label="Local hand recognition">
      <div className="camera-frame">
        <video
          ref={video}
          muted
          autoPlay
          playsInline
          aria-label="Camera preview"
        />
        <canvas
          hidden={!enabled}
          ref={canvas}
          width={640}
          height={480}
          aria-hidden="true"
        />
        {!enabled && (
          <div className="camera-empty">
            <img
              className="camera-symbol"
              src="/images/workshop-spark.png"
              alt=""
              width={64}
              height={64}
            />
            <h3>
              A little movement.
              <br />A familiar voice.
            </h3>
            <p>
              Turn on your camera when you’re ready.
              <br />
              Your video stays on this device.
            </p>
          </div>
        )}
        {enabled && loading && <div className="camera-loading">{status}</div>}
        <div className="camera-caption">
          {enabled
            ? "One hand, comfortably in view"
            : "Your space to communicate"}
        </div>
      </div>
      <div className="camera-controls">
        <span>
          {enabled ? status : "Camera is off"}
          {enabled && ms !== null && <small> · {ms} ms inference</small>}
        </span>
        <button
          className={enabled ? "button subtle" : "button primary"}
          onClick={() => {
            if (!enabled) onStart?.();
            setEnabled((v) => !v);
          }}
        >
          {loading
            ? "Cancel startup"
            : enabled
              ? "Pause camera"
              : "Start camera"}
        </button>
      </div>
    </section>
  );
}
