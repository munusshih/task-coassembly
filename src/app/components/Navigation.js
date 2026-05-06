"use client";

import { signOut } from "firebase/auth";
import { auth } from "../../firebase";
import {
  IconBacklog,
  IconChartLine,
  IconChecklist,
  IconDocument,
  IconFolder,
  IconLink,
  IconReceipt,
  IconUsers,
} from "./icons";

const TABS = [
  { key: "members", label: "Member To-do", Icon: IconChecklist },
  { key: "memberDirectory", label: "Members", Icon: IconUsers },
  { key: "projects", label: "Projects", Icon: IconFolder },
  { key: "backlog", label: "Wishes", Icon: IconBacklog },
  { key: "finance", label: "Finance", Icon: IconChartLine },
  { key: "payouts", label: "Requests", Icon: IconReceipt },
  { key: "meetingNotes", label: "Notes / doc", Icon: IconDocument },
  { key: "resources", label: "Resources", Icon: IconLink },
];

export default function Navigation({
  activeTab,
  onTabChange,
  viewers = [],
  commentCounts = {},
  isAdmin = false,
  allowedTabs = [],
}) {
  async function handleSignOut() {
    try {
      if (auth) {
        await signOut(auth);
      }
    } finally {
      if (typeof window !== "undefined") {
        window.location.assign("/login");
      }
    }
  }

  const allowed =
    Array.isArray(allowedTabs) && allowedTabs.length
      ? new Set(allowedTabs)
      : null;

  return (
    <aside className="nav-wrap">
      <nav className="nav-bar" aria-label="Primary navigation">
        <div className="nav-tabs">
          <div className="nav-brand" aria-hidden="true">
            <span className="nav-brand-text">CoA</span>
          </div>
          {TABS.filter((tab) => {
            if (!isAdmin && tab.key === "memberDirectory") return false;
            if (allowed && !allowed.has(tab.key)) return false;
            return true;
          }).map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={
                tab.key === activeTab ? "nav-tab nav-tab--active" : "nav-tab"
              }
              onClick={() => onTabChange(tab.key)}
            >
              <span className="nav-tab-icon">
                <tab.Icon />
              </span>
              <span className="nav-tab-label">{tab.label}</span>
              {(commentCounts[tab.key] || 0) > 0 && (
                <span className="nav-tab-count">{commentCounts[tab.key]}</span>
              )}
            </button>
          ))}
        </div>

        <div className="nav-footer">
          <div
            className="nav-presence-total"
            title={`${viewers.length} viewer${viewers.length === 1 ? "" : "s"}`}
          >
            <div className="nav-live-dots">
              {viewers.slice(0, 10).map((v) => (
                <span
                  key={v.id}
                  className="nav-live-dot"
                  title={v.name || "Viewer"}
                  style={{ background: v.color || "#999" }}
                />
              ))}
            </div>
            <span className="nav-live-count">{viewers.length} online</span>
          </div>

          <div className="nav-signout-form">
            <button
              type="button"
              onClick={handleSignOut}
              className="nav-signout-btn"
              title="Sign out and return to login"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>
    </aside>
  );
}
