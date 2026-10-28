// History can show one hour or a complete local calendar day.
export const HISTORY_MS = 60 * 60 * 1000;
export function historyWindow(now, range = "hour") {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return range === "today" ? { start: +start, cycle: +end - start } : { start: now - HISTORY_MS, cycle: HISTORY_MS };
}
export function historySegments(journal, now, range = "hour") {
  const window = historyWindow(now, range);
  const entries = [...journal.fragments];
  if (journal.auto) entries.push({ ...journal.auto, end: now, source: journal.auto.kind, status: "pending", live: true });
  if (journal.focus) {
    journal.focus.runs.forEach((run, index) => entries.push({ ...run, id: `${journal.focus.id}-${index}`, source: "focus", taskId: journal.focus.taskId, status: "pending", live: true }));
    if (journal.focus.status === "running") {
      const focus = journal.focus;
      const end = focus.mode === "countdown" ? Math.min(now, focus.startedAt + Math.max(0, focus.durationMs - focus.elapsedMs)) : now;
      entries.push({ id: `${focus.id}-live`, start: focus.startedAt, end, source: "focus", taskId: focus.taskId, status: "pending", live: true });
    }
  }
  return entries.filter((entry) => ["pending", "logged"].includes(entry.status)).map((entry) => {
    const start = Math.max(window.start, entry.start), end = Math.min(now, entry.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 1000) return null;
    const date = new Date(start);
    return { ...entry, start, end, seconds: Math.floor((end - start) / 1000),
      position: range === "today" ? (start - window.start) / window.cycle : (date.getMinutes() * 60000 + date.getSeconds() * 1000 + date.getMilliseconds()) / HISTORY_MS,
      span: Math.min(1, (end - start) / window.cycle),
    };
  }).filter(Boolean);
}
export function arcPath(position, span, radius) {
  if (!(span > 0)) return "";
  const point = (fraction) => {
    const angle = fraction * Math.PI * 2 - Math.PI / 2;
    return [100 + Math.cos(angle) * radius, 100 + Math.sin(angle) * radius];
  };
  const [x, y] = point(position), [endX, endY] = point(position + Math.min(span, 1));
  if (span >= .999999) {
    const [midX, midY] = point(position + .5);
    return `M ${x} ${y} A ${radius} ${radius} 0 1 1 ${midX} ${midY} A ${radius} ${radius} 0 1 1 ${x} ${y}`;
  }
  return `M ${x} ${y} A ${radius} ${radius} 0 ${span > .5 ? 1 : 0} 1 ${endX} ${endY}`;
}

// A broad annular sector makes each captured interval part of the moving disc.
export function bandPath(position, span, outer, inner) {
  if (!(span > 0)) return "";
  // Reverse the inner arc from the outer endpoint back to the start.
  const start = (fraction, radius) => {
    const angle = fraction * 2 * Math.PI - Math.PI / 2;
    return `${100 + Math.cos(angle) * radius} ${100 + Math.sin(angle) * radius}`;
  };
  const length = Math.min(span, 1);
  if (length >= .999999) return `${arcPath(position, 1, outer)} Z ${arcPath(position, 1, inner)} Z`;
  return `${arcPath(position, length, outer)} L ${start(position + length, inner)} A ${inner} ${inner} 0 ${length > .5 ? 1 : 0} 0 ${start(position, inner)} Z`;
}

export function focusAllocation(journal, now) {
  const totals = new Map();
  for (const entry of historySegments(journal, now, "today")) {
    if (entry.source === "focus" && entry.taskId) totals.set(entry.taskId, (totals.get(entry.taskId) || 0) + entry.seconds);
  }
  const total = [...totals.values()].reduce((sum, seconds) => sum + seconds, 0);
  let position = 0;
  return [...totals].map(([taskId, seconds]) => {
    const span = seconds / total;
    const entry = { taskId, seconds, position, span };
    position += span;
    return entry;
  });
}
