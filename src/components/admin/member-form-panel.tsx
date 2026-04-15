"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, inputClassName } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MemberCategory, MemberMonthlyRole } from "@/lib/types";
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

interface MemberFormPanelProps {
  memberName: string;
  onMemberNameChange: (value: string) => void;
  memberEmail: string;
  onMemberEmailChange: (value: string) => void;
  memberCategory: MemberCategory;
  onMemberCategoryChange: (value: MemberCategory) => void;
  memberPronouns: string[];
  onMemberPronounsChange: (value: string[]) => void;
  memberPhone: string;
  onMemberPhoneChange: (value: string) => void;
  memberLocation: string;
  onMemberLocationChange: (value: string) => void;
  memberActive: boolean;
  onMemberActiveChange: (value: boolean) => void;
  memberMonthlyRole: MemberMonthlyRole;
  onMemberMonthlyRoleChange: (value: MemberMonthlyRole) => void;
  memberCapacityPerWeek: number;
  onMemberCapacityPerWeekChange: (value: number) => void;
  memberVacationDays: number;
  onMemberVacationDaysChange: (value: number) => void;
  memberNotes: string;
  onMemberNotesChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function MemberFormPanel({
  memberName,
  onMemberNameChange,
  memberEmail,
  onMemberEmailChange,
  memberCategory,
  onMemberCategoryChange,
  memberPronouns,
  onMemberPronounsChange,
  memberPhone,
  onMemberPhoneChange,
  memberLocation,
  onMemberLocationChange,
  memberActive,
  onMemberActiveChange,
  memberMonthlyRole,
  onMemberMonthlyRoleChange,
  memberCapacityPerWeek,
  onMemberCapacityPerWeekChange,
  memberVacationDays,
  onMemberVacationDaysChange,
  memberNotes,
  onMemberNotesChange,
  onSubmit,
}: MemberFormPanelProps) {
  const [customPronoun, setCustomPronoun] = useState("");

  function togglePronoun(value: string) {
    if (memberPronouns.includes(value)) {
      onMemberPronounsChange(memberPronouns.filter((item) => item !== value));
      return;
    }
    onMemberPronounsChange([...memberPronouns, value]);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add member</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <div className="grid gap-2">
              <Label htmlFor="memberName">Name</Label>
              <Input
                id="memberName"
                placeholder="Full name"
                value={memberName}
                onChange={(event) => onMemberNameChange(event.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="memberEmail">Email</Label>
              <Input
                id="memberEmail"
                placeholder="name@example.com"
                type="email"
                value={memberEmail}
                onChange={(event) => onMemberEmailChange(event.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="memberCategory">Category</Label>
              <select
                id="memberCategory"
                className={inputClassName}
                value={memberCategory}
                onChange={(event) =>
                  onMemberCategoryChange(event.target.value as MemberCategory)
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
              <Label htmlFor="memberMonthlyRole">Monthly role</Label>
              <select
                id="memberMonthlyRole"
                className={inputClassName}
                value={memberMonthlyRole}
                onChange={(event) =>
                  onMemberMonthlyRoleChange(
                    event.target.value as MemberMonthlyRole,
                  )
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
              <Label htmlFor="memberPhone">Phone</Label>
              <Input
                id="memberPhone"
                placeholder="+1 (555) 000-0000"
                value={memberPhone}
                onChange={(event) => onMemberPhoneChange(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="memberLocation">Location</Label>
              <Input
                id="memberLocation"
                list="member-location-suggestions"
                placeholder="City, Country"
                value={memberLocation}
                onChange={(event) => onMemberLocationChange(event.target.value)}
              />
              <datalist id="member-location-suggestions">
                {locationSuggestions.map((location) => (
                  <option key={location} value={location} />
                ))}
              </datalist>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="memberCapacity">Capacity per week (hours)</Label>
              <Input
                id="memberCapacity"
                type="number"
                min={0}
                step={0.5}
                placeholder="30"
                value={memberCapacityPerWeek}
                onChange={(event) =>
                  onMemberCapacityPerWeekChange(Number(event.target.value) || 0)
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="memberVacation">Vacation days</Label>
              <Input
                id="memberVacation"
                type="number"
                min={0}
                step={0.5}
                placeholder="0"
                value={memberVacationDays}
                onChange={(event) =>
                  onMemberVacationDaysChange(Number(event.target.value) || 0)
                }
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Pronouns</Label>
            <div className="flex flex-wrap gap-2">
              {pronounOptions.map((option) => {
                const selected = memberPronouns.includes(option);
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
                    onClick={() => togglePronoun(option)}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add custom pronoun"
                value={customPronoun}
                onChange={(event) => setCustomPronoun(event.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const value = customPronoun.trim();
                  if (!value || memberPronouns.includes(value)) {
                    return;
                  }
                  onMemberPronounsChange([...memberPronouns, value]);
                  setCustomPronoun("");
                }}
              >
                Add
              </Button>
            </div>
          </div>

          <Label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={memberActive}
              onChange={(event) => onMemberActiveChange(event.target.checked)}
            />
            Active this month
          </Label>

          <div className="grid gap-2">
            <Label htmlFor="memberNotes">Notes</Label>
            <Textarea
              id="memberNotes"
              rows={2}
              placeholder="Any additional notes about this member..."
              value={memberNotes}
              onChange={(event) => onMemberNotesChange(event.target.value)}
            />
          </div>

          <Button type="submit" className="w-fit">
            Save member
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
