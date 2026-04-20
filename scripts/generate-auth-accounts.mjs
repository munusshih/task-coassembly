#!/usr/bin/env node
import { pbkdf2Sync, randomBytes } from "node:crypto";

const ITERATIONS = Number(process.env.AUTH_PBKDF2_ITERATIONS || 210000);
const KEY_LENGTH = 32;
const DIGEST = "sha256";

function usage() {
  console.error("Usage: node scripts/generate-auth-accounts.mjs username:password [username:password ...]");
  process.exit(1);
}

function normalizeUsername(raw) {
  return String(raw || "").trim().toLowerCase();
}

function isValidUsername(username) {
  return /^[a-z0-9_-]{1,32}$/.test(username);
}

function buildRecord(password) {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(String(password), salt, ITERATIONS, KEY_LENGTH, DIGEST);
  return `pbkdf2_sha256$${ITERATIONS}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

const pairs = process.argv.slice(2);
if (!pairs.length) usage();

const accounts = {};
for (const pair of pairs) {
  const sep = pair.indexOf(":");
  if (sep <= 0) {
    console.error(`Invalid pair: ${pair}`);
    usage();
  }

  const username = normalizeUsername(pair.slice(0, sep));
  const password = pair.slice(sep + 1);

  if (!isValidUsername(username)) {
    console.error(`Invalid username: ${username}`);
    process.exit(1);
  }
  if (!password) {
    console.error(`Missing password for: ${username}`);
    process.exit(1);
  }

  accounts[username] = buildRecord(password);
}

const json = JSON.stringify(accounts);
const dotenvEscaped = json.replace(/\$/g, "\\$");
console.log("DASHBOARD_ACCOUNTS_JSON=");
console.log(json);
console.log("\nFor .env.local (Next.js), use this escaped form:");
console.log(`DASHBOARD_ACCOUNTS_JSON='${dotenvEscaped}'`);
console.log("\nFor Vercel env vars, use the raw JSON value above.\n");
