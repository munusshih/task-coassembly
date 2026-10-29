import test from "node:test";
import assert from "node:assert/strict";
import { splitTaskBoardByViewer } from "../src/app/components/taskBoardScopes.mjs";

const members = [{ id: "alex" }, { id: "sam" }, { id: "jules" }];
const tasks = [
  { id: "a", data: { memberId: "alex" } },
  { id: "b", data: { memberId: "sam" } },
  { id: "c", data: { memberId: "jules" } },
  { id: "orphan", data: { memberId: "hidden" } },
];
test("ownership follows the signed-in member and separates their tasks from teammates", () => {
  for (const viewer of members) {
    const result = splitTaskBoardByViewer(members, tasks, viewer.id);
    assert.deepEqual(result.personal.members.map((m) => m.id), [viewer.id]);
    assert.ok(result.personal.tasks.every((t) => t.data.memberId === viewer.id));
    assert.ok(result.team.tasks.every((t) => t.data.memberId !== viewer.id));
    assert.equal(result.personal.tasks.length + result.team.tasks.length, 3);
    assert.equal(new Set([...result.personal.tasks, ...result.team.tasks].map((t) => t.id)).size, 3);
  }
});
test("already-restricted input never introduces teammates or orphan task records", () => {
  const result = splitTaskBoardByViewer([members[0]], tasks, "alex");
  assert.deepEqual(result.personal.tasks.map((t) => t.id), ["a"]);
  assert.deepEqual(result.team, { members: [], tasks: [] });
});
test("a missing member identity does not attribute somebody else's tasks to the viewer", () => {
  const result = splitTaskBoardByViewer(members, tasks, null);
  assert.deepEqual(result.personal, { members: [], tasks: [] });
  assert.equal(result.team.members.length, 3);
  assert.equal(result.team.tasks.length, 3);
});
