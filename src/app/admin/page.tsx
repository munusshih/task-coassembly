"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState, useSyncExternalStore } from "react";
import { FolderCog, Radio } from "lucide-react";
import { AdminWorkspace } from "@/components/admin/admin-workspace";
import { AppHeader } from "@/components/common/app-header";
import { PasswordGateCard } from "@/components/common/password-gate-card";
import { ViewerPresence } from "@/components/common/viewer-presence";
import { Button } from "@/components/ui/button";
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
import { firebaseReady } from "@/lib/firebase";
import {
  createMember,
  createProject,
  deleteMember,
  deleteProject,
  subscribeMembers,
  subscribeProjects,
  updateMember,
  updateProject,
} from "@/lib/firestore";
import { Member, Project } from "@/lib/types";
import { useViewerPresence } from "@/lib/use-viewer-presence";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [accessError, setAccessError] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const { presenceAvailable, viewerCount, viewerSeeds } =
    useViewerPresence("admin");

  const isUnlocked = useSyncExternalStore(
    subscribeAdminAccess,
    hasAdminAccess,
    () => false,
  );

  useEffect(() => {
    if (!isUnlocked) {
      return;
    }

    const unsubscribeMembers = subscribeMembers(setMembers);
    const unsubscribeProjects = subscribeProjects(setProjects);

    return () => {
      unsubscribeMembers();
      unsubscribeProjects();
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

  if (!firebaseReady) {
    return (
      <main className="app-page">
        <Card className="auth-gate">
          <CardHeader>
            <CardTitle>Firebase configuration needed</CardTitle>
            <CardDescription>
              Add all `NEXT_PUBLIC_FIREBASE_*` variables before using the
              backend.
            </CardDescription>
          </CardHeader>
          <div className="card__actions">
            <Link className="btn btn--primary" href="/">
              Back to workspace
            </Link>
          </div>
        </Card>
      </main>
    );
  }

  if (!isUnlocked) {
    return (
      <main className="app-page">
        <PasswordGateCard
          title="Admin Control"
          description="Enter the admin password to manage members and projects."
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
    <main className="app-page">
      <div className="app-container">
        <AppHeader
          kicker="CoAssembly"
          title="Admin Control"
          description="Manage the people and projects behind the workspace from one coherent control panel."
          meta={
            <>
              <span className="swiss-tag inline-flex items-center gap-2 text-slate-700">
                <Radio className="h-4 w-4" />
                Live Firestore sync
              </span>
              {presenceAvailable ? (
                <ViewerPresence
                  count={viewerCount}
                  seeds={viewerSeeds}
                  label="viewing admin"
                />
              ) : null}
              <span className="swiss-tag inline-flex items-center gap-2 text-slate-700">
                <FolderCog className="h-4 w-4 text-slate-400" />
                {members.length} members · {projects.length} projects
              </span>
            </>
          }
          actions={
            <>
              <Link className="btn btn--outline" href="/">
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

        <AdminWorkspace
          members={members}
          projects={projects}
          onCreateMember={createMember}
          onUpdateMember={updateMember}
          onDeleteMember={deleteMember}
          onCreateProject={createProject}
          onUpdateProject={updateProject}
          onDeleteProject={deleteProject}
        />
      </div>
    </main>
  );
}
