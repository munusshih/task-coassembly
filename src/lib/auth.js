const COOKIE_NAME = "coassembly_auth";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function getAuthPassword() {
  return process.env.DASHBOARD_PASSWORD || "solidarity";
}

function getCookieSecret() {
  const fromEnv = process.env.AUTH_COOKIE_SECRET;
  if (fromEnv && fromEnv.trim()) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_COOKIE_SECRET is required in production");
  }
  return "dev-only-insecure-secret";
}

function bytesToHex(buffer) {
  const view = new Uint8Array(buffer);
  let hex = "";
  for (const b of view) {
    hex += b.toString(16).padStart(2, "0");
  }
  return hex;
}

async function signValue(value, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return bytesToHex(sig);
}

function parseCookieValue(rawCookieValue) {
  if (!rawCookieValue) return null;
  const dotIndex = rawCookieValue.lastIndexOf(".");
  if (dotIndex <= 0) return null;

  const encodedPayload = rawCookieValue.slice(0, dotIndex);
  const signature = rawCookieValue.slice(dotIndex + 1);

  let payload = "";
  try {
    payload = decodeURIComponent(encodedPayload);
  } catch {
    return null;
  }

  return { payload, signature };
}

function buildSessionPayload(username) {
  const user = (username || "dashboard").trim() || "dashboard";
  return `${Date.now()}:${user}`;
}

function isSessionFresh(payload) {
  const tsRaw = payload.split(":", 1)[0];
  const ts = Number(tsRaw);
  if (!Number.isFinite(ts)) return false;
  const ageMs = Date.now() - ts;
  return ageMs >= 0 && ageMs < SESSION_MAX_AGE_SECONDS * 1000;
}

export async function validatePassword(password) {
  return password === getAuthPassword();
}

export async function createAuthCookieValue(username) {
  const payload = buildSessionPayload(username);
  const signature = await signValue(payload, getCookieSecret());
  return `${encodeURIComponent(payload)}.${signature}`;
}

export async function verifyAuthCookieValue(rawCookieValue) {
  const parsed = parseCookieValue(rawCookieValue);
  if (!parsed) return false;

  const expected = await signValue(parsed.payload, getCookieSecret());
  if (expected !== parsed.signature) return false;

  return isSessionFresh(parsed.payload);
}

export function getAuthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export { COOKIE_NAME, SESSION_MAX_AGE_SECONDS };
