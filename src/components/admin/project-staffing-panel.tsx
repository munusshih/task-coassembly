"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { inputClassName } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Project, ProjectRoleSlot } from "@/lib/types";

interface ProjectStaffingPanelProps {
  projects: Project[];
  memberOptions: Array<{ label: string; value: string }>;
  onProjectSlotChange: (
    projectId: string,
    slot: ProjectRoleSlot,
    value: string,
  ) => void;
  onCollaboratorCountChange: (projectId: string, value: number) => void;
}

export function ProjectStaffingPanel({
  projects,
  memberOptions,
  onProjectSlotChange,
  onCollaboratorCountChange,
}: ProjectStaffingPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Project staffing and collaborators</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {projects.map((project) => (
          <Card key={project.id} className="bg-slate-50/60">
            <CardHeader>
              <CardTitle className="text-base">{project.name}</CardTitle>
              <p className="text-sm text-slate-700">
                {project.purpose || "No purpose set"}
              </p>
              <p className="text-sm text-slate-500">
                {project.description || "No description"}
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="grid gap-2">
                  <Label>Lead</Label>
                  <select
                    className={inputClassName}
                    value={project.leadId || ""}
                    onChange={(event) =>
                      onProjectSlotChange(
                        project.id,
                        "leadId",
                        event.target.value,
                      )
                    }
                  >
                    <option value="">Unassigned</option>
                    {memberOptions.map((member) => (
                      <option key={member.value} value={member.value}>
                        {member.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label>Doer</Label>
                  <select
                    className={inputClassName}
                    value={project.doerId || ""}
                    onChange={(event) =>
                      onProjectSlotChange(
                        project.id,
                        "doerId",
                        event.target.value,
                      )
                    }
                  >
                    <option value="">Unassigned</option>
                    {memberOptions.map((member) => (
                      <option key={member.value} value={member.value}>
                        {member.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label>Consultant</Label>
                  <select
                    className={inputClassName}
                    value={project.consultantId || ""}
                    onChange={(event) =>
                      onProjectSlotChange(
                        project.id,
                        "consultantId",
                        event.target.value,
                      )
                    }
                  >
                    <option value="">Unassigned</option>
                    {memberOptions.map((member) => (
                      <option key={member.value} value={member.value}>
                        {member.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label>Collaborator count</Label>
                  <input
                    className={inputClassName}
                    type="number"
                    min={0}
                    value={project.collaboratorCount || 0}
                    onChange={(event) =>
                      onCollaboratorCountChange(
                        project.id,
                        Number(event.target.value) || 0,
                      )
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}
