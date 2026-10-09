const BUILD = "__BUILD_VERSION__";
const CACHE = "kumpas-" + BUILD;
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener("message", (event) => {
  if (event.data?.type === "activate") {
    event.waitUntil(self.skipWaiting());
    return;
  }
  if (event.data?.type !== "prepare") return;
  const port = event.ports[0];
  event.waitUntil(
    (async () => {
      if (BUILD.startsWith("__"))
        throw new Error(
          "Offline setup needs a production build. Run pnpm build, then pnpm start.",
        );
      const response = await fetch("/offline-assets.json", {
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error("Could not load the production asset manifest.");
      const manifest = await response.json();
      if (manifest.version !== BUILD)
        throw new Error(
          "App and offline worker versions differ. Close Kumpas tabs and reopen before setup.",
        );
      const cache = await caches.open(CACHE);
      for (let i = 0; i < manifest.urls.length; i++) {
        const url = manifest.urls[i];
        port.postMessage({
          type: "progress",
          message: `Saving offline assets ${i + 1}/${manifest.urls.length}…`,
        });
        const r = await fetch(url, { cache: "reload" });
        if (!r.ok) throw new Error("Could not cache " + url);
        const canonical = new URL(r.url);
        if (canonical.origin !== self.location.origin)
          throw new Error("Unexpected asset redirect.");
        // Navigation requests cannot consume a cached redirected Response.
        // Preserve its body and MIME type while removing redirect metadata.
        let local = r;
        if (r.redirected) {
          const headers = new Headers(r.headers);
          headers.delete("content-encoding");
          headers.delete("content-length");
          local = new Response(await r.arrayBuffer(), {
            status: r.status,
            statusText: r.statusText,
            headers,
          });
        }
        if (canonical.pathname !== url)
          await cache.put(canonical.pathname, local.clone());
        await cache.put(url, local);
      }
      await cache.put("/__offline-ready", new Response("ready"));
      // Old builds are removed only after all assets of the new build are saved.
      if ((await self.clients.matchAll({ type: "window" })).length <= 1) {
        const previous = [];
        for (const name of await caches.keys())
          if (
            name.startsWith("kumpas-") &&
            name !== CACHE &&
            (await (await caches.open(name)).match("/__offline-ready"))
          )
            previous.push(name);
        // Keep one complete previous build for clients still running its code.
        for (const name of await caches.keys())
          if (
            name.startsWith("kumpas-") &&
            name !== CACHE &&
            name !== previous.at(-1)
          )
            await caches.delete(name);
      }
      port.postMessage({ type: "ready" });
    })().catch((e) => port.postMessage({ type: "error", message: e.message })),
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname === "/sw.js" ||
    url.pathname === "/offline-assets.json"
  )
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const currentReady = await cache.match("/__offline-ready");
      const fallback = async () => {
        if (request.headers.get("RSC") === "1") return undefined;
        const names = currentReady
          ? [CACHE]
          : (await caches.keys())
              .filter((name) => name.startsWith("kumpas-") && name !== CACHE)
              .reverse();
        for (const name of names) {
          const saved = await caches.open(name);
          if (!(await saved.match("/__offline-ready"))) continue;
          const response = await saved.match(
            request.mode === "navigate" ? url.pathname : request,
            { ignoreVary: true },
          );
          if (response) return response;
        }
      };
      if (!currentReady || request.mode === "navigate") {
        try {
          const response = await fetch(request);
          return response.status >= 500
            ? (await fallback()) || response
            : response;
        } catch {
          return (await fallback()) || Response.error();
        }
      }
      // Public build assets are identical for this origin. Module/stylesheet
      // requests add Origin headers absent during prefetch; Vary: Origin would
      // otherwise miss a valid local copy. Never apply this to an RSC response.
      if (request.headers.get("RSC") === "1") return fetch(request);
      return (
        (await cache.match(request, { ignoreVary: true })) || fetch(request)
      );
    })(),
  );
});
