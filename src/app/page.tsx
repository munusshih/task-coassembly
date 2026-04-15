"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/common/app-header";
import { PasswordGateCard } from "@/components/common/password-gate-card";
import { Button, buttonBaseClass } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { KanbanPanel } from "@/components/workspace/kanban-panel";
import { MemberTaskBoards } from "@/components/workspace/member-task-boards";
import { NotesPanel } from "@/components/workspace/notes-panel";
import { WorkspaceToolbar } from "@/components/workspace/workspace-toolbar";
import {
  grantWorkspaceAccess,
  hasWorkspaceAccess,
  rememberPasswordCredential,
  revokeWorkspaceAccess,
  SHARED_PASSWORD,
} from "@/lib/access";
import { firebaseReady } from "@/lib/firebase";
import {
  buildMeetingNotePath,
  syncMeetingNoteMarkdown,
} from "@/lib/meeting-note-sync";
import {
  createCard,
  createNote,
  createTask,
  deleteTask,
  subscribeKanban,
  subscribeMembers,
  subscribeNotes,
  subscribeProjects,
  subscribeTasks,
  updateCard,
  updateNote,
  updateTask,
} from "@/lib/firestore";
import {
  KanbanCard,
  KanbanColumn,
  MeetingNote,
  Member,
  Project,
  Task,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const KANBAN_COLUMNS: KanbanColumn[] = [
  "backlog",
  "inProgress",
  "review",
  "done",
];

function roleName(id: string | undefined, members: Member[]): string {
  if (!id) {
    return "Unassigned";
  }
  return members.find((member) => member.id === id)?.name ?? "Unknown";
}

export default function Home() {
  const [authReady, setAuthReady] = useState(() => !firebaseReady);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [members, setMembers] = useState<Member[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [notes, setNotes] = useState<MeetingNote[]>([]);

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [workspaceView, setWorkspaceView] = useState<"project" | "notes">(
    "notes",
  );

  const [cardTitle, setCardTitle] = useState("");
  const [cardDescription, setCardDescription] = useState("");
  const [cardColumn, setCardColumn] = useState<KanbanColumn>("backlog");
  const [cardOwnerId, setCardOwnerId] = useState("");

  useEffect(() => {
    if (!firebaseReady) {
      return;
    }
    setIsUnlocked(hasWorkspaceAccess());
    setAuthReady(true);
  }, []);

  useEffect(() => {
    if (!isUnlocked) {
      return;
    }

    const unsubMembers = subscribeMembers(setMembers);
    const unsubProjects = subscribeProjects(setProjects);
    const unsubTasks = subscribeTasks(setTasks);
    const unsubCards = subscribeKanban(setCards);
    const unsubNotes = subscribeNotes(setNotes);

    return () => {
      unsubMembers();
      unsubProjects();
      unsubTasks();
      unsubCards();
      unsubNotes();
    };
  }, [isUnlocked]);

  const resolvedProjectId = selectedProjectId || projects[0]?.id || "";
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === resolvedProjectId),
    [projects, resolvedProjectId],
  );

  const projectCards = useMemo(
    () => cards.filter((card) => card.projectId === resolvedProjectId),
    [cards, resolvedProjectId],
  );

  const projectNotes = useMemo(
    () => notes.filter((note) => note.projectId === resolvedProjectId),
    [notes, resolvedProjectId],
  );

  function onUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");

    const enteredPassword = password.trim();
    if (enteredPassword !== SHARED_PASSWORD) {
      setAuthError("Incorrect dashboard password.");
      return;
    }

    void rememberPasswordCredential(
      "dashboard@coassembly.local",
      enteredPassword,
    );
    grantWorkspaceAccess();
    setIsUnlocked(true);
    setPassword("");
  }

  async function addTask(payload: Omit<Task, "id" | "createdAt">) {
    await createTask({
      ...payload,
      createdAt: Date.now(),
    });
  }

  async function addCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resolvedProjectId || !cardTitle.trim()) {
      return;
    }

    await createCard({
      projectId: resolvedProjectId,
      title: cardTitle.trim(),
      description: cardDescription.trim(),
      column: cardColumn,
      ownerId: cardOwnerId || undefined,
      createdAt: Date.now(),
    });
    setCardTitle("");
    setCardDescription("");
    setCardOwnerId("");
  }

  async function createMeetingNote(
    payload: Omit<MeetingNote, "id" | "createdAt">,
  ): Promise<string> {
    const normalizedPayload = {
      ...payload,
      title: payload.title.trim() || "Meeting notes",
      localPath:
        payload.localPath ||
        buildMeetingNotePath(
          selectedProject?.name || "workspace",
          payload.meetingDate,
          payload.title,
        ),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const noteId = await createNote(normalizedPayload);
    await syncMeetingNoteMarkdown(
      normalizedPayload,
      selectedProject?.name || "workspace",
    ).catch(() => {
      // Local markdown sync is best-effort when the app runs in non-persistent environments.
    });
    return noteId;
  }

  async function updateMeetingNote(
    id: string,
    payload: Partial<Omit<MeetingNote, "id">>,
  ) {
    const existingNote = notes.find((note) => note.id === id);
    if (!existingNote) {
      return;
    }

    const mergedNote = {
      ...existingNote,
      ...payload,
      title:
        String(payload.title ?? existingNote.title).trim() || "Meeting notes",
      updatedAt: Date.now(),
    };

    await updateNote(id, mergedNote);
    await syncMeetingNoteMarkdown(
      mergedNote,
      selectedProject?.name || "workspace",
    ).catch(() => {
      // Local markdown sync is best-effort when the app runs in non-persistent environments.
    });
  }

  if (!authReady) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-6">
        Loading CoAssembly...
      </main>
    );
  }

  if (!firebaseReady) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-6">
        <Card className="mx-auto mt-16 w-full max-w-md">
          <CardHeader>
            <CardTitle>Firebase configuration needed</CardTitle>
            <CardDescription>
              Add all NEXT_PUBLIC_FIREBASE_* variables to run CoAssembly locally
              or on Vercel.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (!isUnlocked) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-6">
        <PasswordGateCard
          kicker="CoAssembly"
          title="Designer Cooperative Workspace"
          description="Enter the dashboard password to access tasks, project to-dos, and meeting notes."
          credentialId="dashboard@coassembly.local"
          password={password}
          error={authError}
          placeholder="Dashboard password"
          submitLabel="Enter dashboard"
          onPasswordChange={setPassword}
          onSubmit={onUnlock}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto grid w-full max-w-7xl gap-6">
        <AppHeader
          kicker="CoAssembly"
          title="Shared workspace"
          description="Personal tasks stay primary. Project to-dos and meeting notes stay focused in one secondary workspace pane."
          actions={
            <>
              <Link
                className={cn(
                  buttonBaseClass,
                  "h-10 border border-slate-200 bg-white px-4 py-2 text-slate-900 hover:bg-slate-50",
                )}
                href="/admin"
              >
                Admin Control
              </Link>
              <Button
                type="button"
                onClick={() => {
                  revokeWorkspaceAccess();
                  setIsUnlocked(false);
                }}
              >
                Log out
              </Button>
            </>
          }
        />

        <WorkspaceToolbar
          projects={projects}
          selectedProjectId={resolvedProjectId}
          setSelectedProjectId={setSelectedProjectId}
          workspaceView={workspaceView}
          setWorkspaceView={setWorkspaceView}
        />

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.95fr)] xl:items-start">
          <MemberTaskBoards
            members={members}
            projects={projects}
            tasks={tasks}
            onCreateTask={addTask}
            onUpdateTask={async (id, payload) => {
              await updateTask(id, payload);
            }}
            onDeleteTask={async (id) => {
              await deleteTask(id);
            }}
          />

          <section className="grid gap-5 xl:sticky xl:top-6">
            {selectedProject ? (
              workspaceView === "project" ? (
                <KanbanPanel
                  selectedProject={selectedProject}
                  members={members}
                  columns={KANBAN_COLUMNS}
                  cardTitle={cardTitle}
                  onCardTitleChange={setCardTitle}
                  cardDescription={cardDescription}
                  onCardDescriptionChange={setCardDescription}
                  cardColumn={cardColumn}
                  onCardColumnChange={setCardColumn}
                  cardOwnerId={cardOwnerId}
                  onCardOwnerChange={setCardOwnerId}
                  projectCards={projectCards}
                  onSubmitCard={addCard}
                  onUpdateCard={(cardId, payload) => {
                    void updateCard(cardId, payload);
                  }}
                  onSendToTaskBoard={(card) => {
                    if (!card.ownerId) {
                      return;
                    }
                    void addTask({
                      title: card.title,
                      boardOwnerId: card.ownerId,
                      projectId: selectedProject.id,
                      deadline: undefined,
                      billable: true,
                      workstream: "client",
                      status: "todo",
                      estimateHours: 1,
                      archived: false,
                    });
                  }}
                  roleName={roleName}
                />
              ) : (
                <NotesPanel
                  selectedProject={selectedProject}
                  projectNotes={projectNotes}
                  onCreateNote={createMeetingNote}
                  onUpdateNote={updateMeetingNote}
                />
              )
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-8 text-sm text-slate-500">
                Add a project in Admin Control to start using the project
                workspace.
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
