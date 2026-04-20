"use client";

import { useEffect, useState, useMemo } from "react";
import {
  subscribeCollection,
  createDocument,
  replaceDocument,
  deleteDocument,
} from "../../firestore";
import { firebaseReady } from "../../firebase";
import IconButton from "./IconButton";
import { DELETE_ICON, EDIT_ICON } from "./icons";

// ─ Constants ───────────────────────────────────────────────────────────────────────────────────

const PROJECT_KINDS = [
  "Commissioned", "Self-funded", "Grant", "Internal", "Admin", "Pass-through",
];

const PROJECT_STATUSES = [
  "Scheduled", "In Progress", "Waiting for Response", "On Hold", "Completed", "Cancelled",
];

const STATUS_STYLE = {
  "Scheduled":            { bg: "#e8f0fe", color: "#3367d6" },
  "In Progress":          { bg: "#e6f4ea", color: "#1e8e3e" },
  "Waiting for Response": { bg: "#fef7e0", color: "#b06000" },
  "On Hold":              { bg: "#f0f0f0", color: "#888"    },
  "Completed":            { bg: "#e8f5e9", color: "#2e7d32" },
  "Cancelled":            { bg: "#fce8e6", color: "#c5221f" },
};

const KIND_STYLE = {
  "Commissioned":  { bg: "#e3f0ff", color: "#1a5fcc" },
  "Self-funded":   { bg: "#f0e8ff", color: "#6b21a8" },
  "Grant":         { bg: "#e0f7e9", color: "#1a7a3c" },
  "Internal":      { bg: "#f0f0ee", color: "#555"    },
  "Admin":         { bg: "#fff3e0", color: "#a05000" },
  "Pass-through":  { bg: "#e0f5f7", color: "#0f6e7a" },
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
  projectedHourlyWage: "",
  maxHours: "",
  startDate: "",
  // stagePlans: [{id, name, weeks, perspectiveHours, delayWeeks, order}]
  stagePlans: [],
  // staffing: [{id, memberId, roles: string[], maxHours}]
  staffing: [],
};

// ─ Helpers ──────────────────────────────────────────────────────────────────────────────────────

function budgetToTWD(amount, currency) {
  const n = Number(amount);
  if (!n) return null;
  return currency === "USD" ? n * USD_TO_TWD : n;
}

function fmtTWD(amount) {
  if (amount == null) return null;
  return "NT$" + new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount);
}

function fmtUSD(amount) {
  if (amount == null) return null;
  return "$" + new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount);
}

function donationAmount(amountTWD, donationPercent) {
  if (amountTWD == null) return null;
  const pct = Number(donationPercent) || 0;
  return Math.round((amountTWD * pct) / 100);
}

function isInternalOrAdminKind(kind) {
  return kind === "Internal" || kind === "Admin";
}

function fmtH(h) {
  if (!h) return "0h";
  const whole = Math.floor(h);
  const frac = h - whole;
  if (frac === 0) return `${whole}h`;
  if (frac === 0.25) return `${whole}h 15m`;
  if (frac === 0.5)  return `${whole}h 30m`;
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
    .filter((t) => t.data.projectId === projectId && t.data.memberId === memberId && !t.data.archived)
    .reduce((s, t) => s + (Number(t.data.timeUnits) || 0) * 0.25, 0);
}

function totalWeeks(stagePlans) {
  if (!Array.isArray(stagePlans)) return 0;
  return stagePlans.reduce((s, sp) => s + (Number(sp.weeks) || 0), 0);
}

function addWeeks(dateStr, weeks) {
  if (!dateStr || !weeks) return null;
  const d = new Date(dateStr);
  d.setDate(d.getDate() + weeks * 7);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDate(dateStr) {
  if (!dateStr) return null;
  const [y, mo, d] = dateStr.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function phaseNowLabel(startDate, stagePlans) {
  if (!Array.isArray(stagePlans) || stagePlans.length === 0) {
    return startDate ? `Not started · starts ${fmtDate(startDate)}` : "No stage plan";
  }

  const sorted = [...stagePlans].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  if (!startDate) return `Setup · ${sorted[0]?.name || "No stage"}`;

  const start = new Date(startDate + "T00:00:00");
  const today = new Date();
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  if (today < start) return `Not started · starts ${fmtDate(startDate)}`;

  const elapsedWeeks = Math.floor((today.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
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

// ─ StagePlanEdit ────────────────────────────────────────────────────────────────────────────

// Inline editor for the stagePlans list
function StagePlanEdit({ stagePlans, onChange }) {
  function addStage() {
    onChange([
      ...stagePlans,
      { id: newUUID(), name: "", weeks: 1, perspectiveHours: "", order: stagePlans.length },
    ]);
  }

  function removeStage(i) {
    const next = stagePlans.filter((_, idx) => idx !== i).map((sp, idx) => ({ ...sp, order: idx }));
    onChange(next);
  }

  function setSpField(i, k, v) {
    const next = stagePlans.map((sp, idx) => idx === i ? { ...sp, [k]: v } : sp);
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
            <input
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
                <button type="button" className="weeks-step-btn" onClick={() => stepWeeks(i, -1)}>−</button>
                <span className="weeks-step-val">{Number(sp.weeks) || 1}</span>
                <button type="button" className="weeks-step-btn" onClick={() => stepWeeks(i, +1)}>+</button>
              </div>
            </div>
            <label className="stage-num-label">
              <span>est. hours</span>
              <input
                className="project-field stage-field--num"
                type="number"
                placeholder="0"
                min="0"
                step="1"
                value={sp.perspectiveHours}
                onChange={(e) => setSpField(i, "perspectiveHours", e.target.value)}
              />
            </label>
          </div>
          <IconButton variant="delete" onClick={() => removeStage(i)}>{DELETE_ICON}</IconButton>
        </div>
      ))}
      <button type="button" className="btn btn--ghost btn--small stage-add-btn" onClick={addStage}>
        + Add stage
      </button>
    </div>
  );
}

// ─ StaffingEdit ─────────────────────────────────────────────────────────────────────────────

// Multi-member assignment with roles + per-member maxHours
function StaffingEdit({ staffing, members, onChange, hourly }) {
  function toggleMember(memberId) {
    const exists = staffing.find((s) => s.memberId === memberId);
    if (exists) {
      onChange(staffing.filter((s) => s.memberId !== memberId));
    } else {
      onChange([...staffing, { id: newUUID(), memberId, roles: ["doer"], maxHours: "" }]);
    }
  }

  function setStaffField(memberId, k, v) {
    onChange(staffing.map((s) => s.memberId === memberId ? { ...s, [k]: v } : s));
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
        <span>Max hrs</span>
        <span>Pay est.</span>
      </div>
      {members.map((m) => {
        const entry = staffing.find((s) => s.memberId === m.id);
        const active = !!entry;
        const hours = Number(entry?.maxHours) || 0;
        const pay = hourly != null ? Math.round(hourly * hours) : null;
        return (
          <div key={m.id} className={"staffing-member" + (active ? " staffing-member--on" : "")}>
            <label className="staffing-col staffing-col--name">
              <input type="checkbox" checked={active} onChange={() => toggleMember(m.id)} />
              <span className="staffing-member-name">{m.data.name || m.id}</span>
            </label>
            <div className="staffing-col staffing-col--roles" aria-label="Primary role">
              {STAFFING_ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  disabled={!active}
                  className={"role-chip" + (active && entry.roles.includes(r.value) ? " role-chip--on" : "")}
                  onClick={() => setPrimaryRole(m.id, r.value)}
                >{r.label}</button>
              ))}
            </div>
            <label className="staffing-col staffing-col--hours">
              <input
                className="project-field staffing-field--hours"
                type="number"
                placeholder="0"
                min="0"
                step="1"
                disabled={!active}
                value={active ? entry.maxHours : ""}
                onChange={(e) => setStaffField(m.id, "maxHours", e.target.value)}
              />
            </label>
            <div className="staffing-col staffing-col--pay">
              {active
                ? (pay != null ? fmtTWD(pay) : "—")
                : "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─ ProjectRow ──────────────────────────────────────────────────────────────────────────────────

function ProjectRow({ project, allTasks, members, onSave, onDelete }) {
  const d = project.data;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  // Normalize Firebase data to our form shape
  function normalizeStagePlans(raw) {
    if (!Array.isArray(raw)) return [];
    return [...raw]
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
      .map((sp) => ({
        id:               sp.id               || newUUID(),
        name:             sp.name             || "",
        weeks:            sp.weeks != null    ? String(sp.weeks)            : "",
        perspectiveHours: sp.perspectiveHours != null ? String(sp.perspectiveHours) : "",
        order:            sp.order != null    ? Number(sp.order)            : 0,
      }));
  }

  function normalizeStaffing(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map((s) => ({
      id:       s.id       || newUUID(),
      memberId: s.memberId || "",
      roles:    Array.isArray(s.roles) ? s.roles : ["doer"],
      maxHours: s.maxHours != null ? String(s.maxHours) : "",
    }));
  }

  const [form, setForm] = useState({
    name:           d.name           || "",
    kind:           d.kind           || "",
    status:         d.status         || "",
    budget:         d.budget != null ? String(d.budget) : "",
    budgetCurrency: d.budgetCurrency || "TWD",
    donationPercent: d.donationPercent != null ? String(d.donationPercent) : "20",
    projectedHourlyWage: d.projectedHourlyWage != null ? String(d.projectedHourlyWage) : "",
    maxHours:       d.maxHours != null ? String(d.maxHours) : "",
    startDate:      d.startDate      || "",
    stagePlans:     normalizeStagePlans(d.stagePlans),
    staffing:       normalizeStaffing(d.staffing),
  });

  function setField(k, v) {
    setForm((p) => {
      const next = { ...p, [k]: v };
      if (k === "kind" && isInternalOrAdminKind(v) && !String(next.projectedHourlyWage || "").trim()) {
        next.projectedHourlyWage = String(MIN_INTERNAL_ADMIN_HOURLY_TWD);
      }
      return next;
    });
  }

  function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const internalOrAdmin = isInternalOrAdminKind(form.kind);
    const projectedHourlyWage = form.projectedHourlyWage ? Number(form.projectedHourlyWage) : null;
    if (internalOrAdmin && (!Number.isFinite(projectedHourlyWage) || projectedHourlyWage < MIN_INTERNAL_ADMIN_HOURLY_TWD)) {
      window.alert(`For Internal/Admin projects, projected hourly wage must be at least NT$${MIN_INTERNAL_ADMIN_HOURLY_TWD}/h.`);
      return;
    }

    const stagePlans = form.stagePlans
      .filter((sp) => sp.name.trim())
      .map((sp, idx) => ({
        id:               sp.id,
        name:             sp.name.trim(),
        weeks:            Number(sp.weeks) || 0,
        perspectiveHours: Number(sp.perspectiveHours) || 0,
        order:            idx,
      }));

    // Also keep `stages` as plain string array for compatibility
    const stages = stagePlans.map((sp) => sp.name);

    const staffing = form.staffing
      .filter((s) => s.memberId)
      .map((s) => ({
        id:       s.id,
        memberId: s.memberId,
        roles:    s.roles,
        maxHours: Number(s.maxHours) || 0,
      }));

    onSave(project, {
      name:           form.name.trim(),
      kind:           form.kind           || null,
      status:         form.status         || null,
      budget:         form.budget         ? Number(form.budget) : null,
      budgetCurrency: form.budgetCurrency,
      donationPercent: Number(form.donationPercent) || 0,
      projectedHourlyWage: internalOrAdmin ? projectedHourlyWage : null,
      maxHours:       form.maxHours       ? Number(form.maxHours) : null,
      startDate:      form.startDate      || null,
      stagePlans,
      stages,
      staffing,
    });
    setEditing(false);
  }

  const hours     = assignedHours(allTasks, project.id);
  const maxH      = d.maxHours ? Number(d.maxHours) : null;
  const budgTWD   = budgetToTWD(d.budget, d.budgetCurrency);
  const internalOrAdmin = isInternalOrAdminKind(d.kind);
  const projectedHourlyWage = d.projectedHourlyWage != null ? Number(d.projectedHourlyWage) : null;
  const effectiveProjectedHourly = Number.isFinite(projectedHourlyWage) && projectedHourlyWage >= MIN_INTERNAL_ADMIN_HOURLY_TWD
    ? projectedHourlyWage
    : null;
  const donationPct = Number(d.donationPercent) || 0;
  const donationTWD = donationAmount(budgTWD, donationPct);
  const effectiveBudgetTWD = budgTWD != null ? Math.max(0, budgTWD - (donationTWD || 0)) : null;
  const budgetBasedHourly = (effectiveBudgetTWD != null && maxH && maxH > 0)
    ? Math.round(effectiveBudgetTWD / maxH)
    : null;
  const hourly = internalOrAdmin ? effectiveProjectedHourly : budgetBasedHourly;
  const burnSoFarTWD = hourly != null ? Math.round(hours * hourly) : null;
  const projectedBurnAtMaxTWD = (hourly != null && maxH != null) ? Math.round(maxH * hourly) : null;
  const remainingHours = maxH != null ? Math.max(0, maxH - hours) : null;
  const twks      = totalWeeks(d.stagePlans);
  const statusSt  = d.status ? (STATUS_STYLE[d.status] || {}) : {};
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

  const sortedStagePlans = useMemo(() => {
    if (!Array.isArray(d.stagePlans)) return [];
    return [...d.stagePlans].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  }, [d.stagePlans]);

  const phaseNow = useMemo(() => phaseNowLabel(d.startDate, sortedStagePlans), [d.startDate, sortedStagePlans]);

  const teamMaxHours = useMemo(() => {
    if (!Array.isArray(d.staffing)) return 0;
    return d.staffing.reduce((s, entry) => s + (Number(entry.maxHours) || 0), 0);
  }, [d.staffing]);

  const unassignedTeamHours = maxH != null ? Math.max(0, maxH - teamMaxHours) : null;

  const teamWorkedHours = useMemo(() => {
    if (!Array.isArray(d.staffing)) return 0;
    return d.staffing.reduce((s, entry) => s + assignedHoursForMember(allTasks, project.id, entry.memberId), 0);
  }, [d.staffing, allTasks, project.id]);

  if (editing) {
    const formInternalOrAdmin = isInternalOrAdminKind(form.kind);
    const formProjectedHourly = form.projectedHourlyWage ? Number(form.projectedHourlyWage) : null;
    const formProjectedHourlyValid = Number.isFinite(formProjectedHourly) && formProjectedHourly >= MIN_INTERNAL_ADMIN_HOURLY_TWD
      ? formProjectedHourly
      : null;
    const formBudgetTWD = budgetToTWD(form.budget, form.budgetCurrency);
    const formDonationTWD = donationAmount(formBudgetTWD, form.donationPercent);
    const formEffectiveBudgetTWD = formBudgetTWD != null ? Math.max(0, formBudgetTWD - (formDonationTWD || 0)) : null;
    const formBudgetHourly = (formEffectiveBudgetTWD != null && Number(form.maxHours) > 0)
      ? Math.round(formEffectiveBudgetTWD / Number(form.maxHours))
      : null;
    const formHourly = formInternalOrAdmin ? formProjectedHourlyValid : formBudgetHourly;
    const formStagePlannedHours = form.stagePlans.reduce((s, sp) => s + (Number(sp.perspectiveHours) || 0), 0);
    const formStageAssignableLeft = form.maxHours ? Number(form.maxHours) - formStagePlannedHours : null;
    const formStaffingHours = form.staffing.reduce((s, entry) => s + (Number(entry.maxHours) || 0), 0);
    const formStaffingUnassigned = form.maxHours ? Math.max(0, Number(form.maxHours) - formStaffingHours) : null;

    return (
      <li className="project-row project-row--editing">
        <form className="project-edit-form" onSubmit={handleSave}>
          {/* Section 1: Core info */}
          <div className="edit-field-grid">
            <label className="edit-field-group edit-field-group--wide">
              <span className="edit-field-label">Project name *</span>
              <input
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
              <select className="project-field" value={form.kind} onChange={(e) => setField("kind", e.target.value)}>
                <option value="">Select…</option>
                {PROJECT_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </label>
            <label className="edit-field-group">
              <span className="edit-field-label">Status</span>
              <select className="project-field" value={form.status} onChange={(e) => setField("status", e.target.value)}>
                <option value="">Select…</option>
                {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="edit-field-group">
              <span className="edit-field-label">Start date</span>
              <input
                className="project-field"
                type="date"
                value={form.startDate}
                onChange={(e) => setField("startDate", e.target.value)}
              />
            </label>
            <div className="edit-field-group">
              <span className="edit-field-label">Budget</span>
              <div className="project-budget-group">
                <input
                  className="project-field project-field--budget"
                  type="number"
                  placeholder="Amount"
                  min="0"
                  step="1"
                  value={form.budget}
                  onChange={(e) => setField("budget", e.target.value)}
                />
                <select
                  className="project-field project-field--currency"
                  value={form.budgetCurrency}
                  onChange={(e) => setField("budgetCurrency", e.target.value)}
                >
                  <option value="TWD">TWD</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
            <label className="edit-field-group">
              <span className="edit-field-label">Donation %</span>
              <select
                className="project-field"
                value={form.donationPercent}
                onChange={(e) => setField("donationPercent", e.target.value)}
              >
                {DONATION_OPTIONS.map((pct) => (
                  <option key={pct} value={pct}>{pct}%</option>
                ))}
              </select>
            </label>
            {formInternalOrAdmin && (
              <label className="edit-field-group">
                <span className="edit-field-label">Projected hourly wage (TWD)</span>
                <input
                  className="project-field"
                  type="number"
                  placeholder={`min ${MIN_INTERNAL_ADMIN_HOURLY_TWD}`}
                  min={MIN_INTERNAL_ADMIN_HOURLY_TWD}
                  step="1"
                  value={form.projectedHourlyWage}
                  onChange={(e) => setField("projectedHourlyWage", e.target.value)}
                />
              </label>
            )}
            <label className="edit-field-group">
              <span className="edit-field-label">Max billable hours</span>
              <input
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
                Equation: {form.maxHours ? `${fmtH(Number(form.maxHours) || 0)} - ${fmtH(formStagePlannedHours)} = ${fmtH(formStageAssignableLeft)}` : "Set max hours"}
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
                  {form.maxHours ? ` / ${fmtH(Number(form.maxHours) || 0)}` : ""}
                  {formStaffingUnassigned != null ? ` · Unassigned: ${fmtH(formStaffingUnassigned)}` : ""}
                </span>
              </summary>
              <div className="edit-disclosure-body">
                <StaffingEdit
                  staffing={form.staffing}
                  members={members}
                  onChange={(v) => setField("staffing", v)}
                  hourly={formHourly}
                />
              </div>
            </details>
          )}

          <div className="project-edit-actions">
            <button type="submit" className="btn btn--primary btn--small" disabled={!form.name.trim()}>Save</button>
            <button type="button" className="btn btn--ghost btn--small" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
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
              <span className="project-row-status" style={{ background: statusSt.bg, color: statusSt.color }}>
                {d.status}
              </span>
            )}
            {d.kind && (
              <span
                className="project-row-kind"
                style={KIND_STYLE[d.kind] ? { background: KIND_STYLE[d.kind].bg, color: KIND_STYLE[d.kind].color } : {}}
              >{d.kind}</span>
            )}
          </div>
        </div>

        <div className="project-row-budget-cell">
          {internalOrAdmin ? (
            hourly != null ? (
              <>
                <span className="project-row-budget-twd">
                  {projectedBurnAtMaxTWD != null ? fmtTWD(projectedBurnAtMaxTWD) : fmtTWD(burnSoFarTWD)}
                </span>
                <span className="project-row-budget-orig">
                  Burned {burnSoFarTWD != null ? fmtTWD(burnSoFarTWD) : "—"} · {fmtTWD(hourly)}/h
                </span>
                {projectedBurnAtMaxTWD != null && (
                  <span className="project-row-budget-orig">Projected at max hours</span>
                )}
              </>
            ) : (
              <span className="project-row-empty">Set projected hourly ≥ NT${MIN_INTERNAL_ADMIN_HOURLY_TWD}</span>
            )
          ) : budgTWD != null ? (
            <>
              <span className="project-row-budget-twd">{fmtTWD(budgTWD)}</span>
              <span className="project-row-budget-orig">
                Donation {donationPct}%
                {donationTWD != null ? ` · ${fmtTWD(donationTWD)}` : ""}
              </span>
              {d.budgetCurrency === "USD" && d.budget && (
                <span className="project-row-budget-orig">{fmtUSD(d.budget)} USD</span>
              )}
            </>
          ) : <span className="project-row-empty">—</span>}
        </div>

        <div className="project-row-hours-cell">
          <span className="project-row-hours-assigned">{fmtH(hours)}</span>
          {maxH != null && <span className="project-row-hours-max">/ {fmtH(maxH)}</span>}
        </div>

        <div className="project-row-wage-cell">
          {hourly != null
            ? <span className="project-row-wage">{fmtTWD(hourly)}<span className="project-row-wage-unit">/h</span></span>
            : <span className="project-row-empty">—</span>}
        </div>

        <div className="project-row-actions" onClick={(e) => e.stopPropagation()}>
          <span className="project-row-chevron">{open ? "▴" : "▾"}</span>
          <IconButton onClick={() => setEditing(true)} title="Edit">{EDIT_ICON}</IconButton>
          <IconButton variant="delete" onClick={() => onDelete(project)} title="Delete">{DELETE_ICON}</IconButton>
        </div>
      </div>

      <div className="project-row-condensed" onClick={() => setOpen((s) => !s)}>
        <div className="condensed-topline">
          <div className="condensed-phase-block">
            <span className="condensed-label">Current phase</span>
            <span className="condensed-phase-val">{phaseNow}</span>
          </div>
          <div className="condensed-phase-meta">
            {d.status && <span className="condensed-status" style={{ background: statusSt.bg, color: statusSt.color }}>{d.status}</span>}
            <span className="condensed-value condensed-value--highlight">
              {remainingHours != null ? `${fmtH(remainingHours)} task hours left` : "Set max hours"}
            </span>
          </div>
        </div>

        {maxH != null && (
          <div className="condensed-progress-track" role="img" aria-label={`Assigned ${fmtH(hours)} out of ${fmtH(maxH)}`}>
            <div
              className="condensed-progress-fill"
              style={{ width: `${Math.max(0, Math.min(100, Math.round((hours / Math.max(1, maxH)) * 100)))}%` }}
            />
          </div>
        )}

        <div className="condensed-chip-row">
          <span className="condensed-chip"><strong>Stages</strong> {sortedStagePlans.length || 0}</span>
          <span className="condensed-chip"><strong>Team</strong> {staffingResolved.length || 0}</span>
          {stageAssignableLeft != null && (
            <span className="condensed-chip condensed-chip--warn"><strong>Stage plan left</strong> {fmtH(Math.max(0, stageAssignableLeft))}</span>
          )}
        </div>
      </div>

      {/* Expanded detail panel */}
      {open && (
        <div className="project-detail">
          <div className="detail-kpi-grid">
            <div className="detail-kpi-card">
              <span className="detail-kpi-label">Task assigned</span>
              <span className="detail-kpi-value">{fmtH(hours)}</span>
              {maxH != null && <span className="detail-kpi-sub">of {fmtH(maxH)}</span>}
            </div>
            {internalOrAdmin ? (
              <div className="detail-kpi-card">
                <span className="detail-kpi-label">Projected burn rate</span>
                <span className="detail-kpi-value">{hourly != null ? `${fmtTWD(hourly)}/h` : "—"}</span>
                <span className="detail-kpi-sub">Internal/Admin minimum NT${MIN_INTERNAL_ADMIN_HOURLY_TWD}/h</span>
              </div>
            ) : (
              <div className="detail-kpi-card">
                <span className="detail-kpi-label">Company donation</span>
                <span className="detail-kpi-value">{donationPct}%</span>
                <span className="detail-kpi-sub">{donationTWD != null ? fmtTWD(donationTWD) : "—"}</span>
              </div>
            )}
            <div className="detail-kpi-card">
              <span className="detail-kpi-label">Task hours left</span>
              <span className="detail-kpi-value">{remainingHours != null ? fmtH(remainingHours) : "—"}</span>
              <span className="detail-kpi-sub">max − assigned tasks</span>
            </div>
            <div className="detail-kpi-card">
              <span className="detail-kpi-label">Stage planned</span>
              <span className="detail-kpi-value">{fmtH(stagePlannedHours)}</span>
              <span className="detail-kpi-sub">{stageAssignableLeft != null ? `${fmtH(Math.max(0, stageAssignableLeft))} left` : "set max hours"}</span>
            </div>
            <div className="detail-kpi-card">
              <span className="detail-kpi-label">Team capacity</span>
              <span className="detail-kpi-value">{fmtH(teamMaxHours)}</span>
              <span className="detail-kpi-sub">{unassignedTeamHours != null ? `${fmtH(unassignedTeamHours)} unassigned` : ""}</span>
            </div>
            {internalOrAdmin ? (
              <div className="detail-kpi-card">
                <span className="detail-kpi-label">Burned so far</span>
                <span className="detail-kpi-value">{burnSoFarTWD != null ? fmtTWD(burnSoFarTWD) : "—"}</span>
                <span className="detail-kpi-sub">
                  {projectedBurnAtMaxTWD != null ? `Projected max ${fmtTWD(projectedBurnAtMaxTWD)}` : "Set max hours for full projection"}
                </span>
              </div>
            ) : (
              <div className="detail-kpi-card">
                <span className="detail-kpi-label">Budget after donation</span>
                <span className="detail-kpi-value">{effectiveBudgetTWD != null ? fmtTWD(effectiveBudgetTWD) : "—"}</span>
                <span className="detail-kpi-sub">used for hourly estimate</span>
              </div>
            )}
          </div>

          {maxH != null && (
            <div className="detail-allocation-bars">
              <div className="allocation-row">
                <span className="allocation-label">Tasks</span>
                <div className="allocation-track">
                  <div className="allocation-fill allocation-fill--tasks" style={{ width: `${Math.max(0, Math.min(100, Math.round((hours / Math.max(1, maxH)) * 100)))}%` }} />
                </div>
                <span className="allocation-value">{fmtH(hours)}</span>
              </div>
              <div className="allocation-row">
                <span className="allocation-label">Stage plan</span>
                <div className="allocation-track">
                  <div className="allocation-fill allocation-fill--stage" style={{ width: `${Math.max(0, Math.min(100, Math.round((stagePlannedHours / Math.max(1, maxH)) * 100)))}%` }} />
                </div>
                <span className="allocation-value">{fmtH(stagePlannedHours)}</span>
              </div>
              <div className="allocation-row">
                <span className="allocation-label">Team cap</span>
                <div className="allocation-track">
                  <div className="allocation-fill allocation-fill--team" style={{ width: `${Math.max(0, Math.min(100, Math.round((teamMaxHours / Math.max(1, maxH)) * 100)))}%` }} />
                </div>
                <span className="allocation-value">{fmtH(teamMaxHours)}</span>
              </div>
            </div>
          )}

          {/* ── Stage timeline ── */}
          {sortedStagePlans.length > 0 && (
            <div className="detail-timeline">
              <span className="detail-section-label">Stage plan</span>
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
                      <div className="timeline-bar" style={{ opacity: 0.15 + (i / sortedStagePlans.length) * 0.6 }} />
                      <span className="timeline-stage-name">{sp.name}</span>
                      <span className="timeline-stage-meta">
                        {wks}w{sp.perspectiveHours > 0 ? ` · ${sp.perspectiveHours}h` : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Team ── */}
          <div className="detail-team">
            <div className="detail-team-header">
              <span className="detail-section-label">Team staffing</span>
              <span className="team-unassigned">
                Assigned {fmtH(teamMaxHours)}{maxH != null ? ` / ${fmtH(maxH)}` : ""}
                {unassignedTeamHours != null ? ` · Unassigned ${fmtH(unassignedTeamHours)}` : ""}
                {teamWorkedHours > 0 ? ` · Worked ${fmtH(teamWorkedHours)}` : ""}
              </span>
            </div>
            {staffingResolved.length === 0 ? (
              <p className="snapshot-empty">No team assigned yet.</p>
            ) : (
              <div className="detail-team-cards">
                {staffingResolved.map((s, i) => (
                  <div key={s.id || i} className="team-card">
                    <div className="team-card-top">
                      <span className="team-card-name">{s.member?.data?.name || s.memberId}</span>
                      {s.maxHours > 0 && <span className="team-card-hours">{s.maxHours}h</span>}
                    </div>
                    <div className="team-card-roles">
                      {(s.roles || []).map((r) => (
                        <span key={r} className={"role-view-chip role-view-chip--" + r}>
                          {STAFFING_ROLES.find((sr) => sr.value === r)?.label || r}
                        </span>
                      ))}
                    </div>
                    {hourly != null && (
                      <div className="team-card-pay-row">
                        <span className="team-card-pay-label">Pay est.</span>
                        <span className="team-card-pay-value">{fmtTWD((Number(s.maxHours) || 0) * hourly)}</span>
                      </div>
                    )}
                    {hourly != null && (
                      <div className="team-card-pay-row team-card-pay-row--muted">
                        <span className="team-card-pay-label">Worked pay</span>
                        <span className="team-card-pay-value">
                          {fmtTWD(assignedHoursForMember(allTasks, project.id, s.memberId) * hourly)}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

// ─ ProjectsPage ──────────────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [members,  setMembers]  = useState([]);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [toasts, setToasts]     = useState([]);

  useEffect(() => {
    if (!firebaseReady) return;
    const u1 = subscribeCollection("projects", setProjects);
    const u2 = subscribeCollection("tasks",    setAllTasks);
    const u3 = subscribeCollection("members",  setMembers);
    return () => { u1(); u2(); u3(); };
  }, []);

  function addToast(message, isError = false) {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, isError }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2500);
  }

  function setField(field, value) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "kind" && isInternalOrAdminKind(value) && !String(next.projectedHourlyWage || "").trim()) {
        next.projectedHourlyWage = String(MIN_INTERNAL_ADMIN_HOURLY_TWD);
      }
      return next;
    });
  }

  async function handleAdd(e) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) return;
    const internalOrAdmin = isInternalOrAdminKind(form.kind);
    const projectedHourlyWage = form.projectedHourlyWage ? Number(form.projectedHourlyWage) : null;
    if (internalOrAdmin && (!Number.isFinite(projectedHourlyWage) || projectedHourlyWage < MIN_INTERNAL_ADMIN_HOURLY_TWD)) {
      addToast(`For Internal/Admin projects, projected hourly wage must be at least NT$${MIN_INTERNAL_ADMIN_HOURLY_TWD}/h.`, true);
      return;
    }
    setSaving(true);
    try {
      await createDocument("projects", {
        name,
        kind:           form.kind           || null,
        status:         form.status         || null,
        budget:         form.budget         ? Number(form.budget) : null,
        budgetCurrency: form.budgetCurrency,
        donationPercent: Number(form.donationPercent) || 0,
        projectedHourlyWage: internalOrAdmin ? projectedHourlyWage : null,
        maxHours:       form.maxHours       ? Number(form.maxHours) : null,
        startDate:      form.startDate      || null,
        stagePlans:     [],
        stages:         [],
        staffing:       [],
        createdAt:      Date.now(),
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
    try {
      await replaceDocument("projects", project.id, { ...project.data, ...data, updatedAt: Date.now() });
      addToast("Saved");
    } catch (err) {
      addToast(err.message || "Could not save", true);
    }
  }

  async function handleDelete(project) {
    try {
      await deleteDocument("projects", project.id);
      addToast("Deleted");
    } catch (err) {
      addToast(err.message || "Could not delete", true);
    }
  }

  const totalBudgetTWD = useMemo(() =>
    projects.reduce((s, p) => s + (budgetToTWD(p.data.budget, p.data.budgetCurrency) || 0), 0),
    [projects]
  );

  const totalCompanyPoolTWD = useMemo(() =>
    projects.reduce((s, p) => {
      const budget = budgetToTWD(p.data.budget, p.data.budgetCurrency);
      return s + (donationAmount(budget, p.data.donationPercent) || 0);
    }, 0),
    [projects]
  );

  const totalMemberDistributableTWD = useMemo(() =>
    projects.reduce((s, p) => {
      const budget = budgetToTWD(p.data.budget, p.data.budgetCurrency);
      const donation = donationAmount(budget, p.data.donationPercent) || 0;
      if (budget == null) return s;
      return s + Math.max(0, budget - donation);
    }, 0),
    [projects]
  );

  return (
    <div className="projects-page">
      <div className="members-header">
        <h2 className="section-title">Projects</h2>
        <p className="section-subtitle">
          {projects.length} project{projects.length !== 1 ? "s" : ""}
          {totalBudgetTWD > 0 && (
            <>
              {" "}&middot; NT${new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(totalBudgetTWD)} total
              {" "}&middot; Pool NT${new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(totalCompanyPoolTWD)}
              {" "}&middot; Member budget NT${new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(totalMemberDistributableTWD)}
            </>
          )}
        </p>
      </div>

      <form className="project-add-form" onSubmit={handleAdd}>
        <input
          className="project-field project-field--name"
          type="text"
          placeholder="Project name *"
          value={form.name}
          onChange={(e) => setField("name", e.target.value)}
          required
        />
        <select className="project-field project-field--kind" value={form.kind} onChange={(e) => setField("kind", e.target.value)}>
          <option value="">Kind…</option>
          {PROJECT_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <select className="project-field project-field--status" value={form.status} onChange={(e) => setField("status", e.target.value)}>
          <option value="">Status…</option>
          {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="project-budget-group">
          <input
            className="project-field project-field--budget"
            type="number"
            placeholder="Budget"
            min="0"
            step="1"
            value={form.budget}
            onChange={(e) => setField("budget", e.target.value)}
          />
          <select className="project-field project-field--currency" value={form.budgetCurrency} onChange={(e) => setField("budgetCurrency", e.target.value)}>
            <option value="TWD">TWD</option>
            <option value="USD">USD</option>
          </select>
        </div>
        <select
          className="project-field project-field--donation"
          value={form.donationPercent}
          onChange={(e) => setField("donationPercent", e.target.value)}
          title="Company donation percentage"
        >
          {DONATION_OPTIONS.map((pct) => (
            <option key={pct} value={pct}>{pct}% donation</option>
          ))}
        </select>
        {isInternalOrAdminKind(form.kind) && (
          <input
            className="project-field"
            type="number"
            placeholder={`Projected hourly (>=${MIN_INTERNAL_ADMIN_HOURLY_TWD})`}
            min={MIN_INTERNAL_ADMIN_HOURLY_TWD}
            step="1"
            value={form.projectedHourlyWage}
            onChange={(e) => setField("projectedHourlyWage", e.target.value)}
            title="Projected hourly wage for Internal/Admin projects (TWD)"
          />
        )}
        <button type="submit" className="btn btn--primary" disabled={saving || !form.name.trim()}>
          Add project
        </button>
      </form>

      {projects.length > 0 && (
        <div className="project-col-headers">
          <span>Name</span>
          <span>Budget</span>
          <span>Hours</span>
          <span>Hourly Rate (TWD)</span>
          <span />
        </div>
      )}

      {projects.length === 0 ? (
        <p className="empty-state">No projects yet.</p>
      ) : (
        <ul className="project-list">
          {[...projects]
            .sort((a, b) => (Number(b.data.createdAt) || 0) - (Number(a.data.createdAt) || 0))
            .map((p) => (
              <ProjectRow
                key={p.id}
                project={p}
                allTasks={allTasks}
                members={members}
                onSave={handleSave}
                onDelete={handleDelete}
              />
            ))}
        </ul>
      )}

      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={t.isError ? "toast toast--error" : "toast"}>{t.message}</div>
        ))}
      </div>
    </div>
  );
}
