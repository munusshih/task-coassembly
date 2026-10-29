"use client";

import MetadataPill from "./ui/MetadataPill";
import WorkspaceCreateDock from "./ui/WorkspaceCreateDock";
import WorkspacePageHero from "./ui/WorkspacePageHero";
import WorkspaceViewPicker from "./ui/WorkspaceViewPicker";
import { groupWishes } from "./workspaceGroups.mjs";
import BottomComposer from "./ui/BottomComposer";

import CrossIcon from "./ui/CrossIcon";


import useUrlState from "../hooks/useUrlState";
import { useEffect, useState, useMemo, useRef } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  subscribeCollection,
  createDocument,
  deleteDocument,
  replaceDocument,
} from "../../firestore";
import { auth, firebaseReady } from "../../firebase";
import Button from "./Button";
import IconButton from "./IconButton";
import { DELETE_ICON, EDIT_ICON } from "./icons";
import BoardSection from "./ui/BoardSection";
import CollectionLayout from "./ui/CollectionLayout";
import CreateBar from "./ui/CreateBar";
import ModalShell from "./ui/ModalShell";
import InputField from "./ui/InputField";
import Surface from "./ui/Surface";
import PageControls from "./ui/PageControls";
import SearchField from "./ui/SearchField";
import SelectField from "./ui/SelectField";
import TabPage from "./ui/TabPage";
import TextareaField from "./ui/TextareaField";
import { actionRecord } from "../../lib/actionReason.mjs";
import DeleteConfirmDialog from "./ui/DeleteConfirmDialog";
import { renderTextWithLinks } from "./ui/linkifyText";
import {
  currentWeekKey,
  getAssignableMembersForProject,
  isMemberAssignedToProject,
} from "./taskBoardRules";

const TODO_TYPE = "memberTodo";
const REACTION_OPTIONS = [
  { key: "like", icon: "↑", label: "Support" },
  { key: "fire", icon: "◈", label: "Hot" },
  { key: "idea", icon: "◎", label: "Idea" },
  { key: "heart", icon: "♡", label: "Love" },
];

function getLocalReactions(itemId) {
  if (typeof window === "undefined") return [];
  try {
    const stored = JSON.parse(localStorage.getItem("wishes-reactions") || "{}");
    return stored[itemId] || [];
  } catch {
    return [];
  }
}

function setLocalReactions(itemId, emojis) {
  if (typeof window === "undefined") return;
  try {
    const stored = JSON.parse(localStorage.getItem("wishes-reactions") || "{}");
    localStorage.setItem(
      "wishes-reactions",
      JSON.stringify({ ...stored, [itemId]: emojis }),
    );
  } catch {}
}

function formatCommentTime(ts) {
  if (!Number.isFinite(Number(ts))) return "";
  try {
    return new Date(Number(ts)).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function WishItem({
  item,
  projectLabel,
  assignableMembers,
  currentUsername,
  sessionChecked,
  onSessionExpired,
  onDelete,
  onPush,
  onReact,
  onComment,
}) {
  const [pushing, setPushing] = useState(false);
  const [selectedMember, setSelectedMember] = useState("");
  const [pushed, setPushed] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [commentDeleteTarget, setCommentDeleteTarget] = useState(null);
  const [myReactions, setMyReactions] = useState(() =>
    getLocalReactions(item.id),
  );

  const reactions = item.data.reactions || {};
  const comments = Array.isArray(item.data.comments) ? item.data.comments : [];
  const totalReactions = Object.values(reactions).reduce(
    (s, n) => s + (Number(n) || 0),
    0,
  );

  function handleReact(key) {
    const alreadyReacted = myReactions.includes(key);
    const currentCount = Number(reactions[key]) || 0;
    const newCount = alreadyReacted
      ? Math.max(0, currentCount - 1)
      : currentCount + 1;
    const newReactions = { ...reactions, [key]: newCount };
    if (newCount === 0) delete newReactions[key];

    const newMine = alreadyReacted
      ? myReactions.filter((e) => e !== key)
      : [...myReactions, key];

    setMyReactions(newMine);
    setLocalReactions(item.id, newMine);
    onReact(item, newReactions);
  }

  async function handleComment() {
    if (!sessionChecked) return;
    if (!currentUsername) {
      onSessionExpired?.();
      return;
    }
    const text = commentText.trim();
    if (!text) return;
    const now = Date.now();
    const author = (currentUsername || "").trim().toLowerCase();
    const newComments = [
      ...comments,
      {
        id:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `comment-${now}-${Math.random().toString(36).slice(2, 8)}`,
        text,
        ts: now,
        authorUsername: author || null,
      },
    ];
    setCommentText("");
    await onComment(item, newComments);
  }

  function getCommentId(comment, index) {
    return comment?.id || `legacy-${Number(comment?.ts) || 0}-${index}`;
  }

  function isOwnComment(comment) {
    const author = String(comment?.authorUsername || "")
      .trim()
      .toLowerCase();
    const me = String(currentUsername || "")
      .trim()
      .toLowerCase();
    return !!author && !!me && author === me;
  }

  function getCommentAuthorLabel(comment) {
    const author = String(comment?.authorUsername || "").trim();
    if (!author) return "Legacy";
    if (isOwnComment(comment)) return "You";
    return author;
  }

  async function handleDeleteComment(commentId, reason) {
    if (!sessionChecked) return;
    if (!currentUsername) {
      onSessionExpired?.();
      return;
    }
    const newComments = comments.filter(
      (c, i) => getCommentId(c, i) !== commentId,
    );
    await onComment(item, newComments, { ...actionRecord("delete-comment", reason, currentUsername), commentId });
  }

  function requestDeleteComment(commentId, commentTextValue) {
    setCommentDeleteTarget({
      label: "this comment",
      detail: String(commentTextValue || "").slice(0, 180),
      onConfirm: async (reason) => {
        await handleDeleteComment(commentId, reason);
      },
    });
  }

  async function handleSaveCommentEdit(commentId) {
    if (!sessionChecked) return;
    if (!currentUsername) {
      onSessionExpired?.();
      return;
    }
    const nextText = editingCommentText.trim();
    if (!nextText) return;
    const updated = comments.map((c, i) => {
      if (getCommentId(c, i) !== commentId) return c;
      return { ...c, text: nextText, editedAt: Date.now() };
    });
    await onComment(item, updated);
    setEditingCommentId(null);
    setEditingCommentText("");
  }

  async function handlePushConfirm() {
    if (!selectedMember) return;
    const allowed = assignableMembers.some(
      (member) => member.id === selectedMember,
    );
    if (!allowed) return;
    await onPush(item, selectedMember);
    setPushed(true);
    setPushing(false);
    setTimeout(() => setPushed(false), 2500);
    setSelectedMember("");
  }

  return (
    <li className="wish-item">
      <div className="wish-item-main">
        <span className="wish-item-text">{item.data.text}</span>
        <div className="wish-item-controls">
          {totalReactions > 0 && (
            <span className="wish-hot-score" title="Total reactions">
              {totalReactions}
            </span>
          )}
          <button
            type="button"
            className={
              "wish-comment-toggle" +
              (commentsOpen ? " wish-comment-toggle--open" : "")
            }
            onClick={() => setCommentsOpen((o) => !o)}
            title="Comments"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 16 16"
              fill="none"
              style={{ display: "block" }}
            >
              <path
                d="M2 2h12v9H9l-3 3v-3H2V2z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
            {comments.length > 0 && (
              <span className="wish-comment-count">{comments.length}</span>
            )}
          </button>
          {pushing && (
            <ModalShell
              title="Push to board"
              size="sm"
              onClose={() => {
                setPushing(false);
                setSelectedMember("");
              }}
              footer={
                <>
                  <Button
                    size="small"
                    onClick={handlePushConfirm}
                    disabled={!selectedMember}
                  >
                    Push to board
                  </Button>
                  <Button
                    variant="ghost"
                    size="small"
                    onClick={() => {
                      setPushing(false);
                      setSelectedMember("");
                    }}
                  >
                    Cancel
                  </Button>
                </>
              }
            >
              <p className="push-modal-wish">{item.data.text}</p>
              <SelectField
                className="backlog-member-select"
                value={selectedMember}
                onChange={(e) => setSelectedMember(e.target.value)}
                autoFocus
              >
                <option value="">Pick a member…</option>
                {assignableMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.data?.name || m.id}
                  </option>
                ))}
              </SelectField>
              {assignableMembers.length === 0 ? (
                <p className="todo-empty">
                  No assigned members for this project.
                </p>
              ) : null}
            </ModalShell>
          )}
          {pushed ? (
            <span className="backlog-pushed-confirm">✓</span>
          ) : (
            <button
              type="button"
              className="backlog-push-btn"
              onClick={() => setPushing(true)}
              title="Push to member's board"
            >
              →
            </button>
          )}
          <IconButton
            variant="delete"
            onClick={() => onDelete({ id: item.id, text: item.data?.text })}
            title="Delete"
          >
            {DELETE_ICON}
          </IconButton>
        </div>
      </div>

      {projectLabel && <div className="wish-project-tag"><MetadataPill tone="project">{projectLabel}</MetadataPill></div>}
      <div className="wish-reactions">
        {REACTION_OPTIONS.map((option) => {
          const count = Number(reactions[option.key]) || 0;
          const active = myReactions.includes(option.key);
          return (
            <button
              key={option.key}
              type="button"
              className={
                "wish-reaction-btn" +
                (active ? " wish-reaction-btn--active" : "")
              }
              onClick={() => handleReact(option.key)}
              title={option.label}
            >
              <span className="wish-reaction-icon">{option.icon}</span>
              {count > 0 && (
                <span className="wish-reaction-count">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {commentsOpen && (
        <div
          className="wish-comment-overlay"
          onClick={() => setCommentsOpen(false)}
        >
          <div
            className="wish-comment-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="wish-comment-modal-header">
              <span className="wish-comment-modal-title">{item.data.text}</span>
              <button
                type="button"
                className="wish-comment-modal-close"
                onClick={() => setCommentsOpen(false)}
              >
                <CrossIcon />
              </button>
            </div>
            <div className="wish-comment-modal-body">
              {comments.length === 0 && (
                <p className="wish-no-comments">No comments yet.</p>
              )}
              {comments.map((c, i) => {
                const commentId = getCommentId(c, i);
                const own = isOwnComment(c);
                const isEditing = editingCommentId === commentId;
                const tsLabel = formatCommentTime(c?.ts);
                return (
                  <div key={commentId} className="wish-comment-item">
                    <div className="wish-comment-meta-row">
                      <span className="wish-comment-author">
                        {getCommentAuthorLabel(c)}
                      </span>
                      {tsLabel && (
                        <span className="wish-comment-time">{tsLabel}</span>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="wish-comment-edit-row">
                        <TextareaField
                          className="wish-comment-input wish-comment-input--edit"
                          value={editingCommentText}
                          rows={3}
                          onChange={(e) =>
                            setEditingCommentText(e.target.value)
                          }
                          onKeyDown={(e) => {
                            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                              handleSaveCommentEdit(commentId);
                            }
                            if (e.key === "Escape") {
                              setEditingCommentId(null);
                              setEditingCommentText("");
                            }
                          }}
                          autoFocus
                        />
                        <div className="wish-comment-actions">
                          <Button
                            size="small"
                            onClick={() => handleSaveCommentEdit(commentId)}
                            disabled={!editingCommentText.trim()}
                          >
                            Save
                          </Button>
                          <Button
                            variant="ghost"
                            size="small"
                            onClick={() => {
                              setEditingCommentId(null);
                              setEditingCommentText("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="wish-comment-content-row">
                        <span className="wish-comment-text">
                          {renderTextWithLinks(
                            c.text,
                            `wish-comment-${commentId}`,
                          )}
                        </span>
                        {own && (
                          <div className="wish-comment-actions">
                            <IconButton
                              className="wish-comment-action-icon"
                              onClick={() => {
                                setEditingCommentId(commentId);
                                setEditingCommentText(c.text || "");
                              }}
                              title="Edit comment"
                              aria-label="Edit comment"
                            >
                              {EDIT_ICON}
                            </IconButton>
                            <IconButton
                              variant="delete"
                              className="wish-comment-action-icon"
                              onClick={() =>
                                requestDeleteComment(commentId, c.text)
                              }
                              title="Delete comment"
                              aria-label="Delete comment"
                            >
                              {DELETE_ICON}
                            </IconButton>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="wish-comment-modal-footer">
              <TextareaField
                className="wish-comment-input"
                placeholder="Add a comment…"
                value={commentText}
                rows={3}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    handleComment();
                  }
                }}
                autoFocus
              />
              <Button
                size="small"
                onClick={handleComment}
                disabled={!commentText.trim()}
              >
                Post
              </Button>
            </div>
          </div>
        </div>
      )}

      {commentDeleteTarget && (
        <DeleteConfirmDialog
          label={commentDeleteTarget.label}
          detail={commentDeleteTarget.detail}
          onConfirm={async (reason) => {
            try {
              await commentDeleteTarget.onConfirm(reason);
            } finally {
              setCommentDeleteTarget(null);
            }
          }}
          onCancel={() => setCommentDeleteTarget(null)}
        />
      )}
    </li>
  );
}

function ProjectSection({
  project,
  sectionTitle,
  projectNames,
  items,
  archivedItems = [],
  members,
  currentUsername,
  sessionChecked,
  onSessionExpired,
  onAdd,
  onDelete,
  onPush,
  onReact,
  onComment,
}) {
  const [showAll, setShowAll] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const assignableMembers = useMemo(() => {
    return getAssignableMembersForProject(members, project);
  }, [members, project]);

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        const aTotal = Object.values(a.data.reactions || {}).reduce(
          (s, n) => s + Number(n),
          0,
        );
        const bTotal = Object.values(b.data.reactions || {}).reduce(
          (s, n) => s + Number(n),
          0,
        );
        return bTotal - aTotal;
      }),
    [items],
  );

  const SHOW_LIMIT = 5;
  const visibleItems = showAll ? sortedItems : sortedItems.slice(0, SHOW_LIMIT);
  const hiddenCount = sortedItems.length - SHOW_LIMIT;


  return (
    <BoardSection
      title={sectionTitle || project?.data?.name || "Unassigned"}
      badge={String(items.length)}
    >
      <Surface
        className="wish-list-area"
      >
        {visibleItems.length > 0 && (
          <ul className="wish-list">
            {visibleItems.map((item) => (
              <WishItem
                key={item.id}
                item={item}
                projectLabel={projectNames ? (projectNames[item.data?.projectId] || "Unassigned") : null}
                assignableMembers={assignableMembers}
                currentUsername={currentUsername}
                sessionChecked={sessionChecked}
                onSessionExpired={onSessionExpired}
                onDelete={onDelete}
                onPush={onPush}
                onReact={onReact}
                onComment={onComment}
              />
            ))}
          </ul>
        )}

        {!showAll && hiddenCount > 0 && (
          <button
            type="button"
            className="wish-show-more"
            onClick={() => setShowAll(true)}
          >
            Show {hiddenCount} more…
          </button>
        )}
        {showAll && sortedItems.length > SHOW_LIMIT && (
          <button
            type="button"
            className="wish-show-more"
            onClick={() => setShowAll(false)}
          >
            Show less
          </button>
        )}

        {archivedItems.length > 0 && (
          <div className="wish-archive-block">
            <button
              type="button"
              className="wish-show-more"
              onClick={() => setShowArchived((value) => !value)}
            >
              {showArchived
                ? `Hide archived (${archivedItems.length})`
                : `Show archived (${archivedItems.length})`}
            </button>
            {showArchived && (
              <ul className="wish-list wish-list--archived">
                {archivedItems.map((item) => (
                  <WishItem
                    key={item.id}
                    item={item}
                projectLabel={projectNames ? (projectNames[item.data?.projectId] || "Unassigned") : null}
                    assignableMembers={assignableMembers}
                    currentUsername={currentUsername}
                    sessionChecked={sessionChecked}
                    onSessionExpired={onSessionExpired}
                    onDelete={onDelete}
                    onPush={onPush}
                    onReact={onReact}
                    onComment={onComment}
                  />
                ))}
              </ul>
            )}
          </div>
        )}

      </Surface>
    </BoardSection>
  );
}

export default function BacklogPage({ viewerName = "" }) {
  const [composerOpen,setComposerOpen] = useState(false);
  const [wishText,setWishText] = useState("");
  const [wishProject,setWishProject] = useState("");
  const [wishSaving,setWishSaving] = useState(false);
  const [wishError,setWishError] = useState("");
  const [groupMode,setGroupMode] = useUrlState("wishGroup","project",{allowed:["project","date"]});
  const [wishItems, setWishItems] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [searchQuery, setSearchQuery] = useUrlState("wishesSearch", "", { replace: true });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [currentUsername, setCurrentUsername] = useState("");
  const [sessionChecked, setSessionChecked] = useState(false);
  const forcingLogoutRef = useRef(false);

  async function handleSessionExpired() {
    if (forcingLogoutRef.current) return;
    forcingLogoutRef.current = true;
    try {
      if (auth) {
        await signOut(auth);
      }
    } catch {}
    if (typeof window !== "undefined") {
      window.location.assign("/login?expired=1");
    }
  }

  useEffect(() => {
    if (!firebaseReady) return;
    const u1 = subscribeCollection("backlogItems", setWishItems, setLoadError);
    const u2 = subscribeCollection("projects", setProjects);
    const u3 = subscribeCollection("members", setMembers);
    const u4 = subscribeCollection("tasks", (items) =>
      setTasks(items.filter((item) => item?.data?.type === TODO_TYPE)),
    );
    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, []);

  useEffect(() => {
    const next = String(viewerName || "").trim();
    if (!next) return;
    setCurrentUsername(next);
    setSessionChecked(true);
  }, [viewerName]);

  useEffect(() => {
    if (viewerName) {
      return undefined;
    }
    if (!auth) {
      setSessionChecked(true);
      return undefined;
    }

    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        handleSessionExpired();
        return;
      }

      const username = String(user.email || user.displayName || "")
        .trim()
        .toLowerCase();
      if (!username) {
        handleSessionExpired();
        return;
      }

      setCurrentUsername(username);
      setSessionChecked(true);
    });

    return () => unsub();
  }, [viewerName]);

  const sortedProjects = useMemo(
    () =>
      [...projects].sort((a, b) =>
        (a.data?.name || "").localeCompare(b.data?.name || ""),
      ),
    [projects],
  );

  const filteredItems = useMemo(() => {
    if (!searchQuery) return wishItems;
    const q = searchQuery.toLowerCase();
    return wishItems.filter((i) =>
      (i.data.text || "").toLowerCase().includes(q),
    );
  }, [wishItems, searchQuery]);

  useEffect(() => {
    if (!wishItems.length || !tasks.length) return;

    const taskById = new Map(tasks.map((task) => [task.id, task]));
    const updates = [];

    for (const wish of wishItems) {
      const linkedTaskIds = Array.isArray(wish?.data?.linkedTaskIds)
        ? wish.data.linkedTaskIds
        : [];
      if (linkedTaskIds.length === 0) continue;

      const linkedTasks = linkedTaskIds
        .map((taskId) => taskById.get(taskId))
        .filter(Boolean);
      if (!linkedTasks.length) continue;

      const allFinished = linkedTasks.every(
        (task) =>
          Boolean(task?.data?.completed) || Boolean(task?.data?.archived),
      );
      const currentlyArchived = Boolean(wish?.data?.archived);
      if (allFinished === currentlyArchived) continue;

      updates.push(
        replaceDocument("backlogItems", wish.id, {
          ...wish.data,
          archived: allFinished,
          archivedAt: allFinished
            ? Number(wish?.data?.archivedAt) || Date.now()
            : null,
          updatedAt: Date.now(),
        }),
      );
    }

    if (!updates.length) return;

    Promise.all(updates).catch((error) => {
      console.error("Could not sync wish archive state:", error);
    });
  }, [wishItems, tasks]);

  async function handleAdd(text, projectId) {
    try {
      await createDocument("backlogItems", {
        text,
        projectId: projectId || null,
        reactions: {},
        comments: [],
        linkedTaskIds: [],
        archived: false,
        archivedAt: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    } catch (e) {
      console.error("Could not add wish:", e);
      throw e;
    }
  }

  async function handleDelete({ id, text }) {
    setDeleteTarget({
      label: text || "this item",
      onConfirm: async (reason) => {
        try {
          await deleteDocument("backlogItems", id, reason);
        } catch (e) {
          console.error("Could not delete wish:", e);
        } finally {
          setDeleteTarget(null);
        }
      },
    });
  }

  async function handlePush(item, memberId) {
    const projectId = item?.data?.projectId || null;
    if (projectId) {
      const project = projects.find((entry) => entry.id === projectId);
      if (!isMemberAssignedToProject(project, memberId)) {
        console.error(
          "Cannot push wish to member not assigned to this project",
        );
        return;
      }
    }

    const now = Date.now();
    try {
      const taskId = await createDocument("tasks", {
        type: TODO_TYPE,
        memberId,
        title: item.data.text,
        projectId,
        sourceWishId: item.id,
        sourceWishText: item.data.text || "",
        sourceWishSnapshotAt: now,
        timeUnits: null,
        deadline: null,
        subtasks: [],
        links: [],
        completed: false,
        reviewed: false,
        completionState: "open",
        archived: false,
        taskWeek: currentWeekKey(),
        orderIndex: now,
        createdAt: now,
        updatedAt: now,
      });

      const existingLinkedTaskIds = Array.isArray(item?.data?.linkedTaskIds)
        ? item.data.linkedTaskIds
        : [];
      const linkedTaskIds = [...existingLinkedTaskIds, taskId].filter(
        (id, index, all) => all.indexOf(id) === index,
      );

      await replaceDocument("backlogItems", item.id, {
        ...item.data,
        linkedTaskIds,
        archived: true,
        archivedAt: now,
        lastAssignedAt: now,
        updatedAt: now,
      });
    } catch (e) {
      console.error("Could not push task:", e);
    }
  }

  async function handleReact(item, newReactions) {
    try {
      await replaceDocument("backlogItems", item.id, {
        ...item.data,
        reactions: newReactions,
      });
    } catch (e) {
      console.error("Could not update reactions:", e);
    }
  }

  async function handleComment(item, newComments, deletion) {
    try {
      await replaceDocument("backlogItems", item.id, {
        ...item.data,
        comments: newComments,
        ...(deletion ? { commentDeletionHistory: [...(item.data.commentDeletionHistory || []), deletion] } : {}),
      });
    } catch (e) {
      console.error("Could not update comments:", e);
    }
  }


  if (loadError) {
    return (
      <TabPage title="Wishes">
        <p className="error-message" role="alert">
          {loadError.code === "permission-denied"
            ? "Wishes could not be loaded. The current Firebase rules do not allow access to backlogItems."
            : "Wishes could not be loaded. Reload to try again."}
        </p>
      </TabPage>
    );
  }

  return (
    <TabPage
      className="backlog-page"
      title="Wishes"
      header={<WorkspacePageHero title="Wishes" illustration="wishes-catcher"><WorkspaceViewPicker label="Wish grouping" value={groupMode} onChange={setGroupMode} options={[{value:'project',label:'Projects'},{value:'date',label:'Date'}]} /></WorkspacePageHero>}
    >
      <WorkspaceCreateDock label="New wish" expanded={composerOpen} onClick={()=>setComposerOpen(true)} />
      <div className="workspace-search"><SearchField ariaLabel="Search wishes" placeholder="Find a wish…" value={searchQuery} onChange={event=>setSearchQuery(event.target.value)} onClear={()=>setSearchQuery("")} /></div>
      {composerOpen && <BottomComposer illustration="wishes-catcher" title="New wish" onClose={()=>setComposerOpen(false)}><form className="workspace-compose-form" onSubmit={async event=>{
        event.preventDefault(); if(!wishText.trim() || wishSaving) return;setWishSaving(true);setWishError("");
        try { await handleAdd(wishText.trim(),wishProject);setComposerOpen(false);setWishText("");setWishProject(""); } catch(error) {setWishError(error.message||"Could not save this wish. Try again.");} finally {setWishSaving(false);}
      }}><label><span>What would you like to do?</span><InputField value={wishText} onChange={event=>setWishText(event.target.value)} placeholder="An idea, a possibility, a next step…" required /></label><label><span>Project</span><SelectField value={wishProject} onChange={event=>setWishProject(event.target.value)}><option value="">Unassigned</option>{sortedProjects.map(project=><option key={project.id} value={project.id}>{project.data?.name||project.id}</option>)}</SelectField></label>{wishError&&<p role="alert">{wishError}</p>}<div className="workspace-compose-actions"><Button type="submit" disabled={wishSaving||!wishText.trim()}>{wishSaving?'Saving…':'Add wish'}</Button><Button type="button" variant="ghost" onClick={()=>setComposerOpen(false)}>Cancel</Button></div></form></BottomComposer>}
      <CollectionLayout variant="board" className="backlog-grid workspace-wish-grid">
        {groupWishes(filteredItems,projects,groupMode).map(group=><ProjectSection key={`${groupMode}-${group.id}`} sectionTitle={group.title} projectNames={groupMode === "date" ? Object.fromEntries(projects.map(project=>[project.id,project.data?.name||project.id])) : null} project={group.project} items={group.items} archivedItems={group.archivedItems} members={members} currentUsername={currentUsername} sessionChecked={sessionChecked} onSessionExpired={handleSessionExpired} onAdd={handleAdd} onDelete={handleDelete} onPush={handlePush} onReact={handleReact} onComment={handleComment} />)}
      </CollectionLayout>
      {!filteredItems.length && <p className="workspace-empty">{searchQuery?'No wishes match your search.':'Nothing here yet. Add your first wish below.'}</p>}

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
