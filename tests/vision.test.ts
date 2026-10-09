import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { startVision } from "../lib/vision";
class VisionWorker {
  static instances: VisionWorker[] = [];
  onmessage: ((e: { data: any }) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    VisionWorker.instances.push(this);
  }
  ready() {
    this.onmessage?.({ data: { type: "ready" } });
  }
}
let trackStop: ReturnType<typeof vi.fn>;
let tick: (time: number) => Promise<void>;
let video: HTMLVideoElement;
beforeEach(() => {
  vi.useFakeTimers();
  VisionWorker.instances = [];
  trackStop = vi.fn();
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: vi.fn(async () => ({
        getTracks: () => [{ stop: trackStop }],
      })),
    },
  });
  vi.stubGlobal("document", { hidden: false });
  vi.stubGlobal("Worker", VisionWorker);
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback) => {
      tick = callback;
      return 1;
    }),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ close: vi.fn() })),
  );
  video = {
    srcObject: null,
    play: vi.fn(async () => {}),
    videoWidth: 640,
    videoHeight: 480,
    currentTime: 1,
    readyState: 2,
  } as unknown as HTMLVideoElement;
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("immediately clears startup timers and tracks when cancelled during model initialization", async () => {
  const controller = new AbortController();
  const pending = startVision(
    video,
    vi.fn(),
    vi.fn(),
    vi.fn(),
    controller.signal,
  );
  const rejected = expect(pending).rejects.toThrow(/canceled/);
  await vi.waitFor(() => expect(VisionWorker.instances).toHaveLength(1));
  controller.abort();
  await rejected;
  expect(trackStop).toHaveBeenCalled();
  expect(VisionWorker.instances[0].terminate).toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
  expect(video.srcObject).toBeNull();
});
it("reports a stalled inference worker instead of silently freezing", async () => {
  const observation = vi.fn(),
    error = vi.fn();
  const pending = startVision(video, observation, vi.fn(), error);
  await vi.waitFor(() => expect(VisionWorker.instances).toHaveLength(1));
  VisionWorker.instances[0].ready();
  await pending;
  await tick(1000);
  vi.advanceTimersByTime(5000);
  expect(error).toHaveBeenCalledWith(
    expect.stringContaining("stopped responding"),
  );
  expect(observation).toHaveBeenCalledWith(null);
  expect(trackStop).toHaveBeenCalled();
  expect(VisionWorker.instances[0].terminate).toHaveBeenCalled();
});
it("clears the in-flight timeout when a frame result arrives", async () => {
  const pending = startVision(video, vi.fn(), vi.fn(), vi.fn());
  await vi.waitFor(() => expect(VisionWorker.instances).toHaveLength(1));
  VisionWorker.instances[0].ready();
  const session = await pending;
  await tick(1000);
  VisionWorker.instances[0].onmessage?.({
    data: { type: "result", points: [], timestamp: performance.now() },
  });
  expect(vi.getTimerCount()).toBe(0);
  session.stop();
});
