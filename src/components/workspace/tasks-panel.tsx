"use client";

import { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, inputClassName } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Member, Task } from "@/lib/types";

interface TasksPanelProps {
  showArchived: boolean;
  onToggleArchived: (value: boolean) => void;
  taskTitle: string;
  onTaskTitleChange: (value: string) => void;
  taskEstimate: number;
  onTaskEstimateChange: (value: number) => void;
  taskBoardOwnerId: string;
  onTaskBoardOwnerChange: (value: string) => void;
  members: Member[];
  tasksByOwner: Record<string, Task[]>;
  onSubmitTask: (event: FormEvent<HTMLFormElement>) => void;
  onToggleArchiveTask: (taskId: string, archived: boolean) => void;
  roleName: (id: string | undefined, members: Member[]) => string;
}

export function TasksPanel({
  showArchived,
  onToggleArchived,
  taskTitle,
  onTaskTitleChange,
  taskEstimate,
  onTaskEstimateChange,
  taskBoardOwnerId,
  onTaskBoardOwnerChange,
  members,
  tasksByOwner,
  onSubmitTask,
  onToggleArchiveTask,
  roleName,
}: TasksPanelProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Shared task board</CardTitle>
        <Label className="inline-flex items-center gap-2 font-normal">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => onToggleArchived(event.target.checked)}
          />
          Show archived
        </Label>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form className="grid gap-3 md:grid-cols-4" onSubmit={onSubmitTask}>
          <Input
            value={taskTitle}
            onChange={(event) => onTaskTitleChange(event.target.value)}
            placeholder="Task title"
            required
          />
          <Input
            type="number"
            min={0}
            step={0.5}
            value={taskEstimate}
            onChange={(event) => onTaskEstimateChange(Number(event.target.value))}
            placeholder="Hours"
          />
          <select
            className={inputClassName}
            value={taskBoardOwnerId}
            onChange={(event) => onTaskBoardOwnerChange(event.target.value)}
            required
          >
            <option value="">Board owner</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
          <Button type="submit">Add task</Button>
        </form>

        <div className="grid gap-3 md:grid-cols-2">
          {Object.entries(tasksByOwner).map(([ownerId, ownerTasks]) => (
            <Card key={ownerId} className="bg-slate-50/60">
              <CardHeader>
                <CardTitle className="text-base">
                  {roleName(ownerId === "unassigned" ? undefined : ownerId, members)} board
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-2">
                  {ownerTasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-start justify-between gap-3 rounded-md border border-slate-200 bg-white p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">{task.title}</p>
                        <p className="text-xs text-slate-500">{task.estimateHours}h estimate</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onToggleArchiveTask(task.id, task.archived)}
                      >
                        {task.archived ? "Unarchive" : "Archive"}
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
