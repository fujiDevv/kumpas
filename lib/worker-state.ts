/** Waits without leaking timers or listeners after completion or failure. */
export function waitForWorker(
  worker: ServiceWorker,
  states: ServiceWorkerState[],
  timeoutMs = 20000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timer);
      worker.removeEventListener("statechange", check);
      if (error) reject(error);
      else resolve();
    };
    const check = () => {
      if (states.includes(worker.state)) finish();
      else if (worker.state === "redundant")
        finish(new Error("App update failed. Reload and retry."));
    };
    const timer = setTimeout(
      () => finish(new Error("App update timed out. Reload and retry.")),
      timeoutMs,
    );
    worker.addEventListener("statechange", check);
    check();
  });
}
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
