"use client";

import { useEffect, useState } from "react";
import { Archive, CheckCircle2, Circle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Member, Project, Task } from "@/lib/types";

interface AllMembersTaskBoardProps {
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

export function AllMembersTaskBoard({
  members,
  projects,
  tasks,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
}: AllMembersTaskBoardProps) {
  const [newTask, setNewTask] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

  const activeTasks = tasks.filter((t) => !t.archived);
  const completedTasks = tasks.filter((t) => t.archived);

  const activeMembers = members.filter(
    (m) => m.status === "active" || m.active === true,
  );

  const getMemberTasks = (memberId: string, completed = false) => {
    const memberTaskList = completed ? completedTasks : activeTasks;
    return memberTaskList.filter(
      (t) => t.boardOwnerId === memberId && t.archived === completed,
    );
  };

  const handleCreateTask = (memberId: string) => {
    if (!newTask.trim()) return;
    const project = projects[0];
    void onCreateTask({
      title: newTask.trim(),
      deadline: "",
      projectId: project?.id || "",
      workstream: "client",
      billable: true,
      estimateHours: 1,
      boardOwnerId: memberId,
      status: "todo",
      archived: false,
    });
    setNewTask("");
  };

  return (
    <div className="grid gap-4">
      {/* Controls */}
      <div className="flex gap-2">
        <Input
          placeholder="Add task..."
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && activeMembers[0]) {
              handleCreateTask(activeMembers[0].id);
            }
          }}
          className="flex-1"
        />
        <Button
          size="sm"
          onClick={() => {
            if (activeMembers[0]) {
              handleCreateTask(activeMembers[0].id);
            }
          }}
        >
          <Plus className="h-4 w-4" />
          Add
        </Button>
        <Button
          size="sm"
          variant={showCompleted ? "default" : "outline"}
          onClick={() => setShowCompleted(!showCompleted)}
        >
          {showCompleted ? "Hide" : "Show"} completed
        </Button>
      </div>

      {/* Members Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {activeMembers.map((member) => {
          const memberActiveTasks = getMemberTasks(member.id, false);
          const memberCompletedTasks = getMemberTasks(member.id, true);

          return (
            <div
              key={member.id}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <h3 className="font-semibold text-sm mb-3">{member.name}</h3>

              {/* Tasks */}
              <div className="space-y-2 mb-4">
                {memberActiveTasks.length === 0 && !showCompleted && (
                  <p className="text-xs text-slate-400 italic">No tasks</p>
                )}

                {memberActiveTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start gap-2 p-2 rounded hover:bg-slate-50 group text-sm"
                  >
                    <button
                      onClick={() =>
                        void onUpdateTask(task.id, {
                          status: task.status === "done" ? "todo" : "done",
                        })
                      }
                      className="mt-1 flex-shrink-0 text-slate-400 hover:text-slate-600"
                    >
                      {task.status === "done" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <Circle className="h-4 w-4" />
                      )}
                    </button>
                    <span
                      className={cn(
                        "flex-1 break-words",
                        task.status === "done" && "line-through text-slate-400",
                      )}
                    >
                      {task.title}
                    </span>
                    <div className="opacity-0 group-hover:opacity-100 flex gap-1 flex-shrink-0">
                      <button
                        onClick={() =>
                          void onUpdateTask(task.id, { archived: true })
                        }
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => void onDeleteTask(task.id)}
                        className="text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Completed tasks */}
              {showCompleted && memberCompletedTasks.length > 0 && (
                <div className="border-t border-slate-200 pt-2">
                  <p className="text-xs text-slate-500 mb-2 font-medium">
                    Completed ({memberCompletedTasks.length})
                  </p>
                  <div className="space-y-1">
                    {memberCompletedTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-start gap-2 p-1 rounded hover:bg-slate-50 group text-xs text-slate-400"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="line-through flex-1 break-words">
                          {task.title}
                        </span>
                        <button
                          onClick={() =>
                            void onUpdateTask(task.id, { archived: false })
                          }
                          className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-blue-600 mr-1"
                        >
                          Restore
                        </button>
                        <button
                          onClick={() => void onDeleteTask(task.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-600"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick add */}
              <div className="border-t border-slate-200 pt-2 mt-2">
                <button
                  onClick={() => handleCreateTask(member.id)}
                  className="w-full px-2 py-1 rounded text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <Plus className="h-3 w-3" />
                  Add task
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
