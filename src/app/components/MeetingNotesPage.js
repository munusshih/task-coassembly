"use client";

import { useEffect, useState, useMemo } from "react";
import {
  subscribeCollection,
  createDocument,
  replaceDocument,
  deleteDocument,
} from "../../firestore";
import { firebaseReady } from "../../firebase";
import IconButton from "./IconButton";
import RichEditor from "./RichEditor";
import { DELETE_ICON, EDIT_ICON } from "./icons";

const NOTE_SCOPE_DATE = "date";
const NOTE_SCOPE_PROJECT = "project";
const MEETING_ROTATION = ["facilitator", "notetaker", "time keeper"];

const ROLE_FIELDS = [
  { key: "facilitatorId", label: "Facilitator" },
  { key: "timekeeperId", label: "Timekeeper" },
  { key: "notetakerId", label: "Notetaker" },
];

function normalizeScopeType(raw) {
  return raw === NOTE_SCOPE_PROJECT ? NOTE_SCOPE_PROJECT : NOTE_SCOPE_DATE;
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
  next.absentParticipantIds = normalizeIdList(data.absentParticipantIds)
    .filter((id) => next.meetingParticipantIds.includes(id));
  return next;
}

function emptyEditMeta() {
  return {
    title: "",
    scopeType: NOTE_SCOPE_DATE,
    projectId: "",
    ...emptyRoleAssignments(),
  };
}

function normalizeMemberRole(rawRole) {
  const value = String(rawRole || "").trim().toLowerCase().replace(/[_\s]+/g, "-");
  if (value === "worker-owner" || value === "workerowner") return "worker-owner";
  if (value === "associate") return "associate";
  if (value === "flying-member" || value === "flying") return "flying-member";
  if (value === "external-collaborator" || value === "external") return "external-collaborator";
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
  const normalized = String(rawRole || "").trim().toLowerCase().replace(/[_\s]+/g, " ");
  if (normalized === "facilitator") return "facilitator";
  if (normalized === "notetaker" || normalized === "note taker") return "notetaker";
  if (normalized === "time keeper" || normalized === "timekeeper") return "time keeper";
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
  const staffing = Array.isArray(project.data?.staffing) ? project.data.staffing : [];
  return staffing
    .map((entry) => (typeof entry?.memberId === "string" ? entry.memberId : ""))
    .map((id) => id.trim())
    .filter(Boolean)
    .filter((id, index, all) => all.indexOf(id) === index);
}

export default function MeetingNotesPage() {
  const [notes, setNotes] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [newScopeType, setNewScopeType] = useState(NOTE_SCOPE_DATE);
  const [newProjectId, setNewProjectId] = useState("");
  const [newRoles, setNewRoles] = useState(() => emptyRoleAssignments());

  const [viewingId, setViewingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [editMeta, setEditMeta] = useState(() => emptyEditMeta());

  const [searchQuery, setSearchQuery] = useState("");
  const [groupMode, setGroupMode] = useState("date");

  const [members, setMembers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [resources, setResources] = useState([]);

  useEffect(() => {
    if (!firebaseReady) return;
    return subscribeCollection("meetingNotes", (items) => {
      setNotes(items.sort((a, b) => Number(b.data.createdAt || 0) - Number(a.data.createdAt || 0)));
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
      const fallbackRole = MEETING_ROTATION[(monthSerial + index) % MEETING_ROTATION.length];
      const explicitRoles = member?.data?.meetingRoles;
      const explicitRole = explicitRoles && typeof explicitRoles === "object"
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
      if (prev.facilitatorId || prev.timekeeperId || prev.notetakerId) return prev;
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
        const scopeType = normalizeScopeType(note?.data?.scopeType);
        const scopeLabel = scopeType === NOTE_SCOPE_PROJECT ? "project-based" : "date-based";
        const projectName = note?.data?.projectId ? (projectNameById[note.data.projectId] || "").toLowerCase() : "";
        const roleNames = ROLE_FIELDS
          .map((field) => (memberNameById[note?.data?.[field.key]] || "").toLowerCase())
          .join(" ");

        const haystack = `${title} ${content} ${scopeLabel} ${projectName} ${roleNames}`;
        return haystack.includes(query);
      })
      .map((note) => {
        const title = (note?.data?.title || "").toLowerCase();
        const content = (note?.data?.content || "").toLowerCase();
        const projectName = note?.data?.projectId ? (projectNameById[note.data.projectId] || "").toLowerCase() : "";
        let matchType = "content";
        if (title.includes(query)) matchType = "title";
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
      today: filteredNotes.filter((n) => Number(n.data.createdAt || 0) >= todayTime),
      yesterday: filteredNotes.filter((n) => {
        const t = Number(n.data.createdAt || 0);
        return t >= yesterdayTime && t < todayTime;
      }),
      thisWeek: filteredNotes.filter((n) => {
        const t = Number(n.data.createdAt || 0);
        return t >= weekAgoTime && t < yesterdayTime;
      }),
      older: filteredNotes.filter((n) => Number(n.data.createdAt || 0) < weekAgoTime),
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
    setNewRoles((prev) => ({ ...prev, [field]: memberId }));
  }

  function updateEditMeta(field, value) {
    setEditMeta((prev) => ({ ...prev, [field]: value }));
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
          absentParticipantIds: currentAbsent.filter((id) => uniqueParticipants.includes(id)),
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
    const projectTeamIds = normalizeIdList(getProjectTeamMemberIds(meta.projectId, projects));
    const selectedIds = normalizeIdList(meta.meetingParticipantIds);
    const roleIds = normalizeIdList([meta.facilitatorId, meta.timekeeperId, meta.notetakerId]);
    const seedIds = [...projectTeamIds, ...selectedIds, ...roleIds];

    const optionIds = seedIds.length > 0
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
    const fallbackProjectTeamIds = getProjectTeamMemberIds(note?.data?.projectId || "", projects);
    const participantIds = normalizedAssignments.meetingParticipantIds.length > 0
      ? normalizedAssignments.meetingParticipantIds
      : fallbackProjectTeamIds;
    setEditingId(note.id);
    setViewingId(note.id);
    setEditContent(note?.data?.content || "");
    setEditMeta({
      title: note?.data?.title || "",
      scopeType: normalizeScopeType(note?.data?.scopeType),
      projectId: note?.data?.projectId || "",
      facilitatorId: normalizedAssignments.facilitatorId || defaultMeetingRoles.facilitatorId,
      timekeeperId: normalizedAssignments.timekeeperId || defaultMeetingRoles.timekeeperId,
      notetakerId: normalizedAssignments.notetakerId || defaultMeetingRoles.notetakerId,
      meetingParticipantIds: participantIds,
      absentParticipantIds: normalizedAssignments.absentParticipantIds.filter((id) => participantIds.includes(id)),
    });
  }

  async function handleCreateNote() {
    if (!newTitle.trim()) return;
    const scopeType = normalizeScopeType(newScopeType);
    try {
      await createDocument("meetingNotes", {
        title: newTitle.trim(),
        content: "",
        scopeType,
        projectId: scopeType === NOTE_SCOPE_PROJECT ? (newProjectId || null) : null,
        facilitatorId: newRoles.facilitatorId || null,
        timekeeperId: newRoles.timekeeperId || null,
        notetakerId: newRoles.notetakerId || null,
        meetingParticipantIds: scopeType === NOTE_SCOPE_PROJECT ? normalizeIdList(newRoles.meetingParticipantIds) : [],
        absentParticipantIds: scopeType === NOTE_SCOPE_PROJECT
          ? normalizeIdList(newRoles.absentParticipantIds).filter((id) => normalizeIdList(newRoles.meetingParticipantIds).includes(id))
          : [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      setNewTitle("");
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
    try {
      await replaceDocument("meetingNotes", noteId, {
        ...note.data,
        title,
        content: editContent,
        scopeType,
        projectId: scopeType === NOTE_SCOPE_PROJECT ? (editMeta.projectId || null) : null,
        facilitatorId: editMeta.facilitatorId || null,
        timekeeperId: editMeta.timekeeperId || null,
        notetakerId: editMeta.notetakerId || null,
        meetingParticipantIds: scopeType === NOTE_SCOPE_PROJECT ? normalizeIdList(editMeta.meetingParticipantIds) : [],
        absentParticipantIds: scopeType === NOTE_SCOPE_PROJECT
          ? normalizeIdList(editMeta.absentParticipantIds).filter((id) => normalizeIdList(editMeta.meetingParticipantIds).includes(id))
          : [],
        updatedAt: Date.now(),
      });
      setEditingId(null);
    } catch (error) {
      console.error("Could not save note:", error);
    }
  }

  async function handleDeleteNote(noteId) {
    if (!window.confirm("Delete this note?")) return;
    try {
      await deleteDocument("meetingNotes", noteId);
      if (viewingId === noteId) setViewingId(null);
      if (editingId === noteId) setEditingId(null);
    } catch (error) {
      console.error("Could not delete note:", error);
    }
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
    const absentIds = normalizeIdList(noteData?.absentParticipantIds).filter((id) => participantIds.includes(id));
    if (participantIds.length > 0) {
      const presentCount = Math.max(0, participantIds.length - absentIds.length);
      chips.push(
        <span key="meeting-count" className="note-role-chip note-role-chip--meeting">
          In meeting: {presentCount}/{participantIds.length}
        </span>,
      );
    }

    if (absentIds.length > 0) {
      chips.push(
        <span key="meeting-absent" className="note-role-chip note-role-chip--absent">
          Absent: {absentIds.map((id) => roleLabel(id)).join(", ")}
        </span>,
      );
    }

    if (chips.length === 0) {
      return <span className="note-role-chip note-role-chip--empty">Roles not set</span>;
    }

    return chips;
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
            <select
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
            </select>
          </label>
        ))}
        {normalizeScopeType(normalizedMeta.scopeType) === NOTE_SCOPE_PROJECT && (
          <div className="note-meta-field note-meta-field--wide">
            <span>Meeting attendees</span>
            <div className="meeting-attendees-list">
              {meetingMemberOptions.length === 0 ? (
                <p className="note-role-chip note-role-chip--empty">No members available for this project yet.</p>
              ) : (
                meetingMemberOptions.map((member) => {
                  const memberId = member.id;
                  const inMeeting = normalizedMeta.meetingParticipantIds.includes(memberId);
                  const absent = normalizedMeta.absentParticipantIds.includes(memberId);
                  return (
                    <div key={memberId} className="meeting-attendee-row">
                      <label className="meeting-attendee-main">
                        <input
                          type="checkbox"
                          checked={inMeeting}
                          onChange={(event) => updateMetaParticipantSelection(onChange, "meetingParticipantIds", memberId, event.target.checked)}
                        />
                        <span>{member?.data?.name || memberId}</span>
                      </label>
                      {inMeeting && (
                        <label className="meeting-attendee-absent">
                          <input
                            type="checkbox"
                            checked={absent}
                            onChange={(event) => updateMetaParticipantSelection(onChange, "absentParticipantIds", memberId, event.target.checked)}
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
      <div key={title} className="notes-section">
        <h3 className="notes-section-title">{title}</h3>
        <ul className="notes-list">
          {notesList.map((note) => {
            const scopeType = normalizeScopeType(note?.data?.scopeType);
            const projectId = note?.data?.projectId || "";
            const isViewing = viewingId === note.id;
            const isEditing = editingId === note.id;

            return (
              <li key={note.id} className="note-item">
                <div className="note-row">
                  <div className="note-content-col">
                    <span
                      className="note-title"
                      onClick={() => {
                        setViewingId(isViewing ? null : note.id);
                        setEditingId(null);
                      }}
                      onDoubleClick={() => startEditing(note)}
                      style={{ cursor: "pointer" }}
                    >
                      {formatDateInTitle(note.data.createdAt)} · {note.data.title || "Untitled"}
                      {searchQuery && note.matchType && (
                        <span className="match-indicator">(matched in {note.matchType})</span>
                      )}
                    </span>

                    <div className="note-meta-line">
                      <span className="note-scope-chip">
                        {scopeType === NOTE_SCOPE_PROJECT ? "project-based" : "date-based"}
                      </span>
                      {scopeType === NOTE_SCOPE_PROJECT && (
                        <span className="note-project-chip">{projectLabel(projectId)}</span>
                      )}
                    </div>

                    <div className="note-role-line">{renderRoleSummary(note?.data)}</div>

                    {note.data.updatedAt && note.data.updatedAt !== note.data.createdAt && (
                      <span className="note-updated">
                        Updated {formatUpdatedTime(note.data.updatedAt)}
                      </span>
                    )}
                  </div>

                  <div className="note-actions-row">
                    <IconButton
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setViewingId(isViewing ? null : note.id);
                        setEditingId(null);
                      }}
                      title={isViewing ? "Hide" : "View"}
                    >
                      {isViewing ? "−" : "+"}
                    </IconButton>
                    {!isEditing && (
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
                        handleDeleteNote(note.id);
                      }}
                      title="Delete note"
                    >
                      {DELETE_ICON}
                    </IconButton>
                  </div>
                </div>

                {isViewing && !isEditing && (
                  <div className="note-preview-row">
                    {note.data.content ? (
                      <div
                        className="note-preview-content"
                        dangerouslySetInnerHTML={{ __html: note.data.content }}
                      />
                    ) : (
                      <p className="note-empty">No content yet. Click Edit to add content.</p>
                    )}
                  </div>
                )}

                {isEditing && (
                  <div className="note-editor-row">
                    <div className="note-editor-meta">
                      <label className="note-meta-field note-meta-field--wide">
                        <span>Title</span>
                        <input
                          type="text"
                          className="note-meta-input"
                          value={editMeta.title}
                          onChange={(event) => updateEditMeta("title", event.target.value)}
                        />
                      </label>

                      <label className="note-meta-field">
                        <span>Type</span>
                        <select
                          className="note-meta-input"
                          value={editMeta.scopeType}
                          onChange={(event) => {
                            const nextScope = normalizeScopeType(event.target.value);
                            setEditMeta((prev) => ({
                              ...prev,
                              scopeType: nextScope,
                              projectId: nextScope === NOTE_SCOPE_PROJECT ? prev.projectId : "",
                            }));
                          }}
                        >
                          <option value={NOTE_SCOPE_DATE}>Date-based</option>
                          <option value={NOTE_SCOPE_PROJECT}>Project-based</option>
                        </select>
                      </label>

                      {normalizeScopeType(editMeta.scopeType) === NOTE_SCOPE_PROJECT && (
                        <label className="note-meta-field">
                          <span>Project</span>
                          <select
                            className="note-meta-input"
                            value={editMeta.projectId}
                            onChange={(event) => {
                              const projectId = event.target.value;
                              const projectTeamIds = getProjectTeamMemberIds(projectId, projects);
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
                          </select>
                        </label>
                      )}

                      {renderRoleSelectors(editMeta, updateEditMeta)}
                    </div>

                    <RichEditor
                      value={editContent}
                      onChange={setEditContent}
                      members={members}
                      projects={projects}
                      tasks={tasks}
                      resources={resources}
                      notes={notes}
                      currentNoteId={note.id}
                      showDateObjectButton={normalizeScopeType(editMeta.scopeType) === NOTE_SCOPE_PROJECT}
                    />
                    <div className="note-editor-actions">
                      <button
                        className="btn btn--primary"
                        onClick={() => handleSaveEdit(note.id)}
                        disabled={!editMeta.title.trim()}
                      >
                        Save
                      </button>
                      <button
                        className="btn btn--ghost"
                        onClick={() => {
                          setEditingId(null);
                          setViewingId(note.id);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
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

  return (
    <div className="notes-page">
      <h2 className="section-title">Notes / doc</h2>
      <p className="section-subtitle">{notes.length} note{notes.length !== 1 ? "s" : ""}</p>

      <div className="new-note-row">
        <input
          type="text"
          placeholder="New note title..."
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleCreateNote();
          }}
          className="new-note-input"
        />

        <select
          className="note-meta-input"
          value={newScopeType}
          onChange={(event) => {
            const nextScope = normalizeScopeType(event.target.value);
            setNewScopeType(nextScope);
            if (nextScope !== NOTE_SCOPE_PROJECT) setNewProjectId("");
            setNewRoles((prev) => ({
              ...prev,
              meetingParticipantIds: nextScope === NOTE_SCOPE_PROJECT ? prev.meetingParticipantIds : [],
              absentParticipantIds: nextScope === NOTE_SCOPE_PROJECT ? prev.absentParticipantIds : [],
            }));
          }}
        >
          <option value={NOTE_SCOPE_DATE}>Date-based</option>
          <option value={NOTE_SCOPE_PROJECT}>Project-based</option>
        </select>

        {newScopeType === NOTE_SCOPE_PROJECT && (
          <select
            className="note-meta-input"
            value={newProjectId}
            onChange={(event) => {
              const projectId = event.target.value;
              setNewProjectId(projectId);
              const projectTeamIds = getProjectTeamMemberIds(projectId, projects);
              setNewRoles((prev) => ({
                ...prev,
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
          </select>
        )}

        <button
          className="btn btn--primary"
          onClick={handleCreateNote}
          disabled={!newTitle.trim()}
        >
          Create
        </button>
      </div>

      {renderRoleSelectors(newRoles, updateNewRole)}

      <div className="notes-view-toggle">
        <button
          type="button"
          className={groupMode === "date" ? "btn btn--primary btn--small" : "btn btn--ghost btn--small"}
          onClick={() => setGroupMode("date")}
        >
          Date view
        </button>
        <button
          type="button"
          className={groupMode === "project" ? "btn btn--primary btn--small" : "btn btn--ghost btn--small"}
          onClick={() => setGroupMode("project")}
        >
          Project view
        </button>
      </div>

      <div className="search-row">
        <input
          type="text"
          placeholder="Search notes..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="search-input"
        />
        {searchQuery && (
          <button
            className="btn btn--ghost btn--small"
            onClick={() => setSearchQuery("")}
          >
            Clear
          </button>
        )}
      </div>

      <div className="notes-sections">
        {groupMode === "date" ? (
          <>
            {renderNoteSection("Today", groupedNotesByDate.today)}
            {renderNoteSection("Yesterday", groupedNotesByDate.yesterday)}
            {renderNoteSection("This Week", groupedNotesByDate.thisWeek)}
            {renderNoteSection("Older", groupedNotesByDate.older)}
          </>
        ) : (
          <>
            {groupedNotesByProject.map((section) => renderNoteSection(section.title, section.notesList))}
          </>
        )}

        {notes.length === 0 && (
          <p className="empty-state">No notes yet. Create one to get started!</p>
        )}
        {notes.length > 0 && totalSectionsInCurrentMode === 0 && (
          <p className="empty-state">No notes match the current filters.</p>
        )}
      </div>
    </div>
  );
}
