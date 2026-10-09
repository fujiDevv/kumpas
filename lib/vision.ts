import { features } from "./features";
import type { Hand, Observation, Point } from "./types";
export type CameraSession = { stop: () => void };
export async function startVision(
  video: HTMLVideoElement,
  onObservation: (o: Observation) => void,
  onStatus: (s: string) => void,
  onError: (e: string) => void,
  signal?: AbortSignal,
): Promise<CameraSession> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  });
  if (signal?.aborted) {
    stream.getTracks().forEach((t) => t.stop());
    throw new DOMException("Camera startup canceled.", "AbortError");
  }
  let worker: Worker | undefined,
    raf = 0,
    stopped = false,
    busy = false,
    lastFrame = -1,
    lastTime = 0;
  const stop = () => {
    stopped = true;
    cancelAnimationFrame(raf);
    worker?.terminate();
    stream.getTracks().forEach((t) => t.stop());
    if (video.srcObject === stream) video.srcObject = null;
  };
  signal?.addEventListener("abort", stop, { once: true });
  try {
    video.srcObject = stream;
    await video.play();
    if (stopped)
      throw new DOMException("Camera startup canceled.", "AbortError");
    onStatus("Loading the local hand model…");
    worker = new Worker("/hand-worker.js");
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () =>
          reject(
            new Error(
              "Model setup timed out. Run pnpm prepare:model, then try again.",
            ),
          ),
        30000,
      );
      worker!.onerror = () => {
        clearTimeout(timeout);
        reject(
          new Error(
            "The local vision worker could not start. Try desktop Chrome or Edge.",
          ),
        );
      };
      worker!.onmessage = ({ data }) => {
        if (data.type === "ready") {
          clearTimeout(timeout);
          resolve();
        }
        if (data.type === "error") {
          clearTimeout(timeout);
          reject(new Error(data.message));
        }
      };
      worker!.postMessage({ type: "init" });
    });
    worker.onmessage = ({ data }) => {
      if (stopped) return;
      busy = false;
      if (data.type === "error") {
        onError(data.message);
        stop();
        return;
      }
      if (data.type !== "result") return;
      const points = data.points as Point[][];
      if (
        points.length !== 1 ||
        performance.now() - data.timestamp > 350 ||
        points[0].some(
          (p) => p.x < 0.01 || p.x > 0.99 || p.y < 0.01 || p.y > 0.99,
        )
      ) {
        onObservation(null);
        return;
      }
      const f = features(points[0], video.videoWidth, video.videoHeight);
      const hand = data.handedness[0]?.[0]?.categoryName;
      onObservation(
        f && (hand === "Left" || hand === "Right")
          ? { features: f, hand: hand as Hand, points: points[0], ms: data.ms }
          : null,
      );
    };
    worker.onerror = () => {
      onError("Vision stopped unexpectedly. Pause and restart the camera.");
      stop();
    };
    const tick = async (now: number) => {
      if (stopped) return;
      raf = requestAnimationFrame(tick);
      if (
        document.hidden ||
        busy ||
        now - lastTime < 80 ||
        video.currentTime === lastFrame ||
        video.readyState < 2
      )
        return;
      busy = true;
      lastTime = now;
      lastFrame = video.currentTime;
      try {
        const frame = await createImageBitmap(video);
        if (stopped) {
          frame.close();
          return;
        }
        worker!.postMessage(
          { type: "frame", frame, timestamp: performance.now() },
          [frame],
        );
      } catch (error) {
        busy = false;
        onError(
          error instanceof Error
            ? error.message
            : "Could not read camera frame.",
        );
        stop();
      }
    };
    raf = requestAnimationFrame(tick);
    onStatus("Camera ready");
    return { stop };
  } catch (error) {
    stop();
    throw error;
  }
}
/** Exercise real model initialization without requesting camera access. */
export async function verifyLocalModel(): Promise<void> {
  const worker = new Worker("/hand-worker.js");
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Local model check timed out.")),
        30000,
      );
      worker.onmessage = ({ data }) => {
        if (data.type === "ready") {
          worker.postMessage({ type: "check" });
        }
        if (data.type === "checked") {
          clearTimeout(timer);
          if (data.hands === 0) resolve();
          else
            reject(
              new Error(
                "Blank-frame runtime check returned an unexpected hand.",
              ),
            );
        }
        if (data.type === "error") {
          clearTimeout(timer);
          reject(new Error(data.message));
        }
      };
      worker.onerror = () => {
        clearTimeout(timer);
        reject(
          new Error(
            "Local vision worker could not initialize. Use desktop Chrome or Edge.",
          ),
        );
      };
      worker.postMessage({ type: "init" });
    });
  } finally {
    worker.terminate();
  }
}
