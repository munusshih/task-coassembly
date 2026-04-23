"use client";

import { useEffect, useMemo, useState } from "react";
import {
  subscribeCollection,
  createDocument,
  replaceDocument,
  deleteDocument,
} from "../../firestore";
import { firebaseReady } from "../../firebase";
import Button from "./Button";
import IconButton from "./IconButton";
import { DELETE_ICON, EDIT_ICON } from "./icons";
import CollectionLayout from "./ui/CollectionLayout";
import EmptyState from "./ui/EmptyState";
import EntityCard from "./ui/EntityCard";
import InputField from "./ui/InputField";
import ModalShell from "./ui/ModalShell";
import SelectField from "./ui/SelectField";
import SectionBlock from "./ui/SectionBlock";
import TabPage from "./ui/TabPage";
import TextareaField from "./ui/TextareaField";
import DeleteConfirmDialog from "./ui/DeleteConfirmDialog";
import { renderTextWithLinks } from "./ui/linkifyText";
import { normalizeEmailValue } from "../../authAccess";

const TODO_TYPE = "memberTodo";
const METRICS_CUTOFF_ISO = "2026-04-20";
const METRICS_CUTOFF_TS = Date.parse(`${METRICS_CUTOFF_ISO}T00:00:00.000Z`);
const MIN_ROTATION_MONTH_KEY = "2026-04";
const MEETING_ROTATION = ["facilitator", "notetaker", "time keeper"];
const MEMBER_TYPE_OPTIONS = [
  { value: "worker-owner", label: "Worker-owner" },
  { value: "associate", label: "Associate" },
  { value: "flying-member", label: "Flying member" },
  { value: "external-collaborator", label: "External collaborator" },
];
const PROJECT_KIND_COLORS = [
  "#0066CC",
  "#FF7A00",
  "#2E8B57",
  "#D7263D",
  "#7B2CBF",
  "#00A6A6",
  "#C0A000",
  "#8C564B",
  "#E83E8C",
  "#1D3557",
  "#F94144",
  "#43AA8B",
];
const PROJECT_KIND_COLOR_BY_KEY = {
  commissioned: "#0066CC",
  "self-funded": "#FF7A00",
  grant: "#2E8B57",
  internal: "#D7263D",
  admin: "#7B2CBF",
  "pass-through": "#00A6A6",
  unspecified: "#C0A000",
  "no-project": "#8C564B",
};

function normalizeMemberRole(rawRole) {
  const value = String(rawRole || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
  if (value === "worker-owner" || value === "workerowner")
    return "worker-owner";
  if (value === "associate") return "associate";
  if (value === "flying-member" || value === "flying") return "flying-member";
  if (value === "external-collaborator" || value === "external")
    return "external-collaborator";
  return "associate";
}

function roleLabel(roleValue) {
  const option = MEMBER_TYPE_OPTIONS.find(
    (item) => item.value === normalizeMemberRole(roleValue),
  );
  return option ? option.label : "Associate";
}

function isWorkerOwner(roleValue) {
  return normalizeMemberRole(roleValue) === "worker-owner";
}

function monthKeyFromTs(ts) {
  const d = new Date(Number(ts) || Date.now());
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function parseMonthSerial(monthKey) {
  const [yearRaw, monthRaw] = String(monthKey || "").split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return 0;
  return year * 12 + Math.max(0, month - 1);
}

function shiftMonthKey(monthKey, offset) {
  const [yearRaw, monthRaw] = String(monthKey || "").split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return monthKey;
  const date = new Date(
    Date.UTC(year, month - 1 + Number(offset || 0), 1, 0, 0, 0, 0),
  );
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function buildMonthWindow(
  centerMonthKey,
  pastCount = 1,
  futureCount = 1,
  minMonthKey = MIN_ROTATION_MONTH_KEY,
) {
  const centerSerial = parseMonthSerial(centerMonthKey);
  if (!centerSerial) return [];

  const minSerial = parseMonthSerial(minMonthKey) || centerSerial;
  const startSerial = Math.max(
    minSerial,
    centerSerial - Math.max(0, Number(pastCount) || 0),
  );
  const endSerial = Math.max(
    startSerial,
    centerSerial + Math.max(0, Number(futureCount) || 0),
  );

  const items = [];
  for (let serial = startSerial; serial <= endSerial; serial++) {
    const year = Math.floor(serial / 12);
    const month = String((serial % 12) + 1).padStart(2, "0");
    items.push(`${year}-${month}`);
  }
  return items;
}

function formatMonthKeyLabel(monthKey) {
  const [yearRaw, monthRaw] = String(monthKey || "").split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month))
    return monthKey || "Month";
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function normalizeMeetingDutyRole(rawRole) {
  const normalized = String(rawRole || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, " ");
  if (normalized === "facilitator") return "facilitator";
  if (normalized === "notetaker" || normalized === "note taker")
    return "notetaker";
  if (normalized === "time keeper" || normalized === "timekeeper")
    return "time keeper";
  return null;
}

function weekKeyFromTs(ts) {
  const value = Number(ts);
  if (!Number.isFinite(value) || value <= 0) return null;
  const d = new Date(value);
  const day = d.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  d.setUTCHours(0, 0, 0, 0);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function getWeekStartTs(ts) {
  const value = Number(ts);
  if (!Number.isFinite(value) || value <= 0) return null;
  const d = new Date(value);
  const day = d.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

function getRecentWeekKeysSince(cutoffTs, maxCount = 26) {
  const result = [];
  const nowWeekStartTs = getWeekStartTs(Date.now());
  const cutoffWeekStartTs = getWeekStartTs(cutoffTs);
  if (!nowWeekStartTs || !cutoffWeekStartTs) return result;

  const cursor = new Date(nowWeekStartTs);

  while (cursor.getTime() >= cutoffWeekStartTs && result.length < maxCount) {
    const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}-${String(cursor.getUTCDate()).padStart(2, "0")}`;
    result.push(key);
    cursor.setUTCDate(cursor.getUTCDate() - 7);
  }

  if (result.length === 0) {
    const key = weekKeyFromTs(Date.now());
    if (key) result.push(key);
  }

  return result;
}

function formatWeekKeyLabel(weekKey) {
  const [yearRaw, monthRaw, dayRaw] = String(weekKey || "").split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  )
    return weekKey || "Week";
  const next = new Date(Date.UTC(year, month - 1, day));
  next.setUTCDate(next.getUTCDate() + 6);
  const endMonth = String(next.getUTCMonth() + 1).padStart(2, "0");
  const endDay = String(next.getUTCDate()).padStart(2, "0");
  return `${monthRaw}/${dayRaw}-${endMonth}/${endDay}`;
}

function formatPlannedHoursFromUnits(units) {
  const value = Number(units) || 0;
  const hours = value * 0.25;
  if (hours <= 0) return "0h";
  const whole = Math.floor(hours);
  const fraction = hours - whole;
  if (fraction === 0) return `${whole}h`;
  if (fraction === 0.25) return `${whole}h 15m`;
  if (fraction === 0.5) return `${whole}h 30m`;
  if (fraction === 0.75) return `${whole}h 45m`;
  return `${hours.toFixed(1)}h`;
}

function normalizeProjectKind(rawKind, hasProjectRef) {
  const kind = String(rawKind || "").trim();
  if (kind) return kind;
  return hasProjectRef ? "Unspecified" : "No project";
}

function hashText(value) {
  const text = String(value || "");
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function normalizeProjectKindKey(kind) {
  const key = String(kind || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
  return key || "unspecified";
}

function colorForProjectKind(kind) {
  const key = normalizeProjectKindKey(kind);
  if (PROJECT_KIND_COLOR_BY_KEY[key]) return PROJECT_KIND_COLOR_BY_KEY[key];
  return PROJECT_KIND_COLORS[hashText(kind) % PROJECT_KIND_COLORS.length];
}

function toProjectKindSegments(countMap) {
  const pairs = Object.entries(countMap || {}).filter(
    ([, value]) => Number(value) > 0,
  );
  const total = pairs.reduce((sum, [, value]) => sum + Number(value), 0);
  if (!total) return [];

  const sortedPairs = pairs.sort((a, b) => {
    const valueDiff = Number(b[1]) - Number(a[1]);
    if (valueDiff !== 0) return valueDiff;
    return String(a[0]).localeCompare(String(b[0]));
  });

  return sortedPairs.map(([kind, value], index) => ({
    label: kind,
    value: Number(value),
    color:
      PROJECT_KIND_COLOR_BY_KEY[normalizeProjectKindKey(kind)] ||
      PROJECT_KIND_COLORS[index % PROJECT_KIND_COLORS.length],
    ratio: Number(value) / total,
  }));
}

function toProjectSegments(timeMap) {
  const pairs = Object.entries(timeMap || {}).filter(
    ([, value]) => Number(value) > 0,
  );
  const total = pairs.reduce((sum, [, value]) => sum + Number(value), 0);
  if (!total) return [];

  const sortedPairs = pairs.sort((a, b) => {
    const valueDiff = Number(b[1]) - Number(a[1]);
    if (valueDiff !== 0) return valueDiff;
    return String(a[0]).localeCompare(String(b[0]));
  });

  return sortedPairs.map(([projectName, value], index) => ({
    label: projectName,
    value: Number(value),
    color: PROJECT_KIND_COLORS[index % PROJECT_KIND_COLORS.length],
    ratio: Number(value) / total,
  }));
}

function donutBackground(segments) {
  if (!Array.isArray(segments) || segments.length === 0) {
    return "conic-gradient(#ececec 0deg 360deg)";
  }

  let start = 0;
  const parts = [];
  for (const segment of segments) {
    const end = start + segment.ratio * 360;
    parts.push(`${segment.color} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`);
    start = end;
  }
  if (start < 360) {
    parts.push(`rgba(0,0,0,0.08) ${start.toFixed(2)}deg 360deg`);
  }
  return `conic-gradient(${parts.join(", ")})`;
}

function segmentTotal(segments) {
  return (segments || []).reduce(
    (sum, segment) => sum + (Number(segment.value) || 0),
    0,
  );
}

function taskFinishedAtTs(taskData) {
  if (!taskData || typeof taskData !== "object") return 0;
  if (!taskData.archived && !taskData.completed) return 0;
  return (
    Number(taskData.archivedAt) ||
    Number(taskData.updatedAt) ||
    Number(taskData.createdAt) ||
    0
  );
}

function taskFinishedUnits(taskData) {
  if (!taskData || typeof taskData !== "object") return 0;
  return (Number(taskData.timeUnits) || 0) + (Number(taskData.overtimeUnits) || 0);
}

function formatUnitsAsHours(units) {
  const value = Number(units) || 0;
  const totalMinutes = Math.max(0, Math.round(value * 15));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function TimeDonutChart({ label, segments, emptyText, ariaLabel }) {
  return (
    <div className="member-kind-chart">
      <span className="member-directory-meta-label">{label}</span>
      <div className="member-kind-chart-body">
        <div
          className="member-kind-donut"
          style={{
            backgroundImage: donutBackground(segments),
          }}
          aria-label={ariaLabel}
        >
          <span className="member-kind-donut-value">
            {formatUnitsAsHours(segmentTotal(segments))}
          </span>
        </div>
        {segments.length === 0 ? (
          <p className="member-kind-empty">{emptyText}</p>
        ) : (
          <ul className="member-kind-legend">
            {segments.map((segment) => (
              <li
                key={`${ariaLabel}-${segment.label}`}
                className="member-kind-legend-item"
              >
                <span
                  className="member-kind-swatch"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="member-kind-label">{segment.label}</span>
                <span className="member-kind-count">
                  {formatUnitsAsHours(segment.value)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function emptyMemberForm() {
  return {
    name: "",
    role: "associate",
    email: "",
    timezone: "",
    joinedOn: "",
    notes: "",
    active: true,
  };
}

function buildFormFromMember(memberData) {
  const form = emptyMemberForm();
  if (!memberData || typeof memberData !== "object") return form;
  return {
    name: typeof memberData.name === "string" ? memberData.name : "",
    role: normalizeMemberRole(memberData.role),
    email: typeof memberData.email === "string" ? memberData.email : "",
    timezone:
      typeof memberData.timezone === "string" ? memberData.timezone : "",
    joinedOn:
      typeof memberData.joinedOn === "string" ? memberData.joinedOn : "",
    notes: typeof memberData.notes === "string" ? memberData.notes : "",
    active: memberData.active !== false,
  };
}

function taskMetricAnchorTs(taskData) {
  if (!taskData || typeof taskData !== "object") return 0;
  return Math.max(
    Number(taskData.createdAt) || 0,
    Number(taskData.updatedAt) || 0,
    Number(taskData.archivedAt) || 0,
  );
}

export default function MemberDirectoryPage() {
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [newMember, setNewMember] = useState(() => emptyMemberForm());
  const [expandedMembers, setExpandedMembers] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(() => emptyMemberForm());
  const [notice, setNotice] = useState(null);
  const [switchingMonthKey, setSwitchingMonthKey] = useState(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [rotationOpen, setRotationOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [memberTimeTabById, setMemberTimeTabById] = useState({});

  useEffect(() => {
    if (!firebaseReady) return;
    const u1 = subscribeCollection("members", setMembers);
    const u2 = subscribeCollection("tasks", setTasks);
    const u3 = subscribeCollection("projects", setProjects);
    return () => {
      u1();
      u2();
      u3();
    };
  }, []);

  const recentWeekKeys = useMemo(
    () => getRecentWeekKeysSince(METRICS_CUTOFF_TS, 26),
    [],
  );
  const currentWeekKey = recentWeekKeys[0] || null;
  const currentWeekStartTs = useMemo(() => getWeekStartTs(Date.now()) || 0, []);
  const currentMonthKey = monthKeyFromTs(Date.now());
  const rotationMonthKeys = useMemo(
    () => buildMonthWindow(currentMonthKey, 1, 1, MIN_ROTATION_MONTH_KEY),
    [currentMonthKey],
  );

  const membersSorted = useMemo(() => {
    return [...members].sort((a, b) => {
      const left = String(a?.data?.name || a.id || "").toLowerCase();
      const right = String(b?.data?.name || b.id || "").toLowerCase();
      return left.localeCompare(right);
    });
  }, [members]);

  const todoTasks = useMemo(
    () => tasks.filter((item) => item?.data?.type === TODO_TYPE),
    [tasks],
  );

  const memberMetrics = useMemo(() => {
    const metricsByMember = {};
    const weekToIndex = new Map(
      recentWeekKeys.map((key, index) => [key, index]),
    );
    const projectNameById = Object.fromEntries(
      projects.map((project) => [
        project.id,
        project?.data?.name || project.id,
      ]),
    );
    const projectKindById = Object.fromEntries(
      projects.map((project) => [project.id, project?.data?.kind || ""]),
    );

    for (const member of membersSorted) {
      metricsByMember[member.id] = {
        totalTaskCount: 0,
        plannedUnits: 0,
        assignedTotalCount: 0,
        completedTotalCount: 0,
        finishedUnitsTotal: 0,
        assignedThisWeekCount: 0,
        completedThisWeekCount: 0,
        finishedUnitsThisWeek: 0,
        weekly: recentWeekKeys.map((weekKey) => ({
          weekKey,
          assigned: 0,
          completed: 0,
          finishedUnits: 0,
        })),
        currentProjectIds: new Set(),
        historicalProjectIds: new Set(),
        projectTimeMap: {},
        thisWeekProjectTimeMap: {},
        projectKindTimeMap: {},
        thisWeekProjectKindTimeMap: {},
      };
    }

    for (const task of todoTasks) {
      const memberId = task?.data?.memberId;
      if (!memberId || !metricsByMember[memberId]) continue;

      const metric = metricsByMember[memberId];
      const data = task.data || {};
      const archived = Boolean(data.archived);
      const anchorTs = taskMetricAnchorTs(data);
      if (anchorTs < METRICS_CUTOFF_TS) continue;

      metric.totalTaskCount += 1;
      if (!archived) {
        metric.plannedUnits += Number(data.timeUnits) || 0;
      }

      const assignedWeek = weekKeyFromTs(
        Number(data.createdAt) || Number(data.updatedAt),
      );
      if (assignedWeek) {
        const assignedIndex = weekToIndex.get(assignedWeek);
        if (assignedIndex != null) metric.weekly[assignedIndex].assigned += 1;
        metric.assignedTotalCount += 1;
        if (assignedWeek === currentWeekKey) metric.assignedThisWeekCount += 1;
      }

      const finishedAt = taskFinishedAtTs(data);
      const finishedUnits = taskFinishedUnits(data);
      if (finishedAt && finishedUnits > 0) {
        const completedWeek = weekKeyFromTs(finishedAt);
        const projectName = data.projectId
          ? projectNameById[data.projectId] || data.projectId
          : "No project";
        const kind = normalizeProjectKind(
          projectKindById[data.projectId],
          Boolean(data.projectId),
        );

        metric.finishedUnitsTotal += finishedUnits;
        metric.completedTotalCount += 1;
        metric.projectTimeMap[projectName] =
          (metric.projectTimeMap[projectName] || 0) + finishedUnits;
        metric.projectKindTimeMap[kind] =
          (metric.projectKindTimeMap[kind] || 0) + finishedUnits;

        if (completedWeek) {
          const completedIndex = weekToIndex.get(completedWeek);
          if (completedIndex != null) {
            metric.weekly[completedIndex].completed += 1;
            metric.weekly[completedIndex].finishedUnits += finishedUnits;
          }
          if (completedWeek === currentWeekKey) {
            metric.completedThisWeekCount += 1;
            metric.finishedUnitsThisWeek += finishedUnits;
            metric.thisWeekProjectTimeMap[projectName] =
              (metric.thisWeekProjectTimeMap[projectName] || 0) + finishedUnits;
            metric.thisWeekProjectKindTimeMap[kind] =
              (metric.thisWeekProjectKindTimeMap[kind] || 0) + finishedUnits;
          }
        }
      }

      if (data.projectId) {
        metric.historicalProjectIds.add(data.projectId);
        if (!archived) metric.currentProjectIds.add(data.projectId);
      }
    }

    const normalized = {};
    for (const [memberId, metric] of Object.entries(metricsByMember)) {
      const currentProjects = [...metric.currentProjectIds]
        .map((id) => ({ id, name: projectNameById[id] || id }))
        .sort((a, b) => a.name.localeCompare(b.name));

      normalized[memberId] = {
        totalTaskCount: metric.totalTaskCount,
        assignedTotalCount: metric.assignedTotalCount,
        completedTotalCount: metric.completedTotalCount,
        finishedUnitsTotal: metric.finishedUnitsTotal,
        assignedThisWeekCount: metric.assignedThisWeekCount,
        completedThisWeekCount: metric.completedThisWeekCount,
        finishedUnitsThisWeek: metric.finishedUnitsThisWeek,
        plannedUnits: metric.plannedUnits,
        weekly: metric.weekly,
        currentProjectCount: metric.currentProjectIds.size,
        historicalProjectCount: metric.historicalProjectIds.size,
        currentProjects,
        projectSegments: toProjectSegments(metric.projectTimeMap),
        thisWeekProjectSegments: toProjectSegments(metric.thisWeekProjectTimeMap),
        projectKindSegments: toProjectKindSegments(metric.projectKindTimeMap),
        thisWeekProjectKindSegments: toProjectKindSegments(
          metric.thisWeekProjectKindTimeMap,
        ),
      };
    }
    return normalized;
  }, [
    membersSorted,
    todoTasks,
    projects,
    recentWeekKeys,
    currentWeekKey,
    currentWeekStartTs,
  ]);

  const workerOwners = useMemo(() => {
    return membersSorted.filter((member) => isWorkerOwner(member?.data?.role));
  }, [membersSorted]);

  const rotationByMonth = useMemo(() => {
    const byMonth = {};
    for (const monthKey of rotationMonthKeys) {
      const serial = parseMonthSerial(monthKey);
      byMonth[monthKey] = workerOwners.map((member, index) => {
        const fallbackRole =
          MEETING_ROTATION[(serial + index) % MEETING_ROTATION.length];
        const explicitRoles = member?.data?.meetingRoles;
        const explicitRole =
          explicitRoles && typeof explicitRoles === "object"
            ? normalizeMeetingDutyRole(explicitRoles[monthKey])
            : null;
        const role = explicitRole || fallbackRole;
        const attendance = member?.data?.meetingAttendance;
        const present = Boolean(attendance && attendance[monthKey]);
        return { member, role, present };
      });
    }
    return byMonth;
  }, [workerOwners, rotationMonthKeys]);

  const currentMonthRotation = rotationByMonth[currentMonthKey] || [];
  const membersRequiredAtMeetings = currentMonthRotation.length;
  const missingMeetingPresenceCount = currentMonthRotation.filter(
    (item) => !item.present,
  ).length;

  function updateNewMemberField(field, value) {
    setNewMember((prev) => ({ ...prev, [field]: value }));
  }

  function updateEditField(field, value) {
    setEditDraft((prev) => ({ ...prev, [field]: value }));
  }

  async function handleCreateMember(event) {
    event.preventDefault();
    const name = newMember.name.trim();
    if (!name) return;
    const now = Date.now();
    const email = normalizeEmailValue(newMember.email);

    try {
      await createDocument("members", {
        name,
        role: normalizeMemberRole(newMember.role),
        email,
        emailLower: email,
        timezone: newMember.timezone.trim(),
        joinedOn: newMember.joinedOn || monthKeyFromTs(now) + "-01",
        notes: newMember.notes.trim(),
        active: Boolean(newMember.active),
        meetingAttendance: {},
        meetingRoles: {},
        createdAt: now,
        updatedAt: now,
      });
      setNewMember(emptyMemberForm());
      setNotice({ error: false, text: "Member added" });
    } catch (error) {
      setNotice({ error: true, text: error.message || "Could not add member" });
    }
  }

  function startEdit(member) {
    setEditingId(member.id);
    setEditDraft(buildFormFromMember(member.data));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(emptyMemberForm());
  }

  function toggleMemberExpanded(memberId) {
    setExpandedMembers((prev) => ({ ...prev, [memberId]: !prev[memberId] }));
  }

  function setMemberTimeTab(memberId, tab) {
    setMemberTimeTabById((prev) => ({ ...prev, [memberId]: tab }));
  }

  async function saveEdit(member) {
    const name = editDraft.name.trim();
    if (!name) return;
    const now = Date.now();
    const email = normalizeEmailValue(editDraft.email);
    try {
      await replaceDocument("members", member.id, {
        ...member.data,
        name,
        role: normalizeMemberRole(editDraft.role),
        email,
        emailLower: email,
        timezone: editDraft.timezone.trim(),
        joinedOn: editDraft.joinedOn || null,
        notes: editDraft.notes.trim(),
        active: Boolean(editDraft.active),
        updatedAt: now,
      });
      setNotice({ error: false, text: "Member updated" });
      cancelEdit();
    } catch (error) {
      setNotice({
        error: true,
        text: error.message || "Could not update member",
      });
    }
  }

  async function toggleWorkerOwnerPresence(member, monthKey, checked) {
    const current = member?.data?.meetingAttendance;
    const attendance =
      current && typeof current === "object" ? { ...current } : {};
    attendance[monthKey] = Boolean(checked);
    try {
      await replaceDocument("members", member.id, {
        ...member.data,
        role: normalizeMemberRole(member?.data?.role),
        meetingAttendance: attendance,
        updatedAt: Date.now(),
      });
    } catch (error) {
      setNotice({
        error: true,
        text: error.message || "Could not update meeting attendance",
      });
    }
  }

  async function handleSwitchRolesForMonth(monthKey) {
    const monthRotation = rotationByMonth[monthKey] || [];
    if (monthRotation.length < 2) {
      setNotice({
        error: true,
        text: "Need at least 2 worker-owners to rotate roles",
      });
      return;
    }

    setSwitchingMonthKey(monthKey);
    const now = Date.now();

    try {
      const currentRoles = monthRotation.map((entry) => entry.role);
      const nextRoles = currentRoles.map((_, index) => {
        const previousIndex =
          (index - 1 + currentRoles.length) % currentRoles.length;
        return currentRoles[previousIndex];
      });

      await Promise.all(
        monthRotation.map((entry, index) => {
          const rawMeetingRoles = entry?.member?.data?.meetingRoles;
          const meetingRoles =
            rawMeetingRoles && typeof rawMeetingRoles === "object"
              ? { ...rawMeetingRoles }
              : {};
          meetingRoles[monthKey] = nextRoles[index];

          return replaceDocument("members", entry.member.id, {
            ...entry.member.data,
            role: normalizeMemberRole(entry?.member?.data?.role),
            meetingRoles,
            updatedAt: now,
          });
        }),
      );

      setNotice({
        error: false,
        text: `Switched worker-owner roles for ${formatMonthKeyLabel(monthKey)}`,
      });
    } catch (error) {
      setNotice({
        error: true,
        text: error.message || "Could not switch roles",
      });
    } finally {
      setSwitchingMonthKey(null);
    }
  }

  async function handleDeleteMember(member) {
    const memberName = member?.data?.name || "this member";
    const memberTasks = todoTasks.filter(
      (task) => task?.data?.memberId === member.id,
    );
    const memberProjects = projects.filter((project) => {
      const staffing = Array.isArray(project?.data?.staffing)
        ? project.data.staffing
        : [];
      return staffing.some((entry) => entry?.memberId === member.id);
    });

    const details = [];
    if (memberTasks.length > 0)
      details.push(`${memberTasks.length} task(s) will be unassigned`);
    if (memberProjects.length > 0)
      details.push(
        `${memberProjects.length} project staffing record(s) will be removed`,
      );
    const detail = details.length > 0 ? details.join(" · ") : undefined;

    setDeleteTarget({
      label: memberName,
      detail,
      onConfirm: async () => {
        try {
          const now = Date.now();
          await Promise.all([
            ...memberTasks.map((task) =>
              replaceDocument("tasks", task.id, {
                ...task.data,
                memberId: null,
                updatedAt: now,
              }),
            ),
            ...memberProjects.map((project) => {
              const staffing = Array.isArray(project?.data?.staffing)
                ? project.data.staffing
                : [];
              return replaceDocument("projects", project.id, {
                ...project.data,
                staffing: staffing.filter(
                  (entry) => entry?.memberId !== member.id,
                ),
                updatedAt: now,
              });
            }),
          ]);
          await deleteDocument("members", member.id);
          if (editingId === member.id) cancelEdit();
          setNotice({ error: false, text: "Member deleted" });
        } catch (error) {
          setNotice({
            error: true,
            text: error.message || "Could not delete member",
          });
        } finally {
          setDeleteTarget(null);
        }
      },
    });
  }

  const editingMember = membersSorted.find((m) => m.id === editingId) ?? null;

  return (
    <TabPage
      className="member-directory-page"
      title="Members"
      subtitle="Manage member records, meeting ownership roles, and workload/project assignment snapshots."
    >
      {notice && (
        <p
          className={
            notice.error
              ? "member-directory-notice member-directory-notice--error"
              : "member-directory-notice"
          }
        >
          {notice.text}
        </p>
      )}

      <CollectionLayout variant="grid" className="member-directory-top">
        <SectionBlock
          className="member-directory-panel member-form-panel"
          title="Add member"
          titleTag="h3"
          bodyClassName="member-form-panel-body"
          actions={
            <Button
              variant="ghost"
              size="small"
              onClick={() => setAddMemberOpen((v) => !v)}
            >
              {addMemberOpen ? "▴ Close" : "▾ Expand"}
            </Button>
          }
        >
          {addMemberOpen && (
            <form className="member-form" onSubmit={handleCreateMember}>
              <div className="member-form-grid">
                <label className="member-form-field">
                  <span>Name</span>
                  <InputField
                    className="member-form-input"
                    value={newMember.name}
                    onChange={(e) =>
                      updateNewMemberField("name", e.target.value)
                    }
                    placeholder="Member name"
                  />
                </label>
                <label className="member-form-field">
                  <span>Type</span>
                  <SelectField
                    className="member-form-input"
                    value={newMember.role}
                    onChange={(e) =>
                      updateNewMemberField("role", e.target.value)
                    }
                  >
                    {MEMBER_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </SelectField>
                </label>
                <label className="member-form-field">
                  <span>Email</span>
                  <InputField
                    className="member-form-input"
                    value={newMember.email}
                    onChange={(e) =>
                      updateNewMemberField("email", e.target.value)
                    }
                    placeholder="name@example.com"
                  />
                </label>
                <label className="member-form-field">
                  <span>Timezone</span>
                  <InputField
                    className="member-form-input"
                    value={newMember.timezone}
                    onChange={(e) =>
                      updateNewMemberField("timezone", e.target.value)
                    }
                    placeholder="America/New_York"
                  />
                </label>
                <label className="member-form-field">
                  <span>Joined on</span>
                  <InputField
                    type="date"
                    className="member-form-input"
                    value={newMember.joinedOn}
                    onChange={(e) =>
                      updateNewMemberField("joinedOn", e.target.value)
                    }
                  />
                </label>
                <label className="member-form-field member-form-field--toggle">
                  <input
                    type="checkbox"
                    checked={Boolean(newMember.active)}
                    onChange={(e) =>
                      updateNewMemberField("active", e.target.checked)
                    }
                  />
                  <span>Active member</span>
                </label>
                <label className="member-form-field member-form-field--full">
                  <span>Notes</span>
                  <TextareaField
                    className="member-form-input member-form-textarea"
                    value={newMember.notes}
                    onChange={(e) =>
                      updateNewMemberField("notes", e.target.value)
                    }
                    placeholder="Any context for this member..."
                  />
                </label>
              </div>
              <div className="member-form-actions">
                <Button type="submit" disabled={!newMember.name.trim()}>
                  Save member
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setNewMember(emptyMemberForm())}
                >
                  Clear
                </Button>
              </div>
            </form>
          )}
        </SectionBlock>

        <SectionBlock
          className="member-directory-panel"
          title="Meeting rotation"
          titleTag="h3"
          actions={
            <Button
              variant="ghost"
              size="small"
              onClick={() => setRotationOpen((v) => !v)}
            >
              {rotationOpen ? "▴ Close" : "▾ Expand"}
            </Button>
          }
        >
          {rotationOpen &&
            (workerOwners.length === 0 ? (
              <p className="member-directory-empty">
                No worker-owner members yet.
              </p>
            ) : (
              <div className="rotation-timeline">
                {rotationMonthKeys.map((monthKey) => {
                  const monthRotation = rotationByMonth[monthKey] || [];
                  const isCurrent = monthKey === currentMonthKey;
                  return (
                    <section
                      key={monthKey}
                      className={
                        isCurrent
                          ? "rotation-month rotation-month--current"
                          : "rotation-month"
                      }
                    >
                      <div className="rotation-month-head">
                        <div className="rotation-month-title-wrap">
                          <strong className="rotation-month-title">
                            {formatMonthKeyLabel(monthKey)}
                          </strong>
                          <span className="rotation-month-key">{monthKey}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="small"
                          onClick={() => handleSwitchRolesForMonth(monthKey)}
                          disabled={
                            switchingMonthKey === monthKey ||
                            monthRotation.length < 2
                          }
                        >
                          {switchingMonthKey === monthKey
                            ? "Switching..."
                            : "Switch roles"}
                        </Button>
                      </div>

                      <ul className="rotation-list">
                        {monthRotation.map((entry) => (
                          <li
                            key={`${monthKey}-${entry.member.id}`}
                            className="rotation-item"
                          >
                            <div className="rotation-main">
                              <strong>
                                {entry.member?.data?.name || entry.member.id}
                              </strong>
                              <span
                                className={`rotation-role rotation-role--${entry.role.replace(/\s+/g, "-").toLowerCase()}`}
                              >
                                {entry.role}
                              </span>
                            </div>
                            {isCurrent && (
                              <label className="rotation-attendance">
                                <input
                                  type="checkbox"
                                  checked={entry.present}
                                  onChange={(e) =>
                                    toggleWorkerOwnerPresence(
                                      entry.member,
                                      monthKey,
                                      e.target.checked,
                                    )
                                  }
                                />
                                <span>present this month</span>
                              </label>
                            )}
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </div>
            ))}
        </SectionBlock>
      </CollectionLayout>

      <CollectionLayout variant="list" className="member-directory-list">
        {membersSorted.length === 0 && <EmptyState>No members yet.</EmptyState>}

        {membersSorted.map((member) => {
          const metric = memberMetrics[member.id] || {
            totalTaskCount: 0,
            assignedTotalCount: 0,
            completedTotalCount: 0,
            finishedUnitsTotal: 0,
            assignedThisWeekCount: 0,
            completedThisWeekCount: 0,
            finishedUnitsThisWeek: 0,
            plannedUnits: 0,
            weekly: recentWeekKeys.map((weekKey) => ({
              weekKey,
              assigned: 0,
              completed: 0,
              finishedUnits: 0,
            })),
            currentProjectCount: 0,
            historicalProjectCount: 0,
            currentProjects: [],
            projectSegments: [],
            thisWeekProjectSegments: [],
            projectKindSegments: [],
            thisWeekProjectKindSegments: [],
          };

          const expanded = Boolean(expandedMembers[member.id]);
          const latestWeek = metric.weekly[0] || {
            weekKey: currentWeekKey,
            assigned: metric.assignedThisWeekCount,
            completed: metric.completedThisWeekCount,
          };
          const timeTab = memberTimeTabById[member.id] || "weekly";
          const role = normalizeMemberRole(member?.data?.role);
          const meetingRequired = isWorkerOwner(role);

          return (
            <EntityCard
              key={member.id}
              as="article"
              className={
                expanded
                  ? "member-directory-card member-directory-card--open"
                  : "member-directory-card"
              }
            >
              <div className="member-directory-card-head">
                <div className="member-directory-card-titles">
                  <h3 className="member-directory-card-name">
                    {member?.data?.name || member.id}
                  </h3>
                  <div className="member-directory-card-badges">
                    <span
                      className={`member-role-chip${role ? ` member-role-chip--${role}` : ""}`}
                    >
                      {roleLabel(role)}
                    </span>
                    {meetingRequired && (
                      <span className="member-role-chip member-role-chip--required">
                        meeting required
                      </span>
                    )}
                    {member?.data?.active === false && (
                      <span className="member-role-chip member-role-chip--inactive">
                        inactive
                      </span>
                    )}
                  </div>
                </div>

                <div className="member-directory-card-actions">
                  <IconButton
                    onClick={() => toggleMemberExpanded(member.id)}
                    title={expanded ? "Collapse details" : "Expand details"}
                    aria-expanded={expanded}
                  >
                    {expanded ? "▴" : "▾"}
                  </IconButton>
                  <IconButton onClick={() => startEdit(member)} title="Edit">
                    {EDIT_ICON}
                  </IconButton>
                  <IconButton
                    variant="delete"
                    onClick={() => handleDeleteMember(member)}
                    title="Delete"
                  >
                    {DELETE_ICON}
                  </IconButton>
                </div>
              </div>

              <>
                <button
                  type="button"
                  className="member-directory-card-condensed"
                  onClick={() => toggleMemberExpanded(member.id)}
                  aria-expanded={expanded}
                >
                  <div className="member-directory-card-condensed-head">
                    <span className="member-directory-meta-label">
                      Week{" "}
                      {latestWeek?.weekKey
                        ? formatWeekKeyLabel(latestWeek.weekKey)
                        : "—"}
                    </span>
                    <span className="member-directory-condensed-week">
                      {latestWeek.assigned} assigned · {latestWeek.completed}{" "}
                      done
                    </span>
                  </div>
                  <div className="member-directory-stats">
                    <span className="member-stat-chip">
                      {metric.totalTaskCount} tracked tasks
                    </span>
                    <span className="member-stat-chip">
                      {formatPlannedHoursFromUnits(metric.plannedUnits)} planned
                    </span>
                      <span className="member-stat-chip">
                        {formatUnitsAsHours(metric.finishedUnitsThisWeek)} done this week
                      </span>
                      <span className="member-stat-chip">
                        {formatUnitsAsHours(metric.finishedUnitsTotal)} done overall
                      </span>
                    <span className="member-stat-chip">
                      {metric.currentProjectCount} current projects
                    </span>
                    <span className="member-stat-chip">
                      {metric.historicalProjectCount} total projects taken
                    </span>
                  </div>
                </button>

                {expanded && (
                  <div className="member-directory-card-details">
                    <div className="member-directory-meta">
                      <div>
                        <span className="member-directory-meta-label">
                          Email
                        </span>
                        <span>{member?.data?.email || "—"}</span>
                      </div>
                      <div>
                        <span className="member-directory-meta-label">
                          Timezone
                        </span>
                        <span>{member?.data?.timezone || "—"}</span>
                      </div>
                      <div>
                        <span className="member-directory-meta-label">
                          Joined
                        </span>
                        <span>{member?.data?.joinedOn || "—"}</span>
                      </div>
                      <div>
                        <span className="member-directory-meta-label">
                          Weekly planned time
                        </span>
                        <span>
                          {formatPlannedHoursFromUnits(metric.plannedUnits)}
                        </span>
                      </div>
                    </div>

                    <div className="member-chart-section">
                      <div className="member-time-tabs" role="tablist" aria-label="Time analytics view">
                        <button
                          type="button"
                          role="tab"
                          aria-selected={timeTab === "weekly"}
                          className={
                            timeTab === "weekly"
                              ? "member-time-tab member-time-tab--active"
                              : "member-time-tab"
                          }
                          onClick={() => setMemberTimeTab(member.id, "weekly")}
                        >
                          Weekly
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={timeTab === "overall"}
                          className={
                            timeTab === "overall"
                              ? "member-time-tab member-time-tab--active"
                              : "member-time-tab"
                          }
                          onClick={() => setMemberTimeTab(member.id, "overall")}
                        >
                          Overall
                        </button>
                      </div>

                      {timeTab === "weekly" ? (
                        <>
                          <span className="member-directory-meta-label">This week</span>
                          <div className="member-kind-charts">
                            <TimeDonutChart
                              label="Time by project"
                              segments={metric.thisWeekProjectSegments}
                              emptyText="No finished project time this week."
                              ariaLabel={`project-time-week-${member.id}`}
                            />
                            <TimeDonutChart
                              label="Time by project type"
                              segments={metric.thisWeekProjectKindSegments}
                              emptyText="No finished project-type time this week."
                              ariaLabel={`project-kind-time-week-${member.id}`}
                            />
                          </div>

                          <div className="member-weekly-board">
                            {metric.weekly.map((weekly) => (
                              <div
                                key={`${member.id}-${weekly.weekKey}`}
                                className="member-weekly-item"
                              >
                                <span className="member-weekly-week">
                                  {formatWeekKeyLabel(weekly.weekKey)}
                                </span>
                                <span className="member-weekly-values">
                                  {weekly.assigned} assigned · {weekly.completed} done · {formatUnitsAsHours(weekly.finishedUnits)} finished
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="member-directory-meta-label">Overall</span>
                          <div className="member-kind-charts">
                            <TimeDonutChart
                              label="Time by project"
                              segments={metric.projectSegments}
                              emptyText="No finished project time yet."
                              ariaLabel={`project-time-all-${member.id}`}
                            />
                            <TimeDonutChart
                              label="Time by project type"
                              segments={metric.projectKindSegments}
                              emptyText="No finished project-type time yet."
                              ariaLabel={`project-kind-time-all-${member.id}`}
                            />
                          </div>

                          <div className="member-overall-board">
                            <div className="member-weekly-item">
                              <span className="member-weekly-week">Overall</span>
                              <span className="member-weekly-values">
                                {metric.assignedTotalCount} assigned · {metric.completedTotalCount} done · {formatUnitsAsHours(metric.finishedUnitsTotal)} finished
                              </span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {metric.currentProjects.length > 0 && (
                      <div className="member-current-projects">
                        <span className="member-directory-meta-label">
                          Current projects
                        </span>
                        <div className="member-project-list">
                          {metric.currentProjects.map((project) => (
                            <span
                              key={project.id}
                              className="member-project-chip"
                            >
                              {project.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {member?.data?.notes && (
                      <p className="member-notes">
                        {renderTextWithLinks(
                          member.data.notes,
                          `member-note-${member.id}`,
                        )}
                      </p>
                    )}
                  </div>
                )}
              </>
            </EntityCard>
          );
        })}
      </CollectionLayout>

      {editingMember && (
        <ModalShell
          title={editingMember.data?.name || "Edit member"}
          onClose={cancelEdit}
          footer={
            <>
              <Button
                type="button"
                size="small"
                onClick={() => saveEdit(editingMember)}
                disabled={!editDraft.name.trim()}
              >
                Save
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="small"
                onClick={cancelEdit}
              >
                Cancel
              </Button>
            </>
          }
        >
          <div className="member-form-grid">
            <label className="member-form-field">
              <span>Name</span>
              <InputField
                className="member-form-input"
                value={editDraft.name}
                onChange={(e) => updateEditField("name", e.target.value)}
                autoFocus
              />
            </label>
            <label className="member-form-field">
              <span>Type</span>
              <SelectField
                className="member-form-input"
                value={editDraft.role}
                onChange={(e) => updateEditField("role", e.target.value)}
              >
                {MEMBER_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
            </label>
            <label className="member-form-field">
              <span>Email</span>
              <InputField
                className="member-form-input"
                value={editDraft.email}
                onChange={(e) => updateEditField("email", e.target.value)}
              />
            </label>
            <label className="member-form-field">
              <span>Timezone</span>
              <InputField
                className="member-form-input"
                value={editDraft.timezone}
                onChange={(e) => updateEditField("timezone", e.target.value)}
              />
            </label>
            <label className="member-form-field">
              <span>Joined on</span>
              <InputField
                type="date"
                className="member-form-input"
                value={editDraft.joinedOn}
                onChange={(e) => updateEditField("joinedOn", e.target.value)}
              />
            </label>
            <label className="member-form-field member-form-field--toggle">
              <input
                type="checkbox"
                checked={Boolean(editDraft.active)}
                onChange={(e) => updateEditField("active", e.target.checked)}
              />
              <span>Active member</span>
            </label>
            <label className="member-form-field member-form-field--full">
              <span>Notes</span>
              <TextareaField
                className="member-form-input member-form-textarea"
                value={editDraft.notes}
                onChange={(e) => updateEditField("notes", e.target.value)}
              />
            </label>
          </div>
        </ModalShell>
      )}

      {deleteTarget && (
        <DeleteConfirmDialog
          label={deleteTarget.label}
          detail={deleteTarget.detail}
          onConfirm={deleteTarget.onConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </TabPage>
  );
}
