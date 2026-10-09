import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { recordVoice } from "../lib/audio";
class Recorder {
  static last: Recorder;
  static failStart = false;
  static isTypeSupported = () => true;
  mimeType = "audio/webm";
  state = "inactive";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    Recorder.last = this;
  }
  start() {
    if (Recorder.failStart) throw new Error("start failed");
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
  }
  finish() {
    this.ondataavailable?.({ data: new Blob(["voice"]) });
    this.onstop?.();
  }
}
let stopTrack: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers();
  Recorder.failStart = false;
  stopTrack = vi.fn();
  vi.stubGlobal("MediaRecorder", Recorder);
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: vi.fn(async () => ({
        getTracks: () => [{ stop: stopTrack }],
      })),
    },
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("does not include recorder flush delay in clip duration", async () => {
  let now = 100;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const done = vi.fn();
  const recording = await recordVoice(done, vi.fn());
  now = 1000;
  recording.stop();
  now = 3000;
  Recorder.last.finish();
  expect(done.mock.calls[0][1]).toBe(900);
  expect(stopTrack).toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
it("does not publish a cancelled recording when its final data arrives", async () => {
  const done = vi.fn(),
    error = vi.fn();
  const recording = await recordVoice(done, error);
  recording.cancel();
  Recorder.last.finish();
  expect(done).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();
  expect(stopTrack).toHaveBeenCalled();
});
it("stops the recorder and microphone on error", async () => {
  const done = vi.fn(),
    error = vi.fn();
  await recordVoice(done, error);
  Recorder.last.onerror?.();
  expect(Recorder.last.state).toBe("inactive");
  Recorder.last.finish();
  expect(done).not.toHaveBeenCalled();
  expect(error).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
it("releases microphone resources if recording cannot start", async () => {
  Recorder.failStart = true;
  await expect(recordVoice(vi.fn(), vi.fn())).rejects.toThrow("start failed");
  expect(stopTrack).toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
