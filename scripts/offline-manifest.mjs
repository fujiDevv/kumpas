import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
const root = ".cloudflare/output/v0/workers/default/assets";
async function walk(dir) {
  return (
    await Promise.all(
      (await readdir(dir, { withFileTypes: true })).map((e) =>
        e.isDirectory() ? walk(join(dir, e.name)) : join(dir, e.name),
      ),
    )
  ).flat();
}
const paths = (await walk(root)).filter(
  (p) =>
    !p.endsWith(".map") &&
    !p.endsWith("/sw.js") &&
    !p.endsWith("/offline-assets.json") &&
    !["_headers", "_redirects", "_routes.json"].includes(
      p.slice(root.length + 1),
    ) &&
    !p
      .slice(root.length + 1)
      .split("/")
      .some((segment) => segment.startsWith(".")),
);
const urls = paths.map((p) => "/" + p.slice(root.length + 1));
const hasher = createHash("sha256");
for (const p of paths.sort()) {
  hasher.update(p);
  hasher.update(await readFile(p));
}
hasher.update(await readFile("public/sw.js"));
const version = hasher.digest("hex").slice(0, 16);
await writeFile(
  join(root, "offline-assets.json"),
  JSON.stringify({ version, urls: ["/", ...urls] }) + "\n",
);
const sw = (await readFile("public/sw.js", "utf8")).replace(
  "__BUILD_VERSION__",
  version,
);
await writeFile(join(root, "sw.js"), sw);
console.log(`Offline manifest: ${urls.length + 1} assets, build ${version}.`);
