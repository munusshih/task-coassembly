import test from "node:test";
import assert from "node:assert/strict";
import { buildViewUrl, readViewUrl, isViewPath, isDateKey } from "../src/app/lib/viewUrl.mjs";
const url = (path) => new URL(path, "https://task.example");
const compact = (path, changes) => {
  const result = buildViewUrl(url(path), changes);
  return result.pathname + result.search + result.hash;
};

test("defaults are omitted, dates stay pinned, and legacy links normalize", () => {
  assert.equal(compact("/?tab=members&week=2026-10-12&taskView=member"), "/tasks?week=2026-10-12");
  assert.equal(compact("/?tab=meetingNotes&notesGroup=date&notesLayout=grid"), "/notes");
  assert.equal(compact("/?tab=finance&year=overall&quarter=overall&financeView=project&financeCategory=projects"), "/finance");
  assert.equal(compact("/?tab=projects&projectView=list"), "/projects");
});
test("switching tabs discards irrelevant filters", () => {
  assert.equal(compact("/tasks?week=2026-10-12&view=project", { tab: "meetingNotes" }), "/notes");
  assert.equal(compact("/?tab=projects&week=2026-10-12&notesSearch=hello&projectView=kanban"), "/projects?view=status");
  assert.equal(compact("/finance?year=2026&view=person", { tab: "members" }), "/tasks");
});
test("document paths keep complete stable IDs and drop note list controls", () => {
  const id = "bW0y5a1kJH6vZQ2L8cxP";
  assert.equal(compact("/notes?q=hello&group=project&layout=shelf", { note: id }), `/notes/${id}`);
  assert.equal(compact(`/?tab=meetingNotes&note=${id}`), `/notes/${id}`);
  assert.equal(compact(`/notes/${id}`, { note: null }), "/notes");
  assert.equal(compact("/projects", { project: id }), `/projects/${id}`);
  assert.equal(compact("/?tab=projects&project=one,two"), "/projects/two");
  const special = "Design & strategy?#";
  assert.equal(readViewUrl(buildViewUrl(url("/notes"), { note: special })).note, special);
});
test("short query keys restore the matching tab's controls", () => {
  assert.deepEqual(readViewUrl(url("/tasks?week=2026-10-12&view=project")), { tab: "members", week: "2026-10-12", taskView: "project" });
  assert.deepEqual(readViewUrl(url("/notes?q=hello&layout=shelf&group=project")), { tab: "meetingNotes", notesSearch: "hello", notesGroup: "project", notesLayout: "shelf" });
  assert.equal(compact("/finance?year=2026&view=person&category=non-projects"), "/finance?view=person&category=non-projects&year=2026");
});
test("invalid values and paths are rejected", () => {
  assert.equal(compact("/tasks?week=2026-02-31&view=bogus"), "/tasks");
  assert.equal(compact("/notes/bad%2Fid"), "/notes");
  assert.equal(compact("/notes/%E0%A4%A"), "/notes");
  assert.equal(compact("/finance?year=oops&quarter=2026-Q9"), "/finance");
  for (const parts of [["unknown"], ["tasks", "id"], ["notes", "id", "extra"], ["notes", ".."], ["notes", "bad/id"]]) assert.equal(isViewPath(parts), false);
  assert.equal(isViewPath(["notes", "stable-id"]), true);
  assert.equal(isDateKey("2024-02-29"), true);
  assert.equal(isDateKey("2025-02-29"), false);
});
test("normalization is idempotent and preserves unrelated params and hashes", () => {
  for (const path of ["/?tab=members&week=2026-10-12&taskView=project", "/notes/id", "/projects?view=status", "/finance?year=2026&view=person"]) {
    const once = compact(path);
    assert.equal(compact(once), once);
  }
  assert.equal(compact("/tasks?role=associate&week=2026-10-12#task"), "/tasks?role=associate&week=2026-10-12#task");
});

test("placeholder pages and nested finance requests have stable destinations", () => {
  assert.equal(isViewPath(["homepage"]), true);
  assert.equal(isViewPath(["settings"]), true);
  assert.equal(isViewPath(["finance", "requests"]), true);
  assert.deepEqual(readViewUrl(url("/finance/requests")), { tab: "payouts" });
  assert.equal(compact("/requests"), "/finance/requests");
  assert.equal(compact("/tasks", { tab: "homepage" }), "/homepage");
  assert.equal(compact("/tasks", { tab: "settings" }), "/settings");
});

test("Resource offers category or date, normalizing the removed free-arrange view", () => {
  assert.deepEqual(readViewUrl(url("/resources?view=date")), { tab: "resources", resourcesView: "date" });
  assert.equal(compact("/resources?view=free"), "/resources");
});


test("Members supports shareable role, weekly and overall views", () => {
  assert.deepEqual(readViewUrl(url("/members?view=weekly")), { tab: "memberDirectory", memberView: "weekly" });
  assert.equal(compact("/members", { memberView: "overall" }), "/members?view=overall");
  assert.equal(compact("/members?view=role"), "/members");
  assert.equal(compact("/members?view=rotation"), "/members");
  assert.equal(compact("/members?view=weekly", { tab: "resources" }), "/resources");
});

test('new project and wish grouping survives shared links and reloads',()=>{
 assert.equal(compact('/projects?view=status'),'/projects?view=status');
 assert.equal(compact('/projects?view=category'),'/projects');
 assert.equal(compact('/wishes?group=date'),'/wishes?group=date');
 assert.equal(compact('/wishes?group=project'),'/wishes');
});

test('member week ranges survive view changes and remain separate from Task weeks', () => {
 const url = buildViewUrl(new URL('https://example.test/members?view=weekly'), {memberWeek:'2026-10-12',memberEndWeek:'2026-10-26'});
 assert.equal(url.searchParams.get('week'),'2026-10-12');
 assert.equal(readViewUrl(url).memberEndWeek,'2026-10-26');
 const overall = buildViewUrl(url,{memberView:'overall'});
 assert.equal(readViewUrl(overall).memberWeek,'2026-10-12');
 const tasks = buildViewUrl(overall,{tab:'members'});
 assert.equal(readViewUrl(tasks).week,undefined);
 assert.equal(tasks.searchParams.has('endWeek'),false);
});
