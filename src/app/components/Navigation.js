"use client";

import { useEffect, useRef, useState } from "react";
import TaskWeekInfo from "./TaskWeekInfo";
import { createPortal } from "react-dom";
import WorkspaceIllustration from "./ui/WorkspaceIllustration";
import LockIcon from "./ui/LockIcon";
import CloseButton from "./ui/CloseButton";
import { viewHref } from "../lib/viewUrl.mjs";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase";

const TABS = [
  { key: "members", label: "Task" },
  { key: "memberDirectory", label: "Members" },
  { key: "projects", label: "Projects" },
  { key: "backlog", label: "Wishes" },
  { key: "finance", label: "Finance" },
  { key: "payouts", label: "Requests" },
  { key: "meetingNotes", label: "Notes" },
  { key: "resources", label: "Resource" },
];

export default function Navigation({
  activeTab,
  onTabChange,
  viewers = [],
  commentCounts = {},
  isAdmin = false,
  allowedTabs = [],
}) {
  const [portalReady,setPortalReady] = useState(false);
  useEffect(()=>setPortalReady(true),[]);
  const navigationRef = useRef(null);
  const overlayRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuClosing, setMenuClosing] = useState(false);
  const closeTimerRef = useRef(null);
  useEffect(() => () => window.clearTimeout(closeTimerRef.current), []);
  function closeNavigation() {
    if (menuClosing) return;
    setMenuClosing(true);
    closeTimerRef.current = window.setTimeout(() => { setMenuOpen(false); setMenuClosing(false); }, 180);
  }

  useEffect(() => {
    if (!menuOpen) {
      overlayRef.current?.close();
      return;
    }
    overlayRef.current?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [menuOpen]);

  async function handleSignOut() {
    try {
      if (auth) {
        await signOut(auth);
      }
    } finally {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
      if (typeof window !== "undefined") {
        window.location.assign("/login");
      }
    }
  }

  const allowed =
    Array.isArray(allowedTabs) && allowedTabs.length
      ? new Set(allowedTabs)
      : null;

  function navigate(event, tab) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setMenuOpen(false);
    onTabChange(tab);
  }

  return (
    <header className="task-navigation">
      {activeTab !== "members" && <div className="task-week-toolbar"><TaskWeekInfo pageKey={activeTab} /></div>}
      <button type="button" className="task-menu-trigger" aria-label="Open workspace navigation" aria-haspopup="dialog" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><span /><span /><span /></button>
      {portalReady && createPortal(<dialog ref={overlayRef} className={`task-navigation-overlay${menuClosing ? " task-navigation-overlay--closing" : ""}`} aria-label="Workspace navigation" onCancel={(event) => { event.preventDefault(); closeNavigation(); }} onClose={() => setMenuOpen(false)} onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX > bounds.right || event.clientX < bounds.left) closeNavigation();
      }}>
        <CloseButton className="task-menu-close" label="Close workspace navigation" onClick={closeNavigation} autoFocus />
        <nav ref={navigationRef} className="task-overlay-links" aria-label="Workspace pages">
          {TABS.filter((tab) => tab.key !== "payouts" && (isAdmin || tab.key !== "memberDirectory") && (!allowed || allowed.has(tab.key))).map((tab) => (
            <div className="task-navigation-group" key={tab.key}>
              <a href={viewHref(tab.key)} aria-current={tab.key === activeTab ? "page" : undefined} onClick={(event) => navigate(event, tab.key)}><span>{tab.label}</span>{tab.key === "finance" && <LockIcon />}<WorkspaceIllustration className="navigation-mini-icon" name={({members:"task-maker",memberDirectory:"member-team",projects:"projects-team",backlog:"wishes-catcher",finance:"clock",meetingNotes:"book-carrier",resources:"resource-balancer"})[tab.key]} /></a>
              {tab.key === "finance" && (!allowed || allowed.has("payouts")) && <a className="task-navigation-subpage" aria-current={activeTab === "payouts" ? "page" : undefined} href={viewHref("payouts")} onClick={(event) => navigate(event, "payouts")}>Requests <LockIcon /><img className="navigation-mini-icon" src="/illustrations/clock.svg" alt="" /></a>}
            </div>
          ))}
          {allowed && !allowed.has("finance") && allowed.has("payouts") && <div className="task-navigation-group"><span className="task-navigation-parent">Finance</span><a className="task-navigation-subpage" aria-current={activeTab === "payouts" ? "page" : undefined} href={viewHref("payouts")} onClick={(event) => navigate(event, "payouts")}>Requests <LockIcon /><img className="navigation-mini-icon" src="/illustrations/clock.svg" alt="" /></a></div>}

        </nav>
        <footer className="task-overlay-footer">
          <a href={viewHref("settings")} aria-current={activeTab === "settings" ? "page" : undefined} onClick={(event) => navigate(event, "settings")}>Settings</a>
          <button type="button" className="task-logout" onClick={handleSignOut}>Log out</button>
        </footer>
      </dialog>, document.body)}
    </header>
  );

}
