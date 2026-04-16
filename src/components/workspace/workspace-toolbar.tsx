"use client";

import { Dispatch, SetStateAction } from "react";
import { FileText, FolderOpen, ListTodo } from "lucide-react";
import { Label } from "@/components/ui/label";
import { inputClassName } from "@/components/ui/input";
import { Project } from "@/lib/types";

interface WorkspaceToolbarProps {
  projects: Project[];
  selectedProject?: Project;
  selectedProjectId: string;
  setSelectedProjectId: Dispatch<SetStateAction<string>>;
  workspaceView: "project" | "notes";
  setWorkspaceView: Dispatch<SetStateAction<"project" | "notes">>;
}

function formatProjectTypeLabel(value: string): string {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatStageLabel(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export function WorkspaceToolbar({
  projects,
  selectedProject,
  selectedProjectId,
  setSelectedProjectId,
  workspaceView,
  setWorkspaceView,
}: WorkspaceToolbarProps) {
  const hasProjects = projects.length > 0;
  const projectTypes = selectedProject?.projectTypes?.length
    ? selectedProject.projectTypes
    : String(selectedProject?.projectType || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
  const engagementLabels: Record<
    NonNullable<Project["engagementType"]>,
    string
  > = {
    commissioned: "Commissioned Work",
    selfFunded: "Self-funded Project",
    grant: "Grant Project",
    passThrough: "Pass-through Work",
  };
  const engagementLabel = selectedProject?.engagementType
    ? engagementLabels[selectedProject.engagementType]
    : null;
  const staffedCount = selectedProject
    ? new Set(
        (selectedProject.staffing || [])
          .filter((assignment) => assignment.memberId)
          .map((assignment) => assignment.memberId),
      ).size ||
      selectedProject.collaboratorCount ||
      0
    : 0;
  const configuredStages = (selectedProject?.stages || []).filter(Boolean);

  return (
    <div className="panel toolbar">
      <div className="toolbar__main">
        <div className="field">
          <Label htmlFor="project-id">Active project</Label>
          <select
            id="project-id"
            className={inputClassName}
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
          >
            <option value="">
              {hasProjects ? "Select a project" : "No projects available yet"}
            </option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <p className="toolbar__hint">
            {hasProjects
              ? "Pick a project before working in project to-dos or meeting notes."
              : "Create a project in Admin Control first."}
          </p>
        </div>

        <div className="field">
          <Label>Workspace view</Label>
          <div className="segment">
            <button
              type="button"
              className="segment__btn"
              data-active={workspaceView === "project"}
              onClick={() => setWorkspaceView("project")}
            >
              <ListTodo className="icon-sm" />
              Project to-dos
            </button>
            <button
              type="button"
              className="segment__btn"
              data-active={workspaceView === "notes"}
              onClick={() => setWorkspaceView("notes")}
            >
              <FileText className="icon-sm" />
              Meeting notes
            </button>
          </div>
        </div>
      </div>

      {selectedProject ? (
        <div className="field">
          <div className="toolbar__meta">
            <span className="toolbar__meta-item">
              <FolderOpen className="icon-sm" />
              {selectedProject.name}
            </span>
            {selectedProject.clientName ? (
              <span className="toolbar__meta-item">
                {selectedProject.clientName}
              </span>
            ) : null}
            {engagementLabel ? (
              <span className="toolbar__meta-item">{engagementLabel}</span>
            ) : null}
            <span className="toolbar__meta-item">
              {selectedProject.stage
                ? `${formatStageLabel(selectedProject.stage)} stage`
                : "Stage not set"}
            </span>
            {configuredStages.length ? (
              <span className="toolbar__meta-item">
                {configuredStages.length} stages configured
              </span>
            ) : null}
            <span className="toolbar__meta-item">
              {selectedProject.priority
                ? `${selectedProject.priority[0].toUpperCase()}${selectedProject.priority.slice(1)} priority`
                : "Priority not set"}
            </span>
            <span className="toolbar__meta-item">{staffedCount} staffed</span>
          </div>
          {projectTypes.length ? (
            <div className="toolbar__meta">
              {projectTypes.map((typeValue) => (
                <span key={typeValue} className="toolbar__meta-item">
                  {formatProjectTypeLabel(typeValue)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="empty">
          {hasProjects
            ? "No project is selected. Choose one above to open notes and project work."
            : "No projects exist yet. Add one in Admin Control to unlock project work."}
        </div>
      )}
    </div>
  );
}
