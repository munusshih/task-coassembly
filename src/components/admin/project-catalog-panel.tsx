"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, inputClassName } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Project, ProjectOffering, Task } from "@/lib/types";

const USD_TO_TWD = 32;

function createOffering(name = ""): ProjectOffering {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    completed: false,
  };
}

interface ProjectCatalogPanelProps {
  projects: Project[];
  tasks: Task[];
  memberOptions: Array<{ label: string; value: string }>;
  onUpdateProject: (
    id: string,
    payload: Partial<Omit<Project, "id">>,
  ) => Promise<void>;
  onDeleteProject: (id: string) => Promise<void>;
}

export function ProjectCatalogPanel({
  projects,
  tasks,
  memberOptions,
  onUpdateProject,
  onDeleteProject,
}: ProjectCatalogPanelProps) {
  const [drafts, setDrafts] = useState<
    Record<string, Partial<Omit<Project, "id">>>
  >({});

  useEffect(() => {
    const nextDrafts: Record<string, Partial<Omit<Project, "id">>> = {};
    for (const project of projects) {
      nextDrafts[project.id] = {
        name: project.name,
        purpose: project.purpose || "",
        description: project.description || "",
        clientName: project.clientName || "",
        clientContactName: project.clientContactName || "",
        clientContactEmail: project.clientContactEmail || "",
        clientContactPhone: project.clientContactPhone || "",
        proposalLink: project.proposalLink || "",
        contractLink: project.contractLink || "",
        projectType: project.projectType || "",
        stage: project.stage || "discovery",
        priority: project.priority || "medium",
        startDate: project.startDate || "",
        dueDate: project.dueDate || "",
        timelineSummary: project.timelineSummary || "",
        budgetUsd: project.budgetUsd ?? 0,
        successMetric: project.successMetric || "",
        risks: project.risks || "",
        collaboratorCount: project.collaboratorCount ?? 0,
        leadId: project.leadId || "",
        maxBillableHours: project.maxBillableHours ?? 0,
        offerings: (project.offerings || []).map((offering) => ({
          ...offering,
          completed: Boolean(offering.completed),
        })),
      };
    }
    setDrafts(nextDrafts);
  }, [projects]);

  const metricsByProjectId = useMemo(() => {
    return Object.fromEntries(
      projects.map((project) => {
        const projectTasks = tasks.filter(
          (task) => task.projectId === project.id,
        );
        const totalHours = projectTasks.reduce(
          (sum, task) => sum + (Number(task.estimateHours) || 0),
          0,
        );
        const billableHours = projectTasks.reduce(
          (sum, task) =>
            sum + (task.billable ? Number(task.estimateHours) || 0 : 0),
          0,
        );
        return [project.id, { totalHours, billableHours }];
      }),
    );
  }, [projects, tasks]);

  function updateDraft(
    projectId: string,
    payload: Partial<Omit<Project, "id">>,
  ) {
    setDrafts((current) => ({
      ...current,
      [projectId]: {
        ...current[projectId],
        ...payload,
      },
    }));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project catalog and business details</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {projects.map((project) => {
          const draft = drafts[project.id] || {};
          const offerings =
            (draft.offerings as ProjectOffering[] | undefined) || [];
          const metrics = metricsByProjectId[project.id] || {
            totalHours: 0,
            billableHours: 0,
          };
          const budgetUsd = Number(draft.budgetUsd) || 0;
          const budgetTwd = Math.round(budgetUsd * USD_TO_TWD);
          const maxBillableHours = Number(draft.maxBillableHours) || 0;
          const hourlyUsd =
            maxBillableHours > 0 ? budgetUsd / maxBillableHours : 0;
          const hourlyTwd = Math.round(hourlyUsd * USD_TO_TWD);
          const billableUsage =
            maxBillableHours > 0
              ? Math.round((metrics.billableHours / maxBillableHours) * 100)
              : 0;

          return (
            <Card key={project.id} className="bg-slate-50/60">
              <CardHeader>
                <CardTitle className="text-base">{project.name}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Input
                    value={draft.name || ""}
                    onChange={(event) =>
                      updateDraft(project.id, { name: event.target.value })
                    }
                    placeholder="Project name"
                  />
                  <Input
                    value={draft.clientName || ""}
                    onChange={(event) =>
                      updateDraft(project.id, {
                        clientName: event.target.value,
                      })
                    }
                    placeholder="Client / organization"
                  />
                  <Input
                    value={draft.projectType || ""}
                    onChange={(event) =>
                      updateDraft(project.id, {
                        projectType: event.target.value,
                      })
                    }
                    placeholder="Project type"
                  />
                  <select
                    className={inputClassName}
                    value={String(draft.leadId || "")}
                    onChange={(event) =>
                      updateDraft(project.id, { leadId: event.target.value })
                    }
                  >
                    <option value="">Select lead</option>
                    {memberOptions.map((member) => (
                      <option key={member.value} value={member.value}>
                        {member.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <Input
                    value={draft.clientContactName || ""}
                    onChange={(event) =>
                      updateDraft(project.id, {
                        clientContactName: event.target.value,
                      })
                    }
                    placeholder="Client contact name"
                  />
                  <Input
                    type="email"
                    value={draft.clientContactEmail || ""}
                    onChange={(event) =>
                      updateDraft(project.id, {
                        clientContactEmail: event.target.value,
                      })
                    }
                    placeholder="Client contact email"
                  />
                  <Input
                    value={draft.clientContactPhone || ""}
                    onChange={(event) =>
                      updateDraft(project.id, {
                        clientContactPhone: event.target.value,
                      })
                    }
                    placeholder="Client contact phone"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    type="url"
                    value={draft.proposalLink || ""}
                    onChange={(event) =>
                      updateDraft(project.id, {
                        proposalLink: event.target.value,
                      })
                    }
                    placeholder="Proposal link"
                  />
                  <Input
                    type="url"
                    value={draft.contractLink || ""}
                    onChange={(event) =>
                      updateDraft(project.id, {
                        contractLink: event.target.value,
                      })
                    }
                    placeholder="Contract link"
                  />
                </div>

                <Textarea
                  rows={2}
                  value={draft.purpose || ""}
                  onChange={(event) =>
                    updateDraft(project.id, { purpose: event.target.value })
                  }
                  placeholder="What is this project about?"
                />

                <Textarea
                  rows={2}
                  value={draft.description || ""}
                  onChange={(event) =>
                    updateDraft(project.id, { description: event.target.value })
                  }
                  placeholder="Working scope or delivery notes"
                />

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <select
                    className={inputClassName}
                    value={String(draft.stage || "discovery")}
                    onChange={(event) =>
                      updateDraft(project.id, {
                        stage: event.target.value as Project["stage"],
                      })
                    }
                  >
                    <option value="discovery">Discovery</option>
                    <option value="design">Design</option>
                    <option value="delivery">Delivery</option>
                    <option value="support">Support</option>
                  </select>
                  <select
                    className={inputClassName}
                    value={String(draft.priority || "medium")}
                    onChange={(event) =>
                      updateDraft(project.id, {
                        priority: event.target.value as Project["priority"],
                      })
                    }
                  >
                    <option value="low">Low priority</option>
                    <option value="medium">Medium priority</option>
                    <option value="high">High priority</option>
                  </select>
                  <Input
                    type="date"
                    value={draft.startDate || ""}
                    onChange={(event) =>
                      updateDraft(project.id, { startDate: event.target.value })
                    }
                  />
                  <Input
                    type="date"
                    value={draft.dueDate || ""}
                    onChange={(event) =>
                      updateDraft(project.id, { dueDate: event.target.value })
                    }
                  />
                  <Input
                    type="number"
                    min={0}
                    value={draft.collaboratorCount ?? 0}
                    onChange={(event) =>
                      updateDraft(project.id, {
                        collaboratorCount: Number(event.target.value) || 0,
                      })
                    }
                    placeholder="Collaborator count"
                  />
                </div>

                <Textarea
                  rows={2}
                  value={draft.timelineSummary || ""}
                  onChange={(event) =>
                    updateDraft(project.id, {
                      timelineSummary: event.target.value,
                    })
                  }
                  placeholder="Timeline summary or milestone notes"
                />

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Input
                    type="number"
                    min={0}
                    value={draft.budgetUsd ?? 0}
                    onChange={(event) =>
                      updateDraft(project.id, {
                        budgetUsd: Number(event.target.value) || 0,
                      })
                    }
                    placeholder="Budget (USD)"
                  />
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    value={draft.maxBillableHours ?? 0}
                    onChange={(event) =>
                      updateDraft(project.id, {
                        maxBillableHours: Number(event.target.value) || 0,
                      })
                    }
                    placeholder="Max billable hours"
                  />
                  <Input
                    value={hourlyUsd ? hourlyUsd.toFixed(2) : ""}
                    placeholder="Hourly rate (USD)"
                    readOnly
                  />
                  <Input
                    value={hourlyTwd ? String(hourlyTwd) : ""}
                    placeholder="Hourly rate (TWD)"
                    readOnly
                  />
                </div>

                <div className="grid gap-2 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-4">
                  <p>Budget: ${budgetUsd.toLocaleString()} USD</p>
                  <p>Budget: NT${budgetTwd.toLocaleString()} TWD</p>
                  <p>Current hours: {metrics.totalHours.toFixed(1)}h</p>
                  <p>
                    Billable used: {metrics.billableHours.toFixed(1)}h /{" "}
                    {maxBillableHours || 0}h ({billableUsage}%)
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    value={draft.successMetric || ""}
                    onChange={(event) =>
                      updateDraft(project.id, {
                        successMetric: event.target.value,
                      })
                    }
                    placeholder="Success metric"
                  />
                  <Input
                    value={draft.risks || ""}
                    onChange={(event) =>
                      updateDraft(project.id, { risks: event.target.value })
                    }
                    placeholder="Risks or blockers"
                  />
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-900">
                      Other offerings
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        updateDraft(project.id, {
                          offerings: [...offerings, createOffering()],
                        })
                      }
                    >
                      Add offering
                    </Button>
                  </div>
                  <div className="grid gap-2">
                    {offerings.map((offering) => (
                      <div key={offering.id} className="flex gap-2">
                        <label className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={offering.completed}
                            onChange={(event) =>
                              updateDraft(project.id, {
                                offerings: offerings.map((item) =>
                                  item.id === offering.id
                                    ? {
                                        ...item,
                                        completed: event.target.checked,
                                      }
                                    : item,
                                ),
                              })
                            }
                          />
                          Done
                        </label>
                        <Input
                          value={offering.name}
                          onChange={(event) =>
                            updateDraft(project.id, {
                              offerings: offerings.map((item) =>
                                item.id === offering.id
                                  ? { ...item, name: event.target.value }
                                  : item,
                              ),
                            })
                          }
                          placeholder="Offering or service line"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            updateDraft(project.id, {
                              offerings: offerings.filter(
                                (item) => item.id !== offering.id,
                              ),
                            })
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      void onUpdateProject(project.id, {
                        ...draft,
                        name: String(draft.name || "").trim(),
                        purpose: String(draft.purpose || "").trim(),
                        description: String(draft.description || "").trim(),
                        clientName: String(draft.clientName || "").trim(),
                        clientContactName: String(
                          draft.clientContactName || "",
                        ).trim(),
                        clientContactEmail: String(
                          draft.clientContactEmail || "",
                        ).trim(),
                        clientContactPhone: String(
                          draft.clientContactPhone || "",
                        ).trim(),
                        proposalLink: String(draft.proposalLink || "").trim(),
                        contractLink: String(draft.contractLink || "").trim(),
                        projectType: String(draft.projectType || "").trim(),
                        startDate: String(draft.startDate || ""),
                        dueDate: String(draft.dueDate || ""),
                        timelineSummary: String(
                          draft.timelineSummary || "",
                        ).trim(),
                        successMetric: String(draft.successMetric || "").trim(),
                        risks: String(draft.risks || "").trim(),
                        budgetUsd: Number(draft.budgetUsd) || 0,
                        collaboratorCount: Number(draft.collaboratorCount) || 0,
                        maxBillableHours: Number(draft.maxBillableHours) || 0,
                        leadId: String(draft.leadId || "") || undefined,
                        offerings: offerings
                          .map((offering) => ({
                            ...offering,
                            name: offering.name.trim(),
                          }))
                          .filter((offering) => offering.name),
                      });
                    }}
                  >
                    Save details
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const confirmed = window.confirm(
                        "Delete this project? Existing tasks and notes may still reference it.",
                      );
                      if (confirmed) {
                        void onDeleteProject(project.id);
                      }
                    }}
                  >
                    Remove project
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </CardContent>
    </Card>
  );
}
