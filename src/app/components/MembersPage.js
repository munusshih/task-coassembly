"use client";
import TaskTimers from "./time/TaskTimers";
import WorkspaceCreateDock from "./ui/WorkspaceCreateDock";
import BottomComposer from "./ui/BottomComposer";
import TaskClockIcon from "./ui/TaskClockIcon";

import useUrlState, { isDateKey, updateUrlState } from "../hooks/useUrlState";
import { useEffect, useMemo, useState, useRef } from "react";
import {
  subscribeCollection,
  createDocument,
  replaceDocument,
  deleteDocument,
} from "../../firestore";
import { firebaseReady } from "../../firebase";
import { useFocusTask } from "./time/TimeTrackingProvider";
import { durationLabel, workedTaskSeconds } from "./time/trackingModel.mjs";
import { splitTaskBoardByViewer } from "./taskBoardScopes.mjs";
import { hasTaskLink } from "./taskCompletion.mjs";
import TaskWeekInfo from "./TaskWeekInfo";
import WorkspacePageHero from "./ui/WorkspacePageHero";
import CrossIcon from "./ui/CrossIcon";
import ProjectAllocationClock from "./ProjectAllocationClock";
import TaskCreateTrigger from "./TaskCreateTrigger";
import { isWorkerOwner } from "../../authAccess";
import Button from "./Button";
import IconButton from "./IconButton";
import {
  DELETE_ICON,
  IconFolder,
} from "./icons";
import BoardSection from "./ui/BoardSection";
import CollectionLayout from "./ui/CollectionLayout";
import EmptyState from "./ui/EmptyState";
import EntityCard from "./ui/EntityCard";
import Surface from "./ui/Surface";
import Pill from "./ui/Pill";
import SelectField from "./ui/SelectField";
import SectionBlock from "./ui/SectionBlock";
import StatusStack from "./ui/StatusStack";
import TabPage from "./ui/TabPage";
import TaskCreateForm, { emptyTaskCreateDraft } from "./TaskCreateForm";
import ReasonDialog from "./ui/ReasonDialog";
import { actionRecord } from "../../lib/actionReason.mjs";
import DeleteConfirmDialog from "./ui/DeleteConfirmDialog";
import ModalShell from "./ui/ModalShell";
import {
  canPushTaskToNewestWeek,
  canViewerManageMemberTask,
  currentWeekKey,
  getAssignableProjects,
  isMemberActive,
  isMemberAssignedToProject,
  isEditableWeekKey,
  isUnfinishedTaskOutsideWeek,
  isProjectClosed,
  isProjectIdAssignable,
  previousWeekKey,
  taskWeekKey,
  weekStartDateForTs,
} from "./taskBoardRules";

// ─── Constants ───────────────────────────────────────────────────────────────────────────────

const TODO_TYPE = "memberTodo";
const UNIT_OPTIONS = Array.from({ length: 40 }, (_, i) => i + 1);

const TASK_BOARD_CACHE_KEY = "coassembly-task-board-cache-v1";
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

function workedWeeklyMinutes(todos) {
  return todos.reduce((sum, task) => sum + workedTaskSeconds(task.data) / 60, 0);
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

function quarterLabel(weekKeyStr) {
  // weekKeyStr is "YYYY-MM-DD" (Monday)
  const [y, m] = weekKeyStr.split("-").map(Number);
  const q = Math.floor((m - 1) / 3) + 1;
  return `Q${q} ${y}`;
}

function relativeWeekTitle(weekKeyStr) {
  const selected = new Date(weekKeyStr + "T00:00:00");
  const current = weekStartDateForTs(Date.now());
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

function dedupeItemsById(items) {
  const map = new Map();
  for (const item of items || []) {
    const id = item?.id;
    if (!id) continue;
    const existing = map.get(id);
    if (!existing) {
      map.set(id, item);
      continue;
    }
    const prevUpdated = Number(
      existing?.data?.updatedAt || existing?.data?.createdAt || 0,
    );
    const nextUpdated = Number(
      item?.data?.updatedAt || item?.data?.createdAt || 0,
    );
    if (nextUpdated >= prevUpdated) map.set(id, item);
  }
  return [...map.values()];
}

function ReadOnlyTaskDetails({ todo, keyPrefix }) {
  const subtasks = normalizeTaskSubtaskList(todo.data.subtasks);
  const links = normalizeTaskLinkList(todo.data.links);

  if (subtasks.length === 0 && links.length === 0) return null;

  return (
    <details className="todo-inline-details">
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
              key={`${keyPrefix}-subtask-${todo.id}-${idx}`}
              className="todo-subtask-item"
            >
              <span
                className={
                  subtask.completed
                    ? "todo-subtask-text todo-subtask-text--done"
                    : "todo-subtask-text"
                }
              >
                {subtask.completed ? "[x] " : "[ ] "}
                {subtask.text}
              </span>
            </li>
          ))}
        </ul>
      )}
      {links.length > 0 && (
        <div className="todo-links">
          {links.map((link, idx) => (
            <a
              key={`${keyPrefix}-link-${todo.id}-${idx}`}
              className="todo-link"
              href={toLinkHref(link.url)}
              target="_blank"
              rel="noopener noreferrer"
              title={link.url}
            >
              {link.name || formatLinkLabel(link.url)}
            </a>
          ))}
        </div>
      )}
    </details>
  );
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
  onPushNewestWeek,
  onReviewDoneTask,
  onRejectDoneTask,
  onDelete,
  onOvertimeSave,
  getProjectRemaining,
  allowReview = true,
  readOnly = false,
}) {
  const focusedTaskId = useFocusTask();
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
  const canPushNewestWeek = canPushTaskToNewestWeek(todo.data);
  const canTakeDoneDecision =
    !readOnly && allowReview && Boolean(completed) && !Boolean(todo.data.reviewed);

  async function handleCheck(checked) {
    const updated = await onToggle(todo, checked);
    if (checked && !hasTaskLink(todo.data)) onEditStart(todo);
    setShowOT(checked && updated === true);
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
            aria-label={`Mark ${title || "task"} ${completed ? "incomplete" : "complete"}`}
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
              icon={<TaskClockIcon />}
              aria-label="Planned time"
              required
              value={draft.timeUnits}
              onChange={(e) => onEditFieldChange("timeUnits", e.target.value)}
            >
              <option value="">Planned time</option>
              {UNIT_OPTIONS.map((units) => (
                <option key={units} value={units}>
                  {formatUnitOption(units)}
                </option>
              ))}
            </SelectField>
            <SelectField
              className="meta-select"
              icon={<IconFolder />}
              aria-label="Project"
              required
              value={draft.projectId}
              onChange={(e) => onEditFieldChange("projectId", e.target.value)}
            >
              <option value="">Project</option>
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
              disabled={!draft.title.trim() || !draft.timeUnits || !draft.projectId}
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
      <li className={`todo-item${focusedTaskId === todo.id ? " todo-item--focused" : ""}`}>
        <div className="todo-checkbox-cell">
          <input
            type="checkbox"
            checked={Boolean(completed)}
            disabled={readOnly}
            aria-label={`Mark ${title || "task"} ${completed ? "incomplete" : "complete"}`}
            onChange={(e) => handleCheck(e.target.checked)}
          />
        </div>
        <div
          className="todo-content"
          onClick={() => !readOnly && !completed && onEditStart(todo)}
        >
          <button
            type="button"
            disabled={readOnly || Boolean(completed)}
            className={completed ? "todo-text todo-text--done" : "todo-text"}
          >
            <span className="task-title-ink">{title || "Untitled"}</span>
          </button>
          {(timeUnits || overtimeUnits || todo.data.trackedSeconds || projectId || deadline) && (
            <div className="todo-chips">
              {todo.data.trackedSeconds > 0 ? <Pill className="chip--logged">{durationLabel(todo.data.trackedSeconds)} logged</Pill> : null}
              {timeUnits && (
                <Pill className="chip--time">
                  {formatTimeUnits(timeUnits)} planned
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
                          disabled={readOnly}
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
        <div
          className={
            canTakeDoneDecision
              ? "todo-actions todo-actions--decision"
              : "todo-actions"
          }
        >
          {canTakeDoneDecision ? (
            <>
              <button
                type="button"
                className="todo-decision-btn todo-decision-icon"
                aria-label="Review" title="Review task"
                onClick={() => onReviewDoneTask(todo)}
              >
                <span className="task-review-symbol"><img src="/illustrations/review-circle.svg" alt="" /></span>
              </button>
              <button
                type="button"
                className="todo-decision-btn todo-decision-btn--danger todo-decision-icon"
                aria-label="Reject" title="Reject task"
                onClick={() => onRejectDoneTask(todo)}
              >
                <CrossIcon />
              </button>
            </>
          ) : null}
          {!readOnly && !canTakeDoneDecision && canPushNewestWeek ? (
            <IconButton
              type="button"
              title="Push to newest week"
              onClick={() => onPushNewestWeek(todo)}
            >
              <span>{">>"}</span>
            </IconButton>
          ) : null}
          {!readOnly && !completed ? (
            <IconButton
              type="button"
              variant="delete"
              onClick={() => onDelete(todo)}
              title="Delete"
            >
              {DELETE_ICON}
            </IconButton>
          ) : null}
        </div>
      {showOT && (
        <div className="todo-ot-row">
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
        </div>
      )}
      </li>
  );
}

// ─── ProjectGroupCard ─────────────────────────────────────────────────────────────────────────

function ProjectGroupCard({
  project,
  projects,
  tasks,
  members,
  selectedWeek,
  isEditableWeek,
  onCreate,
  onToggle,
  onPushNewestWeek,
  onDelete,
  onToggleSubtask, onSaveEdit, onOvertimeSave, onProjectRemaining,
  highlightedProject,
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [addMemberId, setAddMemberId] = useState("");
  const [addDraft, setAddDraft] = useState(() => emptyTaskCreateDraft(project?.id || ""));
  function patchAddDraft(patch) { setAddDraft((previous) => ({ ...previous, ...patch })); }
  function cancelAdd() { setAddOpen(false); setAddMemberId(""); setAddDraft(emptyTaskCreateDraft(project?.id || "")); }


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
    const { addTitle, addTime, addProject, addDeadline, addSubtasks, addLinks } = addDraft;
    if (!addTitle.trim() || !addMemberId || !addTime || !addProject) return;
    const created = await onCreate(addMemberId, {
      title: addTitle.trim(), timeUnits: Number(addTime), projectId: addProject,
      deadline: addDeadline || null, subtasks: normalizeTaskSubtaskList(addSubtasks), links: normalizeTaskLinkList(addLinks),
    }, selectedWeek);
    if (created) cancelAdd();
  }

  return (
    <BoardSection
      title={project?.data?.name || "Unassigned"}
      badge={<span title={`${totalActive} active tasks`} aria-label={`${totalActive} active tasks`}>{totalActive}</span>}
      className={`task-project-card task-scope${highlightedProject ? highlightedProject === (project?.id || "unassigned") ? " task-project-card--highlighted" : " task-project-card--dimmed" : ""}`}
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
            <MemberCard
              member={members.find((member) => member.id === mid) || { id: mid, data: { name: memberNameById[mid] || mid } }}
              todos={memberTasks} projects={projects} selectedWeek={selectedWeek}
              showHeader={false} hideCreate allowReview={false} draftScope={`project-${project?.id || "unassigned"}`}
              onToggle={onToggle} onToggleSubtask={onToggleSubtask} onSaveEdit={onSaveEdit}
              onPushNewestWeek={onPushNewestWeek} onDelete={onDelete}
              onOvertimeSave={onOvertimeSave} onProjectRemaining={onProjectRemaining}
            />
          </div>
        ))}
      </div>
    </BoardSection>
  );
}

function ProjectResourcesCard({ project, resources, members }) {
  const memberNameById = useMemo(() => {
    const map = {};
    members.forEach((member) => {
      map[member.id] = member.data?.name || member.id;
    });
    return map;
  }, [members]);

  return (
    <BoardSection
      title={project.data?.name || "Untitled project"}
      badge={String(resources.length)}
      className="task-resource-card"
    >
      <Surface
        className="project-resources-paper"
      >
        <ul className="project-resource-list">
          {resources.map(({ link, task, weekKey }, index) => {
            return (
              <li
                key={`${task.id}-${link.url}-${index}`}
                className="project-resource-item"
              >
                <a
                  className="project-resource-link"
                  href={toLinkHref(link.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={link.url}
                >
                  {link.name || formatLinkLabel(link.url)}
                </a>
                <div className="project-resource-pills">
                  <Pill className="resource-pill--task"><span className="sr-only">Task: </span>{task.data.title || "Untitled task"}</Pill>
                  {memberNameById[task.data.memberId] ? <Pill className="resource-pill--worker"><span className="sr-only">Worker: </span>{memberNameById[task.data.memberId]}</Pill> : null}
                  {weekKey ? <Pill className="resource-pill--week"><span className="sr-only">Week: </span>{weekLabel(new Date(`${weekKey}T00:00:00`))}</Pill> : null}
                </div>
              </li>
            );
          })}
        </ul>
      </Surface>
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
  onPushNewestWeek,
  onReviewDoneTask,
  onRejectDoneTask,
  onDelete,
  onUndoReviewWeek,
  onOvertimeSave,
  onProjectRemaining,
  selectedWeek,
  showHeader = true,
  hideCreate = false,
  allowReview = true,
  draftScope = "",
}) {
  const draftIdentity = draftScope ? `${member.id}:${draftScope}` : member.id;
  const [ui, setUi] = useState(() => loadMemberDraft(draftIdentity));
  const addInputRef = useRef(null);

  const isEditableWeek = isEditableWeekKey(selectedWeek);
  const memberWeekTodos = useMemo(
    () => todos.filter((t) => taskWeekKey(t.data) === selectedWeek),
    [todos, selectedWeek],
  );
  const weekTodos = sortTodos(memberWeekTodos.filter((t) => !t.data.reviewed));
  const reviewedTodos = sortTodos(
    memberWeekTodos.filter((t) => Boolean(t.data.reviewed)),
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

  // Weeks older than the immediately previous week remain read-only snapshots.
  const snapshotTodos = !isEditableWeek ? sortTodos(memberWeekTodos) : [];

  const addRemainingHint = addProject
    ? onProjectRemaining?.(member.id, addProject, null)
    : null;
  const assignableProjects = useMemo(
    () => getAssignableProjects(projects, member.id),
    [projects, member.id],
  );

  const workedMinutes = workedWeeklyMinutes(memberWeekTodos);
  const allocatedMinutes = memberWeekTodos.reduce((sum, task) => sum + (Number(task.data.timeUnits) || 0) * 15, 0);
  const workedLabel = workedMinutes > 0 ? durationLabel(workedMinutes * 60) : "0m";
  const allocatedLabel = allocatedMinutes > 0 ? durationLabel(allocatedMinutes * 60) : "0m";

  useEffect(() => {
    writeLocalJSON(memberDraftKey(draftIdentity), ui);
  }, [draftIdentity, ui]);

  useEffect(() => {
    if (!editingId) return;
    const stillExists = weekTodos.some((todo) => todo.id === editingId);
    if (!stillExists) {
      setUi((prev) => ({
        ...prev,
        editingId: null,
        editDraft: emptyEditDraft(),
      }));
    }
  }, [editingId, weekTodos]);

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
    if (!addTitle.trim() || !addTime || !addProject) return;
    const created = await onCreate(
      member.id,
      {
        title: addTitle.trim(),
        timeUnits: addTime ? Number(addTime) : null,
        projectId: addProject || null,
        deadline: addDeadline || null,
        subtasks: normalizeTaskSubtaskList(addSubtasks),
        links: normalizeTaskLinkList(addLinks),
      },
      selectedWeek,
    );
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
      {showHeader ? <div className="member-card-header">
        <div className="member-card-head-main">
          <h4 className="card-name">{member.data.name || "Unnamed"}</h4>
          <span className="member-week-time" aria-label={`${workedLabel} worked / ${allocatedLabel} allocated`}>
            {workedLabel}
            <TaskClockIcon />
            <span>/ {allocatedLabel}</span>
          </span>
        </div>
      </div> : null}

      {isEditableWeek ? (
        <Surface>
          <ul className="todo-list">
            {weekTodos.length === 0 && reviewedTodos.length === 0 && (
              <li className="todo-empty">No tasks yet.</li>
            )}
            {[...weekTodos, ...reviewedTodos].map((todo) => (
              <TaskItem
                key={todo.id}
                allowReview={allowReview}
                readOnly={Boolean(todo.data.reviewed)}
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
                onPushNewestWeek={onPushNewestWeek}
                onReviewDoneTask={onReviewDoneTask}
                onRejectDoneTask={onRejectDoneTask}
                onDelete={onDelete}
                onOvertimeSave={onOvertimeSave}
                getProjectRemaining={onProjectRemaining}
              />
            ))}
          </ul>

          {!hideCreate && (!addActive ? (
            <TaskCreateTrigger onClick={activateAdd} />
          ) : (
            <TaskCreateForm draft={ui} onChange={patchUi} onSubmit={submitAdd} onCancel={cancelAdd} inputRef={addInputRef} projects={assignableProjects} remainingHint={addRemainingHint} unitOptions={UNIT_OPTIONS} formatUnitOption={formatUnitOption} />
          ))}

          {reviewedTodos.length > 0 && <Button type="button" size="small" variant="ghost" onClick={() => onUndoReviewWeek(member.id)}>Undo review this week</Button>}


        </Surface>
      ) : (
        <Surface>
          {snapshotTodos.length === 0 ? (
            <p className="todo-empty">No tasks in this week.</p>
          ) : (
            <ul className="todo-list snapshot-list">
              {snapshotTodos.map((todo) => {
                const projName = projects.find(
                  (p) => p.id === todo.data.projectId,
                )?.data?.name;
                const t = Number(todo.data.timeUnits) || 0;
                const ot = Number(todo.data.overtimeUnits) || 0;
                const done = Boolean(todo.data.completed);
                return (
                  <li key={todo.id} className="todo-item">
                    <div className="todo-checkbox-cell">
                      <input
                        type="checkbox"
                        checked={done}
                        readOnly
                        tabIndex={-1}
                      />
                    </div>
                    <div className="todo-content">
                      <span
                        className={
                          done ? "todo-text todo-text--done" : "todo-text"
                        }
                      >
                        <span className="task-title-ink">{todo.data.title || "Untitled"}</span>
                      </span>
                      <div className="todo-chips">
                        {todo.data.trackedSeconds > 0 ? <Pill className="chip--logged">{durationLabel(todo.data.trackedSeconds)} logged</Pill> : null}
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
                      <ReadOnlyTaskDetails
                        todo={todo}
                        keyPrefix="snapshot"
                      />
                    </div>
                    <div className="todo-actions">
                      {canPushTaskToNewestWeek(todo.data) ? (
                        <IconButton
                          type="button"
                          title="Push to newest week"
                          onClick={() => onPushNewestWeek(todo)}
                        >
                          <span>{">>"}</span>
                        </IconButton>
                      ) : null}

                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Surface>
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
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerDraft, setComposerDraft] = useState(emptyTaskCreateDraft);
  const [composerMember, setComposerMember] = useState(viewerMemberId || "");
  const [members, setMembers] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [selectedWeek, setSelectedWeek] = useUrlState("week", currentWeekKey, { validate: isDateKey });
  const [highlightedProject, setHighlightedProject] = useState(null);
  const [memberViewMode, setMemberViewMode] = useUrlState("taskView", "member", { allowed: ["member", "project", "resources"] });
  useEffect(() => { setHighlightedProject(null); }, [memberViewMode, selectedWeek]);
  const [decisionTarget, setDecisionTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // "member" | "project"
  const [actionConfirm, setActionConfirm] = useState(null);
  const createInFlightRef = useRef(false);
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
      setAllTasks(
        dedupeItemsById(
          cached.tasks.filter((i) => i?.data?.type === TODO_TYPE),
        ),
      );
    if (cached.projects.length) setProjects(cached.projects);
  }, [hasSharedData]);

  useEffect(() => {
    if (!hasSharedData) return;
    setMembers(sharedMembers);
    setProjects(sharedProjects);
    setAllTasks(
      dedupeItemsById(sharedTasks.filter((i) => i?.data?.type === TODO_TYPE)),
    );
  }, [hasSharedData, sharedMembers, sharedProjects, sharedTasks]);

  useEffect(() => {
    if (hasSharedData) return;
    if (!firebaseReady) return;
    const u1 = subscribeCollection("members", setMembers);
    const u2 = subscribeCollection("tasks", (items) =>
      setAllTasks(
        dedupeItemsById(items.filter((i) => i.data.type === TODO_TYPE)),
      ),
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
    if (!isLimitedViewer) return;
    if (memberViewMode !== "member") {
      updateUrlState({ taskView: "member" }, { replace: true });
    }
  }, [isLimitedViewer, memberViewMode]);

  const visibleMembers = useMemo(() => {
    const activeMembers = members.filter(isMemberActive).sort((a, b) =>
      Number(isWorkerOwner(b.data)) - Number(isWorkerOwner(a.data))
    );
    if (!isLimitedViewer) return activeMembers;
    if (!viewerMemberId) return [];
    return activeMembers.filter((member) => member.id === viewerMemberId);
  }, [isLimitedViewer, members, viewerMemberId]);

  const visibleMemberIds = useMemo(
    () => new Set(visibleMembers.map((member) => member.id)),
    [visibleMembers],
  );

  const visibleProjects = useMemo(() => {
    const activeProjects = projects.filter(
      (project) => !isProjectClosed(project),
    );
    if (!isLimitedViewer) return activeProjects;
    if (!viewerMemberId) return [];
    return activeProjects.filter((project) =>
      isMemberAssignedToProject(project, viewerMemberId),
    );
  }, [isLimitedViewer, projects, viewerMemberId]);

  const visibleTasks = useMemo(() => {
    const closedProjectIds = new Set(
      projects
        .filter(isProjectClosed)
        .map((project) => project.id),
    );
    const tasksForVisibleMembers = dedupeItemsById(allTasks).filter(
      (task) =>
        visibleMemberIds.has(task?.data?.memberId) &&
        !task?.data?.archived &&
        !closedProjectIds.has(task?.data?.projectId),
    );
    if (!isLimitedViewer) return tasksForVisibleMembers;
    if (!viewerMemberId) return [];
    return tasksForVisibleMembers.filter(
      (task) => task?.data?.memberId === viewerMemberId,
    );
  }, [allTasks, isLimitedViewer, projects, viewerMemberId, visibleMemberIds]);

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

  const resourcesByProject = useMemo(() => {
    const grouped = {};
    const visibleProjectIds = new Set(
      sortedProjectsForView.map((project) => project.id),
    );

    for (const task of visibleTasks) {
      const projectId = task.data.projectId;
      if (!projectId || !visibleProjectIds.has(projectId)) continue;

      const links = normalizeTaskLinkList(task.data.links);
      if (!links.length) continue;

      if (!grouped[projectId]) grouped[projectId] = [];
      links.forEach((link) => {
        grouped[projectId].push({
          link,
          task,
          weekKey: taskWeekKey(task.data),
        });
      });
    }

    Object.values(grouped).forEach((resources) => {
      resources.sort((left, right) => {
        const leftLabel =
          left.link.name || formatLinkLabel(left.link.url) || left.link.url;
        const rightLabel =
          right.link.name || formatLinkLabel(right.link.url) || right.link.url;
        return leftLabel.localeCompare(rightLabel);
      });
    });

    return grouped;
  }, [sortedProjectsForView, visibleTasks]);

  const projectsWithResources = useMemo(
    () =>
      sortedProjectsForView.filter(
        (project) => (resourcesByProject[project.id] || []).length > 0,
      ),
    [resourcesByProject, sortedProjectsForView],
  );

  const resourceCount = useMemo(
    () =>
      Object.values(resourcesByProject).reduce(
        (sum, resources) => sum + resources.length,
        0,
      ),
    [resourcesByProject],
  );

  // Always offer the two editable weeks, plus older weeks that have tasks.
  const availableWeeks = useMemo(() => {
    const weeks = new Set([currentWeekKey(), previousWeekKey(), selectedWeek]);
    for (const t of visibleTasks) {
      weeks.add(taskWeekKey(t.data));
    }
    return [...weeks].sort().reverse(); // newest first
  }, [visibleTasks, selectedWeek]);

  const movableUnfinishedCount = useMemo(() => {
    const targetWeek = currentWeekKey();
    return visibleTasks.filter((task) =>
      isUnfinishedTaskOutsideWeek(task.data, targetWeek),
    ).length;
  }, [visibleTasks]);

  function addToast(msg, isError = false) {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message: msg, isError }]);
    window.setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      2500,
    );
  }

  async function handleCreate(
    memberId,
    taskData,
    targetWeek = currentWeekKey(),
  ) {
    if (createInFlightRef.current) return false;
    if (
      !canViewerManageMemberTask({ isLimitedViewer, viewerMemberId, memberId })
    ) {
      addToast("You can only add tasks to your own board", true);
      return false;
    }
    const now = Date.now();
    if (!isEditableWeekKey(targetWeek, now)) {
      addToast("Only this week and last week can be edited", true);
      return false;
    }
    const nextProjectId = taskData.projectId || null;
    if (!nextProjectId || !Number.isFinite(Number(taskData.timeUnits)) || Number(taskData.timeUnits) <= 0) {
      addToast("Choose a planned time and project", true);
      return false;
    }
    if (
      nextProjectId &&
      !isProjectIdAssignable(visibleProjects, memberId, nextProjectId)
    ) {
      addToast("Project is not assigned to this member", true);
      return false;
    }

    try {
      createInFlightRef.current = true;
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
        reviewed: false,
        completionState: "open",
        archived: false,
        taskWeek: targetWeek,
        orderIndex: now,
        createdAt: now,
        updatedAt: now,
      };
      const id = await createDocument("tasks", created);
      setAllTasks((prev) => dedupeItemsById([{ id, data: created }, ...prev]));
      addToast("Task added");
      return true;
    } catch (e) {
      addToast(e.message || "Could not add task", true);
      return false;
    } finally {
      createInFlightRef.current = false;
    }
  }

  async function handleToggle(task, checked) {
    if (checked && !hasTaskLink(task.data)) {
      addToast("Add at least one link before completing this task", true);
      return false;
    }
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
      return true;
    } catch (e) {
      addToast(e.message || "Could not update", true);
      return false;
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
    if (task.data.completed && !hasTaskLink(draft)) {
      addToast("Completed tasks must keep at least one link", true);
      return false;
    }
    if (!draft.projectId || !Number.isFinite(Number(draft.timeUnits)) || Number(draft.timeUnits) <= 0) {
      addToast("Choose a planned time and project", true);
      return false;
    }
    const memberId = task.data.memberId;
    if (
      !canViewerManageMemberTask({
        isLimitedViewer,
        viewerMemberId,
        memberId,
      })
    ) {
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
    if (task?.data?.completed) {
      addToast("Completed tasks cannot be deleted", true);
      return;
    }
    setDeleteTarget({
      label: task.data?.title || "this task",
      onConfirm: async (reason) => {
        try {
          await deleteDocument("tasks", task.id, reason);
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

  async function handlePushTaskToNewestWeek(task) {
    const memberId = task?.data?.memberId;
    if (
      !canViewerManageMemberTask({
        isLimitedViewer,
        viewerMemberId,
        memberId,
      })
    ) {
      addToast("You can only move your own tasks", true);
      return;
    }
    const thisWeek = currentWeekKey();
    if (taskWeekKey(task.data) === thisWeek) return;
    if (!canPushTaskToNewestWeek(task?.data, thisWeek)) {
      addToast("Completed tasks cannot be moved to another week", true);
      return;
    }

    try {
      const now = Date.now();
      const nextData = {
        ...task.data,
        taskWeek: thisWeek,
        updatedAt: now,
      };
      await replaceDocument("tasks", task.id, nextData);
      setAllTasks((prev) =>
        prev.map((item) =>
          item.id === task.id ? { ...item, data: nextData } : item,
        ),
      );
      setSelectedWeek(thisWeek);
      addToast("Moved to newest week");
    } catch (e) {
      addToast(e.message || "Could not move task to newest week", true);
    }
  }

  function requestPushTaskToNewestWeek(task) {
    const title = String(task?.data?.title || "Untitled");
    setActionConfirm({
      title: "Confirm move to newest week",
      message: `Move \"${title}\" to the newest week?`,
      confirmLabel: "Move to newest week",
      onConfirm: async () => {
        await handlePushTaskToNewestWeek(task);
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

  async function handleReviewDoneTask(task, reason) {
    const memberId = task?.data?.memberId;
    if (
      !canViewerManageMemberTask({
        isLimitedViewer,
        viewerMemberId,
        memberId,
      })
    ) {
      addToast("You can only review your own tasks", true);
      return;
    }
    if (!task?.data?.completed) {
      addToast("Only done tasks can be reviewed", true);
      return;
    }

    if (!reason) { setDecisionTarget({ task, action: "approve" }); return; }
    const decision = actionRecord("approve", reason, viewerMemberId);
    try {
      const now = Date.now();
      const nextData = {
        ...task.data,
        reviewReason: decision.reason,
        decisionHistory: [...(Array.isArray(task.data.decisionHistory) ? task.data.decisionHistory : []), decision],
        reviewed: true,
        reviewedAt: now,
        completionState: "completed",
        updatedAt: now,
      };
      await replaceDocument("tasks", task.id, nextData);
      setAllTasks((prev) =>
        prev.map((item) =>
          item.id === task.id ? { ...item, data: nextData } : item,
        ),
      );
      setDecisionTarget(null);
      addToast("Task moved to reviewed");
    } catch (e) {
      addToast(e.message || "Could not review task", true);
    }
  }

  async function handleRejectDoneTask(task, reason) {
    const memberId = task?.data?.memberId;
    if (
      !canViewerManageMemberTask({
        isLimitedViewer,
        viewerMemberId,
        memberId,
      })
    ) {
      addToast("You can only reject your own tasks", true);
      return;
    }
    if (!task?.data?.completed) return;

    if (!reason) { setDecisionTarget({ task, action: "reject" }); return; }
    const decision = actionRecord("reject", reason, viewerMemberId);
    try {
      const now = Date.now();
      const nextData = {
        ...task.data,
        rejectionReason: decision.reason,
        decisionHistory: [...(Array.isArray(task.data.decisionHistory) ? task.data.decisionHistory : []), decision],
        completed: false,
        reviewed: false,
        reviewedAt: null,
        completionState: "open",
        updatedAt: now,
      };
      await replaceDocument("tasks", task.id, nextData);
      setAllTasks((prev) =>
        prev.map((item) =>
          item.id === task.id ? { ...item, data: nextData } : item,
        ),
      );
      setDecisionTarget(null);
      addToast("Task rejected and moved back to active");
    } catch (e) {
      addToast(e.message || "Could not reject task", true);
    }
  }

  async function handleUndoReviewWeek(memberId) {
    if (
      !canViewerManageMemberTask({
        isLimitedViewer,
        viewerMemberId,
        memberId,
      })
    ) {
      addToast("You can only undo review for your own tasks", true);
      return;
    }

    const tasks = visibleTasks.filter(
      (t) =>
        taskWeekKey(t.data) === selectedWeek &&
        t.data.memberId === memberId &&
        Boolean(t.data.reviewed),
    );

    if (!tasks.length) {
      addToast("No reviewed tasks to revert this week", true);
      return;
    }

    const now = Date.now();
    try {
      await Promise.all(
        tasks.map((t) =>
          replaceDocument("tasks", t.id, {
            ...t.data,
            reviewed: false,
            reviewedAt: null,
            completionState: t.data.completed ? "completed" : "open",
            updatedAt: now,
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
              reviewed: false,
              reviewedAt: null,
              completionState: item.data.completed ? "completed" : "open",
              updatedAt: now,
            },
          };
        }),
      );

      addToast("Reverted reviewed tasks for this week");
    } catch (e) {
      addToast(e.message || "Could not undo review", true);
    }
  }

  function requestUndoReviewWeek(memberId) {
    const memberName =
      visibleMembers.find((member) => member.id === memberId)?.data?.name ||
      "this member";
    setActionConfirm({
      title: "Confirm undo review",
      message: `Move reviewed tasks for ${memberName} in this week back to active?`,
      confirmLabel: "Undo review",
      onConfirm: async () => {
        await handleUndoReviewWeek(memberId);
      },
    });
  }

  async function handleMoveUnfinishedToCurrentWeek() {
    const thisWeek = currentWeekKey();
    const tasks = visibleTasks.filter((task) =>
      isUnfinishedTaskOutsideWeek(task.data, thisWeek),
    );
    if (!tasks.length) return;

    try {
      const now = Date.now();
      await Promise.all(
        tasks.map((task) =>
          replaceDocument("tasks", task.id, {
            ...task.data,
            taskWeek: thisWeek,
            updatedAt: now,
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
              taskWeek: thisWeek,
              updatedAt: now,
            },
          };
        }),
      );
      setSelectedWeek(thisWeek);
      addToast(
        `Moved ${tasks.length} unfinished task${tasks.length === 1 ? "" : "s"} to current week`,
      );
    } catch (e) {
      addToast(e.message || "Could not move unfinished tasks", true);
    }
  }

  function requestMoveAllUnfinishedToCurrentWeek() {
    if (movableUnfinishedCount === 0) return;
    setActionConfirm({
      title: "Confirm move all unfinished",
      message: `Move all unfinished tasks (${movableUnfinishedCount}) to the newest week?`,
      confirmLabel: "Move all unfinished",
      onConfirm: async () => {
        await handleMoveUnfinishedToCurrentWeek();
      },
    });
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
      .filter((t) => taskWeekKey(t.data) === selectedWeek)
      .filter((t) => t.data.memberId === memberId)
      .filter((t) => t.data.projectId === projectId)
      .reduce((sum, t) => sum + (Number(t.data.timeUnits) || 0) * 0.25, 0);

    const remaining = Math.max(0, capacityHours - assignedHours);
    return `Project remaining: ${formatHourAmount(remaining)} of ${formatHourAmount(capacityHours)}`;
  }

  const taskScopes = useMemo(() => {
    const { personal, team } = splitTaskBoardByViewer(visibleMembers, visibleTasks, viewerMemberId);
    return [
      { key: "personal", title: "Yours", description: "Assigned to you", ...personal },
      ...(!isLimitedViewer ? [{ key: "team", title: "Teams", description: "Everyone else on the team", ...team }] : []),
    ];
  }, [visibleMembers, visibleTasks, viewerMemberId, isLimitedViewer]);

  function renderMemberCard(member) {
    return (
      <MemberCard
        key={member.id}
        member={member}
        todos={tasksByMember[member.id] || []}
        projects={visibleProjects}
        onCreate={handleCreate}
        onToggle={handleToggle}
        onToggleSubtask={handleToggleSubtask}
        onSaveEdit={handleSaveEdit}
        onPushNewestWeek={requestPushTaskToNewestWeek}
        onReviewDoneTask={handleReviewDoneTask}
        onRejectDoneTask={handleRejectDoneTask}
        onDelete={handleDelete}
        onUndoReviewWeek={requestUndoReviewWeek}
        onOvertimeSave={handleOvertimeSave}
        onProjectRemaining={projectRemainingHint}
        selectedWeek={selectedWeek}
        showHeader
        hideCreate
      />
    );
  }

  function renderProjectScope(scope) {
    const weekTasks = scope.tasks.filter((task) => taskWeekKey(task.data) === selectedWeek && !task.data.reviewed);
    const allocatedUnits = new Map();
    scope.tasks.filter((task) => taskWeekKey(task.data) === selectedWeek).forEach((task) => {
      const id = task.data.projectId || "unassigned";
      allocatedUnits.set(id, (allocatedUnits.get(id) || 0) + (Number(task.data.timeUnits) || 0));
    });
    const projectCards = sortedProjectsForView.filter((project) =>
      scope.members.some((member) => isMemberAssignedToProject(project, member.id)) ||
      weekTasks.some((task) => task.data.projectId === project.id),
    ).sort((a, b) => (allocatedUnits.get(b.id) || 0) - (allocatedUnits.get(a.id) || 0));
    const unassigned = weekTasks.filter((task) => !task.data.projectId);
    function card(project, tasks) {
      return (
        <ProjectGroupCard
          key={project?.id || "unassigned"}
          highlightedProject={highlightedProject}
          project={project}
          projects={visibleProjects}
          tasks={tasks}
          members={scope.members}
          selectedWeek={selectedWeek}
          isEditableWeek={isEditableWeekKey(selectedWeek)}
          onCreate={handleCreate}
          onToggle={handleToggle}
          onToggleSubtask={handleToggleSubtask}
          onSaveEdit={handleSaveEdit}
          onOvertimeSave={handleOvertimeSave}
          onProjectRemaining={projectRemainingHint}
          onPushNewestWeek={requestPushTaskToNewestWeek}
          onDelete={handleDelete}
        />
      );
    }
    const orderedProjects = [...projectCards, ...(unassigned.length ? [null] : [])].sort((a, b) =>
      (allocatedUnits.get(b?.id || "unassigned") || 0) - (allocatedUnits.get(a?.id || "unassigned") || 0)
    );
    const allocations = orderedProjects.map((project) => ({
      id: project?.id || "unassigned", name: project?.data?.name || "Unassigned",
      units: allocatedUnits.get(project?.id || "unassigned") || 0,
    }));
    if (!projectCards.length && !unassigned.length) return <EmptyState>No projects or tasks for this section.</EmptyState>;
    return (
      <>
      <ProjectAllocationClock allocations={allocations} formatTime={formatTimeUnits} highlightedProject={highlightedProject} onHighlight={setHighlightedProject} />
      <CollectionLayout variant="board" className="backlog-grid">
        {orderedProjects.map((project) => card(project, project ? weekTasks.filter((task) => task.data.projectId === project.id) : unassigned))}
      </CollectionLayout>
      </>
    );
  }

  const memberViewOptions = [
    {
      value: "member",
      title: "Group tasks by person",
      label: "People",
    },
    ...(isLimitedViewer
      ? []
      : [
          {
            value: "project",
            title: "Group tasks by project",
            label: "Projects",
          },
          {
            value: "resources",
            title: "Task links across all weeks",
            label: "Links",
          },
        ]),
  ];

  const isResourceView = memberViewMode === "resources";
  const pageTitle = "TASK";

  return (
    <TabPage
      className="members-page"
      title={pageTitle}
      header={null}
    >
      <WorkspacePageHero title="Task" illustration="task-maker" className="task-page-hero">
        <div className="task-board-tools" aria-label="Task board controls">
        <div className="task-week-toolbar">
          <label className="task-week-control"><span>Weeks</span><SelectField className="week-select" aria-label="Task week" value={selectedWeek} onChange={(event) => setSelectedWeek(event.target.value)}>{availableWeeks.map((week) => <option key={week} value={week}>{weekLabel(new Date(week + "T00:00:00"))}</option>)}</SelectField></label>
          <TaskWeekInfo week={selectedWeek} members={visibleMembers} />
        </div>
        <div className="task-board-view-controls">
          {memberViewOptions.length > 1 ? <label className="task-view-picker"><span>by</span><select className="task-view-selector" style={{ width: memberViewMode === "project" ? "4.4em" : memberViewMode === "resources" ? "3em" : "3.9em" }} aria-label="Task view" value={memberViewMode} onChange={(event) => setMemberViewMode(event.target.value)}>{memberViewOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label> : null}
        </div>
        </div>
      </WorkspacePageHero>
      {memberViewMode === "member" && <TaskTimers tasks={visibleTasks.filter(task => task.data?.memberId === viewerMemberId && !task.data?.archived && !task.data?.completed)} />}
      <WorkspaceCreateDock label="New task" expanded={composerOpen} onClick={() => setComposerOpen(true)} />
      {composerOpen && <BottomComposer title="New task" onClose={() => setComposerOpen(false)}>
        <TaskCreateForm draft={composerDraft} onChange={patch => setComposerDraft(previous => ({...previous,...patch}))} onCancel={() => setComposerOpen(false)} projects={getAssignableProjects(visibleProjects, composerMember)} unitOptions={UNIT_OPTIONS} formatUnitOption={formatUnitOption} members={visibleMembers} assigneeId={composerMember} onAssigneeChange={id => { setComposerMember(id); setComposerDraft(previous => ({...previous,addProject:""})); }} onSubmit={async () => {
          const draft = composerDraft;
          if (!draft.addTitle.trim() || !draft.addTime || !draft.addProject || !composerMember) return;
          const created = await handleCreate(composerMember, {title:draft.addTitle.trim(),timeUnits:Number(draft.addTime),projectId:draft.addProject,deadline:draft.addDeadline||null,subtasks:draft.addSubtasks,links:draft.addLinks},selectedWeek);
          if(created) { setComposerOpen(false); setComposerDraft(emptyTaskCreateDraft()); }
        }} />
      </BottomComposer>}
      <div className="task-workspace">
        <div className="task-board-main">
      {visibleMembers.length === 0 && (
        <EmptyState>No members found in Firestore.</EmptyState>
      )}

      {memberViewMode === "resources" ? (
        projectsWithResources.length > 0 ? (
          <CollectionLayout variant="board" className="backlog-grid">
            {projectsWithResources.map((project) => (
              <ProjectResourcesCard
                key={project.id}
                project={project}
                resources={resourcesByProject[project.id] || []}
                members={visibleMembers}
              />
            ))}
          </CollectionLayout>
        ) : (
          <EmptyState>No project resources found.</EmptyState>
        )
      ) : memberViewMode === "project" ? (
        renderProjectScope({ members: visibleMembers, tasks: visibleTasks })
      ) : (
        <div className="task-scopes">
          {taskScopes.map((scope) => {
            const taskCount = scope.tasks.filter((task) => taskWeekKey(task.data) === selectedWeek).length;
            return (
              <section key={scope.key} className={`task-scope task-scope--${scope.key}`} aria-labelledby={`task-scope-${scope.key}`}>
                <div className="task-scope-head">
                  <div>
                    <h3 id={`task-scope-${scope.key}`}>{scope.title}</h3>
                  </div>
                  <span className="task-scope-count" aria-label={`${taskCount} tasks`}>{taskCount}</span>
                  {scope.key === "personal" && movableUnfinishedCount > 0 ? <Button className="task-move-unfinished" type="button" size="small" variant="ghost" onClick={requestMoveAllUnfinishedToCurrentWeek}>Move unfinished ({movableUnfinishedCount})</Button> : null}
                </div>
                {scope.members.length ? (
                  <CollectionLayout variant="grid" className="members-grid">
                    {scope.members.flatMap((member, index) => [
                      renderMemberCard(member),
                      scope.key === "team" && index < scope.members.length - 1 ? <hr
                        key={`divider-${member.id}`}
                        className={`member-row-divider${(index + 1) % 3 === 0 ? " member-row-divider--three" : ""}${(index + 1) % 2 === 0 ? " member-row-divider--two" : ""}`}
                      /> : null,
                    ])}
                  </CollectionLayout>
                ) : (
                  <EmptyState>{scope.key === "personal" ? "Your member profile is not available." : "No other team members to show."}</EmptyState>
                )}
              </section>
            );
          })}
        </div>
      )}

        </div>
      </div>
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

      {decisionTarget && <ReasonDialog illustration={decisionTarget.action} title={decisionTarget.action === 'approve' ? 'Approve task' : 'Reject task'} message={decisionTarget.task.data?.title || 'Untitled task'} confirmLabel={decisionTarget.action === 'approve' ? 'Approve' : 'Reject'} onCancel={() => setDecisionTarget(null)} onConfirm={reason => decisionTarget.action === 'approve' ? handleReviewDoneTask(decisionTarget.task, reason) : handleRejectDoneTask(decisionTarget.task, reason)} />}

      {deleteTarget && (
        <DeleteConfirmDialog
          label={deleteTarget.label}
          onConfirm={deleteTarget.onConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {actionConfirm && (
        <ModalShell
          title={actionConfirm.title}
          onClose={() => setActionConfirm(null)}
          size="sm"
          footer={
            <>
              <Button
                type="button"
                variant="ghost"
                size="small"
                onClick={() => setActionConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="small"
                onClick={async () => {
                  try {
                    await actionConfirm.onConfirm?.();
                  } finally {
                    setActionConfirm(null);
                  }
                }}
              >
                {actionConfirm.confirmLabel || "Confirm"}
              </Button>
            </>
          }
        >
          <p className="delete-confirm-body">{actionConfirm.message}</p>
        </ModalShell>
      )}
    </TabPage>
  );
}
