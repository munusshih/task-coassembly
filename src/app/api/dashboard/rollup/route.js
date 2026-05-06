import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getAdminDb } from "../../../../lib/firebaseAdmin";

const getDashboardRollup = unstable_cache(
  async () => {
    const db = getAdminDb();

    const [
      membersCount,
      projectsCount,
      notesCount,
      resourcesCount,
      backlogCount,
      todoTotalCount,
      todoActiveCount,
      todoCompletedCount,
      todoArchivedCount,
    ] = await Promise.all([
      db.collection("members").count().get(),
      db.collection("projects").count().get(),
      db.collection("meetingNotes").count().get(),
      db.collection("resources").count().get(),
      db.collection("backlogItems").count().get(),
      db.collection("tasks").where("type", "==", "memberTodo").count().get(),
      db
        .collection("tasks")
        .where("type", "==", "memberTodo")
        .where("archived", "==", false)
        .count()
        .get(),
      db
        .collection("tasks")
        .where("type", "==", "memberTodo")
        .where("completed", "==", true)
        .where("archived", "==", false)
        .count()
        .get(),
      db
        .collection("tasks")
        .where("type", "==", "memberTodo")
        .where("archived", "==", true)
        .count()
        .get(),
    ]);

    return {
      members: membersCount.data().count,
      projects: projectsCount.data().count,
      meetingNotes: notesCount.data().count,
      resources: resourcesCount.data().count,
      backlogItems: backlogCount.data().count,
      todos: {
        total: todoTotalCount.data().count,
        active: todoActiveCount.data().count,
        completed: todoCompletedCount.data().count,
        archived: todoArchivedCount.data().count,
      },
      generatedAt: Date.now(),
    };
  },
  ["dashboard-rollup-v2"],
  {
    revalidate: 60,
    tags: ["dashboard-rollup"],
  },
);

export async function GET() {
  try {
    const data = await getDashboardRollup();
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          "Dashboard rollup unavailable. Check FIREBASE_ADMIN_* environment variables.",
      },
      { status: 503 },
    );
  }
}
