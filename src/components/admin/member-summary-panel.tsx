"use client";

import { useState } from "react";
import { Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Member } from "@/lib/types";

interface MemberSummaryPanelProps {
  members: Member[];
  onUpdate: (member: Member, updates: Partial<Member>) => Promise<void>;
  onDelete: (member: Member) => void;
  onAddNew: () => void;
}

export function MemberSummaryPanel({
  members,
  onUpdate,
  onDelete,
  onAddNew,
}: MemberSummaryPanelProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<
    Record<string, string | undefined>
  >({});
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Member>>({});

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const active = filtered.filter(
    (m) => m.status === "active" || m.active,
  ).length;
  const inactive = filtered.filter(
    (m) => m.status === "inactive" || m.active === false,
  ).length;

  const startEditing = (member: Member) => {
    setEditingId(member.id);
    setEditValues({ name: member.name, email: member.email });
  };

  const handleSave = async (member: Member) => {
    await onUpdate(member, editValues);
    setEditingId(null);
  };

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Members</CardTitle>
            <p className="text-sm text-slate-500 mt-2">
              {active} active, {inactive} inactive
            </p>
          </div>
          <Button onClick={onAddNew} size="sm" className="cursor-pointer">
            <Plus className="h-4 w-4 mr-2" />
            Add member
          </Button>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4">
            <Input
              placeholder="Search members by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="divide-y border-t">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                No members found. Create one to get started.
              </div>
            ) : (
              filtered.map((member) => {
                const isDeleting = deleteConfirm[member.id] !== undefined;
                const isEditing = editingId === member.id;

                if (isEditing) {
                  return (
                    <div
                      key={member.id}
                      className="py-4 px-4 bg-blue-50 border-b border-blue-200 grid gap-3"
                    >
                      <div className="grid gap-2 grid-cols-2">
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
                          <label className="text-xs font-medium">Email</label>
                          <Input
                            value={editValues.email || ""}
                            onChange={(e) =>
                              setEditValues((prev) => ({
                                ...prev,
                                email: e.target.value,
                              }))
                            }
                            className="h-8"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSave(member)}
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
                    key={member.id}
                    className="py-3 px-4 hover:bg-slate-50 flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{member.name}</p>
                      <p className="text-xs text-slate-500">{member.email}</p>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {member.status === "active" || member.active ? (
                          <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-600/20">
                            Inactive
                          </span>
                        )}
                        {member.category && (
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                            {member.category === "workerOwner"
                              ? "Worker Owner"
                              : member.category.charAt(0).toUpperCase() +
                                member.category.slice(1)}
                          </span>
                        )}
                      </div>
                    </div>

                    {!isDeleting ? (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEditing(member)}
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
                              [member.id]: "",
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
                          placeholder={member.name.split(" ")[0]}
                          value={deleteConfirm[member.id] || ""}
                          onChange={(e) =>
                            setDeleteConfirm((prev) => ({
                              ...prev,
                              [member.id]: e.target.value,
                            }))
                          }
                          className="h-8 w-24 text-xs"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          disabled={
                            (deleteConfirm[member.id] || "").trim() !==
                            member.name
                          }
                          onClick={() => {
                            onDelete(member);
                            setDeleteConfirm((prev) => ({
                              ...prev,
                              [member.id]: undefined,
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
                              [member.id]: undefined,
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
