import { readFile, writeFile, mkdir, cp, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
const require = createRequire(import.meta.url);
const pkgRoot = dirname(require.resolve("@mediapipe/tasks-vision"));
const pkg = JSON.parse(await readFile(join(pkgRoot, "package.json"), "utf8"));
const modelUrl =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const expected = ""; // First acquisition is recorded below; subsequent acquisitions verify the pinned manifest.
await mkdir("public/mediapipe", { recursive: true });
await mkdir("public/models", { recursive: true });
await mkdir("docs", { recursive: true });
const { build } = await import(
  require.resolve("rolldown", { paths: [require.resolve("vite")] })
);
const bundle = await build({
  input: join(pkgRoot, "vision_bundle.mjs"),
  output: {
    file: "public/mediapipe/vision_bundle.js",
    format: "iife",
    name: "vision",
    sourcemap: false,
  },
});

await cp(join(pkgRoot, "wasm"), "public/mediapipe/wasm", { recursive: true });
let manifest;
try {
  manifest = JSON.parse(await readFile("docs/model-assets.json", "utf8"));
} catch {}
try {
  await access("public/models/hand_landmarker.task");
} catch {
  console.log("Downloading pinned Hand Landmarker model…");
  const r = await fetch(modelUrl);
  if (!r.ok) throw new Error(`Model download failed: ${r.status}`);
  const data = Buffer.from(await r.arrayBuffer());
  if (data.length < 1000000)
    throw new Error("Model download was unexpectedly small.");
  const hash = createHash("sha256").update(data).digest("hex");
  const pinned =
    manifest?.files?.find(
      (f) => f.path === "public/models/hand_landmarker.task",
    )?.sha256 || expected;
  if (pinned && hash !== pinned) throw new Error("Model checksum mismatch.");
  await writeFile("public/models/hand_landmarker.task", data);
}
const { readdir } = await import("node:fs/promises");
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory() ? walk(join(dir, e.name)) : join(dir, e.name),
      ),
    )
  ).flat();
}
const paths = [
  ...(await walk("public/mediapipe")).filter((p) => !p.endsWith(".map")),
  "public/models/hand_landmarker.task",
];
const files = await Promise.all(
  paths.map(async (path) => {
    const data = await readFile(path);
    const sha256 = createHash("sha256").update(data).digest("hex");
    const old = manifest?.files?.find((f) => f.path === path);
    if (old && old.sha256 !== sha256)
      throw new Error(`Asset changed from pinned manifest: ${path}`);
    return { path, bytes: data.length, sha256 };
  }),
);
await writeFile(
  "docs/model-assets.json",
  JSON.stringify(
    {
      package: "@mediapipe/tasks-vision",
      version: pkg.version,
      modelUrl,
      modelRevision: "float16/1",
      files,
    },
    null,
    2,
  ) + "\n",
);
await writeFile(
  "public/models/NOTICE.txt",
  "Kumpas uses the existing MediaPipe Hand Landmarker model (float16 revision 1) and @mediapipe/tasks-vision " +
    pkg.version +
    ".\nSource: " +
    modelUrl +
    "\nMediaPipe source and distribution: https://github.com/google-ai-edge/mediapipe (Apache-2.0).\nThe model was not trained by the Kumpas team.\n",
);
console.log(`Prepared and verified ${files.length} local assets.`);
