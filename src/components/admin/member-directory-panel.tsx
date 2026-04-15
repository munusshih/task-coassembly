"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, inputClassName } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Member, MemberCategory, MemberMonthlyRole } from "@/lib/types";
import { cn } from "@/lib/utils";

const categoryOptions: Array<{ label: string; value: MemberCategory }> = [
  { label: "Worker Owner", value: "workerOwner" },
  { label: "Associate", value: "associate" },
  { label: "Collaborator", value: "collaborator" },
  { label: "Member", value: "member" },
];

const monthlyRoleOptions: Array<{ label: string; value: MemberMonthlyRole }> = [
  { label: "None", value: "none" },
  { label: "Facilitator", value: "facilitator" },
  { label: "Time keeper", value: "timeKeeper" },
  { label: "Note taker", value: "noteTaker" },
];

const pronounOptions = ["she/her", "he/him", "they/them", "any"];

const locationSuggestions = [
  "Taipei",
  "New Taipei",
  "Taoyuan",
  "Hsinchu",
  "Taichung",
  "Tainan",
  "Kaohsiung",
  "Remote",
  "Hybrid",
];

function normalizePronouns(
  value: Member["pronouns"] | string | undefined,
): string[] {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function defaultCategory(member: Member): MemberCategory {
  if (member.category) {
    return member.category;
  }
  return member.workerOwner ? "workerOwner" : "member";
}

function defaultActive(member: Member): boolean {
  if (typeof member.active === "boolean") {
    return member.active;
  }
  return member.status !== "inactive" && member.status !== "alumni";
}

interface MemberDirectoryPanelProps {
  members: Member[];
  onUpdateMember: (
    id: string,
    payload: Partial<Omit<Member, "id">>,
  ) => Promise<void>;
  onDeleteMember: (id: string) => Promise<void>;
}

export function MemberDirectoryPanel({
  members,
  onUpdateMember,
  onDeleteMember,
}: MemberDirectoryPanelProps) {
  const [drafts, setDrafts] = useState<
    Record<string, Partial<Omit<Member, "id">>>
  >({});
  const [customPronouns, setCustomPronouns] = useState<Record<string, string>>(
    {},
  );
  const [deleteConfirm, setDeleteConfirm] = useState<
    Record<string, string | undefined>
  >({});

  useEffect(() => {
    const nextDrafts: Record<string, Partial<Omit<Member, "id">>> = {};
    for (const member of members) {
      nextDrafts[member.id] = {
        name: member.name,
        email: member.email,
        role: member.role || "",
        pronouns: normalizePronouns(member.pronouns),
        phone: member.phone || "",
        location: member.location || "",
        category: defaultCategory(member),
        active: defaultActive(member),
        monthlyRole: member.monthlyRole || "none",
        status:
          member.status || (defaultActive(member) ? "active" : "inactive"),
        workerOwner: member.workerOwner ?? false,
        capacityPerWeek: member.capacityPerWeek ?? 0,
        vacationDays: member.vacationDays ?? 0,
        notes: member.notes || "",
      };
    }
    setDrafts(nextDrafts);
  }, [members]);

  function updateDraft(memberId: string, payload: Partial<Omit<Member, "id">>) {
    setDrafts((current) => ({
      ...current,
      [memberId]: {
        ...current[memberId],
        ...payload,
      },
    }));
  }

  function togglePronoun(memberId: string, value: string) {
    const currentPronouns = normalizePronouns(drafts[memberId]?.pronouns);
    if (currentPronouns.includes(value)) {
      updateDraft(memberId, {
        pronouns: currentPronouns.filter((item) => item !== value),
      });
      return;
    }
    updateDraft(memberId, {
      pronouns: [...currentPronouns, value],
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Member directory and records</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {members.map((member) => {
          const draft = drafts[member.id] || {};
          const draftPronouns = normalizePronouns(draft.pronouns);
          return (
            <Card key={member.id} className="bg-slate-50/60">
              <CardHeader>
                <CardTitle className="text-base">{member.name}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                  <div className="grid gap-2">
                    <Label htmlFor={`name-${member.id}`}>Name</Label>
                    <Input
                      id={`name-${member.id}`}
                      value={draft.name || ""}
                      onChange={(event) =>
                        updateDraft(member.id, { name: event.target.value })
                      }
                      placeholder="Full name"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`email-${member.id}`}>Email</Label>
                    <Input
                      id={`email-${member.id}`}
                      type="email"
                      value={draft.email || ""}
                      onChange={(event) =>
                        updateDraft(member.id, { email: event.target.value })
                      }
                      placeholder="Name@example.com"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`category-${member.id}`}>Category</Label>
                    <select
                      id={`category-${member.id}`}
                      className={inputClassName}
                      value={(draft.category as MemberCategory) || "member"}
                      onChange={(event) =>
                        updateDraft(member.id, {
                          category: event.target.value as MemberCategory,
                          workerOwner: event.target.value === "workerOwner",
                        })
                      }
                    >
                      {categoryOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`role-${member.id}`}>Monthly role</Label>
                    <select
                      id={`role-${member.id}`}
                      className={inputClassName}
                      value={(draft.monthlyRole as MemberMonthlyRole) || "none"}
                      onChange={(event) =>
                        updateDraft(member.id, {
                          monthlyRole: event.target.value as MemberMonthlyRole,
                          role: event.target.value,
                        })
                      }
                    >
                      {monthlyRoleOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                  <div className="grid gap-2">
                    <Label htmlFor={`phone-${member.id}`}>Phone</Label>
                    <Input
                      id={`phone-${member.id}`}
                      value={draft.phone || ""}
                      onChange={(event) =>
                        updateDraft(member.id, { phone: event.target.value })
                      }
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`location-${member.id}`}>Location</Label>
                    <Input
                      id={`location-${member.id}`}
                      list={`member-location-${member.id}`}
                      value={draft.location || ""}
                      onChange={(event) =>
                        updateDraft(member.id, { location: event.target.value })
                      }
                      placeholder="City, Country"
                    />
                    <datalist id={`member-location-${member.id}`}>
                      {locationSuggestions.map((location) => (
                        <option key={location} value={location} />
                      ))}
                    </datalist>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`capacity-${member.id}`}>
                      Capacity per week (hours)
                    </Label>
                    <Input
                      id={`capacity-${member.id}`}
                      type="number"
                      min={0}
                      step={0.5}
                      value={draft.capacityPerWeek ?? 0}
                      onChange={(event) =>
                        updateDraft(member.id, {
                          capacityPerWeek: Number(event.target.value) || 0,
                        })
                      }
                      placeholder="30"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`vacation-${member.id}`}>
                      Vacation days
                    </Label>
                    <Input
                      id={`vacation-${member.id}`}
                      type="number"
                      min={0}
                      step={0.5}
                      value={draft.vacationDays ?? 0}
                      onChange={(event) =>
                        updateDraft(member.id, {
                          vacationDays: Number(event.target.value) || 0,
                        })
                      }
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Pronouns</Label>
                  <div className="flex flex-wrap gap-2">
                    {pronounOptions.map((option) => {
                      const selected = draftPronouns.includes(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          className={cn(
                            "rounded-md border px-3 py-2 text-sm transition-colors",
                            selected
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                          )}
                          onClick={() => togglePronoun(member.id, option)}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add custom pronoun"
                      value={customPronouns[member.id] || ""}
                      onChange={(event) =>
                        setCustomPronouns((current) => ({
                          ...current,
                          [member.id]: event.target.value,
                        }))
                      }
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const value = (customPronouns[member.id] || "").trim();
                        if (!value || draftPronouns.includes(value)) {
                          return;
                        }
                        updateDraft(member.id, {
                          pronouns: [...draftPronouns, value],
                        });
                        setCustomPronouns((current) => ({
                          ...current,
                          [member.id]: "",
                        }));
                      }}
                    >
                      Add
                    </Button>
                  </div>
                </div>

                <Label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(draft.active)}
                    onChange={(event) =>
                      updateDraft(member.id, {
                        active: event.target.checked,
                        status: event.target.checked ? "active" : "inactive",
                      })
                    }
                  />
                  Active this month
                </Label>

                <div className="grid gap-2">
                  <Label htmlFor={`notes-${member.id}`}>Notes</Label>
                  <Textarea
                    id={`notes-${member.id}`}
                    rows={3}
                    value={draft.notes || ""}
                    onChange={(event) =>
                      updateDraft(member.id, { notes: event.target.value })
                    }
                    placeholder="Notes, vacation context, or availability details"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      void onUpdateMember(member.id, {
                        ...draft,
                        name: String(draft.name || "").trim(),
                        email: String(draft.email || "").trim(),
                        phone: String(draft.phone || "").trim(),
                        location: String(draft.location || "").trim(),
                        role:
                          draft.monthlyRole && draft.monthlyRole !== "none"
                            ? String(draft.monthlyRole)
                            : "",
                        pronouns: draftPronouns,
                        notes: String(draft.notes || "").trim(),
                        workerOwner: draft.category === "workerOwner",
                        active: Boolean(draft.active),
                        status: draft.active ? "active" : "inactive",
                        capacityPerWeek: Number(draft.capacityPerWeek) || 0,
                        vacationDays: Number(draft.vacationDays) || 0,
                      });
                    }}
                  >
                    Save changes
                  </Button>
                  {deleteConfirm[member.id] === undefined ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setDeleteConfirm((prev) => ({
                          ...prev,
                          [member.id]: "",
                        }))
                      }
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove member
                    </Button>
                  ) : (
                    <div className="flex gap-2 rounded-md border border-red-200 bg-red-50 p-3">
                      <div className="flex flex-col gap-2">
                        <p className="text-sm text-red-800">
                          Type <strong>{member.name}</strong> to confirm
                          deletion
                        </p>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Type member name"
                            value={deleteConfirm[member.id] || ""}
                            onChange={(event) =>
                              setDeleteConfirm((prev) => ({
                                ...prev,
                                [member.id]: event.target.value,
                              }))
                            }
                            className="h-8"
                          />
                          <Button
                            type="button"
                            size="sm"
                            disabled={
                              (deleteConfirm[member.id] || "").trim() !==
                              member.name
                            }
                            onClick={() => {
                              void onDeleteMember(member.id);
                              setDeleteConfirm((prev) => ({
                                ...prev,
                                [member.id]: undefined,
                              }));
                            }}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Confirm
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setDeleteConfirm((prev) => ({
                                ...prev,
                                [member.id]: undefined,
                              }))
                            }
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </CardContent>
    </Card>
  );
}
