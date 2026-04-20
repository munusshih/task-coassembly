"use client";

const TABS = [
  { key: "members", label: "Member To-do" },
  { key: "projects", label: "Projects" },
  { key: "finance", label: "Finance" },
  { key: "tasks", label: "X" },
  { key: "kanban", label: "X" },
  { key: "meetingNotes", label: "Meeting Notes" },
  { key: "resources", label: "Resources" },
];

export default function Navigation({ activeTab, onTabChange }) {
  return (
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
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
