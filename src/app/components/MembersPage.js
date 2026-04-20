"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import {
  subscribeCollection,
  createDocument,
  replaceDocument,
  deleteDocument,
} from "../../firestore";
import { firebaseReady } from "../../firebase";

// ─── Constants ───────────────────────────────────────────────────────────────────────────────

const TODO_TYPE = "memberTodo";

const TIME_OPTIONS = [
  { units: 1,  label: "15m" },  { units: 2,  label: "30m" },
  { units: 3,  label: "45m" },  { units: 4,  label: "1h" },
  { units: 6,  label: "1h 30m" }, { units: 8,  label: "2h" },
  { units: 12, label: "3h" },   { units: 16, label: "4h" },
  { units: 20, label: "5h" },   { units: 24, label: "6h" },
  { units: 32, label: "8h" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────────────────────

function formatTimeUnits(units) {
  if (!units) return null;
  const m = units * 15;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return h === 0 ? `${rem}m` : rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

function formatDeadline(dateStr) {
  if (!dateStr) return null;
  const [y, mo, d] = dateStr.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
  const fmt = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const yearSuffix = mondayDate.getFullYear() !== new Date().getFullYear()
    ? ` ${mondayDate.getFullYear()}` : "";
  return `${fmt(mondayDate)}–${fmt(friday)}${yearSuffix}`;
}

function currentWeekLabel() {
  const monday = getMondayOf(Date.now());
  return weekLabel(monday);
}

function currentWeekKey() {
  return weekKey(Date.now());
}

function getQuarter(date) {
  return Math.floor(date.getMonth() / 3) + 1;
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
  const diff = Math.round((selected.getTime() - current.getTime()) / (7 * 24 * 60 * 60 * 1000));
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
    const dd = Number(a.data.completed) - Number(b.data.completed);
    if (dd !== 0) return dd;
    return (
      (Number(b.data.updatedAt || b.data.createdAt) || 0) -
      (Number(a.data.updatedAt || a.data.createdAt) || 0)
    );
  });
}

// ─── TaskItem ─────────────────────────────────────────────────────────────────────────────────

function TaskItem({ todo, projects, editingId, editValue, onEditStart, onEditChange, onEditSave, onEditCancel, onToggle, onDelete, onFieldChange, onOvertimeSave }) {
  const isEditing = editingId === todo.id;
  const [showOT, setShowOT] = useState(false);
  const [otUnits, setOtUnits] = useState("");
  const { completed, timeUnits, projectId, deadline, title, overtimeUnits } = todo.data;
  const projectName = projects.find((p) => p.id === projectId)?.data?.name;

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
            value={editValue}
            autoFocus
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); onEditSave(todo, editValue); }
              if (e.key === "Escape") onEditCancel();
            }}
            onBlur={() => { if (editValue.trim()) onEditSave(todo, editValue); else onEditCancel(); }}
          />
          <div className="todo-edit-meta">
            <select
              className="meta-select"
              value={timeUnits ?? ""}
              onChange={(e) => onFieldChange(todo, "timeUnits", e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">time</option>
              {TIME_OPTIONS.map((o) => (
                <option key={o.units} value={o.units}>{o.label}</option>
              ))}
            </select>
            <select
              className="meta-select"
              value={projectId ?? ""}
              onChange={(e) => onFieldChange(todo, "projectId", e.target.value || null)}
            >
              <option value="">project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.data.name || p.id}</option>
              ))}
            </select>
            <input
              type="date"
              className="meta-date"
              value={deadline ?? ""}
              onChange={(e) => onFieldChange(todo, "deadline", e.target.value || null)}
            />
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
        <div className="todo-content" onClick={() => !completed && onEditStart(todo)}>
          <span className={completed ? "todo-text todo-text--done" : "todo-text"}>
            {title || "Untitled"}
          </span>
          {(timeUnits || overtimeUnits || projectId || deadline) && (
            <div className="todo-chips">
              {timeUnits && (
                <span className="chip">
                  {formatTimeUnits(timeUnits)}
                  {overtimeUnits ? <span className="chip-ot">+{formatTimeUnits(overtimeUnits)} OT</span> : null}
                </span>
              )}
              {!timeUnits && overtimeUnits && <span className="chip chip--ot">{formatTimeUnits(overtimeUnits)} OT</span>}
              {projectName && <span className="chip">{projectName}</span>}
              {deadline && <span className="chip">{formatDeadline(deadline)}</span>}
            </div>
          )}
        </div>
        <div className="todo-actions">
          <button type="button" className="icon-btn icon-btn--delete" onClick={() => onDelete(todo)} title="Delete">×</button>
        </div>
      </li>
      {showOT && (
        <li className="todo-ot-row">
          <span className="todo-ot-label">Extra time spent?</span>
          <select
            className="meta-select"
            value={otUnits}
            onChange={(e) => setOtUnits(e.target.value)}
            autoFocus
          >
            <option value="">none</option>
            {TIME_OPTIONS.map((o) => (
              <option key={o.units} value={o.units}>{o.label}</option>
            ))}
          </select>
          <button type="button" className="btn btn--primary btn--small" onClick={submitOT}>Save</button>
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setShowOT(false)}>Skip</button>
        </li>
      )}
    </>
  );
}

// ─── Archive section ──────────────────────────────────────────────────────────────────

function ArchiveSection({ archivedTodos, projects }) {
  const [open, setOpen] = useState(false);

  // Group by week key (descending), then by projectId within each week
  const weekGroups = useMemo(() => {
    const byWeek = {};
    for (const todo of archivedTodos) {
      const ts = Number(todo.data.archivedAt || todo.data.updatedAt || 0);
      const key = ts ? weekKey(ts) : "unknown";
      if (!byWeek[key]) byWeek[key] = { monday: ts ? getMondayOf(ts) : null, todos: [] };
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
          (s, t) => s + ((Number(t.data.timeUnits) || 0) + (Number(t.data.overtimeUnits) || 0)) * 15,
          0
        );
        return { key, monday, byProject, totalMin, count: todos.length };
      });
  }, [archivedTodos]);

  if (!archivedTodos.length) return null;

  return (
    <div className="archive-section">
      <button type="button" className="archive-toggle" onClick={() => setOpen((s) => !s)}>
        Archive ({archivedTodos.length}){open ? " ▲" : " ▼"}
      </button>
      {open && (
        <div className="archive-body">
          {weekGroups.map(({ key, monday, byProject, totalMin, count }) => (
            <div key={key} className="archive-week">
              <div className="archive-week-header">
                <span className="archive-week-label">
                  {monday ? weekLabel(monday) : "Unknown week"}
                </span>
                <span className="archive-week-total">
                  {count} task{count !== 1 ? "s" : ""} · {formatWeeklyTime(totalMin) || "0m"}
                </span>
              </div>
              {Object.entries(byProject).map(([pid, todos]) => {
                const projName = pid === "__none__"
                  ? null
                  : projects.find((p) => p.id === pid)?.data?.name || pid;
                const projMin = todos.reduce(
                  (s, t) => s + ((Number(t.data.timeUnits) || 0) + (Number(t.data.overtimeUnits) || 0)) * 15,
                  0
                );
                return (
                  <div key={pid} className="archive-project-group">
                    {projName && (
                      <div className="archive-project-header">
                        <span className="archive-project-name">{projName}</span>
                        <span className="archive-project-time">{formatWeeklyTime(projMin) || "0m"}</span>
                      </div>
                    )}
                    <ul className="archive-list">
                      {todos.map((todo) => {
                        const planned = Number(todo.data.timeUnits) || 0;
                        const ot = Number(todo.data.overtimeUnits) || 0;
                        return (
                          <li key={todo.id} className="archive-item">
                            <span className="archive-item-text">{todo.data.title || "Untitled"}</span>
                            <span className="archive-item-meta">
                              {planned ? formatTimeUnits(planned) : null}
                              {ot ? <span className="archive-ot">+{formatTimeUnits(ot)}</span> : null}
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

// ─── MemberCard ───────────────────────────────────────────────────────────────────────────────

function MemberCard({ member, todos, projects, onCreate, onToggle, onSaveEdit, onDelete, onFieldChange, onArchiveAll, onOvertimeSave, selectedWeek }) {
  const [addActive,   setAddActive]   = useState(false);
  const [addTitle,    setAddTitle]    = useState("");
  const [addTime,     setAddTime]     = useState("");
  const [addProject,  setAddProject]  = useState("");
  const [addDeadline, setAddDeadline] = useState("");
  const [editingId,   setEditingId]   = useState(null);
  const [editValue,   setEditValue]   = useState("");
  const addInputRef = useRef(null);

  const isCurrentWeek = !selectedWeek || selectedWeek === currentWeekKey();

  const activeTodos   = sortTodos(todos.filter((t) => !t.data.archived));
  const archivedTodos = todos
    .filter((t) => t.data.archived)
    .sort((a, b) => (Number(b.data.archivedAt) || 0) - (Number(a.data.archivedAt) || 0));

  // For past-week snapshot: only tasks archived in that week
  const snapshotTodos = !isCurrentWeek
    ? archivedTodos.filter((t) => {
        const ts = Number(t.data.archivedAt || t.data.updatedAt || 0);
        return ts && weekKey(ts) === selectedWeek;
      })
    : [];

  const snapshotMin = snapshotTodos.reduce(
    (s, t) => s + ((Number(t.data.timeUnits) || 0) + (Number(t.data.overtimeUnits) || 0)) * 15, 0
  );

  const weeklyLabel = formatWeeklyTime(totalWeeklyMinutes(todos));

  function activateAdd() {
    setAddActive(true);
    requestAnimationFrame(() => addInputRef.current?.focus());
  }

  function cancelAdd() {
    setAddActive(false);
    setAddTitle(""); setAddTime(""); setAddProject(""); setAddDeadline("");
  }

  function submitAdd() {
    if (!addTitle.trim()) return;
    void onCreate(member.id, {
      title: addTitle.trim(),
      timeUnits: addTime ? Number(addTime) : null,
      projectId: addProject || null,
      deadline:  addDeadline || null,
    });
    setAddTitle(""); setAddTime(""); setAddProject(""); setAddDeadline("");
    requestAnimationFrame(() => addInputRef.current?.focus());
  }

  function startEdit(todo) {
    setEditingId(todo.id);
    setEditValue(todo.data.title || "");
  }

  function cancelEdit() { setEditingId(null); setEditValue(""); }

  // Wrap onSaveEdit so edit mode exits after save
  async function doSaveEdit(todo, newTitle) {
    await onSaveEdit(todo, newTitle);
    cancelEdit();
  }

  return (
    <article className="member-card">
      <div className="member-card-header">
        <h3 className="card-name">{member.data.name || "Unnamed"}</h3>
        {isCurrentWeek
          ? <span className="member-week-time">{weeklyLabel || "no tasks"}</span>
          : <span className="member-week-time">{formatWeeklyTime(snapshotMin) || "—"}</span>
        }
      </div>

      {isCurrentWeek ? (
        <div className="lined-paper">
          <ul className="todo-list">
            {activeTodos.length === 0 && (
              <li className="todo-empty">No tasks yet.</li>
            )}
            {activeTodos.map((todo) => (
              <TaskItem
                key={todo.id}
                todo={todo}
                projects={projects}
                editingId={editingId}
                editValue={editValue}
                onEditStart={startEdit}
                onEditChange={setEditValue}
                onEditSave={doSaveEdit}
                onEditCancel={cancelEdit}
                onToggle={onToggle}
                onDelete={onDelete}
                onFieldChange={onFieldChange}
                onOvertimeSave={onOvertimeSave}
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
                <button
                  type="button"
                  className={"notepad-add-plus notepad-add-plus--submit" + (addTitle.trim() ? " notepad-add-plus--ready" : "")}
                  onClick={submitAdd}
                  disabled={!addTitle.trim()}
                  title="Add task"
                >+</button>
                <input
                  ref={addInputRef}
                  className="notepad-add-input"
                  value={addTitle}
                  placeholder="Task title…"
                  onChange={(e) => setAddTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); submitAdd(); }
                    if (e.key === "Escape") cancelAdd();
                  }}
                />
              </div>
              <div className="notepad-add-meta">
                <span />
                <div className="notepad-add-fields">
                  <select className="meta-select" value={addTime} onChange={(e) => setAddTime(e.target.value)}>
                    <option value="">time</option>
                    {TIME_OPTIONS.map((o) => (
                      <option key={o.units} value={o.units}>{o.label}</option>
                    ))}
                  </select>
                  <select className="meta-select" value={addProject} onChange={(e) => setAddProject(e.target.value)}>
                    <option value="">project</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.data.name || p.id}</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    className="meta-date"
                    value={addDeadline}
                    onChange={(e) => setAddDeadline(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Past-week snapshot */
        <div className="lined-paper">
          {snapshotTodos.length === 0 ? (
            <p className="todo-empty">No tasks completed this week.</p>
          ) : (
            <ul className="todo-list snapshot-list">
              {snapshotTodos.map((todo) => {
                const projName = projects.find((p) => p.id === todo.data.projectId)?.data?.name;
                const t = Number(todo.data.timeUnits) || 0;
                const ot = Number(todo.data.overtimeUnits) || 0;
                return (
                  <li key={todo.id} className="todo-item snapshot-item">
                    <div className="snapshot-check">\u2713</div>
                    <div className="todo-content">
                      <span className="todo-text todo-text--done">{todo.data.title || "Untitled"}</span>
                      <div className="todo-chips">
                        {t > 0 && <span className="chip">{formatTimeUnits(t)}{ot > 0 && <span className="chip-ot">+{formatTimeUnits(ot)} OT</span>}</span>}
                        {projName && <span className="chip">{projName}</span>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {isCurrentWeek && (
        <div className="member-card-footer">
          {activeTodos.length > 0 && (
            <button type="button" className="flush-btn" onClick={() => onArchiveAll(member.id)}>
              Flush completed
            </button>
          )}
          <ArchiveSection archivedTodos={archivedTodos} projects={projects} />
        </div>
      )}
    </article>
  );
}

// Placeholder so the old code block can be cleanly removed
// ─── MembersPage ────────────────────────────────────────────────────────────────────────────────

export default function MembersPage() {
  const [members,  setMembers]  = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [toasts,   setToasts]   = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(() => currentWeekKey());

  useEffect(() => {
    if (!firebaseReady) return;
    const u1 = subscribeCollection("members",  setMembers);
    const u2 = subscribeCollection("tasks",    (items) => setAllTasks(items.filter((i) => i.data.type === TODO_TYPE)));
    const u3 = subscribeCollection("projects", setProjects);
    return () => { u1(); u2(); u3(); };
  }, []);

  const tasksByMember = useMemo(() => {
    const g = {};
    for (const t of allTasks) {
      const mid = t.data.memberId;
      if (!mid) continue;
      if (!g[mid]) g[mid] = [];
      g[mid].push(t);
    }
    return g;
  }, [allTasks]);

  // Collect all weeks that have archived tasks, plus current week
  const availableWeeks = useMemo(() => {
    const weeks = new Set([currentWeekKey()]);
    for (const t of allTasks) {
      if (t.data.archived) {
        const ts = Number(t.data.archivedAt || t.data.updatedAt || 0);
        if (ts) weeks.add(weekKey(ts));
      }
    }
    return [...weeks].sort().reverse(); // newest first
  }, [allTasks]);

  function addToast(msg, isError = false) {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message: msg, isError }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2500);
  }

  async function handleCreate(memberId, taskData) {
    const now = Date.now();
    try {
      await createDocument("tasks", {
        type: TODO_TYPE, memberId,
        title:     taskData.title,
        timeUnits: taskData.timeUnits || null,
        projectId: taskData.projectId || null,
        deadline:  taskData.deadline  || null,
        completed: false, archived: false,
        createdAt: now, updatedAt: now,
      });
      addToast("Task added");
    } catch (e) { addToast(e.message || "Could not add task", true); }
  }

  async function handleToggle(task, checked) {
    try {
      await replaceDocument("tasks", task.id, { ...task.data, completed: checked, updatedAt: Date.now() });
    } catch (e) { addToast(e.message || "Could not update", true); }
  }

  async function handleSaveEdit(task, newTitle) {
    const t = (newTitle || "").trim();
    if (!t) return;
    try {
      await replaceDocument("tasks", task.id, { ...task.data, title: t, updatedAt: Date.now() });
    } catch (e) { addToast(e.message || "Could not save", true); }
  }

  async function handleDelete(task) {
    try { await deleteDocument("tasks", task.id); addToast("Deleted"); }
    catch (e) { addToast(e.message || "Could not delete", true); }
  }

  async function handleFieldChange(task, field, value) {
    try {
      await replaceDocument("tasks", task.id, { ...task.data, [field]: value, updatedAt: Date.now() });
    } catch (e) { addToast(e.message || "Could not update", true); }
  }

  async function handleOvertimeSave(task, otUnits) {
    try {
      await replaceDocument("tasks", task.id, {
        ...task.data,
        overtimeUnits: otUnits || null,
        updatedAt: Date.now(),
      });
    } catch (e) { addToast(e.message || "Could not save overtime", true); }
  }

  async function handleArchiveAll(memberId) {
    const tasks = (tasksByMember[memberId] || []).filter((t) => !t.data.archived);
    if (!tasks.length) return;
    const now = Date.now();
    try {
      await Promise.all(tasks.map((t) => replaceDocument("tasks", t.id, { ...t.data, archived: true, archivedAt: now })));
      addToast("Flushed to archive");
    } catch (e) { addToast(e.message || "Could not archive", true); }
  }

  return (
    <div className="members-page">
      <div className="members-week-bar">
        <div className="members-week-info">
          <span className="members-quarter">{quarterLabel(selectedWeek)}</span>
          <h2 className="members-week-title">{relativeWeekTitle(selectedWeek)}</h2>
          <span className="members-week-dates">{weekLabel(getMondayOf(new Date(selectedWeek + "T00:00:00")))}</span>
        </div>
        <select
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
        </select>
      </div>

      {members.length === 0 && <p className="empty-state">No members found in Firestore.</p>}

      <div className="members-grid">
        {members.map((member) => (
          <MemberCard
            key={member.id}
            member={member}
            todos={tasksByMember[member.id] || []}
            projects={projects}
            onCreate={handleCreate}
            onToggle={handleToggle}
            onSaveEdit={handleSaveEdit}
            onDelete={handleDelete}
            onFieldChange={handleFieldChange}
            onArchiveAll={handleArchiveAll}
            onOvertimeSave={handleOvertimeSave}
            selectedWeek={selectedWeek}
          />
        ))}
      </div>

      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={t.isError ? "toast toast--error" : "toast"}>{t.message}</div>
        ))}
      </div>
    </div>
  );
}
