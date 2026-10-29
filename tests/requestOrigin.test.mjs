import test from "node:test";
import assert from "node:assert/strict";
import { hasSameRequestOrigin } from "../src/lib/requestOrigin.mjs";

function request(origin, host = "localhost:3000", url = "http://0.0.0.0:3000/api/auth/session") {
  const headers = new Headers({ host });
  if (origin) headers.set("origin", origin);
  return { url, headers };
}

test("accepts the browser host when Next uses its bind address", () => {
  assert.equal(hasSameRequestOrigin(request("http://localhost:3000")), true);
  assert.equal(hasSameRequestOrigin(request("http://127.0.0.1:3000", "127.0.0.1:3000")), true);
});

test("rejects cross-origin, different ports, missing, opaque, and malformed origins", () => {
  for (const origin of ["https://evil.example", "http://localhost:3001", null, "null", "invalid"]) {
    assert.equal(hasSameRequestOrigin(request(origin)), false);
  }
});

test("keeps same-origin HTTPS sessions working", () => {
  assert.equal(hasSameRequestOrigin(request("https://team.example", "team.example", "https://team.example/api/auth/session")), true);
});
