"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import {
  subscribeCollection,
  createDocument,
  deleteDocument,
  replaceDocument,
} from "../../firestore";
import { firebaseReady } from "../../firebase";
import Button from "./Button";
import IconButton from "./IconButton";
import { DELETE_ICON, EDIT_ICON } from "./icons";
import BoardSection from "./ui/BoardSection";
import CollectionLayout from "./ui/CollectionLayout";
import CreateBar from "./ui/CreateBar";
import ModalShell from "./ui/ModalShell";
import InputField from "./ui/InputField";
import PaperSurface from "./ui/PaperSurface";
import PageControls from "./ui/PageControls";
import { SURFACE_TEXTURES } from "./ui/paperTextures";
import SearchField from "./ui/SearchField";
import SelectField from "./ui/SelectField";
import TabPage from "./ui/TabPage";
import TextareaField from "./ui/TextareaField";
import DeleteConfirmDialog from "./ui/DeleteConfirmDialog";
import { renderTextWithLinks } from "./ui/linkifyText";

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
  members,
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

  async function handleDeleteComment(commentId) {
    if (!sessionChecked) return;
    if (!currentUsername) {
      onSessionExpired?.();
      return;
    }
    const newComments = comments.filter(
      (c, i) => getCommentId(c, i) !== commentId,
    );
    await onComment(item, newComments);
  }

  function requestDeleteComment(commentId, commentTextValue) {
    setCommentDeleteTarget({
      label: "this comment",
      detail: String(commentTextValue || "").slice(0, 180),
      onConfirm: async () => {
        await handleDeleteComment(commentId);
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
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.data?.name || m.id}
                  </option>
                ))}
              </SelectField>
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
                ✕
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
          onConfirm={async () => {
            try {
              await commentDeleteTarget.onConfirm();
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
  items,
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
  const [addText, setAddText] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

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

  async function handleAdd() {
    const text = addText.trim();
    if (!text) return;
    await onAdd(text, project?.id || null);
    setAddText("");
    setAddOpen(false);
  }

  return (
    <BoardSection
      title={project?.data?.name || "Unassigned"}
      badge={String(items.length)}
    >
      <PaperSurface
        className="wish-list-area"
        texture={SURFACE_TEXTURES.backlogWishes}
      >
        {visibleItems.length > 0 && (
          <ul className="wish-list">
            {visibleItems.map((item) => (
              <WishItem
                key={item.id}
                item={item}
                members={members}
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

        <CreateBar
          open={addOpen}
          onOpen={() => setAddOpen(true)}
          label="Add wish"
          inset
          triggerClassName="backlog-create-trigger"
          rowClassName="backlog-add-row"
        >
          <InputField
            className="backlog-add-input"
            type="text"
            placeholder="Describe the wish or idea…"
            value={addText}
            autoFocus
            onChange={(e) => setAddText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") {
                setAddOpen(false);
                setAddText("");
              }
            }}
          />
          <Button size="small" onClick={handleAdd} disabled={!addText.trim()}>
            Add
          </Button>
          <Button
            variant="ghost"
            size="small"
            onClick={() => {
              setAddOpen(false);
              setAddText("");
            }}
          >
            Cancel
          </Button>
        </CreateBar>
      </PaperSurface>
    </BoardSection>
  );
}

export default function BacklogPage() {
  const [wishItems, setWishItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [currentUsername, setCurrentUsername] = useState("");
  const [sessionChecked, setSessionChecked] = useState(false);
  const forcingLogoutRef = useRef(false);

  async function handleSessionExpired() {
    if (forcingLogoutRef.current) return;
    forcingLogoutRef.current = true;
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } catch {}
    if (typeof window !== "undefined") {
      window.location.assign("/login?expired=1");
    }
  }

  useEffect(() => {
    if (!firebaseReady) return;
    const u1 = subscribeCollection("backlogItems", setWishItems);
    const u2 = subscribeCollection("projects", setProjects);
    const u3 = subscribeCollection("members", setMembers);
    return () => {
      u1();
      u2();
      u3();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) handleSessionExpired();
          return;
        }
        const payload = await res.json();
        if (cancelled) return;
        const username = String(payload?.username || "")
          .trim()
          .toLowerCase();
        if (!username) {
          handleSessionExpired();
          return;
        }
        setCurrentUsername(username);
      } catch {
        if (!cancelled) handleSessionExpired();
      } finally {
        if (!cancelled) setSessionChecked(true);
      }
    }

    loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const groupedItems = useMemo(() => {
    const map = {};
    filteredItems.forEach((item) => {
      const pid = item.data.projectId || "__none__";
      if (!map[pid]) map[pid] = [];
      map[pid].push(item);
    });
    return map;
  }, [filteredItems]);

  async function handleAdd(text, projectId) {
    try {
      await createDocument("backlogItems", {
        text,
        projectId: projectId || null,
        reactions: {},
        comments: [],
        createdAt: Date.now(),
      });
    } catch (e) {
      console.error("Could not add wish:", e);
    }
  }

  async function handleDelete({ id, text }) {
    setDeleteTarget({
      label: text || "this item",
      onConfirm: async () => {
        try {
          await deleteDocument("backlogItems", id);
        } catch (e) {
          console.error("Could not delete wish:", e);
        } finally {
          setDeleteTarget(null);
        }
      },
    });
  }

  async function handlePush(item, memberId) {
    const now = Date.now();
    try {
      await createDocument("tasks", {
        type: TODO_TYPE,
        memberId,
        title: item.data.text,
        projectId: item.data.projectId || null,
        timeUnits: null,
        deadline: null,
        subtasks: [],
        links: [],
        completed: false,
        archived: false,
        orderIndex: now,
        createdAt: now,
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

  async function handleComment(item, newComments) {
    try {
      await replaceDocument("backlogItems", item.id, {
        ...item.data,
        comments: newComments,
      });
    } catch (e) {
      console.error("Could not update comments:", e);
    }
  }

  const totalItems = wishItems.length;

  return (
    <TabPage
      className="backlog-page"
      title="Wishes"
      badge={`${totalItems} wish${totalItems !== 1 ? "es" : ""}`}
      right={
        <PageControls compact>
          <SearchField
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery("")}
          />
        </PageControls>
      }
    >
      <CollectionLayout variant="board" className="backlog-grid">
        {sortedProjects.map((project) => (
          <ProjectSection
            key={project.id}
            project={project}
            items={groupedItems[project.id] || []}
            members={members}
            currentUsername={currentUsername}
            sessionChecked={sessionChecked}
            onSessionExpired={handleSessionExpired}
            onAdd={handleAdd}
            onDelete={handleDelete}
            onPush={handlePush}
            onReact={handleReact}
            onComment={handleComment}
          />
        ))}
        <ProjectSection
          key="__none__"
          project={null}
          items={groupedItems["__none__"] || []}
          members={members}
          currentUsername={currentUsername}
          sessionChecked={sessionChecked}
          onSessionExpired={handleSessionExpired}
          onAdd={handleAdd}
          onDelete={handleDelete}
          onPush={handlePush}
          onReact={handleReact}
          onComment={handleComment}
        />
      </CollectionLayout>

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
