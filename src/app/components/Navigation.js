"use client";

const TABS = [
  { key: "members", label: "Member To-do" },
  { key: "projects", label: "Projects" },
  { key: "finance", label: "Finance" },
  { key: "meetingNotes", label: "Meeting Notes" },
  { key: "resources", label: "Resources" },
];

export default function Navigation({ activeTab, onTabChange, viewers = [], commentCounts = {} }) {

  return (
    <div className="nav-wrap">
      <nav className="nav-bar">
        <div className="nav-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={
                tab.key === activeTab ? "nav-tab nav-tab--active" : "nav-tab"
              }
              onClick={() => onTabChange(tab.key)}
            >
              <span className="nav-tab-label">{tab.label}</span>
              {(commentCounts[tab.key] || 0) > 0 && (
                <span className="nav-tab-count">{commentCounts[tab.key]}</span>
              )}
            </button>
          ))}
        </div>

        <div className="nav-presence-total" title={`${viewers.length} viewer${viewers.length === 1 ? "" : "s"}`}>
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
          <span className="nav-live-count">{viewers.length}</span>
        </div>
      </nav>
    </div>
  );
}
