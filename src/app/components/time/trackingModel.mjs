export const IDLE_MS = 5 * 60 * 1000;
export const FRAGMENT_MS = 15 * 60 * 1000;
export const REMINDER_MS = 15 * 60 * 1000;
export const newId = () => crypto.randomUUID();
export const emptyJournal = () => ({ version: 1, fragments: [], auto: null, focus: null, completion: null, nextReminderAt: 0 });
export const secondsBetween = (start, end) => Math.max(0, Math.floor((end - start) / 1000));
export function durationLabel(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600), minutes = Math.floor((total % 3600) / 60);
  if (!hours && !minutes) return `${total}s`;
  return `${hours ? `${hours}h ` : ""}${minutes}m`;
}
export function focusElapsed(focus, now) {
  if (!focus) return 0;
  const elapsed = (focus.elapsedMs || 0) + (focus.status === "running" ? Math.max(0, now - focus.startedAt) : 0);
  return focus.mode === "countdown" ? Math.min(focus.durationMs, elapsed) : elapsed;
}
export function closeAuto(journal, end) {
  if (!journal.auto) return journal;
  const auto = journal.auto;
  const seconds = secondsBetween(auto.start, end);
  const fragments = seconds ? [...journal.fragments, {
    id: auto.id, start: auto.start, end, seconds, source: auto.kind, status: "pending",
  }] : journal.fragments;
  return { ...journal, fragments, auto: null };
}
export function pauseFocus(journal, now, recovered = false) {
  const focus = journal.focus;
  if (!focus || focus.status !== "running") return journal;
  const end = focus.mode === "countdown" ? Math.min(now, focus.startedAt + Math.max(0, focus.durationMs - focus.elapsedMs)) : now;
  return { ...journal, focus: { ...focus, status: "paused", startedAt: null,
    elapsedMs: focus.elapsedMs + Math.max(0, end - focus.startedAt),
    runs: [...focus.runs, { start: focus.startedAt, end }], recovered,
  } };
}
export function finishFocus(journal, now, reason = "finished") {
  if (!journal.focus) return journal;
  const paused = pauseFocus(journal, now);
  const focus = paused.focus;
  const entries = focus.runs.map((run, index) => ({
    id: `${focus.id}-${index}`, ...run, seconds: secondsBetween(run.start, run.end),
    source: "focus", status: "pending", taskId: focus.taskId, sessionId: focus.id, autoLog: focus.autoLog,
  })).filter((entry) => entry.seconds > 0);
  return { ...paused, focus: null, fragments: [...paused.fragments, ...entries], completion: {
    id: focus.id, taskId: focus.taskId, seconds: entries.reduce((sum, entry) => sum + entry.seconds, 0),
    autoLog: focus.autoLog, reason, status: entries.length ? "pending" : "empty",
  } };
}
export function startFocus(journal, now, { taskId, mode, minutes, autoLog }) {
  if (journal.focus) throw new Error("Finish the current focus session first.");
  if (!taskId) throw new Error("Choose a task first.");
  if (!["countdown", "stopwatch"].includes(mode)) throw new Error("Choose a timer mode.");
  if (mode === "countdown" && (!Number.isFinite(Number(minutes)) || Number(minutes) < 1 || Number(minutes) > 240)) throw new Error("Choose 1–240 minutes.");
  return { ...closeAuto(journal, now), completion: null, focus: {
    id: newId(), taskId, mode, durationMs: Number(minutes) * 60000, autoLog: Boolean(autoLog),
    elapsedMs: 0, startedAt: now, status: "running", runs: [], recovered: false,
  } };
}
export function resumeFocus(journal, now) {
  if (!journal.focus || journal.focus.status !== "paused") return journal;
  return { ...closeAuto(journal, now), focus: { ...journal.focus, status: "running", startedAt: now, recovered: false } };
}
export function advanceJournal(journal, now, { active, lastInput }) {
  let next = journal;
  if (next.focus?.status === "running" && next.focus.mode === "countdown" && focusElapsed(next.focus, now) >= next.focus.durationMs) {
    next = finishFocus(next, now, "time-up");
  }
  const capture = active && next.focus?.status !== "running";
  if (!capture) return closeAuto(next, now);
  const kind = now - lastInput >= IDLE_MS ? "idle" : "activity";
  if (next.auto && next.auto.kind !== kind) {
    const boundary = kind === "idle" ? Math.max(next.auto.start, lastInput + IDLE_MS) : now;
    next = closeAuto(next, boundary);
    next = { ...next, auto: { id: newId(), start: boundary, lastSeen: now, kind } };
  }
  // Fixed-size fragments remain selectable even during a long uninterrupted visit.
  while (next.auto && now - next.auto.start >= FRAGMENT_MS) {
    const boundary = next.auto.start + FRAGMENT_MS;
    next = closeAuto(next, boundary);
    next = { ...next, auto: { id: newId(), start: boundary, lastSeen: now, kind } };
  }
  return { ...next, auto: next.auto ? { ...next.auto, lastSeen: now } : { id: newId(), start: now, lastSeen: now, kind } };
}
export function recoverJournal(raw) {
  if (raw?.version !== 1 || !Array.isArray(raw.fragments)) return emptyJournal();
  const journal = { ...emptyJournal(), ...raw, fragments: raw.fragments.filter((f) => f && typeof f.id === "string" && Number.isFinite(f.start) && Number.isFinite(f.end) && f.end >= f.start && f.seconds > 0 && ["pending", "logged", "discarded"].includes(f.status)) };
  if (journal.auto && (!Number.isFinite(journal.auto.start) || !Number.isFinite(journal.auto.lastSeen) || !["activity", "idle"].includes(journal.auto.kind))) journal.auto = null;
  if (journal.focus && (!Array.isArray(journal.focus.runs) || !["running", "paused"].includes(journal.focus.status) || !["countdown", "stopwatch"].includes(journal.focus.mode) || !Number.isFinite(journal.focus.elapsedMs) || (journal.focus.status === "running" && !Number.isFinite(journal.focus.startedAt)))) journal.focus = null;
  let recovered = journal.auto ? closeAuto(journal, journal.auto.lastSeen || journal.auto.start) : journal;
  // Never turn unobserved browser downtime into work hours.
  if (recovered.focus?.status === "running") recovered = pauseFocus(recovered, recovered.lastSeen || recovered.focus.startedAt, true);
  return recovered;
}
export function planTimeLog(task, existingEntries, fragments, memberId) {
  if (task?.memberId !== memberId) throw new Error("You can only log time to your own task.");
  if (task.reviewed || task.archived) throw new Error("This task is reviewed or archived. Reopen it before logging time.");
  if (!Array.isArray(fragments) || !fragments.length || fragments.length > 100) throw new Error("Choose 1–100 time fragments.");
  const unique = new Map();
  for (const fragment of fragments) {
    if (!fragment?.id || fragment.id.includes("/") || !Number.isFinite(fragment.start) || !Number.isFinite(fragment.end) || fragment.end <= fragment.start || !["activity", "idle", "focus"].includes(fragment.source)) throw new Error("Invalid time fragment.");
    if (fragment.taskId && fragment.taskId !== task.id) throw new Error("A focus fragment belongs to its selected task.");
    const previous = existingEntries[fragment.id];
    if (previous && previous.taskId !== task.id) throw new Error("This time fragment is already logged to another task.");
    if (!previous) unique.set(fragment.id, { ...fragment, seconds: secondsBetween(fragment.start, fragment.end) });
  }
  const entries = [...unique.values()].filter((entry) => entry.seconds > 0);
  return { entries, seconds: entries.reduce((sum, entry) => sum + entry.seconds, 0) };
}
export function workedTaskSeconds(data) {
  if (Number(data?.trackedSeconds) > 0) return Number(data.trackedSeconds);
  return data?.completed ? ((Number(data.timeUnits) || 0) + (Number(data.overtimeUnits) || 0)) * 900 : 0;
}
