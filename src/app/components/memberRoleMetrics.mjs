import { taskWeekKey, weekStartForDateKey, weekStartDateForTs, isProjectClosed, isMemberAssignedToProject } from './taskBoardRules.js';

export const WORK_CATEGORIES = [
  { key: 'rd', label: 'R&D', tone: 'project' },
  { key: 'work', label: 'Work', tone: 'worked' },
  { key: 'admin', label: 'Admin', tone: 'date' },
  { key: 'unclassified', label: '?', tone: 'neutral' },
];

export function workCategory(kind) {
  const value = String(kind || '').trim().toLowerCase();
  if (['internal', 'self-funded', 'grant', 'rd', 'r&d'].includes(value)) return 'rd';
  if (['commissioned', 'pass-through', 'commercial'].includes(value)) return 'work';
  if (['admin','service','common pool'].includes(value)) return 'admin';
  return 'unclassified';
}

// Allocation follows the Task board's Taipei week and never substitutes edits or
// completion dates for the week the task was actually planned for.
export function memberRoleMetrics(memberId, tasks, projects, now = Date.now(), mode = "role", range = {}) {
  const projectById = new Map(projects.map(p => [p.id, p]));
  const start = weekStartDateForTs(now);
  const recentWeeks = Array.from({ length: mode === "weekly" ? 1 : 4 }, (_, index) => {
    const date = new Date(start); date.setUTCDate(date.getUTCDate() - index * 7);
    return { key: date.toISOString().slice(0, 10), units: 0, projects: new Map() };
  });
  const rangeWeeks = [];
  if (mode === "weekly" && /^\d{4}-\d{2}-\d{2}$/.test(range.start || "")) {
    const first = new Date(`${weekStartForDateKey(range.start)}T00:00:00Z`);
    const last = new Date(`${weekStartForDateKey(range.end || range.start)}T00:00:00Z`);
    for (let date = new Date(first); date <= last; date.setUTCDate(date.getUTCDate() + 7)) {
      rangeWeeks.push({ key: date.toISOString().slice(0, 10), units: 0, projects: new Map() });
    }
  }
  const weeks = mode === "weekly" && rangeWeeks.length ? rangeWeeks.reverse() : mode === "overall" ? [...new Set(tasks.filter(task => task.data?.type === 'memberTodo' && task.data?.memberId === memberId).map(task => taskWeekKey(task.data)).filter(Boolean))].sort().reverse().map(key => ({key, units:0, projects:new Map()})) : recentWeeks;
  let assigned = 0, completed = 0;
  const categories = Object.fromEntries(WORK_CATEGORIES.map(c => [c.key, 0]));
  const current = new Map(projects.filter(p => !isProjectClosed(p) && isMemberAssignedToProject(p, memberId)).map(p => [p.id, p]));
  for (const task of tasks) {
    const data = task.data || {};
    if (data.type !== 'memberTodo' || data.memberId !== memberId) continue;
    const project = projectById.get(data.projectId);
    if (project && !isProjectClosed(project) && !data.archived && !data.completed) current.set(project.id, project);
    const week = weeks.find(w => w.key === taskWeekKey(data));
    if (!week) continue;
    assigned += 1;
    if (data.completed) completed += 1;
    const units = Math.max(0, Number(data.timeUnits) || 0);
    const name = project?.data?.name || (data.projectId ? 'Unknown project' : 'No project');
    week.units += units;
    const projectKey = data.projectId || 'no-project';
    const existing = week.projects.get(projectKey);
    week.projects.set(projectKey, { id: projectKey, name, kind: project?.data?.kind, units: (existing?.units || 0) + units });
    categories[workCategory(project?.data?.kind)] += units;
  }
  const total = weeks.reduce((sum, w) => sum + w.units, 0);
  const totals = new Map();
  weeks.forEach(week => week.projects.forEach(project => totals.set(project.id, {...project, units:(totals.get(project.id)?.units || 0) + project.units})));
  return {
    assigned, completed, mode,
    projectTotals:[...totals.values()].filter(project => project.units > 0).sort((a,b) => b.units-a.units),
    historicalProjects: projects.filter(project=>tasks.some(task=>task.data?.memberId===memberId&&task.data?.projectId===project.id)&&!current.has(project.id)),
    currentProjects: [...current.values()].sort((a, b) => String(a.data?.name || a.id).localeCompare(String(b.data?.name || b.id))),
    weeks: weeks.map(w => ({ ...w, projects: [...w.projects.values()].filter(project => project.units > 0).sort((a, b) => b.units - a.units) })),
    categories: WORK_CATEGORIES.filter(c => c.key !== 'unclassified' || categories[c.key] > 0).map(c => ({ ...c, units: categories[c.key], percent: total ? categories[c.key] / total * 100 : 0 })),
    total,
  };
}

export function projectWorkTone(kind) {
  return WORK_CATEGORIES.find(category => category.key === workCategory(kind)).tone;
}
