"use client";

import { useEffect, useState, useMemo } from "react";
import {
  subscribeCollection,
  createDocument,
  replaceDocument,
  deleteDocument,
} from "../../firestore";
import { firebaseReady } from "../../firebase";

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

const EMPTY_FORM = {
  name: "",
  kind: "",
  status: "",
  budget: "",
  budgetCurrency: "TWD",
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
          <input
            className="project-field stage-field--name"
            type="text"
            placeholder="Stage name"
            value={sp.name}
            onChange={(e) => setSpField(i, "name", e.target.value)}
          />
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
          <button type="button" className="icon-btn icon-btn--delete" onClick={() => removeStage(i)}>×</button>
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
function StaffingEdit({ staffing, members, onChange }) {
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
      {members.map((m) => {
        const entry = staffing.find((s) => s.memberId === m.id);
        const active = !!entry;
        return (
          <div key={m.id} className={"staffing-member" + (active ? " staffing-member--on" : "")}>
            <label className="staffing-member-toggle">
              <input type="checkbox" checked={active} onChange={() => toggleMember(m.id)} />
              <span className="staffing-member-name">{m.data.name || m.id}</span>
            </label>
            {active && (
              <div className="staffing-member-detail">
                <div className="staffing-roles" aria-label="Primary role">
                  {STAFFING_ROLES.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      className={"role-chip" + (entry.roles.includes(r.value) ? " role-chip--on" : "")}
                      onClick={() => setPrimaryRole(m.id, r.value)}
                    >{r.label}</button>
                  ))}
                </div>
                <label className="staffing-hours-label">
                  max hrs
                  <input
                    className="project-field staffing-field--hours"
                    type="number"
                    placeholder="0"
                    min="0"
                    step="1"
                    value={entry.maxHours}
                    onChange={(e) => setStaffField(m.id, "maxHours", e.target.value)}
                  />
                </label>
              </div>
            )}
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
    maxHours:       d.maxHours != null ? String(d.maxHours) : "",
    startDate:      d.startDate      || "",
    stagePlans:     normalizeStagePlans(d.stagePlans),
    staffing:       normalizeStaffing(d.staffing),
  });

  function setField(k, v) { setForm((p) => ({ ...p, [k]: v })); }

  function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) return;

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
  const hourly    = (budgTWD && maxH) ? Math.round(budgTWD / maxH) : null;
  const remainingHours = maxH != null ? Math.max(0, maxH - hours) : null;
  const twks      = totalWeeks(d.stagePlans);
  const statusSt  = d.status ? (STATUS_STYLE[d.status] || {}) : {};

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

  const teamMaxHours = useMemo(() => {
    if (!Array.isArray(d.staffing)) return 0;
    return d.staffing.reduce((s, entry) => s + (Number(entry.maxHours) || 0), 0);
  }, [d.staffing]);

  const unassignedTeamHours = maxH != null ? Math.max(0, maxH - teamMaxHours) : null;

  const stagePreview = sortedStagePlans
    .map((sp) => sp.name)
    .filter(Boolean)
    .slice(0, 3)
    .join(" · ");

  const teamPreview = staffingResolved
    .map((s) => s.member?.data?.name || s.memberId)
    .filter(Boolean)
    .slice(0, 3)
    .join(", ");

  if (editing) {
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
          <div className="project-edit-section">
            <span className="project-edit-label">Stage plan</span>
            <StagePlanEdit
              stagePlans={form.stagePlans}
              onChange={(v) => setField("stagePlans", v)}
            />
          </div>

          {/* Staffing */}
          {members.length > 0 && (
            <div className="project-edit-section">
              <span className="project-edit-label">Team staffing</span>
              <StaffingEdit
                staffing={form.staffing}
                members={members}
                onChange={(v) => setField("staffing", v)}
              />
            </div>
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
          {budgTWD != null ? (
            <>
              <span className="project-row-budget-twd">{fmtTWD(budgTWD)}</span>
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
          <button type="button" className="icon-btn" onClick={() => setEditing(true)} title="Edit">✏️</button>
          <button type="button" className="icon-btn icon-btn--delete" onClick={() => onDelete(project)} title="Delete">×</button>
        </div>
      </div>

      <div className="project-row-condensed" onClick={() => setOpen((s) => !s)}>
        <span className="condensed-item">
          <strong>Stages:</strong> {stagePreview || "Not set"}
          {sortedStagePlans.length > 3 ? ` +${sortedStagePlans.length - 3} more` : ""}
        </span>
        <span className="condensed-item">
          <strong>Team:</strong> {teamPreview || "Unassigned"}
          {staffingResolved.length > 3 ? ` +${staffingResolved.length - 3}` : ""}
        </span>
        {remainingHours != null && (
          <span className="condensed-item condensed-item--highlight"><strong>Unassigned work:</strong> {fmtH(remainingHours)}</span>
        )}
      </div>

      {/* Expanded detail panel */}
      {open && (
        <div className="project-detail">
          {/* ── Stats bar ── */}
          <div className="detail-stats">
            {d.startDate && (
              <div className="detail-stat">
                <span className="detail-stat-label">Start</span>
                <span className="detail-stat-val">{fmtDate(d.startDate)}</span>
              </div>
            )}
            {twks > 0 && (
              <div className="detail-stat">
                <span className="detail-stat-label">Duration</span>
                <span className="detail-stat-val">{twks} wk{twks !== 1 ? "s" : ""}</span>
                {d.startDate && <span className="detail-stat-sub">ends ~{addWeeks(d.startDate, twks)}</span>}
              </div>
            )}
            {maxH && (
              <div className="detail-stat">
                <span className="detail-stat-label">Max hours</span>
                <span className="detail-stat-val">{fmtH(maxH)}</span>
              </div>
            )}
            {remainingHours != null && (
              <div className="detail-stat">
                <span className="detail-stat-label">Unassigned work</span>
                <span className="detail-stat-val">{fmtH(remainingHours)}</span>
              </div>
            )}
            {hourly != null && (
              <div className="detail-stat">
                <span className="detail-stat-label">Rate</span>
                <span className="detail-stat-val">{fmtTWD(hourly)}/h</span>
              </div>
            )}
          </div>

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
              {unassignedTeamHours != null && (
                <span className="team-unassigned">Unassigned team hours: {fmtH(unassignedTeamHours)}</span>
              )}
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

  function setField(field, value) { setForm((prev) => ({ ...prev, [field]: value })); }

  async function handleAdd(e) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) return;
    setSaving(true);
    try {
      await createDocument("projects", {
        name,
        kind:           form.kind           || null,
        status:         form.status         || null,
        budget:         form.budget         ? Number(form.budget) : null,
        budgetCurrency: form.budgetCurrency,
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

  return (
    <div className="projects-page">
      <div className="members-header">
        <h2 className="section-title">Projects</h2>
        <p className="section-subtitle">
          {projects.length} project{projects.length !== 1 ? "s" : ""}
          {totalBudgetTWD > 0 && <> &middot; NT${new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(totalBudgetTWD)} total</>}
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
