import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { publicTarget, imageCandidates, previewKey } from "./resourcePreview.mjs";

export const cacheDirectory = path.join(process.cwd(), ".cache", "resource-previews");
const pending = new Map();
let registryQueue = Promise.resolve();
let slots = 0;
const waiting = [];
async function limited(work) {
  if (slots >= 3) await new Promise((resolve) => waiting.push(resolve));
  slots++;
  try { return await work(); } finally { slots--; waiting.shift()?.(); }
}
async function fetchPublic(input, limit, redirects = 0) {
  const { url, addresses } = await publicTarget(input);
  // Pin the connection to a validated public address, including after redirects.
  const response = await new Promise((resolve, reject) => {
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, {
      signal: AbortSignal.timeout(7000),
      headers: { "User-Agent": "CoAssembly-Resource-Preview/1.0", Accept: "text/html,image/*;q=0.9" },
      lookup: (_hostname, options, callback) => options.all
        ? callback(null, addresses.map(({ address }) => ({ address, family: isIP(address) })))
        : callback(null, addresses[0].address, isIP(addresses[0].address)),
    }, resolve);
    request.on("error", reject); request.end();
  });
  if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
    response.destroy();
    if (redirects >= 4) throw new Error("Too many redirects");
    return fetchPublic(new URL(response.headers.location, url).href, limit, redirects + 1);
  }
  if (response.statusCode < 200 || response.statusCode >= 300 || Number(response.headers["content-length"]) > limit) { response.destroy(); throw new Error("Preview unavailable"); }
  const chunks = []; let size = 0;
  for await (const value of response) {
    size += value.length;
    if (size > limit) { response.destroy(); throw new Error("Preview too large"); }
    chunks.push(Buffer.from(value));
  }
  return { bytes: Buffer.concat(chunks), type: response.headers["content-type"] || "", url: url.href };
}
async function atomicJson(file, data) {
  const temp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile(temp, JSON.stringify(data)); await rename(temp, file);
}
export async function rememberResource(resource) {
  registryQueue = registryQueue.catch(() => {}).then(async () => {
    await mkdir(cacheDirectory, { recursive: true });
    let registry = {}; try { registry = JSON.parse(await readFile(path.join(cacheDirectory, "resources.json"), "utf8")); } catch {}
    registry[resource.id] = resource;
    await atomicJson(path.join(cacheDirectory, "resources.json"), registry);
  });
  await registryQueue;
}
export async function ensurePreview(resource) {
  const key = previewKey(resource);
  if (pending.has(key)) return pending.get(key);
  const work = (async () => {
    await mkdir(cacheDirectory, { recursive: true });
    const metadataPath = path.join(cacheDirectory, `${key}.json`);
    try { return JSON.parse(await readFile(metadataPath, "utf8")); } catch {}
    return limited(async () => {
      let result = { key, image: false };
      try {
        let page;
        try { page = await fetchPublic(resource.url, 2_000_000); } catch {}
        const candidates = page ? page.type.startsWith("image/") ? [page.url] : imageCandidates(page.bytes.toString("utf8"), page.url) : [new URL("/favicon.ico", resource.url).href];
        for (const candidate of candidates) {
          try {
            const image = page && candidate === page.url && page.type.startsWith("image/") ? page : await fetchPublic(candidate, 5_000_000);
            if (!image.type.startsWith("image/")) continue;
            const pixels = sharp(image.bytes, { limitInputPixels: 40_000_000 });
            const { width, height } = await pixels.metadata();
            if (!width || !height || Math.min(width, height) < 16) continue;
            // Raster output keeps remote SVG or HTML from executing under our origin.
            await pixels.resize({ width: 720, height: 560, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(cacheDirectory, `${key}.webp`));
            result = { key, image: true, favicon: Math.max(width, height) <= 128 }; break;
          } catch {}
        }
      } catch {}
      // Negative results are cached too: only an edited resource gets a new key.
      await atomicJson(metadataPath, result);
      return result;
    });
  })();
  pending.set(key, work);
  try { return await work; } finally { pending.delete(key); }
}
