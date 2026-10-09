import { afterEach, expect, it, vi } from "vitest";
import { waitForWorker, withTimeout } from "../lib/worker-state";
class WorkerState extends EventTarget {
  state: ServiceWorkerState = "installing";
  change(state: ServiceWorkerState) {
    this.state = state;
    this.dispatchEvent(new Event("statechange"));
  }
}
afterEach(() => vi.useRealTimers());
it("cleans its listener and timer after activation", async () => {
  vi.useFakeTimers();
  const w = new WorkerState(),
    remove = vi.spyOn(w, "removeEventListener");
  const promise = waitForWorker(w as unknown as ServiceWorker, ["activated"]);
  w.change("activated");
  await promise;
  expect(remove).toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
it("fails promptly when a worker becomes redundant", async () => {
  vi.useFakeTimers();
  const w = new WorkerState();
  const promise = waitForWorker(w as unknown as ServiceWorker, ["activated"]);
  const rejected = expect(promise).rejects.toThrow(/failed/);
  w.change("redundant");
  await rejected;
  expect(vi.getTimerCount()).toBe(0);
});
it("does not leave a readiness timeout running after success", async () => {
  vi.useFakeTimers();
  expect(await withTimeout(Promise.resolve("ready"), 20000, "timed out")).toBe(
    "ready",
  );
  expect(vi.getTimerCount()).toBe(0);
});
