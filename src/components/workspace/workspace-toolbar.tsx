"use client";

import { Dispatch, SetStateAction } from "react";
import { FileText, ListTodo } from "lucide-react";
import { Label } from "@/components/ui/label";
import { inputClassName } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Project } from "@/lib/types";

interface WorkspaceToolbarProps {
  projects: Project[];
  selectedProjectId: string;
  setSelectedProjectId: Dispatch<SetStateAction<string>>;
  workspaceView: "project" | "notes";
  setWorkspaceView: Dispatch<SetStateAction<"project" | "notes">>;
}

export function WorkspaceToolbar({
  projects,
  selectedProjectId,
  setSelectedProjectId,
  workspaceView,
  setWorkspaceView,
}: WorkspaceToolbarProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="grid gap-2">
        <Label htmlFor="project-id">Project workspace</Label>
        <select
          id="project-id"
          className={cn(inputClassName, "min-w-56")}
          value={selectedProjectId}
          onChange={(event) => setSelectedProjectId(event.target.value)}
        >
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors",
            workspaceView === "project"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200",
          )}
          onClick={() => setWorkspaceView("project")}
        >
          <ListTodo className="h-4 w-4" />
          Project to-dos
        </button>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors",
            workspaceView === "notes"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200",
          )}
          onClick={() => setWorkspaceView("notes")}
        >
          <FileText className="h-4 w-4" />
          Meeting notes
        </button>
      </div>
    </div>
  );
}
