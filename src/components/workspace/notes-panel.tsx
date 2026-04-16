"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, HardDriveDownload, Plus, Radio, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarkdownEditor } from "@/components/editor/markdown-editor";
import { MeetingNote, Project } from "@/lib/types";
import { buildMeetingNotePath } from "@/lib/meeting-note-sync";
import { cn } from "@/lib/utils"; // used for chip class composition

interface NoteDraft {
  title: string;
  meetingDate: string;
  content: string;
  localPath: string;
}

interface NotesPanelProps {
  selectedProject?: Project;
  projectNotes: MeetingNote[];
  onCreateNote: (
    payload: Omit<MeetingNote, "id" | "createdAt">,
  ) => Promise<string>;
  onUpdateNote: (
    id: string,
    payload: Partial<Omit<MeetingNote, "id">>,
  ) => Promise<void>;
  onDeleteNote: (id: string) => Promise<void>;
}

function createEmptyDraft(selectedProject?: Project): NoteDraft {
  const meetingDate = new Date().toISOString().slice(0, 10);
  const title = "Meeting notes";

  return {
    title,
    meetingDate,
    content:
      "<h1>Meeting notes</h1><h2>Agenda</h2><p></p><h2>Decisions</h2><p></p><h2>Next steps</h2><p></p>",
    localPath: buildMeetingNotePath(
      selectedProject?.name || "workspace",
      meetingDate,
      title,
    ),
  };
}

function buildDraftFromNote(
  note: MeetingNote,
  selectedProjectName: string,
): NoteDraft {
  return {
    title: note.title,
    meetingDate: note.meetingDate,
    content: note.content,
    localPath:
      note.localPath ||
      buildMeetingNotePath(selectedProjectName, note.meetingDate, note.title),
  };
}

export function NotesPanel({
  selectedProject,
  projectNotes,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
}: NotesPanelProps) {
  const sortedNotes = useMemo(
    () =>
      [...projectNotes].sort(
        (left, right) =>
          (right.updatedAt || right.createdAt) -
          (left.updatedAt || left.createdAt),
      ),
    [projectNotes],
  );

  const [activeNoteId, setActiveNoteId] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const resolvedActiveNoteId = sortedNotes.some(
    (note) => note.id === activeNoteId,
  )
    ? activeNoteId
    : sortedNotes[0]?.id || "";

  const activeNote = sortedNotes.find(
    (note) => note.id === resolvedActiveNoteId,
  );

  async function createNewNote() {
    if (!selectedProject) {
      return;
    }

    setIsCreating(true);

    try {
      const nextDraft = createEmptyDraft(selectedProject);
      const noteId = await onCreateNote({
        projectId: selectedProject.id,
        title: nextDraft.title,
        content: nextDraft.content,
        meetingDate: nextDraft.meetingDate,
        localPath: nextDraft.localPath,
        updatedAt: Date.now(),
      });
      setActiveNoteId(noteId);
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <section className="panel notes">
      <div className="notes__header">
        <div>
          <h2 className="t-h3">Meeting notes</h2>
          <p className="t-caption">
            One note at a time, full width, with live Firebase sync and local
            file mirroring.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            void createNewNote();
          }}
          disabled={!selectedProject || isCreating}
        >
          <Plus className="icon-sm" />
          {isCreating ? "Creating..." : "New note"}
        </Button>
      </div>

      {selectedProject ? (
        <div className="notes__context">
          Working inside <strong>{selectedProject.name}</strong>.
        </div>
      ) : (
        <div className="notes__context">
          Select a project before creating or editing meeting notes.
        </div>
      )}

      {sortedNotes.length ? (
        <div className="note-list">
          {sortedNotes.map((note) => {
            const isActive = resolvedActiveNoteId === note.id;
            return (
              <button
                key={note.id}
                type="button"
                className="note-card"
                data-active={isActive}
                onClick={() => setActiveNoteId(note.id)}
              >
                <p className="note-card__title">{note.title}</p>
                <p className="note-card__date">{note.meetingDate}</p>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="empty">
          {selectedProject
            ? "No notes yet. Create the first note for this project."
            : "Select a project to open or create notes."}
        </div>
      )}

      {activeNote ? (
        <NoteEditor
          key={activeNote.id}
          note={activeNote}
          selectedProjectName={selectedProject?.name || "workspace"}
          onUpdateNote={onUpdateNote}
          onDeleteNote={onDeleteNote}
        />
      ) : (
        <div className="empty empty--tall">
          {selectedProject
            ? "Choose a note above or create a new one."
            : "Select a project to start writing notes."}
        </div>
      )}
    </section>
  );
}

function NoteEditor({
  note,
  selectedProjectName,
  onUpdateNote,
  onDeleteNote,
}: {
  note: MeetingNote;
  selectedProjectName: string;
  onUpdateNote: (
    id: string,
    payload: Partial<Omit<MeetingNote, "id">>,
  ) => Promise<void>;
  onDeleteNote: (id: string) => Promise<void>;
}) {
  const initialDraft = buildDraftFromNote(note, selectedProjectName);
  const [draft, setDraft] = useState<NoteDraft>(initialDraft);
  const [firebaseState, setFirebaseState] = useState<
    "idle" | "saving" | "saved"
  >("idle");
  const [markdownState, setMarkdownState] = useState<"ready" | "error">(
    "ready",
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const lastPersistedRef = useRef(JSON.stringify(initialDraft));

  useEffect(() => {
    const nextDraft = buildDraftFromNote(note, selectedProjectName);
    setDraft(nextDraft);
    lastPersistedRef.current = JSON.stringify(nextDraft);
    setFirebaseState("idle");
    setMarkdownState("ready");
  }, [note, selectedProjectName]);

  function updateDraft(nextDraft: NoteDraft) {
    setDraft(nextDraft);
    setFirebaseState("saving");
  }

  async function handleDelete() {
    if (!window.confirm(`Delete ${draft.title || "this note"}?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDeleteNote(note.id);
    } finally {
      setIsDeleting(false);
    }
  }

  useEffect(() => {
    const normalizedDraft = {
      title: draft.title.trim() || "Meeting notes",
      meetingDate: draft.meetingDate,
      content: draft.content,
      localPath:
        draft.localPath ||
        buildMeetingNotePath(
          selectedProjectName,
          draft.meetingDate,
          draft.title,
        ),
    };
    const snapshot = JSON.stringify(normalizedDraft);

    if (snapshot === lastPersistedRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      void onUpdateNote(note.id, {
        title: normalizedDraft.title,
        meetingDate: normalizedDraft.meetingDate,
        content: normalizedDraft.content,
        localPath: normalizedDraft.localPath,
        updatedAt: Date.now(),
      })
        .then(() => {
          lastPersistedRef.current = snapshot;
          setFirebaseState("saved");
          setMarkdownState("ready");
        })
        .catch(() => {
          lastPersistedRef.current = snapshot;
          setFirebaseState("saved");
          setMarkdownState("error");
        });
    }, 500);

    return () => window.clearTimeout(timer);
  }, [draft, note.id, onUpdateNote, selectedProjectName]);

  return (
    <div className="note-editor">
      <div className="note-form">
        <div className="note-form__fields">
          <div className="field">
            <Label htmlFor="meeting-note-title">Title</Label>
            <Input
              id="meeting-note-title"
              value={draft.title}
              onChange={(event) =>
                updateDraft({
                  ...draft,
                  title: event.target.value,
                  localPath: buildMeetingNotePath(
                    selectedProjectName,
                    draft.meetingDate,
                    event.target.value,
                  ),
                })
              }
            />
          </div>
          <div className="field">
            <Label htmlFor="meeting-note-date">Date</Label>
            <Input
              id="meeting-note-date"
              type="date"
              value={draft.meetingDate}
              onChange={(event) =>
                updateDraft({
                  ...draft,
                  meetingDate: event.target.value,
                  localPath: buildMeetingNotePath(
                    selectedProjectName,
                    event.target.value,
                    draft.title,
                  ),
                })
              }
            />
          </div>
          <div className="field">
            <Label>&nbsp;</Label>
            <Button
              type="button"
              variant="ghost"
              className="btn--danger"
              onClick={() => {
                void handleDelete();
              }}
              disabled={isDeleting}
            >
              <Trash2 className="icon-sm" />
              {isDeleting ? "Deleting..." : "Delete note"}
            </Button>
          </div>
        </div>

        <div className="note-form__status">
          <span
            className={cn(
              "chip",
              firebaseState === "saving" ? "chip--saving" : "chip--synced",
            )}
          >
            {firebaseState === "saved" ? (
              <Check className="icon-xs" />
            ) : (
              <Radio className="icon-xs" />
            )}
            {firebaseState === "saving"
              ? "Saving to Firebase"
              : "Firebase synced"}
          </span>
          <span
            className={cn("chip", markdownState === "error" && "chip--error")}
          >
            <HardDriveDownload className="icon-xs" />
            {markdownState === "ready"
              ? "Local mirror ready"
              : "Local mirror failed"}
          </span>
        </div>
      </div>

      <div className="field">
        <Label>Body</Label>
        <MarkdownEditor
          value={draft.content}
          onChange={(content) => updateDraft({ ...draft, content })}
          className="min-h-144"
          placeholder="Write notes here"
        />
      </div>

      <p className="note-editor__path">
        Mirrored to <strong>{draft.localPath}</strong> after each successful
        save when the local route is available.
      </p>
    </div>
  );
}
