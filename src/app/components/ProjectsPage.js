"use client";

import { useEffect, useState, useMemo } from "react";
import {
  subscribeCollection,
  createDocument,
  replaceDocument,
  updateDocumentsAtomically,
  deleteDocument,
} from "../../firestore";
import { firebaseReady } from "../../firebase";
import Button from "./Button";
import IconButton from "./IconButton";
import {
  DELETE_ICON,
  EDIT_ICON,
  KANBAN_VIEW_ICON,
  LIST_VIEW_ICON,
} from "./icons";
import CollectionLayout from "./ui/CollectionLayout";
import EmptyState from "./ui/EmptyState";
import InputField from "./ui/InputField";
import SelectField from "./ui/SelectField";
import ModalShell from "./ui/ModalShell";
import PageControls from "./ui/PageControls";
import { SURFACE_TEXTURES } from "./ui/paperTextures";
import SectionBlock from "./ui/SectionBlock";
import StatusStack from "./ui/StatusStack";
import TabPage from "./ui/TabPage";
import ViewToggle from "./ui/ViewToggle";
import DeleteConfirmDialog from "./ui/DeleteConfirmDialog";
import { isProjectClosed } from "./taskBoardRules";

// ─ Constants ───────────────────────────────────────────────────────────────────────────────────

const PROJECT_KINDS = [
  "Commissioned",
  "Self-funded",
  "Grant",
  "Internal",
  "Admin",
  "Pass-through",
];

const PROJECT_STATUSES = [
  "Scheduled",
  "In Progress",
  "Waiting for Response",
  "On Hold",
  "Completed",
  "Cancelled",
];

const STATUS_STYLE = {
  Scheduled: { bg: "#e8f0fe", color: "#3367d6" },
  "In Progress": { bg: "#e6f4ea", color: "#1e8e3e" },
  "Waiting for Response": { bg: "#fef7e0", color: "#b06000" },
  "On Hold": { bg: "#f0f0f0", color: "#888" },
  Completed: { bg: "#e8f5e9", color: "#2e7d32" },
  Cancelled: { bg: "#fce8e6", color: "#c5221f" },
};

const KIND_STYLE = {
  Commissioned: { bg: "#e3f0ff", color: "#1a5fcc" },
  "Self-funded": { bg: "#f0e8ff", color: "#6b21a8" },
  Grant: { bg: "#e0f7e9", color: "#1a7a3c" },
  Internal: { bg: "#f0f0ee", color: "#555" },
  Admin: { bg: "#fff3e0", color: "#a05000" },
  "Pass-through": { bg: "#e0f5f7", color: "#0f6e7a" },
};

// Staffing roles available per team member on a project
const STAFFING_ROLES = [
  { value: "lead", label: "Lead" },
  { value: "doer", label: "Delivery" },
  { value: "consultant", label: "Support" },
];

const USD_TO_TWD = 32;
const DONATION_OPTIONS = Array.from({ length: 11 }, (_, i) => i * 10);
const MIN_INTERNAL_ADMIN_HOURLY_TWD = 200;

const EMPTY_FORM = {
  name: "",
  kind: "",
  status: "",
  budget: "",
  budgetCurrency: "TWD",
  donationPercent: "20",
  companyTax: false,
  legacyMode: false,
  projectedHourlyWage: "",
  maxHours: "",
  startDate: "",
  endDate: "",
  // stagePlans: [{id, name, weeks, perspectiveHours, delayWeeks, order}]
  stagePlans: [],
  // staffing: [{id, memberId, roles: string[], maxHours, allocatedAmount}]
  staffing: [],
  // selfFunding: [{id, memberId, amount}]
  selfFunding: [],
};

// ─ Helpers ──────────────────────────────────────────────────────────────────────────────────────

function budgetToTWD(amount, currency) {
  const n = Number(amount);
  if (!n) return null;
  return currency === "USD" ? n * USD_TO_TWD : n;
}

function fmtTWD(amount) {
  if (amount == null) return null;
  return (
    "NT$" +
    new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount)
  );
}

function fmtUSD(amount) {
  if (amount == null) return null;
  return (
    "$" +
    new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount)
  );
}

function donationAmount(amountTWD, donationPercent) {
  if (amountTWD == null) return null;
  const pct = Number(donationPercent) || 0;
  return Math.round((amountTWD * pct) / 100);
}

function isInternalOrAdminKind(kind) {
  return kind === "Internal" || kind === "Admin";
}

function isPassThroughKind(kind) {
  return kind === "Pass-through";
}

function isSelfFundedKind(kind) {
  return kind === "Self-funded";
}

function fmtH(h) {
  if (!h) return "0h";
  const whole = Math.floor(h);
  const frac = h - whole;
  if (frac === 0) return `${whole}h`;
  if (frac === 0.25) return `${whole}h 15m`;
  if (frac === 0.5) return `${whole}h 30m`;
  if (frac === 0.75) return `${whole}h 45m`;
  return `${h.toFixed(1)}h`;
}

function assignedHours(tasks, projectId) {
  return tasks
    .filter((t) => t.data.projectId === projectId && !t.data.archived)
    .reduce((s, t) => s + (Number(t.data.timeUnits) || 0) * 0.25, 0);
}

function assignedHoursForMember(tasks, projectId, memberId) {
  return tasks
    .filter(
      (t) =>
        t.data.projectId === projectId &&
        t.data.memberId === memberId &&
        !t.data.archived,
    )
    .reduce((s, t) => s + (Number(t.data.timeUnits) || 0) * 0.25, 0);
}

function getWeekStartTs(ts) {
  const value = Number(ts);
  if (!Number.isFinite(value) || value <= 0) return 0;
  const d = new Date(value);
  const day = d.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

function finishedAtTs(taskData) {
  if (!taskData || typeof taskData !== "object") return 0;
  if (!taskData.completed && !taskData.archived) return 0;
  return (
    Number(taskData.archivedAt) ||
    Number(taskData.updatedAt) ||
    Number(taskData.createdAt) ||
    0
  );
}

function finishedHoursForMember(tasks, projectId, memberId, sinceTs = 0) {
  return tasks
    .filter(
      (t) => t.data.projectId === projectId && t.data.memberId === memberId,
    )
    .filter((t) => {
      const ts = finishedAtTs(t.data);
      return ts > 0 && (sinceTs <= 0 || ts >= sinceTs);
    })
    .reduce(
      (s, t) =>
        s +
        ((Number(t.data.timeUnits) || 0) +
          (Number(t.data.overtimeUnits) || 0)) *
          0.25,
      0,
    );
}

function totalWeeks(stagePlans) {
  if (!Array.isArray(stagePlans)) return 0;
  return stagePlans.reduce((s, sp) => s + (Number(sp.weeks) || 0), 0);
}

function addWeeks(dateStr, weeks) {
  if (!dateStr || !weeks) return null;
  const d = new Date(dateStr);
  d.setDate(d.getDate() + weeks * 7);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtDate(dateStr) {
  if (!dateStr) return null;
  const [y, mo, d] = dateStr.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function phaseNowLabel(startDate, stagePlans, endDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (endDate) {
    const end = new Date(endDate + "T00:00:00");
    end.setHours(0, 0, 0, 0);
    if (today > end) return `Completed · ended ${fmtDate(endDate)}`;
  }

  if (!Array.isArray(stagePlans) || stagePlans.length === 0) {
    return startDate
      ? `Not started · starts ${fmtDate(startDate)}`
      : "No stage plan";
  }

  const sorted = [...stagePlans].sort(
    (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0),
  );
  if (!startDate) return `Setup · ${sorted[0]?.name || "No stage"}`;

  const start = new Date(startDate + "T00:00:00");
  start.setHours(0, 0, 0, 0);

  if (today < start) return `Not started · starts ${fmtDate(startDate)}`;

  const elapsedWeeks = Math.floor(
    (today.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000),
  );
  let acc = 0;
  for (const sp of sorted) {
    const span = Math.max(1, Number(sp.weeks) || 0);
    acc += span;
    if (elapsedWeeks < acc) return sp.name || "Unnamed stage";
  }
  return "Completed";
}

function newUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function isAssignedToProject(project, memberId) {
  if (!project || !memberId) return false;
  const staffing = Array.isArray(project?.data?.staffing)
    ? project.data.staffing
    : [];
  return staffing.some((entry) => entry?.memberId === memberId);
}

function dedupeById(items) {
  const map = new Map();
  for (const item of items || []) {
    if (!item?.id) continue;
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
      continue;
    }

    const existingUpdated = Number(
      existing?.data?.updatedAt || existing?.data?.createdAt || 0,
    );
    const incomingUpdated = Number(
      item?.data?.updatedAt || item?.data?.createdAt || 0,
    );
    if (incomingUpdated >= existingUpdated) {
      map.set(item.id, item);
    }
  }
  return [...map.values()];
}

// ─ StagePlanEdit ────────────────────────────────────────────────────────────────────────────

// Inline editor for the stagePlans list
function StagePlanEdit({ stagePlans, onChange }) {
  function addStage() {
    onChange([
      ...stagePlans,
      {
        id: newUUID(),
        name: "",
        weeks: 1,
        perspectiveHours: "",
        order: stagePlans.length,
      },
    ]);
  }

  function removeStage(i) {
    const next = stagePlans
      .filter((_, idx) => idx !== i)
      .map((sp, idx) => ({ ...sp, order: idx }));
    onChange(next);
  }

  function setSpField(i, k, v) {
    const next = stagePlans.map((sp, idx) =>
      idx === i ? { ...sp, [k]: v } : sp,
    );
    onChange(next);
  }

  function stepWeeks(i, delta) {
    const sp = stagePlans[i];
    const next = Math.max(1, (Number(sp.weeks) || 1) + delta);
    setSpField(i, "weeks", next);
  }

  return (
    <div className="stage-list">
      {stagePlans.map((sp, i) => (
        <div key={sp.id || i} className="stage-row">
          <label className="stage-title-label">
            <span>Stage title</span>
            <InputField
              className="project-field stage-field--name"
              type="text"
              placeholder="Stage name"
              value={sp.name}
              onChange={(e) => setSpField(i, "name", e.target.value)}
            />
          </label>
          <div className="stage-row-nums">
            <div className="stage-num-label">
              <span>weeks</span>
              <div className="weeks-stepper">
                <button
                  type="button"
                  className="weeks-step-btn"
                  onClick={() => stepWeeks(i, -1)}
                >
                  −
                </button>
                <span className="weeks-step-val">{Number(sp.weeks) || 1}</span>
                <button
                  type="button"
                  className="weeks-step-btn"
                  onClick={() => stepWeeks(i, +1)}
                >
                  +
                </button>
              </div>
            </div>
            <label className="stage-num-label">
              <span>est. hours</span>
              <InputField
                className="project-field stage-field--num"
                type="number"
                placeholder="0"
                min="0"
                step="1"
                value={sp.perspectiveHours}
                onChange={(e) =>
                  setSpField(i, "perspectiveHours", e.target.value)
                }
              />
            </label>
          </div>
          <IconButton variant="delete" onClick={() => removeStage(i)}>
            {DELETE_ICON}
          </IconButton>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="small"
        className="stage-add-btn"
        onClick={addStage}
      >
        + Add stage
      </Button>
    </div>
  );
}

// ─ StaffingEdit ─────────────────────────────────────────────────────────────────────────────

// Multi-member assignment with roles + per-member maxHours
function StaffingEdit({
  staffing,
  members,
  onChange,
  hourly,
  legacyMode,
  singleMemberMode = false,
  autoPayByMemberId = {},
}) {
  function toggleMember(memberId) {
    const exists = staffing.find((s) => s.memberId === memberId);
    if (exists) {
      onChange(staffing.filter((s) => s.memberId !== memberId));
    } else {
      const nextEntry = {
        id: newUUID(),
        memberId,
        roles: ["doer"],
        maxHours: "",
        allocatedAmount: "",
      };
      onChange([...(singleMemberMode ? [] : staffing), nextEntry]);
    }
  }

  function setStaffField(memberId, k, v) {
    onChange(
      staffing.map((s) => (s.memberId === memberId ? { ...s, [k]: v } : s)),
    );
  }

  function setPrimaryRole(memberId, role) {
    const entry = staffing.find((s) => s.memberId === memberId);
    if (!entry) return;
    setStaffField(memberId, "roles", [role]);
  }

  return (
    <div className="staffing-list">
      <div className="staffing-grid-head">
        <span>Name</span>
        <span>Role</span>
        {legacyMode ? <span>Allocated (TWD)</span> : <span>Max hrs</span>}
        {!legacyMode && <span>Pay est.</span>}
      </div>
      {members.map((m) => {
        const entry = staffing.find((s) => s.memberId === m.id);
        const active = !!entry;
        const hours = Number(entry?.maxHours) || 0;
        const autoPay =
          autoPayByMemberId && autoPayByMemberId[m.id] != null
            ? Number(autoPayByMemberId[m.id])
            : null;
        const pay =
          autoPay != null
            ? autoPay
            : hourly != null
              ? Math.round(hourly * hours)
              : null;
        return (
          <div
            key={m.id}
            className={
              "staffing-member" + (active ? " staffing-member--on" : "")
            }
          >
            <label className="staffing-col staffing-col--name">
              <input
                type="checkbox"
                checked={active}
                onChange={() => toggleMember(m.id)}
              />
              <span className="staffing-member-name">
                {m.data.name || m.id}
              </span>
            </label>
            <div
              className="staffing-col staffing-col--roles"
              aria-label="Primary role"
            >
              {STAFFING_ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  disabled={!active}
                  className={
                    "role-chip" +
                    (active && entry.roles.includes(r.value)
                      ? " role-chip--on"
                      : "")
                  }
                  onClick={() => setPrimaryRole(m.id, r.value)}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {legacyMode ? (
              <label className="staffing-col staffing-col--hours">
                <InputField
                  className="project-field staffing-field--hours"
                  type="number"
                  placeholder="0"
                  min="0"
                  step="1"
                  disabled={!active}
                  value={active ? (entry.allocatedAmount ?? "") : ""}
                  onChange={(e) =>
                    setStaffField(m.id, "allocatedAmount", e.target.value)
                  }
                />
              </label>
            ) : (
              <>
                <label className="staffing-col staffing-col--hours">
                  <InputField
                    className="project-field staffing-field--hours"
                    type="number"
                    placeholder="0"
                    min="0"
                    step="1"
                    disabled={!active}
                    value={active ? entry.maxHours : ""}
                    onChange={(e) =>
                      setStaffField(m.id, "maxHours", e.target.value)
                    }
                  />
                </label>
                <div className="staffing-col staffing-col--pay">
                  {active ? (pay != null ? fmtTWD(pay) : "—") : "—"}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SelfFundingEdit({ selfFunding, members, onChange }) {
  function toggleMember(memberId) {
    const exists = selfFunding.find((s) => s.memberId === memberId);
    if (exists) {
      onChange(selfFunding.filter((s) => s.memberId !== memberId));
    } else {
      onChange([
        ...selfFunding,
        {
          id: newUUID(),
          memberId,
          amount: "",
        },
      ]);
    }
  }

  function setAmount(memberId, amount) {
    onChange(
      selfFunding.map((s) => (s.memberId === memberId ? { ...s, amount } : s)),
    );
  }

  return (
    <div className="staffing-list">
      <div className="staffing-grid-head">
        <span>Name</span>
        <span>Funding amount (TWD)</span>
      </div>
      {members.map((m) => {
        const entry = selfFunding.find((s) => s.memberId === m.id);
        const active = !!entry;
        return (
          <div
            key={m.id}
            className={
              "staffing-member" + (active ? " staffing-member--on" : "")
            }
          >
            <label className="staffing-col staffing-col--name">
              <input
                type="checkbox"
                checked={active}
                onChange={() => toggleMember(m.id)}
              />
              <span className="staffing-member-name">
                {m.data.name || m.id}
              </span>
            </label>
            <label className="staffing-col staffing-col--hours">
              <InputField
                className="project-field staffing-field--hours"
                type="number"
                placeholder="0"
                min="0"
                step="1"
                disabled={!active}
                value={active ? entry.amount : ""}
                onChange={(e) => setAmount(m.id, e.target.value)}
              />
            </label>
          </div>
        );
      })}
    </div>
  );
}

// ─ ProjectRow ──────────────────────────────────────────────────────────────────────────────────

function ProjectRow({
  project,
  allTasks,
  members,
  onSave,
  onComplete,
  onDelete,
}) {
  const d = project.data;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  // Normalize Firebase data to our form shape
  function normalizeStagePlans(raw) {
    if (!Array.isArray(raw)) return [];
    return [...raw]
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
      .map((sp) => ({
        id: sp.id || newUUID(),
        name: sp.name || "",
        weeks: sp.weeks != null ? String(sp.weeks) : "",
        perspectiveHours:
          sp.perspectiveHours != null ? String(sp.perspectiveHours) : "",
        order: sp.order != null ? Number(sp.order) : 0,
      }));
  }

  function normalizeStaffing(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map((s) => ({
      id: s.id || newUUID(),
      memberId: s.memberId || "",
      roles: Array.isArray(s.roles) ? s.roles : ["doer"],
      maxHours: s.maxHours != null ? String(s.maxHours) : "",
      allocatedAmount:
        s.allocatedAmount != null ? String(s.allocatedAmount) : "",
    }));
  }

  function normalizeSelfFunding(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map((s) => ({
      id: s.id || newUUID(),
      memberId: s.memberId || "",
      amount: s.amount != null ? String(s.amount) : "",
    }));
  }

  function buildFormFromProjectData(data) {
    return {
      name: data?.name || "",
      kind: data?.kind || "",
      status: data?.status || "",
      budget: data?.budget != null ? String(data.budget) : "",
      budgetCurrency: data?.budgetCurrency || "TWD",
      donationPercent:
        data?.donationPercent != null ? String(data.donationPercent) : "20",
      companyTax: Boolean(data?.companyTax),
      legacyMode: Boolean(data?.legacyMode),
      projectedHourlyWage:
        data?.projectedHourlyWage != null
          ? String(data.projectedHourlyWage)
          : "",
      maxHours: data?.maxHours != null ? String(data.maxHours) : "",
      startDate: data?.startDate || "",
      endDate: data?.endDate || "",
      stagePlans: normalizeStagePlans(data?.stagePlans),
      staffing: isPassThroughKind(data?.kind)
        ? normalizeStaffing(data?.staffing).slice(0, 1)
        : normalizeStaffing(data?.staffing),
      selfFunding: normalizeSelfFunding(data?.selfFunding),
    };
  }

  const initialForm = useMemo(() => buildFormFromProjectData(d), [d]);
  const [form, setForm] = useState(() => buildFormFromProjectData(d));

  useEffect(() => {
    if (!editing) setForm(buildFormFromProjectData(d));
  }, [d, editing]);

  const isFormDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm],
  );

  function resetEditForm() {
    setForm(buildFormFromProjectData(d));
  }

  function handleCancelEdit() {
    resetEditForm();
    setEditing(false);
  }

  function setField(k, v) {
    setForm((p) => {
      const next = { ...p, [k]: v };
      if (
        k === "kind" &&
        isInternalOrAdminKind(v) &&
        !String(next.projectedHourlyWage || "").trim()
      ) {
        next.projectedHourlyWage = String(MIN_INTERNAL_ADMIN_HOURLY_TWD);
      }
      return next;
    });
  }

  function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const internalOrAdmin = isInternalOrAdminKind(form.kind);
    const selfFunded = isSelfFundedKind(form.kind);
    const projectedHourlyWage = form.projectedHourlyWage
      ? Number(form.projectedHourlyWage)
      : null;
    if (
      internalOrAdmin &&
      (!Number.isFinite(projectedHourlyWage) ||
        projectedHourlyWage < MIN_INTERNAL_ADMIN_HOURLY_TWD)
    ) {
      window.alert(
        `For Internal/Admin projects, projected hourly wage must be at least NT$${MIN_INTERNAL_ADMIN_HOURLY_TWD}/h.`,
      );
      return;
    }

    const stagePlans = form.stagePlans
      .filter((sp) => sp.name.trim())
      .map((sp, idx) => ({
        id: sp.id,
        name: sp.name.trim(),
        weeks: Number(sp.weeks) || 0,
        perspectiveHours: Number(sp.perspectiveHours) || 0,
        order: idx,
      }));

    // Also keep `stages` as plain string array for compatibility
    const stages = stagePlans.map((sp) => sp.name);

    const staffing = form.staffing
      .filter((s) => s.memberId)
      .map((s) => ({
        id: s.id,
        memberId: s.memberId,
        roles: s.roles,
        maxHours: Number(s.maxHours) || 0,
        allocatedAmount: s.allocatedAmount ? Number(s.allocatedAmount) : null,
      }));
    const normalizedStaffing = isPassThroughKind(form.kind)
      ? staffing.slice(0, 1)
      : staffing;
    const normalizedSelfFunding = form.selfFunding
      .filter((s) => s.memberId)
      .map((s) => ({
        id: s.id,
        memberId: s.memberId,
        amount: Number(s.amount) || 0,
      }))
      .filter((s) => s.amount > 0);
    const selfFundingTotal = normalizedSelfFunding.reduce(
      (sum, entry) => sum + (Number(entry.amount) || 0),
      0,
    );

    onSave(project, {
      name: form.name.trim(),
      kind: form.kind || null,
      status: form.status || null,
      budget: selfFunded
        ? selfFundingTotal
        : form.budget
          ? Number(form.budget)
          : null,
      budgetCurrency: selfFunded ? "TWD" : form.budgetCurrency,
      donationPercent: selfFunded ? 0 : Number(form.donationPercent) || 0,
      companyTax: Boolean(form.companyTax),
      legacyMode: Boolean(form.legacyMode),
      projectedHourlyWage: internalOrAdmin ? projectedHourlyWage : null,
      maxHours: form.maxHours ? Number(form.maxHours) : null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      stagePlans,
      stages,
      staffing: normalizedStaffing,
      selfFunding: normalizedSelfFunding,
    });
    setEditing(false);
  }

  const hours = assignedHours(allTasks, project.id);
  const maxH = d.maxHours ? Number(d.maxHours) : null;
  const selfFunded = isSelfFundedKind(d.kind);
  const selfFundingRaw = Array.isArray(d.selfFunding) ? d.selfFunding : [];
  const selfFundingTotalRaw = selfFundingRaw.reduce(
    (sum, entry) => sum + (Number(entry?.amount) || 0),
    0,
  );
  const budgTWD = selfFunded
    ? selfFundingTotalRaw
    : budgetToTWD(d.budget, d.budgetCurrency);
  const internalOrAdmin = isInternalOrAdminKind(d.kind);
  const passThrough = isPassThroughKind(d.kind);
  const projectedHourlyWage =
    d.projectedHourlyWage != null ? Number(d.projectedHourlyWage) : null;
  const effectiveProjectedHourly =
    Number.isFinite(projectedHourlyWage) &&
    projectedHourlyWage >= MIN_INTERNAL_ADMIN_HOURLY_TWD
      ? projectedHourlyWage
      : null;
  const donationPct = selfFunded ? 0 : Number(d.donationPercent) || 0;
  const donationTWD = selfFunded ? 0 : donationAmount(budgTWD, donationPct);
  const companyTaxRate = d.companyTax ? 0.05 : 0;
  const companyTaxTWD =
    budgTWD != null ? Math.round(budgTWD * companyTaxRate) : null;
  const effectiveBudgetTWD =
    budgTWD != null
      ? Math.max(0, budgTWD - (donationTWD || 0) - (companyTaxTWD || 0))
      : null;
  const isLegacyMode = Boolean(d.legacyMode);
  const leadStaff = Array.isArray(d.staffing)
    ? d.staffing.find((s) => (s.roles || []).includes("lead"))
    : null;
  // Lead bonus: 5% of post-donation budget, always applied to non-Internal/Admin projects
  const leadBonusTWD =
    !internalOrAdmin && !passThrough && effectiveBudgetTWD != null
      ? Math.round(effectiveBudgetTWD * 0.05)
      : null;
  const teamDistributableTWD =
    effectiveBudgetTWD != null && leadBonusTWD != null
      ? effectiveBudgetTWD - leadBonusTWD
      : effectiveBudgetTWD;
  const budgetBasedHourly =
    teamDistributableTWD != null && maxH && maxH > 0
      ? Math.round(teamDistributableTWD / maxH)
      : null;
  const hourly = internalOrAdmin ? effectiveProjectedHourly : budgetBasedHourly;
  const burnSoFarTWD = hourly != null ? Math.round(hours * hourly) : null;
  const projectedBurnAtMaxTWD =
    hourly != null && maxH != null ? Math.round(maxH * hourly) : null;
  const remainingHours = maxH != null ? Math.max(0, maxH - hours) : null;
  const twks = totalWeeks(d.stagePlans);
  const statusSt = d.status ? STATUS_STYLE[d.status] || {} : {};
  const stagePlannedHours = Array.isArray(d.stagePlans)
    ? d.stagePlans.reduce((s, sp) => s + (Number(sp.perspectiveHours) || 0), 0)
    : 0;
  const stageAssignableLeft = maxH != null ? maxH - stagePlannedHours : null;

  // Resolve staffing entries to member objects
  const staffingResolved = useMemo(() => {
    if (!Array.isArray(d.staffing)) return [];
    return d.staffing.map((s) => ({
      ...s,
      member: members.find((m) => m.id === s.memberId),
    }));
  }, [d.staffing, members]);

  const selfFundingResolved = useMemo(() => {
    const raw = Array.isArray(d.selfFunding) ? d.selfFunding : [];
    return raw
      .map((entry) => ({
        ...entry,
        member: members.find((m) => m.id === entry.memberId),
        amount: Number(entry.amount) || 0,
      }))
      .filter((entry) => entry.amount > 0);
  }, [d.selfFunding, members]);

  const selfFundingTotal = useMemo(
    () =>
      selfFundingResolved.reduce(
        (sum, entry) => sum + (Number(entry.amount) || 0),
        0,
      ),
    [selfFundingResolved],
  );

  const sortedStagePlans = useMemo(() => {
    if (!Array.isArray(d.stagePlans)) return [];
    return [...d.stagePlans].sort(
      (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0),
    );
  }, [d.stagePlans]);

  const phaseNow = useMemo(
    () => phaseNowLabel(d.startDate, sortedStagePlans, d.endDate),
    [d.startDate, sortedStagePlans, d.endDate],
  );

  const teamMaxHours = useMemo(() => {
    if (!Array.isArray(d.staffing)) return 0;
    return d.staffing.reduce(
      (s, entry) => s + (Number(entry.maxHours) || 0),
      0,
    );
  }, [d.staffing]);

  const unassignedTeamHours =
    maxH != null ? Math.max(0, maxH - teamMaxHours) : null;

  const teamWorkedHours = useMemo(() => {
    if (!Array.isArray(d.staffing)) return 0;
    return d.staffing.reduce(
      (s, entry) =>
        s + assignedHoursForMember(allTasks, project.id, entry.memberId),
      0,
    );
  }, [d.staffing, allTasks, project.id]);

  const weekStartTs = useMemo(() => getWeekStartTs(Date.now()), []);

  const finishedByMember = useMemo(() => {
    if (!Array.isArray(d.staffing)) return {};
    const map = {};
    for (const entry of d.staffing) {
      const memberId = entry?.memberId;
      if (!memberId) continue;
      map[memberId] = {
        week: finishedHoursForMember(
          allTasks,
          project.id,
          memberId,
          weekStartTs,
        ),
        total: finishedHoursForMember(allTasks, project.id, memberId, 0),
      };
    }
    return map;
  }, [d.staffing, allTasks, project.id, weekStartTs]);

  if (editing) {
    const formInternalOrAdmin = isInternalOrAdminKind(form.kind);
    const formPassThrough = isPassThroughKind(form.kind);
    const formProjectedHourly = form.projectedHourlyWage
      ? Number(form.projectedHourlyWage)
      : null;
    const formProjectedHourlyValid =
      Number.isFinite(formProjectedHourly) &&
      formProjectedHourly >= MIN_INTERNAL_ADMIN_HOURLY_TWD
        ? formProjectedHourly
        : null;
    const formSelfFunded = isSelfFundedKind(form.kind);
    const formSelfFundingTotal = form.selfFunding.reduce(
      (sum, entry) => sum + (Number(entry.amount) || 0),
      0,
    );
    const formBudgetTWD = formSelfFunded
      ? formSelfFundingTotal
      : budgetToTWD(form.budget, form.budgetCurrency);
    const formDonationTWD = formSelfFunded
      ? 0
      : donationAmount(formBudgetTWD, form.donationPercent);
    const formCompanyTaxTWD =
      form.companyTax && formBudgetTWD != null
        ? Math.round(formBudgetTWD * 0.05)
        : null;
    const formEffectiveBudgetTWD =
      formBudgetTWD != null
        ? Math.max(
            0,
            formBudgetTWD - (formDonationTWD || 0) - (formCompanyTaxTWD || 0),
          )
        : null;
    // Lead bonus always applies to non-Internal/Admin projects
    const formLeadBonusTWD =
      !formInternalOrAdmin && !formPassThrough && formEffectiveBudgetTWD != null
        ? Math.round(formEffectiveBudgetTWD * 0.05)
        : null;
    const formTeamDistributableTWD =
      formEffectiveBudgetTWD != null && formLeadBonusTWD != null
        ? formEffectiveBudgetTWD - formLeadBonusTWD
        : formEffectiveBudgetTWD;
    const formBudgetHourly =
      formTeamDistributableTWD != null && Number(form.maxHours) > 0
        ? Math.round(formTeamDistributableTWD / Number(form.maxHours))
        : null;
    const formHourly = formInternalOrAdmin
      ? formProjectedHourlyValid
      : formBudgetHourly;
    const formStagePlannedHours = form.stagePlans.reduce(
      (s, sp) => s + (Number(sp.perspectiveHours) || 0),
      0,
    );
    const formStageAssignableLeft = form.maxHours
      ? Number(form.maxHours) - formStagePlannedHours
      : null;
    const formStaffingHours = form.staffing.reduce(
      (s, entry) => s + (Number(entry.maxHours) || 0),
      0,
    );
    const formStaffingUnassigned = form.maxHours
      ? Math.max(0, Number(form.maxHours) - formStaffingHours)
      : null;
    const passThroughAutoPayByMemberId =
      formPassThrough &&
      form.staffing.length === 1 &&
      formTeamDistributableTWD != null
        ? { [form.staffing[0].memberId]: formTeamDistributableTWD }
        : {};

    return (
      <li className="project-row">
        <ModalShell
          title={form.name || "Edit project"}
          onClose={handleCancelEdit}
          hasUnsavedChanges={isFormDirty}
          unsavedWarning="You have unsaved project changes. Closing now will discard them."
          onDiscardChanges={resetEditForm}
          size="lg"
          bodyClassName="project-edit-modal-body"
        >
          {isFormDirty ? (
            <p className="finance-section-note">Unsaved changes</p>
          ) : null}
          <form className="project-edit-form" onSubmit={handleSave}>
            {/* Section 1: Core info */}
            <div className="edit-field-grid">
              <label className="edit-field-group edit-field-group--wide">
                <span className="edit-field-label">Project name *</span>
                <InputField
                  className="project-field"
                  type="text"
                  placeholder="e.g. Asian Labor Future Index Site"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  autoFocus
                  required
                />
              </label>
              <label className="edit-field-group">
                <span className="edit-field-label">Kind</span>
                <SelectField
                  className="project-field"
                  value={form.kind}
                  onChange={(e) => setField("kind", e.target.value)}
                >
                  <option value="">Select…</option>
                  {PROJECT_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </SelectField>
              </label>
              <label className="edit-field-group">
                <span className="edit-field-label">Status</span>
                <SelectField
                  className="project-field"
                  value={form.status}
                  onChange={(e) => setField("status", e.target.value)}
                >
                  <option value="">Select…</option>
                  {PROJECT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </SelectField>
              </label>
              <label className="edit-field-group">
                <span className="edit-field-label">Start date</span>
                <InputField
                  className="project-field"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setField("startDate", e.target.value)}
                />
              </label>
              <label className="edit-field-group">
                <span className="edit-field-label">End date</span>
                <InputField
                  className="project-field"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setField("endDate", e.target.value)}
                />
              </label>
              {form.kind === "Self-funded" ? (
                <div className="edit-field-group">
                  <span className="edit-field-label">
                    Budget (from self funding)
                  </span>
                  <p className="finance-section-note">
                    {fmtTWD(formSelfFundingTotal)}
                  </p>
                </div>
              ) : (
                <>
                  <div className="edit-field-group">
                    <span className="edit-field-label">Budget</span>
                    <div className="project-budget-group">
                      <InputField
                        className="project-field project-field--budget"
                        type="number"
                        placeholder="Amount"
                        min="0"
                        step="1"
                        value={form.budget}
                        onChange={(e) => setField("budget", e.target.value)}
                      />
                      <SelectField
                        className="project-field project-field--currency"
                        value={form.budgetCurrency}
                        onChange={(e) =>
                          setField("budgetCurrency", e.target.value)
                        }
                      >
                        <option value="TWD">TWD</option>
                        <option value="USD">USD</option>
                      </SelectField>
                    </div>
                  </div>
                  <label className="edit-field-group">
                    <span className="edit-field-label">Donation %</span>
                    <SelectField
                      className="project-field"
                      value={form.donationPercent}
                      onChange={(e) =>
                        setField("donationPercent", e.target.value)
                      }
                    >
                      {DONATION_OPTIONS.map((pct) => (
                        <option key={pct} value={pct}>
                          {pct}%
                        </option>
                      ))}
                    </SelectField>
                  </label>
                </>
              )}
              <div className="edit-field-group edit-field-group--checkbox-row">
                <label className="edit-checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.companyTax}
                    onChange={(e) => setField("companyTax", e.target.checked)}
                  />
                  <span>Company tax 5%</span>
                </label>
                <label className="edit-checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.legacyMode}
                    onChange={(e) => setField("legacyMode", e.target.checked)}
                  />
                  <span>Legacy mode</span>
                  <span className="edit-checkbox-hint">
                    Past projects — set allocated amounts directly
                  </span>
                </label>
              </div>
              {formInternalOrAdmin && (
                <label className="edit-field-group">
                  <span className="edit-field-label">
                    Projected hourly wage (TWD)
                  </span>
                  <InputField
                    className="project-field"
                    type="number"
                    placeholder={`min ${MIN_INTERNAL_ADMIN_HOURLY_TWD}`}
                    min={MIN_INTERNAL_ADMIN_HOURLY_TWD}
                    step="1"
                    value={form.projectedHourlyWage}
                    onChange={(e) =>
                      setField("projectedHourlyWage", e.target.value)
                    }
                  />
                </label>
              )}
              <label className="edit-field-group">
                <span className="edit-field-label">Max billable hours</span>
                <InputField
                  className="project-field"
                  type="number"
                  placeholder="e.g. 150"
                  min="0"
                  step="1"
                  value={form.maxHours}
                  onChange={(e) => setField("maxHours", e.target.value)}
                />
              </label>
            </div>

            {/* Stage plans */}
            <details className="project-edit-section edit-disclosure">
              <summary className="edit-disclosure-summary">
                <span className="project-edit-label">Stage plan</span>
                <span className="project-edit-metric">
                  Equation:{" "}
                  {form.maxHours
                    ? `${fmtH(Number(form.maxHours) || 0)} - ${fmtH(formStagePlannedHours)} = ${fmtH(formStageAssignableLeft)}`
                    : "Set max hours"}
                </span>
              </summary>
              <div className="edit-disclosure-body">
                <StagePlanEdit
                  stagePlans={form.stagePlans}
                  onChange={(v) => setField("stagePlans", v)}
                />
              </div>
            </details>

            {/* Staffing */}
            {members.length > 0 && (
              <details className="project-edit-section edit-disclosure">
                <summary className="edit-disclosure-summary">
                  <span className="project-edit-label">Team staffing</span>
                  <span className="project-edit-metric">
                    Capacity: {fmtH(formStaffingHours)}
                    {form.maxHours
                      ? ` / ${fmtH(Number(form.maxHours) || 0)}`
                      : ""}
                    {formStaffingUnassigned != null
                      ? ` · Unassigned: ${fmtH(formStaffingUnassigned)}`
                      : ""}
                  </span>
                </summary>
                <div className="edit-disclosure-body">
                  <StaffingEdit
                    staffing={form.staffing}
                    members={members}
                    onChange={(v) => setField("staffing", v)}
                    hourly={formHourly}
                    legacyMode={form.legacyMode}
                    singleMemberMode={formPassThrough}
                    autoPayByMemberId={passThroughAutoPayByMemberId}
                  />
                </div>
              </details>
            )}

            {members.length > 0 && form.kind === "Self-funded" && (
              <details className="project-edit-section edit-disclosure">
                <summary className="edit-disclosure-summary">
                  <span className="project-edit-label">Self funding</span>
                  <span className="project-edit-metric">
                    Total funded: {fmtTWD(formSelfFundingTotal)}
                  </span>
                </summary>
                <div className="edit-disclosure-body">
                  <SelfFundingEdit
                    selfFunding={form.selfFunding}
                    members={members}
                    onChange={(v) => setField("selfFunding", v)}
                  />
                </div>
              </details>
            )}

            <div className="edit-modal-footer">
              <Button type="submit" size="small" disabled={!form.name.trim()}>
                Save
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="small"
                onClick={handleCancelEdit}
              >
                Cancel
              </Button>
            </div>
          </form>
        </ModalShell>
      </li>
    );
  }

  return (
    <li className={"project-row" + (open ? " project-row--open" : "")}>
      {/* Summary row */}
      <div className="project-row-summary" onClick={() => setOpen((s) => !s)}>
        <div className="project-row-main">
          <span className="project-row-name">{d.name || "Unnamed"}</span>
          <div className="project-row-badges">
            {d.status && (
              <span
                className="project-row-status"
                style={{ background: statusSt.bg, color: statusSt.color }}
              >
                {d.status}
              </span>
            )}
            {d.kind && (
              <span
                className="project-row-kind"
                style={
                  KIND_STYLE[d.kind]
                    ? {
                        background: KIND_STYLE[d.kind].bg,
                        color: KIND_STYLE[d.kind].color,
                      }
                    : {}
                }
              >
                {d.kind}
              </span>
            )}
          </div>
        </div>

        <div className="project-row-budget-cell">
          {internalOrAdmin ? (
            hourly != null ? (
              <>
                <span className="project-row-budget-twd">
                  {projectedBurnAtMaxTWD != null
                    ? fmtTWD(projectedBurnAtMaxTWD)
                    : fmtTWD(burnSoFarTWD)}
                </span>
                <span className="project-row-budget-orig">
                  Burned {burnSoFarTWD != null ? fmtTWD(burnSoFarTWD) : "—"} ·{" "}
                  {fmtTWD(hourly)}/h
                </span>
                {projectedBurnAtMaxTWD != null && (
                  <span className="project-row-budget-orig">
                    Projected at max hours
                  </span>
                )}
              </>
            ) : (
              <span className="project-row-empty">
                Set projected hourly ≥ NT${MIN_INTERNAL_ADMIN_HOURLY_TWD}
              </span>
            )
          ) : budgTWD != null ? (
            <>
              <span className="project-row-budget-twd">{fmtTWD(budgTWD)}</span>
              {selfFunded ? (
                <span className="project-row-budget-orig">
                  From self funding
                </span>
              ) : (
                <span className="project-row-budget-orig">
                  Donation {donationPct}%
                  {donationTWD != null ? ` · ${fmtTWD(donationTWD)}` : ""}
                </span>
              )}
              {d.budgetCurrency === "USD" && d.budget && (
                <span className="project-row-budget-orig">
                  {fmtUSD(d.budget)} USD
                </span>
              )}
            </>
          ) : (
            <span className="project-row-empty">—</span>
          )}
        </div>

        <div className="project-row-hours-cell">
          <span className="project-row-hours-assigned">{fmtH(hours)}</span>
          {maxH != null && (
            <span className="project-row-hours-max">/ {fmtH(maxH)}</span>
          )}
        </div>

        <div className="project-row-wage-cell">
          {hourly != null ? (
            <span className="project-row-wage">
              {fmtTWD(hourly)}
              <span className="project-row-wage-unit">/h</span>
            </span>
          ) : (
            <span className="project-row-empty">—</span>
          )}
        </div>

        <div
          className="project-row-actions"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="project-row-chevron">{open ? "▴" : "▾"}</span>
          {onComplete && !isProjectClosed(project) ? (
            <Button
              type="button"
              size="small"
              variant="secondary"
              className="project-complete-btn"
              onClick={() => onComplete(project)}
            >
              Complete
            </Button>
          ) : null}
          <IconButton onClick={() => setEditing(true)} title="Edit">
            {EDIT_ICON}
          </IconButton>
          <IconButton
            variant="delete"
            onClick={() => onDelete(project)}
            title="Delete"
          >
            {DELETE_ICON}
          </IconButton>
        </div>
      </div>

      {sortedStagePlans.length > 0 && (
        <div
          className="project-row-condensed"
          onClick={() => setOpen((s) => !s)}
        >
          <div className="condensed-topline">
            <div className="condensed-phase-block">
              <span className="condensed-label">Current phase</span>
              <span className="condensed-phase-val">{phaseNow}</span>
            </div>
            <div className="condensed-phase-meta">
              {d.status && (
                <span
                  className="condensed-status"
                  style={{ background: statusSt.bg, color: statusSt.color }}
                >
                  {d.status}
                </span>
              )}
              <span className="condensed-value condensed-value--highlight">
                {remainingHours != null
                  ? `${fmtH(remainingHours)} task hours left`
                  : "Set max hours"}
              </span>
            </div>
          </div>

          {maxH != null && (
            <div
              className="condensed-progress-track"
              role="img"
              aria-label={`Assigned ${fmtH(hours)} out of ${fmtH(maxH)}`}
            >
              <div
                className="condensed-progress-fill"
                style={{
                  width: `${Math.max(0, Math.min(100, Math.round((hours / Math.max(1, maxH)) * 100)))}%`,
                }}
              />
            </div>
          )}

          <div className="condensed-chip-row">
            <span className="condensed-chip">
              <strong>Stages</strong> {sortedStagePlans.length}
            </span>
            <span className="condensed-chip">
              <strong>Team</strong> {staffingResolved.length || 0}
            </span>
            {stageAssignableLeft != null && (
              <span className="condensed-chip condensed-chip--warn">
                <strong>Stage plan left</strong>{" "}
                {fmtH(Math.max(0, stageAssignableLeft))}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Expanded detail panel */}
      {open && (
        <div className="project-detail">
          {/* ── Primary zone: hero + ledger ── */}
          <div className="detail-primary">
            {/* Left: Hero stat (hourly rate) + hours progress */}
            <div className="detail-hero">
              <div className="detail-hero-stat">
                <span className="detail-hero-label">
                  {internalOrAdmin ? "Burn rate" : "Hourly wage"}
                </span>
                <span className="detail-hero-value">
                  {hourly != null ? fmtTWD(hourly) : "—"}
                  {hourly != null && (
                    <span className="detail-hero-unit">/h</span>
                  )}
                </span>
                {!internalOrAdmin && maxH != null && hourly != null && (
                  <span className="detail-hero-sub">
                    {fmtTWD(teamDistributableTWD)} ÷ {fmtH(maxH)}
                  </span>
                )}
                {internalOrAdmin && burnSoFarTWD != null && (
                  <span className="detail-hero-sub">
                    Burned {fmtTWD(burnSoFarTWD)}
                    {projectedBurnAtMaxTWD != null
                      ? ` · max ${fmtTWD(projectedBurnAtMaxTWD)}`
                      : ""}
                  </span>
                )}
              </div>

              {maxH != null && (
                <div className="detail-progress">
                  <div className="detail-progress-bars">
                    <div
                      className="detail-progress-track"
                      title={`Tasks: ${fmtH(hours)}`}
                    >
                      <div
                        className="detail-progress-fill detail-progress-fill--tasks"
                        style={{
                          width: `${Math.max(0, Math.min(100, (hours / maxH) * 100))}%`,
                        }}
                      />
                    </div>
                    {stagePlannedHours > 0 && (
                      <div
                        className="detail-progress-track"
                        title={`Stage plan: ${fmtH(stagePlannedHours)}`}
                      >
                        <div
                          className="detail-progress-fill detail-progress-fill--stage"
                          style={{
                            width: `${Math.max(0, Math.min(100, (stagePlannedHours / maxH) * 100))}%`,
                          }}
                        />
                      </div>
                    )}
                    {teamMaxHours > 0 && (
                      <div
                        className="detail-progress-track"
                        title={`Team capacity: ${fmtH(teamMaxHours)}`}
                      >
                        <div
                          className="detail-progress-fill detail-progress-fill--team"
                          style={{
                            width: `${Math.max(0, Math.min(100, (teamMaxHours / maxH) * 100))}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="detail-progress-legend">
                    <span className="detail-legend-item">
                      <i className="detail-legend-dot detail-legend-dot--tasks" />
                      Tasks {fmtH(hours)}
                    </span>
                    {stagePlannedHours > 0 && (
                      <span className="detail-legend-item">
                        <i className="detail-legend-dot detail-legend-dot--stage" />
                        Stage {fmtH(stagePlannedHours)}
                      </span>
                    )}
                    {teamMaxHours > 0 && (
                      <span className="detail-legend-item">
                        <i className="detail-legend-dot detail-legend-dot--team" />
                        Team {fmtH(teamMaxHours)}
                      </span>
                    )}
                    <span className="detail-legend-max">of {fmtH(maxH)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Budget ledger */}
            {!internalOrAdmin && budgTWD != null && (
              <div className="detail-ledger">
                <div className="detail-ledger-row">
                  <span className="detail-ledger-label">Budget</span>
                  <span className="detail-ledger-val">
                    {fmtTWD(budgTWD)}
                    {d.budgetCurrency === "USD" && d.budget ? (
                      <span className="detail-ledger-orig">
                        {" "}
                        {fmtUSD(d.budget)}
                      </span>
                    ) : null}
                  </span>
                </div>
                {!selfFunded && (
                  <div className="detail-ledger-row detail-ledger-row--deduct">
                    <span className="detail-ledger-label">
                      Donation {donationPct}%
                    </span>
                    <span className="detail-ledger-val detail-ledger-val--deduct">
                      −{fmtTWD(donationTWD)}
                    </span>
                  </div>
                )}
                {companyTaxTWD != null && companyTaxTWD > 0 && (
                  <div className="detail-ledger-row detail-ledger-row--deduct">
                    <span className="detail-ledger-label">Company tax 5%</span>
                    <span className="detail-ledger-val detail-ledger-val--deduct">
                      −{fmtTWD(companyTaxTWD)}
                    </span>
                  </div>
                )}
                {leadBonusTWD != null && (
                  <div className="detail-ledger-row detail-ledger-row--deduct">
                    <span className="detail-ledger-label">
                      Lead bonus 5%
                      {leadStaff ? (
                        <span className="detail-ledger-who">
                          {" "}
                          ·{" "}
                          {staffingResolved.find((s) =>
                            (s.roles || []).includes("lead"),
                          )?.member?.data?.name || "lead"}
                        </span>
                      ) : (
                        ""
                      )}
                    </span>
                    <span className="detail-ledger-val detail-ledger-val--deduct">
                      −{fmtTWD(leadBonusTWD)}
                    </span>
                  </div>
                )}
                <div className="detail-ledger-divider" />
                <div className="detail-ledger-row detail-ledger-row--total">
                  <span className="detail-ledger-label">
                    Team distributable
                  </span>
                  <span className="detail-ledger-val">
                    {fmtTWD(teamDistributableTWD)}
                  </span>
                </div>
              </div>
            )}
            {internalOrAdmin && (
              <div className="detail-ledger">
                <div className="detail-ledger-row">
                  <span className="detail-ledger-label">Projected rate</span>
                  <span className="detail-ledger-val">
                    {hourly != null ? `${fmtTWD(hourly)}/h` : "—"}
                  </span>
                </div>
                <div className="detail-ledger-row">
                  <span className="detail-ledger-label">Min rate</span>
                  <span className="detail-ledger-val">
                    NT${MIN_INTERNAL_ADMIN_HOURLY_TWD}/h
                  </span>
                </div>
                <div className="detail-ledger-divider" />
                <div className="detail-ledger-row">
                  <span className="detail-ledger-label">Burned so far</span>
                  <span className="detail-ledger-val">
                    {burnSoFarTWD != null ? fmtTWD(burnSoFarTWD) : "—"}
                  </span>
                </div>
                {projectedBurnAtMaxTWD != null && (
                  <div className="detail-ledger-row">
                    <span className="detail-ledger-label">
                      Projected at max
                    </span>
                    <span className="detail-ledger-val">
                      {fmtTWD(projectedBurnAtMaxTWD)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Stage timeline ── */}
          {sortedStagePlans.length > 0 && (
            <div className="detail-timeline">
              <div className="detail-section-head">
                <span className="detail-section-label">Stage plan</span>
                <span className="detail-section-meta">{phaseNow}</span>
              </div>
              <div className="timeline-track">
                {sortedStagePlans.map((sp, i) => {
                  const wks = Number(sp.weeks) || 1;
                  const totalW = totalWeeks(sortedStagePlans) || 1;
                  const flex = wks / totalW;
                  return (
                    <div
                      key={sp.id || i}
                      className="timeline-stage"
                      style={{ flex }}
                    >
                      <div
                        className="timeline-bar"
                        style={{
                          opacity: 0.12 + (i / sortedStagePlans.length) * 0.55,
                        }}
                      />
                      <span className="timeline-stage-name">{sp.name}</span>
                      <span className="timeline-stage-meta">
                        {wks}w
                        {sp.perspectiveHours > 0
                          ? ` · ${sp.perspectiveHours}h`
                          : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Team ── */}
          <div className="detail-team">
            <div className="detail-section-head">
              <span className="detail-section-label">Team</span>
              {isLegacyMode && (
                <span className="detail-section-badge detail-section-badge--legacy">
                  Legacy
                </span>
              )}
              <span className="detail-section-meta">
                {isLegacyMode
                  ? `${staffingResolved.length} member${staffingResolved.length !== 1 ? "s" : ""}`
                  : `${fmtH(teamMaxHours)}${maxH != null ? ` / ${fmtH(maxH)}` : ""}${unassignedTeamHours != null && unassignedTeamHours > 0 ? ` · ${fmtH(unassignedTeamHours)} unassigned` : ""}${teamWorkedHours > 0 ? ` · ${fmtH(teamWorkedHours)} worked` : ""}`}
              </span>
            </div>
            {staffingResolved.length === 0 ? (
              <p className="snapshot-empty">No team assigned yet.</p>
            ) : (
              <div className="detail-team-table">
                <div className="detail-team-thead">
                  <span>Name</span>
                  {!isLegacyMode && <span>Role</span>}
                  <span>{isLegacyMode ? "Allocated" : "Allocated"}</span>
                  {!isLegacyMode && <span>Worked</span>}
                  <span>Pay est.</span>
                </div>
                {staffingResolved.map((s, i) => {
                  const isLead = (s.roles || []).includes("lead");
                  const workedHours = assignedHoursForMember(
                    allTasks,
                    project.id,
                    s.memberId,
                  );
                  const legacyAllocated =
                    s.allocatedAmount != null
                      ? Number(s.allocatedAmount)
                      : null;
                  const payEst = isLegacyMode
                    ? legacyAllocated
                    : hourly != null
                      ? Math.round((Number(s.maxHours) || 0) * hourly)
                      : null;
                  const totalPay =
                    passThrough && staffingResolved.length === 1
                      ? teamDistributableTWD
                      : isLead && leadBonusTWD != null && payEst != null
                        ? payEst + leadBonusTWD
                        : payEst;
                  const workedPay =
                    hourly != null ? Math.round(workedHours * hourly) : null;
                  const finished = finishedByMember[s.memberId] || {
                    week: 0,
                    total: 0,
                  };
                  return (
                    <div
                      key={s.id || i}
                      className={
                        "detail-team-row" +
                        (isLead && !isLegacyMode
                          ? " detail-team-row--lead"
                          : "")
                      }
                    >
                      <span className="detail-team-name">
                        {s.member?.data?.name || s.memberId}
                      </span>
                      {!isLegacyMode && (
                        <span className="detail-team-role">
                          {STAFFING_ROLES.find(
                            (sr) => sr.value === (s.roles || [])[0],
                          )?.label || "—"}
                        </span>
                      )}
                      <span className="detail-team-hours">
                        {isLegacyMode
                          ? legacyAllocated != null
                            ? fmtTWD(legacyAllocated)
                            : "—"
                          : s.maxHours > 0
                            ? `${s.maxHours}h`
                            : "—"}
                        {!isLegacyMode && (
                          <span className="detail-team-hours-meta">
                            done {fmtH(finished.week)} this week ·{" "}
                            {fmtH(finished.total)} total
                          </span>
                        )}
                      </span>
                      {!isLegacyMode && (
                        <span className="detail-team-worked">
                          {workedHours > 0 ? `${workedHours}h` : "—"}
                          {workedPay != null && workedPay > 0 && (
                            <span className="detail-team-worked-pay">
                              {" "}
                              · {fmtTWD(workedPay)}
                            </span>
                          )}
                        </span>
                      )}
                      <span className="detail-team-pay">
                        {totalPay != null ? fmtTWD(totalPay) : "—"}
                        {!passThrough && isLead && leadBonusTWD != null && (
                          <span className="detail-team-pay-note"> +bonus</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {d.kind === "Self-funded" && (
            <div className="detail-team">
              <div className="detail-section-head">
                <span className="detail-section-label">Self funding</span>
                <span className="detail-section-meta">
                  {fmtTWD(selfFundingTotal)} total
                </span>
              </div>
              {selfFundingResolved.length === 0 ? (
                <p className="snapshot-empty">No self-funding entries yet.</p>
              ) : (
                <div className="detail-team-table">
                  <div className="detail-team-thead">
                    <span>Name</span>
                    <span>Funding amount</span>
                  </div>
                  {selfFundingResolved.map((entry) => (
                    <div
                      key={entry.id || entry.memberId}
                      className="detail-team-row"
                    >
                      <span className="detail-team-name">
                        {entry.member?.data?.name || entry.memberId}
                      </span>
                      <span className="detail-team-pay">
                        {fmtTWD(entry.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

// ─ ProjectsPage ──────────────────────────────────────────────────────────────────────────────

// ─ Kanban board ────────────────────────────────────────────────────────────────────────────────

function ProjectKanbanCard({ project, allTasks, onComplete }) {
  const d = project.data;
  const budgTWD = budgetToTWD(d.budget, d.budgetCurrency);
  const internalOrAdmin = isInternalOrAdminKind(d.kind);
  const passThrough = isPassThroughKind(d.kind);
  const donationPct = Number(d.donationPercent) || 0;
  const donationTWD = donationAmount(budgTWD, donationPct);
  const companyTaxTWD =
    d.companyTax && budgTWD != null ? Math.round(budgTWD * 0.05) : null;
  const effectiveBudgetTWD =
    budgTWD != null
      ? Math.max(0, budgTWD - (donationTWD || 0) - (companyTaxTWD || 0))
      : null;
  const leadBonusTWD =
    !internalOrAdmin && !passThrough && effectiveBudgetTWD != null
      ? Math.round(effectiveBudgetTWD * 0.05)
      : null;
  const teamDistributableTWD =
    effectiveBudgetTWD != null && leadBonusTWD != null
      ? Math.max(0, effectiveBudgetTWD - leadBonusTWD)
      : effectiveBudgetTWD;
  const hourly = internalOrAdmin
    ? d.projectedHourlyWage != null
      ? Number(d.projectedHourlyWage)
      : null
    : teamDistributableTWD != null && d.maxHours
      ? Math.round(teamDistributableTWD / Number(d.maxHours))
      : null;
  const teamCount = Array.isArray(d.staffing) ? d.staffing.length : 0;
  const projectTasks = allTasks.filter(
    (t) => t.data.projectId === project.id && !t.data.archived,
  );
  const doneTasks = projectTasks.filter((t) => t.data.completed);

  return (
    <div className="kanban-card">
      <div className="kanban-card-name">{d.name || "Unnamed"}</div>
      {d.kind && (
        <span
          className="kanban-card-kind"
          style={
            KIND_STYLE[d.kind]
              ? {
                  background: KIND_STYLE[d.kind].bg,
                  color: KIND_STYLE[d.kind].color,
                }
              : {}
          }
        >
          {d.kind}
        </span>
      )}
      <div className="kanban-card-meta">
        {budgTWD != null && (
          <span className="kanban-card-budget">{fmtTWD(budgTWD)}</span>
        )}
        {hourly != null && <span>NT${hourly}/h</span>}
        {teamCount > 0 && (
          <span>
            {teamCount} member{teamCount !== 1 ? "s" : ""}
          </span>
        )}
        {projectTasks.length > 0 && (
          <span>
            {doneTasks.length}/{projectTasks.length} tasks
          </span>
        )}
      </div>
      {onComplete && !isProjectClosed(project) ? (
        <Button
          type="button"
          size="small"
          variant="secondary"
          className="kanban-complete-btn"
          onClick={() => onComplete(project)}
        >
          Complete project
        </Button>
      ) : null}
    </div>
  );
}

function ProjectKanbanBoard({ projects, allTasks, onComplete }) {
  const sorted = [...projects].sort(
    (a, b) => (Number(b.data.createdAt) || 0) - (Number(a.data.createdAt) || 0),
  );
  const grouped = {};
  PROJECT_STATUSES.forEach((s) => {
    grouped[s] = [];
  });
  grouped[""] = [];
  sorted.forEach((p) => {
    const s = p.data.status || "";
    if (grouped[s] !== undefined) grouped[s].push(p);
    else grouped[""].push(p);
  });
  const cols = [
    ...PROJECT_STATUSES.filter((s) => grouped[s].length > 0),
    ...(grouped[""].length > 0 ? [""] : []),
  ];
  return (
    <div className="kanban-board">
      {cols.map((status) => (
        <div key={status || "__none__"} className="kanban-col">
          <div className="kanban-col-head">
            <span
              className="kanban-col-title"
              style={
                STATUS_STYLE[status]
                  ? { color: STATUS_STYLE[status].color }
                  : {}
              }
            >
              {status || "No status"}
            </span>
            <span className="kanban-col-count">{grouped[status].length}</span>
          </div>
          {grouped[status].map((p) => (
            <ProjectKanbanCard
              key={p.id}
              project={p}
              allTasks={allTasks}
              onComplete={onComplete}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function ProjectsPage({
  viewerMemberId = null,
  viewerRole = "associate",
  sharedMembers = null,
  sharedProjects = null,
  sharedTasks = null,
}) {
  const [projects, setProjects] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [viewMode, setViewMode] = useState("list");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [completeTarget, setCompleteTarget] = useState(null);
  const [completingProjectId, setCompletingProjectId] = useState(null);
  const isLimitedViewer =
    viewerRole === "flying-member" || viewerRole === "external-collaborator";
  const hasSharedData =
    Array.isArray(sharedMembers) &&
    Array.isArray(sharedProjects) &&
    Array.isArray(sharedTasks);

  useEffect(() => {
    if (hasSharedData) return;
    if (!firebaseReady) return;
    const u1 = subscribeCollection("projects", setProjects);
    const u2 = subscribeCollection("tasks", setAllTasks);
    const u3 = subscribeCollection("members", setMembers);
    return () => {
      u1();
      u2();
      u3();
    };
  }, [hasSharedData]);

  useEffect(() => {
    if (!hasSharedData) return;
    setMembers(sharedMembers);
    setProjects(sharedProjects);
    setAllTasks(sharedTasks);
  }, [hasSharedData, sharedMembers, sharedProjects, sharedTasks]);

  function addToast(message, isError = false) {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, isError }]);
    window.setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      2500,
    );
  }

  function setField(field, value) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (
        field === "kind" &&
        isInternalOrAdminKind(value) &&
        !String(next.projectedHourlyWage || "").trim()
      ) {
        next.projectedHourlyWage = String(MIN_INTERNAL_ADMIN_HOURLY_TWD);
      }
      if (field === "kind" && isSelfFundedKind(value)) {
        next.donationPercent = "0";
        next.budgetCurrency = "TWD";
      }
      return next;
    });
  }

  async function handleAdd(e) {
    if (isLimitedViewer) {
      addToast("You do not have permission to create projects", true);
      return;
    }
    e.preventDefault();
    const name = form.name.trim();
    if (!name) return;
    const internalOrAdmin = isInternalOrAdminKind(form.kind);
    const selfFunded = isSelfFundedKind(form.kind);
    const projectedHourlyWage = form.projectedHourlyWage
      ? Number(form.projectedHourlyWage)
      : null;
    if (
      internalOrAdmin &&
      (!Number.isFinite(projectedHourlyWage) ||
        projectedHourlyWage < MIN_INTERNAL_ADMIN_HOURLY_TWD)
    ) {
      addToast(
        `For Internal/Admin projects, projected hourly wage must be at least NT$${MIN_INTERNAL_ADMIN_HOURLY_TWD}/h.`,
        true,
      );
      return;
    }
    setSaving(true);
    try {
      const created = {
        name,
        kind: form.kind || null,
        status: form.status || null,
        budget: selfFunded ? 0 : form.budget ? Number(form.budget) : null,
        budgetCurrency: selfFunded ? "TWD" : form.budgetCurrency,
        donationPercent: selfFunded ? 0 : Number(form.donationPercent) || 0,
        companyTax: Boolean(form.companyTax),
        legacyMode: Boolean(form.legacyMode),
        projectedHourlyWage: internalOrAdmin ? projectedHourlyWage : null,
        maxHours: form.maxHours ? Number(form.maxHours) : null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        stagePlans: [],
        stages: [],
        staffing: [],
        selfFunding: [],
        createdAt: Date.now(),
      };
      const id = await createDocument("projects", created);
      setProjects((prev) => {
        if (prev.some((row) => row.id === id)) {
          return prev.map((row) =>
            row.id === id ? { id, data: created } : row,
          );
        }
        return [{ id, data: created }, ...prev];
      });
      setForm(EMPTY_FORM);
      addToast("Project added");
    } catch (err) {
      addToast(err.message || "Could not add project", true);
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(project, data) {
    if (isLimitedViewer) {
      addToast("You do not have permission to edit projects", true);
      return;
    }
    if (String(data?.status || "").trim().toLowerCase() === "completed") {
      await handleCompleteProject(project, data);
      return;
    }
    try {
      const nextData = {
        ...project.data,
        ...data,
        updatedAt: Date.now(),
      };
      await replaceDocument("projects", project.id, nextData);
      setProjects((prev) =>
        prev.map((item) =>
          item.id === project.id ? { ...item, data: nextData } : item,
        ),
      );
      addToast("Saved");
    } catch (err) {
      addToast(err.message || "Could not save", true);
    }
  }

  async function handleDelete(project) {
    if (isLimitedViewer) {
      addToast("You do not have permission to delete projects", true);
      return;
    }
    setDeleteTarget({
      label: project.data?.name || "this project",
      onConfirm: async () => {
        try {
          await deleteDocument("projects", project.id);
          setProjects((prev) => prev.filter((item) => item.id !== project.id));
          addToast("Deleted");
        } catch (err) {
          addToast(err.message || "Could not delete", true);
        } finally {
          setDeleteTarget(null);
        }
      },
    });
  }

  function requestCompleteProject(project) {
    const activeTaskCount = allTasks.filter(
      (task) =>
        task?.data?.projectId === project.id && !task?.data?.archived,
    ).length;
    setCompleteTarget({ project, activeTaskCount });
  }

  async function handleCompleteProject(project, projectUpdates = {}) {
    if (isLimitedViewer) {
      addToast("You do not have permission to complete projects", true);
      return false;
    }

    const now = Date.now();
    const alreadyCompleted =
      String(project.data?.status || "").trim().toLowerCase() === "completed";
    const linkedTasks = allTasks.filter(
      (task) =>
        task?.data?.projectId === project.id && !task?.data?.archived,
    );
    const projectPatch = {
      ...projectUpdates,
      status: "Completed",
      completedAt: alreadyCompleted
        ? Number(project.data?.completedAt) || now
        : now,
      updatedAt: now,
    };
    const taskPatches = new Map(
      linkedTasks.map((task) => {
        const finishedAt = task.data.completed
          ? Number(task.data.archivedAt) ||
            Number(task.data.reviewedAt) ||
            Number(task.data.updatedAt) ||
            now
          : now;
        return [
          task.id,
          {
            completed: true,
            completionState: "completed",
            reviewed: true,
            reviewedAt: Number(task.data.reviewedAt) || finishedAt,
            archived: true,
            archivedAt: Number(task.data.archivedAt) || finishedAt,
            updatedAt: now,
          },
        ];
      }),
    );

    setCompletingProjectId(project.id);
    try {
      await updateDocumentsAtomically([
        { collectionName: "projects", id: project.id, payload: projectPatch },
        ...linkedTasks.map((task) => ({
          collectionName: "tasks",
          id: task.id,
          payload: taskPatches.get(task.id),
        })),
      ]);
      setProjects((prev) =>
        prev.map((item) =>
          item.id === project.id
            ? { ...item, data: { ...item.data, ...projectPatch } }
            : item,
        ),
      );
      setAllTasks((prev) =>
        prev.map((item) => {
          const patch = taskPatches.get(item.id);
          return patch
            ? { ...item, data: { ...item.data, ...patch } }
            : item;
        }),
      );
      addToast(
        linkedTasks.length
          ? `Project completed · ${linkedTasks.length} task${linkedTasks.length === 1 ? "" : "s"} archived`
          : "Project completed",
      );
      return true;
    } catch (err) {
      addToast(err.message || "Could not complete project", true);
      return false;
    } finally {
      setCompletingProjectId(null);
    }
  }

  const visibleProjects = useMemo(() => {
    const uniqueProjects = dedupeById(projects);
    if (!isLimitedViewer) return uniqueProjects;
    if (!viewerMemberId) return [];
    return uniqueProjects.filter((project) =>
      isAssignedToProject(project, viewerMemberId),
    );
  }, [isLimitedViewer, projects, viewerMemberId]);

  const visibleTasks = useMemo(() => {
    if (!isLimitedViewer) return allTasks;
    const visibleProjectIds = new Set(
      visibleProjects.map((project) => project.id),
    );
    return allTasks.filter((task) =>
      visibleProjectIds.has(task?.data?.projectId),
    );
  }, [allTasks, isLimitedViewer, visibleProjects]);

  const totalBudgetTWD = useMemo(
    () =>
      visibleProjects.reduce(
        (s, p) => s + (budgetToTWD(p.data.budget, p.data.budgetCurrency) || 0),
        0,
      ),
    [visibleProjects],
  );

  const totalCompanyPoolTWD = useMemo(
    () =>
      visibleProjects.reduce((s, p) => {
        const budget = budgetToTWD(p.data.budget, p.data.budgetCurrency);
        if (isSelfFundedKind(p.data.kind)) return s;
        return s + (donationAmount(budget, p.data.donationPercent) || 0);
      }, 0),
    [visibleProjects],
  );

  const totalMemberDistributableTWD = useMemo(
    () =>
      visibleProjects.reduce((s, p) => {
        const budget = budgetToTWD(p.data.budget, p.data.budgetCurrency);
        if (isSelfFundedKind(p.data.kind)) {
          return s + (budget || 0);
        }
        const donation = donationAmount(budget, p.data.donationPercent) || 0;
        if (budget == null) return s;
        return s + Math.max(0, budget - donation);
      }, 0),
    [visibleProjects],
  );

  const projectViewOptions = [
    {
      value: "list",
      title: "List view",
      icon: LIST_VIEW_ICON,
    },
    {
      value: "kanban",
      title: "Kanban view",
      icon: KANBAN_VIEW_ICON,
    },
  ];

  const numberFmt = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  });
  const projectSubtitle =
    totalBudgetTWD > 0
      ? `NT$${numberFmt.format(totalBudgetTWD)} total · Pool NT$${numberFmt.format(totalCompanyPoolTWD)} · Member budget NT$${numberFmt.format(totalMemberDistributableTWD)}`
      : "Budget, staffing, and delivery capacity overview";

  return (
    <TabPage
      className="projects-page"
      title="Projects"
      badge={`${visibleProjects.length} project${visibleProjects.length !== 1 ? "s" : ""}`}
      subtitle={projectSubtitle}
      right={
        <PageControls compact>
          <ViewToggle
            className="projects-view-toggle"
            value={viewMode}
            onChange={setViewMode}
            options={projectViewOptions}
            ariaLabel="Project view"
          />
        </PageControls>
      }
    >
      {!isLimitedViewer ? (
        <SectionBlock
          className="project-create-section"
          title="Create project"
          titleTag="h3"
          texture={SURFACE_TEXTURES.projectCreate}
        >
          <form className="project-add-form" onSubmit={handleAdd}>
            <InputField
              className="project-field project-field--name"
              type="text"
              placeholder="Project name *"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              required
            />
            <SelectField
              className="project-field project-field--kind"
              value={form.kind}
              onChange={(e) => setField("kind", e.target.value)}
            >
              <option value="">Kind…</option>
              {PROJECT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </SelectField>
            <SelectField
              className="project-field project-field--status"
              value={form.status}
              onChange={(e) => setField("status", e.target.value)}
            >
              <option value="">Status…</option>
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectField>
            <div className="project-budget-group">
              <InputField
                className="project-field project-field--budget"
                type="number"
                placeholder="Budget"
                min="0"
                step="1"
                value={form.budget}
                onChange={(e) => setField("budget", e.target.value)}
                disabled={form.kind === "Self-funded"}
              />
              <SelectField
                className="project-field project-field--currency"
                value={form.budgetCurrency}
                onChange={(e) => setField("budgetCurrency", e.target.value)}
                disabled={form.kind === "Self-funded"}
              >
                <option value="TWD">TWD</option>
                <option value="USD">USD</option>
              </SelectField>
            </div>
            {form.kind !== "Self-funded" ? (
              <SelectField
                className="project-field project-field--donation"
                value={form.donationPercent}
                onChange={(e) => setField("donationPercent", e.target.value)}
                title="Company donation percentage"
              >
                {DONATION_OPTIONS.map((pct) => (
                  <option key={pct} value={pct}>
                    {pct}% donation
                  </option>
                ))}
              </SelectField>
            ) : (
              <span className="finance-section-note">
                Budget comes from self funding. Donation is disabled.
              </span>
            )}
            <InputField
              className="project-field"
              type="date"
              value={form.startDate}
              onChange={(e) => setField("startDate", e.target.value)}
              title="Project start date"
            />
            <InputField
              className="project-field"
              type="date"
              value={form.endDate}
              onChange={(e) => setField("endDate", e.target.value)}
              title="Project end date"
            />
            {isInternalOrAdminKind(form.kind) && (
              <InputField
                className="project-field"
                type="number"
                placeholder={`Projected hourly (>=${MIN_INTERNAL_ADMIN_HOURLY_TWD})`}
                min={MIN_INTERNAL_ADMIN_HOURLY_TWD}
                step="1"
                value={form.projectedHourlyWage}
                onChange={(e) =>
                  setField("projectedHourlyWage", e.target.value)
                }
                title="Projected hourly wage for Internal/Admin projects (TWD)"
              />
            )}
            <Button type="submit" disabled={saving || !form.name.trim()}>
              Add project
            </Button>
          </form>
        </SectionBlock>
      ) : (
        <SectionBlock
          className="project-create-section"
          title="Project access"
          titleTag="h3"
          texture={SURFACE_TEXTURES.projectCreate}
        >
          <p>You can view projects where you are assigned in staffing.</p>
        </SectionBlock>
      )}

      {visibleProjects.length === 0 ? (
        <EmptyState>No projects yet.</EmptyState>
      ) : viewMode === "kanban" ? (
        <SectionBlock
          className="project-kanban-section"
          title="Kanban board"
          titleTag="h3"
          texture={SURFACE_TEXTURES.projectKanban}
        >
          <ProjectKanbanBoard
            projects={visibleProjects}
            allTasks={visibleTasks}
            onComplete={isLimitedViewer ? null : requestCompleteProject}
          />
        </SectionBlock>
      ) : (
        <SectionBlock
          className="project-list-section"
          title="Project ledger"
          titleTag="h3"
          texture={SURFACE_TEXTURES.projectLedger}
        >
          <div className="project-col-headers">
            <span>Name</span>
            <span>Budget</span>
            <span>Hours</span>
            <span>Hourly Rate (TWD)</span>
            <span />
          </div>
          <CollectionLayout as="ul" variant="list" className="project-list">
            {[...visibleProjects]
              .sort(
                (a, b) =>
                  (Number(b.data.createdAt) || 0) -
                  (Number(a.data.createdAt) || 0),
              )
              .map((p) => (
                <ProjectRow
                  key={p.id}
                  project={p}
                  allTasks={visibleTasks}
                  members={members}
                  onSave={handleSave}
                  onComplete={
                    isLimitedViewer ? null : requestCompleteProject
                  }
                  onDelete={handleDelete}
                />
              ))}
          </CollectionLayout>
        </SectionBlock>
      )}

      <StatusStack className="toast-container" ariaLive="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={t.isError ? "toast toast--error" : "toast"}
          >
            {t.message}
          </div>
        ))}
      </StatusStack>

      {deleteTarget && (
        <DeleteConfirmDialog
          label={deleteTarget.label}
          onConfirm={deleteTarget.onConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {completeTarget && (
        <ModalShell
          title="Complete project"
          onClose={() => setCompleteTarget(null)}
          size="sm"
          footer={
            <>
              <Button
                type="button"
                variant="ghost"
                size="small"
                onClick={() => setCompleteTarget(null)}
                disabled={Boolean(completingProjectId)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="small"
                onClick={async () => {
                  const completed = await handleCompleteProject(
                    completeTarget.project,
                  );
                  if (completed) setCompleteTarget(null);
                }}
                disabled={Boolean(completingProjectId)}
              >
                {completingProjectId ? "Completing…" : "Complete project"}
              </Button>
            </>
          }
        >
          <p className="delete-confirm-body">
            Complete{" "}
            <strong>
              {completeTarget.project.data?.name || "this project"}
            </strong>
            ?
            {completeTarget.activeTaskCount > 0
              ? ` Its ${completeTarget.activeTaskCount} linked task${completeTarget.activeTaskCount === 1 ? "" : "s"} will be marked completed and removed from the active Task board.`
              : " It will be removed from the active Task board."}
          </p>
          <p className="delete-confirm-detail">
            Project and task history will remain available for reporting.
          </p>
        </ModalShell>
      )}
    </TabPage>
  );
}
