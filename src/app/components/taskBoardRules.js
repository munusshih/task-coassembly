// All week keys are computed in Asia/Taipei (UTC+8) so every member
// sees the same week boundary regardless of their local timezone.
const TZ = "Asia/Taipei";

function taipeiDateParts(ts) {
  const d = new Date(ts);
  // Use Intl to get the wall-clock date in Taipei time
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const year = Number(parts.find((p) => p.type === "year").value);
  const month = Number(parts.find((p) => p.type === "month").value);
  const day = Number(parts.find((p) => p.type === "day").value);
  const dow = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    weekday: "short",
  }).format(d); // "Mon", "Tue", ..., "Sun"
  return { year, month, day, dow };
}

export function weekStartDateForTs(ts) {
  const { year, month, day, dow } = taipeiDateParts(ts);
  // Monday-anchored week: Sunday = -6, others = 1 - dayIndex
  const dayIndex = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(dow);
  const diff = dayIndex === 0 ? -6 : 1 - dayIndex;
  // Build a UTC date at midnight for that Taipei calendar date, then apply diff
  const base = new Date(Date.UTC(year, month - 1, day + diff));
  return base;
}

export function weekKeyFromTs(ts) {
  return weekStartDateForTs(ts).toISOString().slice(0, 10);
}

export function weekStartForDateKey(dateKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ""));
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.toISOString().slice(0, 10) !== dateKey) return null;
  const weekday = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() + (weekday === 0 ? -6 : 1 - weekday));
  return date.toISOString().slice(0, 10);
}

export function weekKeyToIsoWeek(weekKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(weekKey || ""));
  if (!match) return "";
  const monday = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (monday.toISOString().slice(0, 10) !== weekKey || monday.getUTCDay() !== 1) return "";
  const thursday = new Date(monday);
  thursday.setUTCDate(thursday.getUTCDate() + 3);
  const weekYear = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(weekYear, 0, 4));
  firstThursday.setUTCDate(firstThursday.getUTCDate() + 3 - ((firstThursday.getUTCDay() + 6) % 7));
  const weekNumber = 1 + Math.round((thursday - firstThursday) / 604800000);
  return `${weekYear}-W${String(weekNumber).padStart(2, "0")}`;
}

export function weekStartForIsoWeek(isoWeek) {
  const match = /^(\d{4})-W(\d{2})$/.exec(String(isoWeek || ""));
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > 53) return null;
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(januaryFourth);
  monday.setUTCDate(januaryFourth.getUTCDate() - ((januaryFourth.getUTCDay() + 6) % 7) + (week - 1) * 7);
  const dateKey = monday.toISOString().slice(0, 10);
  return weekKeyToIsoWeek(dateKey) === isoWeek ? dateKey : null;
}

export function currentWeekKey() {
  return weekKeyFromTs(Date.now());
}

export function previousWeekKey(referenceTs = Date.now()) {
  const previousWeekStart = weekStartDateForTs(referenceTs);
  previousWeekStart.setUTCDate(previousWeekStart.getUTCDate() - 7);
  return previousWeekStart.toISOString().slice(0, 10);
}

export function isEditableWeekKey(weekKey, referenceTs = Date.now()) {
  if (!weekKey) return true;
  return (
    weekKey === weekKeyFromTs(referenceTs) ||
    weekKey === previousWeekKey(referenceTs)
  );
}

export function taskWeekKey(taskData) {
  const explicit = String(taskData?.taskWeek || "").trim();
  if (explicit) return explicit;
  const ts = Number(taskData?.createdAt || taskData?.updatedAt || 0);
  return ts ? weekKeyFromTs(ts) : currentWeekKey();
}

export function isMemberAssignedToProject(project, memberId) {
  if (!project || !memberId) return false;
  const staffing = Array.isArray(project.data?.staffing)
    ? project.data.staffing
    : [];
  return staffing.some((entry) => entry?.memberId === memberId);
}

export function isProjectClosed(project) {
  const status = String(project?.data?.status || "")
    .trim()
    .toLowerCase();
  return status === "completed" || status === "cancelled";
}

export function getAssignableProjects(projects, memberId) {
  return (projects || []).filter(
    (project) =>
      !isProjectClosed(project) &&
      isMemberAssignedToProject(project, memberId),
  );
}

export function getAssignableMembersForProject(members, project) {
  if (!project) return members || [];
  return (members || []).filter((member) =>
    isMemberAssignedToProject(project, member.id),
  );
}

export function isProjectIdAssignable(projects, memberId, projectId) {
  if (!projectId) return true;
  const project = (projects || []).find((item) => item.id === projectId);
  return (
    !isProjectClosed(project) &&
    isMemberAssignedToProject(project, memberId)
  );
}

export function isMemberActive(member) {
  return member?.data?.active !== false;
}

export function canViewerManageMemberTask({
  isLimitedViewer,
  viewerMemberId,
  memberId,
}) {
  if (!isLimitedViewer) return true;
  return Boolean(memberId) && memberId === viewerMemberId;
}

export function canPushTaskToNewestWeek(
  taskData,
  targetWeekKey = currentWeekKey(),
) {
  if (!taskData) return false;
  if (Boolean(taskData.completed)) return false;
  return taskWeekKey(taskData) !== targetWeekKey;
}

export function isUnfinishedTaskOutsideWeek(
  taskData,
  targetWeekKey = currentWeekKey(),
) {
  if (!taskData) return false;
  if (Boolean(taskData.completed)) return false;
  return taskWeekKey(taskData) !== targetWeekKey;
}
