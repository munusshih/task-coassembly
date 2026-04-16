import { MeetingNote } from "@/lib/types";

function slugify(value: string): string {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
}

export function buildMeetingNotePath(
    projectName: string,
    meetingDate: string,
    title: string,
): string {
    const projectSlug = slugify(projectName || "workspace");
    const titleSlug = slugify(title || "meeting-note");
    const datePrefix = meetingDate || new Date().toISOString().slice(0, 10);
    return `meeting-notes/${projectSlug}/${datePrefix}-${titleSlug}.md`;
}

export async function syncMeetingNoteMarkdown(
    note: Pick<MeetingNote, "title" | "content" | "meetingDate" | "localPath">,
    projectName: string,
): Promise<void> {
    const response = await fetch("/api/meeting-notes", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            projectName,
            title: note.title,
            content: note.content,
            meetingDate: note.meetingDate,
            localPath:
                note.localPath ||
                buildMeetingNotePath(projectName, note.meetingDate, note.title),
        }),
    });

    if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
        throw new Error(payload?.error || "Unable to mirror note to local markdown.");
    }
}

export async function deleteMeetingNoteMarkdown(localPath: string): Promise<void> {
    const response = await fetch("/api/meeting-notes", {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ localPath }),
    });

    if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
        throw new Error(payload?.error || "Unable to delete mirrored note file.");
    }
}
