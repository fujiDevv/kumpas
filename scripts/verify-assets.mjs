import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const manifest = JSON.parse(await readFile("docs/model-assets.json", "utf8"));
for (const f of manifest.files) {
  const b = await readFile(f.path);
  if (
    b.length !== f.bytes ||
    createHash("sha256").update(b).digest("hex") !== f.sha256
  )
    throw new Error(`Asset verification failed: ${f.path}`);
}
console.log(`Verified ${manifest.files.length} pinned assets.`);
