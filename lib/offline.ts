import { verifyLocalModel } from "./vision";
export async function prepareOffline(
  onProgress: (text: string) => void,
): Promise<void> {
  if (!("serviceWorker" in navigator))
    throw new Error(
      "Offline setup needs a browser with service workers, using HTTPS or localhost.",
    );
  const registration = await navigator.serviceWorker.register("/sw.js");
  await registration.update();
  if (registration.installing) {
    await new Promise<void>((resolve, reject) => {
      const installing = registration.installing!;
      const timer = setTimeout(
        () => reject(new Error("App update timed out. Reload and retry.")),
        20000,
      );
      const check = () => {
        if (
          installing.state === "installed" ||
          installing.state === "activated"
        ) {
          clearTimeout(timer);
          resolve();
        } else if (installing.state === "redundant") {
          clearTimeout(timer);
          reject(new Error("App update failed. Reload and retry."));
        }
      };
      installing.addEventListener("statechange", check);
      check();
    });
  }
  if (registration.waiting) {
    onProgress("Activating the updated offline app…");
    const waiting = registration.waiting;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(
            new Error(
              "Offline update timed out. Close other Kumpas tabs and retry.",
            ),
          ),
        20000,
      );
      const check = () => {
        if (waiting.state === "activated") {
          clearTimeout(timer);
          resolve();
        }
      };
      waiting.addEventListener("statechange", check);
      waiting.postMessage({ type: "activate" });
      check();
    });
  }
  const ready = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              "Offline worker setup timed out. Use the production preview.",
            ),
          ),
        20000,
      ),
    ),
  ]);
  const worker = ready.active;
  if (!worker)
    throw new Error("Offline worker is not active yet. Reload and try again.");
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => {
      channel.port1.close();
      reject(
        new Error(
          "Offline preparation timed out. Check the local server and retry.",
        ),
      );
    }, 120000);
    channel.port1.onmessage = ({ data }) => {
      if (data.type === "progress") {
        onProgress(data.message);
        return;
      }
      clearTimeout(timer);
      channel.port1.close();
      if (data.type === "ready") resolve();
      else reject(new Error(data.message));
    };
    worker.postMessage({ type: "prepare" }, [channel.port2]);
  });
  onProgress("Checking the local hand model…");
  await verifyLocalModel();
  await navigator.storage?.persist?.().catch(() => false);
}
