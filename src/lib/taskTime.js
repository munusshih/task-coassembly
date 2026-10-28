import { doc, runTransaction } from "firebase/firestore";
import { auth, db } from "../firebase";
import { planTimeLog } from "../app/components/time/trackingModel.mjs";

export async function logTaskTime(memberId, taskId, fragments) {
  if (!auth?.currentUser || !db) throw new Error("Sign in before logging time.");
  const taskRef = doc(db, "tasks", taskId);
  const memberRef = doc(db, "members", memberId);
  if (!Array.isArray(fragments) || !fragments.length || fragments.length > 100) throw new Error("Choose 1–100 time fragments.");
  if (fragments.some((f) => !f?.id || f.id.includes("/"))) throw new Error("Invalid time fragment.");
  return runTransaction(db, async (transaction) => {
    const [member, task] = await Promise.all([transaction.get(memberRef), transaction.get(taskRef)]);
    if (!member.exists() || member.data().authUid !== auth.currentUser.uid) throw new Error("Your signed-in member could not be verified.");
    if (!task.exists()) throw new Error("This task no longer exists.");
    const refs = new Map(fragments.map((f) => [f.id, doc(db, "members", memberId, "timeEntries", f.id)]));
    const existing = {};
    await Promise.all([...refs].map(async ([id, ref]) => {
      const snapshot = await transaction.get(ref);
      if (snapshot.exists()) existing[id] = snapshot.data();
    }));
    const { entries, seconds } = planTimeLog({ ...task.data(), id: taskId }, existing, fragments, memberId);
    const now = Date.now();
    for (const entry of entries) {
      transaction.set(refs.get(entry.id), {
        taskId, memberId, source: entry.source, start: entry.start, end: entry.end,
        seconds: entry.seconds, createdAt: now, createdBy: auth.currentUser.uid,
      });
    }
    if (seconds) transaction.update(taskRef, {
      trackedSeconds: (Number(task.data().trackedSeconds) || 0) + seconds,
      trackedEntryCount: (Number(task.data().trackedEntryCount) || 0) + entries.length,
      updatedAt: now,
    });
    return { seconds, trackedSeconds: (Number(task.data().trackedSeconds) || 0) + seconds };
  });
}
