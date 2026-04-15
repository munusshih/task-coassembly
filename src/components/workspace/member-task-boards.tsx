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
    {},
  );
  const [taskDrafts, setTaskDrafts] = useState<Record<string, TaskDraft>>({});

  useEffect(() => {
    if (!selectedMemberId && members[0]?.id) {
      setSelectedMemberId(members[0].id);
    }
  }, [members, selectedMemberId]);

  useEffect(() => {
    setNewTaskDrafts((current) => {
      const next = { ...current };
      for (const member of members) {
        next[member.id] = next[member.id] || defaultDraft();
      }
      return next;
    });
  }, [members]);

  useEffect(() => {
    const next: Record<string, TaskDraft> = {};
    for (const task of tasks) {
      next[task.id] = {
        title: task.title,
        deadline: task.deadline || "",
        projectId: task.projectId || "",
        workstream: task.workstream,
        billable: task.billable,
        estimateHours: task.estimateHours,
      };
    }
    setTaskDrafts(next);
  }, [tasks]);

  const projectNameById = useMemo(
    () =>
      Object.fromEntries(projects.map((project) => [project.id, project.name])),
    [projects],
  );

  const selectedMember =
    members.find((member) => member.id === selectedMemberId) || members[0];

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

  async function commitTask(taskId: string) {
    const draft = taskDrafts[taskId];
    if (!draft) {
      return;
    }
    await onUpdateTask(taskId, {
      title: draft.title.trim(),
      deadline: draft.deadline || undefined,
      projectId: draft.projectId || undefined,
      workstream: draft.workstream,
      billable: draft.billable,
      estimateHours: Number(draft.estimateHours) || 0,
    });
  }

  if (!selectedMember) {
    return (
      <section className="grid gap-3 border-b border-slate-200 pb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Task board</h2>
          <p className="text-sm text-slate-500">
            Add members in Admin Control to start assigning work.
          </p>
        </div>
      </section>
    );
  }

  const draft = newTaskDrafts[selectedMember.id] || defaultDraft();

  return (
    <section className="grid gap-5 border-b border-slate-200 pb-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Task board</h2>
          <p className="text-sm text-slate-500">
            Personal work stays here first. Project to-dos can be sent into this
            board when they become assigned work.
          </p>
        </div>
        <div className="text-sm text-slate-500">
          <span className="font-medium text-slate-900">
            {activeHours.toFixed(1)}h
          </span>{" "}
          active for {selectedMember.name}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
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
              className={cn(
                "min-w-45 rounded-2xl border px-4 py-3 text-left transition-colors",
                selectedMemberId === member.id
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              )}
              onClick={() => {
                setSelectedMemberId(member.id);
                setExpandedTaskId("");
              }}
            >
              <p className="font-medium">{member.name}</p>
              <p
                className={cn(
                  "mt-1 text-xs",
                  selectedMemberId === member.id
                    ? "text-slate-200"
                    : "text-slate-500",
                )}
              >
                {categoryLabel[
                  member.category ||
                    (member.workerOwner ? "workerOwner" : "member")
                ] || "Member"}
                {member.monthlyRole && member.monthlyRole !== "none"
                  ? ` · ${monthlyRoleLabel[member.monthlyRole] || member.monthlyRole}`
                  : ""}
              </p>
              <p
                className={cn(
                  "mt-3 text-sm",
                  selectedMemberId === member.id
                    ? "text-white"
                    : "text-slate-700",
                )}
              >
                {memberActiveHours.toFixed(1)}h active
              </p>
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input
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
            className="min-w-0 flex-1 border-0 px-0 text-base shadow-none focus-visible:ring-0"
          />
          <Button
            type="button"
            variant="ghost"
            className="gap-2"
            onClick={() => {
              if (!draft.title.trim()) {
                return;
              }
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
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>

        <div className="grid gap-2 md:grid-cols-4">
          <Input
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
          <select
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
          <select
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
          <Input
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
            placeholder="Estimated hours"
          />
        </div>
      </div>

      <div className="grid gap-1">
        {activeTasks.map((task) => {
          const rowDraft = taskDrafts[task.id] || defaultDraft();
          const detailsOpen = expandedTaskId === task.id;
          const isReview = task.status === "review";

          return (
            <div
              key={task.id}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 px-0"
                  onClick={() => {
                    void onUpdateTask(task.id, {
                      status: "done",
                      archived: true,
                    });
                  }}
                >
                  <Circle className="h-4 w-4" />
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
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none"
                />

                {task.deadline ? (
                  <span className="hidden items-center gap-1 text-xs text-slate-500 md:inline-flex">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {task.deadline}
                  </span>
                ) : null}

                {task.estimateHours ? (
                  <span className="hidden items-center gap-1 text-xs text-slate-500 md:inline-flex">
                    <Clock3 className="h-3.5 w-3.5" />
                    {task.estimateHours}h
                  </span>
                ) : null}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn("h-8 w-8 px-0", isReview && "text-amber-600")}
                  onClick={() => {
                    void onUpdateTask(task.id, {
                      status: isReview ? "todo" : "review",
                      archived: false,
                    });
                  }}
                >
                  <Eye className="h-4 w-4" />
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-8 w-8 px-0",
                    rowDraft.billable && "text-emerald-600",
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
                  <DollarSign className="h-4 w-4" />
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 px-0"
                  onClick={() => setExpandedTaskId(detailsOpen ? "" : task.id)}
                >
                  {detailsOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {detailsOpen ? (
                <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 md:grid-cols-4">
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
                  <div className="flex items-center gap-2">
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
                      size="sm"
                      className="h-10 w-10 px-0 text-slate-500"
                      onClick={() => {
                        void onDeleteTask(task.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {rowDraft.projectId ? (
                    <p className="md:col-span-4 text-xs text-slate-500">
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
        <div className="grid gap-2">
          <button
            type="button"
            className="inline-flex w-fit items-center gap-2 text-sm text-slate-500"
            onClick={() => setShowCompleted((current) => !current)}
          >
            {showCompleted ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            Completed tasks ({completedTasks.length})
          </button>

          {showCompleted ? (
            <div className="grid gap-1">
              {completedTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 px-0 text-emerald-600"
                    onClick={() => {
                      void onUpdateTask(task.id, {
                        status: "todo",
                        archived: false,
                      });
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                  <span className="flex-1 line-through">{task.title}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 px-0"
                    onClick={() => {
                      void onDeleteTask(task.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
