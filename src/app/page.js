"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  onDisconnect,
  limitToLast,
  onValue,
  orderByChild,
  push,
  query,
  ref as rtdbRef,
  remove,
  serverTimestamp,
  set,
  update,
} from "firebase/database";
import { auth, firebaseReady, realtimeDb } from "../firebase";
import {
  subscribeCollection,
  updateDocument,
} from "../firestore";
import {
  findMemberForAuth,
  hasLimitedWorkspaceAccess,
  isMemberEnabled,
  isWorkerOwner,
  normalizeMemberRoleValue,
  normalizeEmailValue,
} from "../authAccess";
import Navigation from "./components/Navigation";
import MembersPage from "./components/MembersPage";
import MemberDirectoryPage from "./components/MemberDirectoryPage";
import ProjectsPage from "./components/ProjectsPage";
import FinancePage from "./components/FinancePage";
import DataViewPage from "./components/DataViewPage";
import MeetingNotesPage from "./components/MeetingNotesPage";
import ResourcesPage from "./components/ResourcesPage";
import BacklogPage from "./components/BacklogPage";
import TbdPage from "./components/TbdPage";

const ACTIVE_TAB_KEY = "coassembly-active-tab-v1";
const STYLE_TOOL_KEY = "coassembly-style-tool-v1";
const VIEWER_IDENTITY_KEY_PREFIX = "coassembly-viewer-v3";
const DATA_TABS = ["meetingNotes"];
const TBD_TABS = [];

const TAB_ORDER = [
  "members",
  "memberDirectory",
  "projects",
  "backlog",
  "finance",
  "meetingNotes",
  "resources",
];

const FONT_OPTIONS = [
  {
    value: "sentient",
    label: "Sentient (Editorial)",
  },
  {
    value: "sans",
    label: "Avenir (Clean)",
  },
  {
    value: "sponact",
    label: "Sponact (All)",
  },
];

const SHAPE_OPTIONS = [
  { value: "soft", label: "Soft corners" },
  { value: "square", label: "Sharp corners" },
  { value: "round", label: "Round corners" },
];

const PATTERN_OPTIONS = [
  { value: "paper", label: "Paper", glyph: "::", bgColor: "#f3efe6" },
  { value: "linen", label: "Linen", glyph: "##", bgColor: "#e3efe4" },
  { value: "blueprint", label: "Blueprint", glyph: "+ +", bgColor: "#d7e6ff" },
  { value: "confetti", label: "Confetti", glyph: "..", bgColor: "#fcfdff" },
  { value: "kraft", label: "Kraft", glyph: "//", bgColor: "#dfc18f" },
];

const PRESENCE_COLORS = [
  "#D81B60",
  "#1E88E5",
  "#43A047",
  "#F4511E",
  "#5E35B1",
  "#00897B",
  "#6D4C41",
  "#8E24AA",
];

const DEFAULT_STYLE_PREFS = {
  bg: "paper",
  font: "sentient",
  radius: "soft",
  bgColor: "#f2ebe2",
  grain: 0.95,
  wash: 0.1,
};

function hashIdToColor(id) {
  const text = String(id || "viewer");
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length];
}

function buildLocalIdentity(username) {
  const viewerId =
    typeof crypto !== "undefined" && crypto.randomUUID
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

function normalizePresenceRows(snapshotValue) {
  if (!snapshotValue || typeof snapshotValue !== "object") return [];
  return Object.entries(snapshotValue).map(([id, row]) => ({
    id,
    data: row || {},
  }));
}

function normalizeRealtimeRows(snapshotValue) {
  if (!snapshotValue || typeof snapshotValue !== "object") return [];
  return Object.entries(snapshotValue).map(([id, row]) => ({
    id,
    data: row || {},
  }));
}

function isPermissionDeniedError(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("permission_denied") || message.includes("permission denied");
}

function loadStylePrefsFromStorage() {
  if (typeof window === "undefined") return DEFAULT_STYLE_PREFS;

  try {
    const raw = window.localStorage.getItem(STYLE_TOOL_KEY);
    if (!raw) return DEFAULT_STYLE_PREFS;
    const parsed = JSON.parse(raw);
    return {
      bg: ["paper", "linen", "blueprint", "confetti", "kraft"].includes(
        parsed?.bg,
      )
        ? parsed.bg
        : "paper",
      font: ["sentient", "sans", "sponact"].includes(parsed?.font)
        ? parsed.font
        : "sentient",
      radius: ["soft", "square", "round"].includes(parsed?.radius)
        ? parsed.radius
        : "soft",
      bgColor:
        typeof parsed?.bgColor === "string" &&
        /^#[0-9a-fA-F]{6}$/.test(parsed.bgColor)
          ? parsed.bgColor
          : "#f2ebe2",
      grain: Number.isFinite(Number(parsed?.grain))
        ? Math.min(1, Math.max(0, Number(parsed.grain)))
        : 0.7,
      wash: Number.isFinite(Number(parsed?.wash))
        ? Math.min(1, Math.max(0, Number(parsed.wash)))
        : 0.18,
    };
  } catch {
    return DEFAULT_STYLE_PREFS;
  }
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("members");
  const [slideDir, setSlideDir] = useState("right");
  const [authReady, setAuthReady] = useState(false);
  const [currentMember, setCurrentMember] = useState(null);
  const [identity, setIdentity] = useState(null);
  const [sharedMembers, setSharedMembers] = useState([]);
  const [sharedProjects, setSharedProjects] = useState([]);
  const [sharedTasks, setSharedTasks] = useState([]);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const [presenceRows, setPresenceRows] = useState([]);
  const [commentRows, setCommentRows] = useState([]);
  const [stylePrefs, setStylePrefs] = useState(DEFAULT_STYLE_PREFS);
  const [stylePrefsLoaded, setStylePrefsLoaded] = useState(false);
  const [toolboxOpen, setToolboxOpen] = useState(false);
  const cursorRef = useRef({ x: 120, y: 120 });
  const lastCursorWriteAtRef = useRef(0);
  const lastCursorPointRef = useRef({ x: 0, y: 0 });
  const presenceWriteAllowedRef = useRef(true);

  useEffect(() => {
    if (!firebaseReady || !auth) {
      setAuthReady(true);
      return undefined;
    }

    let cancelled = false;

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (cancelled) return;

      if (!user) {
        setCurrentMember(null);
        setAuthReady(true);
        if (typeof window !== "undefined") {
          window.location.assign("/login");
        }
        return;
      }

      try {
        const member = await findMemberForAuth({ uid: user.uid, email: user.email });
        if (!member || !isMemberEnabled(member.data)) {
          await signOut(auth);
          if (!cancelled && typeof window !== "undefined") {
            window.location.assign("/login?error=not-authorized");
          }
          return;
        }

        const normalizedGoogleEmail = normalizeEmailValue(user.email);
        const normalizedMemberEmail = normalizeEmailValue(member?.data?.email);
        const shouldPatchMember =
          member.data.authUid !== user.uid ||
          normalizedMemberEmail !== normalizedGoogleEmail;

        if (shouldPatchMember) {
          await updateDocument("members", member.id, {
            authUid: user.uid,
            email: normalizedGoogleEmail,
            emailLower: normalizedGoogleEmail,
            updatedAt: Date.now(),
          });
        }

        if (!cancelled) {
          setCurrentMember({
            id: member.id,
            ...member.data,
            authUid: user.uid,
            email: normalizedGoogleEmail,
            emailLower: normalizedGoogleEmail,
          });
          setAuthReady(true);
        }
      } catch {
        if (!cancelled) {
          setCurrentMember(null);
          setAuthReady(true);
          if (typeof window !== "undefined") {
            window.location.assign("/login?error=not-authorized");
          }
        }
      }
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const isAdmin = useMemo(() => isWorkerOwner(currentMember), [currentMember]);
  const hasLimitedAccess = useMemo(
    () => hasLimitedWorkspaceAccess(currentMember),
    [currentMember],
  );
  const allowedTabs = useMemo(() => {
    if (hasLimitedAccess) {
      return ["members", "projects"];
    }
    return TAB_ORDER;
  }, [hasLimitedAccess]);

  useEffect(() => {
    if (!firebaseReady || !authReady || !currentMember) {
      setSharedMembers([]);
      setSharedProjects([]);
      setSharedTasks([]);
      return;
    }

    const unsubMembers = subscribeCollection("members", setSharedMembers);
    const unsubProjects = subscribeCollection("projects", setSharedProjects);
    const unsubTasks = subscribeCollection("tasks", setSharedTasks);

    return () => {
      unsubMembers();
      unsubProjects();
      unsubTasks();
    };
  }, [authReady, currentMember]);

  useEffect(() => {
    if (!authReady) return;
    if (!currentMember) return;
    if (typeof window === "undefined") return;

    const userKey =
      normalizeEmailValue(currentMember.email) ||
      String(currentMember.name || "viewer");
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
      const created = buildLocalIdentity(currentMember.name || currentMember.email);
      localStorage.setItem(key, JSON.stringify(created));
      setIdentity(created);
    } catch {
      setIdentity(buildLocalIdentity(currentMember.name || currentMember.email));
    }
  }, [authReady, currentMember]);

  useEffect(() => {
    if (isAdmin) return;
    if (activeTab === "memberDirectory") {
      setActiveTab("members");
    }
  }, [activeTab, isAdmin]);

  useEffect(() => {
    if (allowedTabs.includes(activeTab)) return;
    setActiveTab("members");
  }, [activeTab, allowedTabs]);

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
    const loaded = loadStylePrefsFromStorage();
    setStylePrefs(loaded);
    setStylePrefsLoaded(true);
  }, []);

  useEffect(() => {
    if (!stylePrefsLoaded) return;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STYLE_TOOL_KEY, JSON.stringify(stylePrefs));
    } catch {
      // Ignore storage write failures.
    }
  }, [stylePrefs, stylePrefsLoaded]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    function handleVisibilityChange() {
      setIsPageVisible(document.visibilityState === "visible");
    }
    handleVisibilityChange();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (!firebaseReady || !realtimeDb || !authReady || !currentMember) {
      setPresenceRows([]);
      return;
    }

    const presenceRef = rtdbRef(realtimeDb, "presence");
    const unsub = onValue(presenceRef, (snapshot) => {
      setPresenceRows(normalizePresenceRows(snapshot.val()));
    });

    return () => unsub();
  }, [authReady, currentMember]);

  useEffect(() => {
    if (!firebaseReady || !realtimeDb || !isPageVisible) {
      setCommentRows([]);
      return;
    }

    const commentsRef = query(
      rtdbRef(realtimeDb, "tabComments"),
      orderByChild("createdAt"),
      limitToLast(300),
    );
    const unsub = onValue(commentsRef, (snapshot) => {
      setCommentRows(normalizeRealtimeRows(snapshot.val()));
    });

    return () => unsub();
  }, [isPageVisible]);

  const viewers = useMemo(() => {
    return presenceRows
      .map((row) => ({ id: row.id, ...row.data }))
      .sort((a, b) => Number(b.lastSeen || 0) - Number(a.lastSeen || 0));
  }, [presenceRows]);

  useEffect(() => {
    if (!firebaseReady || !realtimeDb || !identity) return;
    const authUid = String(auth?.currentUser?.uid || currentMember?.authUid || "").trim();
    if (!authUid) return;
    presenceWriteAllowedRef.current = true;
    let stopped = false;

    const selfPresenceRef = rtdbRef(realtimeDb, `presence/${authUid}`);

    async function writePresence(activeFlag) {
      if (stopped) return;
      if (!presenceWriteAllowedRef.current) return;
      const payload = {
        viewerId: identity.id,
        name: identity.name,
        color: identity.color,
        tab: activeTab,
        active: Boolean(activeFlag),
        x: Math.round(cursorRef.current.x),
        y: Math.round(cursorRef.current.y),
        lastSeen: serverTimestamp(),
      };

      try {
        await set(selfPresenceRef, payload);
      } catch (error) {
        if (isPermissionDeniedError(error)) {
          presenceWriteAllowedRef.current = false;
          return;
        }
        // Ignore transient network issues; next visibility/tab change retries.
      }
    }

    function onVisibilityChange() {
      if (typeof document === "undefined") return;
      writePresence(document.visibilityState === "visible");
    }

    onDisconnect(selfPresenceRef)
      .remove()
      .catch(() => {});

    writePresence(true);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      remove(selfPresenceRef).catch(() => {});
    };
  }, [activeTab, currentMember?.authUid, identity]);

  useEffect(() => {
    if (!firebaseReady || !realtimeDb || !identity) return;
    const authUid = String(auth?.currentUser?.uid || currentMember?.authUid || "").trim();
    if (!authUid) return;
    const selfPresenceRef = rtdbRef(realtimeDb, `presence/${authUid}`);

    async function pushCursorUpdate(nextX, nextY) {
      if (!presenceWriteAllowedRef.current) return;
      const now = Date.now();
      const previous = lastCursorPointRef.current;
      const movedEnough =
        Math.abs(nextX - previous.x) >= 6 || Math.abs(nextY - previous.y) >= 6;
      if (!movedEnough) return;
      if (now - lastCursorWriteAtRef.current < 160) return;

      lastCursorWriteAtRef.current = now;
      lastCursorPointRef.current = { x: nextX, y: nextY };

      try {
        await update(selfPresenceRef, {
          x: Math.round(nextX),
          y: Math.round(nextY),
          tab: activeTab,
          active: typeof document === "undefined" ? true : document.visibilityState === "visible",
          lastSeen: serverTimestamp(),
        });
      } catch (error) {
        if (isPermissionDeniedError(error)) {
          presenceWriteAllowedRef.current = false;
          return;
        }
        // Ignore transient cursor update failures.
      }
    }

    function onMouseMove(e) {
      cursorRef.current = { x: e.clientX, y: e.clientY };
      pushCursorUpdate(e.clientX, e.clientY);
    }

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, [activeTab, currentMember?.authUid, identity]);

  const peerCursors = useMemo(() => {
    return presenceRows
      .map((row) => ({ id: row.id, ...row.data }))
      .filter((peer) => Boolean(peer.active))
      .filter(
        (peer) =>
          peer.id !== (auth?.currentUser?.uid || currentMember?.authUid) &&
          peer.viewerId !== identity?.id,
      )
      .filter((peer) => (peer.tab || "members") === activeTab)
      .map((peer) => ({
        ...peer,
        x: toCursorCoord(peer.x),
        y: toCursorCoord(peer.y),
      }));
  }, [activeTab, currentMember?.authUid, identity, presenceRows]);

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

  const selectedPattern = useMemo(
    () =>
      PATTERN_OPTIONS.find((option) => option.value === stylePrefs.bg) ||
      PATTERN_OPTIONS[0],
    [stylePrefs.bg],
  );

  useEffect(() => {
    if (!firebaseReady || !realtimeDb || !identity) return;

    function onKeyDown(e) {
      const t = e.target;
      const isTypingTarget =
        t instanceof HTMLElement &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable);
      if (isTypingTarget) return;
      if (!(e.key.toLowerCase() === "c" && e.shiftKey)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const text = window.prompt("Add comment");
      if (!text || !text.trim()) return;
      const rowRef = push(rtdbRef(realtimeDb, "tabComments"));
      set(rowRef, {
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
      <main className="page-shell page-shell--single">
        <section className="panel">
          <h1>Firebase config needed</h1>
          <p>
            Add the required <code>NEXT_PUBLIC_FIREBASE_*</code> values to{" "}
            <code>.env.local</code>.
          </p>
        </section>
      </main>
    );
  }

  if (!authReady) {
    return (
      <main className="page-shell page-shell--single">
        <section className="panel">
          <h1>Checking access</h1>
          <p>Verifying your account permissions.</p>
        </section>
      </main>
    );
  }

  if (!currentMember) {
    return (
      <main className="page-shell page-shell--single">
        <section className="panel">
          <h1>Access required</h1>
          <p>Use your approved Google account to sign in.</p>
        </section>
      </main>
    );
  }

  function renderPage() {
    if (!allowedTabs.includes(activeTab)) {
      return null;
    }
    if (activeTab === "members") {
      return (
        <MembersPage
          viewerMemberId={currentMember.id}
          viewerRole={normalizeMemberRoleValue(currentMember.role)}
          sharedMembers={sharedMembers}
          sharedProjects={sharedProjects}
          sharedTasks={sharedTasks}
        />
      );
    }
    if (activeTab === "memberDirectory") {
      if (!isAdmin) {
        return (
          <section className="panel">
            <h2>Admin only</h2>
            <p>Only worker-owners can manage members and roles.</p>
          </section>
        );
      }
      return <MemberDirectoryPage />;
    }
    if (activeTab === "projects") {
      return (
        <ProjectsPage
          viewerMemberId={currentMember.id}
          viewerRole={normalizeMemberRoleValue(currentMember.role)}
          sharedMembers={sharedMembers}
          sharedProjects={sharedProjects}
          sharedTasks={sharedTasks}
        />
      );
    }
    if (activeTab === "backlog") {
      return <BacklogPage viewerName={currentMember.name || ""} />;
    }
    if (activeTab === "finance") {
      return <FinancePage />;
    }
    if (activeTab === "meetingNotes") {
      return <MeetingNotesPage viewerName={currentMember.name || ""} />;
    }
    if (activeTab === "resources") return <ResourcesPage />;
    if (DATA_TABS.includes(activeTab))
      return <DataViewPage tabKey={activeTab} />;
    if (TBD_TABS.includes(activeTab)) return <TbdPage tabKey={activeTab} />;
    return null;
  }

  function handleTabChange(newTab) {
    const oldIdx = TAB_ORDER.indexOf(activeTab);
    const newIdx = TAB_ORDER.indexOf(newTab);
    setSlideDir(newIdx >= oldIdx ? "left" : "right");
    setActiveTab(newTab);
  }

  return (
    <main
      className={`page-shell style-bg-${stylePrefs.bg} style-font-${stylePrefs.font} style-radius-${stylePrefs.radius}`}
      style={{
        "--playground-bg": stylePrefs.bgColor,
        "--playground-grain": String(stylePrefs.grain),
        "--playground-wash": String(stylePrefs.wash),
      }}
    >
      <Navigation
        activeTab={activeTab}
        onTabChange={handleTabChange}
        viewers={viewers}
        commentCounts={commentCounts}
        isAdmin={isAdmin}
        allowedTabs={allowedTabs}
      />
      <div className="page-main">
        <section className="page-content" key={activeTab} data-dir={slideDir}>
          {renderPage()}
        </section>

        <div className="cursor-layer" aria-hidden="true">
          {peerCursors.map((peer) => (
            <div
              key={peer.id}
              className="peer-cursor"
              style={{ left: `${peer.x}px`, top: `${peer.y}px` }}
            >
              <span className="peer-cursor-arrow" />
              <span
                className="peer-cursor-label"
                style={{ background: peer.color || "#666" }}
              >
                {peer.name || "Viewer"}
              </span>
            </div>
          ))}
        </div>

        <div className="comment-layer" aria-hidden="true">
          {activeTabComments.map((comment) => (
            <div
              key={comment.id}
              className="tab-comment"
              style={{
                left: Number(comment.x) || 0,
                top: Number(comment.y) || 0,
                borderColor: comment.color || "#bbb",
              }}
              title={comment.authorName || "Viewer"}
            >
              <span
                className="tab-comment-author"
                style={{ color: comment.color || "#666" }}
              >
                {comment.authorName || "Viewer"}
              </span>
              <span className="tab-comment-text">{comment.text}</span>
            </div>
          ))}
        </div>

        <div
          className={`style-toolbox${toolboxOpen ? " style-toolbox--open" : ""}`}
          role="region"
          aria-label="Style toolbox"
        >
          <button
            type="button"
            className="style-toolbox-trigger"
            onClick={() => setToolboxOpen((prev) => !prev)}
            aria-expanded={toolboxOpen}
            aria-controls="playground-panel"
            title="Open theme controls"
          >
            <span
              className={`style-toolbox-trigger-icon style-toolbox-trigger-icon--${selectedPattern.value}`}
              aria-hidden="true"
            >
              {selectedPattern.glyph}
            </span>
            <span className="style-toolbox-trigger-text">Themes</span>
          </button>

          {toolboxOpen ? (
            <div className="style-toolbox-panel" id="playground-panel">
              <div className="style-toolbox-head">
                <div>
                  <div className="style-toolbox-title">Theme controls</div>
                  <div className="style-toolbox-subtitle">
                    Choose pattern, type, and shape
                  </div>
                </div>
                <button
                  type="button"
                  className="style-toolbox-close"
                  onClick={() => setToolboxOpen(false)}
                  aria-label="Close playground"
                >
                  x
                </button>
              </div>

              <div className="style-toolbox-group">
                <div className="style-toolbox-label">Pattern</div>
                <div className="style-swatch-grid">
                  {PATTERN_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`style-swatch${stylePrefs.bg === option.value ? " style-swatch--active" : ""}`}
                      onClick={() =>
                        setStylePrefs((prev) => ({
                          ...prev,
                          bg: option.value,
                          bgColor: option.bgColor,
                        }))
                      }
                      title={option.label}
                      aria-pressed={stylePrefs.bg === option.value}
                    >
                      <span
                        className={`style-swatch-preview style-swatch-preview--${option.value}`}
                      />
                      <span className="style-swatch-glyph">{option.glyph}</span>
                      <span className="style-swatch-label">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="style-toolbox-group">
                <div className="style-toolbox-label">Type</div>
                <div className="style-chip-row">
                  {FONT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`style-chip-btn${stylePrefs.font === option.value ? " style-chip-btn--active" : ""}`}
                      onClick={() =>
                        setStylePrefs((prev) => ({
                          ...prev,
                          font: option.value,
                        }))
                      }
                      title={option.label}
                      aria-pressed={stylePrefs.font === option.value}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="style-toolbox-group">
                <div className="style-toolbox-label">Shape</div>
                <div className="style-chip-row">
                  {SHAPE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`style-chip-btn${stylePrefs.radius === option.value ? " style-chip-btn--active" : ""}`}
                      onClick={() =>
                        setStylePrefs((prev) => ({
                          ...prev,
                          radius: option.value,
                        }))
                      }
                      title={option.label}
                      aria-pressed={stylePrefs.radius === option.value}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
