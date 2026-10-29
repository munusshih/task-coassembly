"use client";

import FormField from "./ui/FormField";
import TimeButton from "./ui/TimeButton";
import TaskClockIcon from "./ui/TaskClockIcon";
import Button from "./Button";
import IconButton from "./IconButton";
import SelectField from "./ui/SelectField";
import { DELETE_ICON, IconFolder } from "./icons";

export function emptyTaskCreateDraft(projectId = "") {
  return { addTitle: "", addTime: "", addProject: projectId, addDeadline: "", addSubtasks: [], addLinks: [] };
}

export default function TaskCreateForm({ draft, onChange: patchUi, onSubmit: submitAdd, onCancel: cancelAdd, inputRef, projects: assignableProjects, remainingHint: addRemainingHint, unitOptions: UNIT_OPTIONS, formatUnitOption, members, assigneeId, onAssigneeChange }) {
  const { addTitle, addTime, addProject, addDeadline, addSubtasks, addLinks } = draft;
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

  return (
            <div className="notepad-add-active">
              <div className="notepad-add-main">
                <span className="notepad-add-plus">+</span>
                <FormField label="Task title"><input
                  ref={inputRef}
                  aria-label="Task title"
                  autoFocus
                  className="notepad-add-input"
                  value={addTitle}
                  placeholder="Task title…"
                  onChange={(e) => patchUi({ addTitle: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") cancelAdd();
                  }}
                /></FormField>
              </div>
              <div className="notepad-add-meta">
                <span />
                <div className="notepad-add-fields">
                  {members ? <FormField label="Assigned to"><SelectField chevron className="meta-select" aria-label="Task assignee" value={assigneeId} onChange={(event) => onAssigneeChange(event.target.value)} required>
                    <option value="">Member…</option>
                    {members.map((member) => <option key={member.id} value={member.id}>{member.data?.name || member.id}</option>)}
                  </SelectField></FormField> : null}
                  <FormField label="Planned time"><SelectField chevron
                    className="meta-select"
                    icon={<TaskClockIcon />}
                    aria-label="Planned time"
                    required
                    value={addTime}
                    onChange={(e) => patchUi({ addTime: e.target.value })}
                  >
                    <option value="">Planned time</option>
                    {UNIT_OPTIONS.map((units) => (
                      <option key={units} value={units}>
                        {formatUnitOption(units)}
                      </option>
                    ))}
                  </SelectField></FormField>
                  <FormField label="Project"><SelectField chevron
                    className="meta-select"
                    icon={<IconFolder />}
                    aria-label="Project"
                    required
                    value={addProject}
                    onChange={(e) => patchUi({ addProject: e.target.value })}
                  >
                    <option value="">Project</option>
                    {assignableProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.data.name || p.id}
                      </option>
                    ))}
                  </SelectField></FormField>
                  {addRemainingHint ? (
                    <span className="meta-helper-chip">{addRemainingHint}</span>
                  ) : null}
                  <FormField label="Date"><input
                    type="date"
                    className="meta-date"
                    aria-label="Task date"
                    value={addDeadline}
                    onChange={(e) => patchUi({ addDeadline: e.target.value })}
                  /></FormField>
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
                          <div key={`add-subtask-${idx}`} className="todo-edit-row">
                            <input
                              type="checkbox"
                              className="todo-edit-row-check"
                              checked={subtask.completed || false}
                              onChange={(e) =>
                                setAddSubtask(idx, "completed", e.target.checked)
                              }
                            />
                            <input
                              className="todo-edit-row-input"
                              value={subtask.text || ""}
                              placeholder="Subtask…"
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
                                value={link.name || ""}
                                placeholder="Label…"
                                onChange={(e) =>
                                  setAddLink(idx, "name", e.target.value)
                                }
                              />
                              <input
                                className="todo-edit-row-input todo-edit-row-input--url"
                                value={link.url || ""}
                                placeholder="URL…"
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
                <TimeButton onClick={submitAdd} disabled={!addTitle.trim() || !addTime || !addProject || (members && !assigneeId)}>Save</TimeButton>
                <TimeButton quiet onClick={cancelAdd}>Cancel</TimeButton>
              </div>
            </div>
  );
}
