import test from "node:test";
import assert from "node:assert/strict";
import { hasTaskLink } from "../src/app/components/taskCompletion.mjs";

test("completion requires a link URL, including legacy string links", () => {
  for (const data of [null, {}, { links: [] }, { links: [null, {}, { name: "Label only" }, { url: "  " }, " "] }]) {
    assert.equal(hasTaskLink(data), false);
  }
  assert.equal(hasTaskLink({ links: [{ name: "Deliverable", url: "https://example.com/work" }] }), true);
  assert.equal(hasTaskLink({ links: ["https://example.com/work"] }), true);
});
