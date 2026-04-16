"use client";

import Link from "next/link";
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Activity,
  Coins,
  FileText,
  FolderOpen,
  Radio,
  Users,
} from "lucide-react";
import { AppHeader } from "@/components/common/app-header";
import { PasswordGateCard } from "@/components/common/password-gate-card";
import { ViewerPresence } from "@/components/common/viewer-presence";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
  subscribeWorkspaceAccess,
} from "@/lib/access";
import { firebaseReady } from "@/lib/firebase";
import {
  buildMeetingNotePath,
  deleteMeetingNoteMarkdown,
  syncMeetingNoteMarkdown,
} from "@/lib/meeting-note-sync";
import {
  createCard,
  createNote,
  createTask,
  deleteNote,
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
import { useViewerPresence } from "@/lib/use-viewer-presence";
import { cn, formatMoney, getBudgetSnapshot } from "@/lib/utils";

const KANBAN_COLUMNS: KanbanColumn[] = [
  "backlog",
  "inProgress",
  "review",
  "done",
];

const KANBAN_DRAFTS_STORAGE_KEY = "coassembly:kanban-drafts";

interface KanbanDraft {
  title: string;
  description: string;
  column: KanbanColumn;
  ownerId: string;
}

function defaultKanbanDraft(): KanbanDraft {
  return {
    title: "",
    description: "",
    column: "backlog",
    ownerId: "",
  };
}

function readStoredKanbanDrafts(): Record<string, KanbanDraft> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(KANBAN_DRAFTS_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as Record<string, Partial<KanbanDraft>>;
    return Object.fromEntries(
      Object.entries(parsed).map(([projectId, draft]) => [
        projectId,
        {
          ...defaultKanbanDraft(),
          title: String(draft.title || ""),
          description: String(draft.description || ""),
          column:
            draft.column === "inProgress" ||
            draft.column === "review" ||
            draft.column === "done"
              ? draft.column
              : "backlog",
          ownerId: String(draft.ownerId || ""),
        },
      ]),
    );
  } catch {
    return {};
  }
}

function subscribeNoop() {
  return () => undefined;
}

function roleName(id: string | undefined, members: Member[]): string {
  if (!id) {
    return "Unassigned";
  }
  return members.find((member) => member.id === id)?.name ?? "Unknown";
}

export default function Home() {
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

  const [kanbanDrafts, setKanbanDrafts] = useState<Record<string, KanbanDraft>>(
    () => readStoredKanbanDrafts(),
  );

  const isUnlocked = useSyncExternalStore(
    subscribeWorkspaceAccess,
    hasWorkspaceAccess,
    () => false,
  );

  const browserReady = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => !firebaseReady,
  );

  const { presenceAvailable, viewerCount, viewerSeeds } =
    useViewerPresence("workspace");

  useEffect(() => {
    if (!isUnlocked) {
      return;
    }

    const unsubscribeMembers = subscribeMembers(setMembers);
    const unsubscribeProjects = subscribeProjects(setProjects);
    const unsubscribeTasks = subscribeTasks(setTasks);
    const unsubscribeCards = subscribeKanban(setCards);
    const unsubscribeNotes = subscribeNotes(setNotes);

    return () => {
      unsubscribeMembers();
      unsubscribeProjects();
      unsubscribeTasks();
      unsubscribeCards();
      unsubscribeNotes();
    };
  }, [isUnlocked]);

  const resolvedProjectId = projects.some(
    (project) => project.id === selectedProjectId,
  )
    ? selectedProjectId
    : "";
  const currentKanbanDraft = resolvedProjectId
    ? kanbanDrafts[resolvedProjectId] || defaultKanbanDraft()
    : defaultKanbanDraft();

  function updateKanbanDraft(patch: Partial<KanbanDraft>) {
    if (!resolvedProjectId) {
      return;
    }

    setKanbanDrafts((current) => ({
      ...current,
      [resolvedProjectId]: {
        ...(current[resolvedProjectId] || defaultKanbanDraft()),
        ...patch,
      },
    }));
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      KANBAN_DRAFTS_STORAGE_KEY,
      JSON.stringify(kanbanDrafts),
    );
  }, [kanbanDrafts]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === resolvedProjectId),
    [projects, resolvedProjectId],
  );

  const projectCards = useMemo(
    () =>
      selectedProject
        ? cards.filter((card) => card.projectId === selectedProject.id)
        : [],
    [cards, selectedProject],
  );

  const projectNotes = useMemo(
    () =>
      selectedProject
        ? notes.filter((note) => note.projectId === selectedProject.id)
        : [],
    [notes, selectedProject],
  );
  const selectedProjectStaffedCount = selectedProject
    ? new Set(
        (selectedProject.staffing || [])
          .filter((assignment) => assignment.memberId)
          .map((assignment) => assignment.memberId),
      ).size ||
      selectedProject.collaboratorCount ||
      0
    : 0;
  const selectedProjectBudget = getBudgetSnapshot(selectedProject);
  const selectedProjectHourlyRateTwd = selectedProject?.maxBillableHours
    ? selectedProjectBudget.budgetTwd / Number(selectedProject.maxBillableHours)
    : 0;
  const selectedProjectHourlyRateUsd = selectedProject?.maxBillableHours
    ? selectedProjectBudget.budgetUsd / Number(selectedProject.maxBillableHours)
    : 0;
  const activeTaskCount = tasks.filter(
    (task) => task.status !== "done" && !task.archived,
  ).length;

  async function addTask(payload: Omit<Task, "id" | "createdAt">) {
    await createTask({
      ...payload,
      createdAt: Date.now(),
    });
  }

  async function addCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProject || !currentKanbanDraft.title.trim()) {
      return;
    }

    await createCard({
      projectId: selectedProject.id,
      title: currentKanbanDraft.title.trim(),
      description: currentKanbanDraft.description.trim(),
      column: currentKanbanDraft.column,
      ownerId: currentKanbanDraft.ownerId || undefined,
      createdAt: Date.now(),
    });
    setKanbanDrafts((current) => {
      const nextDrafts = { ...current };
      delete nextDrafts[selectedProject.id];
      return nextDrafts;
    });
  }

  async function createMeetingNote(
    payload: Omit<MeetingNote, "id" | "createdAt">,
  ): Promise<string> {
    if (!selectedProject) {
      throw new Error("Select a project before creating notes.");
    }

    const normalizedPayload = {
      ...payload,
      title: payload.title.trim() || "Meeting notes",
      localPath:
        payload.localPath ||
        buildMeetingNotePath(
          selectedProject.name || "workspace",
          payload.meetingDate,
          payload.title,
        ),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const noteId = await createNote(normalizedPayload);

    await syncMeetingNoteMarkdown(
      normalizedPayload,
      selectedProject.name,
    ).catch(() => {
      // Initial local sync is best-effort; Firebase remains the source of truth.
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
    );
  }

  async function deleteMeetingNote(id: string) {
    const existingNote = notes.find((note) => note.id === id);
    if (!existingNote) {
      return;
    }

    await deleteNote(id);

    if (existingNote.localPath) {
      await deleteMeetingNoteMarkdown(existingNote.localPath).catch(() => {
        // Firestore remains the source of truth if the local mirror cannot be removed.
      });
    }
  }

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
    setPassword("");
  }

  if (!browserReady) {
    return <main className="app-page">Loading CoAssembly...</main>;
  }

  if (!firebaseReady) {
    return (
      <main className="app-page">
        <Card className="auth-gate">
          <CardHeader>
            <CardTitle>Firebase configuration needed</CardTitle>
            <CardDescription>
              Add all `NEXT_PUBLIC_FIREBASE_*` variables to run CoAssembly
              locally or on Vercel.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (!isUnlocked) {
    return (
      <main className="app-page">
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
    <main className="app-page">
      <div className="app-container swiss-shell">
        <AppHeader
          kicker="CoAssembly"
          title="Shared workspace"
          description="Tasks, project to-dos, and meeting notes stay in sync through Firebase with one shared operating surface."
          meta={
            <>
              <span className="swiss-tag">
                <Radio className="icon-xs" />
                Live Firestore sync
              </span>
              {presenceAvailable ? (
                <ViewerPresence
                  count={viewerCount}
                  seeds={viewerSeeds}
                  label="viewing workspace"
                />
              ) : null}
              <span className="swiss-tag">
                <FolderOpen className="icon-xs" />
                {projects.length}{" "}
                {projects.length === 1 ? "project" : "projects"}
              </span>
            </>
          }
          actions={
            <>
              <Link className="btn btn--outline" href="/admin">
                Admin Control
              </Link>
              <Button
                type="button"
                onClick={() => {
                  revokeWorkspaceAccess();
                }}
              >
                Log out
              </Button>
            </>
          }
        />

        <WorkspaceToolbar
          projects={projects}
          selectedProject={selectedProject}
          selectedProjectId={resolvedProjectId}
          setSelectedProjectId={setSelectedProjectId}
          workspaceView={workspaceView}
          setWorkspaceView={setWorkspaceView}
        />

        {selectedProject ? (
          <div className="ws-metrics">
            <Card className="metric-card">
              <CardContent className="card__content--row">
                <div>
                  <p className="t-label">Active tasks</p>
                  <p className="metric__value">{activeTaskCount}</p>
                  <p className="metric__desc">
                    Across all member boards right now
                  </p>
                </div>
                <div className="card__icon">
                  <Users className="icon-sm" />
                </div>
              </CardContent>
            </Card>
            <Card className="metric-card">
              <CardContent className="card__content--row">
                <div>
                  <p className="t-label">Selected project</p>
                  <p className="metric__value">
                    {selectedProjectStaffedCount} staffed
                  </p>
                  <p className="metric__desc">
                    {selectedProject.clientName ||
                      "Internal or self-run project"}
                  </p>
                </div>
                <div className="card__icon">
                  <FolderOpen className="icon-sm" />
                </div>
              </CardContent>
            </Card>
            <Card className="metric-card">
              <CardContent className="card__content--row">
                <div>
                  <p className="t-label">Live project details</p>
                  <p className="metric__value">
                    {selectedProjectHourlyRateTwd
                      ? `${formatMoney(selectedProjectHourlyRateTwd, "TWD")}/hr`
                      : `${projectNotes.length} notes`}
                  </p>
                  <p className="metric__desc">
                    {selectedProjectHourlyRateTwd
                      ? `${formatMoney(selectedProjectHourlyRateUsd, "USD")}/hr · ${projectCards.length} to-dos · ${projectNotes.length} meeting notes`
                      : "Add budget and billable hours to model rate"}
                  </p>
                </div>
                <div className="card__icon">
                  {selectedProjectHourlyRateTwd ? (
                    <Coins className="icon-sm" />
                  ) : (
                    <FileText className="icon-sm" />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        <div className="ws-main">
          <section>
            {selectedProject ? (
              workspaceView === "project" ? (
                <KanbanPanel
                  selectedProject={selectedProject}
                  members={members}
                  columns={KANBAN_COLUMNS}
                  cardTitle={currentKanbanDraft.title}
                  onCardTitleChange={(value) =>
                    updateKanbanDraft({ title: value })
                  }
                  cardDescription={currentKanbanDraft.description}
                  onCardDescriptionChange={(value) =>
                    updateKanbanDraft({ description: value })
                  }
                  cardColumn={currentKanbanDraft.column}
                  onCardColumnChange={(value) =>
                    updateKanbanDraft({ column: value })
                  }
                  cardOwnerId={currentKanbanDraft.ownerId}
                  onCardOwnerChange={(value) =>
                    updateKanbanDraft({ ownerId: value })
                  }
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
                  onDeleteNote={deleteMeetingNote}
                />
              )
            ) : (
              <Card>
                <CardHeader>
                  <div className="card__icon-block">
                    <Activity className="icon-sm" />
                  </div>
                  <CardTitle>
                    {projects.length
                      ? "Select a project to continue"
                      : "Add a project to start the workspace"}
                  </CardTitle>
                  <CardDescription>
                    {projects.length
                      ? "Choose a project from the toolbar above to open project to-dos or meeting notes."
                      : "The workspace is connected to Firebase, but it needs at least one project record before project tools can be used."}
                  </CardDescription>
                </CardHeader>
                <div className="card__actions">
                  {projects.length ? (
                    <span className="swiss-tag">
                      No project currently selected
                    </span>
                  ) : null}
                  <Link className="btn btn--outline" href="/admin">
                    Open Admin Control
                  </Link>
                </div>
              </Card>
            )}
          </section>

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
        </div>
      </div>
    </main>
  );
}
