import { mkdir, writeFile } from "node:fs/promises";
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

function normalizeRelativePath(relativePath: string): string {
    return relativePath
        .replace(/^\/+/, "")
        .split(path.sep)
        .join("/");
}

export async function POST(request: NextRequest) {
    try {
        const payload = (await request.json()) as MeetingNoteSyncPayload;
        const relativePath = normalizeRelativePath(payload.localPath);
        const scopedRelativePath = relativePath.replace(/^meeting-notes\/?/, "");
        const absolutePath = path.join(
            process.cwd(),
            "meeting-notes",
            scopedRelativePath,
        );

        await mkdir(path.dirname(absolutePath), { recursive: true });

        const markdown = [
            `# ${payload.title || "Untitled meeting"}`,
            "",
            `- Project: ${payload.projectName || "Workspace"}`,
            `- Date: ${payload.meetingDate || new Date().toISOString().slice(0, 10)}`,
            "",
            payload.content || "",
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