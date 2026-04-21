"use client";

import CountBadge from "./CountBadge";

export default function BoardSection({ title, badge, children, className = "", headerExtra }) {
  const classes = ["board-section", className].filter(Boolean).join(" ");

  return (
    <div className={classes}>
      <div className="board-section-head">
        <span className="board-section-title">{title}</span>
        <div className="board-section-meta">
          {badge ? <CountBadge>{badge}</CountBadge> : null}
          {headerExtra}
        </div>
      </div>
      {children}
    </div>
  );
}
