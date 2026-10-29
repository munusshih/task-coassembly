import test from "node:test";
import assert from "node:assert/strict";
import { isPublicAddress, publicUrl, imageCandidates, previewKey } from "../src/lib/resourcePreview.mjs";

test("preview keys are stable until a resource URL or edit revision changes", () => {
  const resource = { id: "one", url: "https://example.com/work", revision: "v1" };
  assert.equal(previewKey(resource), previewKey({ ...resource }));
  assert.notEqual(previewKey(resource), previewKey({ ...resource, revision: "v2" }));
  assert.notEqual(previewKey(resource), previewKey({ ...resource, url: "https://example.com/other" }));
});
test("preview downloads reject local networks, credentials, and non-web URLs", async () => {
  for (const address of ["127.0.0.1", "0.0.0.0", "10.0.0.1", "169.254.169.254", "172.16.0.1", "192.168.1.1", "100.64.0.1", "::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1"]) assert.equal(isPublicAddress(address), false, address);
  assert.equal(isPublicAddress("8.8.8.8"), true);
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
  for (const input of ["file:///etc/passwd", "http://localhost", "https://user:pass@example.com", "https://example.com:8080"]) await assert.rejects(publicUrl(input, async () => [{ address: "127.0.0.1" }]));
  await assert.rejects(publicUrl("https://example.com", async () => [{ address: "8.8.8.8" }, { address: "10.0.0.1" }]));
  assert.equal((await publicUrl("https://example.com", async () => [{ address: "8.8.8.8" }])).hostname, "example.com");
});
test("site images take priority over icons, with relative URLs and HTML entities resolved", () => {
  const html = `<link rel="icon" href="/small.png"><meta content='/cover.jpg?a=1&amp;b=2' property='og:image'><meta name=twitter:image content="https://cdn.example.com/other.png"><link href="/touch.png" rel="apple-touch-icon">`;
  assert.deepEqual(imageCandidates(html, "https://example.com/path"), ["https://example.com/cover.jpg?a=1&b=2", "https://cdn.example.com/other.png", "https://example.com/touch.png", "https://example.com/small.png", "https://example.com/favicon.ico"]);
});

import { resourceRevision, resourceDate, contributorName } from "../src/app/components/resourceMetadata.mjs";
test("resource revisions ignore property ordering but invalidate any actual edit", () => {
  assert.equal(resourceRevision({ name: "A", url: "https://example.com", links: [{ b: 2, a: 1 }] }), resourceRevision({ links: [{ a: 1, b: 2 }], url: "https://example.com", name: "A" }));
  assert.notEqual(resourceRevision({ name: "A", updatedAt: 1 }), resourceRevision({ name: "A", updatedAt: 2 }));
});
test("submission details preserve the author and do not fabricate legacy authors", () => {
  assert.equal(contributorName({ submittedBy: { id: "one", name: "Original author" }, updatedBy: "Editor" }), "Original author");
  assert.equal(contributorName({ createdBy: "one" }, [{ id: "one", data: { name: "Team member" } }]), "Team member");
  assert.equal(contributorName({}), "Unknown contributor");
  assert.equal(resourceDate({ seconds: 1790812800 }).toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(resourceDate("2026-10-01T00:00:00Z").toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(resourceDate(undefined), null);
});
