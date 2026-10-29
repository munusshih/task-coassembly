import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const previewKey = ({ id, url, revision }) => createHash("sha256").update(JSON.stringify([id, url, revision])).digest("hex");

export function isPublicAddress(address) {
  const ip = address.toLowerCase();
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0)) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)));
  }
  // Only global-unicast IPv6; mapped IPv4, loopback, private and link-local are excluded.
  return isIP(ip) === 6 && /^[23]/.test(ip) && !ip.startsWith("2001:db8:");
}

export async function publicTarget(input, resolve = lookup) {
  const url = new URL(input);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || (url.port && !["80", "443"].includes(url.port))) throw new Error("Unsupported preview URL");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [{ address: host }] : await resolve(host, { all: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) throw new Error("Preview requires a public website");
  return { url, addresses };
}

export async function publicUrl(input, resolve = lookup) { return (await publicTarget(input, resolve)).url; }

const decode = (value) => value.replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
export function imageCandidates(html, base) {
  const og = [], icons = [];
  for (const tag of html.match(/<(?:meta|link)\b[^>]*>/gi) || []) {
    const attrs = {};
    for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) attrs[match[1].toLowerCase()] = decode(match[2] ?? match[3] ?? match[4]);
    const property = (attrs.property || attrs.name || "").toLowerCase();
    if (["og:image", "og:image:url", "twitter:image", "twitter:image:src"].includes(property) && attrs.content) og.push(attrs.content);
    if (/\bicon\b/i.test(attrs.rel || "") && attrs.href) icons.push(attrs.href);
  }
  return [...new Set([...og, ...icons.reverse(), "/favicon.ico"].flatMap((value) => { try { return [new URL(value, base).href]; } catch { return []; } }))].slice(0, 8);
}
