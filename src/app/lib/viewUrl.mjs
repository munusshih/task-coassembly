// A single schema owns the public URL contract. Component state names stay private.
export const TAB_PATHS = {
  homepage: "homepage",
  settings: "settings",
  members: "tasks",
  memberDirectory: "members",
  projects: "projects",
  backlog: "wishes",
  finance: "finance",
  payouts: "finance/requests",
  meetingNotes: "notes",
  resources: "resources",
};

export function isDocumentId(value) {
  return typeof value === "string" && Boolean(value) &&
    !value.includes("/") && value !== "." && value !== "..";
}

export function isDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const schema = {
  memberView: { tab: "memberDirectory", query: "view", default: "role", allowed: ["role", "weekly", "overall"] },
  week: { tab: "members", query: "week", validate: isDateKey },
  taskView: { tab: "members", query: "view", default: "member", allowed: ["member", "project", "resources"] },
  project: { tab: "projects", path: true, validate: isDocumentId },
  projectView: { tab: "projects", query: "view", default: "list", allowed: ["list", "kanban"] },
  note: { tab: "meetingNotes", path: true, validate: isDocumentId },
  notesSearch: { tab: "meetingNotes", query: "q" },
  notesGroup: { tab: "meetingNotes", query: "group", default: "date", allowed: ["date", "project"] },
  notesLayout: { tab: "meetingNotes", query: "layout", default: "grid", allowed: ["grid", "shelf"] },
  financeView: { tab: "finance", query: "view", default: "project", allowed: ["project", "person"] },
  financeCategory: { tab: "finance", query: "category", default: "projects", allowed: ["projects", "non-projects"] },
  year: { tab: "finance", query: "year", default: "overall", validate: (v) => v === "overall" || /^\d{4}$/.test(v) },
  quarter: { tab: "finance", query: "quarter", default: "overall", validate: (v) => v === "overall" || /^\d{4}-Q[1-4]$/.test(v) },
  resourcesView: { tab: "resources", query: "view", default: "category", allowed: ["category", "date"] },
  wishesSearch: { tab: "backlog", query: "q" },
};
const ownedQueries = new Set(["tab", "resourcesSearch", ...Object.keys(schema), ...Object.values(schema).map((s) => s.query).filter(Boolean)]);

function valid(spec, value) {
  return typeof value === "string" && value !== "" &&
    (!spec.allowed || spec.allowed.includes(value)) && (!spec.validate || spec.validate(value));
}

export function isViewPath(parts) {
  if (!Array.isArray(parts) || parts.length === 0) return false;
  if (parts.join("/") === "finance/requests" || parts.join("/") === "requests") return true;
  if (!Object.values(TAB_PATHS).includes(parts[0])) return false;
  if (parts.length === 1) return true;
  return parts.length === 2 && ["notes", "projects"].includes(parts[0]) && isDocumentId(parts[1]);
}

export function readViewUrl(url) {
  const parts = url.pathname.split("/").filter(Boolean);
  const pathTab = parts.join("/") === "requests" ? "payouts" : Object.keys(TAB_PATHS).find((tab) => TAB_PATHS[tab] === parts.join("/")) || Object.keys(TAB_PATHS).find((tab) => TAB_PATHS[tab] === parts[0]);
  const legacyTab = url.searchParams.get("tab");
  const tab = pathTab || (Object.hasOwn(TAB_PATHS, legacyTab) ? legacyTab : "members");
  const state = { tab };
  for (const [key, spec] of Object.entries(schema)) {
    if (spec.tab !== tab) continue;
    let value = spec.path && parts[1] ? safeDecode(parts[1]) :
      url.searchParams.get(spec.query || key) ?? url.searchParams.get(key);
    // Previous links could contain several expanded rows. The final row becomes the focus.
    if (key === "project" && value?.includes(",")) value = value.split(",").filter(Boolean).at(-1);
    if (valid(spec, value)) state[key] = value;
  }
  return state;
}

function safeDecode(value) {
  try { return decodeURIComponent(value); } catch { return null; }
}

export function buildViewUrl(input, updates = {}) {
  const url = new URL(input.href);
  const previous = readViewUrl(url);
  const changingTab = updates.tab && updates.tab !== previous.tab;
  const state = { ...(changingTab ? { tab: updates.tab } : previous), ...updates };
  if (!Object.hasOwn(TAB_PATHS, state.tab)) state.tab = "members";
  for (const key of ownedQueries) url.searchParams.delete(key);
  url.pathname = `/${TAB_PATHS[state.tab]}`;
  const focusKey = state.tab === "meetingNotes" ? "note" : state.tab === "projects" ? "project" : null;
  const focus = focusKey && valid(schema[focusKey], state[focusKey]) ? state[focusKey] : null;
  if (focus) url.pathname += `/${encodeURIComponent(focus)}`;
  for (const [key, spec] of Object.entries(schema)) {
    const value = state[key];
    if (spec.tab !== state.tab || spec.path || !valid(spec, value) || value === spec.default) continue;
    // The document is the destination; list filters are irrelevant while it is open.
    if (focusKey === "note" && focus) continue;
    url.searchParams.set(spec.query, value);
  }
  return url;
}

export function belongsToView(key, tab) {
  return key === "tab" || schema[key]?.tab === tab;
}

export function viewHref(tab) {
  return `/${TAB_PATHS[tab] || TAB_PATHS.members}`;
}
