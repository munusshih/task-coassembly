import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { cacheDirectory, ensurePreview, rememberResource } from "../../../lib/resourcePreviewCache.mjs";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request) {
  try {
    if (Number(request.headers.get("content-length")) > 40_000) return NextResponse.json({ image: false }, { status: 413 });
    const { id, url, revision } = await request.json();
    if (typeof id !== "string" || id.length > 256 || typeof url !== "string" || url.length > 8192 || typeof revision !== "string" || revision.length > 30000) return NextResponse.json({ image: false }, { status: 400 });
    const resource = { id, url, revision };
    await rememberResource(resource);
    const result = await ensurePreview(resource);
    return NextResponse.json({ ...result, src: result.image ? `/api/resource-preview?key=${result.key}` : null });
  } catch { return NextResponse.json({ image: false }); }
}
export async function GET(request) {
  const key = new URL(request.url).searchParams.get("key");
  if (!/^[a-f0-9]{64}$/.test(key || "")) return new Response(null, { status: 400 });
  try { return new Response(await readFile(path.join(cacheDirectory, `${key}.webp`)), { headers: { "Content-Type": "image/webp", "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } }); }
  catch { return new Response(null, { status: 404 }); }
}
