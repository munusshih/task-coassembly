"use client";

import { useState } from "react";
import { Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Project } from "@/lib/types";

interface ProjectSummaryPanelProps {
  projects: Project[];
  onUpdate: (project: Project, updates: Partial<Project>) => Promise<void>;
  onDelete: (project: Project) => void;
  onAddNew: () => void;
}

export function ProjectSummaryPanel({
  projects,
  onUpdate,
  onDelete,
  onAddNew,
}: ProjectSummaryPanelProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<
    Record<string, string | undefined>
  >({});
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Project>>({});

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.clientName?.toLowerCase().includes(searchQuery.toLowerCase()) ??
        false) ||
      (p.purpose?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ??
        false),
  );

  const discovery = filtered.filter((p) => p.stage === "discovery").length;
  const design = filtered.filter((p) => p.stage === "design").length;
  const delivery = filtered.filter((p) => p.stage === "delivery").length;
  const support = filtered.filter((p) => p.stage === "support").length;

  const startEditing = (project: Project) => {
    setEditingId(project.id);
    setEditValues({
      name: project.name,
      purpose: project.purpose,
      description: project.description,
      clientName: project.clientName,
    });
  };

  const handleSave = async (project: Project) => {
    await onUpdate(project, editValues);
    setEditingId(null);
  };

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Projects</CardTitle>
            <p className="text-sm text-slate-500 mt-2">
              {discovery} discovery, {design} design, {delivery} delivery, {support} support
            </p>
          </div>
          <Button onClick={onAddNew} size="sm" className="cursor-pointer">
            <Plus className="h-4 w-4 mr-2" />
            Add project
          </Button>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4">
            <Input
              placeholder="Search projects by name, client, purpose, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="divide-y border-t">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                No projects found. Create one to get started.
              </div>
            ) : (
              filtered.map((project) => {
                const isDeleting = deleteConfirm[project.id] !== undefined;
                const isEditing = editingId === project.id;

                if (isEditing) {
                  return (
                    <div
                      key={project.id}
                      className="py-4 px-4 bg-blue-50 border-b border-blue-200 grid gap-3"
                    >
                      <div className="grid gap-3">
                        <div className="grid gap-1">
                          <label className="text-xs font-medium">Name</label>
                          <Input
                            value={editValues.name || ""}
                            onChange={(e) =>
                              setEditValues((prev) => ({
                                ...prev,
                                name: e.target.value,
                              }))
                            }
                            className="h-8"
                          />
                        </div>
                        <div className="grid gap-1">
                          <label className="text-xs font-medium">Purpose</label>
                          <Input
                            value={editValues.purpose || ""}
                            onChange={(e) =>
                              setEditValues((prev) => ({
                                ...prev,
                                purpose: e.target.value,
                              }))
                            }
                            className="h-8"
                          />
                        </div>
                        <div className="grid gap-1">
                          <label className="text-xs font-medium">
                            Description
                          </label>
                          <Input
                            value={editValues.description || ""}
                            onChange={(e) =>
                              setEditValues((prev) => ({
                                ...prev,
                                description: e.target.value,
                              }))
                            }
                            className="h-8"
                            placeholder="Optional"
                          />
                        </div>
                        <div className="grid gap-1">
                          <label className="text-xs font-medium">Client</label>
                          <Input
                            value={editValues.clientName || ""}
                            onChange={(e) =>
                              setEditValues((prev) => ({
                                ...prev,
                                clientName: e.target.value,
                              }))
                            }
                            className="h-8"
                            placeholder="Optional"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSave(project)}
                          className="cursor-pointer"
                        >
                          <Save className="h-4 w-4 mr-1" />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingId(null);
                            setEditValues({});
                          }}
                          className="cursor-pointer"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={project.id}
                    className="py-3 px-4 hover:bg-slate-50 flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{project.name}</p>
                      <p className="text-xs text-slate-500">
                        {project.clientName || "Internal"} - {project.purpose}
                      </p>
                      {project.description && (
                        <p className="text-xs text-slate-500">
                          {project.description}
                        </p>
                      )}
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {project.stage && (
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                            {project.stage.charAt(0).toUpperCase() + project.stage.slice(1)}
                          </span>
                        )}
                        {project.priority && (
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                            {project.priority.charAt(0).toUpperCase() + project.priority.slice(1)} priority
                          </span>
                        )}
                      </div>
                    </div>

                    {!isDeleting ? (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEditing(project)}
                          className="h-8 px-2 cursor-pointer text-xs"
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setDeleteConfirm((prev) => ({
                              ...prev,
                              [project.id]: "",
                            }))
                          }
                          className="h-8 px-2 cursor-pointer text-red-600 hover:text-red-700 text-xs"
                        >
                          Delete
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <Input
                          size={1}
                          placeholder={project.name.split(" ")[0]}
                          value={deleteConfirm[project.id] || ""}
                          onChange={(e) =>
                            setDeleteConfirm((prev) => ({
                              ...prev,
                              [project.id]: e.target.value,
                            }))
                          }
                          className="h-8 w-24 text-xs"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          disabled={
                            (deleteConfirm[project.id] || "").trim() !==
                            project.name
                          }
                          onClick={() => {
                            onDelete(project);
                            setDeleteConfirm((prev) => ({
                              ...prev,
                              [project.id]: undefined,
                            }));
                          }}
                          className="h-8 bg-red-600 hover:bg-red-700 text-white text-xs px-2 cursor-pointer disabled:cursor-not-allowed"
                        >
                          Delete
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setDeleteConfirm((prev) => ({
                              ...prev,
                              [project.id]: undefined,
                            }))
                          }
                          className="h-8 text-xs px-2 cursor-pointer"
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
