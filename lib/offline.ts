import { waitForWorker, withTimeout } from "./worker-state";
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
  if (registration.installing)
    await waitForWorker(registration.installing, ["installed", "activated"]);
  if (registration.waiting) {
    onProgress("Activating the updated offline app…");
    const waiting = registration.waiting;
    waiting.postMessage({ type: "activate" });
    await waitForWorker(waiting, ["activated"]);
  }
  const ready = await withTimeout(
    navigator.serviceWorker.ready,
    20000,
    "Offline worker setup timed out. Use the production preview.",
  );
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
    try {
      worker.postMessage({ type: "prepare" }, [channel.port2]);
    } catch (error) {
      clearTimeout(timer);
      channel.port1.close();
      channel.port2.close();
      reject(error);
    }
  });
  onProgress("Checking the local hand model…");
  await verifyLocalModel();
  await navigator.storage?.persist?.().catch(() => false);
}
