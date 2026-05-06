export function weekStartDateForTs(ts) {
  const date = new Date(ts);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
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

export function getAssignableProjects(projects, memberId) {
  return (projects || []).filter((project) =>
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
  return isMemberAssignedToProject(project, memberId);
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
