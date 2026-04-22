"use client";

import { useEffect, useState, useMemo } from "react";
import {
  subscribeCollection,
  createDocument,
  replaceDocument,
  deleteDocument,
} from "../../firestore";
import { firebaseReady } from "../../firebase";
import Button from "./Button";
import IconButton from "./IconButton";
import RichEditor from "./RichEditor";
import {
  BOOK_GRID_ICON,
  BOOK_SHELF_ICON,
  DATE_VIEW_ICON,
  DELETE_ICON,
  EDIT_ICON,
  PROJECT_VIEW_ICON,
} from "./icons";
import CollectionLayout from "./ui/CollectionLayout";
import EmptyState from "./ui/EmptyState";
import InputField from "./ui/InputField";
import PageControls from "./ui/PageControls";
import { SURFACE_TEXTURES } from "./ui/paperTextures";
import SearchField from "./ui/SearchField";
import SelectField from "./ui/SelectField";
import SectionBlock from "./ui/SectionBlock";
import TabPage from "./ui/TabPage";
import ViewToggle from "./ui/ViewToggle";
import DeleteConfirmDialog from "./ui/DeleteConfirmDialog";
import ModalShell from "./ui/ModalShell";

const NOTE_SCOPE_DATE = "date";
const NOTE_SCOPE_PROJECT = "project";
const MEETING_ROTATION = ["facilitator", "notetaker", "time keeper"];

const ROLE_FIELDS = [
  { key: "facilitatorId", label: "Facilitator" },
  { key: "timekeeperId", label: "Timekeeper" },
  { key: "notetakerId", label: "Notetaker" },
];

const BOOK_PALETTE = [
  { spine: "#b98f6f", cover: "#f3e6d8", ink: "#5f4330" },
  { spine: "#b08f82", cover: "#f2e3dc", ink: "#5a3d3d" },
  { spine: "#9f9b7d", cover: "#ece9d7", ink: "#48553c" },
  { spine: "#a9968a", cover: "#efe4d9", ink: "#4f465d" },
  { spine: "#b7a27a", cover: "#f3ead8", ink: "#5f4f2a" },
  { spine: "#8e9eb2", cover: "#e7edf5", ink: "#2d486a" },
  { spine: "#8da88a", cover: "#e8f0e6", ink: "#2f5a35" },
];

function hashText(value) {
  const text = String(value || "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getNoteBookStyle(noteId) {
  const hash = hashText(noteId);
  const palette = BOOK_PALETTE[hash % BOOK_PALETTE.length];
  const patternIndex = hash % 6;
  return {
    style: {
      "--book-spine": palette.spine,
      "--book-cover": palette.cover,
      "--book-ink": palette.ink,
      "--book-height": `${156 + (hash % 34)}px`,
      "--book-tilt": `${(hash % 7) - 3}deg`,
      "--book-band-top": `${12 + (hash % 48)}%`,
      "--book-band-opacity": `${0.13 + ((hash >> 3) % 6) * 0.03}`,
      "--book-grain-opacity": `${0.06 + ((hash >> 5) % 4) * 0.03}`,
    },
    patternClass: `note-item--pattern-${patternIndex}`,
  };
}

function buildStarterNoteContent(title, scopeType, projectName) {
  const heading = String(title || "Meeting notes").trim() || "Meeting notes";
  const scopeLine =
    scopeType === NOTE_SCOPE_PROJECT && projectName
      ? `Project: ${projectName}`
      : "General meeting";

  return [
    `<p><strong>${heading}</strong></p>`,
    `<p><em>${scopeLine}</em></p>`,
    "<p><strong>Agenda</strong></p>",
    "<ul><li>Updates</li><li>Decisions</li><li>Blockers</li></ul>",
    "<p><strong>Next steps</strong></p>",
    "<ul><li>Owner and follow-up</li></ul>",
  ].join("");
}

function normalizeScopeType(raw) {
  return raw === NOTE_SCOPE_PROJECT ? NOTE_SCOPE_PROJECT : NOTE_SCOPE_DATE;
}

function normalizeExternalUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function formatLinkLabel(rawUrl) {
  const normalized = normalizeExternalUrl(rawUrl);
  if (!normalized) return "";
  try {
    const parsed = new URL(normalized);
    return parsed.hostname.replace(/^www\./i, "") || normalized;
  } catch {
    return normalized;
  }
}

function isLinkOnlyNote(noteData) {
  const hasLink = Boolean(normalizeExternalUrl(noteData?.linkUrl));
  const hasContent = Boolean(String(noteData?.content || "").trim());
  return hasLink && !hasContent;
}

function emptyRoleAssignments() {
  return {
    facilitatorId: "",
    timekeeperId: "",
    notetakerId: "",
    meetingParticipantIds: [],
    absentParticipantIds: [],
  };
}

function normalizeRoleAssignments(data) {
  const next = emptyRoleAssignments();
  if (!data || typeof data !== "object") return next;
  for (const field of ROLE_FIELDS) {
    const value = data[field.key];
    next[field.key] = typeof value === "string" ? value : "";
  }
  next.meetingParticipantIds = normalizeIdList(data.meetingParticipantIds);
  next.absentParticipantIds = normalizeIdList(data.absentParticipantIds).filter(
    (id) => next.meetingParticipantIds.includes(id),
  );
  return next;
}

function emptyEditMeta() {
  return {
    title: "",
    noteDate: "",
    linkUrl: "",
    scopeType: NOTE_SCOPE_DATE,
    projectId: "",
    ...emptyRoleAssignments(),
  };
}

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

function isWorkerOwner(roleValue) {
  return normalizeMemberRole(roleValue) === "worker-owner";
}

function parseMonthSerial(monthKey) {
  const [yearRaw, monthRaw] = String(monthKey || "").split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return 0;
  return year * 12 + Math.max(0, month - 1);
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

function normalizeIdList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item : ""))
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((id, index, all) => all.indexOf(id) === index);
}

function getProjectTeamMemberIds(projectId, projects) {
  if (!projectId) return [];
  const project = (projects || []).find((item) => item.id === projectId);
  if (!project) return [];
  const staffing = Array.isArray(project.data?.staffing)
    ? project.data.staffing
    : [];
  return staffing
    .map((entry) => (typeof entry?.memberId === "string" ? entry.memberId : ""))
    .map((id) => id.trim())
    .filter(Boolean)
    .filter((id, index, all) => all.indexOf(id) === index);
}

export default function MeetingNotesPage() {
  const [notes, setNotes] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newScopeType, setNewScopeType] = useState(NOTE_SCOPE_DATE);
  const [newProjectId, setNewProjectId] = useState("");
  const [newRoles, setNewRoles] = useState(() => emptyRoleAssignments());

  const [viewingId, setViewingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [editMeta, setEditMeta] = useState(() => emptyEditMeta());

  const [searchQuery, setSearchQuery] = useState("");
  const [groupMode, setGroupMode] = useState("date");
  const [notesLayout, setNotesLayout] = useState("grid");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [currentUsername, setCurrentUsername] = useState("");

  const [members, setMembers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [resources, setResources] = useState([]);

  useEffect(() => {
    if (!firebaseReady) return;
    return subscribeCollection("meetingNotes", (items) => {
      setNotes(
        items.sort(
          (a, b) =>
            Number(b.data.createdAt || 0) - Number(a.data.createdAt || 0),
        ),
      );
    });
  }, []);

  useEffect(() => {
    if (!firebaseReady) return;
    const u1 = subscribeCollection("members", setMembers);
    const u2 = subscribeCollection("projects", setProjects);
    const u3 = subscribeCollection("tasks", setTasks);
    const u4 = subscribeCollection("resources", setResources);
    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        if (!res.ok) return;
        const payload = await res.json();
        if (cancelled) return;
        const username = String(payload?.username || "")
          .trim()
          .toLowerCase();
        if (username) setCurrentUsername(username);
      } catch {
        // Metadata should still render even when session lookup fails.
      }
    }

    loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const memberNameById = useMemo(() => {
    const map = {};
    for (const member of members) {
      map[member.id] = member?.data?.name || member.id;
    }
    return map;
  }, [members]);

  const projectNameById = useMemo(() => {
    const map = {};
    for (const project of projects) {
      map[project.id] = project?.data?.name || project.id;
    }
    return map;
  }, [projects]);

  const defaultMeetingRoles = useMemo(() => {
    const now = new Date();
    const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const monthSerial = parseMonthSerial(monthKey);

    const workerOwners = [...members]
      .filter((member) => isWorkerOwner(member?.data?.role))
      .sort((a, b) => {
        const left = String(a?.data?.name || a.id || "").toLowerCase();
        const right = String(b?.data?.name || b.id || "").toLowerCase();
        return left.localeCompare(right);
      });

    const roleToMemberId = {};
    for (let index = 0; index < workerOwners.length; index++) {
      const member = workerOwners[index];
      const fallbackRole =
        MEETING_ROTATION[(monthSerial + index) % MEETING_ROTATION.length];
      const explicitRoles = member?.data?.meetingRoles;
      const explicitRole =
        explicitRoles && typeof explicitRoles === "object"
          ? normalizeMeetingDutyRole(explicitRoles[monthKey])
          : null;
      const role = explicitRole || fallbackRole;
      if (!roleToMemberId[role]) {
        roleToMemberId[role] = member.id;
      }
    }

    return {
      facilitatorId: roleToMemberId["facilitator"] || "",
      timekeeperId: roleToMemberId["time keeper"] || "",
      notetakerId: roleToMemberId.notetaker || "",
    };
  }, [members]);

  useEffect(() => {
    setNewRoles((prev) => {
      if (prev.facilitatorId || prev.timekeeperId || prev.notetakerId)
        return prev;
      return {
        facilitatorId: defaultMeetingRoles.facilitatorId,
        timekeeperId: defaultMeetingRoles.timekeeperId,
        notetakerId: defaultMeetingRoles.notetakerId,
      };
    });
  }, [defaultMeetingRoles]);

  const filteredNotes = useMemo(() => {
    if (!searchQuery) return notes.map((n) => ({ ...n, matchType: null }));

    const query = searchQuery.toLowerCase();
    return notes
      .filter((note) => {
        const title = (note?.data?.title || "").toLowerCase();
        const content = (note?.data?.content || "").toLowerCase();
        const linkUrl = normalizeExternalUrl(
          note?.data?.linkUrl || "",
        ).toLowerCase();
        const scopeType = normalizeScopeType(note?.data?.scopeType);
        const scopeLabel =
          scopeType === NOTE_SCOPE_PROJECT ? "project-based" : "date-based";
        const projectName = note?.data?.projectId
          ? (projectNameById[note.data.projectId] || "").toLowerCase()
          : "";
        const roleNames = ROLE_FIELDS.map((field) =>
          (memberNameById[note?.data?.[field.key]] || "").toLowerCase(),
        ).join(" ");

        const haystack = `${title} ${content} ${linkUrl} ${scopeLabel} ${projectName} ${roleNames}`;
        return haystack.includes(query);
      })
      .map((note) => {
        const title = (note?.data?.title || "").toLowerCase();
        const content = (note?.data?.content || "").toLowerCase();
        const linkUrl = normalizeExternalUrl(
          note?.data?.linkUrl || "",
        ).toLowerCase();
        const projectName = note?.data?.projectId
          ? (projectNameById[note.data.projectId] || "").toLowerCase()
          : "";
        let matchType = "content";
        if (title.includes(query)) matchType = "title";
        else if (linkUrl.includes(query)) matchType = "link";
        else if (projectName.includes(query)) matchType = "project";
        return { ...note, matchType };
      });
  }, [notes, searchQuery, memberNameById, projectNameById]);

  const groupedNotesByDate = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();
    const yesterdayTime = todayTime - 86400000;
    const weekAgoTime = todayTime - 604800000;

    return {
      today: filteredNotes.filter(
        (n) => Number(n.data.createdAt || 0) >= todayTime,
      ),
      yesterday: filteredNotes.filter((n) => {
        const t = Number(n.data.createdAt || 0);
        return t >= yesterdayTime && t < todayTime;
      }),
      thisWeek: filteredNotes.filter((n) => {
        const t = Number(n.data.createdAt || 0);
        return t >= weekAgoTime && t < yesterdayTime;
      }),
      older: filteredNotes.filter(
        (n) => Number(n.data.createdAt || 0) < weekAgoTime,
      ),
    };
  }, [filteredNotes]);

  const groupedNotesByProject = useMemo(() => {
    const scopedProjectNotes = filteredNotes.filter(
      (n) => normalizeScopeType(n?.data?.scopeType) === NOTE_SCOPE_PROJECT,
    );
    const dateScopedNotes = filteredNotes.filter(
      (n) => normalizeScopeType(n?.data?.scopeType) === NOTE_SCOPE_DATE,
    );

    const grouped = {};
    for (const note of scopedProjectNotes) {
      const projectId = note?.data?.projectId || "__no_project__";
      if (!grouped[projectId]) grouped[projectId] = [];
      grouped[projectId].push(note);
    }

    const sections = [];
    const sortedProjects = [...projects].sort((a, b) => {
      const left = String(a?.data?.name || a.id || "").toLowerCase();
      const right = String(b?.data?.name || b.id || "").toLowerCase();
      return left.localeCompare(right);
    });

    for (const project of sortedProjects) {
      const list = grouped[project.id];
      if (!list || list.length === 0) continue;
      sections.push({
        key: project.id,
        title: project?.data?.name || project.id,
        notesList: list,
      });
      delete grouped[project.id];
    }

    if (grouped.__no_project__?.length) {
      sections.push({
        key: "__no_project__",
        title: "Project-based (No Project Selected)",
        notesList: grouped.__no_project__,
      });
      delete grouped.__no_project__;
    }

    for (const [projectId, list] of Object.entries(grouped)) {
      if (!list?.length) continue;
      sections.push({
        key: `unknown-${projectId}`,
        title: `Unknown Project (${projectId})`,
        notesList: list,
      });
    }

    if (dateScopedNotes.length > 0) {
      sections.unshift({
        key: "__date_based__",
        title: "Date-based",
        notesList: dateScopedNotes,
      });
    }

    return sections;
  }, [filteredNotes, projects]);

  function formatDateInTitle(ts) {
    const date = new Date(Number(ts || 0));
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = String(date.getFullYear()).slice(-2);
    return `${month}${day}${year}`;
  }

  function formatDateInputValue(ts) {
    const date = new Date(Number(ts || 0));
    if (Number.isNaN(date.getTime())) return "";
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseDateInputToTimestamp(inputValue, fallbackTs) {
    const raw = String(inputValue || "").trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return Number(fallbackTs || Date.now());
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const next = new Date(year, month - 1, day);
    if (Number.isNaN(next.getTime())) return Number(fallbackTs || Date.now());
    return next.getTime();
  }

  function formatAuditTimestamp(ts) {
    const date = new Date(Number(ts || 0));
    if (Number.isNaN(date.getTime())) return "Unknown time";
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function formatAuditUser(username) {
    const value = String(username || "").trim();
    return value || "Unknown";
  }

  function formatUpdatedTime(ts) {
    return new Date(Number(ts || 0)).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function projectLabel(projectId) {
    if (!projectId) return "No project selected";
    return projectNameById[projectId] || `Unknown project (${projectId})`;
  }

  function roleLabel(memberId) {
    if (!memberId) return "";
    return memberNameById[memberId] || `Unknown member (${memberId})`;
  }

  function updateNewRole(field, memberId) {
    if (typeof field === "function") {
      setNewRoles(field);
      return;
    }
    setNewRoles((prev) => ({ ...prev, [field]: memberId }));
  }

  function updateEditMeta(field, value) {
    if (typeof field === "function") {
      setEditMeta(field);
      return;
    }
    setEditMeta((prev) => ({ ...prev, [field]: value }));
  }

  function openNote(noteId) {
    setViewingId(noteId);
    setEditingId(null);
  }

  function updateMetaParticipantSelection(setter, field, memberId, checked) {
    setter((prev) => {
      const currentParticipants = normalizeIdList(prev.meetingParticipantIds);
      const currentAbsent = normalizeIdList(prev.absentParticipantIds);

      if (field === "meetingParticipantIds") {
        const nextParticipants = checked
          ? [...currentParticipants, memberId]
          : currentParticipants.filter((id) => id !== memberId);
        const uniqueParticipants = normalizeIdList(nextParticipants);
        return {
          ...prev,
          meetingParticipantIds: uniqueParticipants,
          absentParticipantIds: currentAbsent.filter((id) =>
            uniqueParticipants.includes(id),
          ),
        };
      }

      const participants = currentParticipants.includes(memberId)
        ? currentParticipants
        : [...currentParticipants, memberId];
      const nextAbsent = checked
        ? [...currentAbsent, memberId]
        : currentAbsent.filter((id) => id !== memberId);

      return {
        ...prev,
        meetingParticipantIds: normalizeIdList(participants),
        absentParticipantIds: normalizeIdList(nextAbsent),
      };
    });
  }

  function getMeetingMemberOptions(meta) {
    const projectTeamIds = normalizeIdList(
      getProjectTeamMemberIds(meta.projectId, projects),
    );
    const selectedIds = normalizeIdList(meta.meetingParticipantIds);
    const roleIds = normalizeIdList([
      meta.facilitatorId,
      meta.timekeeperId,
      meta.notetakerId,
    ]);
    const seedIds = [...projectTeamIds, ...selectedIds, ...roleIds];

    const optionIds =
      seedIds.length > 0
        ? seedIds.filter((id, index, all) => all.indexOf(id) === index)
        : members.map((member) => member.id);

    return optionIds
      .map((id) => members.find((member) => member.id === id))
      .filter(Boolean)
      .sort((a, b) => {
        const left = String(a?.data?.name || a.id || "").toLowerCase();
        const right = String(b?.data?.name || b.id || "").toLowerCase();
        return left.localeCompare(right);
      });
  }

  function startEditing(note) {
    const normalizedAssignments = normalizeRoleAssignments(note?.data);
    const fallbackProjectTeamIds = getProjectTeamMemberIds(
      note?.data?.projectId || "",
      projects,
    );
    const participantIds =
      normalizedAssignments.meetingParticipantIds.length > 0
        ? normalizedAssignments.meetingParticipantIds
        : fallbackProjectTeamIds;
    setEditingId(note.id);
    setViewingId(note.id);
    setEditContent(note?.data?.content || "");
    setEditMeta({
      title: note?.data?.title || "",
      noteDate: formatDateInputValue(note?.data?.createdAt || Date.now()),
      linkUrl: note?.data?.linkUrl || "",
      scopeType: normalizeScopeType(note?.data?.scopeType),
      projectId: note?.data?.projectId || "",
      facilitatorId:
        normalizedAssignments.facilitatorId ||
        defaultMeetingRoles.facilitatorId,
      timekeeperId:
        normalizedAssignments.timekeeperId || defaultMeetingRoles.timekeeperId,
      notetakerId:
        normalizedAssignments.notetakerId || defaultMeetingRoles.notetakerId,
      meetingParticipantIds: participantIds,
      absentParticipantIds: normalizedAssignments.absentParticipantIds.filter(
        (id) => participantIds.includes(id),
      ),
    });
  }

  async function handleCreateNote() {
    if (!newTitle.trim()) return;
    const scopeType = normalizeScopeType(newScopeType);
    const normalizedLinkUrl = normalizeExternalUrl(newLinkUrl);
    const isLinkOnly = Boolean(normalizedLinkUrl);
    const projectName =
      scopeType === NOTE_SCOPE_PROJECT ? projectLabel(newProjectId || "") : "";
    const authorUsername = String(currentUsername || "")
      .trim()
      .toLowerCase();
    const now = Date.now();
    try {
      await createDocument("meetingNotes", {
        title: newTitle.trim(),
        linkUrl: normalizedLinkUrl || null,
        content: normalizedLinkUrl
          ? ""
          : buildStarterNoteContent(newTitle.trim(), scopeType, projectName),
        scopeType,
        projectId:
          scopeType === NOTE_SCOPE_PROJECT ? newProjectId || null : null,
        facilitatorId: isLinkOnly ? null : newRoles.facilitatorId || null,
        timekeeperId: isLinkOnly ? null : newRoles.timekeeperId || null,
        notetakerId: isLinkOnly ? null : newRoles.notetakerId || null,
        meetingParticipantIds:
          scopeType === NOTE_SCOPE_PROJECT && !isLinkOnly
            ? normalizeIdList(newRoles.meetingParticipantIds)
            : [],
        absentParticipantIds:
          scopeType === NOTE_SCOPE_PROJECT && !isLinkOnly
            ? normalizeIdList(newRoles.absentParticipantIds).filter((id) =>
                normalizeIdList(newRoles.meetingParticipantIds).includes(id),
              )
            : [],
        createdAt: now,
        updatedAt: now,
        createdByUsername: authorUsername || null,
        updatedByUsername: authorUsername || null,
      });
      setNewTitle("");
      setNewLinkUrl("");
      setNewScopeType(NOTE_SCOPE_DATE);
      setNewProjectId("");
      setNewRoles({
        facilitatorId: defaultMeetingRoles.facilitatorId,
        timekeeperId: defaultMeetingRoles.timekeeperId,
        notetakerId: defaultMeetingRoles.notetakerId,
        meetingParticipantIds: [],
        absentParticipantIds: [],
      });
    } catch (error) {
      console.error("Could not create note:", error);
    }
  }

  async function handleSaveEdit(noteId) {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;

    const title = editMeta.title.trim();
    if (!title) return;

    const scopeType = normalizeScopeType(editMeta.scopeType);
    const normalizedLinkUrl = normalizeExternalUrl(editMeta.linkUrl);
    const nextCreatedAt = parseDateInputToTimestamp(
      editMeta.noteDate,
      note.data.createdAt,
    );
    const editorUsername = String(currentUsername || "")
      .trim()
      .toLowerCase();
    const isLinkOnly =
      Boolean(normalizedLinkUrl) && !Boolean(String(editContent || "").trim());
    try {
      await replaceDocument("meetingNotes", noteId, {
        ...note.data,
        title,
        createdAt: nextCreatedAt,
        linkUrl: normalizedLinkUrl || null,
        content: editContent,
        scopeType,
        projectId:
          scopeType === NOTE_SCOPE_PROJECT ? editMeta.projectId || null : null,
        facilitatorId: isLinkOnly ? null : editMeta.facilitatorId || null,
        timekeeperId: isLinkOnly ? null : editMeta.timekeeperId || null,
        notetakerId: isLinkOnly ? null : editMeta.notetakerId || null,
        meetingParticipantIds:
          scopeType === NOTE_SCOPE_PROJECT && !isLinkOnly
            ? normalizeIdList(editMeta.meetingParticipantIds)
            : [],
        absentParticipantIds:
          scopeType === NOTE_SCOPE_PROJECT && !isLinkOnly
            ? normalizeIdList(editMeta.absentParticipantIds).filter((id) =>
                normalizeIdList(editMeta.meetingParticipantIds).includes(id),
              )
            : [],
        updatedAt: Date.now(),
        updatedByUsername:
          editorUsername || note.data.updatedByUsername || null,
      });
      setEditingId(null);
      if (isLinkOnly) setViewingId(null);
    } catch (error) {
      console.error("Could not save note:", error);
    }
  }

  async function handleDeleteNote(noteId, noteTitle) {
    setDeleteTarget({
      label: noteTitle || "this note",
      onConfirm: async () => {
        try {
          await deleteDocument("meetingNotes", noteId);
          if (viewingId === noteId) setViewingId(null);
          if (editingId === noteId) setEditingId(null);
        } catch (error) {
          console.error("Could not delete note:", error);
        } finally {
          setDeleteTarget(null);
        }
      },
    });
  }

  function renderRoleSummary(noteData) {
    const roles = normalizeRoleAssignments(noteData);
    const chips = [];

    for (const field of ROLE_FIELDS) {
      const memberId = roles[field.key];
      const name = roleLabel(memberId);
      if (!name) continue;
      chips.push(
        <span key={`${field.key}-${memberId}`} className="note-role-chip">
          {field.label}: {name}
        </span>,
      );
    }

    const participantIds = normalizeIdList(noteData?.meetingParticipantIds);
    const absentIds = normalizeIdList(noteData?.absentParticipantIds).filter(
      (id) => participantIds.includes(id),
    );
    if (participantIds.length > 0) {
      const presentCount = Math.max(
        0,
        participantIds.length - absentIds.length,
      );
      chips.push(
        <span
          key="meeting-count"
          className="note-role-chip note-role-chip--meeting"
        >
          In meeting: {presentCount}/{participantIds.length}
        </span>,
      );
    }

    if (absentIds.length > 0) {
      chips.push(
        <span
          key="meeting-absent"
          className="note-role-chip note-role-chip--absent"
        >
          Absent: {absentIds.map((id) => roleLabel(id)).join(", ")}
        </span>,
      );
    }

    if (chips.length === 0) {
      return (
        <span className="note-role-chip note-role-chip--empty">
          Roles not set
        </span>
      );
    }

    return chips;
  }

  function renderMeetingAttendanceDetail(noteData) {
    const participantIds = normalizeIdList(noteData?.meetingParticipantIds);
    if (participantIds.length === 0) return null;

    const absentIds = normalizeIdList(noteData?.absentParticipantIds).filter(
      (id) => participantIds.includes(id),
    );
    const presentIds = participantIds.filter((id) => !absentIds.includes(id));

    return (
      <div className="note-attendance-block">
        <div className="note-attendance-group">
          <span className="note-attendance-label">Present</span>
          <div className="note-attendance-chips">
            {presentIds.length ? (
              presentIds.map((id) => (
                <span
                  key={`present-${id}`}
                  className="note-role-chip note-role-chip--meeting"
                >
                  {roleLabel(id)}
                </span>
              ))
            ) : (
              <span className="note-role-chip note-role-chip--empty">
                None marked present
              </span>
            )}
          </div>
        </div>
        {absentIds.length > 0 && (
          <div className="note-attendance-group">
            <span className="note-attendance-label">Missing this meeting</span>
            <div className="note-attendance-chips">
              {absentIds.map((id) => (
                <span
                  key={`absent-${id}`}
                  className="note-role-chip note-role-chip--absent"
                >
                  {roleLabel(id)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderRoleSelectors(meta, onChange) {
    const normalizedMeta = {
      ...meta,
      meetingParticipantIds: normalizeIdList(meta.meetingParticipantIds),
      absentParticipantIds: normalizeIdList(meta.absentParticipantIds),
    };
    const meetingMemberOptions = getMeetingMemberOptions(normalizedMeta);

    return (
      <div className="note-role-grid">
        {ROLE_FIELDS.map((field) => (
          <label key={field.key} className="note-meta-field">
            <span>{field.label}</span>
            <SelectField
              className="note-meta-input"
              value={meta[field.key] || ""}
              onChange={(e) => onChange(field.key, e.target.value)}
            >
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member?.data?.name || member.id}
                </option>
              ))}
            </SelectField>
          </label>
        ))}
        {normalizeScopeType(normalizedMeta.scopeType) ===
          NOTE_SCOPE_PROJECT && (
          <div className="note-meta-field note-meta-field--wide">
            <span>Meeting attendees</span>
            <div className="meeting-attendees-list">
              {meetingMemberOptions.length === 0 ? (
                <p className="note-role-chip note-role-chip--empty">
                  No members available for this project yet.
                </p>
              ) : (
                meetingMemberOptions.map((member) => {
                  const memberId = member.id;
                  const inMeeting =
                    normalizedMeta.meetingParticipantIds.includes(memberId);
                  const absent =
                    normalizedMeta.absentParticipantIds.includes(memberId);
                  return (
                    <div key={memberId} className="meeting-attendee-row">
                      <label className="meeting-attendee-main">
                        <input
                          type="checkbox"
                          checked={inMeeting}
                          onChange={(event) =>
                            updateMetaParticipantSelection(
                              onChange,
                              "meetingParticipantIds",
                              memberId,
                              event.target.checked,
                            )
                          }
                        />
                        <span>{member?.data?.name || memberId}</span>
                      </label>
                      {inMeeting && (
                        <label className="meeting-attendee-absent">
                          <input
                            type="checkbox"
                            checked={absent}
                            onChange={(event) =>
                              updateMetaParticipantSelection(
                                onChange,
                                "absentParticipantIds",
                                memberId,
                                event.target.checked,
                              )
                            }
                          />
                          <span>Misses this meeting</span>
                        </label>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderNoteSection(title, notesList) {
    if (!notesList.length) return null;

    return (
      <SectionBlock
        key={title}
        className="notes-section"
        title={title}
        titleTag="h3"
        bodyClassName="notes-section-body"
      >
        <ul className={`notes-list notes-list--${notesLayout}`}>
          {notesList.map((note) => {
            const scopeType = normalizeScopeType(note?.data?.scopeType);
            const projectId = note?.data?.projectId || "";
            const bookStyle = getNoteBookStyle(note.id);
            const isLinkShortcut = isLinkOnlyNote(note?.data);
            const shortcutHref = normalizeExternalUrl(note?.data?.linkUrl);
            const shortcutLabel = formatLinkLabel(note?.data?.linkUrl);

            return (
              <li
                key={note.id}
                className={`note-item ${bookStyle.patternClass}${isLinkShortcut ? " note-item--link-shortcut" : ""}`}
                style={bookStyle.style}
                onClick={() => {
                  if (isLinkShortcut && shortcutHref) {
                    window.open(shortcutHref, "_blank", "noopener,noreferrer");
                    return;
                  }
                  openNote(note.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    if (isLinkShortcut && shortcutHref) {
                      window.open(
                        shortcutHref,
                        "_blank",
                        "noopener,noreferrer",
                      );
                      return;
                    }
                    openNote(note.id);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={
                  isLinkShortcut
                    ? `Open linked page ${note.data.title || shortcutLabel || "Untitled"}`
                    : `Open note ${note.data.title || "Untitled"}`
                }
                title={
                  isLinkShortcut
                    ? `Open ${shortcutLabel || note.data.title || "linked page"}`
                    : note.data.title || "Untitled"
                }
              >
                <div className="note-row">
                  <div className="note-content-col">
                    {!isLinkShortcut ? (
                      <>
                        <span className="note-title">
                          {formatDateInTitle(note.data.createdAt)} ·{" "}
                          {note.data.title || "Untitled"}
                          {searchQuery && note.matchType && (
                            <span className="match-indicator">
                              (matched in {note.matchType})
                            </span>
                          )}
                        </span>

                        {!!note?.data?.linkUrl && (
                          <div className="note-meta-line">
                            <span className="note-link-chip">
                              Linked doc: {formatLinkLabel(note.data.linkUrl)}
                            </span>
                          </div>
                        )}

                        {note.data.updatedAt &&
                          note.data.updatedAt !== note.data.createdAt && (
                            <span className="note-updated">
                              Updated {formatUpdatedTime(note.data.updatedAt)}
                            </span>
                          )}
                      </>
                    ) : (
                      <>
                        <div className="note-link-shortcut-head">
                          <span
                            className="note-link-shortcut-icon"
                            aria-hidden="true"
                          >
                            ↗
                          </span>
                          <span className="note-title note-title--shortcut">
                            {note.data.title || "Untitled"}
                          </span>
                        </div>
                        <div className="note-meta-line">
                          <span className="note-link-chip">
                            Linked doc: {shortcutLabel || "external link"}
                          </span>
                          {scopeType === NOTE_SCOPE_PROJECT && (
                            <span className="note-project-chip">
                              {projectLabel(projectId)}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="note-actions-row">
                    {editingId !== note.id && (
                      <IconButton
                        title="Edit"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          startEditing(note);
                        }}
                      >
                        {EDIT_ICON}
                      </IconButton>
                    )}
                    <IconButton
                      variant="delete"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleDeleteNote(
                          note.id,
                          note.data.title || "Untitled",
                        );
                      }}
                      title="Delete note"
                    >
                      {DELETE_ICON}
                    </IconButton>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </SectionBlock>
    );
  }

  const totalSectionsInCurrentMode =
    groupMode === "date"
      ? [
          groupedNotesByDate.today,
          groupedNotesByDate.yesterday,
          groupedNotesByDate.thisWeek,
          groupedNotesByDate.older,
        ].reduce((count, list) => count + (list.length ? 1 : 0), 0)
      : groupedNotesByProject.length;

  const activeNote = useMemo(
    () => notes.find((note) => note.id === viewingId) || null,
    [notes, viewingId],
  );
  const activeNoteIsLinkOnly = isLinkOnlyNote(activeNote?.data);
  const editIsLinkOnly =
    Boolean(normalizeExternalUrl(editMeta.linkUrl)) &&
    !Boolean(String(editContent || "").trim());

  const groupingOptions = [
    {
      value: "date",
      title: "Group by date",
      icon: DATE_VIEW_ICON,
    },
    {
      value: "project",
      title: "Group by project",
      icon: PROJECT_VIEW_ICON,
    },
  ];

  const layoutOptions = [
    { value: "grid", title: "Book covers", icon: BOOK_GRID_ICON },
    { value: "shelf", title: "Bookshelf", icon: BOOK_SHELF_ICON },
  ];

  return (
    <TabPage
      className="notes-page"
      title="Notes / doc"
      badge={`${notes.length} note${notes.length !== 1 ? "s" : ""}`}
      right={
        <PageControls compact>
          <SearchField
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onClear={() => setSearchQuery("")}
          />
          <ViewToggle
            className="projects-view-toggle"
            value={groupMode}
            onChange={setGroupMode}
            options={groupingOptions}
            ariaLabel="Note grouping"
          />
          <ViewToggle
            value={notesLayout}
            onChange={setNotesLayout}
            options={layoutOptions}
            ariaLabel="Notes layout"
          />
        </PageControls>
      }
    >
      <SectionBlock
        className="note-create-section"
        title="Create note"
        titleTag="h3"
        texture={SURFACE_TEXTURES.notesComposer}
        bodyClassName="note-create-area"
      >
        <div className="note-create-row">
          <InputField
            type="text"
            placeholder="New note title…"
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            className="new-note-input"
          />
          <InputField
            type="url"
            placeholder="Link URL (optional)"
            value={newLinkUrl}
            onChange={(event) => setNewLinkUrl(event.target.value)}
            className="note-meta-input"
          />
          <SelectField
            className="note-meta-input"
            value={newScopeType}
            onChange={(event) => {
              const nextScope = normalizeScopeType(event.target.value);
              setNewScopeType(nextScope);
              if (nextScope !== NOTE_SCOPE_PROJECT) setNewProjectId("");
              setNewRoles((prev) => ({
                ...prev,
                meetingParticipantIds:
                  nextScope === NOTE_SCOPE_PROJECT
                    ? prev.meetingParticipantIds
                    : [],
                absentParticipantIds:
                  nextScope === NOTE_SCOPE_PROJECT
                    ? prev.absentParticipantIds
                    : [],
              }));
            }}
          >
            <option value={NOTE_SCOPE_DATE}>Date-based</option>
            <option value={NOTE_SCOPE_PROJECT}>Project-based</option>
          </SelectField>
          {newScopeType === NOTE_SCOPE_PROJECT && (
            <SelectField
              className="note-meta-input"
              value={newProjectId}
              onChange={(event) => {
                const projectId = event.target.value;
                setNewProjectId(projectId);
                const projectTeamIds = getProjectTeamMemberIds(
                  projectId,
                  projects,
                );
                setNewRoles((prev) => ({
                  ...prev,
                  meetingParticipantIds: projectTeamIds,
                  absentParticipantIds: [],
                }));
              }}
            >
              <option value="">No project…</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project?.data?.name || project.id}
                </option>
              ))}
            </SelectField>
          )}
          <Button onClick={handleCreateNote} disabled={!newTitle.trim()}>
            Create
          </Button>
        </div>

        {!newLinkUrl.trim() && (
          <details className="note-roles-disclosure">
            <summary className="note-roles-summary">
              <span className="note-roles-summary-label">
                Roles
                {(newRoles.facilitatorId ||
                  newRoles.timekeeperId ||
                  newRoles.notetakerId) && (
                  <span className="note-roles-summary-chips">
                    {ROLE_FIELDS.filter((f) => newRoles[f.key]).map((f) => (
                      <span key={f.key} className="note-role-pill">
                        {f.label.slice(0, 3)}:{" "}
                        {memberNameById[newRoles[f.key]] || "…"}
                      </span>
                    ))}
                  </span>
                )}
              </span>
            </summary>
            <div className="note-roles-body">
              {renderRoleSelectors(newRoles, updateNewRole)}
            </div>
          </details>
        )}
      </SectionBlock>

      <CollectionLayout variant="list" className="notes-sections">
        {groupMode === "date" ? (
          <>
            {renderNoteSection("Today", groupedNotesByDate.today)}
            {renderNoteSection("Yesterday", groupedNotesByDate.yesterday)}
            {renderNoteSection("This Week", groupedNotesByDate.thisWeek)}
            {renderNoteSection("Older", groupedNotesByDate.older)}
          </>
        ) : (
          <>
            {groupedNotesByProject.map((section) =>
              renderNoteSection(section.title, section.notesList),
            )}
          </>
        )}

        {notes.length === 0 && (
          <EmptyState>No notes yet. Create one to get started!</EmptyState>
        )}
        {notes.length > 0 && totalSectionsInCurrentMode === 0 && (
          <EmptyState>No notes match the current filters.</EmptyState>
        )}
      </CollectionLayout>

      {activeNote && (
        <ModalShell
          title={editingId === activeNote.id ? "Edit note" : "Note details"}
          size="lg"
          className={editingId === activeNote.id ? "" : "note-detail-modal"}
          onClose={() => {
            setViewingId(null);
            setEditingId(null);
          }}
        >
          {editingId === activeNote.id || activeNoteIsLinkOnly ? (
            <div className="note-editor-row">
              <div className="note-editor-meta">
                <label className="note-meta-field note-meta-field--wide">
                  <span>Title</span>
                  <InputField
                    type="text"
                    className="note-meta-input"
                    value={editMeta.title}
                    onChange={(event) =>
                      updateEditMeta("title", event.target.value)
                    }
                  />
                </label>

                <label className="note-meta-field">
                  <span>Date</span>
                  <InputField
                    type="date"
                    className="note-meta-input"
                    value={editMeta.noteDate}
                    onChange={(event) =>
                      updateEditMeta("noteDate", event.target.value)
                    }
                  />
                </label>

                <label className="note-meta-field note-meta-field--wide">
                  <span>Link URL (optional)</span>
                  <InputField
                    type="url"
                    className="note-meta-input"
                    placeholder="https://..."
                    value={editMeta.linkUrl}
                    onChange={(event) =>
                      updateEditMeta("linkUrl", event.target.value)
                    }
                  />
                </label>

                <label className="note-meta-field">
                  <span>Type</span>
                  <SelectField
                    className="note-meta-input"
                    value={editMeta.scopeType}
                    onChange={(event) => {
                      const nextScope = normalizeScopeType(event.target.value);
                      setEditMeta((prev) => ({
                        ...prev,
                        scopeType: nextScope,
                        projectId:
                          nextScope === NOTE_SCOPE_PROJECT
                            ? prev.projectId
                            : "",
                      }));
                    }}
                  >
                    <option value={NOTE_SCOPE_DATE}>Date-based</option>
                    <option value={NOTE_SCOPE_PROJECT}>Project-based</option>
                  </SelectField>
                </label>

                {normalizeScopeType(editMeta.scopeType) ===
                  NOTE_SCOPE_PROJECT && (
                  <label className="note-meta-field">
                    <span>Project</span>
                    <SelectField
                      className="note-meta-input"
                      value={editMeta.projectId}
                      onChange={(event) => {
                        const projectId = event.target.value;
                        const projectTeamIds = getProjectTeamMemberIds(
                          projectId,
                          projects,
                        );
                        setEditMeta((prev) => ({
                          ...prev,
                          projectId,
                          meetingParticipantIds: projectTeamIds,
                          absentParticipantIds: [],
                        }));
                      }}
                    >
                      <option value="">No project selected</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project?.data?.name || project.id}
                        </option>
                      ))}
                    </SelectField>
                  </label>
                )}

                {!editIsLinkOnly &&
                  renderRoleSelectors(editMeta, updateEditMeta)}
              </div>

              <RichEditor
                value={editContent}
                onChange={setEditContent}
                members={members}
                projects={projects}
                tasks={tasks}
                resources={resources}
                notes={notes}
                currentNoteId={activeNote.id}
                showDateObjectButton={
                  normalizeScopeType(editMeta.scopeType) === NOTE_SCOPE_PROJECT
                }
              />
              <div className="note-editor-actions">
                <Button
                  onClick={() => handleSaveEdit(activeNote.id)}
                  disabled={!editMeta.title.trim()}
                >
                  Save
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditingId(null);
                    if (activeNoteIsLinkOnly) setViewingId(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="note-preview-row">
              <div className="note-preview-header">
                <div className="note-preview-title-block">
                  <h3 className="note-preview-title">
                    {formatDateInTitle(activeNote?.data?.createdAt)} ·{" "}
                    {activeNote?.data?.title || "Untitled"}
                  </h3>
                  <p className="note-preview-updated">
                    {`Created by ${formatAuditUser(activeNote?.data?.createdByUsername)} · ${formatAuditTimestamp(activeNote?.data?.createdAt)}`}
                  </p>
                  <p className="note-preview-updated">
                    {`Last edited by ${formatAuditUser(activeNote?.data?.updatedByUsername || activeNote?.data?.createdByUsername)} · ${formatAuditTimestamp(activeNote?.data?.updatedAt || activeNote?.data?.createdAt)}`}
                  </p>
                </div>
                <div className="note-editor-actions note-editor-actions--preview">
                  <Button onClick={() => startEditing(activeNote)}>Edit</Button>
                  <Button variant="ghost" onClick={() => setViewingId(null)}>
                    Close
                  </Button>
                </div>
              </div>

              <div className="note-preview-meta">
                <div className="note-meta-line">
                  <span className="note-scope-chip">
                    {normalizeScopeType(activeNote?.data?.scopeType) ===
                    NOTE_SCOPE_PROJECT
                      ? "project-based"
                      : "date-based"}
                  </span>
                  {!!activeNote?.data?.linkUrl && (
                    <a
                      className="note-linked-doc"
                      href={normalizeExternalUrl(activeNote.data.linkUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(event) => event.stopPropagation()}
                    >
                      Open linked doc (
                      {formatLinkLabel(activeNote.data.linkUrl)})
                    </a>
                  )}
                  {normalizeScopeType(activeNote?.data?.scopeType) ===
                    NOTE_SCOPE_PROJECT && (
                    <span className="note-project-chip">
                      {projectLabel(activeNote?.data?.projectId || "")}
                    </span>
                  )}
                </div>

                <div className="note-role-line">
                  {!activeNoteIsLinkOnly && renderRoleSummary(activeNote?.data)}
                </div>

                {!activeNoteIsLinkOnly &&
                  renderMeetingAttendanceDetail(activeNote?.data)}
              </div>

              {activeNote?.data?.content ? (
                <div
                  className="note-preview-content"
                  dangerouslySetInnerHTML={{ __html: activeNote.data.content }}
                />
              ) : (
                <p className="note-empty">
                  {activeNote?.data?.linkUrl
                    ? "This note links to an external document."
                    : "No content yet. Click Edit to add content."}
                </p>
              )}
            </div>
          )}
        </ModalShell>
      )}

      {deleteTarget && (
        <DeleteConfirmDialog
          label={deleteTarget.label}
          onConfirm={deleteTarget.onConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </TabPage>
  );
}
