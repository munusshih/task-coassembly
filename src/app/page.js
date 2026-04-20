"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { firebaseReady } from "../firebase";
import { deleteDocument, replaceDocument, subscribeCollection } from "../firestore";
import Navigation from "./components/Navigation";
import MembersPage from "./components/MembersPage";
import ProjectsPage from "./components/ProjectsPage";
import DataViewPage from "./components/DataViewPage";
import TbdPage from "./components/TbdPage";

const DATA_TABS = ["meetingNotes"];
const TBD_TABS = ["finance", "resources"];

const PRESENCE_COLORS = [
  "#d9480f", "#2b8a3e", "#1971c2", "#7b2cbf", "#c2255c", "#f08c00", "#0b7285", "#5f3dc4",
];

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function buildLocalIdentity() {
  const id = (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : "viewer-" + Math.random().toString(36).slice(2, 10);
  return {
    id,
    name: "Viewer " + id.slice(0, 4).toUpperCase(),
    color: randomItem(PRESENCE_COLORS),
  };
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("members");
  const [identity, setIdentity] = useState(null);
  const [presenceRows, setPresenceRows] = useState([]);
  const cursorRef = useRef({ x: 120, y: 120 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = "coassembly-viewer";
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
              style={{ left: Number(peer.cursorX) || 0, top: Number(peer.cursorY) || 0, color: peer.color || "#1971c2" }}
            >
              <span className="peer-cursor-dot" />
              <span className="peer-cursor-tag">{peer.name || "Viewer"}</span>
            </div>
          ))}
        </div>
      </main>
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} viewers={viewers} />
    </>
  );
}
