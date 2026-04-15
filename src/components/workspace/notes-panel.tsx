"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkdownEditor } from "@/components/editor/markdown-editor";
import { MeetingNote, Project } from "@/lib/types";
import { buildMeetingNotePath } from "@/lib/meeting-note-sync";

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
}

function createEmptyDraft(selectedProject?: Project): NoteDraft {
  const meetingDate = new Date().toISOString().slice(0, 10);
  const title = "Meeting notes";
  return {
    title,
    meetingDate,
    content:
      "# Meeting notes\n\n## Agenda\n\n- \n\n## Decisions\n\n- \n\n## Next steps\n\n- ",
    localPath: buildMeetingNotePath(
      selectedProject?.name || "workspace",
      meetingDate,
      title,
    ),
  };
}

export function NotesPanel({
  selectedProject,
  projectNotes,
  onCreateNote,
  onUpdateNote,
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
  const [draft, setDraft] = useState<NoteDraft>(() =>
    createEmptyDraft(selectedProject),
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const lastPersistedRef = useRef("");

  const activeNote = sortedNotes.find((note) => note.id === activeNoteId);

  useEffect(() => {
    if (!sortedNotes.length) {
      setActiveNoteId("");
      setDraft(createEmptyDraft(selectedProject));
      lastPersistedRef.current = "";
      return;
    }

    if (
      !activeNoteId ||
      !sortedNotes.some((note) => note.id === activeNoteId)
    ) {
      setActiveNoteId(sortedNotes[0].id);
    }
  }, [activeNoteId, selectedProject, sortedNotes]);

  useEffect(() => {
    if (!activeNote) {
      return;
    }

    const nextDraft = {
      title: activeNote.title,
      meetingDate: activeNote.meetingDate,
      content: activeNote.content,
      localPath:
        activeNote.localPath ||
        buildMeetingNotePath(
          selectedProject?.name || "workspace",
          activeNote.meetingDate,
          activeNote.title,
        ),
    };
    setDraft(nextDraft);
    lastPersistedRef.current = JSON.stringify(nextDraft);
    setSaveState("idle");
  }, [activeNote, selectedProject?.name]);

  useEffect(() => {
    if (!activeNote) {
      return;
    }

    const normalizedDraft = {
      title: draft.title.trim() || "Meeting notes",
      meetingDate: draft.meetingDate,
      content: draft.content,
      localPath:
        draft.localPath ||
        buildMeetingNotePath(
          selectedProject?.name || "workspace",
          draft.meetingDate,
          draft.title,
        ),
    };
    const snapshot = JSON.stringify(normalizedDraft);

    if (snapshot === lastPersistedRef.current) {
      return;
    }

    setSaveState("saving");
    const timer = window.setTimeout(() => {
      void onUpdateNote(activeNote.id, {
        title: normalizedDraft.title,
        meetingDate: normalizedDraft.meetingDate,
        content: normalizedDraft.content,
        localPath: normalizedDraft.localPath,
        updatedAt: Date.now(),
      }).then(() => {
        lastPersistedRef.current = snapshot;
        setSaveState("saved");
      });
    }, 500);

    return () => window.clearTimeout(timer);
  }, [activeNote, draft, onUpdateNote, selectedProject?.name]);

  async function createNewNote() {
    if (!selectedProject) {
      return;
    }

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
  }

  return (
    <section className="grid min-h-140 gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="grid gap-3 border-r border-slate-200 pr-0 lg:pr-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Meeting notes
            </h2>
            <p className="text-sm text-slate-500">
              Shared, markdown-first notes with Firebase sync.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="gap-2"
            onClick={() => {
              void createNewNote();
            }}
            disabled={!selectedProject}
          >
            <Plus className="h-4 w-4" />
            New
          </Button>
        </div>

        <div className="grid gap-1 overflow-y-auto">
          {sortedNotes.map((note) => (
            <button
              key={note.id}
              type="button"
              className={`rounded-2xl border px-3 py-3 text-left transition-colors ${
                activeNoteId === note.id
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              onClick={() => setActiveNoteId(note.id)}
            >
              <p className="truncate text-sm font-medium">{note.title}</p>
              <p
                className={`mt-1 text-xs ${
                  activeNoteId === note.id ? "text-slate-200" : "text-slate-500"
                }`}
              >
                {note.meetingDate}
              </p>
            </button>
          ))}

          {!sortedNotes.length ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
              {selectedProject
                ? "Create the first note for this project."
                : "Select a project to open meeting notes."}
            </div>
          ) : null}
        </div>
      </aside>

      <div className="grid gap-4">
        {activeNote ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <FileText className="h-4 w-4 text-slate-400" />
                <Input
                  value={draft.title}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      title: event.target.value,
                      localPath: buildMeetingNotePath(
                        selectedProject?.name || "workspace",
                        current.meetingDate,
                        event.target.value,
                      ),
                    }))
                  }
                  className="border-0 px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
                />
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <Input
                  type="date"
                  value={draft.meetingDate}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      meetingDate: event.target.value,
                      localPath: buildMeetingNotePath(
                        selectedProject?.name || "workspace",
                        event.target.value,
                        current.title,
                      ),
                    }))
                  }
                  className="w-37.5"
                />
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs">
                  {saveState === "saving" ? (
                    <>Saving...</>
                  ) : saveState === "saved" ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Saved
                    </>
                  ) : (
                    <>Live sync</>
                  )}
                </span>
              </div>
            </div>

            <MarkdownEditor
              value={draft.content}
              onChange={(content) =>
                setDraft((current) => ({
                  ...current,
                  content,
                }))
              }
              className="min-h-130"
              placeholder="Write notes in markdown..."
            />

            <p className="text-xs text-slate-500">
              Markdown is mirrored to {draft.localPath} when running in a local
              Node environment.
            </p>
          </>
        ) : (
          <div className="grid place-items-center rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
            {selectedProject
              ? "Choose a note from the list or create a new one."
              : "Select a project to start writing meeting notes."}
          </div>
        )}
      </div>
    </section>
  );
}
