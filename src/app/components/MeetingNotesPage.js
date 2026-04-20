"use client";

import { useEffect, useState, useMemo } from "react";
import {
  subscribeCollection,
  createDocument,
  replaceDocument,
  deleteDocument,
} from "../../firestore";
import { firebaseReady } from "../../firebase";
import RichEditor from "./RichEditor";

// Funny Google Docs style names
const FUNNY_NAMES = [
  "Curious Capybara",
  "Zealous Zebra",
  "Playful Penguin",
  "Mighty Moose",
  "Brilliant Badger",
  "Clever Coyote",
  "Daring Dolphin",
  "Energetic Elephant",
  "Fearless Fox",
  "Gleeful Giraffe",
];

function getRandomName() {
  return FUNNY_NAMES[Math.floor(Math.random() * FUNNY_NAMES.length)];
}

export default function MeetingNotesPage() {
  const [notes, setNotes] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [viewingId, setViewingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [randomName] = useState(getRandomName());
  const [members, setMembers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);

  // Subscribe to meeting notes
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
    return () => {
      u1();
      u2();
      u3();
    };
  }, []);

  // Filter notes based on search and track why they match
  const filteredNotes = useMemo(() => {
    if (!searchQuery) return notes.map((n) => ({ ...n, matchType: null }));
    const query = searchQuery.toLowerCase();
    return notes
      .filter((note) => {
        const content = (note.data.content || "").toLowerCase();
        const title = (note.data.title || "").toLowerCase();
        return content.includes(query) || title.includes(query);
      })
      .map((note) => {
        const content = (note.data.content || "").toLowerCase();
        const title = (note.data.title || "").toLowerCase();
        const query = searchQuery.toLowerCase();
        let matchType = null;
        if (title.includes(query)) matchType = "title";
        else if (content.includes(query)) matchType = "content";
        return { ...note, matchType };
      });
  }, [notes, searchQuery]);

  // Group notes by date
  const groupedNotes = useMemo(() => {
    const now = Date.now();
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

  async function handleCreateNote() {
    if (!newTitle.trim()) return;
    try {
      await createDocument("meetingNotes", {
        title: newTitle.trim(),
        content: "",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      setNewTitle("");
    } catch (e) {
      console.error("Could not create note:", e);
    }
  }

  async function handleSaveEdit(id, content) {
    try {
      const note = notes.find((n) => n.id === id);
      if (note) {
        await replaceDocument("meetingNotes", id, {
          ...note.data,
          content,
          updatedAt: Date.now(),
        });
        setEditingId(null);
      }
    } catch (e) {
      console.error("Could not save note:", e);
    }
  }

  async function handleDeleteNote(id) {
    if (!window.confirm("Delete this note?")) return;
    try {
      await deleteDocument("meetingNotes", id);
    } catch (e) {
      console.error("Could not delete note:", e);
    }
  }

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

  function renderNoteSection(title, notesList) {
    if (!notesList.length) return null;

    return (
      <div key={title} className="notes-section">
        <h3 className="notes-section-title">{title}</h3>
        <ul className="notes-list">
          {notesList.map((note) => (
            <li key={note.id} className="note-item">
              <div className="note-row">
                <div className="note-content-col">
                  <span 
                    className="note-title"
                    onClick={() => {
                      setViewingId(note.id);
                      setEditingId(null);
                    }}
                    onDoubleClick={() => {
                      setViewingId(note.id);
                      setEditingId(note.id);
                      setEditContent(note.data.content || "");
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    {formatDateInTitle(note.data.createdAt)} · {note.data.title || "Untitled"}
                    {searchQuery && note.matchType && (
                      <span className="match-indicator">(matched in {note.matchType})</span>
                    )}
                  </span>
                  {note.data.updatedAt && note.data.updatedAt !== note.data.createdAt && (
                    <span className="note-updated">
                      Updated {formatUpdatedTime(note.data.updatedAt)}
                    </span>
                  )}
                </div>
                <div className="note-actions-row">
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setViewingId(viewingId === note.id ? null : note.id);
                      setEditingId(null);
                    }}
                    title={viewingId === note.id ? "Hide" : "View"}
                  >
                    {viewingId === note.id ? "−" : "+"}
                  </button>
                  {editingId !== note.id && (
                    <button
                      type="button"
                      className="icon-btn"
                      title="Edit"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditingId(note.id);
                        setEditContent(note.data.content || "");
                      }}
                    >
                      ✎
                    </button>
                  )}
                  <button
                    type="button"
                    className="icon-btn icon-btn--delete"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDeleteNote(note.id);
                    }}
                    title="Delete note"
                  >
                    ×
                  </button>
                </div>
              </div>

              {viewingId === note.id && editingId !== note.id && (
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

              {editingId === note.id && (
                <div className="note-editor-row">
                  <RichEditor
                    value={editContent}
                    onChange={setEditContent}
                    members={members}
                    projects={projects}
                    tasks={tasks}
                  />
                  <div className="note-editor-actions">
                    <button
                      className="btn btn--primary"
                      onClick={() => handleSaveEdit(note.id, editContent)}
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
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="notes-page">
      <h2 className="section-title">Meeting Notes</h2>
      <p className="section-subtitle">{notes.length} note{notes.length !== 1 ? "s" : ""}</p>

      <div className="new-note-row">
        <input
          type="text"
          placeholder="New note title..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreateNote();
          }}
          className="new-note-input"
        />
        <button
          className="btn btn--primary"
          onClick={handleCreateNote}
          disabled={!newTitle.trim()}
        >
          Create
        </button>
      </div>

      <div className="search-row">
        <input
          type="text"
          placeholder="Search notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
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
        {renderNoteSection("Today", groupedNotes.today)}
        {renderNoteSection("Yesterday", groupedNotes.yesterday)}
        {renderNoteSection("This Week", groupedNotes.thisWeek)}
        {renderNoteSection("Older", groupedNotes.older)}

        {notes.length === 0 && (
          <p className="empty-state">No notes yet. Create one to get started!</p>
        )}
      </div>
    </div>
  );
}
