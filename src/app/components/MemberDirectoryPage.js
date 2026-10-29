"use client";
import WeekSelect from "./ui/WeekSelect";


import MemberTenure from "./ui/MemberTenure";
import MemberWorkRow from "./MemberWorkRow";
import AllocationClock from "./ui/AllocationClock";
import WorkspaceCreateDock from "./ui/WorkspaceCreateDock";
import BottomComposer from "./ui/BottomComposer";
import { formatPronouns, pronounsForInput } from "../lib/pronouns.mjs";
import MemberEditButton from "./ui/MemberEditButton";
import SpoonMeter from "./ui/SpoonMeter";
import MemberForm from "./MemberForm";
import TaskCreateTrigger from "./TaskCreateTrigger";
import WorkspaceViewPicker from "./ui/WorkspaceViewPicker";
import WorkspacePageHero from "./ui/WorkspacePageHero";
import TaskClockIcon from "./ui/TaskClockIcon";
import MemberMilestones from "./ui/MemberMilestones";
import { calendarDate } from "./memberMilestones.mjs";
import MemberAvatar from "./ui/MemberAvatar";
import { memberRoleMetrics, projectWorkTone } from "./memberRoleMetrics.mjs";
import MetadataPill from "./ui/MetadataPill";
import useUrlState, { isDateKey, updateUrlState } from "../hooks/useUrlState";
import { taskWeekKey, weekStartDateForTs } from "./taskBoardRules";
import { SERIES_COLORS } from "./ui/palette";
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
import { DELETE_ICON } from "./icons";
import CollectionLayout from "./ui/CollectionLayout";
import EmptyState from "./ui/EmptyState";
import EntityCard from "./ui/EntityCard";
import ModalShell from "./ui/ModalShell";
import TabPage from "./ui/TabPage";
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
const PROJECT_KIND_COLORS = SERIES_COLORS;
const PROJECT_KIND_COLOR_BY_KEY = Object.fromEntries(
  ["commissioned", "self-funded", "grant", "internal", "admin", "pass-through", "unspecified", "no-project"]
    .map((key, index) => [key, SERIES_COLORS[index]]),
);

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
    return "conic-gradient(var(--surface-quiet) 0deg 360deg)";
  }

  let start = 0;
  const parts = [];
  for (const segment of segments) {
    const end = start + segment.ratio * 360;
    parts.push(`${segment.color} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`);
    start = end;
  }
  if (start < 360) {
    parts.push(`color-mix(in srgb, var(--ink) 8%, transparent) ${start.toFixed(2)}deg 360deg`);
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
    aliases: "",
    role: "associate",
    email: "",
    timezone: "",
    joinedOn: "",
    birthday: "",
    pronouns: "",
    leftOn: "",
    photoURL: "",
    notes: "",
    active: true,
  };
}

function normalizeAlsoKnownAs(rawValue) {
  const source = Array.isArray(rawValue)
    ? rawValue
    : String(rawValue || "")
        .split(/[\n,]/)
        .map((item) => item.trim());

  return source
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .filter((item, index, all) => all.indexOf(item) === index);
}

function aliasesToInputValue(rawValue) {
  return normalizeAlsoKnownAs(rawValue).join(", ");
}

function buildFormFromMember(memberData) {
  const form = emptyMemberForm();
  if (!memberData || typeof memberData !== "object") return form;
  return {
    name: typeof memberData.name === "string" ? memberData.name : "",
    aliases: aliasesToInputValue(
      memberData.alsoKnownAs || memberData.aliases || "",
    ),
    role: normalizeMemberRole(memberData.role),
    email: typeof memberData.email === "string" ? memberData.email : "",
    timezone:
      typeof memberData.timezone === "string" ? memberData.timezone : "",
    joinedOn:
      typeof memberData.joinedOn === "string" ? memberData.joinedOn : "",
    pronouns: pronounsForInput(memberData.pronouns),
    birthday: memberData.birthday || "",
    leftOn: memberData.leftOn || "",
    photoURL: memberData.photoURL || "",
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
  const [directoryView, setDirectoryView] = useUrlState("memberView", "role", { allowed: ["role", "weekly", "overall"] });
  const currentWeek = weekStartDateForTs(Date.now()).toISOString().slice(0, 10);
  const [memberWeek] = useUrlState("memberWeek", currentWeek, { validate: isDateKey });
  const [memberEndWeek] = useUrlState("memberEndWeek", "", { validate: isDateKey });
  const endWeek = memberEndWeek >= memberWeek ? memberEndWeek : memberWeek;
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [newMember, setNewMember] = useState(() => emptyMemberForm());
  const [expandedMembers, setExpandedMembers] = useState({});
  const [today, setToday] = useState(() => calendarDate());
  useEffect(() => {
    const timer = setInterval(() => setToday(calendarDate()), 60000);
    return () => clearInterval(timer);
  }, []);
  const [highlightedMember, setHighlightedMember] = useState(null);
  const [profileId, setProfileId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(() => emptyMemberForm());
  const [notice, setNotice] = useState(null);
  const [switchingMonthKey, setSwitchingMonthKey] = useState(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [rotationOpen, setRotationOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

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
    const alsoKnownAs = normalizeAlsoKnownAs(newMember.aliases);

    try {
      await createDocument("members", {
        name,
        alsoKnownAs,
        role: normalizeMemberRole(newMember.role),
        email,
        emailLower: email,
        timezone: newMember.timezone.trim(),
        joinedOn: newMember.joinedOn || monthKeyFromTs(now) + "-01",
        pronouns: newMember.pronouns.trim(),
        birthday: newMember.birthday || null,
        leftOn: newMember.leftOn || null,
        photoURL: newMember.photoURL.trim() || null,
        notes: newMember.notes.trim(),
        active: Boolean(newMember.active),
        meetingAttendance: {},
        meetingRoles: {},
        createdAt: now,
        updatedAt: now,
      });
      setNewMember(emptyMemberForm());
      setAddMemberOpen(false);
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

  function closeMemberEditor() {
    cancelEdit();
    if (addMemberOpen) setNewMember(emptyMemberForm());
    setAddMemberOpen(false);
  }

  function toggleMemberExpanded(memberId) {
    setExpandedMembers((prev) => ({ ...prev, [memberId]: !prev[memberId] }));
  }



  async function saveEdit(member) {
    const name = editDraft.name.trim();
    if (!name) return;
    if (editDraft.leftOn && editDraft.joinedOn && editDraft.leftOn < editDraft.joinedOn) {
      setNotice({ error: true, text: "The leaving date must be on or after the join date." });
      return;
    }
    const now = Date.now();
    const email = normalizeEmailValue(editDraft.email);
    const alsoKnownAs = normalizeAlsoKnownAs(editDraft.aliases);
    try {
      await replaceDocument("members", member.id, {
        ...member.data,
        name,
        alsoKnownAs,
        role: normalizeMemberRole(editDraft.role),
        email,
        emailLower: email,
        timezone: editDraft.timezone.trim(),
        joinedOn: editDraft.joinedOn || null,
        pronouns: editDraft.pronouns.trim(),
        birthday: editDraft.birthday || null,
        leftOn: editDraft.leftOn || null,
        photoURL: editDraft.photoURL.trim() || null,
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
      onConfirm: async (reason) => {
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
          await deleteDocument("members", member.id, reason);
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

  const roleMetricsById = useMemo(() => Object.fromEntries(membersSorted.map(member => [member.id, memberRoleMetrics(member.id, tasks, projects, Date.now(), directoryView, { start: memberWeek, end: endWeek })])), [membersSorted, tasks, projects, today, directoryView, memberWeek, endWeek]);
  const directoryMembers = [...membersSorted].sort((a,b) => directoryView === "role" ? 0 : roleMetricsById[b.id].total-roleMetricsById[a.id].total);
  const activeDirectoryMembers = directoryMembers.filter(member => member.data?.active !== false);
  const inactiveDirectoryMembers = directoryMembers.filter(member => member.data?.active === false);

  const weekOptions = [...new Set([currentWeek, memberWeek, endWeek, ...tasks.map(task => taskWeekKey(task.data)).filter(Boolean)])].sort().reverse();
  const periodLabel = directoryView === "overall" ? "All recorded weeks" : directoryView === "weekly" ? (memberWeek === endWeek ? formatWeekKeyLabel(memberWeek) : `${formatWeekKeyLabel(memberWeek)} to ${formatWeekKeyLabel(endWeek)}`) : "Last four weeks";
  const chartAllocations = directoryView === "role"
    ? MEMBER_TYPE_OPTIONS.map(option => ({ id: option.value, name: option.label, units: activeDirectoryMembers.filter(member => normalizeMemberRole(member.data.role) === option.value).reduce((sum, member) => sum + roleMetricsById[member.id].total, 0) }))
    : (directoryView === "overall" ? directoryMembers : activeDirectoryMembers).map(member => ({ id: member.id, name: member.data?.name || member.id, units: roleMetricsById[member.id].total }));
  const highlightKey = member => directoryView === "role" ? normalizeMemberRole(member.data?.role) : member.id;

  function renderMemberGroup(title, group, key) {
    if (!group.length) return null;
    return <section key={key} className={`member-role-section${key === 'inactive' ? ' member-role-section--inactive' : ''}`}>
      <div className="member-role-heading"><h2>{title}</h2><span className="task-scope-count">{group.length}</span>

      </div>
      <CollectionLayout variant="grid" className="member-role-list">{group.map(renderRoleMember)}</CollectionLayout>
    </section>;
  }

  function renderRoleMember(member) {
    return <MemberWorkRow key={member.id} member={member} metric={roleMetricsById[member.id]} mode={directoryView} periodLabel={periodLabel} roleTitle={roleLabel(member.data?.role)} today={today} formatTime={formatUnitsAsHours} weekLabel={formatWeekKeyLabel} onProfile={() => setProfileId(member.id)} onEdit={() => startEdit(member)} highlighted={highlightedMember===highlightKey(member)} dimmed={Boolean(highlightedMember && highlightedMember!==highlightKey(member))} />;
  }

  useEffect(() => setHighlightedMember(null), [directoryView, memberWeek, endWeek]);

  const profileMember = membersSorted.find(member => member.id === profileId);
  const editingMember = membersSorted.find((m) => m.id === editingId) ?? null;

  return (
    <TabPage
      className={`member-directory-page member-directory-page--${directoryView}`}
      title="Members"
      header={<WorkspacePageHero title="Members" illustration="member-team"><WorkspaceViewPicker label="Member view" value={directoryView} onChange={setDirectoryView} options={[{ value: "role", label: "Role" }, { value: "weekly", label: "Weekly" }, { value: "overall", label: "Overall" }]} /></WorkspacePageHero>}
    >
      <WorkspaceCreateDock label="New member" expanded={addMemberOpen} onClick={() => setAddMemberOpen(true)} />
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



      {directoryView === "weekly" && <div className="member-week-controls" aria-label="Member allocation period">
        <label className="task-week-control"><span>Week / from</span><WeekSelect aria-label="Member start week" value={memberWeek} onChange={event => updateUrlState({memberWeek: event.target.value, memberEndWeek: memberEndWeek && memberEndWeek >= event.target.value ? memberEndWeek : null})}>{weekOptions.map(week => <option key={week} value={week}>{formatWeekKeyLabel(week)} · {week.slice(0,4)}</option>)}</WeekSelect></label>
        <label className="task-week-control"><span>Through</span><WeekSelect aria-label="Member end week" value={memberEndWeek && memberEndWeek >= memberWeek ? memberEndWeek : ""} onChange={event => updateUrlState({memberEndWeek: event.target.value || null})}><option value="">Single week</option>{weekOptions.filter(week => week >= memberWeek).map(week => <option key={week} value={week}>{formatWeekKeyLabel(week)} · {week.slice(0,4)}</option>)}</WeekSelect></label>
      </div>}
      <section className="member-allocation-overview" aria-label={`${periodLabel} allocation by ${directoryView === "role" ? "role" : "member"}`}>
        <AllocationClock variant="member" subject={directoryView === "role" ? "Role" : "Member"} valueMode={directoryView === "role" ? "percent" : "time"} periodLabel={periodLabel} allocations={chartAllocations.sort((a,b) => b.units-a.units || a.name.localeCompare(b.name))} formatTime={formatUnitsAsHours} highlightedId={highlightedMember} onHighlight={setHighlightedMember} />
      </section>

      {membersSorted.length === 0 ? <EmptyState>No members yet.</EmptyState> : <div className="member-role-sections">
        {directoryView === "role" ? MEMBER_TYPE_OPTIONS.map(option => renderMemberGroup(`${option.label}s`, activeDirectoryMembers.filter(member => normalizeMemberRole(member.data.role) === option.value), option.value)) : <CollectionLayout variant="grid" className="member-role-list">{activeDirectoryMembers.map(renderRoleMember)}</CollectionLayout>}
        {renderMemberGroup("Inactive members", inactiveDirectoryMembers, "inactive")}
      </div>}





      {profileMember && <ModalShell title={`${profileMember.data?.name || profileMember.id} · Profile`} onClose={() => setProfileId(null)} footer={<Button onClick={() => { startEdit(profileMember); setProfileId(null); }}>Edit profile</Button>}>
        <div className="member-profile-details">
          <MemberAvatar member={profileMember} onClick={() => { startEdit(profileMember); setProfileId(null); }} />
          <MetadataPill tone="project">{roleLabel(profileMember.data?.role)}</MetadataPill>
          <MemberTenure member={profileMember} today={today}/>
          <MemberMilestones member={profileMember} today={today} />
          <dl><dt>Pronouns</dt><dd>{formatPronouns(profileMember.data?.pronouns) || "Not set"}</dd><dt>Birthday</dt><dd>{profileMember.data?.birthday ? new Date(profileMember.data.birthday + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : 'Not set'}</dd><dt>Joined</dt><dd>{profileMember.data?.joinedOn || 'Date not set'}</dd><dt>Email</dt><dd>{profileMember.data?.email || 'Not set'}</dd><dt>Timezone</dt><dd>{profileMember.data?.timezone || 'Not set'}</dd></dl>
          {profileMember.data?.notes && <p>{renderTextWithLinks(profileMember.data.notes, `profile-${profileMember.id}`)}</p>}
        </div>
      </ModalShell>}

      {editingMember && <ModalShell className="member-editor-modal" title={editingMember ? `Edit ${editingMember.data?.name || 'member'}` : 'New member'} onClose={closeMemberEditor}>
        <MemberForm draft={editingMember ? editDraft : newMember} onChange={editingMember ? updateEditField : updateNewMemberField} roleOptions={MEMBER_TYPE_OPTIONS} creating={!editingMember} onCancel={closeMemberEditor} onSubmit={event => { event.preventDefault(); if (editingMember) saveEdit(editingMember); else handleCreateMember(event); }} />
      </ModalShell>}

      {addMemberOpen && <BottomComposer title="New member" onClose={closeMemberEditor}>
        <MemberForm draft={newMember} onChange={updateNewMemberField} roleOptions={MEMBER_TYPE_OPTIONS} creating onCancel={closeMemberEditor} onSubmit={handleCreateMember} />
      </BottomComposer>}

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
