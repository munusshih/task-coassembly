"use client";

function IconCheckbox() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1.5" y="1.5" width="11" height="11" rx="2"/><polyline points="4,7 6,9.5 10,5"/></svg>;
}
function IconPeople() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="5.5" cy="5" r="2"/><path d="M1 12c0-2.2 2-3.5 4.5-3.5S10 9.8 10 12"/><circle cx="10.5" cy="5" r="1.5"/><path d="M10 8.7c1.8.3 3 1.4 3 3.3"/></svg>;
}
function IconFolder() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1.5 3.5h4l1.5 2h5.5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H1.5a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z"/></svg>;
}
function IconChart() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1.5,10.5 4.5,6.5 7,8.5 10,4.5 12.5,6"/><line x1="1.5" y1="12" x2="12.5" y2="12"/></svg>;
}
function IconDoc() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="1" width="9" height="12" rx="1.5"/><line x1="4.5" y1="5" x2="9.5" y2="5"/><line x1="4.5" y1="7.5" x2="9.5" y2="7.5"/><line x1="4.5" y1="10" x2="7.5" y2="10"/></svg>;
}
function IconLink() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5.5 9.5a4 4 0 0 0 3 1.5 3.5 3.5 0 0 0 0-7H7"/><path d="M8.5 4.5a4 4 0 0 0-3-1.5 3.5 3.5 0 0 0 0 7H7"/></svg>;
}

function IconBacklog() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="2" y1="4" x2="8" y2="4"/><line x1="2" y1="7" x2="9.5" y2="7"/><line x1="2" y1="10" x2="7" y2="10"/><polyline points="10.5,5.5 12,7 10.5,8.5"/></svg>;
}

const TABS = [
  { key: "members",         label: "Member To-do", Icon: IconCheckbox },
  { key: "memberDirectory", label: "Members",       Icon: IconPeople   },
  { key: "projects",        label: "Projects",      Icon: IconFolder   },
  { key: "backlog",         label: "Wishes",       Icon: IconBacklog  },
  { key: "finance",         label: "Finance",       Icon: IconChart    },
  { key: "meetingNotes",    label: "Notes / doc",   Icon: IconDoc      },
  { key: "resources",       label: "Resources",     Icon: IconLink     },
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
              <span className="nav-tab-icon"><tab.Icon /></span>
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
