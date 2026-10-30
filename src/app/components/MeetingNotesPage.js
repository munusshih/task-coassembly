"use client";


import FormField from "./ui/FormField";
import WorkspaceCreateDock from "./ui/WorkspaceCreateDock";
import BottomComposer from "./ui/BottomComposer";
import NotesCalendar from "./NotesCalendar";
import PersonIdentity from "./ui/PersonIdentity";
import NoteDiscussion from "./NoteDiscussion";
import {projectWorkTone} from "./memberRoleMetrics.mjs";
import EditorialNoteCard, {NoteCover} from "./EditorialNoteCard";
import {noteImageUrl,noteCover} from "../lib/notePresentation.mjs";
import { fuzzyMatch } from "../lib/noteSearch.mjs";
import WorkspacePageHero from "./ui/WorkspacePageHero";
import EditButton from "./ui/EditButton";
import MetadataPill from "./ui/MetadataPill";
import WorkspaceViewPicker from "./ui/WorkspaceViewPicker";
import TaskCreateTrigger from "./TaskCreateTrigger";
import ShareViewButton from "./ShareViewButton";
import useUrlState, { isDocumentId } from "../hooks/useUrlState";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  onDisconnect,
  onValue,
  ref as rtdbRef,
  remove,
  serverTimestamp,
  set,
  update,
} from "firebase/database";
import {
  subscribeCollection,
  subscribeDocument,
  subscribeCollectionQuery,
  createDocument,
  updateDocument,
  deleteDocument,
} from "../../firestore";
import { auth, firebaseReady, realtimeDb } from "../../firebase";
import Button from "./Button";
import IconButton from "./IconButton";
import RichEditor from "./RichEditor";
import {
  DELETE_ICON,
  EDIT_ICON,
} from "./icons";
import CollectionLayout from "./ui/CollectionLayout";
import EmptyState from "./ui/EmptyState";
import InputField from "./ui/InputField";
import SearchField from "./ui/SearchField";
import SelectField from "./ui/SelectField";
import SectionBlock from "./ui/SectionBlock";
import TabPage from "./ui/TabPage";
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

function buildStarterNoteContent(title, scopeType, projectName) {
  const heading = String(title || "Notes").trim() || "Notes";
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
    imageUrl: "",
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

function normalizePresenceRows(snapshotValue) {
  if (!snapshotValue || typeof snapshotValue !== "object") return [];
  return Object.entries(snapshotValue).map(([id, row]) => ({
    id,
    data: row || {},
  }));
}

function colorFromTextSeed(value) {
  const text = String(value || "viewer");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }
  const palette = ["var(--ink)", "var(--ink)", "var(--ink)", "var(--ink)", "var(--ink)"];
  return palette[Math.abs(hash) % palette.length];
}

export default function MeetingNotesPage({ viewerName = "" }) {
  const [notes, setNotes] = useState([]);
  const [notesLimit, setNotesLimit] = useState(80);
  const [newImageUrl,setNewImageUrl]=useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newScopeType, setNewScopeType] = useState(NOTE_SCOPE_DATE);
  const [newProjectId, setNewProjectId] = useState("");
  const [newRoles, setNewRoles] = useState(() => emptyRoleAssignments());

  const [viewingId, setViewingId] = useUrlState("note", null, { validate: isDocumentId });
  const [linkedNote, setLinkedNote] = useState(null);
  const [loadedNoteId, setLoadedNoteId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [editMeta, setEditMeta] = useState(() => emptyEditMeta());
  const [searchQuery, setSearchQuery] = useUrlState("notesSearch", "", { replace: true });
  const [createOpen, setCreateOpen] = useState(false);
  const [groupMode, setGroupMode] = useUrlState("notesGroup", "date", { allowed: ["date", "project"] });
  const [notesLayout, setNotesLayout] = useUrlState("notesLayout", "calendar", { allowed: ["grid", "calendar"] });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [currentUsername, setCurrentUsername] = useState("");
  const [notePresenceRows, setNotePresenceRows] = useState([]);
  const [editSelection, setEditSelection] = useState({ anchor: 1, head: 1 });
  const editSelectionRef = useRef({ anchor: 1, head: 1 });
  const [autoSaveState, setAutoSaveState] = useState("idle");
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState(null);

  const [members, setMembers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [resources, setResources] = useState([]);

  useEffect(() => {
    setLinkedNote(null);
    if (!firebaseReady || !viewingId) return;
    return subscribeDocument("meetingNotes", viewingId, (note) => {
      setLinkedNote(note);
      setLoadedNoteId(viewingId);
    });
  }, [viewingId]);

  useEffect(() => {
    // History navigation leaves the editor and restores the linked read view.
    if (editingId && editingId !== viewingId) setEditingId(null);
  }, [viewingId, editingId]);

  useEffect(() => {
    editSelectionRef.current = {
      anchor: Number(editSelection.anchor) || 1,
      head: Number(editSelection.head) || Number(editSelection.anchor) || 1,
    };
  }, [editSelection]);

  useEffect(() => {
    if (!firebaseReady) return;
    return subscribeCollectionQuery(
      "meetingNotes",
      {
        orderByField: "createdAt",
        orderDirection: "desc",
        limitCount: notesLimit,
      },
      (items) => {
        setNotes(
          items.sort(
            (a, b) =>
              Number(b.data.createdAt || 0) - Number(a.data.createdAt || 0),
          ),
        );
      },
    );
  }, [notesLimit]);

  useEffect(() => {
    if (!firebaseReady || !realtimeDb) {
      setNotePresenceRows([]);
      return;
    }

    const u1 = subscribeCollection("members", setMembers);
    const u2 = subscribeCollection("projects", setProjects);
    const presenceRef = rtdbRef(realtimeDb, "meetingNotePresence");
    const u3 = onValue(presenceRef, (snapshot) => {
      setNotePresenceRows(normalizePresenceRows(snapshot.val()));
    });

    return () => {
      u1();
      u2();
      u3();
    };
  }, []);

  useEffect(() => {
    if (!firebaseReady || !editingId) {
      setTasks([]);
      setResources([]);
      return;
    }
    const u1 = subscribeCollection("tasks", setTasks);
    const u2 = subscribeCollection("resources", setResources);
    return () => {
      u1();
      u2();
    };
  }, [editingId]);

  useEffect(() => {
    const next = String(viewerName || "").trim();
    if (!next) return;
    setCurrentUsername(next);
  }, [viewerName]);

  useEffect(() => {
    if (viewerName) {
      return undefined;
    }
    if (!auth) return undefined;

    const unsub = onAuthStateChanged(auth, (user) => {
      const username = String(user?.email || user?.displayName || "")
        .trim()
        .toLowerCase();
      if (username) setCurrentUsername(username);
    });

    return () => unsub();
  }, [viewerName]);

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

  const deferredSearch = useDeferredValue(searchQuery);
  const filteredNotes = useMemo(() => notes.map(note => {
    const match = fuzzyMatch({ title: note.data?.title, content: note.data?.content, link: note.data?.linkUrl, project: projectNameById[note.data?.projectId], people: ROLE_FIELDS.map(field => memberNameById[note.data?.[field.key]] || '').join(' ') }, deferredSearch);
    return match ? { ...note, ...match } : null;
  }).filter(Boolean).sort((a,b) => b.score-a.score), [notes, deferredSearch, memberNameById, projectNameById]);

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
        title: "Unassigned project",
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
        title: "General notes",
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
    const isDateOnlyMidnight =
      date.getHours() === 0 &&
      date.getMinutes() === 0 &&
      date.getSeconds() === 0;
    if (isDateOnlyMidnight) {
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function formatAuditUser(username, fallbackUsername = "") {
    const value = String(username || "").trim();
    if (value) return value;
    const fallback = String(fallbackUsername || "").trim();
    return fallback || "Unknown";
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
    setAutoSaveState("idle");
    setLastAutoSavedAt(null);
  }

  function presenceDocId(noteId, username) {
    const safeUser = encodeURIComponent(
      String(username || "viewer").trim().toLowerCase() || "viewer",
    );
    return `${noteId}__${safeUser}`;
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
      imageUrl: note?.data?.imageUrl || "",
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
    if(newImageUrl.trim()&&!noteImageUrl(newImageUrl))return;
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
        imageUrl: noteImageUrl(newImageUrl) || null,
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
      setCreateOpen(false);
      setNewTitle("");
      setNewImageUrl("");
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
    const saved = await saveNoteEdits(noteId, { closeEditor: true, source: "manual" });
    if (saved) setAutoSaveState("saved");
  }

  function buildEditedPayload(noteId) {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return null;

    const title = editMeta.title.trim();
    if (!title || (editMeta.imageUrl?.trim()&&!noteImageUrl(editMeta.imageUrl))) return { invalid: true };

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
    return {
      invalid: false,
      isLinkOnly,
      payload: {
        ...note.data,
        imageUrl: noteImageUrl(editMeta.imageUrl) || null,
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
      },
    };
  }

  async function saveNoteEdits(
    noteId,
    { closeEditor = false, source = "manual" } = {},
  ) {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return false;

    const built = buildEditedPayload(noteId);
    if (!built || built.invalid) return false;

    const hasChanged =
      JSON.stringify({ ...note.data, updatedAt: undefined }) !==
      JSON.stringify({ ...built.payload, updatedAt: undefined });
    if (!hasChanged) {
      if (source === "auto") setAutoSaveState("saved");
      if (closeEditor) {
        setEditingId(null);
        if (built.isLinkOnly) setViewingId(null);
      }
      return true;
    }

    if (source === "auto") setAutoSaveState("saving");

    try {
      await updateDocument("meetingNotes", noteId, built.payload);
      if (source === "auto") {
        setAutoSaveState("saved");
        setLastAutoSavedAt(Date.now());
      }
      if (closeEditor) {
        setEditingId(null);
        if (built.isLinkOnly) setViewingId(null);
      }
      return true;
    } catch (error) {
      if (source === "auto") setAutoSaveState("error");
      console.error("Could not save note:", error);
      return false;
    }
  }

  useEffect(() => {
    if (!editingId) return;
    if (!editMeta.title.trim()) return;

    const timer = window.setTimeout(() => {
      saveNoteEdits(editingId, { closeEditor: false, source: "auto" });
    }, 1200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [editingId, editContent, editMeta, notes, currentUsername]);

  useEffect(() => {
    if (!firebaseReady || !realtimeDb || !editingId) return;

    const username = String(currentUsername || "viewer")
      .trim()
      .toLowerCase() || "viewer";
    const docId = presenceDocId(editingId, username);
    let stopped = false;
    const rowRef = rtdbRef(realtimeDb, `meetingNotePresence/${docId}`);

    async function writePresence(active = true) {
      if (stopped) return;
      try {
        await update(rowRef, {
          noteId: editingId,
          username,
          color: colorFromTextSeed(username),
          active: Boolean(active),
          cursorAnchor: editSelectionRef.current.anchor,
          cursorHead: editSelectionRef.current.head,
          lastSeen: serverTimestamp(),
        });
      } catch {
        // Ignore transient presence update failures.
      }
    }

    function onVisibilityChange() {
      if (typeof document === "undefined") return;
      writePresence(document.visibilityState === "visible");
    }

    onDisconnect(rowRef)
      .remove()
      .catch(() => {});

    set(rowRef, {
      noteId: editingId,
      username,
      color: colorFromTextSeed(username),
      active: true,
      cursorAnchor: editSelectionRef.current.anchor,
      cursorHead: editSelectionRef.current.head,
      lastSeen: serverTimestamp(),
    }).catch(() => {});

    writePresence(true);
    document.addEventListener("visibilitychange", onVisibilityChange);
    const keepAlive = window.setInterval(() => {
      writePresence(typeof document === "undefined" ? true : document.visibilityState === "visible");
    }, 10 * 1000);

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(keepAlive);
      remove(rowRef).catch(() => {});
    };
  }, [editingId, currentUsername]);

  useEffect(() => {
    if (!firebaseReady || !realtimeDb || !editingId) return;

    const username = String(currentUsername || "viewer")
      .trim()
      .toLowerCase() || "viewer";
    const docId = presenceDocId(editingId, username);
    const rowRef = rtdbRef(realtimeDb, `meetingNotePresence/${docId}`);

    const timer = window.setTimeout(() => {
      update(rowRef, {
        cursorAnchor: editSelectionRef.current.anchor,
        cursorHead: editSelectionRef.current.head,
        lastSeen: serverTimestamp(),
      }).catch(() => {});
    }, 120);

    return () => window.clearTimeout(timer);
  }, [editingId, currentUsername, editSelection]);

  async function handleDeleteNote(noteId, noteTitle) {
    setDeleteTarget({
      label: noteTitle || "this note",
      onConfirm: async (reason) => {
        try {
          await deleteDocument("meetingNotes", noteId, reason);
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

  function renderNoteSection(title,notesList) {
    if(!notesList.length)return null;
    return <SectionBlock key={title} className="notes-section notes-editorial-section" title={title} badge={notesList.length} titleTag="h3" bodyClassName="notes-section-body"><ul className={`notes-editorial-list notes-editorial-list--${notesLayout}`}>
      {notesList.map((note,index)=><EditorialNoteCard key={note.id} note={note} index={index} authorMember={members.find(member=>String(member.data?.name||'').toLowerCase()===String(note.data.createdByUsername||'').toLowerCase())} projectTone={projectWorkTone(projects.find(project=>project.id===note.data.projectId)?.data?.kind)} projectName={note.data.projectId?projectLabel(note.data.projectId):''} author={formatAuditUser(note.data.createdByUsername,note.data.updatedByUsername)} date={new Date(Number(note.data.createdAt)||Date.now()).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})} linkedHost={note.data.linkUrl?formatLinkLabel(note.data.linkUrl):''} onOpen={()=>{const href=normalizeExternalUrl(note.data.linkUrl);if(isLinkOnlyNote(note.data)&&href)window.open(href,'_blank','noopener,noreferrer');else openNote(note.id);}} onEdit={()=>startEditing(note)} onDelete={()=>handleDeleteNote(note.id,note.data.title||'Untitled')}/>)}
    </ul></SectionBlock>;
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
    () => notes.find((note) => note.id === viewingId) ||
      (linkedNote?.id === viewingId ? linkedNote : null),
    [notes, viewingId, linkedNote],
  );
  const activeEditors = useMemo(() => {
    if (!activeNote?.id) return [];
    const now = Date.now();
    const self = String(currentUsername || "")
      .trim()
      .toLowerCase();
    return notePresenceRows
      .map((row) => ({ id: row.id, ...row.data }))
      .filter((row) => row.noteId === activeNote.id)
      .filter((row) => now - Number(row.lastSeen || 0) < 12000)
      .filter((row) => {
        const username = String(row.username || "")
          .trim()
          .toLowerCase();
        return username && username !== self;
      })
      .map((row) => ({
        ...row,
        color: row.color || colorFromTextSeed(row.username),
        cursorAnchor: Number(row.cursorAnchor) || 1,
      }));
  }, [activeNote, notePresenceRows, currentUsername]);

  const autoSaveLabel = useMemo(() => {
    if (autoSaveState === "saving") return "Saving...";
    if (autoSaveState === "error") return "Autosave failed";
    if (autoSaveState === "saved" && lastAutoSavedAt) {
      return `Saved ${new Date(lastAutoSavedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}`;
    }
    return "Autosave on";
  }, [autoSaveState, lastAutoSavedAt]);

  const filteredTasks = useMemo(
    () => tasks.filter((task) => task?.data?.type === "memberTodo"),
    [tasks],
  );
  const activeNoteIsLinkOnly = isLinkOnlyNote(activeNote?.data);
  const editIsLinkOnly =
    Boolean(normalizeExternalUrl(editMeta.linkUrl)) &&
    !Boolean(String(editContent || "").trim());



  return (
    <TabPage
      className="notes-page"
      title="Notes"
      header={<WorkspacePageHero title="Notes" illustration="book-carrier"><div className="notes-view-controls"><WorkspaceViewPicker compact value={groupMode} onChange={value=>{setGroupMode(value);if(value==='project'&&notesLayout==='calendar')setNotesLayout('grid');}} options={[{ value: 'date', label: 'Date' }, { value: 'project', label: 'Projects' }]} label="Note grouping" /><WorkspaceViewPicker compact prefix="in" value={groupMode==='project'?'grid':notesLayout} onChange={setNotesLayout} options={[{value:"grid",label:"Grid"},...(groupMode==='date'?[{value:'calendar',label:'Calendar'}]:[])]} label="Notes layout" /></div></WorkspacePageHero>}
    >
      <WorkspaceCreateDock label="New note" expanded={createOpen} onClick={() => setCreateOpen(true)} />
      <div className="notes-search"><SearchField ariaLabel="Search notes" placeholder="Search titles, content, projects, people…" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} onClear={() => setSearchQuery('')} /></div>
      {createOpen && (
      <BottomComposer illustration="compose-note" title="New note" onClose={() => setCreateOpen(false)} className="note-create-composer">
        <div className="note-create-row">
          <FormField label="Title"><InputField
            type="text"
            placeholder="New note title…"
            aria-label="Note title"
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            className="new-note-input"
          /></FormField>
          <FormField label="Link (optional)"><InputField
            type="url"
            placeholder="Link URL (optional)"
            aria-label="Note link URL"
            value={newLinkUrl}
            onChange={(event) => setNewLinkUrl(event.target.value)}
            className="note-meta-input"
          /></FormField>
          <FormField label="Cover image URL (optional)"><InputField type="url" aria-label="Note cover image URL" placeholder="https://…" value={newImageUrl} onChange={event=>setNewImageUrl(event.target.value)}/></FormField>
          {newImageUrl.trim()&&!noteImageUrl(newImageUrl)&&<p role="alert">Use an http or https image URL.</p>}
          {noteImageUrl(newImageUrl)&&<NoteCover key={newImageUrl} src={noteImageUrl(newImageUrl)} title={newTitle} className="note-compose-cover"/>}
          <FormField label="Organize by"><SelectField
            className="note-meta-input"
            aria-label="Note type"
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
          </SelectField></FormField>
          {newScopeType === NOTE_SCOPE_PROJECT && (
            <FormField label="Project"><SelectField
              className="note-meta-input"
              aria-label="Note project"
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
            </SelectField></FormField>
          )}
          <Button onClick={handleCreateNote} disabled={!newTitle.trim()||(Boolean(newImageUrl.trim())&&!noteImageUrl(newImageUrl))}>
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
      </BottomComposer>

      )}

      <CollectionLayout variant="list" className="notes-sections">
        {searchQuery.trim() ? renderNoteSection("Search results", filteredNotes) : groupMode === "date" && notesLayout === "calendar" ? <NotesCalendar notes={filteredNotes} renderNotes={renderNoteSection} onOpenNote={note => { const href=normalizeExternalUrl(note.data?.linkUrl); if(isLinkOnlyNote(note.data) && href) window.open(href,"_blank","noopener,noreferrer"); else openNote(note.id); }} /> : groupMode === "date" ? (
          <>
            {renderNoteSection("Today", groupedNotesByDate.today)}
            {renderNoteSection("Yesterday", groupedNotesByDate.yesterday)}
            {renderNoteSection("Past 7 days", groupedNotesByDate.thisWeek)}
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

      {viewingId && !activeNote && (
        <ModalShell fullscreen title="Note details" onClose={() => setViewingId(null)}>
          <p>{loadedNoteId === viewingId
            ? "This note is unavailable. It may have been deleted or you may not have access."
            : "Loading note…"}</p>
        </ModalShell>
      )}

      {activeNote && (
        <ModalShell
          title={editingId === activeNote.id ? "Edit note" : "Notes"}
          headerActions={<ShareViewButton compact />}
          size="lg"
          fullscreen
          className="note-detail-modal"
          onClose={() => {
            setViewingId(null);
            setEditingId(null);
          }}
        >
          {editingId === activeNote.id || activeNoteIsLinkOnly ? (
            <div className="note-editor-row">
              <div className="note-editor-meta">
                {activeEditors.length > 0 && (
                  <div className="note-live-editing">
                    {activeEditors.map((editor) => (
                      <span
                        key={`editor-${editor.id}`}
                        className="note-live-editing-chip"
                      >
                        {String(editor.username || "Someone")} is editing
                      </span>
                    ))}
                  </div>
                )}
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

                <label className="note-meta-field note-meta-field--wide"><span>Cover image URL (optional)</span><InputField type="url" value={editMeta.imageUrl||''} onChange={event=>updateEditMeta('imageUrl',event.target.value)} placeholder="https://…"/>{editMeta.imageUrl?.trim()&&!noteImageUrl(editMeta.imageUrl)&&<small role="alert">Use an http or https image URL.</small>}</label>
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
                onSelectionChange={setEditSelection}
                members={members}
                projects={projects}
                tasks={filteredTasks}
                resources={resources}
                notes={notes}
                collaborators={activeEditors}
                currentNoteId={activeNote.id}
                showDateObjectButton={
                  normalizeScopeType(editMeta.scopeType) === NOTE_SCOPE_PROJECT
                }
              />
              <div className="note-editor-actions">
                <span className="note-autosave-status">{autoSaveLabel}</span>
                <Button
                  onClick={() => handleSaveEdit(activeNote.id)}
                  disabled={!editMeta.title.trim()||(Boolean(editMeta.imageUrl?.trim())&&!noteImageUrl(editMeta.imageUrl))}
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
            <div className="note-preview-row"><NoteCover key={noteCover(activeNote?.data)} src={noteCover(activeNote?.data)} title={activeNote?.data?.title} className="note-preview-cover"/>
              <div className="note-preview-header">
                <div className="note-preview-title-block">
                  <h3 className="note-preview-title">
                    {activeNote?.data?.title || "Untitled"}
                  </h3>
                  <div className="note-audit-grid">{[['Created',activeNote?.data?.createdByUsername,activeNote?.data?.createdAt],['Edited',activeNote?.data?.updatedByUsername||activeNote?.data?.createdByUsername,activeNote?.data?.updatedAt||activeNote?.data?.createdAt]].map(([label,name,date])=><PersonIdentity key={label} label={label} name={formatAuditUser(name,currentUsername)} member={members.find(member=>String(member.data?.name||'').toLowerCase()===String(name||'').toLowerCase())}><time>{formatAuditTimestamp(date)}</time></PersonIdentity>)}</div>
                </div>
                <div className="note-editor-actions note-editor-actions--preview">
                  <EditButton label="Edit note" onClick={() => startEditing(activeNote)}/>
                </div>
              </div>

              <div className="note-preview-meta">
                <div className="note-meta-line">
                  <MetadataPill tone="neutral" className="note-scope-chip">
                    {normalizeScopeType(activeNote?.data?.scopeType) ===
                    NOTE_SCOPE_PROJECT
                      ? "project-based"
                      : "date-based"}
                  </MetadataPill>
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
                    <MetadataPill tone={projectWorkTone(projects.find(project=>project.id===activeNote?.data?.projectId)?.data?.kind)} className="note-project-chip">
                      {projectLabel(activeNote?.data?.projectId || "")}
                    </MetadataPill>
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
              <NoteDiscussion note={activeNote} members={members} username={currentUsername}/>
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

      {notes.length >= notesLimit && (
        <div className="notes-load-more-row">
          <Button
            variant="ghost"
            onClick={() => setNotesLimit((prev) => prev + 80)}
          >
            Load more notes
          </Button>
        </div>
      )}
    </TabPage>
  );
}
