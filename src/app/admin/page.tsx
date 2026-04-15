"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState, useSyncExternalStore } from "react";
import { MemberDirectoryPanel } from "@/components/admin/member-directory-panel";
import { MemberFormPanel } from "@/components/admin/member-form-panel";
import { ProjectSummaryPanel } from "@/components/admin/project-summary-panel";
import { AppHeader } from "@/components/common/app-header";
import { PasswordGateCard } from "@/components/common/password-gate-card";
import { Button, buttonBaseClass } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ADMIN_PASSWORD,
  grantAdminAccess,
  hasAdminAccess,
  rememberPasswordCredential,
  revokeAdminAccess,
  subscribeAdminAccess,
} from "@/lib/access";
import { cn } from "@/lib/utils";
import { firebaseReady } from "@/lib/firebase";
import {
  createMember,
  deleteMember,
  deleteProject,
  createProject,
  subscribeMembers,
  subscribeProjects,
  updateMember,
  updateProject,
} from "@/lib/firestore";
import {
  Member,
  Project,
} from "@/lib/types";

function createEmptyMemberDraft(): Omit<Member, "id"> {
  return {
    name: "",
    email: "",
    role: "",
    pronouns: [],
    phone: "",
    location: "",
    category: "member",
    active: true,
    monthlyRole: "none",
    status: "active",
    workerOwner: false,
    capacityPerWeek: 0,
    vacationDays: 0,
    notes: "",
  };
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [accessError, setAccessError] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [newMember, setNewMember] = useState<Omit<Member, "id">>(() =>
    createEmptyMemberDraft(),
  );
  const isUnlocked = useSyncExternalStore(
    subscribeAdminAccess,
    hasAdminAccess,
    () => false,
  );

  useEffect(() => {
    if (!isUnlocked) {
      return;
    }
    const unsubMembers = subscribeMembers(setMembers);
    const unsubProjects = subscribeProjects(setProjects);
    return () => {
      unsubMembers();
      unsubProjects();
    };
  }, [isUnlocked]);


  function onUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAccessError("");
    const enteredPassword = password.trim();
    if (enteredPassword !== ADMIN_PASSWORD) {
      setAccessError("Incorrect admin password.");
      return;
    }
    void rememberPasswordCredential("admin@coassembly.local", enteredPassword);
    grantAdminAccess();
    setPassword("");
  }

  async function handleCreateMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const monthlyRole = newMember.monthlyRole || "none";
    const active = Boolean(newMember.active);

    await createMember({
      ...newMember,
      name: newMember.name.trim(),
      email: newMember.email.trim(),
      role: monthlyRole !== "none" ? monthlyRole : "",
      pronouns: newMember.pronouns ?? [],
      phone: String(newMember.phone || "").trim(),
      location: String(newMember.location || "").trim(),
      workerOwner: newMember.category === "workerOwner",
      active,
      status: active ? "active" : "inactive",
      capacityPerWeek: Number(newMember.capacityPerWeek) || 0,
      vacationDays: Number(newMember.vacationDays) || 0,
      notes: String(newMember.notes || "").trim(),
    });

    setNewMember(createEmptyMemberDraft());
  }

  if (!firebaseReady) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-6">
        <Card className="mx-auto mt-16 w-full max-w-md">
          <CardHeader>
            <CardTitle>Firebase configuration needed</CardTitle>
            <CardDescription>
              Add all NEXT_PUBLIC_FIREBASE_* variables before using the backend.
            </CardDescription>
          </CardHeader>
          <div className="p-6 pt-0">
            <Link
              className={cn(
                buttonBaseClass,
                "h-10 bg-slate-900 px-4 py-2 text-white hover:bg-slate-800",
              )}
              href="/"
            >
              Back to workspace
            </Link>
          </div>
        </Card>
      </main>
    );
  }

  if (!isUnlocked) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-6">
        <PasswordGateCard
          title="Admin Control"
          description="Enter the admin password to add or remove system data."
          credentialId="admin@coassembly.local"
          password={password}
          error={accessError}
          placeholder="Admin password"
          submitLabel="Enter admin control"
          onPasswordChange={setPassword}
          onSubmit={onUnlock}
          backHref="/"
          backLabel="Back to dashboard"
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 md:px-6">
      <div className="mx-auto grid w-full max-w-5xl gap-6">
        <AppHeader
          kicker="CoAssembly"
          title="Admin Control"
          description="Manage members and projects."
          actions={
            <>
              <Link
                className={cn(
                  buttonBaseClass,
                  "h-10 border border-slate-200 bg-white px-4 py-2 text-slate-900 hover:bg-slate-50",
                )}
                href="/"
              >
                Back to dashboard
              </Link>
              <Button
                type="button"
                onClick={() => {
                  revokeAdminAccess();
                }}
              >
                Log out
              </Button>
            </>
          }
        />

        <div className="grid gap-6">
          <MemberFormPanel
            memberName={newMember.name}
            onMemberNameChange={(value) =>
              setNewMember((current) => ({ ...current, name: value }))
            }
            memberEmail={newMember.email}
            onMemberEmailChange={(value) =>
              setNewMember((current) => ({ ...current, email: value }))
            }
            memberCategory={newMember.category}
            onMemberCategoryChange={(value) =>
              setNewMember((current) => ({
                ...current,
                category: value,
                workerOwner: value === "workerOwner",
              }))
            }
            memberPronouns={newMember.pronouns ?? []}
            onMemberPronounsChange={(value) =>
              setNewMember((current) => ({ ...current, pronouns: value }))
            }
            memberPhone={newMember.phone || ""}
            onMemberPhoneChange={(value) =>
              setNewMember((current) => ({ ...current, phone: value }))
            }
            memberLocation={newMember.location || ""}
            onMemberLocationChange={(value) =>
              setNewMember((current) => ({ ...current, location: value }))
            }
            memberActive={newMember.active}
            onMemberActiveChange={(value) =>
              setNewMember((current) => ({
                ...current,
                active: value,
                status: value ? "active" : "inactive",
              }))
            }
            memberMonthlyRole={newMember.monthlyRole || "none"}
            onMemberMonthlyRoleChange={(value) =>
              setNewMember((current) => ({
                ...current,
                monthlyRole: value,
                role: value === "none" ? "" : value,
              }))
            }
            memberCapacityPerWeek={newMember.capacityPerWeek ?? 0}
            onMemberCapacityPerWeekChange={(value) =>
              setNewMember((current) => ({
                ...current,
                capacityPerWeek: value,
              }))
            }
            memberVacationDays={newMember.vacationDays ?? 0}
            onMemberVacationDaysChange={(value) =>
              setNewMember((current) => ({
                ...current,
                vacationDays: value,
              }))
            }
            memberNotes={newMember.notes || ""}
            onMemberNotesChange={(value) =>
              setNewMember((current) => ({ ...current, notes: value }))
            }
            onSubmit={(event) => {
              void handleCreateMember(event);
            }}
          />

          <MemberDirectoryPanel
            members={members}
            onUpdateMember={updateMember}
            onDeleteMember={deleteMember}
          />

          <ProjectSummaryPanel
            projects={projects}
            onUpdate={async (project, updates) => {
              await updateProject(project.id, updates);
            }}
            onDelete={(p) => void deleteProject(p.id)}
            onAddNew={() =>
              void createProject({
                name: "New Project",
                purpose: "Define project purpose",
                description: "",
                stage: "discovery",
                priority: "medium",
                collaboratorCount: 1,
                createdAt: Date.now(),
              })
            }
          />
        </div>

      </div>
    </main>
  );
}
