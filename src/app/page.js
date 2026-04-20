"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { firebaseReady } from "../firebase";
import { createDocument, deleteDocument, replaceDocument, subscribeCollection } from "../firestore";
import Navigation from "./components/Navigation";
import MembersPage from "./components/MembersPage";
import ProjectsPage from "./components/ProjectsPage";
import DataViewPage from "./components/DataViewPage";
import MeetingNotesPage from "./components/MeetingNotesPage";
import ResourcesPage from "./components/ResourcesPage";
import TbdPage from "./components/TbdPage";

const DATA_TABS = ["meetingNotes"];
const TBD_TABS = ["finance"];

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
  "Happy Hedgehog",
  "Industrious Ibis",
  "Joyful Jaguar",
  "Kind Koala",
  "Lively Lemur",
  "Marvelous Meerkat",
  "Nimble Narwhal",
  "Optimistic Otter",
  "Perky Porcupine",
  "Quick Quetzal",
];

const PRESENCE_COLORS = [
  "#D81B60", "#1E88E5", "#43A047", "#F4511E", "#5E35B1", "#00897B", "#6D4C41", "#8E24AA",
];

function hashIdToName(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  const index = Math.abs(hash) % FUNNY_NAMES.length;
  return FUNNY_NAMES[index];
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function hashIdToColor(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length];
}

function buildLocalIdentity() {
  const id = (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : "viewer-" + Math.random().toString(36).slice(2, 10);
  return {
    id,
    name: hashIdToName(id),
    color: hashIdToColor(id),
  };
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("members");
  const [identity, setIdentity] = useState(null);
  const [presenceRows, setPresenceRows] = useState([]);
  const [commentRows, setCommentRows] = useState([]);
  const cursorRef = useRef({ x: 120, y: 120 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = "coassembly-viewer-v2";
    try {
      const existing = localStorage.getItem(key);
      if (existing) {
        setIdentity(JSON.parse(existing));
        return;
      }
      const created = buildLocalIdentity();
      localStorage.setItem(key, JSON.stringify(created));
      setIdentity(created);
    } catch {
      setIdentity(buildLocalIdentity());
    }
  }, []);

  useEffect(() => {
    if (!firebaseReady) return;
    const unsub = subscribeCollection("presence", setPresenceRows);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!firebaseReady) return;
    const unsub = subscribeCollection("tabComments", setCommentRows);
    return () => unsub();
  }, []);

  const viewers = useMemo(() => {
    const now = Date.now();
    return presenceRows
      .map((row) => ({ id: row.id, ...row.data }))
      .filter((v) => now - Number(v.lastSeen || 0) < 15000)
      .sort((a, b) => Number(b.lastSeen || 0) - Number(a.lastSeen || 0));
  }, [presenceRows]);

  useEffect(() => {
    if (!firebaseReady || !identity) return;

    let stopped = false;

    async function writePresence() {
      if (stopped) return;
      try {
        await replaceDocument("presence", identity.id, {
          name: identity.name,
          color: identity.color,
          tab: activeTab,
          cursorX: cursorRef.current.x,
          cursorY: cursorRef.current.y,
          lastSeen: Date.now(),
        });
      } catch {
        // Ignore transient network issues; next heartbeat retries.
      }
    }

    writePresence();
    const timer = window.setInterval(writePresence, 2500);

    function onMove(e) {
      cursorRef.current = { x: e.clientX, y: e.clientY };
    }
    window.addEventListener("mousemove", onMove);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener("mousemove", onMove);
      deleteDocument("presence", identity.id).catch(() => {});
    };
  }, [activeTab, identity]);

  const peerCursors = useMemo(() => {
    if (!identity) return [];
    return viewers.filter((v) => v.id !== identity.id && v.tab === activeTab);
  }, [viewers, activeTab, identity]);

  const tabComments = useMemo(
    () => commentRows.map((row) => ({ id: row.id, ...row.data })),
    [commentRows],
  );

  const commentCounts = useMemo(() => {
    return tabComments.reduce((acc, comment) => {
      const tab = comment.tab || "members";
      acc[tab] = (acc[tab] || 0) + 1;
      return acc;
    }, {});
  }, [tabComments]);

  const activeTabComments = useMemo(
    () => tabComments.filter((comment) => comment.tab === activeTab),
    [tabComments, activeTab],
  );

  useEffect(() => {
    if (!firebaseReady || !identity) return;

    function onKeyDown(e) {
      const t = e.target;
      const isTypingTarget =
        t instanceof HTMLElement &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (isTypingTarget) return;
      if (!(e.key.toLowerCase() === "c" && e.shiftKey)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const text = window.prompt("Add comment");
      if (!text || !text.trim()) return;
      createDocument("tabComments", {
        tab: activeTab,
        text: text.trim(),
        authorId: identity.id,
        authorName: identity.name,
        color: identity.color,
        x: cursorRef.current.x,
        y: cursorRef.current.y,
        createdAt: Date.now(),
      }).catch(() => {});
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTab, identity]);

  if (!firebaseReady) {
    return (
      <main className="page-shell">
        <section className="panel">
          <h1>Firebase config needed</h1>
          <p>Add the required <code>NEXT_PUBLIC_FIREBASE_*</code> values to <code>.env.local</code>.</p>
        </section>
      </main>
    );
  }

  function renderPage() {
    if (activeTab === "members") return <MembersPage />;
    if (activeTab === "projects") return <ProjectsPage />;
    if (activeTab === "meetingNotes") return <MeetingNotesPage />;
    if (activeTab === "resources") return <ResourcesPage />;
    if (DATA_TABS.includes(activeTab)) return <DataViewPage tabKey={activeTab} />;
    if (TBD_TABS.includes(activeTab)) return <TbdPage tabKey={activeTab} />;
    return null;
  }

  return (
    <>
      <main className="page-shell">
        <section className="page-content">
          {renderPage()}
        </section>

        <div className="cursor-layer" aria-hidden="true">
          {peerCursors.map((peer) => (
            <div
              key={peer.id}
              className="peer-cursor"
              style={{ left: Number(peer.cursorX) || 0, top: Number(peer.cursorY) || 0 }}
            >
              <span className="peer-cursor-arrow" style={{ color: peer.color || "#1971c2" }} />
              <span className="peer-cursor-label" style={{ backgroundColor: peer.color || "#1971c2" }}>{peer.name || "Viewer"}</span>
            </div>
          ))}
        </div>

        <div className="comment-layer" aria-hidden="true">
          {activeTabComments.map((comment) => (
            <div
              key={comment.id}
              className="tab-comment"
              style={{ left: Number(comment.x) || 0, top: Number(comment.y) || 0, borderColor: comment.color || "#bbb" }}
              title={comment.authorName || "Viewer"}
            >
              <span className="tab-comment-author" style={{ color: comment.color || "#666" }}>
                {comment.authorName || "Viewer"}
              </span>
              <span className="tab-comment-text">{comment.text}</span>
            </div>
          ))}
        </div>

        <form action="/api/auth/logout" method="post" className="logout-form">
          <button type="submit" className="logout-btn" title="Sign out and return to login">Sign out</button>
        </form>
      </main>
      <Navigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        viewers={viewers}
        commentCounts={commentCounts}
      />
    </>
  );
}
