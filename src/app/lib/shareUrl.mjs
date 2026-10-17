import { buildViewUrl, isViewPath } from "./viewUrl.mjs";

export const SHARE_VERSION = 1;
export const SHARE_ID_PATTERN = /^[A-Za-z0-9_-]{16}$/;

// Store destinations, never external URLs, preview roles, fragments, or auth data.
export function shareDestination(path) {
  if (typeof path !== "string" || path.length > 2048 || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    throw new Error("This view cannot be shared.");
  }
  const source = new URL(path, "https://task.invalid");
  let parts;
  try { parts = source.pathname.split("/").filter(Boolean).map(decodeURIComponent); }
  catch { throw new Error("This view cannot be shared."); }
  if (source.origin !== "https://task.invalid" || (parts.length && !isViewPath(parts))) {
    throw new Error("This view cannot be shared.");
  }
  const canonical = buildViewUrl(source);
  // Rebuild with only known public controls; unrelated query parameters are private.
  const publicKeys = new Set(["week", "view", "q", "group", "layout", "category", "year", "quarter"]);
  for (const key of [...canonical.searchParams.keys()]) {
    if (!publicKeys.has(key)) canonical.searchParams.delete(key);
  }
  canonical.searchParams.sort();
  return canonical.pathname + canonical.search;
}

export async function shareId(destination) {
  const bytes = new TextEncoder().encode(`${SHARE_VERSION}:${shareDestination(destination)}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return btoa(String.fromCharCode(...new Uint8Array(digest).slice(0, 12)))
    .replace(/\+/g, "-").replace(/\//g, "_");
}

export async function sharedViewDestination(id, data) {
  if (!SHARE_ID_PATTERN.test(id)) throw new Error("This share link is invalid.");
  if (data?.version !== SHARE_VERSION) throw new Error("This link uses an unsupported view format.");
  const destination = shareDestination(data.destination);
  if (await shareId(destination) !== id) throw new Error("This share link is invalid.");
  return destination;
}
