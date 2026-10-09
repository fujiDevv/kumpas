import { readFileSync } from "node:fs";
import vm from "node:vm";
import { expect, it, vi } from "vitest";
const source = readFileSync(
  new URL("../public/sw.js", import.meta.url),
  "utf8",
).replace("__BUILD_VERSION__", "new");
function setup(network: typeof fetch) {
  const handlers = new Map<string, (e: any) => void>();
  const data = new Map<string, Map<string, Response>>();
  const key = (r: string | Request) =>
    typeof r === "string"
      ? new URL(r, "https://kumpas.test").pathname
      : new URL(r.url).pathname;
  const cache = (name: string) => {
    if (!data.has(name)) data.set(name, new Map());
    return {
      match: async (r: string | Request) =>
        data.get(name)!.get(key(r))?.clone(),
      put: async (r: string | Request, response: Response) => {
        data.get(name)!.set(key(r), response);
      },
    };
  };
  vm.runInNewContext(source, {
    self: {
      location: { origin: "https://kumpas.test" },
      addEventListener: (name: string, handler: any) =>
        handlers.set(name, handler),
      clients: { matchAll: async () => [{}], claim: async () => {} },
    },
    caches: {
      open: async (name: string) => cache(name),
      keys: async () => [...data.keys()],
      delete: async (name: string) => data.delete(name),
    },
    fetch: network,
    Response,
    Headers,
    URL,
  });
  return {
    cache,
    request: async (path: string, mode?: string) => {
      const request = new Request("https://kumpas.test" + path);
      if (mode) Object.defineProperty(request, "mode", { value: mode });
      let result!: Promise<Response>;
      handlers.get("fetch")!({
        request,
        respondWith: (p: Promise<Response>) => {
          result = p;
        },
      });
      return result;
    },
  };
}
it("keeps a complete older build available if the newly activated cache is incomplete", async () => {
  const sw = setup(
    vi.fn(async () => {
      throw new Error("offline");
    }) as typeof fetch,
  );
  await sw.cache("kumpas-old").put("/__offline-ready", new Response("ready"));
  await sw.cache("kumpas-old").put("/", new Response("old working shell"));
  await sw.cache("kumpas-new").put("/", new Response("incomplete shell"));
  expect(await (await sw.request("/", "navigate")).text()).toBe(
    "old working shell",
  );
});
it("falls back to the cached shell on server errors as well as disconnection", async () => {
  const sw = setup(
    vi.fn(
      async () => new Response("server down", { status: 503 }),
    ) as typeof fetch,
  );
  await sw.cache("kumpas-new").put("/__offline-ready", new Response("ready"));
  await sw.cache("kumpas-new").put("/", new Response("working shell"));
  expect(await (await sw.request("/", "navigate")).text()).toBe(
    "working shell",
  );
});
it("does not serve a partial cache as an offline-ready application", async () => {
  const sw = setup(
    vi.fn(async () => {
      throw new Error("offline");
    }) as typeof fetch,
  );
  await sw.cache("kumpas-new").put("/", new Response("incomplete shell"));
  expect((await sw.request("/", "navigate")).type).toBe("error");
});
