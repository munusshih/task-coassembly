"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { firebaseReady } from "../firebase";
import { createDocument, deleteDocument, replaceDocument, subscribeCollection } from "../firestore";
import Navigation from "./components/Navigation";
import MembersPage from "./components/MembersPage";
import MemberDirectoryPage from "./components/MemberDirectoryPage";
import ProjectsPage from "./components/ProjectsPage";
import DataViewPage from "./components/DataViewPage";
import MeetingNotesPage from "./components/MeetingNotesPage";
import ResourcesPage from "./components/ResourcesPage";
import TbdPage from "./components/TbdPage";

const ACTIVE_TAB_KEY = "coassembly-active-tab-v1";
const VIEWER_IDENTITY_KEY_PREFIX = "coassembly-viewer-v3";
const DATA_TABS = ["meetingNotes"];
const TBD_TABS = ["finance"];

const PRESENCE_COLORS = [
  "#D81B60", "#1E88E5", "#43A047", "#F4511E", "#5E35B1", "#00897B", "#6D4C41", "#8E24AA",
];

function hashIdToColor(id) {
  const text = String(id || "viewer");
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length];
}

function buildLocalIdentity(username) {
  const viewerId = (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : "viewer-" + Math.random().toString(36).slice(2, 10);
  const displayName = username || "Viewer";
  const colorSeed = username || viewerId;
  return {
    id: viewerId,
    username: username || null,
    name: displayName,
    color: hashIdToColor(colorSeed),
  };
}

function toCursorCoord(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function lerp(from, to, factor) {
  return from + (to - from) * factor;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("members");
  const [sessionUser, setSessionUser] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [identity, setIdentity] = useState(null);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const [presenceRows, setPresenceRows] = useState([]);
  const [smoothedPeerCursors, setSmoothedPeerCursors] = useState([]);
  const [commentRows, setCommentRows] = useState([]);
  const cursorRef = useRef({ x: 120, y: 120 });
  const peerTargetsRef = useRef(new Map());
  const lastCursorActivityAtRef = useRef(Date.now());
  const isPageVisibleRef = useRef(true);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        if (!res.ok) return;
        const payload = await res.json();
        if (!cancelled && typeof payload?.username === "string") {
          setSessionUser(payload.username);
        }
      } catch {
        // Ignore and fall back to generic viewer name.
      } finally {
        if (!cancelled) setSessionReady(true);
      }
    }

    loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
    if (typeof window === "undefined") return;

    const userKey = sessionUser || "viewer";
    const key = `${VIEWER_IDENTITY_KEY_PREFIX}:${userKey}`;

    try {
      const existing = localStorage.getItem(key);
      if (existing) {
        const parsed = JSON.parse(existing);
        if (parsed && parsed.id && parsed.name && parsed.color) {
          setIdentity(parsed);
          return;
        }
      }
      const created = buildLocalIdentity(sessionUser);
      localStorage.setItem(key, JSON.stringify(created));
      setIdentity(created);
    } catch {
      setIdentity(buildLocalIdentity(sessionUser));
    }
  }, [sessionReady, sessionUser]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const storedTab = window.localStorage.getItem(ACTIVE_TAB_KEY);
      if (storedTab) setActiveTab(storedTab);
    } catch {
      // Ignore storage read failures.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(ACTIVE_TAB_KEY, activeTab);
    } catch {
      // Ignore storage write failures.
    }
  }, [activeTab]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    function handleVisibilityChange() {
      setIsPageVisible(document.visibilityState === "visible");
    }
    handleVisibilityChange();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    isPageVisibleRef.current = isPageVisible;
    if (!isPageVisible) {
      peerTargetsRef.current = new Map();
      setSmoothedPeerCursors([]);
    }
  }, [isPageVisible]);

  useEffect(() => {
    if (!firebaseReady || !isPageVisible) {
      setPresenceRows([]);
      return;
    }
    const unsub = subscribeCollection("presence", setPresenceRows);
    return () => unsub();
  }, [isPageVisible]);

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
    const MIN_WRITE_INTERVAL_MS = 80;
    const ACTIVE_HEARTBEAT_MS = 2200;
    const IDLE_HEARTBEAT_MS = 12000;
    const IDLE_AFTER_MS = 9000;
    let lastWriteAt = 0;
    let inFlight = false;
    let scheduledWriteTimer = null;
    let heartbeatTimer = null;
    let pending = false;
    let pendingForce = false;
    let lastSent = { x: null, y: null, tab: null };

    function markActivity() {
      lastCursorActivityAtRef.current = Date.now();
    }

    function isIdle() {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return true;
      return Date.now() - lastCursorActivityAtRef.current > IDLE_AFTER_MS;
    }

    async function writePresence(force = false) {
      if (stopped) return;
      if (inFlight) {
        pending = true;
        if (force) pendingForce = true;
        return;
      }

      const x = Math.round(toCursorCoord(cursorRef.current.x));
      const y = Math.round(toCursorCoord(cursorRef.current.y));
      const moved = x !== lastSent.x || y !== lastSent.y;
      const tabChanged = activeTab !== lastSent.tab;
      const idle = isIdle();
      const now = Date.now();
      const heartbeatDue = now - lastWriteAt >= (idle ? IDLE_HEARTBEAT_MS : ACTIVE_HEARTBEAT_MS);

      if (!force && !moved && !tabChanged && !heartbeatDue) return;
      if (!force && idle && !moved && !tabChanged) return;
      if (!force && now - lastWriteAt < MIN_WRITE_INTERVAL_MS) {
        pending = true;
        return;
      }

      inFlight = true;
      lastWriteAt = now;

      try {
        await replaceDocument("presence", identity.id, {
          name: identity.name,
          color: identity.color,
          tab: activeTab,
          cursorX: x,
          cursorY: y,
          lastSeen: Date.now(),
        });
        lastSent = { x, y, tab: activeTab };
      } catch {
        // Ignore transient network issues; next write retries.
      } finally {
        inFlight = false;
        if (pending && !stopped) {
          const nextForce = pendingForce;
          pending = false;
          pendingForce = false;
          if (scheduledWriteTimer) window.clearTimeout(scheduledWriteTimer);
          scheduledWriteTimer = window.setTimeout(() => {
            writePresence(nextForce);
          }, MIN_WRITE_INTERVAL_MS);
        }
      }
    }

    function scheduleHeartbeat() {
      if (heartbeatTimer) window.clearTimeout(heartbeatTimer);
      const delay = isIdle() ? IDLE_HEARTBEAT_MS : ACTIVE_HEARTBEAT_MS;
      heartbeatTimer = window.setTimeout(async () => {
        await writePresence(false);
        if (!stopped) scheduleHeartbeat();
      }, delay);
    }

    function onMove(e) {
      cursorRef.current = { x: e.clientX, y: e.clientY };
      markActivity();
      writePresence(false);
      scheduleHeartbeat();
    }

    function onInteraction() {
      markActivity();
      writePresence(false);
      scheduleHeartbeat();
    }

    function onKeyActivity(e) {
      if (e.repeat) return;
      const target = e.target;
      const isTypingTarget =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (isTypingTarget) return;
      onInteraction();
    }

    function onVisibilityChange() {
      if (typeof document === "undefined") return;
      if (document.visibilityState === "visible") {
        markActivity();
        writePresence(true);
      }
      scheduleHeartbeat();
    }

    markActivity();
    writePresence(true);
    scheduleHeartbeat();

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mousedown", onInteraction, { passive: true });
    window.addEventListener("keydown", onKeyActivity);
    window.addEventListener("scroll", onInteraction, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stopped = true;
      if (scheduledWriteTimer) window.clearTimeout(scheduledWriteTimer);
      if (heartbeatTimer) window.clearTimeout(heartbeatTimer);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onInteraction);
      window.removeEventListener("keydown", onKeyActivity);
      window.removeEventListener("scroll", onInteraction);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      deleteDocument("presence", identity.id).catch(() => {});
    };
  }, [activeTab, identity]);

  const peerCursors = useMemo(() => {
    if (!identity) return [];
    return viewers.filter((v) => v.id !== identity.id && v.tab === activeTab);
  }, [viewers, activeTab, identity]);

  useEffect(() => {
    const targets = new Map(
      peerCursors.map((peer) => [
        peer.id,
        {
          id: peer.id,
          x: toCursorCoord(peer.cursorX),
          y: toCursorCoord(peer.cursorY),
          name: peer.name || "Viewer",
          color: peer.color || "#1971c2",
        },
      ]),
    );
    peerTargetsRef.current = targets;

    setSmoothedPeerCursors((prev) => {
      const prevById = new Map(prev.map((item) => [item.id, item]));
      const next = [];

      for (const [id, target] of targets.entries()) {
        const existing = prevById.get(id);
        if (existing) {
          next.push({ ...existing, name: target.name, color: target.color });
        } else {
          next.push({ ...target });
        }
      }

      return next;
    });
  }, [peerCursors]);

  useEffect(() => {
    let frameId = null;
    let stopped = false;
    const alpha = 0.22;

    function tick() {
      if (stopped) return;
      if (!isPageVisibleRef.current) {
        frameId = window.requestAnimationFrame(tick);
        return;
      }
      const targets = peerTargetsRef.current;

      setSmoothedPeerCursors((prev) => {
        if (prev.length === 0 && targets.size === 0) return prev;
        const prevById = new Map(prev.map((item) => [item.id, item]));
        const next = [];
        let changed = prev.length !== targets.size;

        for (const [id, target] of targets.entries()) {
          const existing = prevById.get(id);
          if (!existing) {
            next.push({ ...target });
            changed = true;
            continue;
          }

          const lx = lerp(existing.x, target.x, alpha);
          const ly = lerp(existing.y, target.y, alpha);
          const x = Math.abs(target.x - lx) < 0.15 ? target.x : lx;
          const y = Math.abs(target.y - ly) < 0.15 ? target.y : ly;

          if (
            x !== existing.x ||
            y !== existing.y ||
            target.name !== existing.name ||
            target.color !== existing.color
          ) {
            changed = true;
          }

          next.push({
            id,
            x,
            y,
            name: target.name,
            color: target.color,
          });
        }

        return changed ? next : prev;
      });

      frameId = window.requestAnimationFrame(tick);
    }

    frameId = window.requestAnimationFrame(tick);
    return () => {
      stopped = true;
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, []);

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
    if (activeTab === "memberDirectory") return <MemberDirectoryPage />;
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
          {smoothedPeerCursors.map((peer) => (
            <div
              key={peer.id}
              className="peer-cursor"
              style={{ left: Number(peer.x) || 0, top: Number(peer.y) || 0 }}
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
