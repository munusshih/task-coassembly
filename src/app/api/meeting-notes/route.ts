import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface MeetingNoteSyncPayload {
    projectName: string;
    title: string;
    content: string;
    meetingDate: string;
    localPath: string;
}

interface MeetingNoteDeletePayload {
    localPath: string;
}

function normalizeRelativePath(relativePath: string): string {
    return relativePath
        .replace(/^\/+/, "")
        .split(path.sep)
        .join("/");
}

function resolveAbsoluteNotePath(relativePath: string): string {
    const normalizedPath = normalizeRelativePath(relativePath);
    const scopedRelativePath = normalizedPath.replace(/^meeting-notes\/?/, "");

    return path.join(process.cwd(), "meeting-notes", scopedRelativePath);
}

function serializeContentForMarkdown(content: string): string {
    if (!content.trim()) {
        return "";
    }

    if (!/<\/?[a-z][\s\S]*>/i.test(content)) {
        return content;
    }

    return content
        .replace(/<h1>(.*?)<\/h1>/gi, "\n# $1\n")
        .replace(/<h2>(.*?)<\/h2>/gi, "\n## $1\n")
        .replace(/<h3>(.*?)<\/h3>/gi, "\n### $1\n")
        .replace(/<li>(.*?)<\/li>/gi, "- $1\n")
        .replace(/<p>(.*?)<\/p>/gi, "$1\n\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<blockquote>(.*?)<\/blockquote>/gi, "> $1\n\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .trim();
}

export async function POST(request: NextRequest) {
    try {
        const payload = (await request.json()) as MeetingNoteSyncPayload;
        const relativePath = normalizeRelativePath(payload.localPath);
        const absolutePath = resolveAbsoluteNotePath(relativePath);

        await mkdir(path.dirname(absolutePath), { recursive: true });

        const markdown = [
            `# ${payload.title || "Untitled meeting"}`,
            "",
            `- Project: ${payload.projectName || "Workspace"}`,
            `- Date: ${payload.meetingDate || new Date().toISOString().slice(0, 10)}`,
            "",
            serializeContentForMarkdown(payload.content || ""),
            "",
        ].join("\n");

        await writeFile(absolutePath, markdown, "utf8");

        return NextResponse.json({ ok: true, localPath: relativePath });
    } catch (error) {
        return NextResponse.json(
            {
                ok: false,
                error: error instanceof Error ? error.message : "Unable to save markdown",
            },
            { status: 500 },
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const payload = (await request.json()) as MeetingNoteDeletePayload;
        const absolutePath = resolveAbsoluteNotePath(payload.localPath);

        await rm(absolutePath, { force: true });

        return NextResponse.json({ ok: true, localPath: payload.localPath });
    } catch (error) {
        return NextResponse.json(
            {
                ok: false,
                error: error instanceof Error ? error.message : "Unable to delete markdown",
            },
            { status: 500 },
        );
    }
}