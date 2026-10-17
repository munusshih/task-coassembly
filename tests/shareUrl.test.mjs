import test from "node:test";
import assert from "node:assert/strict";
import { shareDestination, shareId, sharedViewDestination, SHARE_ID_PATTERN } from "../src/app/lib/shareUrl.mjs";

test("saved views exclude private URL state and normalize public state", () => {
  assert.equal(shareDestination("/tasks?role=worker-owner&week=2026-10-12&token=secret#cursor"), "/tasks?week=2026-10-12");
  assert.equal(shareDestination("/?tab=meetingNotes&note=stable-id&notesSearch=irrelevant"), "/notes/stable-id");
});
test("destinations reject external redirects, recursion, invalid paths and oversized state", () => {
  for (const value of ["https://evil.test", "//evil.test", "/\\evil.test", "/s/abc", "/api/auth/login", "/notes/id/more", "/notes/bad%2Fid", "/notes/%E0%A4%A", `/notes?q=${"x".repeat(2048)}`]) {
    assert.throws(() => shareDestination(value));
  }
});
test("identical views produce identical bounded IDs regardless of query ordering", async () => {
  const first = await shareId("/tasks?week=2026-10-12&view=project");
  assert.match(first, SHARE_ID_PATTERN);
  assert.equal(first.length, 16);
  assert.equal(first, await shareId("/tasks?view=project&week=2026-10-12"));
  assert.notEqual(first, await shareId("/tasks?week=2026-10-05&view=project"));
});

test("saved views reject unknown versions and destination tampering", async () => {
  const destination = "/notes/stable-id";
  const id = await shareId(destination);
  assert.equal(await sharedViewDestination(id, { version: 1, destination }), destination);
  await assert.rejects(sharedViewDestination(id, { version: 2, destination }));
  await assert.rejects(sharedViewDestination(id, { version: 1, destination: "/notes/different" }));
  await assert.rejects(sharedViewDestination(id, { version: 1, destination: "//evil.test" }));
});
