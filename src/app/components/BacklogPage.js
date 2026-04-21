"use client";

import { useEffect, useState, useMemo } from "react";
import {
  subscribeCollection,
  createDocument,
  deleteDocument,
  replaceDocument,
} from "../../firestore";
import { firebaseReady } from "../../firebase";
import IconButton from "./IconButton";
import { DELETE_ICON } from "./icons";

const TODO_TYPE = "memberTodo";
const REACTION_EMOJIS = ["👍", "🔥", "💡", "❤️"];

function getLocalReactions(itemId) {
  if (typeof window === "undefined") return [];
  try {
    const stored = JSON.parse(localStorage.getItem("wishes-reactions") || "{}");
    return stored[itemId] || [];
  } catch { return []; }
}

function setLocalReactions(itemId, emojis) {
  if (typeof window === "undefined") return;
  try {
    const stored = JSON.parse(localStorage.getItem("wishes-reactions") || "{}");
    localStorage.setItem("wishes-reactions", JSON.stringify({ ...stored, [itemId]: emojis }));
  } catch {}
}

function WishItem({ item, members, onDelete, onPush, onReact, onComment }) {
  const [pushing, setPushing] = useState(false);
  const [selectedMember, setSelectedMember] = useState("");
  const [pushed, setPushed] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [myReactions, setMyReactions] = useState(() => getLocalReactions(item.id));

  const reactions = item.data.reactions || {};
  const comments = Array.isArray(item.data.comments) ? item.data.comments : [];
  const totalReactions = Object.values(reactions).reduce((s, n) => s + (Number(n) || 0), 0);

  function handleReact(emoji) {
    const alreadyReacted = myReactions.includes(emoji);
    const currentCount = Number(reactions[emoji]) || 0;
    const newCount = alreadyReacted ? Math.max(0, currentCount - 1) : currentCount + 1;
    const newReactions = { ...reactions, [emoji]: newCount };
    if (newCount === 0) delete newReactions[emoji];

    const newMine = alreadyReacted
      ? myReactions.filter((e) => e !== emoji)
      : [...myReactions, emoji];

    setMyReactions(newMine);
    setLocalReactions(item.id, newMine);
    onReact(item, newReactions);
  }

  async function handleComment() {
    const text = commentText.trim();
    if (!text) return;
    const newComments = [...comments, { text, ts: Date.now() }];
    setCommentText("");
    await onComment(item, newComments);
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
            <span className="wish-hot-score" title="Total reactions">{totalReactions}</span>
          )}
          <button
            type="button"
            className={"wish-comment-toggle" + (commentsOpen ? " wish-comment-toggle--open" : "")}
            onClick={() => setCommentsOpen((o) => !o)}
            title="Comments"
          >
            💬{comments.length > 0 && <span className="wish-comment-count">{comments.length}</span>}
          </button>
          {pushing && (
            <div className="edit-modal-overlay" onClick={() => { setPushing(false); setSelectedMember(""); }}>
              <div className="edit-modal edit-modal--sm" onClick={(e) => e.stopPropagation()}>
                <div className="edit-modal-header">
                  <span className="edit-modal-title">Push to board</span>
                  <button type="button" className="edit-modal-close" onClick={() => { setPushing(false); setSelectedMember(""); }}>✕</button>
                </div>
                <div className="edit-modal-body">
                  <p className="push-modal-wish">{item.data.text}</p>
                  <select
                    className="backlog-member-select"
                    value={selectedMember}
                    onChange={(e) => setSelectedMember(e.target.value)}
                    autoFocus
                  >
                    <option value="">Pick a member…</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>{m.data?.name || m.id}</option>
                    ))}
                  </select>
                </div>
                <div className="edit-modal-footer">
                  <button type="button" className="btn btn--primary btn--small" onClick={handlePushConfirm} disabled={!selectedMember}>Push to board</button>
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => { setPushing(false); setSelectedMember(""); }}>Cancel</button>
                </div>
              </div>
            </div>
          )}
          {pushed ? (
            <span className="backlog-pushed-confirm">✓</span>
          ) : (
            <button type="button" className="backlog-push-btn" onClick={() => setPushing(true)} title="Push to member's board">→</button>
          )}
          <IconButton variant="delete" onClick={() => onDelete(item.id)} title="Delete">{DELETE_ICON}</IconButton>
        </div>
      </div>

      <div className="wish-reactions">
        {REACTION_EMOJIS.map((emoji) => {
          const count = Number(reactions[emoji]) || 0;
          const active = myReactions.includes(emoji);
          return (
            <button
              key={emoji}
              type="button"
              className={"wish-reaction-btn" + (active ? " wish-reaction-btn--active" : "")}
              onClick={() => handleReact(emoji)}
              title={active ? "Remove reaction" : "React"}
            >
              {emoji}
              {count > 0 && <span className="wish-reaction-count">{count}</span>}
            </button>
          );
        })}
      </div>

      {commentsOpen && (
        <div className="wish-comment-overlay" onClick={() => setCommentsOpen(false)}>
          <div className="wish-comment-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wish-comment-modal-header">
              <span className="wish-comment-modal-title">{item.data.text}</span>
              <button type="button" className="wish-comment-modal-close" onClick={() => setCommentsOpen(false)}>✕</button>
            </div>
            <div className="wish-comment-modal-body">
              {comments.length === 0 && (
                <p className="wish-no-comments">No comments yet.</p>
              )}
              {comments.map((c, i) => (
                <div key={i} className="wish-comment-item">
                  <span className="wish-comment-text">{c.text}</span>
                </div>
              ))}
            </div>
            <div className="wish-comment-modal-footer">
              <input
                className="wish-comment-input"
                type="text"
                placeholder="Add a comment…"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleComment(); }}
                autoFocus
              />
              <button type="button" className="btn btn--primary btn--small" onClick={handleComment} disabled={!commentText.trim()}>
                Post
              </button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

function ProjectSection({ project, items, members, onAdd, onDelete, onPush, onReact, onComment }) {
  const [addText, setAddText] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const sortedItems = useMemo(() =>
    [...items].sort((a, b) => {
      const aTotal = Object.values(a.data.reactions || {}).reduce((s, n) => s + Number(n), 0);
      const bTotal = Object.values(b.data.reactions || {}).reduce((s, n) => s + Number(n), 0);
      return bTotal - aTotal;
    }),
    [items]
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
    <div className="backlog-section">
      <div className="backlog-section-head">
        <span className="backlog-section-title">{project?.data?.name || "Unassigned"}</span>
        <span className="backlog-section-count">{items.length}</span>
      </div>

      <div className="wish-list-area">
        {visibleItems.length > 0 && (
          <ul className="wish-list">
            {visibleItems.map((item) => (
              <WishItem
                key={item.id}
                item={item}
                members={members}
                onDelete={onDelete}
                onPush={onPush}
                onReact={onReact}
                onComment={onComment}
              />
            ))}
          </ul>
        )}

        {!showAll && hiddenCount > 0 && (
          <button type="button" className="wish-show-more" onClick={() => setShowAll(true)}>
            Show {hiddenCount} more…
          </button>
        )}
        {showAll && sortedItems.length > SHOW_LIMIT && (
          <button type="button" className="wish-show-more" onClick={() => setShowAll(false)}>
            Show less
          </button>
        )}

        {addOpen ? (
          <div className="backlog-add-row">
            <input
              className="backlog-add-input"
              type="text"
              placeholder="Describe the wish or idea…"
              value={addText}
              autoFocus
              onChange={(e) => setAddText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") { setAddOpen(false); setAddText(""); }
              }}
            />
            <button type="button" className="btn btn--primary btn--small" onClick={handleAdd} disabled={!addText.trim()}>Add</button>
            <button type="button" className="btn btn--ghost btn--small" onClick={() => { setAddOpen(false); setAddText(""); }}>Cancel</button>
          </div>
        ) : (
          <button type="button" className="backlog-add-trigger" onClick={() => setAddOpen(true)}>
            + Add wish
          </button>
        )}
      </div>
    </div>
  );
}

export default function BacklogPage() {
  const [wishItems, setWishItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!firebaseReady) return;
    const u1 = subscribeCollection("backlogItems", setWishItems);
    const u2 = subscribeCollection("projects", setProjects);
    const u3 = subscribeCollection("members", setMembers);
    return () => { u1(); u2(); u3(); };
  }, []);

  const sortedProjects = useMemo(() =>
    [...projects].sort((a, b) => (a.data?.name || "").localeCompare(b.data?.name || "")),
    [projects]
  );

  const filteredItems = useMemo(() => {
    if (!searchQuery) return wishItems;
    const q = searchQuery.toLowerCase();
    return wishItems.filter((i) => (i.data.text || "").toLowerCase().includes(q));
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

  async function handleDelete(id) {
    try {
      await deleteDocument("backlogItems", id);
    } catch (e) {
      console.error("Could not delete wish:", e);
    }
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
      await replaceDocument("backlogItems", item.id, { ...item.data, reactions: newReactions });
    } catch (e) {
      console.error("Could not update reactions:", e);
    }
  }

  async function handleComment(item, newComments) {
    try {
      await replaceDocument("backlogItems", item.id, { ...item.data, comments: newComments });
    } catch (e) {
      console.error("Could not update comments:", e);
    }
  }

  const totalItems = wishItems.length;

  return (
    <div className="backlog-page">
      <div className="resources-topbar">
        <div className="resources-topbar-left">
          <h2 className="section-title">Wishes</h2>
          <span className="resources-count">{totalItems} wish{totalItems !== 1 ? "es" : ""}</span>
        </div>
        <div className="resources-topbar-right">
          <input
            type="text"
            placeholder="Search…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="resource-input resource-search"
          />
          {searchQuery && (
            <button type="button" className="resource-search-clear" onClick={() => setSearchQuery("")}>×</button>
          )}
        </div>
      </div>

      <div className="backlog-grid">
        {sortedProjects.map((project) => (
          <ProjectSection
            key={project.id}
            project={project}
            items={groupedItems[project.id] || []}
            members={members}
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
          onAdd={handleAdd}
          onDelete={handleDelete}
          onPush={handlePush}
          onReact={handleReact}
          onComment={handleComment}
        />
      </div>
    </div>
  );
}
