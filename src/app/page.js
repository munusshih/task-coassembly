"use client";
import { WorkspaceIdentityContext } from "./components/WorkspaceIdentity";

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
import { subscribeCollection, updateDocument } from "../firestore";
import {
  findMemberForAuth,
  hasLimitedWorkspaceAccess,
  isMemberEnabled,
  isWorkerOwner,
  normalizeMemberRoleValue,
  normalizeEmailValue,
} from "../authAccess";
import { SERIES_COLORS, WORKSPACE_THEME } from "./components/ui/palette";
import useUrlState, { updateUrlState } from "./hooks/useUrlState";
import Navigation from "./components/Navigation";
import TimeTrackingProvider from "./components/time/TimeTrackingProvider";
import MembersPage from "./components/MembersPage";
import MemberDirectoryPage from "./components/MemberDirectoryPage";
import ProjectsPage from "./components/ProjectsPage";
import LockedPage from "./components/LockedPage";
import FinancePage from "./components/FinancePage";
import DataViewPage from "./components/DataViewPage";
import MeetingNotesPage from "./components/MeetingNotesPage";
import PayoutsPage from "./components/PayoutsPage";
import ResourcesPage from "./components/ResourcesPage";
import BacklogPage from "./components/BacklogPage";
import TbdPage from "./components/TbdPage";

const VIEWER_IDENTITY_KEY_PREFIX = "coassembly-viewer-v3";
const DATA_TABS = ["meetingNotes"];
const TBD_TABS = ["homepage", "settings"];

const LOCAL_ROLE_PREVIEW_OPTIONS = [
  { value: "worker-owner", label: "Worker-owner" },
  { value: "associate", label: "Associate" },
  { value: "flying-member", label: "Flying member" },
  { value: "external-collaborator", label: "External collaborator" },
];

const TAB_ORDER = [
  "homepage",
  "settings",
  "members",
  "memberDirectory",
  "projects",
  "backlog",
  "finance",
  "payouts",
  "meetingNotes",
  "resources",
];

const PRESENCE_COLORS = [SERIES_COLORS[0], SERIES_COLORS[1], SERIES_COLORS[3], SERIES_COLORS[6]];

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
  return (
    message.includes("permission_denied") ||
    message.includes("permission denied")
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useUrlState("tab", "members", { allowed: TAB_ORDER });
  const [authReady, setAuthReady] = useState(false);
  const [currentMember, setCurrentMember] = useState(null);
  const [identity, setIdentity] = useState(null);
  const [sharedMembers, setSharedMembers] = useState([]);
  const [sharedProjects, setSharedProjects] = useState([]);
  const [sharedTasks, setSharedTasks] = useState([]);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const [presenceRows, setPresenceRows] = useState([]);
  const [commentRows, setCommentRows] = useState([]);
  const [previewRole, setPreviewRole] = useState(null);
  const rolePreviewRef = useRef(null);
  useEffect(() => {
    function closeRolePreview(event) {
      if (rolePreviewRef.current && !rolePreviewRef.current.contains(event.target)) {
        rolePreviewRef.current.open = false;
      }
    }
    document.addEventListener("pointerdown", closeRolePreview);
    return () => document.removeEventListener("pointerdown", closeRolePreview);
  }, []);
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
          window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        }
        return;
      }

      try {
        const member = await findMemberForAuth({
          uid: user.uid,
          email: user.email,
        });
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
            ...member.data,
            id: member.id,
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

  const actualRole = normalizeMemberRoleValue(currentMember?.role);
  const canPreviewRoles =
    process.env.NODE_ENV === "development" && isWorkerOwner(currentMember);
  const effectiveRole =
    canPreviewRoles && previewRole ? previewRole : actualRole;
  const effectiveMember = useMemo(
    () =>
      currentMember
        ? {
            ...currentMember,
            role: effectiveRole,
          }
        : null,
    [currentMember, effectiveRole],
  );
  const isAdmin = useMemo(
    () => isWorkerOwner(effectiveMember),
    [effectiveMember],
  );
  const hasLimitedAccess = useMemo(
    () => hasLimitedWorkspaceAccess(effectiveMember),
    [effectiveMember],
  );
  const allowedTabs = useMemo(() => {
    if (hasLimitedAccess) {
      return ["homepage", "settings", "members", "projects", "payouts"];
    }
    return TAB_ORDER;
  }, [hasLimitedAccess]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (typeof window === "undefined") return;
    if (!["localhost", "127.0.0.1", "::1"].includes(window.location.hostname))
      return;

    const rawRole = new URLSearchParams(window.location.search)
      .get("role")
      ?.trim()
      .replace(/^["']|["']$/g, "");
    const normalizedRole = rawRole
      ? normalizeMemberRoleValue(rawRole)
      : null;
    const isKnownRole = LOCAL_ROLE_PREVIEW_OPTIONS.some(
      (option) => option.value === normalizedRole,
    );
    setPreviewRole(isKnownRole ? normalizedRole : null);
  }, []);

  function handlePreviewRoleChange(nextRole) {
    if (!canPreviewRoles || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (nextRole) {
      url.searchParams.set("role", nextRole);
      setPreviewRole(nextRole);
    } else {
      url.searchParams.delete("role");
      setPreviewRole(null);
    }
    window.history.replaceState({}, "", url);
  }

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
      const created = buildLocalIdentity(
        currentMember.name || currentMember.email,
      );
      localStorage.setItem(key, JSON.stringify(created));
      setIdentity(created);
    } catch {
      setIdentity(
        buildLocalIdentity(currentMember.name || currentMember.email),
      );
    }
  }, [authReady, currentMember]);

  useEffect(() => {
    if (!authReady || !currentMember) return;
    if (!allowedTabs.includes(activeTab) || (activeTab === "memberDirectory" && !isAdmin)) {
      updateUrlState({ tab: "members" }, { replace: true });
    }
  }, [authReady, currentMember, activeTab, allowedTabs, isAdmin, setActiveTab]);

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
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return presenceRows
      .map((row) => ({ id: row.id, ...row.data }))
      .filter((v) => v.active !== false && Number(v.lastSeen || 0) > fiveMinutesAgo)
      .sort((a, b) => Number(b.lastSeen || 0) - Number(a.lastSeen || 0));
  }, [presenceRows]);

  useEffect(() => {
    if (!firebaseReady || !realtimeDb || !identity) return;
    // Must have a confirmed Firebase auth UID — currentMember.authUid is set
    // from onAuthStateChanged so it's reliable; auth.currentUser.uid is the live value.
    const authUid = String(
      auth?.currentUser?.uid || currentMember?.authUid || "",
    ).trim();
    if (!authUid) return;
    // Always reset the latch when the effect re-runs with a valid authUid,
    // so a previous permission-denied error doesn't permanently block presence.
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
          // Don't latch permanently — the rule requires auth.uid === $uid,
          // which should always hold here. Log for debugging.
          console.warn("[presence] permission denied writing to", selfPresenceRef.toString(), error?.message);
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
    const authUid = String(
      auth?.currentUser?.uid || currentMember?.authUid || "",
    ).trim();
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
          active:
            typeof document === "undefined"
              ? true
              : document.visibilityState === "visible",
          lastSeen: serverTimestamp(),
        });
      } catch {
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
      <main className="page-shell page-shell--single splash-screen">
        <div className="splash-card">
          <div className="splash-brand">Protocol</div>
          <div className="splash-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className="splash-label">Checking access…</p>
        </div>
      </main>
    );
  }

  if (!currentMember) {
    return (
      <main className="page-shell page-shell--single splash-screen">
        <div className="splash-card">
          <div className="splash-brand">Protocol</div>
          <p className="splash-label">
            Sign in with your approved Google account to continue.
          </p>
        </div>
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
          viewerRole={effectiveRole}
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
          viewerRole={effectiveRole}
          sharedMembers={sharedMembers}
          sharedProjects={sharedProjects}
          sharedTasks={sharedTasks}
        />
      );
    }
    if (activeTab === "backlog") {
      return <BacklogPage viewerName={currentMember.name || ""} />;
    }
    if (activeTab === "finance" || activeTab === "payouts") {
      return <LockedPage title={activeTab === "finance" ? "Finance" : "Requests"} />;
    }
    if (activeTab === "meetingNotes") {
      return <MeetingNotesPage viewerName={currentMember.name || ""} />;
    }
    if (activeTab === "resources") return <ResourcesPage currentMember={currentMember} members={sharedMembers || []} />;
    if (DATA_TABS.includes(activeTab))
      return <DataViewPage tabKey={activeTab} />;
    if (TBD_TABS.includes(activeTab)) return <TbdPage tabKey={activeTab} />;
    return null;
  }

  function handleTabChange(newTab) {
    setActiveTab(newTab);
  }

  return (
    <WorkspaceIdentityContext.Provider value={currentMember}><TimeTrackingProvider key={currentMember.id} memberId={currentMember.id} active={activeTab === "members"}>
    <main style={WORKSPACE_THEME} className={`page-shell page-shell--workspace${activeTab === "members" ? " page-shell--task" : ""}`}>
      <Navigation
        activeTab={activeTab}
        onTabChange={handleTabChange}
        viewers={viewers}
        commentCounts={commentCounts}
        isAdmin={isAdmin}
        allowedTabs={allowedTabs}
      />
      <div className="page-main">
        {canPreviewRoles ? (
          <details className={`role-preview-float${previewRole ? " role-preview-float--active" : ""}`} ref={rolePreviewRef} onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.currentTarget.open = false;
              event.currentTarget.querySelector("summary")?.focus();
            }
          }}>
            <summary aria-label="Toggle local role preview">Role preview{previewRole ? <span className="role-preview-active-dot" aria-label="Preview active" /> : null}</summary>
            <div className="role-preview-bar">
            <label className="role-preview-label" htmlFor="local-role-preview">Local role preview</label>
            <select
              className="role-preview-select"
              id="local-role-preview"
              value={previewRole || ""}
              onChange={(event) =>
                handlePreviewRoleChange(event.target.value)
              }
              aria-label="Preview dashboard as role"
            >
              <option value="">Actual role ({actualRole})</option>
              {LOCAL_ROLE_PREVIEW_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {previewRole ? (
              <span className="role-preview-note">
                UI only · signed in as {currentMember.name || currentMember.email}
              </span>
            ) : null}
            </div>
          </details>
        ) : null}
        <section className="page-content" key={activeTab}>
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
                style={{ background: hashIdToColor(peer.id) }}
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
                borderColor: hashIdToColor(comment.authorId),
              }}
              title={comment.authorName || "Viewer"}
            >
              <span
                className="tab-comment-author"
                style={{ color: hashIdToColor(comment.authorId) }}
              >
                {comment.authorName || "Viewer"}
              </span>
              <span className="tab-comment-text">{comment.text}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
    </TimeTrackingProvider></WorkspaceIdentityContext.Provider>
  );
}
