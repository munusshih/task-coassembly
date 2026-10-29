import { readFile } from "node:fs/promises";
import path from "node:path";
import { cacheDirectory, ensurePreview } from "../src/lib/resourcePreviewCache.mjs";
let resources = [];
try { resources = Object.values(JSON.parse(await readFile(path.join(cacheDirectory, "resources.json"), "utf8"))); } catch {}
await Promise.all(resources.map(ensurePreview));
console.log(`Resource previews: ${resources.length} cached resource${resources.length === 1 ? "" : "s"} checked.`);
