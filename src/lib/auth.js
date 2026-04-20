const COOKIE_NAME = "coassembly_auth";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const USERNAME_PATTERN = /^[a-z0-9_-]{1,32}$/;
const PBKDF2_SCHEME = "pbkdf2_sha256";
const MIN_PBKDF2_ITERATIONS = 100000;

let cachedAccountsRaw = null;
let cachedAccounts = null;

function getCookieSecret() {
  const fromEnv = process.env.AUTH_COOKIE_SECRET;
  if (fromEnv && fromEnv.trim()) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_COOKIE_SECRET is required in production");
  }
  return "dev-only-insecure-secret";
}

function getConfiguredAccounts() {
  const raw = String(process.env.DASHBOARD_ACCOUNTS_JSON || "").trim();

  if (cachedAccounts && raw === cachedAccountsRaw) {
    return cachedAccounts;
  }

  let parsed = {};
  if (raw) {
    try {
      const json = JSON.parse(raw);
      if (json && typeof json === "object" && !Array.isArray(json)) {
        parsed = json;
      }
    } catch {
      parsed = {};
    }
  }

  const normalized = {};
  for (const [key, value] of Object.entries(parsed)) {
    const username = normalizeUsername(key);
    if (!isValidUsername(username)) continue;
    if (typeof value !== "string") continue;
    normalized[username] = value;
  }

  cachedAccountsRaw = raw;
  cachedAccounts = normalized;
  return normalized;
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

function normalizeUsername(rawUsername) {
  return String(rawUsername || "").trim().toLowerCase();
}

function isValidUsername(username) {
  return USERNAME_PATTERN.test(username);
}

function isConfiguredUsername(username) {
  const accounts = getConfiguredAccounts();
  return Object.prototype.hasOwnProperty.call(accounts, username);
}

function buildSessionPayload(username) {
  const user = normalizeUsername(username);
  if (!isConfiguredUsername(user)) {
    throw new Error("Invalid username");
  }
  return `${Date.now()}:${user}`;
}

function parseSessionPayload(payload) {
  const [tsRaw, ...rest] = String(payload || "").split(":");
  const ts = Number(tsRaw);
  const username = normalizeUsername(rest.join(":"));
  if (!Number.isFinite(ts) || !isConfiguredUsername(username)) return null;
  return { ts, username };
}

function isSessionFresh(ts) {
  const ageMs = Date.now() - ts;
  return ageMs >= 0 && ageMs < SESSION_MAX_AGE_SECONDS * 1000;
}

function decodeBase64ToBytes(base64) {
  const value = String(base64 || "").trim();
  if (!value) return null;

  try {
    if (typeof atob === "function") {
      const binary = atob(value);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }

    if (typeof Buffer !== "undefined") {
      return new Uint8Array(Buffer.from(value, "base64"));
    }
  } catch {
    return null;
  }

  return null;
}

function timingSafeEqualBytes(a, b) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

function parsePasswordRecord(record) {
  if (typeof record !== "string") return null;
  const [scheme, iterationsRaw, saltB64, hashB64] = record.split("$");
  if (scheme !== PBKDF2_SCHEME) return null;

  const iterations = Number(iterationsRaw);
  if (!Number.isInteger(iterations) || iterations < MIN_PBKDF2_ITERATIONS) return null;

  const salt = decodeBase64ToBytes(saltB64);
  const hash = decodeBase64ToBytes(hashB64);
  if (!salt || !hash) return null;
  if (salt.length < 16 || hash.length < 16) return null;

  return { iterations, salt, hash };
}

async function derivePbkdf2Hash(password, salt, iterations, outputLength) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(String(password || "")), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    outputLength * 8,
  );
  return new Uint8Array(bits);
}

export async function validateCredentials(username, password) {
  const normalized = normalizeUsername(username);
  if (!isValidUsername(normalized)) return false;

  const accounts = getConfiguredAccounts();
  const record = parsePasswordRecord(accounts[normalized]);
  if (!record) return false;

  const candidateHash = await derivePbkdf2Hash(password, record.salt, record.iterations, record.hash.length);
  return timingSafeEqualBytes(candidateHash, record.hash);
}

export async function createAuthCookieValue(username) {
  const payload = buildSessionPayload(username);
  const signature = await signValue(payload, getCookieSecret());
  return `${encodeURIComponent(payload)}.${signature}`;
}

export async function verifyAuthCookieValue(rawCookieValue) {
  const session = await readSessionFromCookie(rawCookieValue);
  return !!session;
}

export async function getUsernameFromAuthCookieValue(rawCookieValue) {
  const session = await readSessionFromCookie(rawCookieValue);
  return session ? session.username : null;
}

async function readSessionFromCookie(rawCookieValue) {
  const parsed = parseCookieValue(rawCookieValue);
  if (!parsed) return null;

  const expected = await signValue(parsed.payload, getCookieSecret());
  if (expected !== parsed.signature) return null;

  const session = parseSessionPayload(parsed.payload);
  if (!session) return null;
  if (!isSessionFresh(session.ts)) return null;

  return session;
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

export { COOKIE_NAME, SESSION_MAX_AGE_SECONDS, normalizeUsername };
