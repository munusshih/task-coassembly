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

export function currentWeekKey() {
  return weekKeyFromTs(Date.now());
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

export function canPushTaskToWishes(
  taskData,
  targetWeekKey = currentWeekKey(),
) {
  if (!taskData) return false;
  return !Boolean(taskData.completed);
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
