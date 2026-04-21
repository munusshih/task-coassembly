"use client";

export const PAPER_TEXTURES = Object.freeze({
  LINED: "lined",
  GRID: "grid",
  DOT: "dot",
  KRAFT: "kraft",
  LEDGER: "ledger",
  BLUEPRINT: "blueprint",
  PARCHMENT: "parchment",
  SPECKLE: "speckle",
});

const KNOWN_TEXTURES = new Set(Object.values(PAPER_TEXTURES));

export const SURFACE_TEXTURES = Object.freeze({
  backlogWishes: PAPER_TEXTURES.LEDGER,
  memberProjectBoard: PAPER_TEXTURES.LEDGER,
  notesComposer: PAPER_TEXTURES.GRID,
  projectCreate: PAPER_TEXTURES.DOT,
  projectKanban: PAPER_TEXTURES.BLUEPRINT,
  projectLedger: PAPER_TEXTURES.GRID,
  placeholder: PAPER_TEXTURES.KRAFT,
});

const MEMBER_TEXTURES = Object.freeze({
  "worker-owner": PAPER_TEXTURES.LINED,
  associate: PAPER_TEXTURES.GRID,
  contractor: PAPER_TEXTURES.KRAFT,
  "flying-member": PAPER_TEXTURES.BLUEPRINT,
  "external-collaborator": PAPER_TEXTURES.DOT,
});

const MEMBER_SNAPSHOT_TEXTURES = Object.freeze({
  "worker-owner": PAPER_TEXTURES.LEDGER,
  associate: PAPER_TEXTURES.PARCHMENT,
  contractor: PAPER_TEXTURES.KRAFT,
  "flying-member": PAPER_TEXTURES.BLUEPRINT,
  "external-collaborator": PAPER_TEXTURES.DOT,
});

const RESOURCE_TEXTURES = Object.freeze({
  projects: PAPER_TEXTURES.LINED,
  finance: PAPER_TEXTURES.GRID,
  admin: PAPER_TEXTURES.LEDGER,
  general: PAPER_TEXTURES.PARCHMENT,
  others: PAPER_TEXTURES.KRAFT,
});

const FALLBACK_RESOURCE_TEXTURES = [
  PAPER_TEXTURES.PARCHMENT,
  PAPER_TEXTURES.GRID,
  PAPER_TEXTURES.LEDGER,
  PAPER_TEXTURES.DOT,
  PAPER_TEXTURES.BLUEPRINT,
  PAPER_TEXTURES.KRAFT,
  PAPER_TEXTURES.LINED,
];

function normalizeMemberRole(roleValue) {
  const value = String(roleValue || "").trim().toLowerCase().replace(/[_\s]+/g, "-");
  if (value === "worker-owner" || value === "workerowner") return "worker-owner";
  if (value === "associate") return "associate";
  if (value === "contractor") return "contractor";
  if (value === "flying-member" || value === "flying") return "flying-member";
  if (value === "external-collaborator" || value === "external") return "external-collaborator";
  return "associate";
}

function normalizeCategory(value) {
  return String(value || "").trim().toLowerCase() || "general";
}

function hashText(value) {
  const text = String(value || "");
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function resolvePaperTexture(texture, fallback = PAPER_TEXTURES.LINED) {
  return KNOWN_TEXTURES.has(texture) ? texture : fallback;
}

export function memberPlanningTexture(roleValue) {
  const role = normalizeMemberRole(roleValue);
  return MEMBER_TEXTURES[role] || PAPER_TEXTURES.GRID;
}

export function memberSnapshotTexture(roleValue) {
  const role = normalizeMemberRole(roleValue);
  return MEMBER_SNAPSHOT_TEXTURES[role] || PAPER_TEXTURES.PARCHMENT;
}

export function memberDirectoryTexture(roleValue, active) {
  if (active === false) return PAPER_TEXTURES.SPECKLE;
  return memberPlanningTexture(roleValue);
}

export function resourceTexture(category) {
  const key = normalizeCategory(category);
  if (RESOURCE_TEXTURES[key]) return RESOURCE_TEXTURES[key];
  return FALLBACK_RESOURCE_TEXTURES[hashText(key) % FALLBACK_RESOURCE_TEXTURES.length];
}
