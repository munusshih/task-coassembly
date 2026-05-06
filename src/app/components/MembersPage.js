"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import {
  subscribeCollection,
  createDocument,
  replaceDocument,
  deleteDocument,
} from "../../firestore";
import { firebaseReady } from "../../firebase";
import Button from "./Button";
import IconButton from "./IconButton";
import { DELETE_ICON, MEMBER_VIEW_ICON, PROJECT_VIEW_ICON } from "./icons";
import BoardSection from "./ui/BoardSection";
import CollectionLayout from "./ui/CollectionLayout";
import CreateBar from "./ui/CreateBar";
import EmptyState from "./ui/EmptyState";
import EntityCard from "./ui/EntityCard";
import InputField from "./ui/InputField";
import PaperSurface from "./ui/PaperSurface";
import PageControls from "./ui/PageControls";
import Pill from "./ui/Pill";
import SelectField from "./ui/SelectField";
import SectionBlock from "./ui/SectionBlock";
import StatusStack from "./ui/StatusStack";
import TabPage from "./ui/TabPage";
import ViewToggle from "./ui/ViewToggle";
import DeleteConfirmDialog from "./ui/DeleteConfirmDialog";
import {
  memberPlanningTexture,
  memberSnapshotTexture,
  SURFACE_TEXTURES,
} from "./ui/paperTextures";

// ─── Constants ───────────────────────────────────────────────────────────────────────────────

const TODO_TYPE = "memberTodo";
const UNIT_OPTIONS = Array.from({ length: 40 }, (_, i) => i + 1);

const TASK_BOARD_CACHE_KEY = "coassembly-task-board-cache-v1";
const TASK_BOARD_WEEK_KEY = "coassembly-task-board-week-v1";
const MEMBER_DRAFT_PREFIX = "coassembly-member-draft-v1";

// ─── Helpers ──────────────────────────────────────────────────────────────────────────────────

function readLocalJSON(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeLocalJSON(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage write failures.
  }
}

function readTaskBoardCache() {
  const fallback = { members: [], tasks: [], projects: [] };
  const parsed = readLocalJSON(TASK_BOARD_CACHE_KEY, fallback);
  if (!parsed || typeof parsed !== "object") return fallback;
  return {
    members: Array.isArray(parsed.members) ? parsed.members : [],
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
    projects: Array.isArray(parsed.projects) ? parsed.projects : [],
  };
}

function memberDraftKey(memberId) {
  return `${MEMBER_DRAFT_PREFIX}:${memberId}`;
}

function normalizeTaskSubtaskList(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((item) => {
      if (typeof item === "string") {
        const text = item.trim();
        return text ? { text, completed: false } : null;
      }
      if (!item || typeof item !== "object") return null;
      const text = typeof item.text === "string" ? item.text.trim() : "";
      if (!text) return null;
      return { text, completed: Boolean(item.completed) };
    })
    .filter(Boolean);
}

function normalizeTaskLinkList(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((item) => {
      if (typeof item === "string") {
        const url = item.trim();
        return url ? { name: "", url } : null;
      }
      if (!item || typeof item !== "object") return null;
      const url = typeof item.url === "string" ? item.url.trim() : "";
      if (!url) return null;
      const name = typeof item.name === "string" ? item.name.trim() : "";
      return { name, url };
    })
    .filter(Boolean);
}

function toLinkHref(rawUrl) {
  const trimmed = (rawUrl || "").trim();
  if (!trimmed) return "";
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function formatLinkLabel(rawUrl) {
  const href = toLinkHref(rawUrl);
  if (!href) return rawUrl;
  try {
    const parsed = new URL(href);
    const host = parsed.hostname.replace(/^www\./i, "");
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    const value = `${host}${path}`;
    return value.length > 36 ? `${value.slice(0, 33)}...` : value;
  } catch {
    return rawUrl;
  }
}

function emptyEditDraft() {
  return {
    title: "",
    timeUnits: "",
    projectId: "",
    deadline: "",
    subtasks: [],
    links: [],
  };
}

function normalizeEditDraft(raw) {
  if (!raw || typeof raw !== "object") return emptyEditDraft();
  return {
    title: typeof raw.title === "string" ? raw.title : "",
    timeUnits: raw.timeUnits != null ? String(raw.timeUnits) : "",
    projectId: typeof raw.projectId === "string" ? raw.projectId : "",
    deadline: typeof raw.deadline === "string" ? raw.deadline : "",
    subtasks: normalizeTaskSubtaskList(raw.subtasks),
    links: normalizeTaskLinkList(raw.links),
  };
}

function makeEditDraftFromTodo(todoData) {
  return {
    title: typeof todoData.title === "string" ? todoData.title : "",
    timeUnits: todoData.timeUnits != null ? String(todoData.timeUnits) : "",
    projectId: typeof todoData.projectId === "string" ? todoData.projectId : "",
    deadline: typeof todoData.deadline === "string" ? todoData.deadline : "",
    subtasks: normalizeTaskSubtaskList(todoData.subtasks),
    links: normalizeTaskLinkList(todoData.links),
  };
}

function loadMemberDraft(memberId) {
  const raw = readLocalJSON(memberDraftKey(memberId), null);
  if (!raw || typeof raw !== "object") {
    return {
      addActive: false,
      addTitle: "",
      addTime: "",
      addProject: "",
      addDeadline: "",
      addSubtasks: [],
      addLinks: [],
      editingId: null,
      editDraft: emptyEditDraft(),
    };
  }

  return {
    addActive: Boolean(raw.addActive),
    addTitle: typeof raw.addTitle === "string" ? raw.addTitle : "",
    addTime: raw.addTime != null ? String(raw.addTime) : "",
    addProject: typeof raw.addProject === "string" ? raw.addProject : "",
    addDeadline: typeof raw.addDeadline === "string" ? raw.addDeadline : "",
    addSubtasks: normalizeTaskSubtaskList(raw.addSubtasks),
    addLinks: normalizeTaskLinkList(raw.addLinks),
    editingId: typeof raw.editingId === "string" ? raw.editingId : null,
    editDraft: normalizeEditDraft(raw.editDraft),
  };
}

function formatTimeUnits(units) {
  if (!units) return null;
  const m = units * 15;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return h === 0 ? `${rem}m` : rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

function formatUnitOption(units) {
  return `${units} unit${units !== 1 ? "s" : ""} · ${formatTimeUnits(units)}`;
}

function formatHourAmount(hours) {
  if (hours == null) return "—";
  const totalMinutes = Math.max(0, Math.round(hours * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatDeadline(dateStr) {
  if (!dateStr) return null;
  const [y, mo, d] = dateStr.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function totalWeeklyMinutes(todos) {
  return todos
    .filter((t) => !t.data.archived)
    .reduce((s, t) => s + (Number(t.data.timeUnits) || 0) * 15, 0);
}

function formatWeeklyTime(minutes) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// Returns the Monday of the week containing `ts` (timestamp ms), Mon-Fri only
function getMondayOf(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function weekKey(ts) {
  return getMondayOf(ts).toISOString().slice(0, 10);
}

function weekLabel(mondayDate) {
  const friday = new Date(mondayDate);
  friday.setDate(friday.getDate() + 4);
  const fmt = (d) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const yearSuffix =
    mondayDate.getFullYear() !== new Date().getFullYear()
      ? ` ${mondayDate.getFullYear()}`
      : "";
  return `${fmt(mondayDate)}–${fmt(friday)}${yearSuffix}`;
}

function currentWeekKey() {
  return weekKey(Date.now());
}

function quarterLabel(weekKeyStr) {
  // weekKeyStr is "YYYY-MM-DD" (Monday)
  const [y, m] = weekKeyStr.split("-").map(Number);
  const q = Math.floor((m - 1) / 3) + 1;
  return `Q${q} ${y}`;
}

function relativeWeekTitle(weekKeyStr) {
  const selected = new Date(weekKeyStr + "T00:00:00");
  const current = getMondayOf(Date.now());
  const diff = Math.round(
    (selected.getTime() - current.getTime()) / (7 * 24 * 60 * 60 * 1000),
  );
  if (diff === 0) return "This week";
  if (diff === 1) return "Next week";
  if (diff === 2) return "Two weeks ahead";
  if (diff === -1) return "Last week";
  if (diff === -2) return "Two weeks ago";
  if (diff > 0) return `In ${diff} weeks`;
  return `${Math.abs(diff)} weeks ago`;
}

function sortTodos(items) {
  return [...items].sort((a, b) => {
    const left = Number(a.data.orderIndex ?? a.data.createdAt) || 0;
    const right = Number(b.data.orderIndex ?? b.data.createdAt) || 0;
    if (right !== left) return right - left;
    return String(a.id || "").localeCompare(String(b.id || ""));
  });
}

function isMemberAssignedToProject(project, memberId) {
  if (!project || !memberId) return false;
  const staffing = Array.isArray(project.data?.staffing)
    ? project.data.staffing
    : [];
  return staffing.some((entry) => entry?.memberId === memberId);
}

function getAssignableProjects(projects, memberId) {
  return (projects || []).filter((project) =>
    isMemberAssignedToProject(project, memberId),
  );
}

function isProjectIdAssignable(projects, memberId, projectId) {
  if (!projectId) return true;
  const project = (projects || []).find((item) => item.id === projectId);
  return isMemberAssignedToProject(project, memberId);
}

// ─── TaskItem ─────────────────────────────────────────────────────────────────────────────────

function TaskItem({
  todo,
  projects,
  assignableProjects,
  editingId,
  editDraft,
  onEditStart,
  onEditFieldChange,
  onEditSubtaskChange,
  onEditSubtaskAdd,
  onEditSubtaskRemove,
  onEditLinkChange,
  onEditLinkAdd,
  onEditLinkRemove,
  onEditSave,
  onEditCancel,
  onToggle,
  onToggleSubtask,
  onDelete,
  onOvertimeSave,
  getProjectRemaining,
}) {
  const isEditing = editingId === todo.id;
  const [showOT, setShowOT] = useState(false);
  const [otUnits, setOtUnits] = useState("");

  const { completed, timeUnits, projectId, deadline, title, overtimeUnits } =
    todo.data;
  const memberId = todo.data.memberId;
  const draft = editDraft || emptyEditDraft();
  const draftProjectId = isEditing ? draft.projectId : projectId;
  const editProjects = Array.isArray(assignableProjects)
    ? assignableProjects
    : getAssignableProjects(projects, memberId);
  const selectedProject = (projects || []).find((p) => p.id === draftProjectId);
  const showUnassignedSelectedProject =
    Boolean(draftProjectId) &&
    !isProjectIdAssignable(projects, memberId, draftProjectId);
  const projectName = projects.find((p) => p.id === projectId)?.data?.name;
  const remainingHint = draftProjectId
    ? getProjectRemaining?.(memberId, draftProjectId, todo.id)
    : null;

  const subtasks = normalizeTaskSubtaskList(todo.data.subtasks);
  const links = normalizeTaskLinkList(todo.data.links);

  function handleCheck(checked) {
    onToggle(todo, checked);
    if (checked) setShowOT(true);
    else setShowOT(false);
  }

  function submitOT() {
    onOvertimeSave(todo, otUnits ? Number(otUnits) : null);
    setShowOT(false);
    setOtUnits("");
  }

  if (isEditing) {
    return (
      <li className="todo-item todo-item--editing">
        <div className="todo-checkbox-cell">
          <input
            type="checkbox"
            checked={Boolean(completed)}
            onChange={(e) => onToggle(todo, e.target.checked)}
          />
        </div>
        <div className="todo-edit-form">
          <input
            className="todo-edit-input"
            value={draft.title}
            autoFocus
            onChange={(e) => onEditFieldChange("title", e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onEditCancel();
            }}
          />

          <div className="todo-edit-meta">
            <SelectField
              className="meta-select"
              value={draft.timeUnits}
              onChange={(e) => onEditFieldChange("timeUnits", e.target.value)}
            >
              <option value="">units</option>
              {UNIT_OPTIONS.map((units) => (
                <option key={units} value={units}>
                  {formatUnitOption(units)}
                </option>
              ))}
            </SelectField>
            <SelectField
              className="meta-select"
              value={draft.projectId}
              onChange={(e) => onEditFieldChange("projectId", e.target.value)}
            >
              <option value="">project</option>
              {editProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.data.name || p.id}
                </option>
              ))}
              {showUnassignedSelectedProject && (
                <option value={draftProjectId} disabled>
                  {(selectedProject?.data?.name || draftProjectId) +
                    " (not assigned)"}
                </option>
              )}
            </SelectField>
            {remainingHint ? (
              <span className="meta-helper-chip">{remainingHint}</span>
            ) : null}
            <input
              type="date"
              className="meta-date"
              value={draft.deadline}
              onChange={(e) => onEditFieldChange("deadline", e.target.value)}
            />
          </div>

          <details
            className="todo-edit-disclosure"
            open={draft.subtasks.length > 0}
          >
            <summary className="todo-edit-disclosure-summary">
              <span className="todo-edit-section-title">
                Subtasks ({draft.subtasks.length})
              </span>
              <Button
                type="button"
                variant="ghost"
                size="small"
                onClick={(e) => {
                  e.preventDefault();
                  onEditSubtaskAdd();
                }}
              >
                + Add
              </Button>
            </summary>
            <div className="todo-edit-section">
              {draft.subtasks.length === 0 ? (
                <p className="todo-edit-empty">No subtasks</p>
              ) : (
                <div className="todo-edit-list">
                  {draft.subtasks.map((subtask, idx) => (
                    <div key={`subtask-${idx}`} className="todo-edit-row">
                      <input
                        type="checkbox"
                        className="todo-edit-row-check"
                        checked={Boolean(subtask.completed)}
                        onChange={(e) =>
                          onEditSubtaskChange(
                            idx,
                            "completed",
                            e.target.checked,
                          )
                        }
                      />
                      <input
                        className="todo-edit-row-input"
                        value={subtask.text}
                        placeholder="Subtask"
                        onChange={(e) =>
                          onEditSubtaskChange(idx, "text", e.target.value)
                        }
                      />
                      <IconButton
                        variant="delete"
                        title="Remove subtask"
                        onClick={() => onEditSubtaskRemove(idx)}
                      >
                        {DELETE_ICON}
                      </IconButton>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>

          <details
            className="todo-edit-disclosure"
            open={draft.links.length > 0}
          >
            <summary className="todo-edit-disclosure-summary">
              <span className="todo-edit-section-title">
                Links ({draft.links.length})
              </span>
              <Button
                type="button"
                variant="ghost"
                size="small"
                onClick={(e) => {
                  e.preventDefault();
                  onEditLinkAdd();
                }}
              >
                + Add
              </Button>
            </summary>
            <div className="todo-edit-section">
              {draft.links.length === 0 ? (
                <p className="todo-edit-empty">No links</p>
              ) : (
                <div className="todo-edit-list">
                  {draft.links.map((link, idx) => (
                    <div
                      key={`link-${idx}`}
                      className="todo-edit-row todo-edit-row--link"
                    >
                      <div className="todo-edit-row-fields">
                        <input
                          className="todo-edit-row-input"
                          value={link.name}
                          placeholder="Link name"
                          onChange={(e) =>
                            onEditLinkChange(idx, "name", e.target.value)
                          }
                        />
                        <input
                          className="todo-edit-row-input todo-edit-row-input--url"
                          value={link.url}
                          placeholder="https://..."
                          onChange={(e) =>
                            onEditLinkChange(idx, "url", e.target.value)
                          }
                        />
                      </div>
                      <IconButton
                        variant="delete"
                        title="Remove link"
                        onClick={() => onEditLinkRemove(idx)}
                      >
                        {DELETE_ICON}
                      </IconButton>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>

          <div className="todo-edit-actions">
            <Button
              type="button"
              size="small"
              onClick={() => onEditSave(todo)}
              disabled={!draft.title.trim()}
            >
              Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="small"
              onClick={onEditCancel}
            >
              Cancel
            </Button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <>
      <li className="todo-item">
        <div className="todo-checkbox-cell">
          <input
            type="checkbox"
            checked={Boolean(completed)}
            onChange={(e) => handleCheck(e.target.checked)}
          />
        </div>
        <div
          className="todo-content"
          onClick={() => !completed && onEditStart(todo)}
        >
          <span
            className={completed ? "todo-text todo-text--done" : "todo-text"}
          >
            {title || "Untitled"}
          </span>
          {(timeUnits || overtimeUnits || projectId || deadline) && (
            <div className="todo-chips">
              {timeUnits && (
                <Pill className="chip--time">
                  {formatTimeUnits(timeUnits)}
                  {overtimeUnits ? (
                    <span className="chip-ot">
                      +{formatTimeUnits(overtimeUnits)} OT
                    </span>
                  ) : null}
                </Pill>
              )}
              {!timeUnits && overtimeUnits && (
                <Pill className="chip--ot">
                  {formatTimeUnits(overtimeUnits)} OT
                </Pill>
              )}
              {projectName && (
                <Pill className="chip--project">{projectName}</Pill>
              )}
              {deadline && (
                <Pill className="chip--deadline">
                  {formatDeadline(deadline)}
                </Pill>
              )}
            </div>
          )}
          {(subtasks.length > 0 || links.length > 0) && (
            <details
              className="todo-inline-details"
              onClick={(e) => e.stopPropagation()}
            >
              <summary className="todo-inline-details-summary">
                Details
                {subtasks.length > 0
                  ? ` · ${subtasks.length} subtask${subtasks.length > 1 ? "s" : ""}`
                  : ""}
                {links.length > 0
                  ? ` · ${links.length} link${links.length > 1 ? "s" : ""}`
                  : ""}
              </summary>
              {subtasks.length > 0 && (
                <ul className="todo-subtasks">
                  {subtasks.map((subtask, idx) => (
                    <li
                      key={`view-subtask-${idx}`}
                      className="todo-subtask-item"
                    >
                      <label className="todo-subtask-label">
                        <input
                          type="checkbox"
                          className="todo-subtask-check"
                          checked={Boolean(subtask.completed)}
                          onChange={(e) =>
                            onToggleSubtask(todo, idx, e.target.checked)
                          }
                        />
                        <span
                          className={
                            subtask.completed
                              ? "todo-subtask-text todo-subtask-text--done"
                              : "todo-subtask-text"
                          }
                        >
                          {subtask.text}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              {links.length > 0 && (
                <div className="todo-links">
                  {links.map((link, idx) => (
                    <a
                      key={`view-link-${idx}`}
                      className="todo-link"
                      href={toLinkHref(link.url)}
                      target="_blank"
                      rel="noreferrer"
                      title={link.url}
                    >
                      {link.name || formatLinkLabel(link.url)}
                    </a>
                  ))}
                </div>
              )}
            </details>
          )}
        </div>
        <div className="todo-actions">
          <IconButton
            type="button"
            variant="delete"
            onClick={() => onDelete(todo)}
            title="Delete"
          >
            {DELETE_ICON}
          </IconButton>
        </div>
      </li>
      {showOT && (
        <li className="todo-ot-row">
          <span className="todo-ot-label">Extra time spent?</span>
          <SelectField
            className="meta-select"
            value={otUnits}
            onChange={(e) => setOtUnits(e.target.value)}
            autoFocus
          >
            <option value="">none</option>
            {UNIT_OPTIONS.map((units) => (
              <option key={units} value={units}>
                {formatUnitOption(units)}
              </option>
            ))}
          </SelectField>
          <Button type="button" size="small" onClick={submitOT}>
            Save
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="small"
            onClick={() => setShowOT(false)}
          >
            Skip
          </Button>
        </li>
      )}
    </>
  );
}

// ─── Archive section ──────────────────────────────────────────────────────────────────

function ArchiveSection({ archivedTodos, projects, onUnarchiveAll }) {
  const [open, setOpen] = useState(false);
  const [confirmUnflush, setConfirmUnflush] = useState(false);

  // Group by week key (descending), then by projectId within each week
  const weekGroups = useMemo(() => {
    const byWeek = {};
    for (const todo of archivedTodos) {
      const ts = Number(todo.data.archivedAt || todo.data.updatedAt || 0);
      const key = ts ? weekKey(ts) : "unknown";
      if (!byWeek[key])
        byWeek[key] = { monday: ts ? getMondayOf(ts) : null, todos: [] };
      byWeek[key].todos.push(todo);
    }
    // Sort weeks descending
    return Object.entries(byWeek)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, { monday, todos }]) => {
        // Group todos by project within this week
        const byProject = {};
        for (const todo of todos) {
          const pid = todo.data.projectId || "__none__";
          if (!byProject[pid]) byProject[pid] = [];
          byProject[pid].push(todo);
        }
        const totalMin = todos.reduce(
          (s, t) =>
            s +
            ((Number(t.data.timeUnits) || 0) +
              (Number(t.data.overtimeUnits) || 0)) *
              15,
          0,
        );
        return { key, monday, byProject, totalMin, count: todos.length };
      });
  }, [archivedTodos]);

  if (!archivedTodos.length) return null;

  return (
    <div className="archive-section">
      <div className="archive-header-row">
        <button
          type="button"
          className="archive-toggle"
          onClick={() => setOpen((s) => !s)}
        >
          Archive ({archivedTodos.length}){open ? " ▲" : " ▼"}
        </button>
        {!confirmUnflush ? (
          <button
            type="button"
            className="flush-btn flush-btn--danger"
            onClick={() => setConfirmUnflush(true)}
          >
            Restore all
          </button>
        ) : (
          <span className="archive-unflush-confirm">
            <button
              type="button"
              className="flush-btn flush-btn--danger-confirm"
              onClick={() => {
                setConfirmUnflush(false);
                onUnarchiveAll();
              }}
            >
              Confirm restore
            </button>
            <button
              type="button"
              className="flush-btn"
              onClick={() => setConfirmUnflush(false)}
            >
              Cancel
            </button>
          </span>
        )}
      </div>
      {open && (
        <div className="archive-body">
          {weekGroups.map(({ key, monday, byProject, totalMin, count }) => (
            <div key={key} className="archive-week">
              <div className="archive-week-header">
                <span className="archive-week-label">
                  {monday ? weekLabel(monday) : "Unknown week"}
                </span>
                <span className="archive-week-total">
                  {count} task{count !== 1 ? "s" : ""} ·{" total "}
                  {formatWeeklyTime(totalMin) || "0m"}
                </span>
              </div>
              {Object.entries(byProject).map(([pid, todos]) => {
                const projName =
                  pid === "__none__"
                    ? null
                    : projects.find((p) => p.id === pid)?.data?.name || pid;
                const projMin = todos.reduce(
                  (s, t) =>
                    s +
                    ((Number(t.data.timeUnits) || 0) +
                      (Number(t.data.overtimeUnits) || 0)) *
                      15,
                  0,
                );
                return (
                  <div key={pid} className="archive-project-group">
                    {projName && (
                      <div className="archive-project-header">
                        <span className="archive-project-name">{projName}</span>
                        <span className="archive-project-time">
                          {formatWeeklyTime(projMin) || "0m"}
                        </span>
                      </div>
                    )}
                    <ul className="archive-list">
                      {todos.map((todo) => {
                        const planned = Number(todo.data.timeUnits) || 0;
                        const ot = Number(todo.data.overtimeUnits) || 0;
                        return (
                          <li key={todo.id} className="archive-item">
                            <span className="archive-item-text">
                              {todo.data.title || "Untitled"}
                            </span>
                            <span className="archive-item-meta">
                              {planned ? formatTimeUnits(planned) : null}
                              {ot ? (
                                <span className="archive-ot">
                                  +{formatTimeUnits(ot)}
                                </span>
                              ) : null}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ProjectGroupCard ─────────────────────────────────────────────────────────────────────────

function ProjectGroupCard({
  project,
  tasks,
  members,
  onCreate,
  onToggle,
  onDelete,
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addMemberId, setAddMemberId] = useState("");

  const memberNameById = useMemo(() => {
    const map = {};
    members.forEach((m) => {
      map[m.id] = m.data?.name || m.id;
    });
    return map;
  }, [members]);

  const byMember = useMemo(() => {
    const map = {};
    sortTodos(tasks.filter((t) => !t.data.completed)).forEach((t) => {
      const mid = t.data.memberId;
      if (!map[mid]) map[mid] = [];
      map[mid].push(t);
    });
    sortTodos(tasks.filter((t) => t.data.completed)).forEach((t) => {
      const mid = t.data.memberId;
      if (!map[mid]) map[mid] = [];
      if (!map[mid].find((x) => x.id === t.id)) map[mid].push(t);
    });
    return map;
  }, [tasks]);

  const totalActive = tasks.filter((t) => !t.data.completed).length;

  async function handleAdd() {
    const title = addTitle.trim();
    if (!title || !addMemberId) return;
    await onCreate(addMemberId, {
      title,
      timeUnits: null,
      projectId: project?.id || null,
      deadline: null,
      subtasks: [],
      links: [],
    });
    setAddTitle("");
    setAddMemberId("");
    setAddOpen(false);
  }

  return (
    <BoardSection
      title={project?.data?.name || "Unassigned"}
      badge={`${totalActive} active`}
    >
      <div className="wish-list-area">
        {Object.keys(byMember).length === 0 && !addOpen && (
          <p className="todo-empty todo-empty--inset">No active tasks.</p>
        )}
        {Object.entries(byMember).map(([mid, memberTasks]) => (
          <div key={mid} className="project-member-group">
            <div className="project-member-label">
              {memberNameById[mid] || mid}
            </div>
            <PaperSurface
              className="project-member-paper"
              texture={SURFACE_TEXTURES.memberProjectBoard}
            >
              <ul className="wish-list">
                {memberTasks.map((task) => (
                  <li key={task.id} className="wish-item wish-item--task">
                    <div className="wish-item-main">
                      <input
                        type="checkbox"
                        className="wish-task-check"
                        checked={Boolean(task.data.completed)}
                        onChange={(e) => onToggle(task, e.target.checked)}
                      />
                      <span
                        className={
                          task.data.completed
                            ? "wish-item-text todo-text--done"
                            : "wish-item-text"
                        }
                      >
                        {task.data.title || "Untitled"}
                      </span>
                      {task.data.timeUnits && (
                        <Pill size="xs">
                          {formatTimeUnits(task.data.timeUnits)}
                        </Pill>
                      )}
                      <IconButton
                        type="button"
                        variant="delete"
                        onClick={() => onDelete(task)}
                        title="Delete"
                      >
                        {DELETE_ICON}
                      </IconButton>
                    </div>
                  </li>
                ))}
              </ul>
            </PaperSurface>
          </div>
        ))}
        <CreateBar
          open={addOpen}
          onOpen={() => setAddOpen(true)}
          label="Add task"
          inset
          rowClassName="backlog-add-row backlog-add-row--inset"
        >
          <InputField
            className="backlog-add-input"
            type="text"
            placeholder="Task title…"
            value={addTitle}
            autoFocus
            onChange={(e) => setAddTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setAddOpen(false);
                setAddTitle("");
                setAddMemberId("");
              }
            }}
          />
          <SelectField
            className="backlog-member-select"
            value={addMemberId}
            onChange={(e) => setAddMemberId(e.target.value)}
          >
            <option value="">Member…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.data?.name || m.id}
              </option>
            ))}
          </SelectField>
          <Button
            type="button"
            size="small"
            onClick={handleAdd}
            disabled={!addTitle.trim() || !addMemberId}
          >
            Add
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="small"
            onClick={() => {
              setAddOpen(false);
              setAddTitle("");
              setAddMemberId("");
            }}
          >
            Cancel
          </Button>
        </CreateBar>
      </div>
    </BoardSection>
  );
}

// ─── MemberCard ───────────────────────────────────────────────────────────────────────────────

function MemberCard({
  member,
  todos,
  projects,
  onCreate,
  onToggle,
  onToggleSubtask,
  onSaveEdit,
  onDelete,
  onArchiveAll,
  onUnarchiveAll,
  onOvertimeSave,
  onProjectRemaining,
  selectedWeek,
}) {
  const [ui, setUi] = useState(() => loadMemberDraft(member.id));
  const addInputRef = useRef(null);

  const isCurrentWeek = !selectedWeek || selectedWeek === currentWeekKey();

  const activeTodos = sortTodos(todos.filter((t) => !t.data.archived));
  const archivedTodos = todos
    .filter((t) => t.data.archived)
    .sort(
      (a, b) =>
        (Number(b.data.archivedAt) || 0) - (Number(a.data.archivedAt) || 0),
    );

  const {
    addActive,
    addTitle,
    addTime,
    addProject,
    addDeadline,
    addSubtasks,
    addLinks,
    editingId,
    editDraft,
  } = ui;

  // For past-week snapshot: only tasks archived in that week
  const snapshotTodos = !isCurrentWeek
    ? archivedTodos.filter((t) => {
        const ts = Number(t.data.archivedAt || t.data.updatedAt || 0);
        return ts && weekKey(ts) === selectedWeek;
      })
    : [];

  const snapshotMin = snapshotTodos.reduce(
    (s, t) =>
      s +
      ((Number(t.data.timeUnits) || 0) + (Number(t.data.overtimeUnits) || 0)) *
        15,
    0,
  );
  const activeCount = activeTodos.length;
  const archivedCount = archivedTodos.length;

  const addRemainingHint = addProject
    ? onProjectRemaining?.(member.id, addProject, null)
    : null;
  const assignableProjects = useMemo(
    () => getAssignableProjects(projects, member.id),
    [projects, member.id],
  );

  const weeklyLabel = formatWeeklyTime(totalWeeklyMinutes(todos));
  const memberTexture = memberPlanningTexture(member?.data?.role);
  const snapshotTexture = memberSnapshotTexture(member?.data?.role);

  useEffect(() => {
    writeLocalJSON(memberDraftKey(member.id), ui);
  }, [member.id, ui]);

  useEffect(() => {
    if (!editingId) return;
    const stillExists = activeTodos.some((todo) => todo.id === editingId);
    if (!stillExists) {
      setUi((prev) => ({
        ...prev,
        editingId: null,
        editDraft: emptyEditDraft(),
      }));
    }
  }, [editingId, activeTodos]);

  useEffect(() => {
    if (!addProject) return;
    if (isProjectIdAssignable(projects, member.id, addProject)) return;
    setUi((prev) => ({ ...prev, addProject: "" }));
  }, [addProject, projects, member.id]);

  function patchUi(patch) {
    setUi((prev) => ({ ...prev, ...patch }));
  }

  function patchEditDraft(patch) {
    setUi((prev) => ({ ...prev, editDraft: { ...prev.editDraft, ...patch } }));
  }

  function activateAdd() {
    patchUi({ addActive: true });
    requestAnimationFrame(() => addInputRef.current?.focus());
  }

  function cancelAdd() {
    patchUi({
      addActive: false,
      addTitle: "",
      addTime: "",
      addProject: "",
      addDeadline: "",
      addSubtasks: [],
      addLinks: [],
    });
  }

  async function submitAdd() {
    if (!addTitle.trim()) return;
    const created = await onCreate(member.id, {
      title: addTitle.trim(),
      timeUnits: addTime ? Number(addTime) : null,
      projectId: addProject || null,
      deadline: addDeadline || null,
      subtasks: normalizeTaskSubtaskList(addSubtasks),
      links: normalizeTaskLinkList(addLinks),
    });
    if (!created) return;
    patchUi({
      addTitle: "",
      addTime: "",
      addProject: "",
      addDeadline: "",
      addSubtasks: [],
      addLinks: [],
    });
    requestAnimationFrame(() => addInputRef.current?.focus());
  }

  function setAddSubtask(index, field, value) {
    const next = [...addSubtasks];
    next[index] = { ...next[index], [field]: value };
    patchUi({ addSubtasks: next });
  }

  function addAddSubtask() {
    patchUi({ addSubtasks: [...addSubtasks, { text: "", completed: false }] });
  }

  function removeAddSubtask(index) {
    const next = addSubtasks.filter((_, idx) => idx !== index);
    patchUi({ addSubtasks: next });
  }

  function setAddLink(index, field, value) {
    const next = [...addLinks];
    next[index] = { ...next[index], [field]: value };
    patchUi({ addLinks: next });
  }

  function addAddLink() {
    patchUi({ addLinks: [...addLinks, { name: "", url: "" }] });
  }

  function removeAddLink(index) {
    const next = addLinks.filter((_, idx) => idx !== index);
    patchUi({ addLinks: next });
  }

  function startEdit(todo) {
    patchUi({
      editingId: todo.id,
      editDraft: makeEditDraftFromTodo(todo.data),
    });
  }

  function cancelEdit() {
    patchUi({ editingId: null, editDraft: emptyEditDraft() });
  }

  function setEditField(field, value) {
    patchEditDraft({ [field]: value });
  }

  function setEditSubtask(index, field, value) {
    const next = [...editDraft.subtasks];
    next[index] = { ...next[index], [field]: value };
    patchEditDraft({ subtasks: next });
  }

  function addEditSubtask() {
    patchEditDraft({
      subtasks: [...editDraft.subtasks, { text: "", completed: false }],
    });
  }

  function removeEditSubtask(index) {
    const next = editDraft.subtasks.filter((_, idx) => idx !== index);
    patchEditDraft({ subtasks: next });
  }

  function setEditLink(index, field, value) {
    const next = [...editDraft.links];
    next[index] = { ...next[index], [field]: value };
    patchEditDraft({ links: next });
  }

  function addEditLink() {
    patchEditDraft({ links: [...editDraft.links, { name: "", url: "" }] });
  }

  function removeEditLink(index) {
    const next = editDraft.links.filter((_, idx) => idx !== index);
    patchEditDraft({ links: next });
  }

  async function doSaveEdit(todo) {
    const saved = await onSaveEdit(todo, editDraft);
    if (saved) cancelEdit();
  }

  return (
    <EntityCard as="article" className="member-card">
      <div className="member-card-header">
        <div className="member-card-head-main">
          <h3 className="card-name">{member.data.name || "Unnamed"}</h3>
          <div className="member-card-meta">
            <span className="member-card-meta-chip">{activeCount} active</span>
            <span className="member-card-meta-chip">
              {archivedCount} archived
            </span>
          </div>
        </div>
        <span className="member-week-time">
          {isCurrentWeek
            ? weeklyLabel || "no tasks"
            : formatWeeklyTime(snapshotMin) || "—"}
        </span>
      </div>

      {isCurrentWeek ? (
        <PaperSurface texture={memberTexture}>
          <ul className="todo-list">
            {activeTodos.length === 0 && (
              <li className="todo-empty">No tasks yet.</li>
            )}
            {activeTodos.map((todo) => (
              <TaskItem
                key={todo.id}
                todo={todo}
                projects={projects}
                assignableProjects={assignableProjects}
                editingId={editingId}
                editDraft={editingId === todo.id ? editDraft : null}
                onEditStart={startEdit}
                onEditFieldChange={setEditField}
                onEditSubtaskChange={setEditSubtask}
                onEditSubtaskAdd={addEditSubtask}
                onEditSubtaskRemove={removeEditSubtask}
                onEditLinkChange={setEditLink}
                onEditLinkAdd={addEditLink}
                onEditLinkRemove={removeEditLink}
                onEditSave={doSaveEdit}
                onEditCancel={cancelEdit}
                onToggle={onToggle}
                onToggleSubtask={onToggleSubtask}
                onDelete={onDelete}
                onOvertimeSave={onOvertimeSave}
                getProjectRemaining={onProjectRemaining}
              />
            ))}
          </ul>

          {!addActive ? (
            <button className="notepad-add-trigger" onClick={activateAdd}>
              <span className="notepad-add-plus">+</span>
              <span className="notepad-add-placeholder">New task…</span>
            </button>
          ) : (
            <div className="notepad-add-active">
              <div className="notepad-add-main">
                <span className="notepad-add-plus">+</span>
                <input
                  ref={addInputRef}
                  className="notepad-add-input"
                  value={addTitle}
                  placeholder="Task title…"
                  onChange={(e) => patchUi({ addTitle: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") cancelAdd();
                  }}
                />
              </div>
              <div className="notepad-add-meta">
                <span />
                <div className="notepad-add-fields">
                  <SelectField
                    className="meta-select"
                    value={addTime}
                    onChange={(e) => patchUi({ addTime: e.target.value })}
                  >
                    <option value="">units</option>
                    {UNIT_OPTIONS.map((units) => (
                      <option key={units} value={units}>
                        {formatUnitOption(units)}
                      </option>
                    ))}
                  </SelectField>
                  <SelectField
                    className="meta-select"
                    value={addProject}
                    onChange={(e) => patchUi({ addProject: e.target.value })}
                  >
                    <option value="">project</option>
                    {assignableProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.data.name || p.id}
                      </option>
                    ))}
                  </SelectField>
                  {addRemainingHint ? (
                    <span className="meta-helper-chip">{addRemainingHint}</span>
                  ) : null}
                  <input
                    type="date"
                    className="meta-date"
                    value={addDeadline}
                    onChange={(e) => patchUi({ addDeadline: e.target.value })}
                  />
                </div>
              </div>

              <div className="notepad-add-sections">
                <details
                  className="todo-edit-disclosure"
                  open={addSubtasks.length > 0}
                >
                  <summary className="todo-edit-disclosure-summary">
                    <span className="todo-edit-section-title">
                      Subtasks ({addSubtasks.length})
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="small"
                      onClick={(e) => {
                        e.preventDefault();
                        addAddSubtask();
                      }}
                    >
                      + Add
                    </Button>
                  </summary>
                  <div className="todo-edit-section">
                    {addSubtasks.length === 0 ? (
                      <p className="todo-edit-empty">No subtasks</p>
                    ) : (
                      <div className="todo-edit-list">
                        {addSubtasks.map((subtask, idx) => (
                          <div
                            key={`add-subtask-${idx}`}
                            className="todo-edit-row"
                          >
                            <input
                              type="checkbox"
                              className="todo-edit-row-check"
                              checked={Boolean(subtask.completed)}
                              onChange={(e) =>
                                setAddSubtask(
                                  idx,
                                  "completed",
                                  e.target.checked,
                                )
                              }
                            />
                            <input
                              className="todo-edit-row-input"
                              value={subtask.text}
                              placeholder="Subtask"
                              onChange={(e) =>
                                setAddSubtask(idx, "text", e.target.value)
                              }
                            />
                            <IconButton
                              type="button"
                              variant="delete"
                              title="Remove subtask"
                              onClick={() => removeAddSubtask(idx)}
                            >
                              {DELETE_ICON}
                            </IconButton>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </details>

                <details
                  className="todo-edit-disclosure"
                  open={addLinks.length > 0}
                >
                  <summary className="todo-edit-disclosure-summary">
                    <span className="todo-edit-section-title">
                      Links ({addLinks.length})
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="small"
                      onClick={(e) => {
                        e.preventDefault();
                        addAddLink();
                      }}
                    >
                      + Add
                    </Button>
                  </summary>
                  <div className="todo-edit-section">
                    {addLinks.length === 0 ? (
                      <p className="todo-edit-empty">No links</p>
                    ) : (
                      <div className="todo-edit-list">
                        {addLinks.map((link, idx) => (
                          <div
                            key={`add-link-${idx}`}
                            className="todo-edit-row todo-edit-row--link"
                          >
                            <div className="todo-edit-row-fields">
                              <input
                                className="todo-edit-row-input"
                                value={link.name}
                                placeholder="Link name"
                                onChange={(e) =>
                                  setAddLink(idx, "name", e.target.value)
                                }
                              />
                              <input
                                className="todo-edit-row-input todo-edit-row-input--url"
                                value={link.url}
                                placeholder="https://..."
                                onChange={(e) =>
                                  setAddLink(idx, "url", e.target.value)
                                }
                              />
                            </div>
                            <IconButton
                              type="button"
                              variant="delete"
                              title="Remove link"
                              onClick={() => removeAddLink(idx)}
                            >
                              {DELETE_ICON}
                            </IconButton>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </details>
              </div>

              <div className="notepad-add-actions">
                <Button
                  type="button"
                  size="small"
                  onClick={submitAdd}
                  disabled={!addTitle.trim()}
                >
                  Save
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="small"
                  onClick={cancelAdd}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </PaperSurface>
      ) : (
        <PaperSurface texture={snapshotTexture}>
          {snapshotTodos.length === 0 ? (
            <p className="todo-empty">No tasks completed this week.</p>
          ) : (
            <ul className="todo-list snapshot-list">
              {snapshotTodos.map((todo) => {
                const projName = projects.find(
                  (p) => p.id === todo.data.projectId,
                )?.data?.name;
                const t = Number(todo.data.timeUnits) || 0;
                const ot = Number(todo.data.overtimeUnits) || 0;
                return (
                  <li key={todo.id} className="todo-item snapshot-item">
                    <div className="snapshot-check">✓</div>
                    <div className="todo-content">
                      <span className="todo-text todo-text--done">
                        {todo.data.title || "Untitled"}
                      </span>
                      <div className="todo-chips">
                        {t > 0 && (
                          <Pill className="chip--time">
                            {formatTimeUnits(t)}
                            {ot > 0 && (
                              <span className="chip-ot">
                                +{formatTimeUnits(ot)} OT
                              </span>
                            )}
                          </Pill>
                        )}
                        {projName && (
                          <Pill className="chip--project">{projName}</Pill>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </PaperSurface>
      )}

      {isCurrentWeek && (
        <div className="member-card-footer">
          <div className="member-archive-controls">
            {activeTodos.length > 0 && (
              <div className="member-archive-controls-row">
                <button
                  type="button"
                  className="flush-btn"
                  onClick={() => onArchiveAll(member.id)}
                >
                  Flush completed
                </button>
              </div>
            )}
            <div className="member-archive-controls-row">
              <ArchiveSection
                archivedTodos={archivedTodos}
                projects={projects}
                onUnarchiveAll={() => onUnarchiveAll(member.id)}
              />
            </div>
          </div>
        </div>
      )}
    </EntityCard>
  );
}

// ─── MembersPage ────────────────────────────────────────────────────────────────────────────────

export default function MembersPage({
  viewerMemberId = null,
  viewerRole = "associate",
  sharedMembers = null,
  sharedProjects = null,
  sharedTasks = null,
}) {
  const [members, setMembers] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(() => currentWeekKey());
  const [memberViewMode, setMemberViewMode] = useState("member");
  const [deleteTarget, setDeleteTarget] = useState(null); // "member" | "project"
  const isLimitedViewer =
    viewerRole === "flying-member" || viewerRole === "external-collaborator";
  const hasSharedData =
    Array.isArray(sharedMembers) &&
    Array.isArray(sharedProjects) &&
    Array.isArray(sharedTasks);

  useEffect(() => {
    if (hasSharedData) return;
    const cached = readTaskBoardCache();
    if (cached.members.length) setMembers(cached.members);
    if (cached.tasks.length)
      setAllTasks(cached.tasks.filter((i) => i?.data?.type === TODO_TYPE));
    if (cached.projects.length) setProjects(cached.projects);

    const storedWeek = readLocalJSON(TASK_BOARD_WEEK_KEY, null);
    if (typeof storedWeek === "string") {
      setSelectedWeek(storedWeek);
    }
  }, [hasSharedData]);

  useEffect(() => {
    if (!hasSharedData) return;
    setMembers(sharedMembers);
    setProjects(sharedProjects);
    setAllTasks(sharedTasks.filter((i) => i?.data?.type === TODO_TYPE));
  }, [hasSharedData, sharedMembers, sharedProjects, sharedTasks]);

  useEffect(() => {
    if (hasSharedData) return;
    if (!firebaseReady) return;
    const u1 = subscribeCollection("members", setMembers);
    const u2 = subscribeCollection("tasks", (items) =>
      setAllTasks(items.filter((i) => i.data.type === TODO_TYPE)),
    );
    const u3 = subscribeCollection("projects", setProjects);
    return () => {
      u1();
      u2();
      u3();
    };
  }, [hasSharedData]);

  useEffect(() => {
    writeLocalJSON(TASK_BOARD_CACHE_KEY, {
      members,
      tasks: allTasks,
      projects,
      cachedAt: Date.now(),
    });
  }, [members, allTasks, projects]);

  useEffect(() => {
    writeLocalJSON(TASK_BOARD_WEEK_KEY, selectedWeek);
  }, [selectedWeek]);

  useEffect(() => {
    if (!isLimitedViewer) return;
    if (memberViewMode !== "member") {
      setMemberViewMode("member");
    }
  }, [isLimitedViewer, memberViewMode]);

  const visibleMembers = useMemo(() => {
    if (!isLimitedViewer) return members;
    if (!viewerMemberId) return [];
    return members.filter((member) => member.id === viewerMemberId);
  }, [isLimitedViewer, members, viewerMemberId]);

  const visibleProjects = useMemo(() => {
    if (!isLimitedViewer) return projects;
    if (!viewerMemberId) return [];
    return projects.filter((project) =>
      isMemberAssignedToProject(project, viewerMemberId),
    );
  }, [isLimitedViewer, projects, viewerMemberId]);

  const visibleTasks = useMemo(() => {
    if (!isLimitedViewer) return allTasks;
    if (!viewerMemberId) return [];
    return allTasks.filter((task) => task?.data?.memberId === viewerMemberId);
  }, [allTasks, isLimitedViewer, viewerMemberId]);

  const tasksByMember = useMemo(() => {
    const g = {};
    for (const t of visibleTasks) {
      const mid = t.data.memberId;
      if (!mid) continue;
      if (!g[mid]) g[mid] = [];
      g[mid].push(t);
    }
    return g;
  }, [visibleTasks]);

  const sortedProjectsForView = useMemo(
    () =>
      [...visibleProjects].sort((a, b) =>
        (a.data?.name || "").localeCompare(b.data?.name || ""),
      ),
    [visibleProjects],
  );

  const tasksByProject = useMemo(() => {
    const g = {};
    for (const t of visibleTasks) {
      if (t.data.archived) continue;
      const pid = t.data.projectId || "__none__";
      if (!g[pid]) g[pid] = [];
      g[pid].push(t);
    }
    return g;
  }, [visibleTasks]);

  // Collect all weeks that have archived tasks, plus current week
  const availableWeeks = useMemo(() => {
    const weeks = new Set([currentWeekKey()]);
    for (const t of visibleTasks) {
      if (t.data.archived) {
        const ts = Number(t.data.archivedAt || t.data.updatedAt || 0);
        if (ts) weeks.add(weekKey(ts));
      }
    }
    return [...weeks].sort().reverse(); // newest first
  }, [visibleTasks]);

  useEffect(() => {
    if (!availableWeeks.length) return;
    if (!availableWeeks.includes(selectedWeek)) {
      setSelectedWeek(availableWeeks[0]);
    }
  }, [availableWeeks, selectedWeek]);

  function addToast(msg, isError = false) {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message: msg, isError }]);
    window.setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      2500,
    );
  }

  async function handleCreate(memberId, taskData) {
    if (isLimitedViewer && memberId !== viewerMemberId) {
      addToast("You can only add tasks to your own board", true);
      return false;
    }
    const now = Date.now();
    const nextProjectId = taskData.projectId || null;
    if (
      nextProjectId &&
      !isProjectIdAssignable(visibleProjects, memberId, nextProjectId)
    ) {
      addToast("Project is not assigned to this member", true);
      return false;
    }

    try {
      const created = {
        type: TODO_TYPE,
        memberId,
        title: taskData.title,
        timeUnits: taskData.timeUnits || null,
        projectId: taskData.projectId || null,
        deadline: taskData.deadline || null,
        subtasks: normalizeTaskSubtaskList(taskData.subtasks),
        links: normalizeTaskLinkList(taskData.links),
        completed: false,
        archived: false,
        orderIndex: now,
        createdAt: now,
        updatedAt: now,
      };
      const id = await createDocument("tasks", created);
      setAllTasks((prev) => [{ id, data: created }, ...prev]);
      addToast("Task added");
      return true;
    } catch (e) {
      addToast(e.message || "Could not add task", true);
      return false;
    }
  }

  async function handleToggle(task, checked) {
    try {
      const nextData = {
        ...task.data,
        completed: checked,
        updatedAt: Date.now(),
      };
      await replaceDocument("tasks", task.id, nextData);
      setAllTasks((prev) =>
        prev.map((item) =>
          item.id === task.id ? { ...item, data: nextData } : item,
        ),
      );
    } catch (e) {
      addToast(e.message || "Could not update", true);
    }
  }

  async function handleToggleSubtask(task, subtaskIndex, checked) {
    const subtasks = normalizeTaskSubtaskList(task.data.subtasks);
    if (subtaskIndex < 0 || subtaskIndex >= subtasks.length) return;

    subtasks[subtaskIndex] = {
      ...subtasks[subtaskIndex],
      completed: Boolean(checked),
    };

    try {
      const nextData = {
        ...task.data,
        subtasks,
        updatedAt: Date.now(),
      };
      await replaceDocument("tasks", task.id, nextData);
      setAllTasks((prev) =>
        prev.map((item) =>
          item.id === task.id ? { ...item, data: nextData } : item,
        ),
      );
    } catch (e) {
      addToast(e.message || "Could not update subtask", true);
    }
  }

  async function handleSaveEdit(task, draft) {
    const title = (draft.title || "").trim();
    if (!title) return false;
    const memberId = task.data.memberId;
    if (isLimitedViewer && memberId !== viewerMemberId) {
      addToast("You can only edit your own tasks", true);
      return false;
    }
    const nextProjectId = draft.projectId || null;
    if (
      nextProjectId &&
      nextProjectId !== (task.data.projectId || null) &&
      !isProjectIdAssignable(visibleProjects, memberId, nextProjectId)
    ) {
      addToast("Project is not assigned to this member", true);
      return false;
    }

    const parsedUnits = Number(draft.timeUnits);
    const nextTimeUnits =
      Number.isFinite(parsedUnits) && parsedUnits > 0 ? parsedUnits : null;

    try {
      const nextData = {
        ...task.data,
        title,
        timeUnits: nextTimeUnits,
        projectId: draft.projectId || null,
        deadline: draft.deadline || null,
        subtasks: normalizeTaskSubtaskList(draft.subtasks),
        links: normalizeTaskLinkList(draft.links),
        updatedAt: Date.now(),
      };
      await replaceDocument("tasks", task.id, nextData);
      setAllTasks((prev) =>
        prev.map((item) =>
          item.id === task.id ? { ...item, data: nextData } : item,
        ),
      );
      addToast("Task updated");
      return true;
    } catch (e) {
      addToast(e.message || "Could not save", true);
      return false;
    }
  }

  async function handleDelete(task) {
    setDeleteTarget({
      label: task.data?.title || "this task",
      onConfirm: async () => {
        try {
          await deleteDocument("tasks", task.id);
          setAllTasks((prev) => prev.filter((item) => item.id !== task.id));
          addToast("Deleted");
        } catch (e) {
          addToast(e.message || "Could not delete", true);
        } finally {
          setDeleteTarget(null);
        }
      },
    });
  }

  async function handleOvertimeSave(task, otUnits) {
    try {
      const nextData = {
        ...task.data,
        overtimeUnits: otUnits || null,
        updatedAt: Date.now(),
      };
      await replaceDocument("tasks", task.id, nextData);
      setAllTasks((prev) =>
        prev.map((item) =>
          item.id === task.id ? { ...item, data: nextData } : item,
        ),
      );
    } catch (e) {
      addToast(e.message || "Could not save overtime", true);
    }
  }

  async function handleArchiveAll(memberId) {
    if (isLimitedViewer && memberId !== viewerMemberId) {
      addToast("You can only archive your own tasks", true);
      return;
    }
    const tasks = (tasksByMember[memberId] || []).filter(
      (t) => !t.data.archived && t.data.completed,
    );
    if (!tasks.length) return;
    const now = Date.now();
    try {
      await Promise.all(
        tasks.map((t) =>
          replaceDocument("tasks", t.id, {
            ...t.data,
            archived: true,
            archivedAt: now,
          }),
        ),
      );
      const taskIdSet = new Set(tasks.map((task) => task.id));
      setAllTasks((prev) =>
        prev.map((item) => {
          if (!taskIdSet.has(item.id)) return item;
          return {
            ...item,
            data: {
              ...item.data,
              archived: true,
              archivedAt: now,
            },
          };
        }),
      );
      addToast("Flushed completed tasks to archive");
    } catch (e) {
      addToast(e.message || "Could not archive", true);
    }
  }

  async function handleUnarchiveAll(memberId) {
    if (isLimitedViewer && memberId !== viewerMemberId) {
      addToast("You can only restore your own tasks", true);
      return;
    }
    const tasks = (tasksByMember[memberId] || []).filter(
      (t) => t.data.archived,
    );
    if (!tasks.length) return;
    try {
      await Promise.all(
        tasks.map((t) =>
          replaceDocument("tasks", t.id, {
            ...t.data,
            archived: false,
            archivedAt: null,
          }),
        ),
      );
      const taskIdSet = new Set(tasks.map((task) => task.id));
      setAllTasks((prev) =>
        prev.map((item) => {
          if (!taskIdSet.has(item.id)) return item;
          return {
            ...item,
            data: {
              ...item.data,
              archived: false,
              archivedAt: null,
            },
          };
        }),
      );
      addToast("Restored all archived tasks");
    } catch (e) {
      addToast(e.message || "Could not restore", true);
    }
  }

  function projectRemainingHint(memberId, projectId, excludeTaskId = null) {
    if (!projectId || !memberId) return null;
    const project = visibleProjects.find((p) => p.id === projectId);
    if (!project || !Array.isArray(project.data?.staffing)) return null;

    const memberStaffing = project.data.staffing.find(
      (s) => s.memberId === memberId,
    );
    if (!memberStaffing) return "Not assigned in this project's staffing";

    const capacityHours = Number(memberStaffing.maxHours) || 0;
    const assignedHours = visibleTasks
      .filter((t) => t.id !== excludeTaskId)
      .filter((t) => !t.data.archived)
      .filter((t) => t.data.memberId === memberId)
      .filter((t) => t.data.projectId === projectId)
      .reduce((sum, t) => sum + (Number(t.data.timeUnits) || 0) * 0.25, 0);

    const remaining = Math.max(0, capacityHours - assignedHours);
    return `Project remaining: ${formatHourAmount(remaining)} of ${formatHourAmount(capacityHours)}`;
  }

  const MEMBER_TYPE_ORDER = [
    "worker-owner",
    "associate",
    "flying-member",
    "external-collaborator",
  ];
  const MEMBER_TYPE_LABELS = {
    "worker-owner": "Worker-owners",
    associate: "Associates",
    "flying-member": "Flying members",
    "external-collaborator": "External collaborators",
  };

  function normalizeMemberType(raw) {
    const v = String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/[_\s]+/g, "-");
    if (v === "worker-owner" || v === "workerowner") return "worker-owner";
    if (v === "flying-member" || v === "flying") return "flying-member";
    if (v === "external-collaborator" || v === "external")
      return "external-collaborator";
    return "associate";
  }

  const membersByType = useMemo(() => {
    const groups = {};
    for (const m of visibleMembers) {
      const type = normalizeMemberType(m.data?.role);
      if (!groups[type]) groups[type] = [];
      groups[type].push(m);
    }
    return groups;
  }, [visibleMembers]);

  const memberViewOptions = [
    {
      value: "member",
      title: "Member view",
      icon: MEMBER_VIEW_ICON,
    },
    ...(isLimitedViewer
      ? []
      : [
          {
            value: "project",
            title: "Project view",
            icon: PROJECT_VIEW_ICON,
          },
        ]),
  ];

  const memberBoardSubtitle = `${visibleMembers.length} member${visibleMembers.length !== 1 ? "s" : ""} · Weekly planning board`;

  return (
    <TabPage
      className="members-page"
      title={relativeWeekTitle(selectedWeek)}
      badge={quarterLabel(selectedWeek)}
      subtitle={memberBoardSubtitle}
      right={
        <PageControls compact>
          <ViewToggle
            className="projects-view-toggle"
            value={memberViewMode}
            onChange={setMemberViewMode}
            options={memberViewOptions}
            ariaLabel="Member board view"
          />
          <SelectField
            className="week-select"
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
          >
            {availableWeeks.map((wk) => {
              const monday = new Date(wk + "T00:00:00");
              return (
                <option key={wk} value={wk}>
                  {weekLabel(monday)}
                </option>
              );
            })}
          </SelectField>
        </PageControls>
      }
    >
      {visibleMembers.length === 0 && (
        <EmptyState>No members found in Firestore.</EmptyState>
      )}

      {memberViewMode === "project" ? (
        <CollectionLayout variant="board" className="backlog-grid">
          {sortedProjectsForView.map((project) => (
            <ProjectGroupCard
              key={project.id}
              project={project}
              tasks={tasksByProject[project.id] || []}
              members={visibleMembers}
              onCreate={handleCreate}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
          {(tasksByProject["__none__"] || []).length > 0 && (
            <ProjectGroupCard
              key="__none__"
              project={null}
              tasks={tasksByProject["__none__"] || []}
              members={visibleMembers}
              onCreate={handleCreate}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          )}
        </CollectionLayout>
      ) : (
        MEMBER_TYPE_ORDER.filter((type) => membersByType[type]?.length > 0).map(
          (type) => (
            <div key={type} className="members-type-group">
              <h3 className="members-type-heading">
                {MEMBER_TYPE_LABELS[type]}
              </h3>
              <CollectionLayout variant="grid" className="members-grid">
                {membersByType[type].map((member) => (
                  <MemberCard
                    key={member.id}
                    member={member}
                    todos={tasksByMember[member.id] || []}
                    projects={visibleProjects}
                    onCreate={handleCreate}
                    onToggle={handleToggle}
                    onToggleSubtask={handleToggleSubtask}
                    onSaveEdit={handleSaveEdit}
                    onDelete={handleDelete}
                    onArchiveAll={handleArchiveAll}
                    onUnarchiveAll={handleUnarchiveAll}
                    onOvertimeSave={handleOvertimeSave}
                    onProjectRemaining={projectRemainingHint}
                    selectedWeek={selectedWeek}
                  />
                ))}
              </CollectionLayout>
            </div>
          ),
        )
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
    </TabPage>
  );
}
