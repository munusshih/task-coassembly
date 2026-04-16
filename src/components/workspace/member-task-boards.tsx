"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock3,
  DollarSign,
  Eye,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, inputClassName } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Member, Project, Task } from "@/lib/types";

interface TaskDraft {
  title: string;
  deadline: string;
  projectId: string;
  workstream: Task["workstream"];
  billable: boolean;
  estimateHours: number;
}

interface MemberTaskBoardsProps {
  members: Member[];
  projects: Project[];
  tasks: Task[];
  onCreateTask: (payload: Omit<Task, "id" | "createdAt">) => Promise<void>;
  onUpdateTask: (
    id: string,
    payload: Partial<Omit<Task, "id">>,
  ) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
}

const defaultDraft = (): TaskDraft => ({
  title: "",
  deadline: "",
  projectId: "",
  workstream: "client",
  billable: true,
  estimateHours: 1,
});

const NEW_TASK_DRAFTS_STORAGE_KEY = "coassembly:new-task-drafts";

function buildTaskDraft(task: Task): TaskDraft {
  return {
    title: task.title,
    deadline: task.deadline || "",
    projectId: task.projectId || "",
    workstream: task.workstream,
    billable: task.billable,
    estimateHours: task.estimateHours,
  };
}

function serializeTaskDraft(draft: TaskDraft): Partial<Omit<Task, "id">> {
  return {
    title: draft.title.trim(),
    deadline: draft.deadline || undefined,
    projectId: draft.projectId || undefined,
    workstream: draft.workstream,
    billable: draft.billable,
    estimateHours: Number(draft.estimateHours) || 0,
  };
}

const categoryLabel: Record<string, string> = {
  workerOwner: "Worker Owner",
  associate: "Associate",
  collaborator: "Collaborator",
  member: "Member",
};

const monthlyRoleLabel: Record<string, string> = {
  none: "",
  facilitator: "Facilitator",
  timeKeeper: "Time keeper",
  noteTaker: "Note taker",
};

function normalizeTaskDraft(draft?: Partial<TaskDraft>): TaskDraft {
  return {
    title: String(draft?.title || ""),
    deadline: String(draft?.deadline || ""),
    projectId: String(draft?.projectId || ""),
    workstream:
      draft?.workstream === "admin" || draft?.workstream === "internal"
        ? draft.workstream
        : "client",
    billable: typeof draft?.billable === "boolean" ? draft.billable : true,
    estimateHours: Number(draft?.estimateHours) || 1,
  };
}

function readStoredTaskDrafts(): Record<string, TaskDraft> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(NEW_TASK_DRAFTS_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as Record<string, Partial<TaskDraft>>;
    return Object.fromEntries(
      Object.entries(parsed).map(([memberId, draft]) => [
        memberId,
        normalizeTaskDraft(draft),
      ]),
    );
  } catch {
    return {};
  }
}

export function MemberTaskBoards({
  members,
  projects,
  tasks,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
}: MemberTaskBoardsProps) {
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [expandedTaskId, setExpandedTaskId] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [newTaskDrafts, setNewTaskDrafts] = useState<Record<string, TaskDraft>>(
    () => readStoredTaskDrafts(),
  );
  const [taskDrafts, setTaskDrafts] = useState<Record<string, TaskDraft>>({});

  const projectNameById = useMemo(
    () =>
      Object.fromEntries(projects.map((project) => [project.id, project.name])),
    [projects],
  );

  const resolvedSelectedMemberId = members.some(
    (member) => member.id === selectedMemberId,
  )
    ? selectedMemberId
    : members[0]?.id || "";

  const selectedMember =
    members.find((member) => member.id === resolvedSelectedMemberId) ||
    members[0];

  const memberTasks = useMemo(() => {
    if (!selectedMember) {
      return [];
    }
    return tasks
      .filter((task) => task.boardOwnerId === selectedMember.id)
      .sort((left, right) => {
        const statusOrder = { todo: 0, review: 1, done: 2 };
        const leftRank = statusOrder[left.status];
        const rightRank = statusOrder[right.status];
        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }
        return (left.deadline || "9999-99-99").localeCompare(
          right.deadline || "9999-99-99",
        );
      });
  }, [selectedMember, tasks]);

  const activeTasks = memberTasks.filter((task) => task.status !== "done");
  const completedTasks = memberTasks.filter((task) => task.status === "done");
  const activeHours = activeTasks.reduce(
    (sum, task) => sum + (Number(task.estimateHours) || 0),
    0,
  );
  const reviewTasks = activeTasks.filter((task) => task.status === "review");

  async function commitTask(taskId: string) {
    const task = tasks.find((candidate) => candidate.id === taskId);
    const draft =
      taskDrafts[taskId] || (task ? buildTaskDraft(task) : undefined);
    if (!draft) {
      return;
    }
    await onUpdateTask(taskId, serializeTaskDraft(draft));
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      NEW_TASK_DRAFTS_STORAGE_KEY,
      JSON.stringify(newTaskDrafts),
    );
  }, [newTaskDrafts]);

  useEffect(() => {
    const timeoutIds = Object.entries(taskDrafts).flatMap(([taskId, draft]) => {
      const task = tasks.find((candidate) => candidate.id === taskId);
      if (!task) {
        return [];
      }

      const savedDraft = buildTaskDraft(task);
      const snapshot = JSON.stringify(normalizeTaskDraft(draft));
      if (snapshot === JSON.stringify(savedDraft)) {
        return [];
      }

      const timeoutId = window.setTimeout(() => {
        void onUpdateTask(
          taskId,
          serializeTaskDraft(normalizeTaskDraft(draft)),
        );
      }, 500);

      return [timeoutId];
    });

    return () => {
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [onUpdateTask, taskDrafts, tasks]);

  if (!selectedMember) {
    return (
      <section className="panel board">
        <div>
          <h2 className="t-h3">Task board</h2>
          <p
            className="t-b2"
            style={{ color: "var(--c-ink-2)", marginTop: "var(--sp-1)" }}
          >
            Add members in Admin Control to start assigning work.
          </p>
        </div>
      </section>
    );
  }

  const draft = newTaskDrafts[selectedMember.id] || defaultDraft();

  return (
    <section className="panel board">
      <div className="board__header">
        <div>
          <h2 className="t-h3">Task board</h2>
        </div>
        <p className="board__hours">
          <strong>{activeHours.toFixed(1)}h</strong> active for{" "}
          {selectedMember.name}
        </p>
      </div>

      <div className="member-grid">
        {members.map((member) => {
          const memberActiveHours = tasks
            .filter(
              (task) =>
                task.boardOwnerId === member.id &&
                task.status !== "done" &&
                !task.archived,
            )
            .reduce((sum, task) => sum + (Number(task.estimateHours) || 0), 0);

          return (
            <button
              key={member.id}
              type="button"
              className="member-btn"
              data-selected={resolvedSelectedMemberId === member.id}
              onClick={() => {
                setSelectedMemberId(member.id);
                setExpandedTaskId("");
              }}
            >
              <span className="member-btn__name">{member.name}</span>
              <span className="member-btn__role">
                {categoryLabel[
                  member.category ||
                    (member.workerOwner ? "workerOwner" : "member")
                ] || "Member"}
                {member.monthlyRole && member.monthlyRole !== "none"
                  ? ` · ${monthlyRoleLabel[member.monthlyRole] || member.monthlyRole}`
                  : ""}
              </span>
              <span className="member-btn__hours">
                {memberActiveHours.toFixed(1)}h active
              </span>
            </button>
          );
        })}
      </div>

      <div className="board-metrics">
        <div className="metric metric--active">
          <p className="t-label">Active tasks</p>
          <p className="t-h3" style={{ marginTop: "var(--sp-2)" }}>
            {activeTasks.length}
          </p>
          <p
            className="t-b2"
            style={{ color: "var(--c-ink-2)", marginTop: "var(--sp-1)" }}
          >
            In progress for {selectedMember.name}
          </p>
        </div>
        <div className="metric metric--review">
          <p className="t-label">In review</p>
          <p className="t-h3" style={{ marginTop: "var(--sp-2)" }}>
            {reviewTasks.length}
          </p>
          <p
            className="t-b2"
            style={{ color: "var(--c-ink-2)", marginTop: "var(--sp-1)" }}
          >
            Tasks waiting on a pass or follow-up
          </p>
        </div>
        <div className="metric metric--done">
          <p className="t-label">Completed</p>
          <p className="t-h3" style={{ marginTop: "var(--sp-2)" }}>
            {completedTasks.length}
          </p>
          <p
            className="t-b2"
            style={{ color: "var(--c-ink-2)", marginTop: "var(--sp-1)" }}
          >
            Finished tasks kept below for reference
          </p>
        </div>
      </div>

      <div className="task-form panel--inset">
        <div className="task-form__fields">
          <div className="field">
            <Label htmlFor="new-task-title">Task title</Label>
            <Input
              id="new-task-title"
              value={draft.title}
              onChange={(event) =>
                setNewTaskDrafts((current) => ({
                  ...current,
                  [selectedMember.id]: {
                    ...current[selectedMember.id],
                    title: event.target.value,
                  },
                }))
              }
              placeholder={`Add a task for ${selectedMember.name}`}
            />
          </div>
          <div className="field">
            <Label htmlFor="new-task-deadline">Deadline</Label>
            <Input
              id="new-task-deadline"
              type="date"
              value={draft.deadline}
              onChange={(event) =>
                setNewTaskDrafts((current) => ({
                  ...current,
                  [selectedMember.id]: {
                    ...current[selectedMember.id],
                    deadline: event.target.value,
                  },
                }))
              }
            />
          </div>
          <div className="field">
            <Label htmlFor="new-task-project">Project</Label>
            <select
              id="new-task-project"
              className={inputClassName}
              value={draft.projectId}
              onChange={(event) =>
                setNewTaskDrafts((current) => ({
                  ...current,
                  [selectedMember.id]: {
                    ...current[selectedMember.id],
                    projectId: event.target.value,
                  },
                }))
              }
            >
              <option value="">No project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <Label htmlFor="new-task-billing">Billing</Label>
            <select
              id="new-task-billing"
              className={inputClassName}
              value={`${draft.workstream}:${draft.billable ? "1" : "0"}`}
              onChange={(event) => {
                const [workstream, billable] = event.target.value.split(":");
                setNewTaskDrafts((current) => ({
                  ...current,
                  [selectedMember.id]: {
                    ...current[selectedMember.id],
                    workstream: workstream as Task["workstream"],
                    billable: billable === "1",
                  },
                }));
              }}
            >
              <option value="client:1">Billable</option>
              <option value="client:0">Non-billable client</option>
              <option value="admin:0">Admin</option>
              <option value="internal:0">Internal</option>
            </select>
          </div>
          <div className="field">
            <Label htmlFor="new-task-hours">Hours</Label>
            <Input
              id="new-task-hours"
              type="number"
              min={0}
              step={0.5}
              value={draft.estimateHours}
              onChange={(event) =>
                setNewTaskDrafts((current) => ({
                  ...current,
                  [selectedMember.id]: {
                    ...current[selectedMember.id],
                    estimateHours: Number(event.target.value) || 0,
                  },
                }))
              }
              placeholder="Estimated"
            />
          </div>
        </div>

        <div className="task-form__submit">
          <Button
            type="button"
            onClick={() => {
              if (!draft.title.trim()) return;
              void onCreateTask({
                title: draft.title.trim(),
                deadline: draft.deadline || undefined,
                projectId: draft.projectId || undefined,
                boardOwnerId: selectedMember.id,
                workstream: draft.workstream,
                billable: draft.billable,
                status: "todo",
                estimateHours: Number(draft.estimateHours) || 0,
                archived: false,
              }).then(() => {
                setNewTaskDrafts((current) => ({
                  ...current,
                  [selectedMember.id]: defaultDraft(),
                }));
              });
            }}
          >
            <Plus className="icon-sm" />
            Add task
          </Button>
        </div>
      </div>

      <div className="task-list">
        {activeTasks.map((task) => {
          const rowDraft = taskDrafts[task.id] || buildTaskDraft(task);
          const detailsOpen = expandedTaskId === task.id;
          const isReview = task.status === "review";

          return (
            <div key={task.id} className="task-row">
              <div className="task-row__main">
                <Button
                  type="button"
                  variant="ghost"
                  className="btn--sq"
                  onClick={() => {
                    void onUpdateTask(task.id, {
                      status: "done",
                      archived: true,
                    });
                  }}
                >
                  <Circle className="icon-sm" />
                </Button>

                <input
                  value={rowDraft.title}
                  onChange={(event) =>
                    setTaskDrafts((current) => ({
                      ...current,
                      [task.id]: {
                        ...current[task.id],
                        title: event.target.value,
                      },
                    }))
                  }
                  onBlur={() => {
                    void commitTask(task.id);
                  }}
                  className="task-row__title"
                />

                {task.deadline ? (
                  <span className="task-row__meta">
                    <CalendarDays className="icon-xs" />
                    {task.deadline}
                  </span>
                ) : null}

                {task.estimateHours ? (
                  <span className="task-row__meta">
                    <Clock3 className="icon-xs" />
                    {task.estimateHours}h
                  </span>
                ) : null}

                <div className="task-row__actions">
                  <Button
                    type="button"
                    variant="ghost"
                    className={cn("btn--sq", isReview && "btn--review")}
                    onClick={() => {
                      void onUpdateTask(task.id, {
                        status: isReview ? "todo" : "review",
                        archived: false,
                      });
                    }}
                  >
                    <Eye className="icon-sm" />
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    className={cn(
                      "btn--sq",
                      rowDraft.billable && "btn--billable",
                    )}
                    onClick={() => {
                      const nextBillable = !rowDraft.billable;
                      setTaskDrafts((current) => ({
                        ...current,
                        [task.id]: {
                          ...current[task.id],
                          billable: nextBillable,
                        },
                      }));
                      void onUpdateTask(task.id, { billable: nextBillable });
                    }}
                  >
                    <DollarSign className="icon-sm" />
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    className="btn--sq"
                    onClick={() =>
                      setExpandedTaskId(detailsOpen ? "" : task.id)
                    }
                  >
                    {detailsOpen ? (
                      <ChevronDown className="icon-sm" />
                    ) : (
                      <ChevronRight className="icon-sm" />
                    )}
                  </Button>
                </div>
              </div>

              {detailsOpen ? (
                <div className="task-row__details">
                  <div className="field">
                    <Label>Deadline</Label>
                    <Input
                      type="date"
                      value={rowDraft.deadline}
                      onChange={(event) =>
                        setTaskDrafts((current) => ({
                          ...current,
                          [task.id]: {
                            ...current[task.id],
                            deadline: event.target.value,
                          },
                        }))
                      }
                      onBlur={() => {
                        void commitTask(task.id);
                      }}
                    />
                  </div>
                  <div className="field">
                    <Label>Project</Label>
                    <select
                      className={inputClassName}
                      value={rowDraft.projectId}
                      onChange={(event) => {
                        setTaskDrafts((current) => ({
                          ...current,
                          [task.id]: {
                            ...current[task.id],
                            projectId: event.target.value,
                          },
                        }));
                        void onUpdateTask(task.id, {
                          projectId: event.target.value || undefined,
                        });
                      }}
                    >
                      <option value="">No project</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <Label>Workstream</Label>
                    <select
                      className={inputClassName}
                      value={rowDraft.workstream}
                      onChange={(event) => {
                        const nextWorkstream = event.target
                          .value as Task["workstream"];
                        setTaskDrafts((current) => ({
                          ...current,
                          [task.id]: {
                            ...current[task.id],
                            workstream: nextWorkstream,
                          },
                        }));
                        void onUpdateTask(task.id, {
                          workstream: nextWorkstream,
                        });
                      }}
                    >
                      <option value="client">Client</option>
                      <option value="admin">Admin</option>
                      <option value="internal">Internal</option>
                    </select>
                  </div>
                  <div className="field">
                    <Label>Hours</Label>
                    <div
                      style={{
                        display: "flex",
                        gap: "var(--sp-2)",
                        alignItems: "center",
                      }}
                    >
                      <Input
                        type="number"
                        min={0}
                        step={0.5}
                        value={rowDraft.estimateHours}
                        onChange={(event) =>
                          setTaskDrafts((current) => ({
                            ...current,
                            [task.id]: {
                              ...current[task.id],
                              estimateHours: Number(event.target.value) || 0,
                            },
                          }))
                        }
                        onBlur={() => {
                          void commitTask(task.id);
                        }}
                        placeholder="Hours"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        className="btn--sq"
                        onClick={() => {
                          void onDeleteTask(task.id);
                        }}
                      >
                        <Trash2 className="icon-sm" />
                      </Button>
                    </div>
                  </div>
                  {rowDraft.projectId ? (
                    <p
                      className="t-caption"
                      style={{ color: "var(--c-ink-3)" }}
                    >
                      Linked project:{" "}
                      {projectNameById[rowDraft.projectId] || "Unknown project"}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {completedTasks.length ? (
        <div>
          <button
            type="button"
            className="completed-toggle"
            onClick={() => setShowCompleted((current) => !current)}
          >
            {showCompleted ? (
              <ChevronDown className="icon-sm" />
            ) : (
              <ChevronRight className="icon-sm" />
            )}
            Completed tasks ({completedTasks.length})
          </button>

          {showCompleted ? (
            <div className="task-list">
              {completedTasks.map((task) => (
                <div key={task.id} className="task-row" data-done="true">
                  <div className="task-row__main">
                    <Button
                      type="button"
                      variant="ghost"
                      className="btn--sq btn--billable"
                      onClick={() => {
                        void onUpdateTask(task.id, {
                          status: "todo",
                          archived: false,
                        });
                      }}
                    >
                      <CheckCircle2 className="icon-sm" />
                    </Button>
                    <span className="task-row__title">{task.title}</span>
                    <div className="task-row__actions">
                      <Button
                        type="button"
                        variant="ghost"
                        className="btn--sq"
                        onClick={() => {
                          void onDeleteTask(task.id);
                        }}
                      >
                        <Trash2 className="icon-sm" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
