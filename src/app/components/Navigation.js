"use client";

const TABS = [
  { key: "members", label: "Member To-do" },
  { key: "projects", label: "Projects" },
  { key: "finance", label: "Finance" },
  { key: "meetingNotes", label: "Meeting Notes" },
  { key: "resources", label: "Resources" },
];

export default function Navigation({ activeTab, onTabChange, viewers = [] }) {
  const tabViewerCount = TABS.reduce((acc, tab) => {
    acc[tab.key] = viewers.filter((v) => v.tab === tab.key).length;
    return acc;
  }, {});

  return (
    <div className="nav-wrap">
      <div className="nav-live-strip">
        <span className="nav-live-label">Live</span>
        <div className="nav-live-dots">
          {viewers.slice(0, 8).map((v) => (
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

      <nav className="nav-bar">
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
            {tabViewerCount[tab.key] > 0 && (
              <span className="nav-tab-count">{tabViewerCount[tab.key]}</span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
